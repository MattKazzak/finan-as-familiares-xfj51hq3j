#!/usr/bin/env node
/**
 * Golden set de evals do Curiangoo Copilot.
 * Uso:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... TEST_EMAIL=... TEST_PASSWORD=... node evals/run-copilot-evals.mjs
 * Opcional: CASE=c15 (roda só um caso), VERBOSE=1 (mostra respostas).
 *
 * O que valida por caso:
 *  - status retornado pela voice-parse (quando expect.status definido)
 *  - router.classe (quando expect.classe definido)
 *  - acao (quando expect.acao definido)
 *  - tipo receita (expect.tipo)
 *  - valor aproximado (expect.valor — tolerância de 1%)
 *  - categoria contém substring (expect.categoria_contem)
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
const ONLY_CASE = process.env.CASE || null
const VERBOSE = process.env.VERBOSE === '1'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_EMAIL || !TEST_PASSWORD) {
  console.error('Faltam env vars: SUPABASE_URL, SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD')
  process.exit(2)
}

const golden = JSON.parse(
  readFileSync(new URL('./copilot-golden-set.json', import.meta.url), 'utf8'),
)

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
})
if (authErr || !authData?.session) {
  console.error('Falha no login do usuário de teste:', authErr?.message)
  process.exit(2)
}
const token = authData.session.access_token

async function callVoiceParse(payload) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/voice-parse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => null)
  return { httpStatus: res.status, json }
}

function buildContextoAnterior(prevResponse) {
  if (!prevResponse) return null
  const tx = prevResponse.transacao || null
  return {
    descricao: tx?.descricao ?? null,
    estabelecimento: tx?.estabelecimento ?? null,
    valor: tx?.valor ?? null,
    categoria: tx?.categoria ?? null,
    subcategoria: tx?.subcategoria ?? null,
    balde: tx?.balde ?? null,
    tipo: tx?.tipo ?? null,
    status: prevResponse.status ?? null,
    opcoes_sugestao: prevResponse.opcoes_sugestao ?? null,
  }
}

function checkExpectations(expect, json) {
  const failures = []
  if (expect.status && json?.status !== expect.status) {
    failures.push(`status esperado "${expect.status}", veio "${json?.status}"`)
  }
  const classe = json?.router?.classe ?? json?.classe_intencao ?? null
  if (expect.classe && classe !== expect.classe) {
    failures.push(`classe esperada ${expect.classe}, veio ${classe}`)
  }
  if (expect.acao && json?.acao !== expect.acao) {
    failures.push(`acao esperada "${expect.acao}", veio "${json?.acao}"`)
  }
  if (expect.tipo === 'receita' && json?.transacao?.tipo !== 'receita') {
    failures.push(`tipo esperado receita, veio "${json?.transacao?.tipo}"`)
  }
  if (typeof expect.valor === 'number') {
    const got = Number(json?.transacao?.valor)
    const tol = Math.abs(expect.valor * 0.01) + 0.005
    if (!(Math.abs(got - expect.valor) <= tol)) {
      failures.push(`valor esperado ${expect.valor}, veio ${got}`)
    }
  }
  if (expect.categoria_contem) {
    const cat = String(json?.transacao?.categoria || '')
    if (!cat.toLowerCase().includes(expect.categoria_contem.toLowerCase())) {
      failures.push(`categoria "${cat}" não contém "${expect.categoria_contem}"`)
    }
  }
  return failures
}

let passed = 0
let failed = 0
const failuresLog = []

for (const testCase of golden.cases) {
  if (ONLY_CASE && testCase.id !== ONLY_CASE) continue

  let prevResponse = null
  let caseFailed = false
  const caseFailures = []

  for (const [turnIdx, turn] of testCase.turns.entries()) {
    const payload = {
      texto: turn.text,
      contexto_anterior: buildContextoAnterior(prevResponse),
      historico_mensagens: null,
      active_month: null,
    }
    const { httpStatus, json } = await callVoiceParse(payload)

    if (httpStatus !== 200 || !json) {
      caseFailures.push(`turn ${turnIdx + 1}: HTTP ${httpStatus} sem JSON válido`)
      caseFailed = true
      break
    }

    if (VERBOSE) {
      console.log(`  [${testCase.id} turn ${turnIdx + 1}] "${turn.text}"`)
      console.log(
        `   -> status=${json.status} classe=${json?.router?.classe} acao=${json?.acao} msg=${String(json?.mensagem_amigavel || '').slice(0, 90)}`,
      )
    }

    const turnFailures = checkExpectations(turn.expect, json)
    if (turnFailures.length > 0) {
      caseFailures.push(`turn ${turnIdx + 1} ("${turn.text}"): ${turnFailures.join('; ')}`)
      caseFailed = true
    }

    prevResponse = json
  }

  if (caseFailed) {
    failed++
    failuresLog.push({ id: testCase.id, nome: testCase.nome, failures: caseFailures })
    console.log(`✗ ${testCase.id} — ${testCase.nome}`)
    for (const f of caseFailures) console.log(`    ${f}`)
  } else {
    passed++
    console.log(`✓ ${testCase.id} — ${testCase.nome}`)
  }
}

console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`)
if (failed > 0) process.exit(1)
