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

export interface AiPdfTransactionItem {
  date: string // YYYY-MM-DD
  description: string
  cleanMerchant: string
  amountCents: number
  type?: 'expense' | 'income'
  installment?: string
  categoryId: string
  subcategoryId?: string | null
  confidence: number
}

interface BatchCategorizeResponse {
  suggestions?: AiCategorizationSuggestion[]
  transactions?: AiPdfTransactionItem[]
  declaredTotalCents?: number | null
  totalProcessed?: number
  totalExtracted?: number
  mode?: 'batch' | 'pdf'
  error?: string
  message?: string
}

export interface ParsePdfAiResult {
  success: boolean
  transactions: AiPdfTransactionItem[]
  declaredTotalCents?: number | null
  error?: string
}

/**
 * Invoca a Edge Function 'batch-categorize' no modo PDF com texto bruto.
 * A IA especializada extrai todas as compras/estornos reais, descarta ruídos,
 * captura o valor total declarado da fatura quando identificável
 * e já classifica cada transação no catálogo da família.
 */
export async function parsePdfWithAI(
  rawText: string,
  familyId?: string,
): Promise<ParsePdfAiResult> {
  if (!rawText || !rawText.trim()) {
    return {
      success: false,
      transactions: [],
      error: 'O texto do PDF está vazio ou não pôde ser extraído.',
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke<BatchCategorizeResponse>(
      'batch-categorize',
      {
        body: {
          rawText,
          familyId,
        },
      },
    )

    if (error) {
      console.warn('Falha na chamada da Edge Function batch-categorize (modo PDF):', error)
      return {
        success: false,
        transactions: [],
        error: error.message || 'Falha ao processar o extrato com IA.',
      }
    }

    if (!data || !Array.isArray(data.transactions)) {
      console.warn('Resposta inesperada da Edge Function batch-categorize (modo PDF):', data)
      return {
        success: false,
        transactions: [],
        error: data?.message || 'A IA não retornou transações formatadas.',
      }
    }

    return {
      success: true,
      transactions: data.transactions,
      declaredTotalCents:
        typeof data.declaredTotalCents === 'number' && data.declaredTotalCents > 0
          ? Math.round(data.declaredTotalCents)
          : null,
    }
  } catch (err: any) {
    console.warn('Exceção ao processar PDF com IA:', err)
    return {
      success: false,
      transactions: [],
      error: err?.message || 'Erro inesperado na análise com IA.',
    }
  }
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
