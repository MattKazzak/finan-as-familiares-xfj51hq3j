import { supabase } from '@/lib/supabase/client'

export interface CopilotMessageRecord {
  id: string
  family_id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  card_type: string | null
  created_at: string
}

export interface SaveCopilotMessageInput {
  familyId: string
  role: 'user' | 'assistant'
  content: string
  cardType?: string | null
}

/**
 * Busca as últimas mensagens da família para o Copilot (ordem cronológica para renderização no chat)
 */
export interface FetchCopilotMessagesOptions {
  limitCount?: number
  beforeCreatedAt?: string | null
}

export interface FetchCopilotMessagesResult {
  messages: CopilotMessageRecord[]
  hasMore: boolean
}

/**
 * Busca lote de mensagens da família para o Copilot (ordem cronológica crescente).
 * Suporta paginação incremental por cursor de data (`beforeCreatedAt`).
 */
export async function fetchCopilotMessages(
  familyId: string,
  limitCountOrOptions: number | FetchCopilotMessagesOptions = 25,
): Promise<CopilotMessageRecord[]> {
  const options: FetchCopilotMessagesOptions =
    typeof limitCountOrOptions === 'number'
      ? { limitCount: limitCountOrOptions }
      : limitCountOrOptions

  const limitCount = options.limitCount ?? 25
  const beforeCreatedAt = options.beforeCreatedAt

  if (!familyId) return []

  try {
    let query = supabase
      .from('copilot_messages')
      .select('id, family_id, user_id, role, content, card_type, created_at')
      .eq('family_id', familyId)

    if (beforeCreatedAt) {
      query = query.lt('created_at', beforeCreatedAt)
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(limitCount)

    if (error) {
      console.warn('[copilot-service] Falha silenciosa ao buscar histórico:', error.message)
      return []
    }

    if (!data) return []

    // Reverte para ordem cronológica crescente (mais antigas primeiro, mais recentes no fim)
    return (data as CopilotMessageRecord[]).reverse()
  } catch (err: any) {
    console.warn('[copilot-service] Erro inesperado ao buscar histórico:', err?.message)
    return []
  }
}

/**
 * Busca lote de mensagens com indicação precisa de hasMore (se existem mensagens mais antigas).
 */
export async function fetchCopilotMessagesWithHasMore(
  familyId: string,
  options: FetchCopilotMessagesOptions = {},
): Promise<FetchCopilotMessagesResult> {
  const limitCount = options.limitCount ?? 25
  const beforeCreatedAt = options.beforeCreatedAt

  if (!familyId) return { messages: [], hasMore: false }

  try {
    let query = supabase
      .from('copilot_messages')
      .select('id, family_id, user_id, role, content, card_type, created_at')
      .eq('family_id', familyId)

    if (beforeCreatedAt) {
      query = query.lt('created_at', beforeCreatedAt)
    }

    // Pede limitCount + 1 para saber com certeza se há próxima página
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limitCount + 1)

    if (error) {
      console.warn(
        '[copilot-service] Falha silenciosa ao buscar histórico paginado:',
        error.message,
      )
      return { messages: [], hasMore: false }
    }

    if (!data || data.length === 0) return { messages: [], hasMore: false }

    const hasMore = data.length > limitCount
    const items = hasMore ? data.slice(0, limitCount) : data

    return {
      messages: (items as CopilotMessageRecord[]).reverse(),
      hasMore,
    }
  } catch (err: any) {
    console.warn('[copilot-service] Erro inesperado ao buscar histórico paginado:', err?.message)
    return { messages: [], hasMore: false }
  }
}

/**
 * Persiste uma mensagem no histórico do Copilot em background.
 * Falha de persistência NUNCA bloqueia a resposta na tela nem joga erro não tratado.
 */
export async function saveCopilotMessage(
  input: SaveCopilotMessageInput,
): Promise<CopilotMessageRecord | null> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user?.id) {
      console.warn('[copilot-service] Usuário não autenticado para persistir mensagem.')
      return null
    }

    const { data, error } = await supabase
      .from('copilot_messages')
      .insert({
        family_id: input.familyId,
        user_id: user.id,
        role: input.role,
        content: input.content,
        card_type: input.cardType || null,
      })
      .select('id, family_id, user_id, role, content, card_type, created_at')
      .single()

    if (error) {
      console.warn('[copilot-service] Falha silenciosa ao salvar mensagem:', error.message)
      return null
    }

    return (data as CopilotMessageRecord) || null
  } catch (err: any) {
    console.warn('[copilot-service] Exceção silenciosa ao persistir mensagem:', err?.message)
    return null
  }
}
