// Billing: assinatura do usuário (leitura + cancelamento via provedor)
import { supabase } from '@/lib/supabase/client'

export type SubscriptionStatus =
  | 'pending'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'

export interface MySubscription {
  id: string
  user_id: string
  family_id: string | null
  status: SubscriptionStatus
  plan: 'monthly' | 'yearly'
  provider: string
  preapproval_id: string | null
  current_period_end: string | null
  canceled_at: string | null
}

/** Status da assinatura do usuário logado (via RPC, nunca expõe de outros). */
export async function fetchMySubscription(): Promise<MySubscription | null> {
  const { data, error } = await (supabase as any).rpc('get_my_subscription')
  if (error) throw error
  return (data || null) as MySubscription | null
}

/**
 * Cancela a assinatura do usuário logado (17/10).
 * Caminho principal: edge cancel-asaas-subscription (verify_jwt) — cancela
 * no banco E remove a recorrência no Asaas (DELETE /v3/subscriptions/{id},
 * que também remove cobranças pendentes). Fallback: RPC cancel_my_subscription
 * (só banco) se a edge estiver indisponível.
 * O Premium continua válido até o fim do período já pago (current_period_end).
 */
export async function requestCancelSubscription(_subscriptionId?: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (token) {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-asaas-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: '{}',
        },
      )
      if (res.ok) return
      // 404 = sem assinatura ativa (nada a fazer); outros erros caem no fallback
      if (res.status !== 404) {
        console.warn('[subscription] edge de cancelamento falhou:', res.status)
      } else {
        return
      }
    } catch (err) {
      console.warn('[subscription] edge de cancelamento indisponível:', err)
    }
  }
  // Fallback: cancela só no banco (Premium vale até o fim do período pago)
  const { error } = await (supabase as any).rpc('cancel_my_subscription')
  if (error) throw error
}

/** URL de checkout de assinatura no Asaas (links de pagamento recorrentes, 17/10). */
export const CHECKOUT_URLS: Record<'monthly' | 'yearly', string> = {
  monthly: 'https://www.asaas.com/000/c/9t23dmfks249y6lv',
  yearly: 'https://www.asaas.com/000/c/9fczz56fzrpu11ro',
}

/** O usuário tem acesso premium neste momento? */
export function isSubscriptionActive(sub: MySubscription | null): boolean {
  if (!sub) return false
  if (sub.status === 'active' || sub.status === 'trial') {
    if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
      return false
    }
    return true
  }
  return false
}
