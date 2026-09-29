import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface BatchTransactionItem {
  tempId: string
  description: string
  amountCents: number
  date?: string
}

interface RequestPayload {
  transactions?: BatchTransactionItem[]
  familyId?: string
}

interface AiCategorizationResultItem {
  tempId: string
  categoryId: string
  subcategoryId?: string | null
  confidence: number
  reasoning: string
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
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Cliente Supabase no contexto da autenticação do usuário
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
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const transactions = Array.isArray(body.transactions) ? body.transactions : []
    if (transactions.length === 0) {
      return new Response(
        JSON.stringify({
          suggestions: [],
          message: 'Nenhuma transação enviada para categorização.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Identificar família do usuário caso não venha no body
    let targetFamilyId = body.familyId
    if (!targetFamilyId) {
      const { data: memberRecord } = await supabase
        .from('family_members')
        .select('family_id')
        .limit(1)
        .maybeSingle()

      if (memberRecord?.family_id) {
        targetFamilyId = memberRecord.family_id
      } else {
        const { data: familyRecord } = await supabase
          .from('families')
          .select('id')
          .limit(1)
          .maybeSingle()
        if (familyRecord?.id) {
          targetFamilyId = familyRecord.id
        }
      }
    }

    // Buscar categorias e subcategorias ativas da família no Supabase
    let categoriesQuery = supabase
      .from('transaction_categories')
      .select('id, name, type, budget_bucket, transaction_subcategories(id, name)')
      .order('sort_order', { ascending: true })

    if (targetFamilyId) {
      categoriesQuery = categoriesQuery.eq('family_id', targetFamilyId)
    }
    const { data: categoriesData, error: catError } = await categoriesQuery
    if (catError) {
      console.error('Erro ao buscar categorias da família:', catError)
    }

    const categoriesList = categoriesData || []
    if (categoriesList.length === 0) {
      return new Response(
        JSON.stringify({
          suggestions: [],
          message: 'Nenhuma categoria ativa cadastrada para a família.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Formatar o catálogo de categorias para o System Prompt
    // Mapeando com seus respectivos baldes ('essentials', 'lifestyle', 'future')
    const catalogPrompt = categoriesList
      .map((cat: any) => {
        const subs = (cat.transaction_subcategories || [])
          .map((s: any) => `{"id": "${s.id}", "name": "${s.name}"}`)
          .join(', ')
        const bucket = cat.budget_bucket || 'lifestyle'
        return `- Categoria: id="${cat.id}", name="${cat.name}", type="${cat.type}", bucket="${bucket}", subcategories=[${subs}]`
      })
      .join('\n')

    const systemPrompt = `Você é o assistente de categorização financeira do app Curiangoo (Curiangoo Copilot), especializado em finanças familiares brasileiras e na regra 50/30/20.

Seu objetivo é analisar um lote de transações bancárias não categorizadas e sugerir a melhor categoria (e subcategoria opcional) para cada uma.

Catálogo REAL de categorias e subcategorias ativas da família:
${catalogPrompt}

REGRAS CRÍTICAS DE CLASSIFICAÇÃO:
1. CLASSIFICAÇÃO ESTRITA: Você DEVE usar OBRIGATORIAMENTE apenas IDs ("categoryId" e "subcategoryId") que EXISTEM no catálogo real fornecido acima. NUNCA invente categorias ou UUIDs que não estejam no catálogo.
2. SUB-CATEGORIAS: Se uma categoria tiver subcategorias cadastradas e uma delas for claramente adequada ao gasto, preencha o "subcategoryId" com o ID correspondente. Se nenhuma subcategoria se aplicar ou a categoria não tiver subcategorias, retorne "subcategoryId": null.
3. CONTEXTO BANCÁRIO BRASILEIRO:
   - Termos como "PG *", "PAG*", "MERCADOPAGO", "IFOOD", "UBER", "POSTO", "DROGASIL", "FARMACIA", "PADARIA", "ASSAI", "CARREFOUR", "NETFLIX", "SPOTIFY" são típicos de extratos brasileiros.
   - Entenda a essência do estabelecimento mesmo quando precedido por nomes de adquirentes ou intermediários (ex: "MP *DROGARIA", "PAG*RESTAURANTE").
   - Despesas com beleza, estética, barbearia, cinema ou compras de vestuário pertencem ao balde "lifestyle" (Estilo de Vida), nunca a categorias fixas de moradia ou saúde básica.
4. NÍVEL DE CONFIANÇA E REASONING:
   - "confidence": número entre 0.0 e 1.0 indicando sua certeza (ex.: 0.95 para match óbvio como Uber -> Transporte, 0.60 para descrição genérica).
   - "reasoning": justificativa ultra sucinta (1 frase em português) explicando o motivo da classificação.

RETORNO OBRIGATÓRIO:
Você DEVE retornar EXCLUSIVAMENTE um objeto JSON válido (response_format: json_object) com a chave "suggestions", sendo um array de objetos com o seguinte esquema:
{
  "suggestions": [
    {
      "tempId": "string (o mesmo tempId recebido)",
      "categoryId": "string (o ID exato da categoria selecionada do catálogo)",
      "subcategoryId": "string ou null (o ID da subcategoria se houver correspondência, ou null)",
      "confidence": number (entre 0.0 e 1.0),
      "reasoning": "string concisa em português"
    }
  ]
}`

    const userPrompt = `Transações para classificar (${transactions.length} itens):
${JSON.stringify(
  transactions.map((t) => ({
    tempId: t.tempId,
    description: t.description,
    amountBRL: (t.amountCents / 100).toFixed(2),
    date: t.date,
  })),
  null,
  2,
)}`

    // Chamada à API da OpenAI (GPT-4o mini com json_object e temperature 0.2)
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
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('OpenAI API Error in batch-categorize:', openaiRes.status, errText)
      return new Response(
        JSON.stringify({
          error: 'OPENAI_ERROR',
          message: `Erro na comunicação com a IA (HTTP ${openaiRes.status})`,
          suggestions: [],
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
      console.error('Falha ao parsear JSON da OpenAI em batch-categorize:', parseErr, content)
      return new Response(
        JSON.stringify({
          error: 'PARSE_ERROR',
          message: 'Falha ao processar a resposta estruturada da IA.',
          suggestions: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const rawSuggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : []

    // Validar e higienizar sugestões contra o catálogo existente
    const validCategoryIds = new Set(categoriesList.map((c: any) => c.id))
    const validSubcategoryIds = new Set<string>()
    categoriesList.forEach((c: any) => {
      ;(c.transaction_subcategories || []).forEach((s: any) => {
        if (s.id) validSubcategoryIds.add(s.id)
      })
    })

    const sanitizedSuggestions: AiCategorizationResultItem[] = []
    for (const item of rawSuggestions) {
      if (!item || !item.tempId || !item.categoryId) continue

      // Garantir que a categoryId pertença ao catálogo real da família
      if (!validCategoryIds.has(item.categoryId)) {
        continue
      }

      const subId =
        item.subcategoryId && validSubcategoryIds.has(item.subcategoryId)
          ? item.subcategoryId
          : null

      sanitizedSuggestions.push({
        tempId: String(item.tempId),
        categoryId: String(item.categoryId),
        subcategoryId: subId,
        confidence: typeof item.confidence === 'number' ? item.confidence : 0.8,
        reasoning: String(item.reasoning || ''),
      })
    }

    return new Response(
      JSON.stringify({
        suggestions: sanitizedSuggestions,
        totalProcessed: sanitizedSuggestions.length,
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
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
