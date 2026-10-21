// AUDITORIA DIÁRIA DAS CONVERSAS REAIS DO COPILOT (21/10, pedido do Matheus)
// ==========================================================================
// Chamada 1x/dia (07:30) pelo cron do agente. Lê as mensagens de ONTEM em
// copilot_messages, classifica cada troca com gpt-4o-mini e grava o relatório
// em copilot_audit_reports. O agente lê o relatório, corrige causas e alimenta
// o golden set com frases reais problemáticas.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // SERVICE ROLE: lê qualquer família (RLS bloqueia anon/auth — correto).
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!serviceKey || !openaiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'CONFIG_ERROR' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Janela: ontem no fuso de Brasília (America/Sao_Paulo = UTC-3, sem DST)
  const now = new Date()
  const yesterdayUTC = new Date(now.getTime() - 3 * 3600 * 1000 - 24 * 3600 * 1000)
  const yStr = yesterdayUTC.toISOString().slice(0, 10)
  const startUTC = new Date(`${yStr}T00:00:00-03:00`).toISOString()
  const endUTC = new Date(`${yStr}T23:59:59-03:00`).toISOString()

  const { data: msgs, error: readErr } = await supabase
    .from('copilot_messages')
    .select('id, family_id, role, content, created_at')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (readErr) {
    return new Response(JSON.stringify({ ok: false, error: 'DB_READ', detail: readErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!msgs || msgs.length === 0) {
    const empty = {
      ok: true,
      audit_date: yStr,
      total_messages: 0,
      total_exchanges: 0,
      problems: [],
      note: 'Nada a auditar.',
    }
    await supabase.from('copilot_audit_reports').upsert(
      {
        audit_date: yStr,
        total_messages: 0,
        total_exchanges: 0,
        total_problems: 0,
        report: empty,
      },
      { onConflict: 'audit_date' },
    )
    return new Response(JSON.stringify(empty), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Agrupa em trocas (user + assistant)
  const exchanges: Array<{ user: string; assistant: string | null; family_id: string }> = []
  let cur: { user: string; assistant: string | null; family_id: string } | null = null
  for (const m of msgs) {
    if (m.role === 'user') {
      if (cur) exchanges.push(cur)
      cur = { user: m.content ?? '', assistant: null, family_id: m.family_id }
    } else if (m.role === 'assistant' && cur) {
      cur.assistant = m.content ?? ''
    }
  }
  if (cur) exchanges.push(cur)

  // Classificação IA (temperature 0, seed fixo)
  const CLASSIFIER = `Você audita conversas de um copiloto financeiro (app Curiangoo, famílias brasileiras, método dos 3 Baldes). Para CADA troca (mensagem do usuário + resposta do assistente), classifique:
- "tipo": lancamento | consulta | social | correcao | outro
- "ok": true se a resposta do assistente foi adequada (lançou certo, respondeu certo, perguntou o que devia)
- "problema": null se ok; senão UMA frase curta com o problema (ex.: "usuário informou valor mas assistente pediu de novo", "categoria errada", "ignorou a correção")
- "frase_teste": se houver problema, a frase EXATA do usuário p/ virar caso de teste no golden set (null se não houver problema)
Responda APENAS JSON: {"auditorias": [{"idx": 0, "tipo": "...", "ok": true, "problema": null, "frase_teste": null}]} — um item por troca, na ordem.`

  const payload = exchanges.map((e, i) => ({
    idx: i,
    usuario: e.user.slice(0, 500),
    assistente: (e.assistant ?? '').slice(0, 500),
  }))

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CLASSIFIER },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      seed: 42,
      max_tokens: 2000,
    }),
  })

  if (!openaiRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: 'OPENAI', status: openaiRes.status }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const aiJson = JSON.parse((await openaiRes.json()).choices[0].message.content)
  const audits = aiJson.auditorias || []
  const problems = audits.filter((a: any) => a.ok === false)
  const testPhrases = problems
    .filter((p: any) => p.frase_teste)
    .map((p: any) => ({ frase: p.frase_teste, problema: p.problema }))

  const report = {
    audit_date: yStr,
    total_messages: msgs.length,
    total_exchanges: exchanges.length,
    total_problems: problems.length,
    problems,
    frases_para_golden_set: testPhrases,
    detalhes: audits,
  }

  await supabase.from('copilot_audit_reports').upsert(
    {
      audit_date: yStr,
      total_messages: msgs.length,
      total_exchanges: exchanges.length,
      total_problems: problems.length,
      report,
    },
    { onConflict: 'audit_date' },
  )

  return new Response(JSON.stringify({ ok: true, ...report }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
