import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================
// webhook-mercadopago — recebe eventos de ASSINATURA (preapproval)
// do Mercado Pago e atualiza public.subscriptions no app.
// Segurança: assinatura HMAC SHA-256 no header x-signature.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ?? ''
const MP_WEBHOOK_SECRET = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET') ?? ''

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Valida a assinatura do webhook conforme docs do Mercado Pago:
// manifest = id:{data.id};request-id:{x-request-id};ts:{t};  |  HMAC key = secret
async function verifySignature(req: Request): Promise<boolean> {
  if (!MP_WEBHOOK_SECRET) {
    console.error('[webhook-mp] MERCADOPAGO_WEBHOOK_SECRET não configurado')
    return false
  }
  const sigHeader = req.headers.get('x-signature') ?? ''
  const parts: Record<string, string> = {}
  for (const p of sigHeader.split(',')) {
    const [k, v] = p.split('=').map((s) => s.trim())
    if (k && v) parts[k] = v
  }
  const ts = parts['t']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  const url = new URL(req.url)
  const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? ''
  const requestId = req.headers.get('x-request-id') ?? ''
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(MP_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  return hex(sig) === v1.toLowerCase()
}

async function syncPreapproval(preapprovalId: string): Promise<void> {
  if (!MP_ACCESS_TOKEN) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')

  const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  })
  if (!res.ok) {
    throw new Error(`MP API ${res.status}: ${await res.text()}`)
  }
  const pre = await res.json()

  const email: string | null = pre.payer_email ?? pre.payer?.email ?? null
  if (!email) throw new Error('preapproval sem payer_email')

  const status: string = pre.status ?? 'pending' // authorized | paused | cancelled
  const plan = pre.auto_recurring?.frequency_type === 'years' ? 'yearly' : 'monthly'
  const externalReference: string | null = pre.external_reference ?? null
  const payerId = pre.payer_id != null ? String(pre.payer_id) : null

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { error } = await admin.rpc('upsert_subscription_from_webhook', {
    p_email: email,
    p_preapproval_id: preapprovalId,
    p_status: status,
    p_plan: plan,
    p_external_reference: externalReference,
    p_payer_id: payerId,
  })
  if (error) throw error

  console.log(`[webhook-mp] preapproval ${preapprovalId} sincronizado (${status}, ${plan})`)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.text()

  // 1. Autenticidade: só o Mercado Pago fala com esta URL
  const sigOk = await verifySignature(req)
  if (!sigOk) {
    console.warn('[webhook-mp] assinatura inválida rejeitada')
    return new Response(JSON.stringify({ error: 'invalid_signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2. Parse do evento
  let evt: { type?: string; action?: string; data?: { id?: string } }
  try {
    evt = JSON.parse(body)
  } catch {
    return new Response(JSON.stringify({ error: 'bad_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    if (evt.type === 'preapproval' && evt.data?.id) {
      await syncPreapproval(evt.data.id)
    } else {
      console.log(`[webhook-mp] evento ignorado: type=${evt.type} action=${evt.action}`)
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[webhook-mp] erro ao sincronizar:', e)
    return new Response(JSON.stringify({ error: 'sync_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
