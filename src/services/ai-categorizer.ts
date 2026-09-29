import { supabase } from '@/lib/supabase/client'

export interface AiBatchTransactionInput {
  tempId: string
  description: string
  amountCents: number
  date?: string
}

export interface AiCategorizationSuggestion {
  tempId: string
  categoryId: string
  subcategoryId?: string | null
  confidence: number
  reasoning: string
}

interface BatchCategorizeResponse {
  suggestions?: AiCategorizationSuggestion[]
  totalProcessed?: number
  error?: string
  message?: string
}

/**
 * Invoca a Edge Function 'batch-categorize' com autenticação JWT e fallback elegante.
 * Se a função falhar, der timeout ou a OpenAI estiver temporariamente instável,
 * retorna um array vazio sem travar a interface do usuário.
 */
export async function categorizeBatchWithAI(
  transactions: AiBatchTransactionInput[],
  familyId?: string,
): Promise<AiCategorizationSuggestion[]> {
  if (!transactions || transactions.length === 0) {
    return []
  }

  try {
    const { data, error } = await supabase.functions.invoke<BatchCategorizeResponse>(
      'batch-categorize',
      {
        body: {
          transactions,
          familyId,
        },
      },
    )

    if (error) {
      console.warn('Falha na chamada da Edge Function batch-categorize:', error)
      return []
    }

    if (!data || !Array.isArray(data.suggestions)) {
      console.warn('Resposta inesperada da Edge Function batch-categorize:', data)
      return []
    }

    return data.suggestions
  } catch (err) {
    // Fallback gracioso: loga e retorna array vazio sem interromper o fluxo da UI
    console.warn('Exceção ao categorizar lote com IA:', err)
    return []
  }
}
