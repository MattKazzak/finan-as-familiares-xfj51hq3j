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
  // Modo A: PDF com texto bruto
  rawText?: string
  // Modo B: Lote de transações já extraídas (OFX ou Carteira)
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

interface PdfExtractedTransactionItem {
  date: string // AAAA-MM-DD
  description: string
  cleanMerchant: string
  amountCents: number
  type?: 'expense' | 'income'
  installment?: string // ex: "02/10"
  categoryId: string
  subcategoryId?: string | null
  confidence: number
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
          transactions: [],
          message: 'Nenhuma categoria ativa cadastrada para a família.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Conjuntos para validação rigorosa de integridade
    const validCategoryIds = new Set(categoriesList.map((c: any) => c.id))
    const validSubcategoryIds = new Set<string>()
    const catToSubsMap = new Map<string, Set<string>>()
    categoriesList.forEach((c: any) => {
      const subSet = new Set<string>()
      ;(c.transaction_subcategories || []).forEach((s: any) => {
        if (s.id) {
          validSubcategoryIds.add(s.id)
          subSet.add(s.id)
        }
      })
      catToSubsMap.set(c.id, subSet)
    })

    // Formatar catálogo de categorias para o System Prompt
    const catalogPrompt = categoriesList
      .map((cat: any) => {
        const subs = (cat.transaction_subcategories || [])
          .map((s: any) => `{"id": "${s.id}", "name": "${s.name}"}`)
          .join(', ')
        const bucket = cat.budget_bucket || 'lifestyle'
        return `- Categoria: id="${cat.id}", name="${cat.name}", type="${cat.type}", bucket="${bucket}", subcategories=[${subs}]`
      })
      .join('\n')

    // =========================================================================
    // CASO A: MODO PDF (rawText da fatura de cartão de crédito)
    // =========================================================================
    if (isPdfMode) {
      const rawText = body.rawText!.trim()
      const currentYear = new Date().getFullYear()

      const pdfSystemPrompt = `Você é o especialista sênior em inteligência financeira do Curiangoo (Curiangoo Copilot), especializado na leitura e extração exaustiva de faturas de cartão de crédito brasileiras (Rico, XP, Nubank, Inter, Itaú, Santander, C6 Bank, Bradesco, BTG Pactual, etc.) e na regra orçamentária 50/30/20.

Seu objetivo é analisar o texto bruto extraído de um trecho/página de fatura de cartão de crédito e extrair com MÁXIMA PRECISÃO E COMPLETUDE ABSOLUTA TODAS as compras e estornos reais, atribuindo a cada uma a categoria e subcategoria mais adequada do catálogo da família.

CATÁLOGO REAL DE CATEGORIAS DA FAMÍLIA:
${catalogPrompt}

REGRAS CRÍTICAS DE EXTRAÇÃO DE FATURA:
1. COMPLETUDE ABSOLUTA E NÃO-TRUNCAMENTO (REGRA MÁXIMA):
   - Percorra o texto até o fim, não pare antes da última linha da última página. Se houver limite, extraia o máximo e nunca interrompa silenciosamente no meio.
   - NÃO pare até a última linha de compras. É PROIBIDO parar após 10 ou 15 lançamentos se houver mais linhas no texto.
   - Nunca omita linhas de transações por resumo, cansaço ou limite de amostragem.
   - Cada compra, parcela ou estorno individual DEVE virar um objeto no array "transactions".

2. O QUE EXTRAIR:
   - Todas as compras de bens e serviços nacionais e internacionais (ex: "UBER", "IFOOD", "MERCADO LIVRE", "DROGASIL", "NETFLIX", "POSTO", "CARREFOUR", "PAG*...", compras físicas e online).
   - Compras parceladas (identificar o sufixo ou padrão de parcela, ex: "02/10", "3/12").
   - Estornos e reembolsos reais (marcar amountCents com o valor positivo e type="income").

3. O QUE DESCARTAR ABSOLUTAMENTE (NÃO SÃO COMPRAS NEM DESPESAS DO MÊS):
   - Pagamentos da fatura anterior e quitações: linhas como "Pagamento recebido em…", "Pagamento de fatura", "Pagamento efetuado", "Pagamento de título", "Pagamento mínimo", "Pagamento parcial", "Pagto fatura", "Aut. Pagto", "Quitação de fatura". Elas NÃO são despesas novas do mês, representam quitação de fatura passada e DEVEM SER COMPLETAMENTE DESCARTADAS.
   - Cabeçalhos e rodapés institucionais, dados do titular, agência, conta, CNPJ/CPF, endereços e CEP.
   - Telefones, SAC, WhatsApp, Ouvidoria (ex: "0800", "3003", "4004").
   - Limites de crédito (ex: "Limite Total", "Limite Disponível", "Limite Utilizado", "Limite de Saque").
   - Tabelas de cotação de dólar ou pontos de fidelidade.

4. TOTAL DECLARADO DA FATURA ("declaredTotalCents"):
   - Se o trecho contiver o resumo/cabeçalho da fatura indicando o total a pagar da fatura (ex: "Total da fatura R$ 1.250,50", "Valor total da fatura: 1.250,50", "Total desta fatura: R$ 850,00", "Total a pagar: R$ ..."), capture esse valor em centavos (número inteiro positivo) na propriedade "declaredTotalCents".
   - Se este trecho NÃO contiver o total geral declarado da fatura (por exemplo, página do meio com apenas lançamentos), retorne null para "declaredTotalCents".

5. EXEMPLO FEW-SHOT DE EXTRAÇÃO E DESCARTE CORRETO:
   Texto de entrada:
   """
   03/02 PAGAMENTO RECEBIDO EM 03/02/2025 -R$ 1.500,00
   05/02 DROGASIL SAO PAULO 01/03 R$ 89,90
   07/02 UBER *TRIP SAO PAULO R$ 24,50
   Total da fatura: R$ 114,40
   """
   Saída JSON esperada:
   {
     "declaredTotalCents": 11440,
     "transactions": [
       {
         "date": "2025-02-05",
         "description": "DROGASIL SAO PAULO 01/03",
         "cleanMerchant": "Drogasil",
         "amountCents": 8990,
         "type": "expense",
         "installment": "01/03",
         "categoryId": "UUID_SAUDE",
         "subcategoryId": null,
         "confidence": 0.95
       },
       {
         "date": "2025-02-07",
         "description": "UBER *TRIP SAO PAULO",
         "cleanMerchant": "Uber",
         "amountCents": 2450,
         "type": "expense",
         "installment": null,
         "categoryId": "UUID_TRANSPORTE",
         "subcategoryId": null,
         "confidence": 0.95
       }
     ]
   }
   (Observe que a linha "PAGAMENTO RECEBIDO EM..." FOI CORRETAMENTE DESCARTADA e NÃO apareceu no array transactions!).

6. PADRONIZAÇÃO DOS DADOS DE CADA TRANSAÇÃO:
   - "date": string no formato ISO "AAAA-MM-DD" (se o ano não constar explicitamente no lançamento, use o ano da fatura indicado no texto ou ${currentYear}).
   - "description": descrição original completa encontrada no extrato (incluindo parcelas se houver).
   - "cleanMerchant": nome limpo e legível do estabelecimento comercial sem intermediários ruidosos ou parcelas.
   - "amountCents": número inteiro positivo em centavos (ex: R$ 45,90 vira 4590; R$ 1.250,00 vira 125000). NUNCA usar decimais.
   - "type": "expense" para compras (padrão de cartão) ou "income" para estornos/créditos.
   - "installment": string com a parcela quando houver (ex: "02/10", "1/3") ou null se for compra à vista.
   - "categoryId": ID UUID exato da categoria selecionada no catálogo da família acima.
   - "subcategoryId": ID UUID da subcategoria do catálogo, ou null se nenhuma for aplicável.
   - "confidence": número entre 0.0 e 1.0 indicando a certeza da classificação.

RETORNO ESTRITAMENTE OBRIGATÓRIO:
Você DEVE responder exclusivamente com um objeto JSON válido (response_format: json_object) com as chaves "declaredTotalCents" (número em centavos ou null) e "transactions" (array de itens):
{
  "declaredTotalCents": 125050,
  "transactions": [ ... ]
}`

      const pdfUserPrompt = `Texto bruto extraído da fatura em PDF:
--- INÍCIO DO TEXTO ---
${rawText.slice(0, 100000)}
--- FIM DO TEXTO ---

Instruções cruciais:
1. Percorra o texto até o fim, não pare antes da última linha da última página; se houver limite, extraia o máximo e sinalize. Extraia TODOS os lançamentos sem exceção e sem truncamento — nunca pare após 10-15 itens se houver mais linhas de compra no texto.
2. Se houver total geral declarado da fatura no texto (ex: "Total desta fatura", "Total a pagar", "Total da fatura"), capture em declaredTotalCents (número inteiro positivo em centavos), senão retorne null.
3. Descarte pagamentos anteriores de fatura (ex: "Pagamento recebido em...", "Pagamento de fatura", "Pagamento efetuado"), pois são quitações anteriores e não despesas novas.
4. Classifique cada transação usando IDs válidos do catálogo familiar.`
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: pdfSystemPrompt },
            { role: 'user', content: pdfUserPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      })

      if (!openaiRes.ok) {
        const errText = await openaiRes.text()
        console.error('OpenAI API Error in batch-categorize (PDF mode):', openaiRes.status, errText)
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
      const declaredTotalCents: number | null =
        typeof rawDeclaredTotal === 'number' && rawDeclaredTotal > 0
          ? Math.round(rawDeclaredTotal)
          : null

      // Higienizar e validar transações contra o catálogo real
      const sanitizedTransactions: PdfExtractedTransactionItem[] = []
      for (const item of rawItems) {
        if (!item || typeof item !== 'object') continue

        // Validar campos mínimos
        const amount =
          typeof item.amountCents === 'number' ? Math.round(Math.abs(item.amountCents)) : 0
        if (amount <= 0) continue

        const desc = String(item.description || item.cleanMerchant || '').trim()
        if (!desc) continue

        // Validar data no formato AAAA-MM-DD
        let date = String(item.date || '').trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          // Fallback para data atual se a IA errou formato
          date = new Date().toISOString().slice(0, 10)
        }

        // Categoria: verificar se existe no catálogo da família
        let catId = String(item.categoryId || '')
        let subId: string | null = item.subcategoryId ? String(item.subcategoryId) : null

        if (!validCategoryIds.has(catId)) {
          // Se a IA gerou um UUID inválido, usa a primeira categoria compatível de despesa da família
          const fallbackCat =
            categoriesList.find((c: any) => c.type === 'expense') || categoriesList[0]
          catId = fallbackCat?.id || ''
          subId = null
        } else {
          // Se a subcategoria não pertencer a essa categoria, anula
          const allowedSubs = catToSubsMap.get(catId)
          if (!subId || !allowedSubs || !allowedSubs.has(subId)) {
            subId = null
          }
        }

        sanitizedTransactions.push({
          date,
          description: desc,
          cleanMerchant: String(item.cleanMerchant || desc).trim(),
          amountCents: amount,
          type: item.type === 'income' ? 'income' : 'expense',
          installment: item.installment ? String(item.installment).trim() : undefined,
          categoryId: catId,
          subcategoryId: subId,
          confidence:
            typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.85,
        })
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
    const transactions = rawTransactions
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
      console.error('OpenAI API Error in batch-categorize (batch mode):', openaiRes.status, errText)
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
      console.error(
        'Falha ao parsear JSON da OpenAI em batch-categorize (batch mode):',
        parseErr,
        content,
      )
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

    const sanitizedSuggestions: AiCategorizationResultItem[] = []
    for (const item of rawSuggestions) {
      if (!item || !item.tempId || !item.categoryId) continue

      // Garantir que a categoryId pertença ao catálogo real da família
      if (!validCategoryIds.has(item.categoryId)) {
        continue
      }

      const allowedSubs = catToSubsMap.get(item.categoryId)
      const subId =
        item.subcategoryId && allowedSubs && allowedSubs.has(item.subcategoryId)
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
