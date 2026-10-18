// Piu do Curiango via Supabase Realtime — padrão Discord/Slack:
// a página ESCUTA o INSERT na tabela transactions direto do banco e toca o piu na hora.
// Telemetria: status do canal vai pro console (diagnóstico em produção).
// Fallback: polling leve a cada 20s (pega INSERTs que o Realtime perder).
// v0.0.437: canais com nome ÚNICO por sessão (evita canal duplicado/abandonado no Realtime)
// + re-subscribe automático se o canal cair (CHANNEL_ERROR/TIMED_OUT → tenta de novo em 5s).
import { supabase } from '@/lib/supabase/client'
import { initPiuUnlock, playPiu } from './piu-player'

let started = false
let lastSeenTxAt: string | null = null
let realtimeOk = false // telemetria: último status do canal Realtime

/** Inicia o listener de Realtime + fallback de polling (chamar 1x no bootstrap). */
export function startRealtimePiu(): void {
  if (started) return
  started = true

  subscribeRealtime()

  // Fallback: polling leve (1 query índice-friendly a cada 20s, só com app visível)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !lastSeenTxAt) {
      void pollOnce()
    }
  })
  setInterval(() => {
    if (!document.hidden) void pollOnce()
  }, 20000)
}

function subscribeRealtime(): void {
  try {
    // Nome único por sessão: canal com nome fixo pode colidir com uma sessão antiga
    // do mesmo device (aba fantasma) e o Realtime não entrega pro novo subscriber.
    const channelName = `curiangoo-piu-${Date.now()}`
    supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => {
        playPiu()
      })
      .subscribe((status) => {
        realtimeOk = status === 'SUBSCRIBED'
        if (!realtimeOk) {
          console.warn('[RealtimePiu] canal:', status)
          // CHANNEL_ERROR / TIMED_OUT / CLOSED → tenta de novo em 5s (auto-recuperação)
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setTimeout(() => {
              try {
                supabase.removeChannel(supabase.channel(channelName))
              } catch {
                /* já removido */
              }
              subscribeRealtime()
            }, 5000)
          }
        }
      })
  } catch {
    /* Realtime indisponível — polling cobre */
  }
}

async function pollOnce(): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    // Última transação da família do usuário (via view RLS da própria tabela)
    const { data } = await supabase
      .from('transactions')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data?.created_at) return
    if (!lastSeenTxAt) {
      lastSeenTxAt = data.created_at // primeira leitura = baseline, não toca
      return
    }
    if (data.created_at > lastSeenTxAt) {
      lastSeenTxAt = data.created_at
      playPiu()
    }
  } catch {
    /* silencioso */
  }
}

// Re-exporta para o main.tsx continuar usando a mesma API
export { initPiuUnlock, playPiu }
