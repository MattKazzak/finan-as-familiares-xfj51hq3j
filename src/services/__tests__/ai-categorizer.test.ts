import { describe, it, expect, vi, beforeEach } from 'vitest'
import { categorizeBatchWithAI, parsePdfWithAI } from '../ai-categorizer'
import { supabase } from '@/lib/supabase/client'

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

describe('ai-categorizer service (categorizeBatchWithAI)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna array vazio quando a lista de transações for vazia', async () => {
    const res = await categorizeBatchWithAI([])
    expect(res).toEqual([])
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('chama supabase.functions.invoke com batch-categorize e payload correto', async () => {
    const mockSuggestions = [
      {
        tempId: 'tx-1',
        categoryId: 'cat-alimentacao',
        subcategoryId: 'sub-restaurante',
        confidence: 0.95,
        reasoning: 'Transação iFood corresponde a Alimentação / Restaurante.',
      },
      {
        tempId: 'tx-2',
        categoryId: 'cat-transporte',
        subcategoryId: null,
        confidence: 0.9,
        reasoning: 'Uber corrida corresponde a Transporte.',
      },
    ]

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        suggestions: mockSuggestions,
        totalProcessed: 2,
      },
      error: null,
    })

    const transactions = [
      { tempId: 'tx-1', description: 'IFOOD *RESTAURANTE', amountCents: 4500, date: '2025-05-10' },
      { tempId: 'tx-2', description: 'UBER *TRIP', amountCents: 2490, date: '2025-05-11' },
    ]

    const result = await categorizeBatchWithAI(transactions, 'fam-123')

    expect(supabase.functions.invoke).toHaveBeenCalledWith('batch-categorize', {
      body: {
        transactions,
        familyId: 'fam-123',
      },
    })
    expect(result).toEqual(mockSuggestions)
  })

  it('fallback elegante: retorna array vazio em caso de erro da edge function sem lançar exceção', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: 'Timeout' } as any,
    })

    const transactions = [{ tempId: 'tx-1', description: 'DROGARIA SAO PAULO', amountCents: 8900 }]

    const result = await categorizeBatchWithAI(transactions, 'fam-123')
    expect(result).toEqual([])
  })

  it('fallback elegante: retorna array vazio em caso de rejeição da Promise', async () => {
    vi.mocked(supabase.functions.invoke).mockRejectedValueOnce(new Error('Network error'))

    const transactions = [{ tempId: 'tx-1', description: 'DROGARIA SAO PAULO', amountCents: 8900 }]

    const result = await categorizeBatchWithAI(transactions, 'fam-123')
    expect(result).toEqual([])
  })
})

describe('ai-categorizer service (parsePdfWithAI)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna erro se rawText for vazio', async () => {
    const res = await parsePdfWithAI('   ')
    expect(res.success).toBe(false)
    expect(res.transactions).toEqual([])
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('envia rawText para a Edge Function no modo PDF e retorna transações extraídas', async () => {
    const mockExtracted = [
      {
        date: '2025-05-12',
        description: 'UBER *TRIP 123',
        cleanMerchant: 'Uber',
        amountCents: 3250,
        type: 'expense' as const,
        categoryId: 'cat-transporte',
        subcategoryId: null,
        confidence: 0.95,
      },
      {
        date: '2025-05-13',
        description: 'DROGASIL 02/03',
        cleanMerchant: 'Drogasil',
        amountCents: 15400,
        type: 'expense' as const,
        installment: '02/03',
        categoryId: 'cat-saude',
        subcategoryId: 'sub-farmacia',
        confidence: 0.98,
      },
    ]

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        transactions: mockExtracted,
        totalExtracted: 2,
        mode: 'pdf',
      },
      error: null,
    })

    const result = await parsePdfWithAI('Texto bruto da fatura do Nubank...', 'fam-456')

    expect(supabase.functions.invoke).toHaveBeenCalledWith('batch-categorize', {
      body: {
        rawText: 'Texto bruto da fatura do Nubank...',
        familyId: 'fam-456',
      },
    })
    expect(result.success).toBe(true)
    expect(result.transactions).toEqual(mockExtracted)
  })

  it('trata erro non-2xx cru e converte para mensagem PT-BR amigável sem vazar inglês técnico', async () => {
    // Simula o erro que ocorreu no usuário: FunctionsHttpError "Edge Function returned a non-2xx status code"
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: {
          status: 500,
          json: vi
            .fn()
            .mockResolvedValue({ error: 'OPENAI_ERROR', message: 'Internal Server Error' }),
        },
      } as any,
    })

    const result = await parsePdfWithAI('Algum texto', 'fam-456')
    expect(result.success).toBe(false)
    expect(result.transactions).toEqual([])
    expect(result.error).not.toContain('non-2xx')
    expect(result.error).not.toContain('Edge Function')
    expect(result.error).toBe(
      'Tivemos uma instabilidade temporária ao comunicar com a inteligência de leitura da fatura. Tente novamente em instantes.',
    )
  })

  it('trata erro 429 de rate limit com mensagem específica amigável em PT-BR', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: {
        message: 'Rate limit reached',
        context: {
          status: 429,
          json: vi.fn().mockResolvedValue({ error: 'RATE_LIMIT', message: 'Too many requests' }),
        },
      } as any,
    })

    const result = await parsePdfWithAI('Algum texto', 'fam-456')
    expect(result.success).toBe(false)
    expect(result.transactions).toEqual([])
    expect(result.error).toBe(
      'Serviço de inteligência temporariamente ocupado. Por favor, aguarde alguns segundos e tente novamente.',
    )
  })

  it('executa retry com backoff para status transitórios (429/5xx) até ter sucesso', async () => {
    // 1ª tentativa: falha com 502
    // 2ª tentativa: sucesso
    vi.mocked(supabase.functions.invoke)
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: { status: 502 },
        } as any,
      })
      .mockResolvedValueOnce({
        data: {
          transactions: [
            {
              date: '2025-05-12',
              description: 'TESTE RETRY',
              cleanMerchant: 'Teste',
              amountCents: 1000,
              type: 'expense',
              categoryId: 'cat-1',
              confidence: 0.9,
            },
          ],
          totalExtracted: 1,
        },
        error: null,
      })

    const result = await parsePdfWithAI('Algum texto', 'fam-456')
    expect(result.success).toBe(true)
    expect(result.transactions.length).toBe(1)
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2)
  })

  it('recebe transações sanitizadas com sucesso sem lançar ReferenceError', async () => {
    // Valida o contrato e formato de resposta gerado pela Edge Function batch-categorize no modo PDF
    const mockExtractedItem = {
      date: '2025-05-15',
      description: 'DROGASIL SAO PAULO 01/03',
      cleanMerchant: 'Drogasil',
      amountCents: 8990,
      type: 'expense' as const,
      installment: '01/03',
      categoryId: 'cat-saude',
      subcategoryId: null,
      confidence: 0.95,
    }

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        transactions: [mockExtractedItem],
        declaredTotalCents: 8990,
        totalExtracted: 1,
        mode: 'pdf',
      },
      error: null,
    })

    const result = await parsePdfWithAI('05/02 DROGASIL SAO PAULO 01/03 R$ 89,90', 'fam-123')
    expect(result.success).toBe(true)
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]).toEqual(mockExtractedItem)
    expect(result.declaredTotalCents).toBe(8990)
    expect(result.error).toBeUndefined()
  })

  it('remove caracteres de controle e ruídos de codificação antes de invocar a Edge Function', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        transactions: [],
        totalExtracted: 0,
        mode: 'pdf',
      },
      error: null,
    })

    // Texto com caracteres de controle típicos de PDFs bancários (NUL, form feed, replacement char, BOM)
    const dirtyRawText =
      'Extrato Rico\u0000\u0001\u000B\u000C\u001F\uFFFD\uFEFF\r\n05/04 RESTAURANTE R$ 120,00\u007F'

    await parsePdfWithAI(dirtyRawText, 'fam-123')

    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
    const invokedBody = vi.mocked(supabase.functions.invoke).mock.calls[0][1]?.body as any
    expect(invokedBody.rawText).not.toContain('\u0000')
    expect(invokedBody.rawText).not.toContain('\u0001')
    expect(invokedBody.rawText).not.toContain('\u000B')
    expect(invokedBody.rawText).not.toContain('\u000C')
    expect(invokedBody.rawText).not.toContain('\u001F')
    expect(invokedBody.rawText).not.toContain('\uFFFD')
    expect(invokedBody.rawText).not.toContain('\uFEFF')
    expect(invokedBody.rawText).not.toContain('\u007F')
    expect(invokedBody.rawText).toContain('Extrato Rico\n05/04 RESTAURANTE R$ 120,00')
  })

  it('retorna erro se o texto tiver apenas caracteres de controle que são limpos para string vazia', async () => {
    const onlyControlChars = '\u0000\u0001\u0002\u0008\u000B\u000C\u000E\u001F\uFFFD\uFEFF   '

    const result = await parsePdfWithAI(onlyControlChars, 'fam-123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('O texto do PDF está vazio ou não pôde ser extraído.')
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
})
