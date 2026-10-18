import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { isNonTransactionLine } from '../_shared/non-transaction.ts'
import { cleanMerchantDescription } from '../_shared/merchant-cleaner.ts'
import { sanitizeRawText } from '../_shared/text-sanitizer.ts'
import {
  resolveBrazilianMerchantSeed,
  normalizeMerchantString,
} from '../_shared/brazilian-seeds.ts'
import { normalizeText } from '../_shared/text-normalize.ts'

// ===== Thresholds centralizados (auditoria 18/10) =====
// Abaixo de FALLBACK a IA não confia o suficiente nem p/ "Outros" → needsReview.
// Entre FALLBACK e UNCERTAIN → cai no fallback seguro (Outros/null).
// Acima de UNCERTAIN → sugestão válida (UI marca como incerta até 0.7).
const CONFIDENCE_FALLBACK = 0.4
const CONFIDENCE_UNCERTAIN = 0.6
export const AI_CONFIDENCE_THRESHOLDS = {
  fallback: CONFIDENCE_FALLBACK,
  uncertain: CONFIDENCE_UNCERTAIN,
}

// ===== Regras de aprendizado da família (auditoria 18/10 — P0-1) =====
// O prompt promete "regras da família têm prioridade máxima" mas a edge nunca as
// buscava — regra "PADARIA → Alimentação" era ignorada pela IA. Agora: busca sob
// RLS do usuário autenticado, aplica match determinístico ANTES da IA e injeta
// as top ~30 no system prompt.
interface FamilyRule {
  pattern: string
  category_id: string
  subcategory_id: string | null
  max_amount_cents?: number | null
}

async function fetchFamilyRules(supabase: any, familyId: string | null): Promise<FamilyRule[]> {
  if (!familyId) return []
  try {
    const { data, error } = await supabase
      .from('categorization_rules')
      .select('pattern, category_id, subcategory_id, max_amount_cents')
      .eq('family_id', familyId)
      .limit(200)
    if (error) {
      console.warn('[batch-categorize] Falha ao buscar regras da família (fail-open):', error)
      return []
    }
    // Mais específicas primeiro (padrão mais longo ganha)
    return ((data || []) as FamilyRule[]).sort(
      (a, b) => (b.pattern?.length || 0) - (a.pattern?.length || 0),
    )
  } catch (e) {
    console.warn('[batch-categorize] Exceção ao buscar regras (fail-open):', e)
    return []
  }
}

function matchFamilyRule(
  description: string,
  rules: FamilyRule[],
  validCategoryIds: Set<string>,
  amountCents?: number,
): {
  categoryId: string
  subcategoryId: string | null
  confidence: number
  reasoning: string
} | null {
  const norm = normalizeText(description)
  if (!norm || rules.length === 0) return null
  for (const rule of rules) {
    const normPattern = normalizeText(rule.pattern || '')
    if (!normPattern || normPattern.length < 2) continue
    // Condição por valor (padrão Simplifi, P2): regra com max_amount_cents só
    // vale até aquele valor — "posto até R$ 10 = café" não pega tanque cheio.
    if (
      rule.max_amount_cents != null &&
      amountCents != null &&
      amountCents > rule.max_amount_cents
    ) {
      continue
    }
    if (norm.includes(normPattern) && validCategoryIds.has(rule.category_id)) {
      return {
        categoryId: rule.category_id,
        subcategoryId:
          rule.subcategory_id && validCategoryIds.size > 0 ? rule.subcategory_id : null,
        confidence: 0.99,
        reasoning: `Regra da família: "${rule.pattern}"${
          rule.max_amount_cents != null
            ? ` (até R$ ${(rule.max_amount_cents / 100).toFixed(2).replace('.', ',')})`
            : ''
        }`,
      }
    }
  }
  return null
}

interface BatchTransactionItem {
  tempId: string
  description: string
  amountCents: number
  date?: string
}

interface RequestPayload {
  // Modo A: PDF com texto bruto
  rawText?: string
  // Modo B: Lote de transações já extraídas (OFX ou Carteira)
  transactions?: BatchTransactionItem[]
  familyId?: string
}

interface AiCategorizationResultItem {
  tempId: string
  categoryId: string | null
  subcategoryId?: string | null
  confidence: number
  reasoning: string
  needsReview?: boolean
  alternativeCategoryId?: string | null
}

interface CategoryWithSubcategories {
  id: string
  name: string
  type: string
  budget_bucket?: string | null
  transaction_subcategories?: Array<{ id: string; name: string }> | null
}

interface PdfExtractedTransactionItem {
  date: string // AAAA-MM-DD
  description: string
  cleanMerchant: string
  amountCents: number
  type?: 'expense' | 'income'
  installment?: string // ex: "02/10"
  categoryId: string | null
  subcategoryId?: string | null
  confidence: number
  needsReview?: boolean
}

/**
 * Função inteligente de fallback:
 * Substitui o fallback cego anterior (categories[0], que costumava ser Moradia).
 * Nova regra:
 * 1. Procura categoria com semântica de "Outros / Diversos" ou balde "lifestyle" ("Estilo de Vida").
 * 2. Se não existir, retorna categoryId: null com needsReview: true para escolha no Bottom Sheet.
 */
function resolveSafeFallbackCategory(categoriesList: CategoryWithSubcategories[]): {
  categoryId: string | null
  needsReview: boolean
} {
  if (!categoriesList || categoriesList.length === 0) {
    return { categoryId: null, needsReview: true }
  }

  // 1. Procura por nome com semântica de "Outros", "Diversos" ou "Outras Despesas"
  const outrosCat = categoriesList.find((c: CategoryWithSubcategories) => {
    if (c.type && c.type !== 'expense') return false
    const norm = normalizeMerchantString(c.name || '')
    return (
      norm.includes('outro') ||
      norm.includes('diverso') ||
      norm === 'outros' ||
      norm === 'diversos' ||
      norm.includes('despesas diversas')
    )
  })
  if (outrosCat?.id) {
    return { categoryId: outrosCat.id, needsReview: false }
  }

  // 2. Procura categoria no balde "lifestyle" (Estilo de Vida), exceto essenciais como Moradia/Alimentação
  const lifestyleCat = categoriesList.find((c: CategoryWithSubcategories) => {
    if (c.type && c.type !== 'expense') return false
    if (c.budget_bucket === 'lifestyle') {
      const norm = normalizeMerchantString(c.name || '')
      return (
        !norm.includes('moradia') &&
        !norm.includes('alimentacao') &&
        !norm.includes('aluguel') &&
        !norm.includes('supermercado')
      )
    }
    const norm = normalizeMerchantString(c.name || '')
    return norm.includes('estilo de vida')
  })
  if (lifestyleCat?.id) {
    return { categoryId: lifestyleCat.id, needsReview: false }
  }

  // 3. Se não existir categoria de Outros/Diversos nem Estilo de Vida:
  // Retorna categoryId: null com needsReview: true para que o usuário decida conscientemente
  return { categoryId: null, needsReview: true }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Sessão não autenticada. Faça login novamente.',
          suggestions: [],
          transactions: [],
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY') ?? ''

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'OPENAI_API_KEY_NOT_CONFIGURED',
          message: 'Chave OPENAI_API_KEY não configurada no backend Supabase.',
          suggestions: [],
          transactions: [],
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Cliente Supabase no contexto da autenticação do usuário para isolamento e RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Obter usuário autenticado
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_SESSION',
          message: 'Sessão expirada. Faça login novamente.',
          suggestions: [],
          transactions: [],
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    let body: RequestPayload = {}
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({
          error: 'BAD_REQUEST',
          message: 'Corpo da requisição inválido ou JSON malformado.',
          suggestions: [],
          transactions: [],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const isPdfMode = typeof body.rawText === 'string' && body.rawText.trim().length > 0
    const rawTransactions = Array.isArray(body.transactions) ? body.transactions : []

    if (!isPdfMode && rawTransactions.length === 0) {
      return new Response(
        JSON.stringify({
          suggestions: [],
          transactions: [],
          message: 'Nenhum dado enviado (informe rawText para PDF ou transactions para lote).',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // CUSTO: rate limit por usuário (20 chamadas / 10 min) contra abuso da OpenAI
    const { data: rateLimit, error: rateErr } = await supabase.rpc('check_ai_rate_limit', {
      p_function_name: 'batch-categorize',
      p_max_requests: 20,
      p_window_minutes: 10,
    })
    if (rateErr) {
      console.warn('[batch-categorize] Rate limit check falhou (fail-open):', rateErr)
    } else if (rateLimit && rateLimit.allowed === false) {
      return new Response(
        JSON.stringify({
          error: 'RATE_LIMITED',
          message:
            'Limite de processamentos por agora atingido. Aguarde alguns minutos e tente de novo.',
          suggestions: [],
          transactions: [],
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // SEGURANÇA (tenant isolation): o family_id vem SEMPRE do vínculo autenticado
    // do usuário (family_members), sob RLS. O valor enviado pelo cliente é ignorado —
    // nunca consultar 'families' global, que vazaria o catálogo de outra família.
    const { data: memberRecord } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    const targetFamilyId = memberRecord?.family_id ?? null

    // Regras de aprendizado da família (P0-1, auditoria 18/10): buscadas sob RLS
    // do usuário autenticado — aplicadas deterministicamente antes da IA e
    // injetadas no prompt (o prompt promete prioridade máxima; agora entrega).
    const familyRules = await fetchFamilyRules(supabase, targetFamilyId)

    // Buscar categorias e subcategorias ativas da família no Supabase
    let categoriesQuery = supabase
      .from('transaction_categories')
      .select(
        'id, name, type, budget_bucket, intent_tag, transaction_subcategories(id, name, intent_tag)',
      )
      .order('sort_order', { ascending: true })

    if (targetFamilyId) {
      categoriesQuery = categoriesQuery.eq('family_id', targetFamilyId)
    }
    const { data: categoriesData, error: catError } = await categoriesQuery
    if (catError) {
      console.error('Erro ao buscar categorias da família:', catError)
    }

    const categoriesList: CategoryWithSubcategories[] =
      (categoriesData as CategoryWithSubcategories[]) || []
    if (categoriesList.length === 0) {
      return new Response(
        JSON.stringify({
          suggestions: [],
          transactions: [],
          message: 'Nenhuma categoria ativa cadastrada para a família.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Conjuntos para validação rigorosa de integridade
    const validCategoryIds = new Set<string>(
      categoriesList.map((c: CategoryWithSubcategories) => c.id),
    )
    const validSubcategoryIds = new Set<string>()
    const catToSubsMap = new Map<string, Set<string>>()
    categoriesList.forEach((c: CategoryWithSubcategories) => {
      const subSet = new Set<string>()
      ;(c.transaction_subcategories || []).forEach((s: { id: string; name: string }) => {
        if (s.id) {
          validSubcategoryIds.add(s.id)
          subSet.add(s.id)
        }
      })
      catToSubsMap.set(c.id, subSet)
    })

    // Formatar catálogo de categorias com baldes dinâmicos da família para o System Prompt
    // Catálogo v3 (18/10): tags de intenção (o nome é o rótulo, a intenção é o significado)
    // — a IA deixa de adivinhar e passa a decidir pela regra escrita (cai / não cai).
    const catalogPrompt = categoriesList
      .map((cat: any) => {
        const subs = (cat.transaction_subcategories || [])
          .map((s: any) =>
            s.intent_tag
              ? `{"id": "${s.id}", "name": "${s.name}", "intent": "${s.intent_tag.replace(/"/g, "'")}"}`
              : `{"id": "${s.id}", "name": "${s.name}"}`,
          )
          .join(', ')
        const bucket = cat.budget_bucket || 'lifestyle'
        const catIntent = cat.intent_tag ? `, intent="${cat.intent_tag.replace(/"/g, "'")}"` : ''
        return `- Categoria: id="${cat.id}", name="${cat.name}", type="${cat.type}", bucket="${bucket}"${catIntent}, subcategories=[${subs}]`
      })
      .join('\n')

    // =========================================================================
    // CASO A: MODO PDF (rawText da fatura de cartão de crédito)
    // =========================================================================
    if (isPdfMode) {
      // Sanitização rigorosa do rawText contra caracteres de controle ASCII e bytes corrompidos
      const rawText = sanitizeRawText(body.rawText).trim()
      const currentYear = new Date().getFullYear()

      // Prompt enxuto, universalizado (sem exemplos hardcoded da Rico)
      const pdfSystemPrompt = `Você é o especialista em inteligência financeira do Curiangoo (Curiangoo Copilot), especializado na leitura e extração de faturas de cartão de crédito de qualquer banco brasileiro (Nubank, Inter, Itaú, Bradesco, Santander, C6, BTG, Rico, XP, etc.).

Responda estritamente com um objeto JSON válido no formato especificado.

ATENÇÃO MÁXIMA: NUNCA crie transações para o cabeçalho/resumo da fatura ('Total Fatura', 'Pagamento Mínimo', 'Limite', 'Pagamento de fatura recebido'). Extraia estritamente compras de bens e serviços ou estornos listados no detalhamento dos cartões.

Catálogo de categorias da família (com baldes orçamentários dinâmicos):
${catalogPrompt}

REGRAS DE EXTRAÇÃO UNIVERSAL:
1. MÚLTIPLOS CARTÕES E SUBTOTAIS:
   - Faturas podem conter múltiplos cartões (titular e adicionais). Extraia TODAS as compras de todos os blocos até o fim do texto.
   - Subtotais parciais NUNCA encerram a leitura.
   - Descarte linhas de pagamento de fatura anterior sem interromper as compras seguintes da página.

2. CÂMBIO E MOEDA:
   - Em compras internacionais, ignore linhas de cotação em moeda estrangeira (USD, EUR, US$) e capture apenas o valor convertido em BRL que compõe o saldo devido.

3. DESCARTE DE NÃO-DESPESAS:
   - Descarte: TOTAL FATURA, TOTAL A PAGAR, SALDO DA FATURA, PAGAMENTO DE FATURA, PAGAMENTO RECEBIDO, LIMITE TOTAL, LIMITE DISPONÍVEL, PAGAMENTO MÍNIMO, PARCELAMENTO DE FATURA, ENCARGOS, OUVIDORIA.
   - Capture: Compras legítimas de bens/serviços, compras parceladas (ex.: "01/03", "2/12") e estornos reais (amountCents positivo com type="income").

4. TOTAL DECLARADO ("declaredTotalCents"):
   - Se o trecho contiver o cabeçalho com o total geral da fatura (ex.: "Total a pagar: R$ 518,93"), capture esse valor consolidado em centavos exclusivamente em "declaredTotalCents" (número inteiro positivo ou null). NUNCA insira esse valor no array "transactions".

5. PRESERVAÇÃO DE NOMES E RECONSTRUÇÃO COMPLETA:
   - Transcreva o nome do estabelecimento COMPLETO como aparece no texto da página, sem cortar palavras.
   - Se o nome aparecer fragmentado em linhas consecutivas (ex.: 'BRASIL' numa linha e 'PARALELO' na seguinte), junte os fragmentos num único nome legível.
   - Nunca invente palavras que não estão no texto.

6. CLASSIFICAÇÃO NEUTRA E RESPEITO AO CATÁLOGO:
   - Use EXCLUSIVAMENTE as categorias fornecidas no catálogo da família acima (use os IDs exatos).
   - Quando houver regras de aprendizado da família no contexto, elas têm prioridade máxima.
   - Considere o tipo da transação (receita/despesa) e o valor como pistas contextuais.

7. AVALIAÇÃO HONESTA DE CONFIANÇA E INSTRUÇÃO ANTI-CHUTE ("confidence"):
   - SE o estabelecimento for desconhecido ou o nome estiver incompleto/fragmentado: atribua confidence entre 0.2 e 0.4 e NUNCA escolha uma categoria genérica por eliminação (Compras e Outros NÃO são defaults). Prefira deixar para revisão do usuário a chutar.
   - Analise a palavra-chave mais ESPECÍFICA do nome, não a mais genérica: 'sorvete' nunca é pet; 'conveniência' de posto não é mercado; 'padaria' é alimentação, não lazer.
   - Match óbvio e inequívoco recebe 0.85-0.95.
FEW-SHOT CONCEITUAL:
Entrada:
"""
Total da Fatura: R$ 380,50   Vencimento: 10/04/2025
02/03 PAGAMENTO DE FATURA -1.200,00
05/03 RESTAURANTE SABOR R$ 120,00
08/03 SPOTIFY US$ 4.00
08/03 SPOTIFY BRL R$ 25,50
12/03 DROGASIL 01/02 R$ 235,00
Subtotal Cartão 1234: R$ 380,50
"""
Saída:
{
  "declaredTotalCents": 38050,
  "transactions": [
    { "date": "2025-03-05", "description": "RESTAURANTE SABOR", "cleanMerchant": "Restaurante Sabor", "amountCents": 12000, "type": "expense", "installment": null, "categoryId": "UUID_VALIDO", "subcategoryId": null, "confidence": 0.95 },
    { "date": "2025-03-08", "description": "SPOTIFY BRL", "cleanMerchant": "Spotify", "amountCents": 2550, "type": "expense", "installment": null, "categoryId": "UUID_VALIDO", "subcategoryId": null, "confidence": 0.95 },
    { "date": "2025-03-12", "description": "DROGASIL 01/02", "cleanMerchant": "Drogasil", "amountCents": 23500, "type": "expense", "installment": "01/02", "categoryId": "UUID_VALIDO", "subcategoryId": null, "confidence": 0.95 }
  ]
}`

      const pdfUserPrompt = `Texto bruto extraído da fatura em PDF:
--- INÍCIO DO TEXTO ---
${rawText.slice(0, 100000)}
--- FIM DO TEXTO ---

Instruções:
1. Percorra o texto até o fim, incluindo todos os cartões (titulares e adicionais) e blocos.
2. Descarte cabeçalhos, totais gerais, quitações de fatura passada e limites.
3. Capture declaredTotalCents se houver o total geral da fatura.
4. Classifique com categoryId e subcategoryId válidos do catálogo da família.`

      // Helper para chamar OpenAI
      const callOpenAiExtraction = async (systemP: string, userP: string) => {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemP },
              { role: 'user', content: userP },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
        })
        return res
      }

      // Helper para sanitizar transações (com merchant cleaner, seed determinístico e fallback seguro)
      const sanitizeItems = (
        rawItems: Partial<PdfExtractedTransactionItem>[],
      ): PdfExtractedTransactionItem[] => {
        const sanitized: PdfExtractedTransactionItem[] = []
        for (const item of rawItems) {
          if (!item || typeof item !== 'object') continue

          const rawDesc = String(item.description || item.cleanMerchant || '').trim()
          if (!rawDesc) continue

          // BLINDAGEM DETERMINÍSTICA: Descarte sumário de linhas de resumo, cabeçalhos, limites e pagamentos
          if (isNonTransactionLine(rawDesc) || isNonTransactionLine(item.cleanMerchant || '')) {
            continue
          }

          const amount =
            typeof item.amountCents === 'number' ? Math.round(Math.abs(item.amountCents)) : 0
          if (amount <= 0) continue

          let date = String(item.date || '').trim()
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            date = new Date().toISOString().slice(0, 10)
          }

          // Higienização determinística de adquirentes brasileiras
          const cleaned = cleanMerchantDescription(item.cleanMerchant || rawDesc)
          const finalCleanMerchant = cleaned || rawDesc

          let catId: string | null = String(item.categoryId || '')
          let subId: string | null = item.subcategoryId ? String(item.subcategoryId) : null
          let confidence =
            typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.5
          let needsReview = false

          // Camada Determinística Rápida: verifica se o Seed Brasileiro resolve antes ou confirma a categoria
          const seedMatch = resolveBrazilianMerchantSeed(rawDesc, categoriesList)
          if (seedMatch) {
            catId = seedMatch.categoryId
            subId = seedMatch.subcategoryId || subId
            confidence = seedMatch.confidence
            needsReview = false
          } else if (!catId || !validCategoryIds.has(catId) || confidence < CONFIDENCE_FALLBACK) {
            // Fallback seguro: categoria inexistente ou confiança abaixo do threshold centralizado
            const safeFallback = resolveSafeFallbackCategory(categoriesList)
            catId = safeFallback.categoryId
            subId = null
            needsReview = safeFallback.needsReview
          } else {
            const allowedSubs = catToSubsMap.get(catId)
            if (!subId || !allowedSubs || !allowedSubs.has(subId)) {
              subId = null
            }
          }

          sanitized.push({
            date,
            description: rawDesc,
            cleanMerchant: finalCleanMerchant,
            amountCents: amount,
            type: item.type === 'income' ? 'income' : 'expense',
            installment: item.installment ? String(item.installment).trim() : undefined,
            categoryId: catId,
            subcategoryId: subId,
            confidence,
            needsReview,
          })
        }
        return sanitized
      }

      const openaiRes = await callOpenAiExtraction(pdfSystemPrompt, pdfUserPrompt)

      if (!openaiRes.ok) {
        let errText = ''
        try {
          errText = await openaiRes.text()
        } catch (readErr) {
          errText = `[Falha ao ler corpo do erro da OpenAI: ${readErr}]`
        }
        console.error(
          `[batch-categorize] OpenAI API Error (PDF mode) - HTTP ${openaiRes.status}: ${errText}`,
        )
        return new Response(
          JSON.stringify({
            error: 'OPENAI_ERROR',
            message: `Erro na comunicação com a IA (HTTP ${openaiRes.status})`,
            transactions: [],
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      const openAiData = await openaiRes.json()
      const content = openAiData.choices?.[0]?.message?.content

      let parsed: any = null
      try {
        parsed = JSON.parse(content || '{}')
      } catch (parseErr) {
        console.error(
          'Falha ao parsear JSON da OpenAI em batch-categorize (PDF mode):',
          parseErr,
          content,
        )
        return new Response(
          JSON.stringify({
            error: 'PARSE_ERROR',
            message: 'Falha ao processar a resposta da IA no extrato PDF.',
            transactions: [],
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      const rawItems: any[] = Array.isArray(parsed?.transactions) ? parsed.transactions : []
      const rawDeclaredTotal = parsed?.declaredTotalCents
      let declaredTotalCents: number | null =
        typeof rawDeclaredTotal === 'number' && rawDeclaredTotal > 0
          ? Math.round(rawDeclaredTotal)
          : null

      let sanitizedTransactions = sanitizeItems(rawItems)

      // =========================================================================
      // AUTOCORREÇÃO MATEMÁTICA INTERNA TRANSPARENTE:
      // Se a soma das transações extraídas divergir do declaredTotalCents identificado,
      // executa uma segunda passada no texto bruto para capturar blocos remanescentes.
      // =========================================================================
      if (declaredTotalCents && declaredTotalCents > 0) {
        const currentExpensesSum = sanitizedTransactions
          .filter((t) => t.type === 'expense')
          .reduce((acc, t) => acc + t.amountCents, 0)
        const currentReversalsSum = sanitizedTransactions
          .filter((t) => t.type === 'income')
          .reduce((acc, t) => acc + t.amountCents, 0)
        const currentNetSum = currentExpensesSum - currentReversalsSum

        const diffNet = Math.abs(currentNetSum - declaredTotalCents)
        const diffGross = Math.abs(currentExpensesSum - declaredTotalCents)
        const diffCents = Math.min(diffNet, diffGross)

        if (diffCents > 5) {
          console.warn(
            `[batch-categorize] Divergência detectada no fechamento: soma=${currentNetSum} vs declarado=${declaredTotalCents} (dif=${diffCents} centavos). Autocorreção matemática...`,
          )

          try {
            const recoveryUserPrompt = `Texto bruto extraído da fatura em PDF:
--- INÍCIO DO TEXTO ---
${rawText.slice(0, 100000)}
--- FIM DO TEXTO ---

AUTOCORREÇÃO MATEMÁTICA ATIVADA:
A extração anterior somou ${currentNetSum} centavos, mas o total declarado da fatura é exatamente ${declaredTotalCents} centavos (diferença de ${diffCents} centavos).
Verifique se há cartões adicionais ou blocos omitidos na leitura.
Retorne estritamente um objeto JSON válido completo com "declaredTotalCents" e o array "transactions".`

            const retryRes = await callOpenAiExtraction(pdfSystemPrompt, recoveryUserPrompt)
            if (retryRes.ok) {
              const retryData = await retryRes.json()
              const retryContent = retryData.choices?.[0]?.message?.content
              const retryParsed = JSON.parse(retryContent || '{}')
              const retryRawItems: any[] = Array.isArray(retryParsed?.transactions)
                ? retryParsed.transactions
                : []

              if (retryRawItems.length > 0) {
                const recoveredSanitized = sanitizeItems(retryRawItems)
                const recoveredExpensesSum = recoveredSanitized
                  .filter((t) => t.type === 'expense')
                  .reduce((acc, t) => acc + t.amountCents, 0)
                const recoveredReversalsSum = recoveredSanitized
                  .filter((t) => t.type === 'income')
                  .reduce((acc, t) => acc + t.amountCents, 0)
                const recoveredNetSum = recoveredExpensesSum - recoveredReversalsSum
                const recoveredDiff = Math.min(
                  Math.abs(recoveredNetSum - declaredTotalCents),
                  Math.abs(recoveredExpensesSum - declaredTotalCents),
                )

                if (
                  recoveredDiff < diffCents ||
                  recoveredSanitized.length > sanitizedTransactions.length
                ) {
                  sanitizedTransactions = recoveredSanitized
                }
              }
            } else {
              let retryErrText = ''
              try {
                retryErrText = await retryRes.text()
              } catch (readErr) {
                retryErrText = `[Falha ao ler corpo do erro: ${readErr}]`
              }
              console.error(
                `[batch-categorize] OpenAI API Error (autocorreção matemática) - HTTP ${retryRes.status}: ${retryErrText}`,
              )
            }
          } catch (recoveryErr) {
            console.warn('[batch-categorize] Erro durante autocorreção matemática:', recoveryErr)
          }
        }
      }

      return new Response(
        JSON.stringify({
          transactions: sanitizedTransactions,
          declaredTotalCents,
          totalExtracted: sanitizedTransactions.length,
          mode: 'pdf',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // =========================================================================
    // CASO B: MODO LOTE / OFX (array de transações já extraídas)
    // =========================================================================
    // Sanitizar caracteres de controle de cada descrição antes do processamento
    const transactions: BatchTransactionItem[] = rawTransactions.map((t) => ({
      ...t,
      description: sanitizeRawText(t.description).trim(),
    }))

    // Camada Determinística Rápida 0 (P0-1): regras da família têm prioridade MÁXIMA
    // (padrão Maybe/Monarch — a correção do usuário vence a IA)
    const finalSuggestions: AiCategorizationResultItem[] = []
    const pendingForAi: BatchTransactionItem[] = []

    for (const t of transactions) {
      const ruleResolution = matchFamilyRule(
        t.description,
        familyRules,
        validCategoryIds,
        t.amountCents,
      )
      if (ruleResolution) {
        finalSuggestions.push({
          tempId: t.tempId,
          categoryId: ruleResolution.categoryId,
          subcategoryId: ruleResolution.subcategoryId,
          confidence: ruleResolution.confidence,
          reasoning: ruleResolution.reasoning,
          needsReview: false,
        })
        continue
      }

      const cleanedDesc = cleanMerchantDescription(t.description)
      const seedResolution =
        resolveBrazilianMerchantSeed(t.description, categoriesList) ||
        (cleanedDesc ? resolveBrazilianMerchantSeed(cleanedDesc, categoriesList) : null)

      if (seedResolution) {
        finalSuggestions.push({
          tempId: t.tempId,
          categoryId: seedResolution.categoryId,
          subcategoryId: seedResolution.subcategoryId,
          confidence: seedResolution.confidence,
          reasoning: seedResolution.reasoning,
          needsReview: false,
        })
      } else {
        pendingForAi.push({
          ...t,
          description: cleanedDesc || t.description,
        })
      }
    }

    // Se todas foram resolvidas pelo Seed Brasileiro (0ms, zero tokens)
    if (pendingForAi.length === 0) {
      return new Response(
        JSON.stringify({
          suggestions: finalSuggestions,
          totalProcessed: finalSuggestions.length,
          mode: 'batch',
          resolvedBySeed: finalSuggestions.length,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const systemPrompt = `Você é o assistente de categorização financeira do app Curiangoo (Curiangoo Copilot), especializado em finanças familiares brasileiras.

Responda estritamente com um objeto JSON válido no formato especificado com a chave "suggestions".

Seu objetivo é analisar um lote de transações bancárias e sugerir a melhor categoria (e subcategoria opcional) do catálogo da família.

Catálogo de categorias ativas da família (com baldes orçamentários dinâmicos):
${catalogPrompt}

REGRAS DE CLASSIFICAÇÃO:
1. FORMATO DE RESPOSTA OBRIGATÓRIO (JSON):
   Retorne estritamente um JSON no seguinte formato:
   {
     "suggestions": [
       {
         "tempId": "id_da_transacao",
         "categoryId": "UUID_VALIDO",
         "subcategoryId": "UUID_VALIDO_OU_NULL",
         "confidence": 0.95,
         "reasoning": "Motivo conciso",
         "alternativeCategoryId": "UUID_VALIDO_OU_NULL"
       }
     ]
   }
   O campo "alternativeCategoryId" é a SEGUNDA melhor hipótese (padrão Copilot Money):
   quando a primeira estiver errada, a segunda provavelmente é a certa — o app mostra
   as duas no topo do seletor. Use null se não houver segunda hipótese plausível.
2. Use EXCLUSIVAMENTE as categorias fornecidas no catálogo da família acima (use APENAS IDs "categoryId" e "subcategoryId" que EXISTEM no catálogo).
3. REGRAS DE APRENDIZADO DA FAMÍLIA (prioridade máxima — vencem qualquer outra pista):
${
  familyRules.length > 0
    ? familyRules
        .slice(0, 30)
        .map(
          (r) =>
            `- Se a descrição contém "${r.pattern}" → categoria id="${r.category_id}"${r.subcategory_id ? ` (subcategoria id="${r.subcategory_id}")` : ''}`,
        )
        .join('\n')
    : '- (Nenhuma regra de aprendizado registrada ainda.)'
}
4. Considere o tipo da transação (receita/despesa) e o valor como pistas contextuais. Contexto brasileiro: termos como PG*, PAG*, MP*, IFOOD, UBER, DROGASIL, FARMÁCIA, POSTO, PADARIA, NETFLIX são estabelecimentos do dia a dia.
REGRA ANTIDUPLICAÇÃO DA FATURA DE CARTÃO (catálogo v3 — CRÍTICA):
- Compra paga com cartão = despesa na categoria da compra (ex.: mercado → Alimentação › Supermercado), com paymentMethod credito.
- Pagamento de FATURA integral em dia NUNCA é despesa nova — é transferência (liquida compras já categorizadas). Se a transação for claramente "pagamento da fatura", retorne status "invalido" com mensagem explicando que fatura paga em dia não é gasto.
- Só entra em Dívidas & Empréstimos › "Dívida do Cartão (juros e parcelas em atraso)" o que NÃO foi pago em dia: rotativo, parcelamento da fatura, atraso com juros/multa.
- No total de gastos, pagamento de fatura nunca soma junto das compras já categorizadas.
- Aportes em Reserva/Metas/Investimentos NÃO são gasto consumido — são o dinheiro destinado ao futuro (balde 20%).
DICIONÁRIO SEMÂNTICO FIXO (rodadas 27B / 49):
- Gastos com cigarro, cigarros, maço de cigarro, tabaco, tabacaria, cigarro eletrônico/vape e charuto devem ser classificados em 'Compras › Tabaco & Cigarros' se existir no catálogo da família. JAMAIS classifique cigarro ou tabaco em Alimentação, Conveniência de posto, Farmácia ou Lazer.
- Gastos com doação, doar, caridade, doação para o catador devem ser classificados em 'Compras › Doações & Caridade' (tipo despesa).
- Produtos de limpeza doméstica (detergente, desinfetante, amaciante, esponja, sabão em pó, papel higiênico, limpeza da casa) pertencem a 'Moradia › Limpeza & Higiene da Casa' (NUNCA Alimentação).
5. AVALIAÇÃO HONESTA DE CONFIANÇA, REASONING E INSTRUÇÃO ANTI-CHUTE:
   - SE o estabelecimento for desconhecido ou o nome estiver incompleto/fragmentado: atribua confidence entre 0.2 e 0.4 e NUNCA escolha uma categoria genérica por eliminação (Compras e Outros NÃO são defaults). Prefira deixar para revisão do usuário a chutar.
   - Analise a palavra-chave mais ESPECÍFICA do nome, não a mais genérica: 'sorvete' nunca é pet; 'conveniência' de posto não é mercado; 'padaria' é alimentação, não lazer.
   - "confidence": Match óbvio e inequívoco recebe 0.85-0.95.
   - "reasoning": 1 frase concisa em português explicando o motivo.`
    const userPrompt = `Transações para classificar (${pendingForAi.length} itens):
${JSON.stringify(
  pendingForAi.map((t) => ({
    tempId: t.tempId,
    description: t.description,
    amountBRL: (t.amountCents / 100).toFixed(2),
    date: t.date,
  })),
  null,
  2,
)}`

    // Cálculo seguro de max_tokens: ~80-100 tokens por item de resposta JSON + margem de 500 tokens (teto 4000)
    const calculatedTokens = Math.min(4000, Math.max(1200, pendingForAi.length * 100 + 500))

    // Chamada à API da OpenAI (GPT-4o mini) com max_tokens
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: calculatedTokens,
      }),
    })

    if (!openaiRes.ok) {
      let errText = ''
      try {
        errText = await openaiRes.text()
      } catch (readErr) {
        errText = `[Falha ao ler corpo do erro da OpenAI: ${readErr}]`
      }
      console.error(
        `[batch-categorize] OpenAI API Error (batch mode) - HTTP ${openaiRes.status}: ${errText}`,
      )
      return new Response(
        JSON.stringify({
          error: 'OPENAI_ERROR',
          message: `Erro na comunicação com a IA (HTTP ${openaiRes.status})`,
          suggestions: finalSuggestions,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const openAiData = await openaiRes.json()
    const content = openAiData.choices?.[0]?.message?.content

    let parsed: any = null
    try {
      parsed = JSON.parse(content || '{}')
    } catch (_parseErr) {
      // Parse tolerante: tenta extrair o bloco de sugestões caso o JSON esteja cortado no final
      try {
        const match = (content || '').match(/"suggestions"\s*:\s*\[([\s\S]*)/)
        if (match) {
          let partial = match[1].trim()
          const lastBrace = partial.lastIndexOf('}')
          if (lastBrace !== -1) {
            partial = partial.slice(0, lastBrace + 1)
            parsed = JSON.parse(`{"suggestions": [${partial}]}`)
          }
        }
      } catch {
        parsed = null
      }

      if (!parsed) {
        console.error('Falha ao parsear JSON da OpenAI em batch-categorize (batch mode):', content)
        return new Response(
          JSON.stringify({
            error: 'PARSE_ERROR',
            message: 'Falha ao processar a resposta estruturada da IA. Tente novamente o lote.',
            suggestions: finalSuggestions,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
    }

    const rawSuggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : []
    const aiResponseByTempId = new Map<string, any>()

    for (const item of rawSuggestions) {
      if (item && item.tempId) {
        aiResponseByTempId.set(String(item.tempId), item)
      }
    }

    // Validação de completude: comparar itens solicitados (pendingForAi) com itens respondidos
    for (const pendingItem of pendingForAi) {
      const item = aiResponseByTempId.get(pendingItem.tempId)

      if (!item) {
        // Item faltante na resposta da OpenAI: NUNCA perde o item silenciosamente
        finalSuggestions.push({
          tempId: pendingItem.tempId,
          categoryId: null,
          subcategoryId: null,
          confidence: 0,
          reasoning: 'incomplete_response',
          needsReview: true,
        })
        continue
      }

      let catId: string | null = item.categoryId ? String(item.categoryId) : null
      let subId: string | null = item.subcategoryId ? String(item.subcategoryId) : null
      const confidence = typeof item.confidence === 'number' ? item.confidence : 0.55
      let needsReview = false

      // Fallback seguro se categoria sugerida for inválida ou confiança abaixo do threshold centralizado
      if (!catId || !validCategoryIds.has(catId) || confidence < CONFIDENCE_FALLBACK) {
        const safeFallback = resolveSafeFallbackCategory(categoriesList)
        catId = safeFallback.categoryId
        subId = null
        needsReview = safeFallback.needsReview
      } else {
        const allowedSubs = catToSubsMap.get(catId)
        if (!subId || !allowedSubs || !allowedSubs.has(subId)) {
          subId = null
        }
      }

      // Top-2 chutes (padrão Copilot): segunda hipótese validada contra o catálogo
      let altCatId: string | null = item.alternativeCategoryId
        ? String(item.alternativeCategoryId)
        : null
      if (altCatId && (!validCategoryIds.has(altCatId) || altCatId === catId)) {
        altCatId = null
      }

      finalSuggestions.push({
        tempId: pendingItem.tempId,
        categoryId: catId,
        subcategoryId: subId,
        confidence,
        reasoning: String(item.reasoning || ''),
        needsReview,
        alternativeCategoryId: altCatId,
      })
    }

    return new Response(
      JSON.stringify({
        suggestions: finalSuggestions,
        totalProcessed: finalSuggestions.length,
        mode: 'batch',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err: any) {
    console.error('Erro geral na edge function batch-categorize:', err)
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: err?.message || 'Erro interno na Edge Function batch-categorize',
        suggestions: [],
        transactions: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
