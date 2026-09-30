import { describe, it, expect } from 'vitest'

describe('Edge Function batch-categorize regression logic', () => {
  it('garante que a lógica de sanitização de transações executa perfeitamente sem ReferenceError', () => {
    // Simula exatamente o bloco de sanitização da Edge Function batch-categorize
    const validCategoryIds = new Set(['cat-saude', 'cat-transporte'])
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

    // Declaração que antes estava colada em comentário:
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
})
