import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// whatsapp-webhook v8 — igual v7 + debug na tabela whatsapp_debug
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const GRAPH_BASE = 'https://graph.facebook.com/v24.0'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function getConfig(db: any, key: string): Promise<string> {
  const { data } = await db.from('whatsapp_config').select('value').eq('key', key).maybeSingle()
  return data?.value ?? ''
}

function handleVerification(url: URL, verifyToken: string): Response | null {
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token) {
    if (verifyToken && token === verifyToken) return new Response(challenge ?? 'ok')
    return new Response('forbidden', { status: 403 })
  }
  return null
}

interface WaMessage {
  id: string
  from: string
  type: string
  text?: string
  audioId?: string
  mimeType?: string
}

function extractMessages(body: any): WaMessage[] {
  const out: WaMessage[] = []
  try {
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value
        for (const msg of value?.messages ?? []) {
          const from = String(msg?.from ?? '')
          const id = String(msg?.id ?? '')
          if (!from || !id) continue
          if (msg?.type === 'text' && msg?.text?.body)
            out.push({ id, from, type: 'text', text: msg.text.body })
          else if (msg?.type === 'audio' && msg?.audio?.id)
            out.push({
              id,
              from,
              type: 'audio',
              audioId: msg.audio.id,
              mimeType: msg.audio.mime_type,
            })
          else if (msg?.type === 'voice' && msg?.voice?.id)
            out.push({
              id,
              from,
              type: 'audio',
              audioId: msg.voice.id,
              mimeType: msg.voice.mime_type,
            })
        }
      }
    }
  } catch (e) {
    console.error('[wa] parse payload:', e)
  }
  return out
}

async function resolveUserByPhone(db: any, phone: string): Promise<string | null> {
  const digits = phone.replace(/\D/g, '')
  const candidates = [digits]
  if (digits.startsWith('55')) {
    candidates.push('+' + digits)
    if (digits.length === 12) {
      const with9 = '55' + digits.slice(2, 4) + '9' + digits.slice(4)
      candidates.push(with9, '+' + with9)
    }
  } else candidates.push('+' + digits)
  for (const cand of candidates) {
    const { data } = await db
      .from('user_preferences')
      .select('user_id')
      .eq('phone', cand)
      .maybeSingle()
    if (data?.user_id) return data.user_id
  }
  return null
}

async function resolveFamilyMember(
  db: any,
  userId: string,
): Promise<{ familyId: string; memberId: string } | null> {
  const { data: members } = await db
    .from('family_members')
    .select('id, family_id, is_admin, user_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (!members || members.length === 0) return null
  const own = members.find((m: any) => m.user_id === userId)
  const pick = own ?? members.find((m: any) => m.is_admin) ?? members[0]
  return { familyId: pick.family_id, memberId: pick.id }
}

async function downloadWaAudio(
  accessToken: string,
  audioId: string,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const urlRes = await fetch(`${GRAPH_BASE}/${audioId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!urlRes.ok) return null
    const { url, mime_type } = await urlRes.json()
    const binRes = await fetch(url)
    if (!binRes.ok) return null
    return { bytes: new Uint8Array(await binRes.arrayBuffer()), mime: mime_type || 'audio/ogg' }
  } catch {
    return null
  }
}

async function transcribeAudio(bytes: Uint8Array, mime: string): Promise<string | null> {
  try {
    const ext =
      mime.includes('mp4') || mime.includes('m4a')
        ? 'mp4'
        : mime.includes('mpeg') || mime.includes('mp3')
          ? 'mp3'
          : mime.includes('wav')
            ? 'wav'
            : 'ogg'
    const fd = new FormData()
    fd.append('file', new Blob([bytes], { type: mime }), `audio.${ext}`)
    fd.append('model', 'whisper-1')
    fd.append('language', 'pt')
    fd.append('response_format', 'json')
    fd.append(
      'prompt',
      'Registro de gastos por voz em português do Brasil. Vocabulário: reais, centavos, pix, débito, crédito, dinheiro, cartão, supermercado, posto, gasolina, ifood, mercado, aluguel, luz, água, internet, boleto, churrasco, salário, receita, gastei, paguei, lancei.',
    )
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 25000)
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: fd,
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return null
    const data = await res.json()
    return (data?.text || '').trim() || null
  } catch {
    return null
  }
}

interface AiTx {
  descricao: string
  valor: number | null
  tipo: 'despesa' | 'receita'
  categoria: string | null
  metodo_pagamento: string | null
}

const SYSTEM_PROMPT = `Você é o Curiango, assistente de finanças do app Curiangoo, respondendo por WhatsApp.
Interprete a mensagem e responda SOMENTE com JSON válido:
1. LANÇAMENTO (gasto/receita com valor): {"acao":"lancamento","descricao":"...","valor":<reais>,"tipo":"despesa"|"receita","categoria":"<categoria da família>","metodo_pagamento":"pix"|"debito"|"credito"|"dinheiro"|null,"resposta":"<frase curta simpática>"}
2. CONSULTA (saldo/gastos): {"acao":"consulta","resposta":"<1-2 frases com o dado>"}
3. SAUDAÇÃO: {"acao":"social","resposta":"<simpática, diga que pode lançar gastos ou perguntar saldo>"}
4. Lançamento sem valor: {"acao":"duvida","resposta":"<pergunta o valor>"}
pt-BR, simpático. Só JSON.`

async function callAi(
  db: any,
  debug: (s: string, d: any) => Promise<void>,
  texto: string,
  familyId: string,
): Promise<any | null> {
  if (!OPENAI_API_KEY) {
    await debug('ai_sem_key', {})
    return null
  }
  try {
    const [catRes, totalsRes] = await Promise.all([
      db
        .from('transaction_categories')
        .select('name, type, budget_bucket')
        .eq('family_id', familyId),
      db.rpc('get_family_totals', { p_family_id: familyId }),
    ])
    await debug('ai_contexto', {
      cats: catRes.data?.length ?? 0,
      totalsErr: totalsRes.error?.message ?? null,
      totals: totalsRes.data ?? null,
    })
    const cats = (catRes.data ?? [])
      .filter((c: any) => c.type === 'expense')
      .map((c: any) => c.name)
    const totals = Array.isArray(totalsRes.data) ? totalsRes.data[0] : totalsRes.data
    const fmt = (cents: number | null | undefined) =>
      typeof cents === 'number' ? `R$ ${(cents / 100).toFixed(2).replace('.', ',')}` : 'R$ 0,00'
    const saldoTxt = totals ? fmt(totals.balance_cents) : 'indisponível'
    const userMsg = `Categorias da família: ${cats.join(', ')}\nSaldo total atual da família: ${saldoTxt}\n\nMensagem do usuário: "${texto}"`
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 500,
      }),
    })
    if (!res.ok) {
      await debug('ai_http_erro', { status: res.status, body: (await res.text()).slice(0, 300) })
      return null
    }
    const data = await res.json()
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
    await debug('ai_ok', { parsed })
    return parsed
  } catch (e: any) {
    await debug('ai_excecao', { err: String(e).slice(0, 300) })
    return null
  }
}

async function createTransaction(
  db: any,
  userId: string,
  familyId: string,
  memberId: string,
  tx: AiTx,
): Promise<{ ok: boolean; error?: string }> {
  if (!tx.valor || tx.valor <= 0) return { ok: false, error: 'valor_invalido' }
  let categoryId: string | null = null
  if (tx.categoria) {
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
    const { data: cats } = await db
      .from('transaction_categories')
      .select('id, name, type')
      .eq('family_id', familyId)
      .eq('type', tx.tipo === 'receita' ? 'income' : 'expense')
    const match = (cats ?? []).find((c: any) => norm(c.name) === norm(tx.categoria!))
    if (match) categoryId = match.id
  }
  const cents = Math.round(tx.valor * 100)
  const { data, error } = await db.rpc('create_whatsapp_transaction', {
    p_user_id: userId,
    p_family_id: familyId,
    p_member_id: memberId,
    p_category_id: categoryId,
    p_type: tx.tipo === 'receita' ? 'income' : 'expense',
    p_amount_cents: cents,
    p_description: (tx.descricao || 'Lançamento via WhatsApp').slice(0, 200),
    p_transaction_date: new Date().toISOString().slice(0, 10),
    p_payment_method: tx.metodo_pagamento || null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

async function sendWhatsAppText(
  accessToken: string,
  phoneId: string,
  to: string,
  text: string,
): Promise<void> {
  if (!accessToken || !phoneId) return
  try {
    const res = await fetch(`${GRAPH_BASE}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text.slice(0, 4000) },
      }),
    })
    if (!res.ok) console.error('[wa] envio falhou:', res.status, await res.text())
  } catch (e) {
    console.error('[wa] envio:', e)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  const url = new URL(req.url)
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const debug = (step: string, detail: any) =>
    db
      .from('whatsapp_debug')
      .insert({ step, detail })
      .then(() => undefined)
  const accessToken = await getConfig(db, 'access_token')
  const phoneId = await getConfig(db, 'phone_number_id')
  const verifyToken = await getConfig(db, 'verify_token')

  if (req.method === 'GET') {
    const v = handleVerification(url, verifyToken)
    return v ?? json({ ok: true })
  }
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('bad_json', { status: 400 })
  }

  const messages = extractMessages(body)
  if (messages.length === 0) return json({ ok: true })

  for (const msg of messages) {
    const { data: seen } = await db
      .from('whatsapp_processed_messages')
      .select('message_id')
      .eq('message_id', msg.id)
      .maybeSingle()
    if (seen) continue
    await db.from('whatsapp_processed_messages').upsert({ message_id: msg.id, wa_user: msg.from })
    try {
      const userId = await resolveUserByPhone(db, msg.from)
      await debug('user', { from: msg.from, userId })
      if (!userId) {
        await sendWhatsAppText(
          accessToken,
          phoneId,
          msg.from,
          'Oi! Aqui é o Curiango do Curiangoo. Para usar por aqui, cadastre seu celular no app em Perfil → Minha Conta. Te vejo lá!',
        )
        continue
      }
      const fam = await resolveFamilyMember(db, userId)
      await debug('fam', { ...fam })
      if (!fam) {
        await sendWhatsAppText(
          accessToken,
          phoneId,
          msg.from,
          'Você ainda não faz parte de uma família no Curiangoo. Crie sua família no app e volte aqui!',
        )
        continue
      }
      let texto = msg.text ?? ''
      if (!texto && msg.audioId) {
        const audio = await downloadWaAudio(accessToken, msg.audioId)
        if (!audio) {
          await sendWhatsAppText(
            accessToken,
            phoneId,
            msg.from,
            'Não consegui baixar seu áudio. Pode mandar de novo?',
          )
          continue
        }
        const t = await transcribeAudio(audio.bytes, audio.mime)
        if (!t) {
          await sendWhatsAppText(
            accessToken,
            phoneId,
            msg.from,
            'Não consegui ouvir seu áudio. Pode mandar como texto?',
          )
          continue
        }
        texto = t
      }
      if (!texto.trim()) {
        await sendWhatsAppText(
          accessToken,
          phoneId,
          msg.from,
          'Recebi sua mensagem, mas não entendi. Manda um texto ou áudio!',
        )
        continue
      }
      const ai = await callAi(db, debug, texto, fam.familyId)
      if (!ai || !ai.acao) {
        await sendWhatsAppText(
          accessToken,
          phoneId,
          msg.from,
          'Tive um problema técnico agora. Tenta de novo em instantes!',
        )
        continue
      }
      if (ai.acao === 'lancamento' && ai.valor) {
        const result = await createTransaction(db, userId, fam.familyId, fam.memberId, ai as AiTx)
        await debug('tx_result', { ok: result.ok, error: result.error ?? null })
        if (result.ok) {
          const v = `R$ ${Number(ai.valor).toFixed(2).replace('.', ',')}`
          await sendWhatsAppText(
            accessToken,
            phoneId,
            msg.from,
            `${ai.resposta || 'Lançado!'}\n\n${v} — ${ai.descricao}\nCategoria: ${ai.categoria || 'sem categoria'}\n\nAbre o app pra conferir!`,
          )
        } else {
          await sendWhatsAppText(
            accessToken,
            phoneId,
            msg.from,
            `Não consegui lançar: ${result.error}. Confere o valor e tenta de novo!`,
          )
        }
      } else if (ai.acao === 'consulta' || ai.acao === 'social' || ai.acao === 'duvida') {
        await sendWhatsAppText(accessToken, phoneId, msg.from, ai.resposta || 'Como posso ajudar?')
      } else {
        await sendWhatsAppText(
          accessToken,
          phoneId,
          msg.from,
          ai.resposta || 'Entendi, mas prefiro que você faça isso no app. Abre o Curiangoo!',
        )
      }
    } catch (e: any) {
      await debug('excecao', { err: String(e).slice(0, 300) })
    }
  }
  return json({ ok: true })
})
