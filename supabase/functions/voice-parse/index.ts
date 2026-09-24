import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface PreviousContextPayload {
  descricao?: string
  estabelecimento?: string | null
  categoria?: string
  subcategoria?: string
  balde?: string
  tipo?: 'despesa' | 'receita'
}

interface CategoryPayloadItem {
  id?: string
  name: string
  type: string
  budget_bucket?: string | null
  subcategories?: Array<{ id?: string; name: string }>
}

interface RequestPayload {
  texto?: string
  familyId?: string
  contexto_anterior?: PreviousContextPayload | null
  categorias?: CategoryPayloadItem[] | null
}

function formatCentsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
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
          status: 'invalido',
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel: 'Sessão não autenticada. Faça login novamente.',
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
          status: 'invalido',
          error: 'OPENAI_API_KEY_NOT_CONFIGURED',
          error_detail: 'Chave OPENAI_API_KEY não configurada no backend Supabase.',
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel: 'Chave de inteligência artificial não configurada no servidor.',
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

    // Obter usuário da sessão
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          status: 'invalido',
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel: 'Sessão expirada. Faça login novamente.',
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
          status: 'invalido',
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel: 'Texto não informado.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const texto = body.texto?.trim()
    if (!texto) {
      return new Response(
        JSON.stringify({
          status: 'invalido',
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel: 'Não consegui ouvir nada. Toque no microfone e tente falar novamente!',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Buscar família se não vier no body
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

    // Buscar dados financeiros reais caso o usuário faça consultas financeiras
    // Datas de referência do mês atual e últimos 7 dias
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonthNum = now.getMonth() + 1
    const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}-01`
    const nextMonthStr = `${now.getMonth() === 11 ? currentYear + 1 : currentYear}-${String(
      ((now.getMonth() + 1) % 12) + 1,
    ).padStart(2, '0')}-01`

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)

    // Buscar categorias e subcategorias (se não vierem completas no body ou mesclar)
    let categoriesList: any[] = []
    if (Array.isArray(body.categorias) && body.categorias.length > 0) {
      categoriesList = body.categorias.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        budget_bucket: c.budget_bucket,
        transaction_subcategories: (c.subcategories || []).map((s) => ({ id: s.id, name: s.name })),
      }))
    } else {
      let categoriesQuery = supabase
        .from('transaction_categories')
        .select('id, name, type, budget_bucket, transaction_subcategories(id, name)')
        .order('sort_order', { ascending: true })

      if (targetFamilyId) {
        categoriesQuery = categoriesQuery.eq('family_id', targetFamilyId)
      }
      const { data: categoriesData } = await categoriesQuery
      categoriesList = categoriesData || []
    }

    // Buscar membros da família
    let membersQuery = supabase.from('family_members').select('id, name, is_admin')
    if (targetFamilyId) {
      membersQuery = membersQuery.eq('family_id', targetFamilyId)
    }
    const { data: membersData } = await membersQuery

    // Buscar família com monthly_net_income_cents
    let familyData: any = null
    if (targetFamilyId) {
      const { data: fam } = await supabase
        .from('families')
        .select('id, name, monthly_net_income_cents')
        .eq('id', targetFamilyId)
        .maybeSingle()
      familyData = fam
    }

    // Buscar transações do mês corrente
    let monthTransactionsQuery = supabase
      .from('transactions')
      .select(
        'id, amount_cents, type, description, transaction_date, category_id, transaction_categories(name, budget_bucket)',
      )
      .gte('transaction_date', currentMonthStr)
      .lt('transaction_date', nextMonthStr)
      .eq('status', 'confirmed')

    if (targetFamilyId) {
      monthTransactionsQuery = monthTransactionsQuery.eq('family_id', targetFamilyId)
    }
    const { data: monthTransactions } = await monthTransactionsQuery

    // Buscar transações dos últimos 7 dias para consultas como "maior gasto da semana"
    let recentTransactionsQuery = supabase
      .from('transactions')
      .select('id, amount_cents, type, description, transaction_date, transaction_categories(name)')
      .gte('transaction_date', sevenDaysAgoStr)
      .eq('type', 'expense')
      .eq('status', 'confirmed')
      .order('amount_cents', { ascending: false })
      .limit(5)

    if (targetFamilyId) {
      recentTransactionsQuery = recentTransactionsQuery.eq('family_id', targetFamilyId)
    }
    const { data: topWeekExpenses } = await recentTransactionsQuery

    // Buscar orçamentos (budgets ou default_budgets)
    let budgetsQuery = supabase
      .from('budgets')
      .select('amount_cents, category_id, transaction_categories(name, budget_bucket)')
      .eq('month', currentMonthStr)

    if (targetFamilyId) {
      budgetsQuery = budgetsQuery.eq('family_id', targetFamilyId)
    }
    const { data: monthlyBudgets } = await budgetsQuery

    // Totais calculados
    let totalExpenseMonthCents = 0
    let totalIncomeMonthCents = 0
    const expensesByBucketCents = {
      essential: 0,
      lifestyle: 0,
      goals: 0,
    }

    ;(monthTransactions || []).forEach((tx: any) => {
      const amount = Number(tx.amount_cents || 0)
      if (tx.type === 'expense') {
        totalExpenseMonthCents += amount
        const bucket = tx.transaction_categories?.budget_bucket || 'lifestyle'
        if (bucket === 'essential' || bucket === 'essentials') {
          expensesByBucketCents.essential += amount
        } else if (bucket === 'goals' || bucket === 'future') {
          expensesByBucketCents.goals += amount
        } else {
          expensesByBucketCents.lifestyle += amount
        }
      } else if (tx.type === 'income') {
        totalIncomeMonthCents += amount
      }
    })

    // Orçamento total configurado (da tabela budgets ou da renda mensal)
    let totalBudgetConfiguredCents = 0
    ;(monthlyBudgets || []).forEach((b: any) => {
      totalBudgetConfiguredCents += Number(b.amount_cents || 0)
    })

    const netIncomeCents = Number(familyData?.monthly_net_income_cents || 0)
    const effectiveBudgetLimitCents =
      totalBudgetConfiguredCents > 0
        ? totalBudgetConfiguredCents
        : netIncomeCents > 0
          ? netIncomeCents
          : 0

    const remainingBudgetMonthCents =
      effectiveBudgetLimitCents > 0
        ? Math.max(0, effectiveBudgetLimitCents - totalExpenseMonthCents)
        : null

    const maiorGastoSemana =
      topWeekExpenses && topWeekExpenses.length > 0 ? topWeekExpenses[0] : null

    // Formatar contexto financeiro para a IA responder consultas
    const financialSummaryContext = `
DADOS FINANCEIROS REAIS DA FAMÍLIA (MÊS ATUAL: ${currentMonthStr.slice(0, 7)}):
- Total de despesas já realizadas este mês: ${formatCentsToBRL(totalExpenseMonthCents)} (em centavos: ${totalExpenseMonthCents})
  * Necessidades Essenciais: ${formatCentsToBRL(expensesByBucketCents.essential)}
  * Estilo de Vida: ${formatCentsToBRL(expensesByBucketCents.lifestyle)}
  * Metas & Investimentos: ${formatCentsToBRL(expensesByBucketCents.goals)}
- Total de receitas recebidas este mês: ${formatCentsToBRL(totalIncomeMonthCents)}
- Renda líquida mensal cadastrada da família: ${netIncomeCents > 0 ? formatCentsToBRL(netIncomeCents) : 'Não informada'}
- Teto de orçamento configurado para o mês: ${effectiveBudgetLimitCents > 0 ? formatCentsToBRL(effectiveBudgetLimitCents) : 'Sem teto fixo cadastrado'}
- Saldo restante disponível para gastar este mês: ${
      remainingBudgetMonthCents !== null
        ? `${formatCentsToBRL(remainingBudgetMonthCents)} (baseado no teto de ${formatCentsToBRL(effectiveBudgetLimitCents)})`
        : `Você já gastou ${formatCentsToBRL(totalExpenseMonthCents)} este mês. Recebeu ${formatCentsToBRL(totalIncomeMonthCents)}. O saldo atual do mês é ${formatCentsToBRL(totalIncomeMonthCents - totalExpenseMonthCents)}.`
    }
- Maior gasto dos últimos 7 dias: ${
      maiorGastoSemana
        ? `"${maiorGastoSemana.description || 'Gasto'}" no valor de ${formatCentsToBRL(Number(maiorGastoSemana.amount_cents || 0))} em ${maiorGastoSemana.transaction_date}${maiorGastoSemana.transaction_categories?.name ? ` (${maiorGastoSemana.transaction_categories.name})` : ''}`
        : 'Nenhum gasto registrado nos últimos 7 dias.'
    }
`

    // Formatar categorias e subcategorias para o System Prompt
    const categoriesContext = (categoriesList || [])
      .map((cat: any) => {
        const subs = (cat.transaction_subcategories || [])
          .map((s: any) => s.name || (s as any))
          .join(', ')
        return `- Categoria: "${cat.name}" (Tipo: ${cat.type}, Balde: ${cat.budget_bucket || 'lifestyle'}${subs ? `, Subcategorias existentes: [${subs}]` : ''})`
      })
      .join('\n')

    const membersContext = (membersData || []).map((m: any) => `"${m.name}"`).join(', ')

    const previousContext = body.contexto_anterior
    let previousContextPrompt = ''
    if (previousContext && (previousContext.descricao || previousContext.categoria)) {
      previousContextPrompt = `
CONTEXTO ANTERIOR DE UMA TRANSAÇÃO PARCIAL PENDENTE:
- Descrição anterior: "${previousContext.descricao || ''}"
- Estabelecimento anterior: "${previousContext.estabelecimento || ''}"
- Categoria anterior: "${previousContext.categoria || ''}"
- Subcategoria anterior: "${previousContext.subcategoria || ''}"
- Balde anterior: "${previousContext.balde || ''}"
- Tipo anterior: "${previousContext.tipo || 'despesa'}"

INSTRUÇÃO CRÍTICA PARA CONTEXTO ANTERIOR:
Se 'contexto_anterior' for fornecido e o usuário estiver informando apenas o valor ou forma de pagamento (ex: 'foi 80 reais', '80 no debito', '45 reais', 'paguei no pix 50', '80'), MESCLE as informações e retorne status 'sucesso' com a descrição do contexto anterior e o novo valor identificado.
Preserve a descrição, categoria, subcategoria, balde e estabelecimento anteriores, atualizando o valor e o método de pagamento conforme a nova fala.
`
    }

    const systemPrompt = `Você é o Curiangoo AI (Curiangoo Copilot), assistente financeiro inteligente do app Curiangoo para famílias brasileiras (Regra 50/30/20).
Seu papel é duplo:
1. PROCESSAR LANÇAMENTOS (fala/texto de gastos ou receitas) transformando-os em transação financeira com empatia e precisão.
2. RESPONDER PERGUNTAS RÁPIDAS / CONSULTAS FINANCEIRAS com base nos dados reais da família informados abaixo (ex: "quanto ainda posso gastar esse mês?", "qual foi o maior gasto dessa semana?", "quanto gastei de mercado?").

${previousContextPrompt}

${financialSummaryContext}

Metodologia de 3 Baldes Orçamentários:
1. "Necessidades Essenciais" (50%): moradia, aluguel, condomínio, luz, água, internet, supermercado, feira, açougue, saúde, remédios, plano de saúde, educação, transporte, combustível, Uber essencial, escola dos filhos.
2. "Estilo de Vida" (30%): restaurantes, almoço fora, bar, cerveja, pizza, hambúrguer, lanches, delivery/iFood, cinema, passeios, lazer, viagens, compras de roupas, cuidados pessoais, streaming (Netflix, Spotify), jogos.
3. "Metas & Investimentos" (20%): aportes, investimentos, poupança, reserva de emergência, ações, CDB, tesouro direto, previdência privada, metas de longo prazo.

Categorias e Subcategorias cadastradas no perfil da família:
${categoriesContext || 'Nenhuma categoria específica cadastrada ainda.'}

Membros da família cadastrados:
${membersContext || 'Membro padrão'}

REGRAS SEMÂNTICAS CRÍTICAS E PRIORIZAÇÃO REAL DE CATEGORIAS DA FAMÍLIA:
1. PRIORIDADE ABSOLUTA PARA SUBCATEGORIAS DE CATEGORIAS EXISTENTES:
  - A IA deve SEMPRE verificar primeiro se o gasto cabe como SUBCATEGORIA de uma categoria existente da família.
  - Exemplo: se a família já possui a categoria "Lazer" (ou "Estilo de Vida" / "Alimentação"), e o usuário fala "manicure 140 reais", a IA deve primeiro considerar perguntar se ele quer encaixar "Manicure" como subcategoria de "Lazer" antes de inventar uma categoria principal nova.
  - Exemplo 2: se a família tem "Transporte" e o usuário fala "troca de óleo 200 reais", deve encaixar em "Transporte" (subcategoria: "Troca de óleo") como "sucesso".
2. REGRA DE CRIAÇÃO DE NOVA CATEGORIA:
  - Só sugira criar uma categoria principal nova se realmente NÃO houver nenhuma categoria compatível no mesmo balde (50/30/20: Necessidades Essenciais / Estilo de Vida / Metas & Investimentos).
3. SERVIÇOS PESSOAIS, BELEZA, LAZER OU COMPRAS NUNCA DEVEM SER ALOCADOS EM CATEGORIAS FIXAS:
  - Exemplos: Manicure, cabeleireiro, massagem, unhas, depilação, barbearia, compras de roupas, maquiagem, cinema pertencem SEMPRE a "Estilo de Vida", NUNCA a "Moradia", "Contas Fixas", "Saúde Básica" ou "Educação Básica".
4. SE A DESPESA FOR CLARA COM VALOR, MAS NÃO HOUVER UMA CATEGORIA/SUBCATEGORIA DIRETA JÁ DEFINIDA:
  - O status DEVE SER OBRIGATORIAMENTE "clarificacao_categoria".
  - "tipo_resposta": "transacao"
  - "transacao": preencha a transação com descrição, valor (float positivo em reais), tipo ("despesa" ou "receita"), balde correto, subcategoria provisória (ex: "Manicure") e categoria nula ou provisória.
  - "mensagem_amigavel": "Identifiquei R$ [VALOR]! Onde prefere organizar esse gasto?"
  - "pergunta_clarificacao": "Onde prefere organizar esse lançamento?"
  - "opcoes_sugestao": exatamente DUAS sugestões pertinentes refletindo a priorização:
    * Se houver categoria existente da família compatível no mesmo balde: uma das opções DEVE ser encaixar como subcategoria dela no formato: "[Nome do Item] › dentro de [Categoria Existente] ([Balde])" (ex: "Manicure › dentro de Lazer (Estilo de Vida)").
    * A segunda opção pode ser uma categoria nova pertinente com seu balde (ex: "Cuidados Pessoais (Estilo de Vida)").
    * Se não houver categoria existente compatível no mesmo balde, apresente duas sugestões de novas categorias pertinentes com seus respectivos baldes entre parênteses.
Você DEVE responder EXCLUSIVAMENTE um objeto JSON válido (response_format: json_object) com o seguinte esquema:
{
  "status": "sucesso" | "clarificacao" | "clarificacao_categoria" | "falta_valor" | "invalido" | "consulta",
  "tipo_resposta": "transacao" | "consulta",
  "resposta_consulta": string | null,
  "transacao": {
    "descricao": string,
    "estabelecimento": string | null,
    "valor": number | null,
    "tipo": "despesa" | "receita",
    "balde": "Necessidades Essenciais" | "Estilo de Vida" | "Metas & Investimentos",
    "categoria": string | null,
    "subcategoria": string | null,
    "metodo_pagamento": "pix" | "debito" | "credito" | "dinheiro" | null
  } | null,
  "pergunta_clarificacao": string | null,
  "opcoes_sugestao": string[] | null,
  "mensagem_amigavel": string | null
}

Comportamentos esperados:
1. "consulta" (PERGUNTA / DÚVIDA / CONSULTA):
   - O usuário fez uma pergunta sobre as finanças (ex.: "quanto ainda posso gastar esse mês?", "quanto gastei essa semana?", "qual foi o maior gasto?", "como estão meus gastos?").
   - "status": "consulta"
   - "tipo_resposta": "consulta"
   - "transacao": null
   - "resposta_consulta": Resposta direta, acolhedora, concisa e precisa em português brasileiro com os valores exatos em R$ formatados a partir do resumo financeiro fornecido.
   - "mensagem_amigavel": O mesmo texto de resposta amigável.
   - NUNCA crie card de despesa para consultas.

2. "sucesso" (LANÇAMENTO COM VALOR E CATEGORIA JÁ EXISTENTE OU CLARA):
   - O usuário falou um gasto ou receita com valor (ex.: "almoço 45 reais no débito", "duas cervejas 80 reais", "salário de 5000 caiu").
   - A categoria correspondente JÁ CONSTA nas categorias cadastradas da família acima.
   - "status": "sucesso"
   - "tipo_resposta": "transacao"
   - Preencha todos os campos da "transacao". O campo "valor" deve ser um float positivo em reais (ex: 45.0 ou 80.0). Preencha "estabelecimento" se houver.
   - "categoria": nome exato de categoria existente ou compatível.
   - "subcategoria": use existente ou crie uma inteligente e específica.
   - "balde": classifique rigorosamente entre "Necessidades Essenciais", "Estilo de Vida" ou "Metas & Investimentos".

3. "clarificacao_categoria" (LANÇAMENTO CLARO, MAS CATEGORIA NÃO CADASTRADA DIRETAMENTE):
   - O usuário falou um gasto com valor compreensível (ex: "Manicure 140 reais", "Tatuagem 300 reais", "Personal trainer 200"), e não há correspondência direta com nenhuma categoria/subcategoria existente, OU há oportunidade de encaixar como subcategoria de uma categoria existente da família.
   - "status": "clarificacao_categoria"
   - "tipo_resposta": "transacao"
   - "transacao": preencha descricao, valor, balde correto, subcategoria provisória.
   - "mensagem_amigavel": "Identifiquei R$ [VALOR]! Onde prefere organizar?"
   - "opcoes_sugestao": DUAS opções pertinentes. Se existir categoria da família compatível no mesmo balde, ofereça encaixar como subcategoria dela (ex: "Manicure › dentro de Lazer (Estilo de Vida)") e a outra como categoria nova (ex: "Cuidados Pessoais (Estilo de Vida)").

4. "falta_valor" (LANÇAMENTO SEM VALOR):
   - O usuário citou um item ou compra claro (ex: "uma caixa de cerveja na parada certa", "almoço no restaurante", "gasolina no posto"), mas NÃO disse o valor monetário.
   - "status": "falta_valor"
   - "tipo_resposta": "transacao"
   - Preserve o item preenchendo "transacao" parcial com "valor": null.
   - "pergunta_clarificacao": "Quanto custou?"
   - "mensagem_amigavel": "Entendi: [Item]! Mas quanto custou?"

5. "clarificacao" (VALOR EXISTE, MAS DESCRIÇÃO TOTALMENTE AMBÍGUA OU GÍRIA):
   - Há um valor monetário identificado, mas o termo é ambíguo ou gíria sem sentido financeiro reconhecível (ex: "pindamonhangaba 8 reais").
   - "status": "clarificacao"
   - "tipo_resposta": "transacao"
   - Preencha o valor na transacao, elabore "pergunta_clarificacao" e exatamente 3 "opcoes_sugestao".

6. "invalido":
   - Ruído, conversa desconexa sem sentido financeiro nem pergunta.
   - "status": "invalido"`

    // Chamada à API da OpenAI
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
          { role: 'user', content: texto },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('OpenAI API Error:', openaiRes.status, errText)
      let errorMessage = `Erro OpenAI HTTP ${openaiRes.status}`
      try {
        const parsedErr = JSON.parse(errText)
        if (parsedErr?.error?.message) {
          errorMessage = `Erro OpenAI: ${parsedErr.error.message} (HTTP ${openaiRes.status})`
        }
      } catch {
        if (errText) {
          errorMessage = `Erro OpenAI (${openaiRes.status}): ${errText.slice(0, 100)}`
        }
      }

      return new Response(
        JSON.stringify({
          status: 'invalido',
          error: 'OPENAI_ERROR',
          error_detail: errorMessage,
          openai_status: openaiRes.status,
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel:
            'Houve uma instabilidade momentânea na inteligência de voz. Tente novamente!',
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const openAiData = await openaiRes.json()
    const content = openAiData.choices?.[0]?.message?.content

    let parsedAiJson: any = null
    try {
      parsedAiJson = JSON.parse(content || '{}')
    } catch (parseErr) {
      console.error('Falha ao parsear JSON da OpenAI:', parseErr, content)
      return new Response(
        JSON.stringify({
          status: 'invalido',
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel: 'Não foi possível processar a resposta da IA.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Normalização defensiva da resposta garantindo que os status e campos cheguem intactos
    const validStatuses = [
      'sucesso',
      'clarificacao',
      'clarificacao_categoria',
      'falta_valor',
      'invalido',
      'consulta',
    ]
    const status = validStatuses.includes(parsedAiJson?.status) ? parsedAiJson.status : 'invalido'

    const isConsulta = status === 'consulta' || parsedAiJson?.tipo_resposta === 'consulta'
    const respostaConsulta =
      parsedAiJson?.resposta_consulta || (isConsulta ? parsedAiJson?.mensagem_amigavel : null)

    const sanitizedResponse = {
      status,
      tipo_resposta: isConsulta ? 'consulta' : 'transacao',
      resposta_consulta: respostaConsulta,
      transacao: isConsulta ? null : (parsedAiJson?.transacao ?? null),
      pergunta_clarificacao: parsedAiJson?.pergunta_clarificacao ?? null,
      opcoes_sugestao: Array.isArray(parsedAiJson?.opcoes_sugestao)
        ? parsedAiJson.opcoes_sugestao
        : null,
      mensagem_amigavel: parsedAiJson?.mensagem_amigavel ?? respostaConsulta ?? null,
    }

    return new Response(JSON.stringify(sanitizedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Erro na edge function voice-parse:', err)
    return new Response(
      JSON.stringify({
        status: 'invalido',
        error: err?.message || 'INTERNAL_ERROR',
        error_detail: err?.message || 'Erro interno na Edge Function voice-parse',
        transacao: null,
        pergunta_clarificacao: null,
        opcoes_sugestao: null,
        mensagem_amigavel: 'Ocorreu um erro ao processar o áudio com IA.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
