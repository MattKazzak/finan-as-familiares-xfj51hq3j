import { describe, it, expect, vi, beforeEach } from 'vitest'
import { categorizeBatchWithAI } from '../ai-categorizer'
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
