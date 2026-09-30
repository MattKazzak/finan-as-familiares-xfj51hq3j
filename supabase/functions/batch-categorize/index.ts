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

      const pdfSystemPrompt = `Você é o especialista sênior em inteligência financeira do Curiangoo (Curiangoo Copilot), especializado na leitura e extração exaustiva de faturas de cartão de crédito de qualquer banco brasileiro (Rico, XP, Nubank, Inter, Itaú, Santander, C6 Bank, Bradesco, BTG Pactual, etc.) e na regra orçamentária 50/30/20.

Seu objetivo é analisar o texto bruto extraído de um trecho/página de fatura de cartão de crédito e extrair com MÁXIMA PRECISÃO E COMPLETUDE ABSOLUTA TODAS as compras e estornos reais, atribuindo a cada uma a categoria e subcategoria mais adequada do catálogo da família.

CATÁLOGO REAL DE CATEGORIAS DA FAMÍLIA:
${catalogPrompt}

REGRAS CRÍTICAS DE EXTRAÇÃO UNIVERSAL:

1. SUPORTE A MÚLTIPLOS CARTÕES E SEÇÕES (CASO RICO/XP E ADICIONAIS - CRÍTICO):
   - Uma fatura frequentemente contém compras divididas por múltiplos cartões (ex.: Titular final 4949 e Adicional final 010).
   - Na fatura da Rico, lançamentos do cartão final 010 (ex.: JUSTI FERRAMENTARIA, AMERICANOS CELULA, SUPRILAR, SMARTINS, AUTO POSTO, etc., somando R$ 1.328,07) DEVEM ser extraídos obrigatoriamente junto com os do cartão principal (final 4949).
   - A existência de subtotais parciais (ex.: "Subtotal Cartão final 4949: R$ 3.221,84", "Total deste cartão", "Subtotal do cartão") NUNCA ENCERRA A LEITURA. É TERMINANTEMENTE PROIBIDO parar a leitura após um subtotal ou após o primeiro cartão! Percorra todos os blocos, cartões titulares e adicionais até a última linha do texto.
   - Descarte EXCLUSIVAMENTE a linha de pagamento de fatura anterior (ex.: "Pagamento de fatura -5.443,36", "Pagamento recebido -R$ 1.500,00"), preservando intactas TODAS as compras legítimas que estiverem na mesma página ou nas seguintes. O pagamento de fatura anterior NUNCA encerra a leitura da página.

2. TRATAMENTO UNIVERSAL DE MOEDA E CÂMBIO (NUBANK, C6, ITAÚ, INTER, SANTANDER):
   - Em compras internacionais, o extrato costuma exibir cotação da moeda, linha em moeda estrangeira (ex.: "USD 12.50", "US$ 15,00", "EUR 8,00") e linha convertida em Reais (BRL, ex.: "R$ 72,40").
   - Capture APENAS o valor final convertido em Reais (BRL) que compõe o saldo devido da fatura.
   - IGNORE rigorosamente as linhas informativas de cotação e valores em dólar/euro (US$, USD, EUR) para NÃO duplicar lançamentos. Nunca gere dois lançamentos para a mesma despesa internacional.

3. DESCARTE ESTRITO DE NÃO-DESPESAS:
   - Descarte automaticamente:
     a) Pagamentos de fatura recebidos / quitações passadas ("Pagamento de fatura", "Pagamento recebido", "Pagto efetuado", "Aut. Pagto", "Quitação").
     b) Limites totais, limites disponíveis, limites utilizados, limites de saque.
     c) Resumos de saldo financiado, crédito rotativo, juros futuros e encargos projetados.
     d) Opções de parcelamento de fatura futura ("Parcele sua fatura em 12x", "Entrada + parcelas").
     e) Tabelas de juros, CET mensal/anual, cotações informativas de dólar e saldo de pontos/milhas.
   - CAPTURE:
     a) Compras legítimas de bens e serviços nacionais e internacionais.
     b) Compras parceladas, identificando explicitamente o padrão de parcela (ex.: "01/03", "2/12", "03/10", "PARC 02/06").
     c) Estornos e reembolsos reais (marcar amountCents com o valor positivo do estorno e type="income").

4. TOTAL DECLARADO DA FATURA ("declaredTotalCents"):
   - Se o trecho contiver o cabeçalho ou resumo geral com o VALOR TOTAL DEVIDO DA FATURA (ex.: "Total a pagar: R$ 4.549,91", "Valor total da fatura: R$ 4.549,91", "Total desta fatura: R$ 4.549,91", "Saldo atual: R$ ..."), capture esse valor total geral consolidado em centavos (número inteiro positivo) na propriedade "declaredTotalCents".
   - ATENÇÃO: NÃO confunda subtotais parciais de cartões individuais (ex.: "Subtotal cartão 4949: R$ 3.221,84") com o total geral da fatura. Declare apenas o total geral consolidado da fatura inteira. Se a página contiver apenas subtotais parciais ou for página intermediária sem o total geral da fatura, retorne null para "declaredTotalCents".

5. EXEMPLO FEW-SHOT DE FATURA MULTI-CARTÃO E CÂMBIO:
   Texto de entrada:
   """
   BANCO RICO / XP INVESTIMENTOS
   Total da Fatura: R$ 4.549,91   Vencimento: 10/03/2025
   Limite Total: R$ 20.000,00     Limite Disponível: R$ 15.450,09

   Lançamentos Cartão Final 4949 (Titular)
   02/02 PAGAMENTO DE FATURA -5.443,36
   05/02 AMAZON.COM.BR 01/03 R$ 300,00
   08/02 SPOTIFY US$ 4.00
   08/02 SPOTIFY (Câmbio 5,50 + IOF) R$ 23,20
   10/02 POSTO SHELL R$ 150,00
   Subtotal Cartão 4949: R$ 473,20

   Lançamentos Cartão Final 010 (Adicional)
   12/02 DROGASIL 2/12 R$ 85,50
   14/02 ESTORNO COMPRA CANCELADA -R$ 45,00
   Subtotal Cartão 010: R$ 40,50
   Opções de Parcelamento de Fatura: Em até 24x de R$ 280,00
   """

   Saída JSON esperada:
   {
     "declaredTotalCents": 454991,
     "transactions": [
       {
         "date": "2025-02-05",
         "description": "AMAZON.COM.BR 01/03",
         "cleanMerchant": "Amazon",
         "amountCents": 30000,
         "type": "expense",
         "installment": "01/03",
         "categoryId": "UUID_LIFESTYLE",
         "subcategoryId": null,
         "confidence": 0.95
       },
       {
         "date": "2025-02-08",
         "description": "SPOTIFY (Câmbio 5,50 + IOF)",
         "cleanMerchant": "Spotify",
         "amountCents": 2320,
         "type": "expense",
         "installment": null,
         "categoryId": "UUID_LIFESTYLE",
         "subcategoryId": null,
         "confidence": 0.95
       },
       {
         "date": "2025-02-10",
         "description": "POSTO SHELL",
         "cleanMerchant": "Posto Shell",
         "amountCents": 15000,
         "type": "expense",
         "installment": null,
         "categoryId": "UUID_TRANSPORTE",
         "subcategoryId": null,
         "confidence": 0.95
       },
       {
         "date": "2025-02-12",
         "description": "DROGASIL 2/12",
         "cleanMerchant": "Drogasil",
         "amountCents": 8550,
         "type": "expense",
         "installment": "2/12",
         "categoryId": "UUID_SAUDE",
         "subcategoryId": null,
         "confidence": 0.95
       },
       {
         "date": "2025-02-14",
         "description": "ESTORNO COMPRA CANCELADA",
         "cleanMerchant": "Estorno Compra Cancelada",
         "amountCents": 4500,
         "type": "income",
         "installment": null,
         "categoryId": "UUID_LIFESTYLE",
         "subcategoryId": null,
         "confidence": 0.90
       }
     ]
   }
   (A linha "PAGAMENTO DE FATURA -5.443,36" foi descartada mas as compras da página continuaram; a linha em US$ 4.00 foi ignorada e apenas a linha em BRL de R$ 23,20 virou lançamento; os subtotais parciais NÃO interromperam a leitura do cartão adicional; o total geral de 4.549,91 foi capturado sem confusão com os subtotais parciais).

6. INTELIGÊNCIA SEMÂNTICA, BALDES ORÇAMENTÁRIOS (50/30/20) E INFOPRODUTOS (CRÍTICO):
   - Mapeamento dos 3 baldes orçamentários:
     * Balde "essentials" (Essenciais): reservado EXCLUSIVAMENTE para necessidades vitais fundamentais da família (moradia/aluguel/condomínio, energia elétrica, água, gás, supermercado básico de subsistência, transporte essencial pendular e saúde/remédios vitais).
     * Balde "lifestyle" (Estilo de Vida): gastos com desejos, lazer, compras livres, vestuário, restaurantes/delivery, streamings, viagens e bem-estar.
     * Balde "future" (Futuro): previdência privada, aportes, investimentos e reservas financeiras.
   - REGRA DE OURO PARA INFOPRODUTOS, CURSOS E PLATAFORMAS DIGITAIS:
     * Cursos livres, treinamentos, mentorias, infoprodutos, e-books, livros e plataformas de conteúdo (ex.: CPT, Cursos CPT, Hotmart, Kiwify, Eduzz, Instagram Milionário, Udemy, Coursera, Alura, Rocketseat, Empiricus, cursos de marketing, etc.) JAMAIS podem ser classificados como "Moradia", "Alimentação", "Supermercado" ou gastos essenciais vitais.
     * Se o catálogo da família tiver uma categoria do tipo "Educação" ou "Desenvolvimento" (seja ela essentials ou lifestyle), atribua a ela.
     * Caso a família NÃO possua categoria específica de Educação/Desenvolvimento, classifique OBRIGATORIAMENTE em uma categoria pertencente ao balde "lifestyle" (como "Outros", "Serviços", "Lazer", "Assinaturas" ou similar) — NUNCA em necessidades básicas de sobrevivência ("Moradia", "Alimentação").

7. PADRONIZAÇÃO DOS DADOS DE CADA TRANSAÇÃO:
   - "date": string no formato ISO "AAAA-MM-DD" (se o ano não constar explicitamente no lançamento, use o ano da fatura indicado no texto ou ${currentYear}).
   - "description": descrição original completa encontrada no extrato (incluindo sufixos de parcela se houver).
   - "cleanMerchant": nome legível do estabelecimento comercial sem abreviações abusivas (ex: "CURSOS CPT", "INSTAGRAM MILIONÁRIO", "AMAZON", "UBER") para fácil reconhecimento do usuário.
   - "amountCents": número inteiro positivo em centavos (ex: R$ 45,90 vira 4590; R$ 1.250,00 vira 125000). NUNCA usar decimais.
   - "type": "expense" para compras normais ou "income" para estornos e reembolsos.
   - "installment": string com a parcela identificada (ex: "01/03", "2/12", "03/10") ou null se à vista.
   - "categoryId": ID UUID exato da categoria selecionada no catálogo da família acima.
   - "subcategoryId": ID UUID da subcategoria do catálogo, ou null se nenhuma for aplicável.
   - "confidence": número entre 0.0 e 1.0 indicando a certeza da classificação.

RETORNO ESTRITAMENTE OBRIGATÓRIO:
Você DEVE responder exclusivamente com um objeto JSON válido (response_format: json_object) com as chaves "declaredTotalCents" (número inteiro em centavos ou null) e "transactions" (array de itens):
{
  "declaredTotalCents": 454991,
  "transactions": [ ... ]
}`

      const pdfUserPrompt = `Texto bruto extraído da fatura em PDF:
--- INÍCIO DO TEXTO ---
${rawText.slice(0, 100000)}
--- FIM DO TEXTO ---

Instruções cruciais:
1. PERCORRA O TEXTO ATÉ O FIM ABSOLUTO (SUPORTE A MÚLTIPLOS CARTÕES):
   - Percorra todos os cartões (titular e adicionais) sem interromper a leitura em subtotais intermediários.
   - Na fatura da Rico em teste, certifique-se de extrair todos os lançamentos do cartão final 010 (JUSTI FERRAMENTARIA, AMERICANOS CELULA, SUPRILAR, SMARTINS, AUTO POSTO, etc., somando R$ 1.328,07) junto com o cartão principal 4949.
   - Descarte EXCLUSIVAMENTE a linha de pagamento de fatura anterior (ex.: "Pagamento de fatura -5.443,36"), preservando intactas todas as compras que estiverem na mesma página.
2. TRATAMENTO DE MOEDA E CÂMBIO:
   - Em compras internacionais (Nubank, C6, Itaú, etc.), ignore linhas informativas de cotação em dólar (US$) ou euro (EUR), capturando apenas a conversão em reais para despesas internacionais.
3. DESCARTE DE NÃO-DESPESAS:
   - Descarte quitações passadas, limites de crédito, parcelamentos de fatura futura e encargos rotativos informativos. Capture compras, parcelas (ex.: "01/03", "2/12") e estornos com type="income".
4. TOTAL GERAL DECLARADO:
   - Capture o total geral devido da fatura inteira em declaredTotalCents (número inteiro positivo em centavos). Não confunda subtotais parciais de cartões individuais com o total geral da fatura. Se a página contiver apenas subtotais parciais ou não trouxer o total geral consolidado, retorne null.
5. Classifique cada transação usando IDs válidos do catálogo familiar.`

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

      // Helper para sanitizar transações
      const sanitizeItems = (rawItems: any[]): PdfExtractedTransactionItem[] => {
        const sanitized: PdfExtractedTransactionItem[] = []
        for (const item of rawItems) {
          if (!item || typeof item !== 'object') continue

          const amount =
            typeof item.amountCents === 'number' ? Math.round(Math.abs(item.amountCents)) : 0
          if (amount <= 0) continue

          const desc = String(item.description || item.cleanMerchant || '').trim()
          if (!desc) continue

          let date = String(item.date || '').trim()
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            date = new Date().toISOString().slice(0, 10)
          }

          let catId = String(item.categoryId || '')
          let subId: string | null = item.subcategoryId ? String(item.subcategoryId) : null

          if (!validCategoryIds.has(catId)) {
            const fallbackCat =
              categoriesList.find((c: any) => c.type === 'expense') || categoriesList[0]
            catId = fallbackCat?.id || ''
            subId = null
          } else {
            const allowedSubs = catToSubsMap.get(catId)
            if (!subId || !allowedSubs || !allowedSubs.has(subId)) {
              subId = null
            }
          }

          sanitized.push({
            date,
            description: desc,
            cleanMerchant: String(item.cleanMerchant || desc).trim(),
            amountCents: amount,
            type: item.type === 'income' ? 'income' : 'expense',
            installment: item.installment ? String(item.installment).trim() : undefined,
            categoryId: catId,
            subcategoryId: subId,
            confidence:
              typeof item.confidence === 'number'
                ? Math.min(1, Math.max(0, item.confidence))
                : 0.85,
          })
        }
        return sanitized
      }

      const openaiRes = await callOpenAiExtraction(pdfSystemPrompt, pdfUserPrompt)

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
      let declaredTotalCents: number | null =
        typeof rawDeclaredTotal === 'number' && rawDeclaredTotal > 0
          ? Math.round(rawDeclaredTotal)
          : null

      let sanitizedTransactions = sanitizeItems(rawItems)

      // =========================================================================
      // AUTOCORREÇÃO MATEMÁTICA INTERNA TRANSPARENTE:
      // Se a soma das transações extraídas divergir do declaredTotalCents identificado,
      // executa uma segunda passada no texto bruto enviado para capturar seções ou
      // cartões remanescentes (ex.: cartão adicional final 010 da Rico ou blocos omitidos).
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

        // Se houver divergência relevante (> 5 centavos)
        if (diffCents > 5) {
          console.warn(
            `[batch-categorize] Divergência detectada no fechamento: soma=${currentNetSum} vs declarado=${declaredTotalCents} (dif=${diffCents} centavos). Iniciando autocorreção matemática interna...`,
          )

          try {
            const recoveryUserPrompt = `Texto bruto extraído da fatura em PDF:
--- INÍCIO DO TEXTO ---
${rawText.slice(0, 100000)}
--- FIM DO TEXTO ---

ATENÇÃO: AUTOCORREÇÃO MATEMÁTICA ATIVADA!
A extração anterior somou ${currentNetSum} centavos, mas o valor total declarado no cabeçalho da fatura é de exatamente ${declaredTotalCents} centavos (diferença de ${diffCents} centavos).

Possíveis causas que você DEVE corrigir agora:
1. CARTÕES ADICIONAIS OU SEGUNDO BLOCO OMITIDOS:
   - Verifique minuciosamente se há outros cartões no texto (ex.: Titular final 4949 e Adicional final 010).
   - Na fatura da Rico, lançamentos do cartão final 010 (ex.: JUSTI FERRAMENTARIA, AMERICANOS CELULA, SUPRILAR, SMARTINS, AUTO POSTO, somando R$ 1.328,07) NÃO PODEM FICAR DE FORA!
2. SUBTOTAIS INTERMEDIÁRIOS NÃO ENCERRAM A LEITURA:
   - A leitura NÃO PODE parar após "Subtotal Cartão final 4949" ou qualquer outro subtotal.
3. DESCARTE APENAS PAGAMENTO ANTERIOR:
   - Apenas linhas como "Pagamento de fatura -5.443,36" são descartadas. Todas as compras daquela mesma página continuam ativas!
4. CÂMBIO INTERNACIONAL:
   - Capture apenas o valor em BRL convertido. Ignore as linhas em US$.

Transações já capturadas na primeira passada (${sanitizedTransactions.length} itens):
${JSON.stringify(
  sanitizedTransactions.map((t) => ({
    date: t.date,
    desc: t.description,
    cents: t.amountCents,
  })),
)}

INSTRUÇÃO DA SEGUNDA PASSADA:
Percorra novamente o texto do início ao fim e extraia a LISTA COMPLETA E EXAUSTIVA de TODAS as transações reais da fatura inteira para que a soma feche exatamente com os ${declaredTotalCents} centavos do total declarado. Retorne o objeto JSON no mesmo formato:
{
  "declaredTotalCents": ${declaredTotalCents},
  "transactions": [ ... ]
}`

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

                // Se a nova passada melhorou o fechamento ou trouxe mais itens que completam a conta, adota
                if (
                  recoveredDiff < diffCents ||
                  recoveredSanitized.length > sanitizedTransactions.length
                ) {
                  console.info(
                    `[batch-categorize] Autocorreção bem-sucedida! De ${sanitizedTransactions.length} para ${recoveredSanitized.length} transações. Nova diferença: ${recoveredDiff} centavos.`,
                  )
                  sanitizedTransactions = recoveredSanitized
                }
              }
            }
          } catch (recoveryErr) {
            console.warn(
              '[batch-categorize] Erro durante autocorreção matemática interna:',
              recoveryErr,
            )
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
4. INTELIGÊNCIA SEMÂNTICA, BALDES ORÇAMENTÁRIOS E INFOPRODUTOS (CRÍTICO):
   - Mapeamento dos 3 baldes:
     * "essentials": reservado EXCLUSIVAMENTE para necessidades genuinamente vitais da família (moradia/aluguel/condomínio, energia, água, supermercado básico, transporte essencial e saúde vital).
     * "lifestyle": gastos com desejos, lazer, cursos livres, infoprodutos, streamings, delivery, restaurantes, vestuário e bem-estar.
     * "future": investimentos, aportes, previdência e poupança.
   - REGRA DE OURO PARA INFOPRODUTOS, CURSOS E PLATAFORMAS DIGITAIS:
     * Infoprodutos, cursos, treinamentos, mentorias, livros e plataformas de conteúdo (ex.: CPT, Cursos CPT, Hotmart, Kiwify, Eduzz, Instagram Milionário, Udemy, Coursera, Alura, Rocketseat, Empiricus, etc.) JAMAIS devem ser classificados como "Moradia" ou "Alimentação".
     * Se a família tiver uma categoria "Educação" ou "Desenvolvimento", use nela.
     * Caso NÃO possua categoria de Educação/Desenvolvimento, classifique OBRIGATORIAMENTE no balde Estilo de Vida ("lifestyle", ex.: "Outros", "Serviços", "Lazer", "Assinaturas") — NUNCA em necessidades básicas de sobrevivência.
5. NÍVEL DE CONFIANÇA E REASONING:
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
