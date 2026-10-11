import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Types para parsing e resposta
interface SubItemProposta {
  descricao: string
  quantidade?: number | null
  valor?: number | null
  categoria_proposta?: string | null
  subcategoria_proposta?: string | null
  confianca?: number | null
  requer_confirmacao?: boolean
  duvida_categoria?: boolean
}

interface ParsedVoiceTransaction {
  descricao: string
  estabelecimento?: string | null
  valor: number | null
  tipo: 'despesa' | 'receita'
  balde: 'Necessidades Essenciais' | 'Estilo de Vida' | 'Metas & Investimentos'
  categoria?: string | null
  subcategoria?: string | null
  metodo_pagamento?: 'pix' | 'debito' | 'credito' | 'dinheiro' | null
  itens?: SubItemProposta[] | null
}

interface StructuredSuggestionOption {
  tipo: 'existente' | 'nova'
  rotulo: string
  categoria: string
  subcategoria?: string | null
  balde?: string | null
}

interface VoiceAiResponse {
  status:
    | 'sucesso'
    | 'clarificacao'
    | 'clarificacao_categoria'
    | 'falta_valor'
    | 'invalido'
    | 'consulta'
    | 'acao_executada'
    | 'modo_cesta'
  acao?: 'criar' | 'reclassificar' | 'ajustar_valor' | 'ajustar_descricao' | 'desfazer' | null
  tipo_resposta?: 'transacao' | 'consulta' | 'consultoria_categoria' | 'acao'
  intencao?:
    | 'transacao'
    | 'consulta'
    | 'consultoria_categoria'
    | 'correcao'
    | 'desfazer'
    | 'social'
    | null
  router?: {
    classe: number | null
    confianca: number | null
    lacunas: string[] | null
  }
  itens?: SubItemProposta[] | null
  confianca?: number | null
  lacunas?: string[] | null
  resposta_consulta?: string | null
  transacao: ParsedVoiceTransaction | null
  pergunta_clarificacao?: string | null
  opcoes_sugestao?: StructuredSuggestionOption[] | null
  mensagem_amigavel?: string | null
  error?: string
  error_detail?: string
}

function formatCentsToBRL(cents: number): string {
  const abs = Math.abs(cents)
  const reais = Math.floor(abs / 100)
  const centavos = abs % 100
  const formattedReais = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const formattedCentavos = centavos.toString().padStart(2, '0')
  return `R$ ${formattedReais},${formattedCentavos}`
}

function normalizeText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration')
      return new Response(
        JSON.stringify({
          status: 'invalido',
          error: 'CONFIG_ERROR',
          error_detail: 'Configuração do Supabase ausente',
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel: 'Erro de configuração do servidor.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (!openaiApiKey) {
      console.error('Missing OpenAI API key')
      return new Response(
        JSON.stringify({
          status: 'invalido',
          error: 'CONFIG_ERROR',
          error_detail: 'Chave da API OpenAI não configurada no Supabase',
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel: 'A IA de reconhecimento de voz não está configurada.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const body = await req.json()
    const { texto, family_id, contexto_anterior, historico_mensagens } = body

    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return new Response(
        JSON.stringify({
          status: 'invalido',
          error: 'EMPTY_TEXT',
          error_detail: 'Nenhum texto informado para processamento',
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel: 'Não consegui entender. Poderia falar novamente?',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obter family_id do token se não fornecido
    let targetFamilyId = family_id
    if (!targetFamilyId) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser(token)
        if (!authError && user) {
          const { data: memberData } = await supabase
            .from('family_members')
            .select('family_id')
            .eq('user_id', user.id)
            .limit(1)
            .single()
          if (memberData?.family_id) {
            targetFamilyId = memberData.family_id
          }
        }
      }
    }

    // Carregar catálogo da família
    let categoriesList: any[] = []
    let membersData: any[] = []
    let familyData: any = null

    if (targetFamilyId) {
      const [catRes, membersRes, famRes] = await Promise.all([
        supabase
          .from('transaction_categories')
          .select('id, name, type, budget_bucket, transaction_subcategories(id, name)')
          .eq('family_id', targetFamilyId)
          .order('name'),
        supabase.from('family_members').select('id, name, role').eq('family_id', targetFamilyId),
        supabase
          .from('families')
          .select('id, name, monthly_net_income, budget_model')
          .eq('id', targetFamilyId)
          .single(),
      ])

      categoriesList = catRes.data || []
      membersData = membersRes.data || []
      familyData = famRes.data || null
    }

    // Buscar resumo financeiro recente para contexto
    let financialSummaryContext = ''
    if (targetFamilyId) {
      try {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const endOfMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        ).toISOString()

        const [txRes, goalsRes, recurringRes, invRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('amount, type, date, transaction_categories(name, budget_bucket)')
            .eq('family_id', targetFamilyId)
            .gte('date', startOfMonth.split('T')[0])
            .lte('date', endOfMonth.split('T')[0]),
          supabase
            .from('goals')
            .select('title, target_amount, current_amount, deadline')
            .eq('family_id', targetFamilyId)
            .limit(10),
          supabase
            .from('recurring_incomes')
            .select('description, amount, type')
            .eq('family_id', targetFamilyId)
            .eq('is_active', true)
            .limit(10),
          supabase
            .from('investments')
            .select('type, quantity, current_price, purchase_price')
            .eq('family_id', targetFamilyId)
            .limit(20),
        ])

        const txs = txRes.data || []
        let totalReceitasCents = 0
        let totalDespesasCents = 0
        let essentialSpentCents = 0
        let lifestyleSpentCents = 0
        let goalsSpentCents = 0

        for (const t of txs) {
          const amt = Number(t.amount) || 0
          if (t.type === 'income') {
            totalReceitasCents += amt
          } else {
            totalDespesasCents += amt
            const bucket = (t as any).transaction_categories?.budget_bucket
            if (bucket === 'essential') essentialSpentCents += amt
            else if (bucket === 'lifestyle') lifestyleSpentCents += amt
            else if (bucket === 'goals') goalsSpentCents += amt
          }
        }

        const saldoRealCents = totalReceitasCents - totalDespesasCents
        const tetoPlanejadoCents = familyData?.monthly_net_income || 0

        const goalsSummary =
          (goalsRes.data || [])
            .map(
              (g: any) =>
                `- Meta "${g.title}": saldo ${formatCentsToBRL(g.current_amount || 0)} de ${formatCentsToBRL(g.target_amount || 0)}`,
            )
            .join('\n') || 'Nenhuma meta cadastrada'

        const recurringSummary =
          (recurringRes.data || [])
            .map(
              (r: any) =>
                `- Recorrente "${r.description}": ${formatCentsToBRL(r.amount || 0)} (${r.type || 'fixo'})`,
            )
            .join('\n') || 'Nenhuma receita recorrente ativa cadastrada'

        const investmentTypesSummary =
          (invRes.data || [])
            .map((inv: any) => {
              const val = Math.round((Number(inv.quantity) || 0) * (Number(inv.current_price) || 0))
              return `- Tipo "${inv.type}": ${formatCentsToBRL(val)}`
            })
            .join('\n') || 'Nenhum investimento registrado'

        financialSummaryContext = `
DADOS FINANCEIROS REAIS DA FAMÍLIA NESTE MÊS:
- Receitas reais realizadas no mês: ${formatCentsToBRL(totalReceitasCents)}
- Despesas reais realizadas no mês: ${formatCentsToBRL(totalDespesasCents)}
- Saldo real do mês (receitas - despesas): ${formatCentsToBRL(saldoRealCents)}
- Total de transações registradas neste mês: ${txs.length}
- Gastos reais por balde:
  * Necessidades Essenciais: ${formatCentsToBRL(essentialSpentCents)}
  * Estilo de Vida: ${formatCentsToBRL(lifestyleSpentCents)}
  * Metas & Investimentos: ${formatCentsToBRL(goalsSpentCents)}
- Teto orçamentário planejado no onboarding (renda cadastrada): ${formatCentsToBRL(tetoPlanejadoCents)}
- Modelo orçamentário da família: ${familyData?.budget_model || '50-30-20'}
- Metas financeiras da família:
  ${goalsSummary}
- Receitas recorrentes ativas cadastradas:
  ${recurringSummary}
- Investimentos agregados por categoria de ativo:
  ${investmentTypesSummary}
`
      } catch (sumErr) {
        console.warn('Erro ao montar contexto financeiro resumido:', sumErr)
      }
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
              .map((o: any) =>
                typeof o === 'string' ? `"${o}"` : `"${o?.rotulo || o?.categoria}"`,
              )
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
0. SE O STATUS ANTERIOR FOR 'modo_cesta' OU HOUVE PERGUNTA DE MISSÃO DE COMPRA/OCASIÃO:
  O usuário respondeu livremente à pergunta sobre a cesta de compras multi-item (ex: "Percebi cerveja, salame e suco — parece um encontro ou churrasco?").
  - DECISÃO DE UX: NÃO usamos chips/cards; a resposta é LIVRE por voz ou texto e você deve interpretá-la:
    a) Se o usuário CONFIRMAR o evento ("sim", "foi churrasco", "churrasco com os amigos", "resenha", "festa", "encontro", "churrasco sim"):
       * Registre a cesta INTEIRA em UMA transação (status: "sucesso").
       * Categoria: 'Lazer' › 'Eventos & Reuniões' (ou 'Restaurantes & Bares' se não houver 'Eventos & Reuniões'), Balde: 'Estilo de Vida'.
       * Descrição OBRIGATÓRIA: a lista dos itens preservada com o evento (ex: "${previousContext.descricao || 'Itens'} — churrasco").
       * Valor: preserve o valor total da cesta (${valorStr}).
       * Mensagem amigável: "Lançado: ${valorStr} em Lazer › Eventos & Reuniões 👍!"
    b) Se o usuário NEGAR o evento ("não, compra de casa", "nada disso, comprei pra deixar aqui em casa", "alimentação", "mercado comum"):
       * Registre a cesta INTEIRA em 'Alimentação' › 'Supermercado & Atacado' (ou 'Alimentação'), Balde: 'Necessidades Essenciais'.
       * Descrição: mantenha os itens da cesta (ex: "${previousContext.descricao || 'Itens'} — casa").
       * Valor: preserve o valor total da cesta (${valorStr}).
       * Mensagem amigável: "Lançado: ${valorStr} em Alimentação › Supermercado & Atacado 👍!"
    c) Se a resposta for PARCIAL ou pedir DIVISÃO ("cerveja pro churrasco, resto é da casa", "só a cerveja foi pro churrasco"):
       * Se o usuário não deu os valores exatos de cada parte, responda educadamente com uma proposta de divisão proporcional (ex: ~40% cerveja e 60% casa) pedindo confirmação rápida, NUNCA chute valores em silêncio!
       * Ou se ele informou ("cerveja foi 40, resto casa"), divida e confirme.
    d) Se a resposta for AMBÍGUA: faça UMA pergunta de follow-up (máximo 2 perguntas por cesta). Se persistir, classifique na mais específica do contexto.

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
      Exemplo: "Lançado: R$ 12,00 em ${previousContext.categoria || 'Restaurantes & Delivery'}${previousContext.subcategoria ? ` › ${previousContext.subcategoria}` : ''} 👍!"

2. SE O STATUS ANTERIOR FOR 'clarificacao_categoria':
  - Se o usuário estiver escolhendo ou esclarecendo, selecione a categoria/subcategoria existente da família autonomamente e retorne "status": "sucesso" com a transação completa e mensagem no formato obrigatório.
`
    }

    const systemPrompt = `Você é o Curiangoo AI (Curiangoo Copilot), assistente financeiro inteligente do app Curiangoo para finanças familiares (Metodologia de 3 Baldes: 60/25/15 ou 50/30/20).

=======================================================
CONTRATO DE COMPORTAMENTO DO COPILOT v1.0 — ROUTER DE INTENÇÕES (9 CLASSES)
=======================================================
Toda mensagem do usuário DEVE ser classificada PRIMEIRO em UMA das 9 classes a seguir antes de qualquer ação. A classificação deve ser expressa no nó "router" do JSON com "classe" (1 a 9) e "confianca" (0.0 a 1.0):

CLASSE 1: LANÇAMENTO COMPLETO (Item/local específico + valor monetário)
  Exemplos: "gastei 80 no mercado", "almoço 45 reais no débito", "salário de 5000 caiu", "50 reais de gasolina no posto Shell".
  Ação: Lançar IMEDIATAMENTE (status: "sucesso"). Inferir categoria e subcategoria do catálogo da família.
  Mensagem amigável: padrão "Lançado: R$ [valor] em [Categoria] › [Subcategoria] 👍!" (ou "Lançado: R$ [valor] em [Categoria] 👍!").

CLASSE 2: LANÇAMENTO VAGO / INCOMPLETO & ORDEM DE SLOT-FILLING
  ORDEM CANÔNICA DE IMPORTÂNCIA DO CONTRATO v1.0:
    (1º) ITENS / O QUÊ foi comprado
    (2º) VALOR / QUANTO custou
    (3º) LOCAL / ONDE foi comprado
    (4º) DATA / QUANDO aconteceu

  REGRAS DE SLOT-FILLING:
  - MÁXIMO 2 PERGUNTAS POR INTERAÇÃO (doutrina R28): após a 2ª pergunta, qualquer lacuna restante NÃO pode gerar nova pergunta — use sugestão com badge "sugestão incerta" (confiança < 0.6) ou valor default sensato (ex: data de hoje), NUNCA chute em silêncio.
  (A) DESCRIÇÃO GENÉRICA ("comprei algumas coisas", "umas coisas", "umas paradas", "compras", "umas comprinhas", "gastei numas coisas"):
      REGRA FUNDAMENTAL DO CONTRATO: PERGUNTE OS ITENS PRIMEIRO, NUNCA O VALOR!
      Mesmo que o usuário mencione valor ("comprei umas coisas por 50 reais"), pergunte O QUE foi comprado para poder categorizar.
      Se não disse valor nem itens ("comprei algumas coisas"): lacunas: ["itens", "valor"]. Pergunte: "O que você comprou?".
      NUNCA pergunte valor antes dos itens!
      status: "falta_valor"
      lacunas: ["itens", "valor"]
      pergunta_clarificacao: "O que você comprou?"
      mensagem_amigavel: "O que você comprou? Me conta os itens que eu já organizo pra você!"
  (B) DESCRIÇÃO ESPECÍFICA SEM VALOR ("paguei o mercado", "coxinha na padaria", "almoço no restaurante", "gasolina no posto"):
      Itens/serviço estão claros, falta o valor monetário (2º na ordem de importância).
      status: "falta_valor"
      lacunas: ["valor"]
      pergunta_clarificacao: "Quanto custou?"
      mensagem_amigavel: "Identifiquei [Item]. Quanto custou? 👍"
  (C) QUANDO OS ITENS E VALOR JÁ ESTÃO PRESENTES MAS FALTA LOCAL OU DATA:
      - Se local for relevante e ambíguo: pergunte o local ("Onde foi?").
      - Se local já estiver claro e faltar data: pergunte a data ("Foi hoje?").
      - Lembre-se: limite rigoroso de no máximo 2 perguntas em toda a interação.

CLASSE 3: CESTA COM OCASIÃO (Conjunto coerente que sugere evento ou encontro)
  Exemplos: "carne, carvão e cerveja, tudo 100", "picanha, carvão, gelo e cerveja 180 reais", "pipoca, refri e doces 45".
  Requisito: conjunto harmônico e COERENTE de ocasião (churrasco, festa, resenha), SEM itens de abastecimento doméstico/higiene/limpeza contradizendo.
  Ação: NÃO grave ocasião em silêncio! Faça UMA pergunta natural conversacional:
  status: "clarificacao"
  pergunta_clarificacao: "Percebi carne, carvão e cerveja — parece um churrasco ou encontro com os amigos?"
  mensagem_amigavel: "Percebi carne, carvão e cerveja — parece um churrasco ou encontro com os amigos? Se for, já coloco em Lazer › Eventos & Reuniões!"
  transacao pendente com valor total e lista de itens em descricao.

CLASSE 4: LISTA MISTA DE MERCADO (FORMAL — FIM DO FALSO CHURRASCO)
  Exemplos: "uma caixa de cerveja, uma caixa de sabão em pó, dois salames, dois miojos de pote, tudo na mercearia Parada Certa. Ficou 118 reais", "arroz, feijão, sabão em pó, cerveja e salame no mercado deu 120", "mercado 250 na Parada Certa".
  Critério: múltiplos itens de abastecimento/casa + total consolidado sem coerência de ocasião. A presença de itens de casa/limpeza/despensa CONTRADIZ a ocasião de lazer.
  Ação OBRIGATÓRIA:
  - Gravar como 1 ÚNICA transação em 'Alimentação › Supermercado & Atacado' (ou 'Alimentação'), balde 'Necessidades Essenciais'.
  - Manter a lista de itens preservada no campo 'descricao' (ex: "cerveja, sabão em pó, salame, miojo — mercado").
  - NUNCA perguntar ocasião.
  - Se houver estabelecimento nomeado (ex: "na mercearia Parada Certa", "no Carrefour"), preserve rigorosamente no campo 'estabelecimento' (ex: "Mercearia Parada Certa").
  - status: "sucesso"
  - transacao: { descricao: "cerveja, sabão em pó, salame, miojo — mercado", estabelecimento: "Mercearia Parada Certa", valor: 118, categoria: "Alimentação", subcategoria: "Supermercado & Atacado", balde: "Necessidades Essenciais" }
  - mensagem_amigavel: "Lançado: R$ 118,00 em Alimentação › Supermercado & Atacado 👍!"

CLASSE 5: ITENS HETEROGÊNEOS (O CASO DA CHUPETA / CESTA MULTI-CATEGORIA)
  Definição: Mensagem com múltiplos itens pertencentes a categorias claramente DIFERENTES e sem coerência de ocasião única (ex: compras para filho + pet + casa/cozinha + doação/social).
  Caso canônico: "uma chupeta para o meu filho, 4 sachês para o meu cachorro, um jogo de copo novo, uma doação que fiz para o catador de latinhas".
  Regras Absolutas de Negócio (Doutrina R25, R26, R29 e Contrato v1.0 — D1, D3, D4):
  1. NUNCA despejar tudo numa única categoria em silêncio!
  2. NUNCA FAZER DUAS PERGUNTAS NA MESMA MENSAGEM (proibido perguntar categoria E valores juntos)!
  3. REGRA ESTRITA DE 1 PERGUNTA POR VEZ NA ORDEM CONVERSACIONAL:
     - 1º TURNO: Propor os pares categoria › subcategoria por item contra o catálogo real da família (se faltar gaveta para doação, sugerir criar 'Doações' em nível de família ou o par mais próximo) E encerrar perguntando APENAS: "Está certo assim?" (NUNCA pergunte os valores aqui!).
     - 2º TURNO (SÓ APÓS confirmação dos pares pelo usuário): perguntar os valores de cada item ("Perfeito! Quais foram os valores de cada um?").
     - 3º TURNO: Se faltarem valores (ex.: 3 valores informados para 4 itens), NUNCA somar! Perguntar especificamente QUAL item faltou ("Faltou o valor da doação — quanto foi?").
     - 4º TURNO: Gravação de UMA TRANSAÇÃO POR ITEM (ou agrupando apenas itens do mesmo par exato), NUNCA uma transação única agregada genérica em 'Compras'. Cada transação gravada deve ter par completo e válido (categoria e subcategoria).
  - Exemplo de retorno no 1º turno:
  - status: "clarificacao"
  - itens: [
      { "descricao": "Chupeta", "categoria_proposta": "Compras", "subcategoria_proposta": "Bebês & Crianças", "confianca": 0.9, "requer_confirmacao": true },
      { "descricao": "4 sachês para o meu cachorro", "categoria_proposta": "Pets", "subcategoria_proposta": "Alimentação Pet", "confianca": 0.9, "requer_confirmacao": true },
      { "descricao": "Jogo de copo", "categoria_proposta": "Casa & Conforto", "subcategoria_proposta": "Utensílios & Cozinha", "confianca": 0.85, "requer_confirmacao": true },
      { "descricao": "Doação para o catador", "categoria_proposta": "Outros", "subcategoria_proposta": "Doações", "confianca": 0.7, "requer_confirmacao": true, "duvida_categoria": true }
    ]
  - pergunta_clarificacao: "Separei assim: chupeta em Bebês & Crianças, sachês em Pets, jogo de copo em Casa & Conforto e a doação em Doações. Está certo assim?"
  - mensagem_amigavel: "Separei assim: chupeta em Bebês & Crianças, sachês em Pets, jogo de copo em Casa & Conforto e a doação em Doações. Está certo assim?"

CLASSE 6: PERGUNTA SOBRE FINANÇAS (CONSULTA FINANCEIRA)
  Exemplos: "quanto gastei este mês?", "quanto sobrou?", "quanto posso gastar?", "qual meu saldo?", "como estão meus gastos?", "quanto gastei em restaurantes?".
  Ação: status: "consulta", tipo_resposta: "consulta", transacao: null.
  Responda com base no resumo financeiro fornecido, diferenciando receita real de teto planejado.

CLASSE 7: CONVERSA / SOCIAL / SAUDAÇÕES
  Exemplos: "bom dia", "boa tarde", "boa noite", "oi", "olá", "e aí curiangoo", "como você está?", "tudo bem?".
  Ação CRÍTICA: NUNCA tente extrair transação de saudação! NUNCA marque como 'invalido' com mensagem de erro!
  status: "consulta" (ou status social/conversacional, tipo_resposta: "consulta", transacao: null)
  Resposta curta, calorosa, personalidade Curiangoo acolhedora + gancho útil convidativo:
  Exemplo: "Bom dia! Pronto pra registrar algo ou ver como estão as finanças de vocês?"
  Exemplo: "Olá! Tudo ótimo por aqui. No que posso ajudar nas contas da família hoje?"

CLASSE 8: COMANDOS
  Exemplos: "cancela", "cancelar", "esquece", "desfaz", "apaga a última", "criar subcategoria X", "muda para farmácia".
  Ação: Se "cancela" / "esquece" durante pendência ou clarificação: descarta a pendência com alívio cordial ("Tudo bem, cancelado! Não registrei nada.").
  Se "desfaz" de lançamento recente: acao: "desfazer", status: "acao_executada", mensagem: "Lançamento desfeito!".
  Se "muda para [categoria]": acao: "reclassificar", status: "sucesso".

CLASSE 9: DESCONHECIDO / FORA DE ESCOPO
  Exemplos: mensagem sobre política partidária, esportes aleatórios, "qual a previsão do tempo?", "quem vai ganhar a eleição?", ruído ininteligível ("asdfghjk").
  Ação: Redirecionamento elegante e acolhedor para as finanças da família, sem arrogância e sem card de transação:
  Exemplo: "Prefiro não opinar sobre isso! Mas se quiser falar sobre os gastos, receitas ou metas da família, estou 100% por aqui."
  status: "invalido" (ou "consulta"), tipo_resposta: "consulta", transacao: null.

REGRA DE DESAMBIGUAÇÃO EM CONFIANÇA BAIXA:
Se a confiança entre duas classes for baixa (< 0.65), faça UMA pergunta de desambiguação clara e natural, NUNCA dê chute cego!

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
REGRAS OBRIGATÓRIAS DE CONFIRMAÇÃO E SEMÂNTICA
=======================================================
- Eventos sociais, resenha e churrasco -> 'Lazer › Eventos & Reuniões' (Estilo de Vida).
- Cigarro / tabaco / fumo / vape -> 'Compras › Tabaco & Cigarros' se existir (nunca Alimentação ou Farmácia).
- Comida de rua / lanches / pastel consumido no local -> 'Restaurantes & Delivery › Fast Food & Lanches' ou 'Restaurantes & Bares' (nunca 'Delivery' a menos que seja entrega em domicílio/app).
- Hortifruti e compras de abastecimento -> 'Alimentação › Hortifruti & Feira'.

=======================================================
11ª REGRA TRANSVERSAL — REGRA DA PROPOSTA (PROPOSE-THEN-CONFIRM)
=======================================================
Aplicável a TODAS as classes de lançamento (1, 2, 3, 4, 5).
Decisão de Produto (ADITAMENTO v1.1 do Contrato de Comportamento):
O usuário NÃO deve precisar conhecer o catálogo — a IA é a especialista em ONDE encaixa; o usuário é a autoridade sobre O QUE comprou.
(a) PERGUNTA ABERTA DE CATEGORIA É TERMINANTEMENTE PROIBIDA em qualquer classe de lançamento ("em qual categoria?", "qual é a categoria?", "onde quer organizar?"). A IA SEMPRE PROPÕE o par mais provável e confirma;
(b) A IA propõe o par (categoria › subcategoria) mais provável para cada item, NOMEANDO o par completo ("Separei liquidificador em Casa & Conforto › Utensílios & Cozinha. Está certo assim?" ou "chupeta → Bebês & Crianças › Fraldas & Higiene"), usando: catálogo real da família + contexto da mensagem + regras de aprendizado existentes;
(c) Se o usuário confirma ("sim", "isso", "pode", "está certo", "pode ser"): o fluxo segue imediatamente para conclusão;
(d) Se o usuário discorda ("não", "não é isso", "errado"): a IA propõe a PRÓXIMA MELHOR opção (ex.: "Que tal Compras › Eletrônicos & Tecnologia? Fica melhor assim?") — NUNCA volta à pergunta aberta;
(e) Se nada encaixa ou o usuário discordar novamente: a IA propõe CRIAR subcategoria nova ("Nenhuma gaveta encaixa bem — sugiro criar Eletroportáteis em Compras. Posso criar?"). Com a confirmação do usuário, a subcategoria é criada no nível da FAMÍLIA (nunca no catálogo canônico global — regra R29);
(f) O esforço do usuário é SEMPRE binário ("sim" ou "não") — nunca navegar catálogo nem adivinhar nomes de gavetas.

=======================================================
ESQUEMA JSON OBRIGATÓRIO (response_format: json_object)
=======================================================
Você DEVE responder EXCLUSIVAMENTE um objeto JSON válido no formato:
{
  "router": {
    "classe": 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
    "nome_classe": "lancamento_completo" | "lancamento_vago" | "cesta_ocasiao" | "lista_mista_mercado" | "itens_heterogeneos" | "pergunta_financas" | "social_saudacao" | "comandos" | "fora_escopo",
    "confianca": number,
    "lacunas": string[] | null
  },
  "status": "sucesso" | "clarificacao" | "clarificacao_categoria" | "falta_valor" | "invalido" | "consulta" | "acao_executada",
  "acao": "criar" | "reclassificar" | "ajustar_valor" | "ajustar_descricao" | "desfazer" | null,
  "tipo_resposta": "transacao" | "consulta" | "consultoria_categoria" | "acao",
  "intencao": "transacao" | "consulta" | "consultoria_categoria" | "correcao" | "desfazer" | "social" | null,
  "itens": Array<{
    "descricao": string,
    "quantidade": number | null,
    "valor": number | null,
    "categoria_proposta": string | null,
    "subcategoria_proposta": string | null,
    "confianca": number | null,
    "requer_confirmacao": boolean,
    "duvida_categoria": boolean
  }> | null,
  "confianca": number | null,
  "lacunas": string[] | null,
  "resposta_consulta": string | null,
  "transacao": {
    "descricao": string,
    "estabelecimento": string | null,
    "valor": number | null,
    "tipo": "despesa" | "receita",
    "balde": "Necessidades Essenciais" | "Estilo de Vida" | "Metas & Investimentos",
    "categoria": string | null,
    "subcategoria": string | null,
    "metodo_pagamento": "pix" | "debito" | "credito" | "dinheiro" | null,
    "itens": Array<{
      "descricao": string,
      "quantidade": number | null,
      "valor": number | null,
      "categoria_proposta": string | null,
      "subcategoria_proposta": string | null,
      "confianca": number | null,
      "requer_confirmacao": boolean,
      "duvida_categoria": boolean
    }> | null
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
}`

    // Sanitização e validação das últimas 6 mensagens de histórico
    let sanitizedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (Array.isArray(body.historico_mensagens) && body.historico_mensagens.length > 0) {
      const rawHistory = body.historico_mensagens.slice(-6)
      for (const msg of rawHistory) {
        const role = msg?.role === 'assistant' ? 'assistant' : msg?.role === 'user' ? 'user' : null
        const content = typeof msg?.content === 'string' ? msg.content.trim() : ''
        if (role && content) {
          sanitizedHistory.push({ role, content })
        }
      }
    } else if (targetFamilyId) {
      // Se o cliente não enviou historico_mensagens, busca as últimas 6 mensagens em copilot_messages
      try {
        const { data: dbMessages } = await supabase
          .from('copilot_messages')
          .select('role, content, created_at')
          .eq('family_id', targetFamilyId)
          .order('created_at', { ascending: false })
          .limit(6)

        if (dbMessages && dbMessages.length > 0) {
          const chronological = [...dbMessages].reverse()
          for (const msg of chronological) {
            const role =
              msg.role === 'assistant' ? 'assistant' : msg.role === 'user' ? 'user' : null
            const content = typeof msg.content === 'string' ? msg.content.trim() : ''
            if (role && content) {
              sanitizedHistory.push({ role, content })
            }
          }
        }
      } catch (histErr) {
        console.warn('Erro ao carregar histórico copilot_messages na edge:', histErr)
      }
    }

    // Montagem das mensagens para a OpenAI: systemPrompt, seguido pelo histórico recente na ordem, e a mensagem atual
    const openAiMessages = [
      { role: 'system', content: systemPrompt },
      ...sanitizedHistory,
      { role: 'user', content: texto },
    ]

    const maxTokens = 1000

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
        max_tokens: maxTokens,
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
    const finishReason = openAiData.choices?.[0]?.finish_reason

    let parsedAiJson: any = null
    try {
      if (!content || typeof content !== 'string') {
        throw new Error('Conteúdo retornado pela OpenAI vazio ou indefinido.')
      }
      parsedAiJson = JSON.parse(content)
    } catch (parseErr: any) {
      console.error(
        `[voice-parse] Falha ao parsear JSON da OpenAI (finish_reason: ${finishReason ?? 'desconhecido'}):`,
        parseErr?.message,
        '| Conteúdo recebido:',
        content,
      )

      return new Response(
        JSON.stringify({
          status: 'invalido',
          error: 'JSON_PARSE_ERROR',
          error_detail: `Falha ao interpretar resposta estruturada da IA (${parseErr?.message || 'SyntaxError'}). finish_reason: ${finishReason || 'n/a'}.`,
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel:
            'Tive uma pequena falha ao processar a resposta da inteligência. Poderia repetir ou confirmar o valor?',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Logging obrigatório do IntentRouter [T1]
    const routerClasse = parsedAiJson?.router?.classe ?? parsedAiJson?.classe_intencao ?? null
    const routerConfianca =
      parsedAiJson?.router?.confianca ?? parsedAiJson?.confianca_intencao ?? null
    console.log(
      `[IntentRouter] classe=${routerClasse ?? 'n/a'} confiança=${routerConfianca ?? 'n/a'}`,
    )

    // Normalização defensiva da resposta garantindo que os status e campos cheguem intactos
    const validStatuses = [
      'sucesso',
      'clarificacao',
      'clarificacao_categoria',
      'falta_valor',
      'invalido',
      'consulta',
      'acao_executada',
      'modo_cesta',
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
      const sub = tx.subcategoria ? tx.subcategoria.trim() : null
      tx.subcategoria = sub || null

      const valorNum = tx.valor !== undefined && tx.valor !== null ? Number(tx.valor) : 0
      const valorFormatado = valorNum > 0 ? formatCentsToBRL(Math.round(valorNum * 100)) : 'R$ 0,00'

      if (sub) {
        const hasSubInMessage =
          typeof finalMensagemAmigavel === 'string' &&
          finalMensagemAmigavel.includes(' › ') &&
          finalMensagemAmigavel.toLowerCase().includes(sub.toLowerCase())

        if (!hasSubInMessage) {
          finalMensagemAmigavel = `Lançado: ${valorFormatado} em ${cat} › ${sub} 👍!`
        }
      } else {
        const hasCatInMessage =
          typeof finalMensagemAmigavel === 'string' &&
          finalMensagemAmigavel.toLowerCase().includes(cat.toLowerCase())

        if (!hasCatInMessage || finalMensagemAmigavel.includes(' › ')) {
          finalMensagemAmigavel = `Lançado: ${valorFormatado} em ${cat} 👍!`
        }
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
      router: {
        classe: routerClasse,
        confianca: routerConfianca,
        lacunas: Array.isArray(parsedAiJson?.router?.lacunas)
          ? parsedAiJson.router.lacunas
          : Array.isArray(parsedAiJson?.lacunas)
            ? parsedAiJson.lacunas
            : null,
      },
      itens: Array.isArray(parsedAiJson?.itens)
        ? parsedAiJson.itens
        : Array.isArray(parsedAiJson?.transacao?.itens)
          ? parsedAiJson.transacao.itens
          : null,
      confianca: routerConfianca ?? parsedAiJson?.confianca ?? null,
      lacunas: Array.isArray(parsedAiJson?.lacunas)
        ? parsedAiJson.lacunas
        : Array.isArray(parsedAiJson?.router?.lacunas)
          ? parsedAiJson.router.lacunas
          : null,
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
