// Piu do Curiango via Supabase Realtime — o padrão dos apps web profissionais
// (Discord/Slack fazem assim): a página ESCUTA o INSERT na tabela transactions
// direto do banco e toca o piu na hora. Sem SW, sem handshake, sem timeout.
// Push (app fechado) = som do sistema via canal — padrão da plataforma.
import { supabase } from '@/lib/supabase/client'
import { initPiuUnlock, playPiu } from './piu-player'

let started = false

/** Inicia o listener de Realtime (chamar 1x no bootstrap do app). */
export function startRealtimePiu(): void {
  if (started) return
  started = true

  try {
    supabase
      .channel('curiangoo-transactions-piu')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => {
        // Qualquer transação nova da família (a RPC de segurança já limita o canal
        // às famílias do usuário logado) → piu na hora, se a sessão estiver destravada.
        playPiu()
      })
      .subscribe()
  } catch {
    /* Realtime indisponível — push cobre */
  }
}

// Re-exporta para o main.tsx continuar usando a mesma API
export { initPiuUnlock, playPiu }
