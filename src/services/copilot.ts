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
export async function fetchCopilotMessages(
  familyId: string,
  limitCount = 20,
): Promise<CopilotMessageRecord[]> {
  if (!familyId) return []

  try {
    const { data, error } = await supabase
      .from('copilot_messages')
      .select('id, family_id, user_id, role, content, card_type, created_at')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(limitCount)

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
