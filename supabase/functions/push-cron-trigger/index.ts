import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Dispara o processamento da fila de push (chamado pelo pg_cron a cada minuto)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, hint: 'POST apenas' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/push-dispatcher/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
  })
  const body = await res.text()
  return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/json' } })
})
