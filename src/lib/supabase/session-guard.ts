/**
 * SESSION GUARD — interceptor de fetch do Supabase.
 * Criado 22/10; ENDURECIDO 23/10 (Matheus: "está lento e desloga sozinho").
 *
 * PROBLEMA que o 22/10 introduziu: deslogava na PRIMEIRA falha de auth. Numa
 * rede móvel oscilando (refresh de token lento, 4G fraco), uma falha
 * transitória derrubava a sessão do usuário — logout fantasma.
 *
 * REGRA NOVA (padrão-ouro): só desloga quando há CERTEZA de que a conta
 * morreu. Para isso, toda verificação é um PROBE de duas etapas:
 *
 *   1ª tentativa → 'alive' | 'dead' | 'unknown'
 *   - 'dead'    = resposta explícita 401/403 ou sessão ausente no servidor
 *   - 'unknown' = erro de rede/timeout (AuthRetryableFetchError, fetch falhou)
 *                 → NUNCA desloga; rede instável não é conta apagada
 *
 *   Se a 1ª diz 'dead': espera 800ms e CONFIRMA. Só vira 'dead' definitivo se
 *   as duas disserem 'dead'. Um 401 isolado de corrida de refresh não derruba mais.
 *   Se a 1ª diz 'unknown': espera 1,2s (blip de rede) e tenta de novo uma vez.
 *
 * Quem consome: use-session-watchdog (primeiro plano/5min) e o interceptor de
 * 401 das queries (dedup de 10s).
 */

export type SessionVerdict = 'alive' | 'dead' | 'unknown'

const RETRY_UNKNOWN_MS = 1200
const CONFIRM_DEAD_MS = 800
const CHECK_WINDOW_MS = 10_000

let checking = false
let lastCheckAt = 0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Uma chamada crua ao servidor, classificada em alive/dead/unknown. */
async function rawProbe(): Promise<SessionVerdict> {
  try {
    // Import dinâmico evita ciclo de dependência client ↔ guard
    const { supabase } = await import('./client')
    const { data, error } = await supabase.auth.getUser()

    if (data?.user) return 'alive'
    if (!error) return 'dead' // sem usuário e sem erro: sessão não existe

    const anyErr = error as any
    const status = anyErr?.status ?? anyErr?.code
    const name = String(anyErr?.name || '')

    // Respostas explícitas de auth = conta/token realmente inválidos
    if (status === 401 || status === 403) return 'dead'
    if (name === 'AuthSessionMissingError') return 'dead'

    // Todo o resto (rede, timeout, 5xx, rate limit) = incerto, NÃO punir
    return 'unknown'
  } catch {
    // fetch rejeitou (offline/DNS/TLS) = rede, nunca deslogar
    return 'unknown'
  }
}

/**
 * Verificação tolerante a falhas. Só devolve 'dead' com dupla confirmação.
 */
export async function probeSession(): Promise<SessionVerdict> {
  const first = await rawProbe()

  if (first === 'alive') return 'alive'

  if (first === 'dead') {
    // Confirma antes de derrubar a sessão do usuário
    await sleep(CONFIRM_DEAD_MS)
    const confirm = await rawProbe()
    if (confirm === 'dead') return 'dead'
    if (confirm === 'alive') return 'alive'
    return 'unknown' // confirmou como incerto → não desloga
  }

  // 'unknown': dá uma segunda chance após um blip curto de rede
  await sleep(RETRY_UNKNOWN_MS)
  return rawProbe()
}

/** Desloga de fato — chamado só quando o verdict é 'dead'. */
export async function signOutIfDead(reason: string): Promise<boolean> {
  try {
    const { supabase } = await import('./client')
    const hadSession = Boolean((await supabase.auth.getSession()).data?.session)
    if (!hadSession) return false
    console.warn('[SessionGuard] sessão confirmada como inválida — deslogando:', reason)
    await supabase.auth.signOut()
    return true
  } catch {
    return false
  }
}

/** Verifica e, se a conta morreu de fato, desloga. Dedup para rajadas. */
export async function verifyAndMaybeSignOut(reason: string): Promise<void> {
  if (checking) return
  const now = Date.now()
  if (now - lastCheckAt < CHECK_WINDOW_MS) return // rajada de 401s = 1 verificação
  checking = true
  lastCheckAt = now
  try {
    const verdict = await probeSession()
    if (verdict === 'dead') await signOutIfDead(reason)
  } finally {
    checking = false
  }
}

/**
 * Wrapper de fetch p/ o createClient (option global.fetch).
 * Inspeciona respostas 401 do domínio Supabase — mas só AÇÃO após probe.
 */
export function createSessionGuardFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init)
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const isSupabase = url.includes('.supabase.co') || url.includes('/auth/v1')
      if (isSupabase && response.status === 401) {
        void verifyAndMaybeSignOut('http-401')
      }
    } catch {
      // inspeção falhou — resposta segue normal
    }
    return response
  }
}
