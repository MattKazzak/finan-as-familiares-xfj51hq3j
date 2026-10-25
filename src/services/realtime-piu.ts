// Piu do Curiango via Supabase Realtime — padrão Discord/Slack:
// a página ESCUTA o INSERT na tabela transactions direto do banco e toca o piu na hora.
// v0.0.516 — FIX DEFINITIVO "piu no próprio lançamento" (relato do Matheus 21/10 21:45):
// O guard por member_id (v0.0.507) tinha uma JANELA DE CORRIDA fail-open: o
// myMemberIdRef era populado async (getUser + select family_members = 200-800ms de
// rede). Se um INSERT chegasse antes do ref resolver (app recém-aberto), o guard
// via null e TOCAVA o piu pro próprio lançamento. Como os grandes resolvem
// (Discord/Slack): a decisão é DETERMINÍSTICA e FAIL-CLOSED —
//   1. O member_id é resolvido ANTES do subscribe (await no bootstrap);
//   2. Se o member não estiver resolvido, o piu NÃO toca (falso-negativo — não
//      ouvir 1 piu da Karine na 1ª abertura — é infinitamente melhor que o
//      falso-positivo de tocar pro próprio lançamento);
//   3. Telemetria: cada decisão registra o motivo no console (diagnóstico em produção).
import { supabase } from '@/lib/supabase/client'
import { initPiuUnlock, playPiu } from './piu-player'

let started = false
let lastSeenTxAt: string | null = null
let realtimeOk = false // telemetria: último status do canal Realtime
// member_id do usuário logado — resolvido ANTES de qualquer som (fail-closed).
let myMemberId: string | null = null
let memberResolved = false

/** Resolve o member_id do usuário logado (1x, await — chamado no bootstrap). */
async function resolveMyMemberId(): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) {
      console.info('[RealtimePiu] sem usuário logado — piu desativado nesta sessão')
      return
    }
    const { data: mem } = await supabase
      .from('family_members')
      .select('id')
      .eq('user_id', uid)
      .limit(1)
      .maybeSingle()
    myMemberId = mem?.id ?? null
    memberResolved = true
    console.info('[RealtimePiu] member resolvido:', myMemberId ? 'ok' : 'sem membro')
  } catch {
    // Falha de rede: fica fail-closed (memberResolved=false → nunca toca).
    // A próxima abertura do app tenta de novo — não punir o usuário por rede ruim.
    console.info('[RealtimePiu] falha ao resolver member — piu fail-closed')
  }
}

/** Inicia o listener de Realtime + fallback de polling (chamar 1x no bootstrap). */
export function startRealtimePiu(): void {
  if (started) return
  started = true
  // FIX fail-closed: resolve o member ANTES de subscrever o canal.
  void resolveMyMemberId().then(() => subscribeRealtime())
  // SELF-HEAL (v0.0.517, provado E2E): login via SPA (sem reload) → re-resolve.
  // Sem isso, o piu ficaria desativado a sessão inteira após o login.
  supabase.auth.onAuthStateChange((event) => {
    // INITIAL_SESSION = sessão restaurada do localStorage no load da página
    // (o bootstrap roda ANTES da sessão restaurar — provado E2E 22/10);
    // SIGNED_IN = login via SPA. Ambos (re)resolvem o member (idempotente).
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') void resolveMyMemberId()
  })

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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload) => {
          // O piu é o som de "alguém da família mexeu nas finanças" — quem LANÇOU
          // não precisa ser avisado do próprio lançamento (o app já confirma na tela).
          const newTx = payload.new as { member_id?: string | null } | null
          // FAIL-CLOSED (v0.0.516): sem member resolvido, NUNCA toca — não arrisca
          // tocar pro próprio lançamento (a janela de corrida do bug de 21/10).
          if (!memberResolved) {
            console.info('[RealtimePiu] INSERT ignorado: member ainda não resolvido')
            return
          }
          if (newTx?.member_id && myMemberId && newTx.member_id === myMemberId) {
            console.info('[RealtimePiu] INSERT ignorado: lançamento próprio')
            return
          }
          console.info('[RealtimePiu] INSERT de outro membro — piu!')
          playPiu()
        },
      )
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
    // FAIL-CLOSED: mesmo no polling, só decide com o member resolvido.
    if (!memberResolved) {
      await resolveMyMemberId()
      if (!memberResolved) return
    }
    // Última transação da família do usuário (via view RLS da própria tabela)
    const { data } = await supabase
      .from('transactions')
      .select('created_at, member_id')
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
      if (data.member_id && myMemberId && data.member_id === myMemberId) return
      playPiu()
    }
  } catch {
    /* silencioso */
  }
}

// Re-exporta para o main.tsx continuar usando a mesma API
export { initPiuUnlock, playPiu }
