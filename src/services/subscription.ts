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
 * Usa a RPC cancel_my_subscription (security definer) — o UPDATE direto pelo
 * cliente SEMPRE falhava: RLS da subscriptions só permite SELECT (subs_select_own).
 * O Premium continua válido até o fim do período já pago (current_period_end).
 * PENDENTE: cancelar também no Asaas (edge c/ ASAAS_API_KEY) — hoje o link
 * recorrente do Asaas continuaria cobrando no próximo ciclo.
 */
export async function requestCancelSubscription(_subscriptionId?: string): Promise<void> {
  const { data, error } = await (supabase as any).rpc('cancel_my_subscription')
  if (error) throw error
  return data
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
