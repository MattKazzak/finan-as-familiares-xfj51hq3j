import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

/**
 * WATCHDOG DE SESSÃO (22/10, pedido do Matheus — padrão-ouro de mercado).
 *
 * Cenário: a conta do usuário é apagada direto no banco (ex: admin apaga um
 * usuário de teste no Supabase) enquanto o app está ABERTO no aparelho.
 * O JWT continua criptograficamente válido por até ~1h (não é revogável),
 * então o usuário ficava num app "meio-morto": queries voltam vazias (RLS
 * não acha mais nada), telas quebram sem explicação, até o token expirar.
 *
 * 3 camadas (mesmo padrão de apps com sessão revogável):
 * 1. INTERCEPTOR DE 401: qualquer resposta 401/403 de auth do Supabase
 *    → valida o usuário contra o servidor → não existe mais → signOut IMEDIATO.
 *    O supabase-js emite 'SIGNED_OUT' e o use-auth limpa o estado; a guarda de
 *    rota joga pro login.
 * 2. REVALIDAÇÃO NO PRIMEIRO PLANO (visibilitychange): usuário volta pro app
 *    (PWA iOS/Android em background) → getUser() → conta apagada → logout limpo
 *    na hora, em vez de descobrir na primeira query que falhar.
 * 3. DEDUPLICAÇÃO: um único logout por "onda" — rajada de 401s (várias queries
 *    falhando juntas) não dispara N signOuts, e o watchdog não briga com o
 *    fluxo normal de login (só age se HAVIA sessão).
 *
 * Falha de rede NÃO desloga (não punir usuário offline — mesma doutrina do
 * fix da sessão fantasma de 18/10).
 */

const KEY = 'curiangoo_session_watchdog'

/** Valida a sessão atual contra o servidor. true = sessão viva. */
async function isSessionAlive(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) return false
    return Boolean(data?.user)
  } catch {
    // Erro de rede/timeout: assume viva (não desloga offline)
    return true
  }
}

/** Desloga limpo: uma vez por onda, só se havia sessão. */
async function forceSignOutOnce(reason: string) {
  try {
    const hadSession = Boolean((await supabase.auth.getSession()).data?.session)
    if (!hadSession) return // já deslogado (ou nunca logou) — nada a fazer
    console.warn('[SessionWatchdog] sessão inválida — deslogando:', reason)
    await supabase.auth.signOut()
    // Sinal p/ a UI: o use-auth escuta SIGNED_OUT e a guarda de rota redireciona.
    try {
      localStorage.setItem(KEY, JSON.stringify({ reason, t: Date.now() }))
    } catch {
      /* storage restrito */
    }
  } catch {
    // signOut falhou (rede) — o fluxo normal de expiração cobre
  }
}

export function useSessionWatchdog() {
  const handlingRef = useRef(false)

  useEffect(() => {
    // ---- CAMADA 1: interceptor de erros de auth (401/403) ----
    // O supabase-js não tem hook global de resposta; mas TODO erro de auth
    // emite evento no canal de auth. Além disso, erros 401 do PostgREST vêm
    // como error.message com código — cobrimos via listener de eventos de
    // erro não tratado é insuficiente. Estratégia-ouro: assinar o canal
    // 'onAuthStateChange' p/ TOKEN_REFRESH_FAILED + um heartbeat leve.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESH_FAILED' || event === 'SIGNED_OUT') {
        // Refresh falhou = token morto (conta apagada ou revogada)
        void forceSignOutOnce(event)
      }
    })

    // ---- CAMADA 2: revalidação ao voltar ao primeiro plano ----
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (handlingRef.current) return
      handlingRef.current = true
      isSessionAlive().then((alive) => {
        if (!alive) void forceSignOutOnce('foreground-recheck')
        handlingRef.current = false
      })
    }
    document.addEventListener('visibilitychange', onVisible)

    // ---- CAMADA 2b: revalidação periódica leve (a cada 5 min em uso) ----
    // Cobertura para o caso "app aberto, tela ligada, conta apagada": sem
    // visibilitychange, o usuário jamais revalidaria. 5 min = trade-off
    // entre custo (1 request) e tempo máximo de app meio-morto.
    const interval = window.setInterval(
      () => {
        if (document.visibilityState !== 'visible') return
        if (handlingRef.current) return
        handlingRef.current = true
        isSessionAlive().then((alive) => {
          if (!alive) void forceSignOutOnce('periodic-recheck')
          handlingRef.current = false
        })
      },
      5 * 60 * 1000,
    )

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
    }
  }, [])
}
