import { supabase } from '@/lib/supabase/client'
import { sanitizeRawText } from '@/services/import/text-sanitizer'

export interface AiBatchTransactionInput {
  tempId: string
  description: string
  amountCents: number
  date?: string
}

export interface AiCategorizationSuggestion {
  tempId: string
  categoryId: string | null
  subcategoryId?: string | null
  confidence: number
  reasoning: string
  needsReview?: boolean
  alternativeCategoryId?: string | null
}

export interface AiPdfTransactionItem {
  date: string // YYYY-MM-DD
  description: string
  cleanMerchant: string
  amountCents: number
  type?: 'expense' | 'income'
  installment?: string
  categoryId: string | null
  subcategoryId?: string | null
  confidence: number
  needsReview?: boolean
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

export interface ParsePdfChunkProgress {
  currentPage: number
  totalPages: number
  stage: 'reading' | 'extracting' | 'merging' | 'categorizing'
  message?: string
}

/**
 * Helper que extrai mensagem detalhada do FunctionsHttpError (error.context.json() quando disponível)
 * e converte para mensagem amigável em PT-BR. Nenhuma string técnica em inglês vaza para a UI.
 */
export async function extractAiErrorMessage(
  error: any,
): Promise<{ message: string; status?: number }> {
  let status: number | undefined
  let backendMessage = ''

  // Supabase FunctionsHttpError costuma ter context (Response)
  if (error && typeof error === 'object') {
    const ctx = error.context
    if (ctx) {
      if (typeof ctx.status === 'number') {
        status = ctx.status
      }
      if (typeof ctx.json === 'function') {
        try {
          const jsonBody = await ctx
            .clone()
            .json()
            .catch(() => ctx.json())
          if (jsonBody?.message && typeof jsonBody.message === 'string') {
            backendMessage = jsonBody.message
          }
        } catch {
          // ignora falha de parse
        }
      }
    }
    if (!status && typeof error.status === 'number') {
      status = error.status
    }
  }

  // Se o backend retornou mensagem customizada (ex: erro de validação, erro na comunicação)
  // filtra termos técnicos de infraestrutura da Edge Function / status codes genéricos
  if (
    backendMessage &&
    !backendMessage.toLowerCase().includes('edge function') &&
    !backendMessage.toLowerCase().includes('non-2xx') &&
    !backendMessage.toLowerCase().includes('status code')
  ) {
    return { message: backendMessage, status }
  }

  // 429: Rate limit / ocupado
  if (status === 429) {
    return {
      message:
        'Serviço de inteligência temporariamente ocupado. Por favor, aguarde alguns segundos e tente novamente.',
      status,
    }
  }

  // 500, 502, 503, ou erro genérico non-2xx
  if (status && [500, 502, 503, 504].includes(status)) {
    return {
      message:
        'Tivemos uma instabilidade temporária ao comunicar com a inteligência de leitura da fatura. Tente novamente em instantes.',
      status,
    }
  }

  // Tratamento por texto do error.message se o status não veio
  const rawMsg = String(error?.message || '')
  if (rawMsg.includes('429')) {
    return {
      message:
        'Serviço de inteligência temporariamente ocupado. Por favor, aguarde alguns segundos e tente novamente.',
      status: 429,
    }
  }
  if (
    rawMsg.includes('non-2xx') ||
    rawMsg.includes('Edge Function returned') ||
    rawMsg.includes('500') ||
    rawMsg.includes('502') ||
    rawMsg.includes('503') ||
    rawMsg.includes('Failed to fetch')
  ) {
    return {
      message:
        'Tivemos uma instabilidade temporária ao comunicar com a inteligência de leitura da fatura. Tente novamente em instantes.',
      status: status || 500,
    }
  }

  return {
    message:
      'Tivemos uma instabilidade temporária ao comunicar com a inteligência de leitura da fatura. Tente novamente em instantes.',
    status,
  }
}

const RETRY_DELAYS_MS = [500, 1500]

function isTransientStatus(status?: number, rawMsg?: string): boolean {
  if (status && [429, 500, 502, 503, 504].includes(status)) {
    return true
  }
  if (rawMsg) {
    const msg = rawMsg.toLowerCase()
    if (
      msg.includes('429') ||
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('non-2xx') ||
      msg.includes('failed to fetch')
    ) {
      return true
    }
  }
  return false
}

/**
 * Invoca a Edge Function 'batch-categorize' no modo PDF com texto bruto.
 * A IA especializada extrai todas as compras/estornos reais, descarta ruídos,
 * captura o valor total declarado da fatura quando identificável
 * e já classifica cada transação no catálogo da família.
 *
 * Inclui retry com backoff (até 2 retentativas: 500ms, depois 1500ms)
 * para erros transitórios (429, 500, 502, 503) e tradução de erros para PT-BR.
 */
export async function parsePdfWithAI(
  rawText: string,
  familyId?: string,
): Promise<ParsePdfAiResult> {
  // Sanitiza contra caracteres de controle e ruídos de codificação antes de processar
  const sanitized = sanitizeRawText(rawText)

  if (!sanitized || !sanitized.trim()) {
    return {
      success: false,
      transactions: [],
      error: 'O texto do PDF está vazio ou não pôde ser extraído.',
    }
  }

  let attempt = 0
  const maxAttempts = 1 + RETRY_DELAYS_MS.length

  while (attempt < maxAttempts) {
    try {
      const { data, error } = await supabase.functions.invoke<BatchCategorizeResponse>(
        'batch-categorize',
        {
          body: {
            rawText: sanitized,
            familyId,
          },
        },
      )

      if (error) {
        console.warn(
          `Falha na chamada da Edge Function batch-categorize (modo PDF, tentativa ${attempt + 1}/${maxAttempts}):`,
          error,
        )

        const friendly = await extractAiErrorMessage(error)
        const canRetry =
          attempt < RETRY_DELAYS_MS.length && isTransientStatus(friendly.status, error.message)

        if (canRetry) {
          const delay = RETRY_DELAYS_MS[attempt]
          attempt++
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        return {
          success: false,
          transactions: [],
          error: friendly.message,
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
      console.warn(
        `Exceção ao processar PDF com IA (tentativa ${attempt + 1}/${maxAttempts}):`,
        err,
      )

      const friendly = await extractAiErrorMessage(err)
      const canRetry =
        attempt < RETRY_DELAYS_MS.length && isTransientStatus(friendly.status, err?.message)

      if (canRetry) {
        const delay = RETRY_DELAYS_MS[attempt]
        attempt++
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      return {
        success: false,
        transactions: [],
        error: friendly.message,
      }
    }
  }

  return {
    success: false,
    transactions: [],
    error:
      'Tivemos uma instabilidade temporária ao comunicar com a inteligência de leitura da fatura. Tente novamente em instantes.',
  }
}

/**
 * Invoca a Edge Function 'batch-categorize' com autenticação JWT e fallback elegante.
 * Se a função falhar, der timeout ou a OpenAI estiver temporariamente instável,
 * retorna um array vazio sem travar a interface do usuário.
 */
export const BATCH_SIZE = 15
export const BATCH_DELAY_MS = 300
export const CONFIDENCE_THRESHOLD = 0.6

export interface CategorizeBatchOptions {
  validCategoryIds?: Set<string> | string[]
}

/**
 * Invoca a Edge Function 'batch-categorize' dividindo itens em lotes (chunking de 15),
 * chamando em sequência com delay para evitar rate limits, agregando na ordem original,
 * com fallback tolerante por lote e validação de categoryId real.
 */
export async function categorizeBatchWithAI(
  transactions: AiBatchTransactionInput[],
  familyId?: string,
  options?: CategorizeBatchOptions,
): Promise<AiCategorizationSuggestion[]> {
  if (!transactions || transactions.length === 0) {
    return []
  }

  const validSet = options?.validCategoryIds
    ? options.validCategoryIds instanceof Set
      ? options.validCategoryIds
      : new Set(options.validCategoryIds)
    : null

  // Sanitiza descrições das transações no cliente
  const sanitizedTransactions = transactions.map((t) => ({
    ...t,
    description: sanitizeRawText(t.description),
  }))

  // Dividir em lotes de BATCH_SIZE (15)
  const chunks: AiBatchTransactionInput[][] = []
  for (let i = 0; i < sanitizedTransactions.length; i += BATCH_SIZE) {
    chunks.push(sanitizedTransactions.slice(i, i + BATCH_SIZE))
  }

  const aggregatedSuggestions: AiCategorizationSuggestion[] = []

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]

    // Delay entre lotes subsequentes (não no primeiro)
    if (idx > 0 && BATCH_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }

    try {
      const { data, error } = await supabase.functions.invoke<BatchCategorizeResponse>(
        'batch-categorize',
        {
          body: {
            transactions: chunk,
            familyId,
          },
        },
      )

      if (error || !data || !Array.isArray(data.suggestions)) {
        console.warn(
          `[ai-categorizer] Lote ${idx + 1}/${chunks.length} falhou ou retornou formato inválido:`,
          error || data,
        )
        // Se o lote falhar, não abandona tudo: registra itens como não-categorizados
        for (const t of chunk) {
          aggregatedSuggestions.push({
            tempId: t.tempId,
            categoryId: null,
            subcategoryId: null,
            confidence: 0,
            reasoning: 'Lote não processado por instabilidade de rede ou da IA.',
            needsReview: true,
          })
        }
        continue
      }

      // Mapear sugestões retornadas para garantir a ordem original dos itens do lote
      const chunkSugMap = new Map<string, AiCategorizationSuggestion>()
      for (const s of data.suggestions) {
        if (s && s.tempId) {
          chunkSugMap.set(s.tempId, s)
        }
      }

      for (const t of chunk) {
        const itemSug = chunkSugMap.get(t.tempId)
        if (!itemSug) {
          // Item faltante no retorno do lote
          aggregatedSuggestions.push({
            tempId: t.tempId,
            categoryId: null,
            subcategoryId: null,
            confidence: 0,
            reasoning: 'Item não retornado pela IA no lote.',
            needsReview: true,
          })
          continue
        }

        let catId = itemSug.categoryId || null
        let needsReview = Boolean(itemSug.needsReview)

        // Validação de IDs reais se lista de categorias válidas foi informada (Parte 3)
        if (validSet && catId && !validSet.has(catId)) {
          catId = null
          needsReview = true
        }

        aggregatedSuggestions.push({
          tempId: t.tempId,
          categoryId: catId,
          subcategoryId: catId ? itemSug.subcategoryId || null : null,
          confidence: typeof itemSug.confidence === 'number' ? itemSug.confidence : 0.55,
          reasoning: itemSug.reasoning || '',
          needsReview: needsReview || !catId,
          alternativeCategoryId: itemSug.alternativeCategoryId || null,
        })
      }
    } catch (chunkErr) {
      console.warn(`[ai-categorizer] Exceção no lote ${idx + 1}/${chunks.length}:`, chunkErr)
      // Fallback seguro: registra itens do lote como pendentes
      for (const t of chunk) {
        aggregatedSuggestions.push({
          tempId: t.tempId,
          categoryId: null,
          subcategoryId: null,
          confidence: 0,
          reasoning: 'Falha na comunicação com o serviço de IA.',
          needsReview: true,
        })
      }
    }
  }

  return aggregatedSuggestions
}
