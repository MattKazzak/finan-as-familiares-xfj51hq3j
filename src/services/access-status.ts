// Acesso ao Curiangoo (modelo C2, 17/10): trial 7 dias por família → gratuito essencial.
// A RPC get_my_access_status decide tudo no servidor (nunca confia no cliente):
//   premium = assinatura ativa; trial = família criada < 7 dias; free = expirou.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useFamily } from '@/hooks/use-family'

export type AccessStatus = 'premium' | 'trial' | 'free'

export interface AccessStatusInfo {
  status: AccessStatus
  /** Dias restantes de trial (0 quando não é trial) */
  days_left: number
  /** Fim do trial, quando aplicável */
  trial_end: string | null
  /** Plano da assinatura ativa */
  plan: 'monthly' | 'yearly' | null
  period_end: string | null
}

export async function fetchMyAccessStatus(): Promise<AccessStatusInfo> {
  const { data, error } = await (supabase as any).rpc('get_my_access_status')
  if (error) throw error
  return {
    status: (data?.status || 'free') as AccessStatus,
    days_left: Number(data?.days_left || 0),
    trial_end: data?.trial_end || null,
    plan: data?.plan || null,
    period_end: data?.period_end || null,
  }
}

/**
 * Hook de acesso: premium/trial = tudo liberado; free = paywall nas features Premium.
 * Recarrega quando a família muda e quando o refreshTrigger muda (pós-pagamento).
 */
export function useAccessStatus() {
  const { family, refreshTrigger } = useFamily()
  const [access, setAccess] = useState<AccessStatusInfo>({
    status: 'free',
    days_left: 0,
    trial_end: null,
    plan: null,
    period_end: null,
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!family?.id) {
      setLoading(false)
      return
    }
    try {
      setAccess(await fetchMyAccessStatus())
    } catch (err) {
      console.warn('Erro ao carregar status de acesso:', err)
    } finally {
      setLoading(false)
    }
  }, [family?.id])

  useEffect(() => {
    load()
  }, [load, refreshTrigger])

  const isPremium = access.status === 'premium' || access.status === 'trial'
  return { access, loading, isPremium, refresh: load }
}
