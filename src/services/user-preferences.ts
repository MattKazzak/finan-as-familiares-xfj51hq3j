import { supabase } from '@/lib/supabase/client'

export const AI_CONSENT_KEY = 'curiangoo_ai_consent'

export interface AiConsentLocalStorage {
  consented: boolean
  consentedAt: string
}

export interface UserPreferencesRecord {
  user_id: string
  ai_consent: boolean
  ai_consent_at: string | null
  updated_at: string
}

/**
 * Lê o consentimento LGPD de IA do localStorage (chave histórica)
 */
export function getLocalAiConsent(): boolean {
  try {
    const raw = localStorage.getItem(AI_CONSENT_KEY)
    if (!raw) return false
    const parsed: AiConsentLocalStorage = JSON.parse(raw)
    return Boolean(parsed && parsed.consented === true)
  } catch {
    return false
  }
}

/**
 * Grava o consentimento LGPD de IA no localStorage
 */
export function setLocalAiConsent(consented: boolean): void {
  try {
    const data: AiConsentLocalStorage = {
      consented,
      consentedAt: new Date().toISOString(),
    }
    localStorage.setItem(AI_CONSENT_KEY, JSON.stringify(data))
  } catch {
    // ignorar indisponibilidade de localStorage
  }
}

/**
 * Lê preferências do usuário no banco com fallback transparente para localStorage.
 * Se houver consentimento no localStorage e não houver no banco, sincroniza para o banco.
 */
export async function fetchUserPreferencesWithFallback(
  userId?: string,
): Promise<{ aiConsent: boolean; aiConsentAt: string | null }> {
  const localConsented = getLocalAiConsent()

  try {
    let targetUserId = userId
    if (!targetUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      targetUserId = user?.id
    }

    if (!targetUserId) {
      return { aiConsent: localConsented, aiConsentAt: null }
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('user_id, ai_consent, ai_consent_at, updated_at')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (error) {
      console.warn(
        '[user-preferences] Erro ao buscar preferências do banco, usando fallback local:',
        error.message,
      )
      return { aiConsent: localConsented, aiConsentAt: null }
    }

    if (data) {
      const dbConsented = Boolean(data.ai_consent)
      // Mantém localStorage alinhado
      if (dbConsented !== localConsented) {
        setLocalAiConsent(dbConsented)
      }
      return {
        aiConsent: dbConsented,
        aiConsentAt: data.ai_consent_at,
      }
    }

    // Não existe registro no banco ainda: se houver no localStorage, sincroniza em background
    if (localConsented) {
      const nowIso = new Date().toISOString()
      supabase
        .from('user_preferences')
        .insert({
          user_id: targetUserId,
          ai_consent: true,
          ai_consent_at: nowIso,
          updated_at: nowIso,
        })
        .then(({ error: insertErr }) => {
          if (insertErr) {
            console.warn(
              '[user-preferences] Sincronização inicial de consentimento no banco falhou:',
              insertErr.message,
            )
          }
        })
        .catch(() => {})
    }

    return { aiConsent: localConsented, aiConsentAt: null }
  } catch (err: any) {
    console.warn('[user-preferences] Exceção ao ler preferências com fallback:', err?.message)
    return { aiConsent: localConsented, aiConsentAt: null }
  }
}

/**
 * Salva preferência de consentimento LGPD de IA no banco e no localStorage
 */
export async function saveUserAiConsent(consented: boolean): Promise<boolean> {
  // Atualiza local primeiro para resposta instantânea
  setLocalAiConsent(consented)

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return true
    }

    const nowIso = new Date().toISOString()
    const { error } = await supabase.from('user_preferences').upsert({
      user_id: user.id,
      ai_consent: consented,
      ai_consent_at: consented ? nowIso : null,
      updated_at: nowIso,
    })

    if (error) {
      console.warn('[user-preferences] Falha ao persistir consentimento no banco:', error.message)
      return false
    }

    return true
  } catch (err: any) {
    console.warn('[user-preferences] Exceção ao persistir consentimento no banco:', err?.message)
    return false
  }
}
