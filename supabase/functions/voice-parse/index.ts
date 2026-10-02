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
  valor?: number | null
  status?: string | null
  opcoes_sugestao?: any[] | null
}

interface ChatMessagePayloadItem {
  role?: 'user' | 'assistant'
  content?: string
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
  historico_mensagens?: ChatMessagePayloadItem[] | null
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

    // Otimização de Performance (Bug 2):
    // Se a requisição for um lançamento de gasto/receita ou resposta de valor (contexto_anterior presente),
    // pule as consultas pesadas de extrato, últimos 7 dias e orçamentos.
    // Busque o resumo financeiro SOMENTE se a mensagem contiver termos consultivos explícitos.
    const normalizedText = texto.toLowerCase()
    const hasPreviousContext = Boolean(
      body.contexto_anterior &&
      (body.contexto_anterior.descricao ||
        body.contexto_anterior.valor ||
        body.contexto_anterior.categoria ||
        body.contexto_anterior.status),
    )

    const isConsultativeQuery =
      !hasPreviousContext &&
      (normalizedText.includes('quanto posso gastar') ||
        normalizedText.includes('quanto ainda posso') ||
        normalizedText.includes('posso gastar') ||
        normalizedText.includes('saldo') ||
        normalizedText.includes('gastos da semana') ||
        normalizedText.includes('gasto da semana') ||
        normalizedText.includes('maior gasto') ||
        normalizedText.includes('meus gastos') ||
        normalizedText.includes('extrato') ||
        normalizedText.includes('como estao meus') ||
        normalizedText.includes('como estão meus') ||
        normalizedText.includes('baldes') ||
        normalizedText.includes('balde') ||
        normalizedText.includes('orçamento') ||
        normalizedText.includes('orcamento') ||
        normalizedText.includes('quanto gastei') ||
        normalizedText.includes('quanto sobrou') ||
        normalizedText.includes('onde você lançou') ||
        normalizedText.includes('onde voce lancou') ||
        normalizedText.includes('onde você colocou') ||
        normalizedText.includes('qual foi o valor') ||
        normalizedText.includes('o que você anotou') ||
        normalizedText.includes('o que você lançou'))

    // 1. Categorias: utilize body.categorias enviado pelo front-end sempre que disponível (sem query no banco)
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

    // 2. Membros da família (apenas se targetFamilyId existir)
    let membersData: any[] = []
    if (targetFamilyId) {
      let membersQuery = supabase
        .from('family_members')
        .select('id, name, is_admin')
        .eq('family_id', targetFamilyId)
      const { data: mData } = await membersQuery
      membersData = mData || []
    }

    // 3. Resumo financeiro condicional (economiza ~8 queries em lançamentos rápidos e turno 2)
    let financialSummaryContext = ''
    if (isConsultativeQuery) {
      const currentYear = now.getFullYear()
      const currentMonthNum = now.getMonth() + 1
      const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}-01`
      const nextMonthStr = `${now.getMonth() === 11 ? currentYear + 1 : currentYear}-${String(
        ((now.getMonth() + 1) % 12) + 1,
      ).padStart(2, '0')}-01`

      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)

      // Executa as consultas financeiras em paralelo para máxima velocidade
      const [famRes, monthTxRes, recentTxRes, budgetsRes] = await Promise.all([
        targetFamilyId
          ? supabase
              .from('families')
              .select('id, name, monthly_net_income_cents, budget_model')
              .eq('id', targetFamilyId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        targetFamilyId
          ? supabase
              .from('transactions')
              .select(
                'id, amount_cents, type, description, transaction_date, category_id, transaction_categories(name, budget_bucket)',
              )
              .gte('transaction_date', currentMonthStr)
              .lt('transaction_date', nextMonthStr)
              .eq('status', 'confirmed')
              .eq('family_id', targetFamilyId)
          : Promise.resolve({ data: [] }),
        targetFamilyId
          ? supabase
              .from('transactions')
              .select(
                'id, amount_cents, type, description, transaction_date, transaction_categories(name)',
              )
              .gte('transaction_date', sevenDaysAgoStr)
              .eq('type', 'expense')
              .eq('status', 'confirmed')
              .eq('family_id', targetFamilyId)
              .order('amount_cents', { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [] }),
        targetFamilyId
          ? supabase
              .from('budgets')
              .select('amount_cents, category_id, transaction_categories(name, budget_bucket)')
              .eq('month', currentMonthStr)
              .eq('family_id', targetFamilyId)
          : Promise.resolve({ data: [] }),
      ])

      const familyData: any = famRes.data
      const monthTransactions: any[] = monthTxRes.data || []
      const topWeekExpenses: any[] = recentTxRes.data || []
      const monthlyBudgets: any[] = budgetsRes.data || []

      let totalExpenseMonthCents = 0
      let totalIncomeMonthCents = 0
      const expensesByBucketCents = {
        essential: 0,
        lifestyle: 0,
        goals: 0,
      }

      monthTransactions.forEach((tx: any) => {
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

      let totalBudgetConfiguredCents = 0
      monthlyBudgets.forEach((b: any) => {
        totalBudgetConfiguredCents += Number(b.amount_cents || 0)
      })

      const netIncomeCents = Number(familyData?.monthly_net_income_cents || 0)
      const budgetModel = familyData?.budget_model || '60_25_15'

      let targets = { essentials: 60, lifestyle: 25, future: 15 }
      if (budgetModel === '50_30_20') {
        targets = { essentials: 50, lifestyle: 30, future: 20 }
      } else if (budgetModel === '70_20_10') {
        targets = { essentials: 70, lifestyle: 20, future: 10 }
      } else if (budgetModel === '60_20_20') {
        targets = { essentials: 60, lifestyle: 20, future: 20 }
      }

      const targetEssentialsCents = Math.round((netIncomeCents * targets.essentials) / 100)
      const targetLifestyleCents = Math.round((netIncomeCents * targets.lifestyle) / 100)
      const targetGoalsCents = Math.round((netIncomeCents * targets.future) / 100)

      const remainingLifestyleCents =
        targetLifestyleCents > 0
          ? Math.max(0, targetLifestyleCents - expensesByBucketCents.lifestyle)
          : null

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

      financialSummaryContext = `
DADOS FINANCEIROS REAIS DA FAMÍLIA (MÊS ATUAL: ${currentMonthStr.slice(0, 7)}):
- Modelo Orçamentário da Família: ${targets.essentials}/${targets.lifestyle}/${targets.future} (Essenciais ${targets.essentials}%, Estilo de Vida ${targets.lifestyle}%, Metas/Futuro ${targets.future}%)
- Renda líquida mensal cadastrada da família: ${netIncomeCents > 0 ? formatCentsToBRL(netIncomeCents) : 'Não informada'}
- Total de despesas já realizadas este mês: ${formatCentsToBRL(totalExpenseMonthCents)} (em centavos: ${totalExpenseMonthCents})
  * Necessidades Essenciais: ${formatCentsToBRL(expensesByBucketCents.essential)}${targetEssentialsCents > 0 ? ` (Teto meta: ${formatCentsToBRL(targetEssentialsCents)})` : ''}
  * Estilo de Vida: ${formatCentsToBRL(expensesByBucketCents.lifestyle)}${targetLifestyleCents > 0 ? ` (Teto meta: ${formatCentsToBRL(targetLifestyleCents)} | Disponível: ${formatCentsToBRL(remainingLifestyleCents ?? 0)})` : ''}
  * Metas & Investimentos: ${formatCentsToBRL(expensesByBucketCents.goals)}${targetGoalsCents > 0 ? ` (Teto meta: ${formatCentsToBRL(targetGoalsCents)})` : ''}
- Total de receitas recebidas este mês: ${formatCentsToBRL(totalIncomeMonthCents)}
- Teto de orçamento total configurado para o mês: ${effectiveBudgetLimitCents > 0 ? formatCentsToBRL(effectiveBudgetLimitCents) : 'Sem teto fixo cadastrado'}
- Saldo geral restante disponível para gastar este mês: ${
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
    }

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
    if (
      previousContext &&
      (previousContext.descricao ||
        previousContext.categoria ||
        previousContext.valor ||
        previousContext.status)
    ) {
      const valorStr =
        previousContext.valor !== undefined && previousContext.valor !== null
          ? `R$ ${Number(previousContext.valor).toFixed(2).replace('.', ',')}`
          : 'Não informado'
      const opcoesStr =
        Array.isArray(previousContext.opcoes_sugestao) && previousContext.opcoes_sugestao.length > 0
          ? previousContext.opcoes_sugestao
              .map((o) => (typeof o === 'string' ? `"${o}"` : `"${o?.rotulo || o?.categoria}"`))
              .join(', ')
          : 'Nenhuma'

      previousContextPrompt = `
CONTEXTO ANTERIOR DE UMA TRANSAÇÃO EM ANDAMENTO NA SESSÃO:
- Descrição anterior: "${previousContext.descricao || ''}"
- Estabelecimento anterior: "${previousContext.estabelecimento || ''}"
- Valor anterior: ${valorStr}
- Categoria anterior: "${previousContext.categoria || ''}"
- Subcategoria anterior: "${previousContext.subcategoria || ''}"
- Balde anterior: "${previousContext.balde || ''}"
- Tipo anterior: "${previousContext.tipo || 'despesa'}"
- Status anterior: "${previousContext.status || ''}"
- Opções de sugestão oferecidas anteriormente: [${opcoesStr}]

INSTRUÇÕES CRÍTICAS PARA TRANSAÇÃO EM ANDAMENTO E CLASSIFICAÇÃO DE INTENÇÃO:
1. SE O STATUS ANTERIOR FOR 'falta_valor' (SLOT-FILLING DE VALOR):
  O usuário já disse o item anteriormente (ex: "${previousContext.descricao || 'item'}" em "${previousContext.estabelecimento || ''}").
  Agora ele está informando o valor — inclusive número isolado ou frase curta como "12", "12 reais", "doze", "doze reais", "52", "10", "trinta", "cinquenta e dois reais", "80 no débito", "paguei no pix 50", etc.
  - REGRA ABSOLUTA DE SLOT-FILLING (TURNO 2):
    * Número isolado ("12", "12 reais", "doze", etc.) quando há contexto anterior falta_valor É O VALOR da transação pendente!
    * NUNCA re-pergunte o valor e NUNCA retorne "falta_valor" quando um número for fornecido.
    * Capture o número/valor informado como o valor da transação anterior (ex: "12 reais" -> valor: 12.0).
    * MESCLE com o contexto anterior: preserve descricao "${previousContext.descricao || ''}", estabelecimento "${previousContext.estabelecimento || ''}", tipo "${previousContext.tipo || 'despesa'}".
    * Escolha a melhor categoria e subcategoria existente da família para esse item (ou use a categoria anterior "${previousContext.categoria || ''}").
    * RETORNE OBRIGATORIAMENTE "status": "sucesso"!
    * Preencha a "transacao" completa com "descricao", "estabelecimento", "valor", "categoria", "subcategoria", "balde" e "tipo".
    * Em "mensagem_amigavel", siga estritamente o PADRÃO OBRIGATÓRIO DE CONFIRMAÇÃO:
      "Lançado: R$ [valor formatado com vírgula] em [Nome da Categoria] › [Nome da Subcategoria] [emoji]!"
      Exemplo: "Lançado: R$ 12,00 em ${previousContext.categoria || 'Gastronomia & Delivery'} › ${previousContext.subcategoria || 'Cafeterias & Lanches Rápidos'} 👍!"

2. SE O STATUS ANTERIOR FOR 'clarificacao_categoria':
  - Se o usuário estiver escolhendo ou esclarecendo, selecione a categoria/subcategoria existente da família autonomamente e retorne "status": "sucesso" com a transação completa e mensagem no formato obrigatório com Categoria e Subcategoria.
`
    }
    const systemPrompt = `Você é o Curiangoo AI (Curiangoo Copilot), assistente financeiro inteligente do app Curiangoo para finanças familiares (Metodologia de 3 Baldes: 60/25/15 ou 50/30/20).
Seu papel é triplo:
1. LANÇAMENTO AUTÔNOMO (fala/texto de gastos ou receitas): transformar em transação financeira imediata, inferindo categoria e subcategoria com base no catálogo da família sem travar o usuário.
2. RECLASSIFICAÇÃO, CORREÇÃO OU DESFAZER DE LANÇAMENTOS ANTERIORES: quando o usuário pedir para mudar categoria ("Supermercado não, coloca em hortifruti", "muda pra farmácia"), alterar valor ("não é esse valor, foi 70", "corrige o valor para 80"), trocar descrição ("não é arroz, é feijão") ou desfazer ("desfaz esse gasto", "cancela", "apaga").
3. CONSULTAS FINANCEIRAS E ORIENTAÇÃO RÁPIDA: responder sintética e precisamente perguntas sobre saldo disponível, quanto pode gastar, despesas recentes e orçamentos por balde.

${previousContextPrompt}

${financialSummaryContext}

Metodologia de 3 Baldes Orçamentários da Família:
1. "Necessidades Essenciais" (~60% ou 50%): moradia, aluguel, condomínio, luz, água, internet, supermercado, feira, açougue, saúde, remédios, plano de saúde, educação, transporte, combustível, Uber essencial, escola dos filhos.
2. "Estilo de Vida" (~25% ou 30%): restaurantes, almoço fora, bar, cerveja, pizza, hambúrguer, lanches, delivery/iFood, cinema, passeios, lazer, viagens, compras de roupas, cuidados pessoais, streaming (Netflix, Spotify), jogos.
3. "Metas & Investimentos" (~15% ou 20%): aportes, investimentos, poupança, reserva de emergência, ações, CDB, tesouro direto, previdência privada, metas de longo prazo.

Categorias e Subcategorias cadastradas no perfil da família:
${categoriesContext || 'Nenhuma categoria específica cadastrada ainda.'}

Membros da família cadastrados:
${membersContext || 'Membro padrão'}

=======================================================
REGRAS OBRIGATÓRIAS DE CONFIRMAÇÃO E SEMÂNTICA (CRÍTICAS)
=======================================================

1. PADRÃO OBRIGATÓRIO DE CONFIRMAÇÃO (STATUS 'sucesso'):
- Em TODO lançamento com "status": "sucesso", a "mensagem_amigavel" DEVE conter OBRIGATORIAMENTE tanto a Categoria quanto a Subcategoria!
- O formato exato OBRIGATÓRIO é:
  "Lançado: R$ [valor] em [Nome da Categoria] › [Nome da Subcategoria] [emoji]!"
  Exemplo: "Lançado: R$ 35,00 em Gastronomia & Delivery › Restaurantes & Bares 👍!"
  Exemplo: "Lançado: R$ 15,00 em Gastronomia & Delivery › Cafeterias & Lanches Rápidos 🥐!"
  Exemplo: "Lançado: R$ 120,00 em Alimentação Básica › Supermercado 🛒!"
- NUNCA omitir a subcategoria na mensagem de confirmação de status 'sucesso'! Nunca retorne apenas "Lançado: R$ X em [Categoria]!". A subcategoria é SEMPRE obrigatória.

2. REGRAS SEMÂNTICAS DE ALIMENTAÇÃO E LANCHES (CONTEXTO BRASIL):
- NUNCA classificar como "Delivery" despesas de comida de rua, feira, pastel, praia, quiosque, salgado ou padaria.
- A subcategoria "Delivery (iFood/Rappi)" (ou equivalente de Delivery) é EXCLUSIVA para pedidos de entrega em domicílio/casa ou quando o usuário citar expressamente aplicativos de delivery ("no ifood", "pelo rappi", "pedi delivery", "entrega em casa").
- Para comidas rápidas consumidas no local ou na rua (ex: pastel de feira, lanche, salgado, coxinha, esfiha, food truck, quiosque, água de coco na praia), classificar SEMPRE em:
  "Gastronomia & Delivery › Cafeterias & Lanches Rápidos" ou "Restaurantes & Bares".
- Itens de barraca/praia (ex: coco na praia, milho verde, água de coco, açaí no quiosque): classificar em:
  "Gastronomia & Delivery › Cafeterias & Lanches Rápidos" (ou "Lazer & Passeios › Passeios de Fim de Semana" caso haja contexto explícito de passeio/turismo).
- Tolere variações de nomenclatura caso a família possua categorias com nomes ligeiramente diferentes (ex: "Alimentação", "Alimentação & Refeições", "Restaurantes"), mantendo sempre o princípio: delivery é SÓ para entrega por aplicativo em domicílio; comida de rua/feira/praia/padaria/quiosque vai para lanches rápidos ou restaurantes.
- Compras de feira livre / hortifruti de abastecimento da casa (frutas, verduras, legumes para cozinhar em casa): classificar em "Alimentação Básica › Hortifruti & Feira" (Necessidades Essenciais). Já o pastel frito consumido na feira ("pastel na feira", "caldo de cana"): classificar em "Gastronomia & Delivery › Cafeterias & Lanches Rápidos" (Estilo de Vida).

=======================================================
DIRETRIZES DE INTELIGÊNCIA REAL (PADRÃO OURO):
=======================================================

1. INFERÊNCIA AUTÔNOMA DE CATEGORIA:
  - Quando descrição e valor existirem, SEMPRE infira e selecione a melhor categoria existente e subcategoria correspondente do catálogo da família acima.
  - NÃO trave a tela com opções de escolha se a categoria puder ser inferida com razoável confiança!
  - Retorne "status": "sucesso" com a categoria e subcategoria devidamente preenchidas e com a "mensagem_amigavel" no padrão obrigatório com categoria e subcategoria.

2. AÇÕES DE CORREÇÃO, RECLASSIFICAÇÃO OU CANCELAMENTO:
  - Se o usuário disser algo como "desfaz esse gasto", "cancela esse lançamento", "apaga a última", retorne:
    * "status": "acao_executada" (ou "sucesso")
    * "acao": "desfazer"
    * "mensagem_amigavel": "Lançamento desfeito!"
  - Se o usuário disser "Supermercado não, coloca em hortifruti", "muda para farmácia", "coloca em Lazer", identifique a nova categoria e subcategoria e retorne:
    * "status": "sucesso"
    * "acao": "reclassificar"
    * "transacao" atualizada com a nova categoria/subcategoria.
    * "mensagem_amigavel": "Ajustado para [Nome da Categoria] › [Nome da Subcategoria]!"
  - Se o usuário disser "não é esse valor, foi 70", "corrige para 50 reais", retorne:
    * "status": "sucesso"
    * "acao": "ajustar_valor"
    * "transacao" com novo valor.
    * "mensagem_amigavel": "Valor corrigido para R$ [novo_valor]!"
  - Se o usuário disser "não é arroz, é feijão", preserve o valor e categoria anteriores e atualize apenas a descrição:
    * "status": "sucesso"
    * "acao": "ajustar_descricao"
    * "transacao" com nova descrição.
    * "mensagem_amigavel": "Descrição corrigida para Feijão!"

3. NÚMEROS PUROS E SLOT-FILLING (REGRA DE TURNO 2):
  - Se a mensagem contiver um número isolado como "12", "12 reais", "doze", "doze reais", "52", "52 reais", "cinquenta e dois" e havia contexto anterior sem valor (status anterior 'falta_valor'), capture esse número como o valor da transação pendente.
  - MESCLE com a descrição do contexto anterior e RETORNE IMEDIATAMENTE "status": "sucesso" com a transação completa (categoria e subcategoria preenchidas), sem re-perguntar.
  - Use o padrão obrigatório de confirmação em "mensagem_amigavel": "Lançado: R$ [valor] em [Nome da Categoria] › [Nome da Subcategoria] 👍!"

4. CONSULTAS FINANCEIRAS E MEMÓRIA DA CONVERSA RECENTE:
  - Quando o usuário fizer perguntas contextuais sobre lançamentos que acabou de fazer (ex: "onde você lançou o almoço?", "qual foi o valor que você anotou?", "em qual categoria ficou?"), você DEVE responder conversacionalmente lendo o histórico recente de mensagens enviado.
  - NUNCA marque essas perguntas contextuais como "invalido" e NUNCA peça para "falar novamente".
  - Retorne:
    * "status": "consulta"
    * "tipo_resposta": "consulta"
    * "transacao": null
    * "resposta_consulta": resposta direta, acolhedora e precisa em português (ex: "Lancei seu almoço de R$ 35,00 em [Categoria] › [Subcategoria] no débito! 🍽️").
    * "mensagem_amigavel": mesma resposta direta em linguagem natural.
  - Quando o usuário perguntar "Quanto ainda posso gastar?", "Como estão meus gastos?", responda de forma sintética, direta e acolhedora em 2-3 linhas, citando o saldo disponível do mês e a situação do balde de Estilo de Vida com base no resumo financeiro fornecido.
  - Perguntas gerais fora do domínio financeiro ou ruído sem sentido podem retornar "invalido", mas com um texto curto e amigável para balão de chat (sem tom rústico de erro ou card).

Você DEVE responder EXCLUSIVAMENTE um objeto JSON válido (response_format: json_object) com o seguinte esquema:
{
  "status": "sucesso" | "clarificacao" | "clarificacao_categoria" | "falta_valor" | "invalido" | "consulta" | "acao_executada",
  "acao": "criar" | "reclassificar" | "ajustar_valor" | "ajustar_descricao" | "desfazer" | null,
  "tipo_resposta": "transacao" | "consulta" | "consultoria_categoria" | "acao",
  "intencao": "transacao" | "consulta" | "consultoria_categoria" | "correcao" | "desfazer" | null,
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
  "opcoes_sugestao": Array<{
    "tipo": "existente" | "nova",
    "rotulo": string,
    "categoria": string,
    "subcategoria": string | null,
    "balde": string | null
  }> | string[] | null,
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
   - "subcategoria": use existente ou crie uma inteligente e específica. OBRIGATÓRIA!
   - "balde": classifique rigorosamente entre "Necessidades Essenciais", "Estilo de Vida" ou "Metas & Investimentos".
   - "mensagem_amigavel": OBRIGATORIAMENTE no formato "Lançado: R$ [valor] em [Categoria] › [Subcategoria] [emoji]!". Nunca omita a subcategoria!

3. "clarificacao_categoria" (DESATIVADA A FORÇAGEM DE ESCOLHA):
   - A IA deve SEMPRE escolher a melhor categoria/subcategoria existente da família autonomamente, sem travar o usuário perguntando escolha entre existente vs nova.
   - Portanto, para lançamentos com valor, retorne DIRETAMENTE "status": "sucesso" associando a melhor categoria existente do catálogo fornecido.

4. "falta_valor" (LANÇAMENTO SEM VALOR):
   - O usuário citou um item ou compra claro (ex: "coxinha na padaria", "uma caixa de cerveja na parada certa", "almoço no restaurante", "gasolina no posto"), mas NÃO disse o valor monetário.
   - "status": "falta_valor"
   - "tipo_resposta": "transacao"
   - Preserve o item preenchendo "transacao" parcial com "valor": null, inferindo já a melhor categoria/subcategoria existente.
   - "pergunta_clarificacao": "Quanto custou?"
   - "mensagem_amigavel": Responda de forma puramente conversacional e direta, estilo balão de chat (ex: "Identifiquei Coxinha na Padaria. Quanto custou? 🥐").

5. "clarificacao" (VALOR EXISTE, MAS DESCRIÇÃO TOTALMENTE AMBÍGUA OU GÍRIA):
   - Há um valor monetário identificado, mas o termo é ambíguo ou gíria sem sentido financeiro reconhecível (ex: "pindamonhangaba 8 reais").
   - "status": "clarificacao"
   - "tipo_resposta": "transacao"
   - Preencha o valor na transacao, elabore "pergunta_clarificacao" e exatamente 3 "opcoes_sugestao".

6. "invalido":
   - Ruído, conversa desconexa sem sentido financeiro nem pergunta.
   - "status": "invalido"`

    // Sanitização e validação das últimas 6 mensagens de histórico
    const sanitizedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (Array.isArray(body.historico_mensagens)) {
      const rawHistory = body.historico_mensagens.slice(-6)
      for (const msg of rawHistory) {
        const role = msg?.role === 'assistant' ? 'assistant' : msg?.role === 'user' ? 'user' : null
        const content = typeof msg?.content === 'string' ? msg.content.trim() : ''
        if (role && content) {
          sanitizedHistory.push({ role, content })
        }
      }
    }

    // Montagem das mensagens para a OpenAI: systemPrompt, seguido pelo histórico recente na ordem, e a mensagem atual
    const openAiMessages = [
      { role: 'system', content: systemPrompt },
      ...sanitizedHistory,
      { role: 'user', content: texto },
    ]

    // Chamada à API da OpenAI
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openAiMessages,
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
      'acao_executada',
    ]
    const status = validStatuses.includes(parsedAiJson?.status) ? parsedAiJson.status : 'invalido'

    const isConsulta = status === 'consulta' || parsedAiJson?.tipo_resposta === 'consulta'
    const isConsultoriaCategoria =
      parsedAiJson?.tipo_resposta === 'consultoria_categoria' ||
      parsedAiJson?.intencao === 'consultiva'

    const respostaConsulta =
      parsedAiJson?.resposta_consulta || (isConsulta ? parsedAiJson?.mensagem_amigavel : null)

    // Normalização das opções estruturadas para garantir rótulos com ícones e metadados
    let normalizedOptions: any[] | null = null
    if (Array.isArray(parsedAiJson?.opcoes_sugestao)) {
      normalizedOptions = parsedAiJson.opcoes_sugestao.map((opt: any) => {
        if (typeof opt === 'string') {
          const isExistente =
            opt.toLowerCase().includes('usar existente') ||
            opt.toLowerCase().includes('existente') ||
            opt.includes('📁') ||
            opt.includes('› dentro de')
          const cleanText = opt.replace(/^[📁✨]\s*/, '').trim()
          return {
            tipo: isExistente ? 'existente' : 'nova',
            rotulo:
              opt.startsWith('📁') || opt.startsWith('✨')
                ? opt
                : isExistente
                  ? `📁 Usar existente: ${cleanText}`
                  : `✨ Criar nova: ${cleanText}`,
            categoria: cleanText,
            subcategoria: null,
            balde: null,
          }
        }
        const tipo = opt?.tipo === 'existente' ? 'existente' : 'nova'
        let rotulo = opt?.rotulo || ''
        if (!rotulo) {
          if (tipo === 'existente') {
            rotulo = `📁 Usar existente: ${opt.categoria || 'Geral'}${opt.subcategoria ? ` › subcategoria ${opt.subcategoria}` : ''}`
          } else {
            rotulo = `✨ Criar nova: ${opt.categoria || 'Geral'}${opt.balde ? ` (${opt.balde})` : ''}`
          }
        }
        return {
          tipo,
          rotulo,
          categoria: opt.categoria || '',
          subcategoria: opt.subcategoria || null,
          balde: opt.balde || null,
        }
      })
    }

    // Normalização estrita da mensagem amigável para status 'sucesso'
    let finalMensagemAmigavel = parsedAiJson?.mensagem_amigavel ?? respostaConsulta ?? null
    if (status === 'sucesso' && parsedAiJson?.transacao) {
      const tx = parsedAiJson.transacao
      const cat = (tx.categoria || 'Geral').trim()
      let sub = (tx.subcategoria || '').trim()

      // Se a subcategoria veio vazia, inferir fallback coerente para nunca omitir
      if (!sub) {
        if (
          cat.toLowerCase().includes('gastronomia') ||
          cat.toLowerCase().includes('alimentação') ||
          cat.toLowerCase().includes('restaurante')
        ) {
          sub = 'Cafeterias & Lanches Rápidos'
        } else {
          sub = 'Geral'
        }
        tx.subcategoria = sub
      }

      // Se a mensagem da IA não contiver " › " (omitindo a subcategoria) ou estiver vazia
      const hasSubInMessage =
        typeof finalMensagemAmigavel === 'string' &&
        finalMensagemAmigavel.includes(' › ') &&
        finalMensagemAmigavel.toLowerCase().includes(sub.toLowerCase())

      if (!hasSubInMessage) {
        const valorNum = tx.valor !== undefined && tx.valor !== null ? Number(tx.valor) : 0
        const valorFormatado =
          valorNum > 0 ? formatCentsToBRL(Math.round(valorNum * 100)) : 'R$ 0,00'
        finalMensagemAmigavel = `Lançado: ${valorFormatado} em ${cat} › ${sub} 👍!`
      }
    }

    const sanitizedResponse = {
      status,
      acao: parsedAiJson?.acao ?? null,
      tipo_resposta: isConsulta
        ? 'consulta'
        : isConsultoriaCategoria
          ? 'consultoria_categoria'
          : parsedAiJson?.acao === 'desfazer'
            ? 'acao'
            : 'transacao',
      intencao: parsedAiJson?.intencao ?? (isConsultoriaCategoria ? 'consultiva' : null),
      resposta_consulta: respostaConsulta,
      transacao: isConsulta ? null : (parsedAiJson?.transacao ?? null),
      pergunta_clarificacao: parsedAiJson?.pergunta_clarificacao ?? null,
      opcoes_sugestao: normalizedOptions,
      mensagem_amigavel: finalMensagemAmigavel,
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
