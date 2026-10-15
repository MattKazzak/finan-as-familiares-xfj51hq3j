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
 * Pede o cancelamento da assinatura.
 * O app grava o pedido; a edge function admin-cancel-subscription
 * chama a API do Mercado Pago e o webhook confirma o status final.
 */
export async function requestCancelSubscription(subscriptionId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('subscriptions')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', subscriptionId)
  if (error) throw error
}

/** URL de checkout de assinatura no Mercado Pago (links de plano de assinatura). */
export const CHECKOUT_URLS: Record<'monthly' | 'yearly', string> = {
  monthly: 'https://mpago.la/1D8u6Vq',
  yearly: 'https://mpago.la/1nwoqUR',
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
