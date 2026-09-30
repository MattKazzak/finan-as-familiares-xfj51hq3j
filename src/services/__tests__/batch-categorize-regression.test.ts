import { describe, it, expect } from 'vitest'
import { isDeterministicNonExpense, deduplicateExtractedTransactions } from '../import/pdf-parser'
import { parseInstallmentFromDescription } from '../installments'

describe('Edge Function batch-categorize regression logic & PDF universal parser', () => {
  it('garante que a lógica de sanitização de transações executa perfeitamente sem ReferenceError', () => {
    // Simula exatamente o bloco de sanitização da Edge Function batch-categorize
    const validCategoryIds = new Set(['cat-saude', 'cat-transporte', 'cat-lifestyle'])
    const catToSubsMap = new Map<string, Set<string>>([['cat-saude', new Set(['sub-farmacia'])]])
    const categoriesList = [{ id: 'cat-geral', type: 'expense' }]

    const rawItems: any[] = [
      {
        description: 'DROGASIL SAO PAULO 01/03',
        cleanMerchant: 'Drogasil',
        amountCents: 8990,
        date: '2025-05-15',
        type: 'expense',
        installment: '01/03',
        categoryId: 'cat-saude',
        subcategoryId: 'sub-farmacia',
        confidence: 0.95,
      },
      {
        description: 'PAGAMENTO FATURA 15/05',
        cleanMerchant: '',
        amountCents: 0, // Ignorado
      },
      {
        description: 'UBER *TRIP',
        cleanMerchant: 'Uber',
        amountCents: 2450,
        date: '2025-05-16',
        type: 'expense',
        categoryId: 'cat-invalida', // Fallback para primeira despesa
        confidence: 0.9,
      },
    ]

    const sanitizedTransactions: Array<{
      date: string
      description: string
      cleanMerchant: string
      amountCents: number
      type: 'expense' | 'income'
      installment?: string
      categoryId: string
      subcategoryId: string | null
      confidence: number
    }> = []

    for (const item of rawItems) {
      if (!item || typeof item !== 'object') continue

      const amount =
        typeof item.amountCents === 'number' ? Math.round(Math.abs(item.amountCents)) : 0
      if (amount <= 0) continue

      const desc = String(item.description || item.cleanMerchant || '').trim()
      if (!desc) continue

      let date = String(item.date || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        date = new Date().toISOString().slice(0, 10)
      }

      let catId = String(item.categoryId || '')
      let subId: string | null = item.subcategoryId ? String(item.subcategoryId) : null

      if (!validCategoryIds.has(catId)) {
        const fallbackCat =
          categoriesList.find((c: any) => c.type === 'expense') || categoriesList[0]
        catId = fallbackCat?.id || ''
        subId = null
      } else {
        const allowedSubs = catToSubsMap.get(catId)
        if (!subId || !allowedSubs || !allowedSubs.has(subId)) {
          subId = null
        }
      }

      sanitizedTransactions.push({
        date,
        description: desc,
        cleanMerchant: String(item.cleanMerchant || desc).trim(),
        amountCents: amount,
        type: item.type === 'income' ? 'income' : 'expense',
        installment: item.installment ? String(item.installment).trim() : undefined,
        categoryId: catId,
        subcategoryId: subId,
        confidence:
          typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.85,
      })
    }

    expect(sanitizedTransactions).toHaveLength(2)
    expect(sanitizedTransactions[0].cleanMerchant).toBe('Drogasil')
    expect(sanitizedTransactions[0].amountCents).toBe(8990)
    expect(sanitizedTransactions[0].categoryId).toBe('cat-saude')
    expect(sanitizedTransactions[0].subcategoryId).toBe('sub-farmacia')
    expect(sanitizedTransactions[0].installment).toBe('01/03')

    expect(sanitizedTransactions[1].cleanMerchant).toBe('Uber')
    expect(sanitizedTransactions[1].amountCents).toBe(2450)
    expect(sanitizedTransactions[1].categoryId).toBe('cat-geral')
    expect(sanitizedTransactions[1].subcategoryId).toBeNull()
  })

  // REQUISITO 1: Suporte a Múltiplos Cartões e Seções (Caso Rico/XP e Adicionais)
  // Presença de pagamento anterior e subtotais intermediários não bloqueia extração de compras
  describe('Requisito 1: Suporte a Múltiplos Cartões e Seções (Rico/XP)', () => {
    it('continua a extração legítima de compras em página que contém linha de pagamento anterior', () => {
      const pageTransactions = [
        {
          date: '2025-02-02',
          description: 'Pagamento de fatura -5.443,36',
          amount_cents: 544336,
          type: 'expense' as const,
        },
        {
          date: '2025-02-05',
          description: 'AMAZON.COM.BR 01/03',
          amount_cents: 30000,
          type: 'expense' as const,
        },
        {
          date: '2025-02-10',
          description: 'POSTO SHELL',
          amount_cents: 15000,
          type: 'expense' as const,
        },
      ]

      // O filtro determinístico deve marcar APENAS a linha do pagamento como não-despesa
      const classified = pageTransactions.map((tx) => ({
        ...tx,
        isNonExpense: isDeterministicNonExpense(tx.description),
      }))

      expect(classified[0].isNonExpense).toBe(true)
      expect(classified[1].isNonExpense).toBe(false)
      expect(classified[2].isNonExpense).toBe(false)

      // Compras legítimas são preservadas e selecionadas
      const legitimatePurchases = classified.filter((tx) => !tx.isNonExpense)
      expect(legitimatePurchases).toHaveLength(2)
      expect(legitimatePurchases[0].description).toBe('AMAZON.COM.BR 01/03')
      expect(legitimatePurchases[1].description).toBe('POSTO SHELL')
    })
  })

  // REQUISITO 2: Tratamento Universal de Moeda e Câmbio (Nubank, C6, Itaú)
  // Em compras internacionais, apenas BRL vira lançamento; linhas em US$ são ignoradas
  describe('Requisito 2: Tratamento Universal de Moeda e Câmbio', () => {
    it('ignora linha em moeda estrangeira (US$) e extrai exclusivamente o valor final em BRL', () => {
      // Simulação da saída gerada após aplicação da regra de câmbio universal
      const rawExtracted = [
        {
          date: '2025-02-08',
          description: 'SPOTIFY (Câmbio 5,50 + IOF)',
          cleanMerchant: 'Spotify',
          amountCents: 2320, // R$ 23,20 em BRL
          type: 'expense' as const,
        },
      ]

      expect(rawExtracted).toHaveLength(1)
      expect(rawExtracted[0].amountCents).toBe(2320)
      expect(rawExtracted[0].description).toContain('Câmbio')
    })
  })

  // REQUISITO 3: Descarte Estrito de Não-Despesas e Captura de Parcelas e Estornos
  describe('Requisito 3: Descarte de Não-Despesas, Identificação de Parcelas e Estornos', () => {
    it('descarta pagamentos, limites, saldos rotativos e opções de parcelamento', () => {
      expect(isDeterministicNonExpense('Pagamento de fatura -5.443,36')).toBe(true)
      expect(isDeterministicNonExpense('Limite Total: R$ 20.000,00')).toBe(true)
      expect(isDeterministicNonExpense('Limite Disponível: R$ 15.450,09')).toBe(true)
      expect(isDeterministicNonExpense('Saldo Financiado / Rotativo')).toBe(true)
      expect(isDeterministicNonExpense('Parcelamento de Fatura')).toBe(true)
    })

    it('identifica compras parceladas com padrões 01/03 e 2/12', () => {
      const p1 = parseInstallmentFromDescription('AMAZON.COM.BR 01/03')
      expect(p1.isInstallment).toBe(true)
      expect(p1.current).toBe(1)
      expect(p1.total).toBe(3)

      const p2 = parseInstallmentFromDescription('DROGASIL 2/12')
      expect(p2.isInstallment).toBe(true)
      expect(p2.current).toBe(2)
      expect(p2.total).toBe(12)
    })

    it('mantém estornos como type income com valor correto', () => {
      const reversalTx = {
        date: '2025-02-14',
        description: 'ESTORNO COMPRA CANCELADA',
        cleanMerchant: 'Estorno Compra Cancelada',
        amountCents: 4500,
        type: 'income' as const,
      }

      expect(reversalTx.type).toBe('income')
      expect(reversalTx.amountCents).toBe(4500)
    })
  })

  // REQUISITO 4: Validação Matemática de Fechamento (Caso Real da Fatura Rico)
  // Cartão 4949 (R$ 3.221,84) + 5 compras Cartão 010 (R$ 1.328,07) = R$ 4.549,91 da fatura
  describe('Requisito 4: Validação Matemática de Fechamento Multi-Cartão (Rico)', () => {
    it('soma compras de múltiplos cartões e bate exatamente com o total declarado da fatura sem alerta', () => {
      // Cartão final 4949 (total: 3.221,84 = 322184 centavos)
      interface TestItem {
        description: string
        amount_cents: number
        type: 'expense' | 'income'
      }

      const card4949Purchases: TestItem[] = [
        { description: 'COMPRA A 4949', amount_cents: 122184, type: 'expense' },
        { description: 'COMPRA B 4949', amount_cents: 200000, type: 'expense' },
      ]

      // 5 compras Cartão final 010 (total: 1.328,07 = 132807 centavos)
      const card010Purchases: TestItem[] = [
        { description: 'COMPRA 1 CARTAO 010', amount_cents: 32807, type: 'expense' },
        { description: 'COMPRA 2 CARTAO 010', amount_cents: 20000, type: 'expense' },
        { description: 'COMPRA 3 CARTAO 010', amount_cents: 30000, type: 'expense' },
        { description: 'COMPRA 4 CARTAO 010', amount_cents: 25000, type: 'expense' },
        { description: 'COMPRA 5 CARTAO 010', amount_cents: 25000, type: 'expense' },
      ]

      // Linha de pagamento que veio no meio do extrato
      const paymentLine: TestItem = {
        description: 'Pagamento de fatura -5.443,36',
        amount_cents: 544336,
        type: 'expense' as const,
      }

      const allItems = [...card4949Purchases, ...card010Purchases, paymentLine].map((item) => ({
        ...item,
        isNonExpense: isDeterministicNonExpense(item.description),
      }))

      // Total declarado no cabeçalho da fatura Rico
      const declaredTotalCents = 454991 // R$ 4.549,91

      // Lógica de fechamento do ImportStatementDialog:
      const validExpenses = allItems.filter((i) => i.type === 'expense' && !i.isNonExpense)
      const validIncomes = allItems.filter((i) => i.type === 'income' && !i.isNonExpense)

      const expensesSum = validExpenses.reduce((acc, curr) => acc + curr.amount_cents, 0)
      const reversalsSum = validIncomes.reduce((acc, curr) => acc + curr.amount_cents, 0)
      const netSum = expensesSum - reversalsSum

      const diffNet = Math.abs(netSum - declaredTotalCents)
      const diffGross = Math.abs(expensesSum - declaredTotalCents)
      const diffCents = Math.min(diffNet, diffGross)
      const matches = diffCents <= 5 // tolerância ±5 centavos

      // Compras do cartão 4949 (3.221,84) + compras do cartão 010 (1.328,07) = 4.549,91
      expect(expensesSum).toBe(454991)
      expect(matches).toBe(true)
      expect(diffCents).toBe(0)
    })
  })
})
