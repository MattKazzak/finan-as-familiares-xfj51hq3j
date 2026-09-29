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

  it('trata erro retornado pela Edge Function sem quebrar', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: 'Erro na chamada da IA' } as any,
    })

    const result = await parsePdfWithAI('Algum texto', 'fam-456')
    expect(result.success).toBe(false)
    expect(result.transactions).toEqual([])
    expect(result.error).toContain('Erro na chamada da IA')
  })
})
