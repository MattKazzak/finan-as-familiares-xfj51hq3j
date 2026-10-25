import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { probeSession, signOutIfDead, verifyAndMaybeSignOut } from '@/lib/supabase/session-guard'

/**
 * WATCHDOG DE SESSÃO (22/10, endurecido 23/10).
 *
 * Cenário original: conta apagada no banco com o app aberto → o JWT continua
 * "válido" localmente por até ~1h e o usuário fica num app meio-morto. O
 * watchdog resolve isso deslogando.
 *
 * PROBLEMA RELATADO PELO MATHEUS (23/10): "está lento e desloga sozinho".
 * O watchdog da v0.0.536 era INTOLERANTE: uma única falha de auth (refresh
 * lento em rede móvel oscilando) derrubava a sessão = logout fantasma.
 *
 * REGRA NOVA (padrão-ouro de sessão revogável):
 * - Só age com veredito 'dead' (dupla confirmação — ver session-guard.ts).
 * - Rede instável/timeout = 'unknown' = não faz nada.
 * - TOKEN_REFRESH_FAILED não desloga mais na hora: vira um PROBE tolerante.
 *   Se a sessão está viva no servidor, segue o jogo (o supabase-js renova no
 *   próximo ciclo).
 * - Revalidação no primeiro plano tem guarda anti-repetição e só quando o app
 *   ficou um tempo em background (evita probe a cada troca de aba).
 * - Revalidação periódica: 5min → 10min (menos ruído, menos chance de pegar
 *   um blip; a conta apagada continua sendo pega no primeiro plano/refresh).
 */

const KEY = 'curiangoo_session_watchdog'
const BACKGROUND_MIN_MS = 60 * 1000 // só revalida se ficou ≥1min fora
const PERIODIC_MS = 10 * 60 * 1000

export function useSessionWatchdog() {
  const handlingRef = useRef(false)
  const hiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    let disposed = false

    const runProbe = async (reason: string) => {
      if (disposed || handlingRef.current) return
      handlingRef.current = true
      try {
        const verdict = await probeSession()
        if (verdict === 'dead') {
          const out = await signOutIfDead(reason)
          if (out) {
            try {
              localStorage.setItem(KEY, JSON.stringify({ reason, t: Date.now() }))
            } catch {
              /* storage restrito */
            }
          }
        }
        // 'alive' e 'unknown' NÃO fazem nada — sessão preservada
      } finally {
        handlingRef.current = false
      }
    }

    // ---- 1. Eventos de auth do Supabase ----
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Só TOKEN_REFRESH_FAILED (ou similar emitido pelo runtime) interessa:
      // o token pode ter morrido de verdade OU pode ser só rede.
      // Um probe tolerante decide (nunca desloga direto).
      if ((event as string) === 'TOKEN_REFRESH_FAILED') {
        void runProbe('token-refresh-failed')
      }
      // SIGNED_OUT aqui é consequência do nosso próprio signOut ou logout do
      // usuário — não há nada a fazer.
    })

    // ---- 2. Primeiro plano (visibilitychange) ----
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      // Voltou ao primeiro plano: só vale revalidar se ficou um tempo fora
      const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0
      hiddenAtRef.current = null
      if (hiddenFor < BACKGROUND_MIN_MS) return
      void runProbe('foreground-recheck')
    }
    document.addEventListener('visibilitychange', onVisibility)

    // ---- 3. Revalidação periódica (10min, só com app visível) ----
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void runProbe('periodic-recheck')
    }, PERIODIC_MS)

    // ---- 4. Blip de rede ao voltar online: cobre o caso "estava offline e o
    //         refresh falhou" sem punir o usuário. ----
    const onOnline = () => void verifyAndMaybeSignOut('back-online')

    window.addEventListener('online', onOnline)

    return () => {
      disposed = true
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.clearInterval(interval)
    }
  }, [])
}
