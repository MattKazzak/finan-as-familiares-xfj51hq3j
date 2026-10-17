// Web Push do Curiangoo — inscrição do dispositivo + preferências.
// Android/Chrome: suporte completo. iOS: exige PWA instalado (iOS 16.4+).
import { supabase } from '@/lib/supabase/client'

const VAPID_PUBLIC_KEY =
  'BOmEldadClDXiepY7tFxyLEX8YUlVIpl284WZ9gkXzQ96YJ6KvDTGQ40FXQHON9nkBIgfWu_35ZSipSU4WT69bQ'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isStandalonePwa(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true)
  )
}

export async function getNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/** Pede permissão e inscreve o dispositivo no push do Curiangoo. */
export async function subscribeToPush(): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, reason: 'denied' }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
    }

    const raw = sub.toJSON()
    if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
      return { ok: false, reason: 'invalid-subscription' }
    }

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return { ok: false, reason: 'no-user' }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: raw.endpoint,
        p256dh: raw.keys.p256dh,
        auth: raw.keys.auth,
        user_agent: navigator.userAgent.slice(0, 250),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
    if (error) return { ok: false, reason: error.message }

    await supabase
      .from('push_preferences')
      .upsert({ user_id: userId, push_enabled: true }, { onConflict: 'user_id' })

    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'unknown' }
  }
}

/** Desativa o push (remove do servidor; a subscription local é mantida p/ reativar). */
export async function disablePush(): Promise<{ ok: boolean }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (userId) {
      await supabase
        .from('push_preferences')
        .upsert({ user_id: userId, push_enabled: false }, { onConflict: 'user_id' })
    }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function getPushPreferences(): Promise<{
  pushEnabled: boolean
  notifyFamilyTransactions: boolean
} | null> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return null
    const { data } = await supabase
      .from('push_preferences')
      .select('push_enabled, notify_family_transactions')
      .eq('user_id', userId)
      .maybeSingle()
    return data
      ? {
          pushEnabled: data.push_enabled,
          notifyFamilyTransactions: data.notify_family_transactions,
        }
      : { pushEnabled: false, notifyFamilyTransactions: true }
  } catch {
    return null
  }
}
