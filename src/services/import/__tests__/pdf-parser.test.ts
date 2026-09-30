import { describe, it, expect } from 'vitest'
import {
  generatePdfFitid,
  isPdfPasswordError,
  classifyPdfPasswordError,
  PdfPasswordProtectedError,
  deduplicateExtractedTransactions,
  isDeterministicNonExpense,
  normalizeDescriptionForDedup,
  extractRawTextFromPdf,
  isNonTransactionLine,
  NON_TRANSACTION_TERMS,
} from '../pdf-parser'
import * as pdfjsDist from 'pdfjs-dist'
import { vi } from 'vitest'

describe('pdf-parser service', () => {
  it('gera FITID determinístico curto a partir de data, descrição e valor', () => {
    const fitid1 = generatePdfFitid('2025-05-15', 'Uber *Trip', 2490)
    const fitid2 = generatePdfFitid('2025-05-15', 'Uber *Trip', 2490)
    const fitid3 = generatePdfFitid('2025-05-15', 'Uber *Outra', 2490)

    expect(fitid1).toBe(fitid2)
    expect(fitid1.startsWith('PDF-20250515-')).toBe(true)
    expect(fitid1).not.toBe(fitid3)
  })

  it('detecta erros de senha do PDF (PasswordException, No password given, etc.)', () => {
    expect(isPdfPasswordError({ name: 'PasswordException', message: 'No password given' })).toBe(
      true,
    )
    expect(isPdfPasswordError(new Error('No password given'))).toBe(true)
    expect(isPdfPasswordError(new Error('Password required to open this PDF'))).toBe(true)
    expect(isPdfPasswordError(new Error('Incorrect password'))).toBe(true)
    expect(isPdfPasswordError(new PdfPasswordProtectedError('NEED_PASSWORD'))).toBe(true)
    expect(isPdfPasswordError(new Error('Invalid PDF structure'))).toBe(false)
    expect(isPdfPasswordError(null)).toBe(false)
  })

  it('classifica corretamente entre NEED_PASSWORD e INCORRECT_PASSWORD', () => {
    // 1. Falha sem senha prévia (No password given) -> NEED_PASSWORD
    const errInitial = classifyPdfPasswordError(
      { name: 'PasswordException', message: 'No password given' },
      false,
    )
    expect(errInitial.kind).toBe('NEED_PASSWORD')
    expect(errInitial.message).toBe('Esta fatura é protegida por senha.')

    // 2. Falha com código 2 (pdfjs INCORRECT_PASSWORD)
    const errCode2 = classifyPdfPasswordError(
      { name: 'PasswordException', code: 2, message: 'Password required' },
      false,
    )
    expect(errCode2.kind).toBe('INCORRECT_PASSWORD')
    expect(errCode2.message).toBe('Senha incorreta. Tente novamente.')

    // 3. Falha quando uma senha já havia sido tentada (hadPassword = true)
    const errAfterAttempt = classifyPdfPasswordError(
      { name: 'PasswordException', message: 'No password given' },
      true,
    )
    expect(errAfterAttempt.kind).toBe('INCORRECT_PASSWORD')
    expect(errAfterAttempt.message).toBe('Senha incorreta. Tente novamente.')
  })

  describe('deduplicateExtractedTransactions', () => {
    it('remove duplicatas entre blocos (mesma data + descrição normalizada + valor)', () => {
      const items = [
        {
          date: '2025-02-10',
          description: 'DROGASIL SAO PAULO',
          cleanMerchant: 'Drogasil',
          amountCents: 4590,
        },
        {
          date: '2025-02-10',
          description: 'DROGASIL SÃO PAULO',
          cleanMerchant: 'Drogasil',
          amountCents: 4590, // Duplicata da fronteira de páginas
        },
        {
          date: '2025-02-11',
          description: 'UBER *TRIP',
          cleanMerchant: 'Uber',
          amountCents: 2450,
        },
        {
          date: '2025-02-10',
          description: 'DROGASIL',
          cleanMerchant: 'Drogasil',
          amountCents: 3200, // Valor diferente -> NÃO é duplicata
        },
      ]

      const deduplicated = deduplicateExtractedTransactions(items)
      expect(deduplicated).toHaveLength(3)
      expect(deduplicated[0].cleanMerchant).toBe('Drogasil')
      expect(deduplicated[0].amountCents).toBe(4590)
      expect(deduplicated[1].cleanMerchant).toBe('Uber')
      expect(deduplicated[2].amountCents).toBe(3200)
    })
  })

  describe('isDeterministicNonExpense', () => {
    it('intercepta quitações e pagamentos de fatura anterior', () => {
      expect(isDeterministicNonExpense('Pagamento recebido em 05/02/2025')).toBe(true)
      expect(isDeterministicNonExpense('PAGAMENTO DE FATURA')).toBe(true)
      expect(isDeterministicNonExpense('Pagamento de fatura -5.443,36')).toBe(true)
      expect(isDeterministicNonExpense('Pagamento Efetuado')).toBe(true)
      expect(isDeterministicNonExpense('PAGTO FATURA')).toBe(true)
      expect(isDeterministicNonExpense('Pagamento Mínimo')).toBe(true)
      expect(isDeterministicNonExpense('PAGAMENTO TITULO')).toBe(true)
      expect(isDeterministicNonExpense('Quitacao de Fatura')).toBe(true)
    })

    it('intercepta limites de crédito, saldos rotativos e opções de parcelamento futuro', () => {
      expect(isDeterministicNonExpense('Limite Total: R$ 20.000,00')).toBe(true)
      expect(isDeterministicNonExpense('Limite Disponível: R$ 15.450,09')).toBe(true)
      expect(isDeterministicNonExpense('Limite de Saque')).toBe(true)
      expect(isDeterministicNonExpense('Saldo Financiado Rotativo')).toBe(true)
      expect(isDeterministicNonExpense('Parcelamento de Fatura Futura')).toBe(true)
    })

    it('intercepta ajustes, estornos, encargos e IOF', () => {
      expect(isDeterministicNonExpense('AJUSTE DE CREDITO')).toBe(true)
      expect(isDeterministicNonExpense('Ajuste a debito')).toBe(true)
      expect(isDeterministicNonExpense('Estorno de compra')).toBe(true)
      expect(isDeterministicNonExpense('ESTORNO PARCIAL')).toBe(true)
      expect(isDeterministicNonExpense('ENCARGOS DE FINANCIAMENTO')).toBe(true)
      expect(isDeterministicNonExpense('IOF COMPRA INTERNACIONAL')).toBe(true)
      expect(isDeterministicNonExpense('IOF DIARIO')).toBe(true)
    })

    it('NÃO intercepta tarifa (regra explícita: não aprovado)', () => {
      expect(isDeterministicNonExpense('Tarifa de anuidade')).toBe(false)
      expect(isDeterministicNonExpense('TARIFA BANCARIA')).toBe(false)
    })

    it('NÃO intercepta compras normais', () => {
      expect(isDeterministicNonExpense('Uber *Trip')).toBe(false)
      expect(isDeterministicNonExpense('IFOOD *RESTAURANTE')).toBe(false)
      expect(isDeterministicNonExpense('DROGASIL 01/03')).toBe(false)
      expect(isDeterministicNonExpense('MERCADO LIVRE')).toBe(false)
    })
  })

  describe('normalizeDescriptionForDedup', () => {
    it('normaliza removendo acentos, pontuações e caixa alta', () => {
      expect(normalizeDescriptionForDedup('PAG*Drogasil S/A (01/03)')).toBe('pagdrogasilsa0103')
      expect(normalizeDescriptionForDedup('Açougue & Cia.')).toBe('acouguecia')
    })
  })

  describe('extractRawTextFromPdf - CMap, estrutura de páginas e quebras de linha', () => {
    it('chama getDocument com cMapUrl e cMapPacked configurados e preserva numeração de página e quebras de linha', async () => {
      const mockGetDocument = vi.spyOn(pdfjsDist, 'getDocument').mockReturnValue({
        promise: Promise.resolve({
          numPages: 2,
          getPage: vi.fn((pageNum: number) => {
            if (pageNum === 1) {
              return Promise.resolve({
                getTextContent: () =>
                  Promise.resolve({
                    items: [
                      { str: 'Cartão Rico Visa Infinite', transform: [1, 0, 0, 1, 10, 700] },
                      { str: 'Final 4949', transform: [1, 0, 0, 1, 200, 700] },
                      { str: '15/02 UBER *TRIP', transform: [1, 0, 0, 1, 10, 650] },
                      { str: 'R$ 24,90', transform: [1, 0, 0, 1, 200, 650] },
                    ],
                  }),
              })
            }
            // Página 2 com pouco ou nenhum texto para testar preservação de pageNumber
            return Promise.resolve({
              getTextContent: () =>
                Promise.resolve({
                  items: [{ str: 'Total da fatura R$ 4.549,91', transform: [1, 0, 0, 1, 10, 700] }],
                }),
            })
          }),
        }),
      } as any)

      const buffer = new ArrayBuffer(64)
      const result = await extractRawTextFromPdf(buffer)

      expect(mockGetDocument).toHaveBeenCalled()
      const firstCallArg = mockGetDocument.mock.calls[0][0] as any
      expect(firstCallArg.cMapUrl).toBeDefined()
      expect(firstCallArg.cMapUrl).toContain('/cmaps/')
      expect(firstCallArg.cMapPacked).toBe(true)
      // Não deve ter flags restritivas
      expect(firstCallArg.isEvalSupported).toBeUndefined()
      expect(firstCallArg.useWorkerFetch).toBeUndefined()

      // Validação das páginas extraídas
      expect(result.pageCount).toBe(2)
      expect(result.pages).toHaveLength(2)
      expect(result.pages[0].pageNumber).toBe(1)
      expect(result.pages[1].pageNumber).toBe(2)

      // Quebras de linha preservadas entre alturas Y diferentes
      expect(result.pages[0].text).toContain(
        'Cartão Rico Visa Infinite Final 4949\n15/02 UBER *TRIP R$ 24,90',
      )
      expect(result.pages[1].text).toBe('Total da fatura R$ 4.549,91')
      expect(result.rawText).toContain('Total da fatura R$ 4.549,91')

      mockGetDocument.mockRestore()
    })

    it('ativa fallback secundário caso a primeira tentativa retorne texto vazio', async () => {
      let callCount = 0
      const mockGetDocument = vi
        .spyOn(pdfjsDist, 'getDocument')
        .mockImplementation((params: any) => {
          callCount++
          if (callCount === 1) {
            // Tentativa primária: retorna páginas com texto vazio (ex: falha de CMap no ambiente)
            return {
              promise: Promise.resolve({
                numPages: 1,
                getPage: () =>
                  Promise.resolve({
                    getTextContent: () =>
                      Promise.resolve({
                        items: [{ str: '', transform: [1, 0, 0, 1, 0, 0] }],
                      }),
                  }),
              }),
            } as any
          }
          // Tentativa de fallback: retorna texto válido
          return {
            promise: Promise.resolve({
              numPages: 1,
              getPage: () =>
                Promise.resolve({
                  getTextContent: () =>
                    Promise.resolve({
                      items: [
                        { str: 'Lançamento Fallback R$ 100,00', transform: [1, 0, 0, 1, 10, 500] },
                      ],
                    }),
                }),
            }),
          } as any
        })

      const buffer = new ArrayBuffer(64)
      const result = await extractRawTextFromPdf(buffer)

      expect(callCount).toBe(2)
      expect(result.pages[0].text).toBe('Lançamento Fallback R$ 100,00')
      expect(result.rawText).toBe('Lançamento Fallback R$ 100,00')

      mockGetDocument.mockRestore()
    })
  })

  describe('isNonTransactionLine - Blindagem determinística universal de faturas', () => {
    it('reconhece e descarta todas as categorias do Requisito 1 de blocklist', () => {
      // 1. Totais e Saldos
      expect(isNonTransactionLine('TOTAL FATURA')).toBe(true)
      expect(isNonTransactionLine('Total da Fatura')).toBe(true)
      expect(isNonTransactionLine('VALOR TOTAL')).toBe(true)
      expect(isNonTransactionLine('TOTAL A PAGAR: R$ 518,93')).toBe(true)
      expect(isNonTransactionLine('valor da fatura')).toBe(true)
      expect(isNonTransactionLine('SALDO DA FATURA')).toBe(true)
      expect(isNonTransactionLine('Total Desta Fatura')).toBe(true)
      expect(isNonTransactionLine('Saldo Anterior')).toBe(true)
      expect(isNonTransactionLine('saldo atual')).toBe(true)
      expect(isNonTransactionLine('SALDO DEVEDOR')).toBe(true)
      expect(isNonTransactionLine('Saldo Remanescente')).toBe(true)
      expect(isNonTransactionLine('SUBTOTAL')).toBe(true)
      expect(isNonTransactionLine('Sub-total')).toBe(true)
      expect(isNonTransactionLine('TOTAL DOS LANÇAMENTOS')).toBe(true)
      expect(isNonTransactionLine('Total de Compras')).toBe(true)

      // 2. Pagamentos e Quitações
      expect(isNonTransactionLine('PAGAMENTO DE FATURA')).toBe(true)
      expect(isNonTransactionLine('Pagamento de Fatura -5.443,36')).toBe(true)
      expect(isNonTransactionLine('Pagamento Recebido')).toBe(true)
      expect(isNonTransactionLine('PGTO FATURA')).toBe(true)
      expect(isNonTransactionLine('PAGTO FATURA')).toBe(true)
      expect(isNonTransactionLine('Pagamento Efetuado')).toBe(true)
      expect(isNonTransactionLine('PAGAMENTO ON-LINE')).toBe(true)
      expect(isNonTransactionLine('Crédito de Pagamento')).toBe(true)
      expect(isNonTransactionLine('Recebimento de Fatura')).toBe(true)

      // 3. Limites e Crédito
      expect(isNonTransactionLine('LIMITE TOTAL')).toBe(true)
      expect(isNonTransactionLine('Limite de Crédito')).toBe(true)
      expect(isNonTransactionLine('LIMITE DISPONÍVEL')).toBe(true)
      expect(isNonTransactionLine('Limite Utilizado')).toBe(true)
      expect(isNonTransactionLine('Limite para Saque')).toBe(true)
      expect(isNonTransactionLine('LIMITE A VISTA')).toBe(true)
      expect(isNonTransactionLine('Limite Parcelado')).toBe(true)

      // 4. Parcelamento e Mínimo
      expect(isNonTransactionLine('PAGAMENTO MÍNIMO')).toBe(true)
      expect(isNonTransactionLine('Pagto Mínimo')).toBe(true)
      expect(isNonTransactionLine('Valor Mínimo')).toBe(true)
      expect(isNonTransactionLine('PARCELAMENTO DE FATURA')).toBe(true)
      expect(isNonTransactionLine('Parcela Fácil')).toBe(true)
      expect(isNonTransactionLine('FATURA PARCELADA')).toBe(true)
      expect(isNonTransactionLine('Opção de Parcelamento')).toBe(true)
      expect(isNonTransactionLine('Financiamento Rotativo')).toBe(true)

      // 5. Encargos e Institucionais
      expect(isNonTransactionLine('CUSTO EFETIVO TOTAL')).toBe(true)
      expect(isNonTransactionLine('CET ANUAL')).toBe(true)
      expect(isNonTransactionLine('CET Mensal')).toBe(true)
      expect(isNonTransactionLine('Projeção de Encargos')).toBe(true)
      expect(isNonTransactionLine('Taxa de Juros')).toBe(true)
      expect(isNonTransactionLine('OUVIDORIA')).toBe(true)
      expect(isNonTransactionLine('Ouvidoria 0800 722 0048')).toBe(true)
      expect(isNonTransactionLine('CANAIS DE ATENDIMENTO')).toBe(true)
    })

    it('NÃO descarta compras legítimas com nomes parecidos', () => {
      // Estabelecimentos legítimos que não são linhas de cabeçalho/resumo
      expect(isNonTransactionLine('PADARIA BOM LIMITE')).toBe(false)
      expect(isNonTransactionLine('RESTAURANTE SEM LIMITE')).toBe(false)
      expect(isNonTransactionLine('FARMACIA TOTAL')).toBe(false)
      expect(isNonTransactionLine('POSTO TOTAL COMBUSTIVEIS')).toBe(false)
      expect(isNonTransactionLine('SUPERMERCADO MINIMO')).toBe(false)
      expect(isNonTransactionLine('BAR E LANCHONETE SALDO')).toBe(false)
      expect(isNonTransactionLine('UBER *TRIP')).toBe(false)
      expect(isNonTransactionLine('AMAZON.COM.BR 01/03')).toBe(false)
      expect(isNonTransactionLine('NETFLIX.COM')).toBe(false)
      expect(isNonTransactionLine('DROGASIL')).toBe(false)
      expect(isNonTransactionLine('SPOTIFY')).toBe(false)
      expect(isNonTransactionLine('IFOOD *RESTAURANTE')).toBe(false)
    })

    it('deduplicateExtractedTransactions descarta sumariamente linhas de não-transação', () => {
      const items = [
        {
          date: '2025-02-10',
          description: 'TOTAL FATURA',
          cleanMerchant: 'Total Fatura',
          amountCents: 51893,
        },
        {
          date: '2025-02-10',
          description: 'PAGAMENTO MINIMO',
          cleanMerchant: 'Pagamento Minimo',
          amountCents: 10000,
        },
        {
          date: '2025-02-10',
          description: 'LIMITE TOTAL',
          cleanMerchant: 'Limite Total',
          amountCents: 500000,
        },
        {
          date: '2025-02-11',
          description: 'MERCADO BOM PRECO',
          cleanMerchant: 'Mercado Bom Preço',
          amountCents: 15420,
        },
        {
          date: '2025-02-12',
          description: 'UBER *TRIP',
          cleanMerchant: 'Uber',
          amountCents: 2490,
        },
      ]

      const deduplicated = deduplicateExtractedTransactions(items)
      expect(deduplicated).toHaveLength(2)
      expect(deduplicated.map((d) => d.description)).toEqual(['MERCADO BOM PRECO', 'UBER *TRIP'])
    })
  })
})
