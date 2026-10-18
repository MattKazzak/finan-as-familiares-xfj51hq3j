import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Push notifications do Curiangoo — consome a fila push_queue.
// web-push v3.6.7: opções válidas = urgency (lowercase), TTL, headers, topic.
// Android/FCM: urgency high = entrega heads-up com som. iOS/APNs: headers apns-*.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')

const vapidOk = !!VAPID_PUBLIC && !!VAPID_PRIVATE
if (vapidOk) {
  webpush.setVapidDetails('mailto:contato@curiangoo.com', VAPID_PUBLIC!, VAPID_PRIVATE!)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function optionsFor(endpoint: string): Record<string, unknown> {
  if (endpoint.includes('push.apple.com')) {
    return {
      urgency: 'high',
      TTL: 3600,
      headers: { 'apns-push-type': 'alert', 'apns-priority': '10' },
    }
  }
  return { urgency: 'high', TTL: 3600 }
}

let processing = false

async function processQueue(): Promise<{
  processed: number
  sent: number
  failed: number
  erros: string[]
  erro?: string
}> {
  if (!vapidOk)
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      erros: [],
      erro: 'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes — configure nos secrets da edge',
    }
  if (processing) return { processed: 0, sent: 0, failed: 0, erros: [] }
  processing = true
  let sent = 0
  const erros: string[] = []
  try {
    const { data: items, error } = await admin
      .from('push_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20)
    if (error || !items?.length) return { processed: 0, sent: 0, failed: 0, erros }

    for (const item of items) {
      const { data: targets, error: targetsErr } = await admin.rpc('get_family_push_targets', {
        p_family_id: item.family_id,
        p_author_user_id: item.author_user_id,
      })
      if (targetsErr) {
        console.error('targets error', targetsErr)
        await admin
          .from('push_queue')
          .update({ status: 'failed', attempts: item.attempts + 1 })
          .eq('id', item.id)
        continue
      }

      const tipo = item.tx_type === 'income' ? 'Receita' : 'Despesa'
      const valor = `R$ ${(Math.abs(item.amount_cents ?? 0) / 100).toFixed(2).replace('.', ',')}`
      const nome = item.author_member_name || 'Alguém da família'
      const desc = item.description || (tipo === 'Receita' ? 'receita' : 'despesa')
      const title = `${nome} lançou ${tipo === 'Receita' ? 'uma receita' : 'um gasto'}`
      const body = `${desc} — ${valor}`

      for (const t of targets ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
            JSON.stringify({
              title,
              body,
              tag: `curiangoo-tx-${item.transaction_id}`,
              data: { url: '/inicio', transactionId: item.transaction_id },
            }),
            optionsFor(t.endpoint),
          )
          sent++
        } catch (err: any) {
          const statusCode = err?.statusCode
          const detail = err?.body || err?.message || 'unknown'
          console.error('push send error', statusCode, detail)
          erros.push(`${statusCode ?? '?'}: ${String(detail).slice(0, 200)}`)
          if (statusCode === 410 || statusCode === 404) {
            await admin.from('push_subscriptions').delete().eq('endpoint', t.endpoint)
          }
        }
      }

      await admin
        .from('push_queue')
        .update({
          status: 'sent',
          attempts: item.attempts + 1,
          processed_at: new Date().toISOString(),
        })
        .eq('id', item.id)
    }
    return { processed: items.length, sent, failed: erros.length, erros }
  } catch (e) {
    console.error('processQueue error', e)
    return {
      processed: 0,
      sent,
      failed: erros.length,
      erros,
      erro: e instanceof Error ? e.message : 'unknown',
    }
  } finally {
    processing = false
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (url.pathname.endsWith('/process')) {
    const result = await processQueue()
    return new Response(JSON.stringify({ ok: !result.erro && result.failed === 0, ...result }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new Response(
    JSON.stringify({ ok: vapidOk, vapidConfigured: vapidOk, hint: 'POST /process' }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
