/**
 * SESSION GUARD — interceptor de fetch do Supabase (22/10, padrão-ouro).
 *
 * Problema: JWT do Supabase não é revogável. Se a conta é apagada no banco
 * com o app aberto, o token continua "válido" criptograficamente por até
 * ~1h — o usuário fica num app meio-morto (queries vazias, telas quebradas)
 * até o refresh do token falhar.
 *
 * Solução-ouro: interceptar TODAS as respostas do Supabase. Qualquer 401
 * (que com RLS também aparece como dados vazios, mas o 401 explícito é o
 * sinal de token morto) dispara UMA validação contra o servidor:
 *   - conta viva → segue o jogo (401 pontual de outra causa, ex: policy)
 *   - conta morta → signOut imediato → use-auth limpa → guarda joga pro login
 *
 * Deduplicação: uma única verificação por janela de 10s (rajada de 401s de
 * várias queries em paralelo = 1 checagem, não N).
 * Rede offline: fetch falha → nada a fazer (não desloga offline).
 */

const CHECK_WINDOW_MS = 10_000
let lastCheckAt = 0
let checking = false

async function revalidateSession() {
  if (checking) return
  const now = Date.now()
  if (now - lastCheckAt < CHECK_WINDOW_MS) return // dedup de rajada
  checking = true
  lastCheckAt = now
  try {
    // Import dinâmico evita ciclo de dependência client ↔ guard
    const { supabase } = await import('./client')
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) {
      // Conta não existe mais (ou token órfão): logout limpo e imediato.
      console.warn('[SessionGuard] conta não existe mais — deslogando')
      await supabase.auth.signOut()
    }
  } catch {
    // Rede falhou na revalidação: não desloga (usuário offline)
  } finally {
    checking = false
  }
}

/**
 * Wrapper de fetch p/ o createClient (option global.fetch).
 * Só inspeciona respostas do próprio domínio Supabase com status 401.
 */
export function createSessionGuardFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init)
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const isSupabase = url.includes('.supabase.co') || url.includes('/auth/v1')
      if (isSupabase && response.status === 401) {
        void revalidateSession()
      }
    } catch {
      // inspeção falhou — resposta segue normal
    }
    return response
  }
}
