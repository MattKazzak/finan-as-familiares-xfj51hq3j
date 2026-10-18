// Piu do Curiango via Supabase Realtime — padrão Discord/Slack:
// a página ESCUTA o INSERT na tabela transactions direto do banco e toca o piu na hora.
// Telemetria: status do canal vai pro console (diagnóstico em produção).
// Fallback: polling leve a cada 20s (pega INSERTs que o Realtime perder).
import { supabase } from '@/lib/supabase/client'
import { initPiuUnlock, playPiu } from './piu-player'

let started = false
let lastSeenTxAt: string | null = null

/** Inicia o listener de Realtime + fallback de polling (chamar 1x no bootstrap). */
export function startRealtimePiu(): void {
  if (started) return
  started = true

  try {
    supabase
      .channel('curiangoo-transactions-piu')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => {
        playPiu()
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.warn('[RealtimePiu] canal:', status)
        }
      })
  } catch {
    /* Realtime indisponível — polling cobre */
  }

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
