import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { buildSystemPrompt, extractNumericHint } from '../_shared/copilot-system-prompt.ts'
// REDEPLOY FORÇADO (21/10): a v418 no Supabase saiu corrompida (entrypoint apontando
// para copilot-system-prompt.ts, index.ts ausente → função não respondia, 503/504).
// Este comentário força o pipeline a reenviar os arquivos corretos.

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

/**
 * Normalizador pt-BR de números e moedas:
 * (a) "N,NN" ou "N,N" (vírgula seguida de 1-2 dígitos delimitada) -> decimal pt-BR (ex: "6,75" -> 6.75)
 * (b) Vírgula seguida de espaço + próxima palavra -> separador de lista (NÃO decimal, preservada intacta)
 * (c) Ponto como milhar: "1.250" ou "10.000" -> remove o ponto de milhar (1250, 10000)
 * (d) "reais" / "real" / "reia" / "reias" / "pila" / "pilas" -> reconhecidos como sufixos monetários válidos
 */
function normalizeBrazilianCurrencyString(text: string): string {
  if (!text) return ''
  let res = text
  // (c) Ponto como milhar: ex: 1.250 ou 10.000 ou 1.250,50
  res = res.replace(/(\d+)\.(\d{3})(?=[,\s]|$)/g, '$1$2')
  // (a) "N,NN" ou "N,N": vírgula seguida de 1-2 dígitos NÃO seguida de outro dígito
  // e que não seja seguida por espaço e letra (vírgula de lista).
  // Exemplo: "6,75" -> "6.75", "9,10" -> "9.10". "carne, arroz" permanece com a vírgula intacta.
  res = res.replace(/(\d+),(\d{1,2})(?!\d)(?!\s+[a-zA-Zá-úÁ-Ú])/g, '$1.$2')
  return res
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
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
    const { texto, contexto_anterior, historico_mensagens, active_month } = body

    const textoNormalizadoPtBr =
      typeof texto === 'string' ? normalizeBrazilianCurrencyString(texto) : texto

    // GUARDA 3 — TEXTO SEM CONTEÚDO FONÉTICO (21/10, relato do Matheus):
    // "aldndnwksksk", transcrição inventada do Whisper pra silêncio/assobio.
    // Sem vogais suficientes = ruído. Resposta honesta SEM gastar chamada de IA.
    if (typeof textoNormalizadoPtBr === 'string' && textoNormalizadoPtBr.trim()) {
      const letters = textoNormalizadoPtBr.replace(/[^a-zà-úA-ZÀ-Ú]/g, '')
      const vowels = letters.match(/[aeiouáàâãéêíóôõú]/gi)?.length ?? 0
      const words = textoNormalizadoPtBr.trim().split(/\s+/).length
      if (letters.length >= 6 && words <= 4 && vowels / letters.length < 0.2) {
        return new Response(
          JSON.stringify({
            status: 'invalido',
            router: { classe: 9, confianca: 1, lacunas: null },
            transacao: null,
            pergunta_clarificacao: null,
            opcoes_sugestao: null,
            resposta_consulta: null,
            mensagem_amigavel:
              'Não consegui entender — parece que veio algo sem sentido. Pode repetir falando mais perto do microfone?',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

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

    // SEGURANÇA: autenticação obrigatória via JWT do usuário.
    // O cliente anon + Authorization do usuário garante RLS em todas as queries abaixo.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          status: 'invalido',
          error: 'UNAUTHORIZED',
          error_detail: 'Sessão não autenticada.',
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          status: 'invalido',
          error: 'UNAUTHORIZED',
          error_detail: 'Sessão expirada ou inválida.',
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

    // CUSTO: rate limit por usuário (30 chamadas / 10 min) contra abuso da OpenAI
    const { data: rateLimit, error: rateErr } = await supabase.rpc('check_ai_rate_limit', {
      p_function_name: 'voice-parse',
      p_max_requests: 30,
      p_window_minutes: 10,
    })
    if (rateErr) {
      console.warn('[voice-parse] Rate limit check falhou (fail-open):', rateErr)
    } else if (rateLimit && rateLimit.allowed === false) {
      return new Response(
        JSON.stringify({
          status: 'invalido',
          error: 'RATE_LIMITED',
          error_detail: `Limite de ${rateLimit.limit} mensagens a cada 10 minutos atingido.`,
          transacao: null,
          pergunta_clarificacao: null,
          opcoes_sugestao: null,
          mensagem_amigavel:
            'Você atingiu o limite de mensagens por agora. Aguarde alguns minutinhos e tente de novo! 💛',
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // SEGURANÇA (tenant isolation): o family_id do cliente SÓ é aceito se o usuário
    // for membro dele (RLS garante o vínculo). Sem vínculo, cai para a 1ª família do usuário.
    const requestedFamilyId = typeof body.family_id === 'string' ? body.family_id : null
    const { data: memberData } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    const memberFamilyIds = (memberData || []).map((m: { family_id: string }) => m.family_id)
    const targetFamilyId =
      (requestedFamilyId && memberFamilyIds.includes(requestedFamilyId)
        ? requestedFamilyId
        : null) ??
      memberFamilyIds[0] ??
      null

    // Carregar catálogo da família
    let categoriesList: any[] = []
    let membersData: any[] = []
    let familyData: any = null

    if (targetFamilyId) {
      const [catRes, membersRes, famRes] = await Promise.all([
        supabase
          .from('transaction_categories')
          .select(
            'id, name, type, budget_bucket, intent_tag, transaction_subcategories(id, name, intent_tag)',
          )
          .eq('family_id', targetFamilyId)
          .order('name'),
        supabase
          .from('family_members')
          .select('id, name, is_admin')
          .eq('family_id', targetFamilyId),
        supabase
          .from('families')
          .select('id, name, monthly_net_income_cents, budget_model')
          .eq('id', targetFamilyId)
          .single(),
      ])
      categoriesList = catRes.data || []
      membersData = membersRes.data || []
      familyData = famRes.data || null
    }

    // Buscar resumo financeiro do mês ativo (active_month no formato YYYY-MM) para contexto
    let financialSummaryContext = ''
    let activeMonthLabel = ''
    if (targetFamilyId) {
      try {
        const now = new Date()
        let refYear = now.getFullYear()
        let refMonthIndex = now.getMonth() // 0-indexed

        if (typeof active_month === 'string' && /^\d{4}-\d{2}$/.test(active_month.trim())) {
          const [yStr, mStr] = active_month.trim().split('-')
          const parsedY = parseInt(yStr, 10)
          const parsedM = parseInt(mStr, 10) - 1
          if (!isNaN(parsedY) && !isNaN(parsedM) && parsedM >= 0 && parsedM <= 11) {
            refYear = parsedY
            refMonthIndex = parsedM
          }
        }

        const monthNamesPt = [
          'janeiro',
          'fevereiro',
          'março',
          'abril',
          'maio',
          'junho',
          'julho',
          'agosto',
          'setembro',
          'outubro',
          'novembro',
          'dezembro',
        ]
        activeMonthLabel = `${monthNamesPt[refMonthIndex]} de ${refYear}`

        const startOfMonth = new Date(refYear, refMonthIndex, 1).toISOString()
        const endOfMonth = new Date(refYear, refMonthIndex + 1, 0, 23, 59, 59).toISOString()

        const [txRes, goalsRes, recurringRes, invRes] = await Promise.all([
          supabase
            .from('transactions')
            .select(
              'amount_cents, type, transaction_date, transaction_categories(name, budget_bucket)',
            )
            .eq('family_id', targetFamilyId)
            .gte('transaction_date', startOfMonth.split('T')[0])
            .lte('transaction_date', endOfMonth.split('T')[0]),
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
          const amt = Number(t.amount_cents) || 0
          if (t.type === 'income') {
            totalReceitasCents += amt
          } else {
            totalDespesasCents += amt
            const bucket = (t as any).transaction_categories?.budget_bucket
            if (bucket === 'essentials') essentialSpentCents += amt
            else if (bucket === 'lifestyle') lifestyleSpentCents += amt
            else if (bucket === 'future') goalsSpentCents += amt
          }
        }

        const saldoRealCents = totalReceitasCents - totalDespesasCents
        const tetoPlanejadoCents = familyData?.monthly_net_income_cents || 0

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
DADOS FINANCEIROS REAIS DA FAMÍLIA PARA O MÊS ATIVO SELECIONADO (${activeMonthLabel.toUpperCase()}):
- Mês de referência atualmente visualizado: ${activeMonthLabel} (formato ISO: ${refYear}-${String(refMonthIndex + 1).padStart(2, '0')})
- Receitas reais realizadas no mês ativo (${activeMonthLabel}): ${formatCentsToBRL(totalReceitasCents)}
- Despesas reais realizadas no mês ativo (${activeMonthLabel}): ${formatCentsToBRL(totalDespesasCents)}
- Saldo real do mês ativo (${activeMonthLabel}): ${formatCentsToBRL(saldoRealCents)}
- Total de transações registradas neste mês ativo: ${txs.length}
- Gastos reais por balde no mês ativo:
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
    // Catálogo v3 (18/10): tags de intenção incluídas — a IA decide pela regra
    // escrita (cai / não cai) em vez de adivinhar pelo nome.
    const categoriesContext = (categoriesList || [])
      .map((cat: any) => {
        const subs = (cat.transaction_subcategories || [])
          .map((s: any) =>
            s.intent_tag ? `${s.name} [intenção: ${s.intent_tag}]` : s.name || (s as any),
          )
          .join(', ')
        const catIntent = cat.intent_tag ? `, Intenção: ${cat.intent_tag}` : ''
        return `- Categoria: "${cat.name}" (Tipo: ${cat.type}, Balde: ${cat.budget_bucket || 'lifestyle'}${catIntent}${subs ? `, Subcategorias existentes: [${subs}]` : ''})`
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
       * Categoria: use o par de OCASIÃO que EXISTE no CATÁLOGO DA FAMÍLIA (padrão: 'Lazer' › 'Encontros & Festas'; NUNCA invente 'Eventos & Reuniões' — só use um par se ele estiver no catálogo), Balde: 'Estilo de Vida'.
       * Descrição OBRIGATÓRIA: a lista dos itens preservada com o evento (ex: "${previousContext.descricao || 'Itens'} — churrasco").
       * Valor: preserve o valor total da cesta (${valorStr}).
       * Mensagem amigável: "Lançado: ${valorStr} em **Lazer** › **Encontros & Festas** 👍!"
    b) Se o usuário NEGAR o evento ("não, compra de casa", "nada disso, comprei pra deixar aqui em casa", "alimentação", "mercado comum"):
       * Registre a cesta INTEIRA em 'Alimentação' › 'Supermercado & Atacado' (ou 'Alimentação'), Balde: 'Necessidades Essenciais'.
       * Descrição: mantenha os itens da cesta (ex: "${previousContext.descricao || 'Itens'} — casa").
       * Valor: preserve o valor total da cesta (${valorStr}).
       * Mensagem amigável: "Lançado: ${valorStr} em **Alimentação** › **Supermercado & Atacado** 👍!"
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
    * Em "mensagem_amigavel", siga estritamente o PADRÃO OBRIGATÓRIO DE CONFIRMAÇÃO EM NEGRITO:
      "Lançado: R$ [valor formatado com vírgula] em **[Nome da Categoria]** › **[Nome da Subcategoria]** [emoji]!"
      Exemplo: "Lançado: R$ 12,00 em **${previousContext.categoria || 'Restaurantes & Delivery'}**${previousContext.subcategoria ? ` › **${previousContext.subcategoria}**` : ''} 👍!"

2. SE O STATUS ANTERIOR FOR 'clarificacao_categoria' OU 'clarificacao' COM ITENS DE CLASSE 5 PROPOSTOS:
  - Se a mensagem atual for confirmação ("Sim", "está certo", "isso", "pode ser", "confirmo") de uma proposta multi-item (Classe 5):
    * REGRA CRÍTICA R43: NUNCA retorne "sucesso" nem use valores ou totais de mensagens antigas do histórico (ex: 146, 27, 19, etc.) sem que o usuário os tenha digitado neste turno!
    * Se a mensagem de proposta original já possuía um valor total consolidado único informado (ex: "Tudo ficou R$ 280", "tudo 280", "total 280"):
      - Se todos os itens estão na mesma categoria ou occasion, mantenha a ocasião.
      - Se os itens pertencem a categorias/ocasiões DIFERENTES (ex: churrasco + casa/filho/pet), a IA NUNCA grava tudo num par único em silêncio!
      - status: "falta_valor" (ou "clarificacao")
      - lacunas: ["divisao_valores"]
      - PERGUNTE COMO DIVIDIR: "Entendi! Como dividimos os R$ [total]? Aproximadamente quanto foi da parte de cada um?" (ou "Como dividimos os R$ 280? Quanto foi da carne e carvão e quanto do restante?").
    * Se não havia valor total prévio:
      - Retorne OBRIGATORIAMENTE status "falta_valor" com a pergunta: "Agora os valores: quanto foi cada item?"
    * Mantenha os itens propostos com valor: null.
  - Se a mensagem atual traz VALOR POR ITEM NOMEADO (ex: "chupeta 27, sachês 19, copo 100, doação 10", "carne 60 e carvão 20"):
    * Isso responde a pergunta de valores! Grave UMA TRANSAÇÃO POR ITEM com os valores informados, usando os pares categoria › subcategoria JÁ PROPOSTOS no 1º turno (status: "sucesso").
    * PRIORIDADE ABSOLUTA DESTA REGRA SOBRE A DOUTRINA (e) DE CRIAR GAVETA: no turno de valores, os pares do 1º turno estão CONFIRMADOS e VALEM MESMO se a subcategoria não existir no catálogo (ex: "Doação → Outros › Doações" proposta e confirmada = grava em Outros › Doações). NUNCA re-propor criação de gaveta aqui, NUNCA re-classificar como cesta nova, NUNCA perguntar de novo!
    * Mensagem amigável: resumo item por item ("Lançamentos realizados: • R$ 27,00 em **Compras** › **Bebês & Crianças** • ...").
    * Se sobrar item SEM valor informado: grave os precificados e pergunte SÓ o faltante (status: "falta_valor").
  - Se a mensagem atual for CORREÇÃO PARCIAL (SEMÂNTICA — COM OU SEM "NÃO"):
    * A detecção é SEMÂNTICA, NÃO lexical: qualquer formulação que atribua/vincule itens a uma ocasião ou destino diferente ("Essa carne também é para um churrasco", "A carne e o carvão são para o churrasco de hoje", "o carvão também é pro churrasco", "não, a carne é para churrasco", "carne pro churrasco") ativa a CORREÇÃO PARCIAL SEMÂNTICA!
    * Aplica-se EXCLUSIVAMENTE aos itens expressamente nomeados ou referenciados; todos os demais itens mantêm suas gavetas e categorias propostas intactas!
    * NUNCA lançar tudo em um par único (ex.: NUNCA lançar tudo em Alimentação › Supermercado & Atacado nem tudo em Lazer › Encontros & Festas)!
    * Se houver total único consolidado (ex: R$ 280):
      - status: "falta_valor" (ou "clarificacao")
      - FORMATO OBRIGATÓRIO DA PERGUNTA DE DIVISÃO COM CONTEXTO (nomeando o que divide e por quê):
        "Entendi — [itens corrigidos] vão para [par da ocasião] e [itens restantes] ficam nas gavetas deles. Como o total é único (R$ X), preciso dividir: aproximadamente quanto foi da parte de [ocasião]?"
       Exemplo: "Entendi — carne e carvão vão para **Lazer** › **Encontros & Festas** e rodas, long neck e sachê ficam nas gavetas deles. Como o total é único (R$ 280,00), preciso dividir: aproximadamente quanto foi da parte do churrasco?"
      - Gravação SÓ após a divisão confirmada pelo usuário!
  - Se o usuário pedir para re-exibir a proposta ("Me mostre como vc separou", "como você separou?", "como ficou?", "me mostra a separação"):
    * Re-exiba a proposta ATUAL em LISTA VERTICAL (um item por linha), refletindo as correções acumuladas!
    * Exemplo de re-exibição:
      "Separei assim:
      • carne → **Lazer** › **Encontros & Festas**
      • carvão → **Lazer** › **Encontros & Festas**
      • rodas para o meu filho → **Compras** › **Bebês & Crianças**
      • long neck ultra → **Alimentação** › **Bebidas**
      • sachês para o meu cachorro → **Pets** › **Alimentação Pet**"
  - Se o status anterior for apenas de escolha de categoria única de um gasto que JÁ TINHA valor confirmado: selecione a categoria/subcategoria da família e retorne "status": "sucesso".

3. ISOLAMENTO DE HISTÓRICO E FIM DO VAZAMENTO DE VALORES ANTIGOS:
  - Transações concluídas no passado (mesmo as que aparecem no historico_mensagens como "Lançado: R$ 146,00", "27, 19 e 100", etc.) PERTENCEM AO PASSADO.
  - Ao iniciar ou avançar um novo fluxo de lançamento, valores de turnos passados JAMAIS devem preencher lacunas sem confirmação explícita ("os valores são os mesmos de antes?").
  - NUNCA reaproveite valores ou categorias de transações já salvas para responder a confirmações de novos fluxos!
`
    }

    // System prompt montado a partir do contrato versionado em _shared/copilot-system-prompt.ts
    // + DICA DETERMINÍSTICA de números (fix evals flaky 20/10): regex extrai os
    // valores da frase SEM IA e o modelo recebe o número exato pronto.
    const numericHint = extractNumericHint(textoNormalizadoPtBr || texto)
    if (numericHint) console.log('[NumericHint] injetado:', numericHint.split('\n')[1])
    // DATA REAL DE HOJE (27/10, auditoria real 26/10): a IA chutava "22 de outubro"
    // porque o prompt não continha a data. Agora é injetada como VERDADE ABSOLUTA
    // (fuso America/Sao_Paulo), formatada por extenso.
    const todayParts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
    const systemPrompt = buildSystemPrompt({
      activeMonthLabel,
      todayContext: todayParts,
      previousContextPrompt,
      financialSummaryContext,
      categoriesContext: categoriesContext || 'Nenhuma categoria específica cadastrada ainda.',
      membersContext: membersContext || 'Membro padrão',
      numericHintContext: numericHint || undefined,
    })

    // Sanitização e validação das últimas 12 mensagens de histórico
    // (22/10, auditoria real: usuário corrigiu valor dito 7+ msgs atrás e a IA
    // não viu — "eu disse em torno de 350, vc não viu?". 6 era curto demais.)
    let sanitizedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    if (Array.isArray(body.historico_mensagens) && body.historico_mensagens.length > 0) {
      const rawHistory = body.historico_mensagens.slice(-12)
      for (const msg of rawHistory) {
        const role = msg?.role === 'assistant' ? 'assistant' : msg?.role === 'user' ? 'user' : null
        const content = typeof msg?.content === 'string' ? msg.content.trim() : ''
        if (role && content) {
          sanitizedHistory.push({ role, content })
        }
      }
    } else if (targetFamilyId) {
      // Se o cliente não enviou historico_mensagens, busca as últimas 12 mensagens
      // em copilot_messages (20/10, Matheus: 6 era curto pra "continua dali" —
      // padrão de mercado 10-20; custo de token mínimo)
      try {
        const { data: dbMessages } = await supabase
          .from('copilot_messages')
          .select('role, content, created_at')
          .eq('family_id', targetFamilyId)
          // PRIVACIDADE (22/10): chat é PRIVADO por membro — o fallback do banco
          // também filtra pelo dono da sessão (user.id do JWT), igual ao RLS do app.
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(12)

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
      { role: 'user', content: textoNormalizadoPtBr || texto },
    ]

    // Classe 5 (cesta multi-item) com schema JSON grande pode truncar em 1000 tokens -> JSON_PARSE_ERROR
    const maxTokens = 1500

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
        temperature: 0.1,
        max_tokens: maxTokens,
        // FIX EVALS FLAKY (20/10): seed fixo + top_p reduzido deixam a saída o
        // mais determinística possível na API atual (temperature 0.1 já havia;
        // a variância restante vinha do sampling). Mesma frase → mesma classe.
        seed: 42,
        top_p: 0.5,
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
    const rawStatus = validStatuses.includes(parsedAiJson?.status)
      ? parsedAiJson.status
      : 'invalido'
    // Normalização de contrato (26/10, eval c03): "acao_executada" é sinônimo de "sucesso" —
    // mesmo resultado semântico, rótulo divergente quebrava o golden set. Unificar em "sucesso".
    const status = rawStatus === 'acao_executada' ? 'sucesso' : rawStatus

    const isMudarMes = parsedAiJson?.acao === 'mudar_mes'
    const mesAlvo = parsedAiJson?.mes_alvo || null

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
            const cleanCatName =
              opt.categoria && opt.categoria.toLowerCase() !== 'geral' ? opt.categoria : 'Outros'
            rotulo = `✨ Criar nova: ${cleanCatName}${opt.balde ? ` (${opt.balde})` : ''}`
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
      let rawCat = (tx.categoria || 'Outros').trim()
      if (rawCat.toLowerCase() === 'geral') rawCat = 'Outros'
      tx.categoria = rawCat

      let sub = tx.subcategoria ? tx.subcategoria.trim() : null
      if (sub && sub.toLowerCase() === 'geral') sub = null
      tx.subcategoria = sub || null

      const valorNum = tx.valor !== undefined && tx.valor !== null ? Number(tx.valor) : 0
      const valorFormatado = valorNum > 0 ? formatCentsToBRL(Math.round(valorNum * 100)) : 'R$ 0,00'

      if (sub) {
        const hasSubInMessage =
          typeof finalMensagemAmigavel === 'string' &&
          finalMensagemAmigavel.includes(' › ') &&
          finalMensagemAmigavel.toLowerCase().includes(sub.toLowerCase())

        if (!hasSubInMessage) {
          finalMensagemAmigavel = `Lançado: ${valorFormatado} em **${rawCat}** › **${sub}** 👍!`
        }
      } else {
        const hasCatInMessage =
          typeof finalMensagemAmigavel === 'string' &&
          finalMensagemAmigavel.toLowerCase().includes(rawCat.toLowerCase())

        if (!hasCatInMessage || finalMensagemAmigavel.includes(' › ')) {
          finalMensagemAmigavel = `Lançado: ${valorFormatado} em **${rawCat}** 👍!`
        }
      }
    }

    // Validação defensiva contra o catálogo real da família (MATCHING TOLERANTE DO PAR — Fim da supercorreção)
    // Extrai o catálogo estruturado com nomes originais e normalizados
    interface RealCategoryInfo {
      originalName: string
      normName: string
      subs: Array<{ originalName: string; normName: string }>
    }

    const realCatalog: RealCategoryInfo[] = []
    const STOPWORDS_PT = new Set([
      'de',
      'da',
      'do',
      'dos',
      'das',
      'para',
      'pra',
      'pro',
      'e',
      '&',
      'a',
      'o',
      'em',
      'um',
      'uma',
      'uns',
      'umas',
      'meu',
      'minha',
    ])

    const stripAccents = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()

    const tokenize = (str: string): string[] => {
      const clean = stripAccents(str).replace(/[^a-z0-9\s]/g, ' ')
      return clean.split(/\s+/).filter((t) => t.length >= 2 && !STOPWORDS_PT.has(t))
    }

    // Dicionário canônico de aliases para matching semântico do par
    const CANONICAL_ALIASES: Record<string, string[]> = {
      'alimentacao pet': ['racao & petiscos', 'racao', 'petiscos', 'pet'],
      petiscos: ['racao & petiscos'],
      racao: ['racao & petiscos'],
      sache: ['racao & petiscos'],
      saches: ['racao & petiscos'],
      'sache pet': ['racao & petiscos'],
      bebidas: ['agua & bebidas para casa', 'bebidas para casa'],
      bebida: ['agua & bebidas para casa'],
      'bebidas para casa': ['agua & bebidas para casa'],
      'long neck': ['agua & bebidas para casa'],
      cerveja: ['agua & bebidas para casa'],
      criancas: ['bebes & criancas'],
      bebes: ['bebes & criancas'],
      bebe: ['bebes & criancas'],
      filho: ['bebes & criancas'],
      fralda: ['bebes & criancas'],
      fraldas: ['bebes & criancas'],
      cigarro: ['tabaco & cigarros'],
      cigarros: ['tabaco & cigarros'],
      tabaco: ['tabaco & cigarros'],
      remedio: ['farmacia & medicamentos'],
      remedios: ['farmacia & medicamentos'],
      medicamento: ['farmacia & medicamentos'],
      medicamentos: ['farmacia & medicamentos'],
      'utilidades domesticas': ['utilidades & casa', 'casa & conforto'],
      eletronicos: ['eletronicos & tecnologia'],
      jogos: ['jogos & streaming', 'lazer'],
      evento: ['eventos & reunioes'],
      churrasco: ['eventos & reunioes'],
      gastronomia: ['restaurantes & delivery'],
      'gastronomia e delivery': ['restaurantes & delivery'],
      doacao: ['doacoes & caridade'],
      doacoes: ['doacoes & caridade'],
      caridade: ['doacoes & caridade'],
      limpeza: ['limpeza & higiene da casa'],
      'limpeza da casa': ['limpeza & higiene da casa'],
      detergente: ['limpeza & higiene da casa'],
      desinfetante: ['limpeza & higiene da casa'],
      amaciante: ['limpeza & higiene da casa'],
      esponja: ['limpeza & higiene da casa'],
    }

    // Higienizador do nome do item na sugestão de criação (T2: limpa quantificadores e contexto)
    const sanitizeItemNameForSub = (rawDesc: string): string => {
      if (!rawDesc) return 'Novo Item'
      let s = rawDesc.trim()
      // Remove quantificadores no início (ex: "4", "quatro", "dois", "2 packs de", "1 pacote de", "seis quilos de")
      s = s.replace(
        /^(?:\d+|um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez|\d+\s*(?:packs?|pacotes?|latas?|garrafas?|unidades?|kg|quilos?|g|gramas?|litros?|l))\s*(?:de\s+)?/i,
        '',
      )
      // Remove cláusulas de contexto ("para o meu cachorro", "para o churrasco", "pra...", "pro...")
      s = s.replace(/\s+(?:para|pra|pro)\s+(?:o|a|os|as|meu|minha|nosso|nossa)?\s*.*$/i, '')
      s = s.replace(/[^\w\s-]/g, '').trim()
      if (!s) s = rawDesc.trim()
      return s.charAt(0).toUpperCase() + s.slice(1)
    }

    if (Array.isArray(categoriesList) && categoriesList.length > 0) {
      for (const cat of categoriesList) {
        const catOrig = (cat?.name || '').trim()
        if (catOrig) {
          const catNorm = stripAccents(catOrig)
          const subsRaw = Array.isArray(cat?.transaction_subcategories)
            ? cat.transaction_subcategories
            : []
          const subs = subsRaw
            .map((s: any) => {
              const subOrig = (typeof s === 'string' ? s : s?.name || '').trim()
              return {
                originalName: subOrig,
                normName: stripAccents(subOrig),
              }
            })
            .filter((s: { originalName: string }) => s.originalName.length > 0)

          realCatalog.push({
            originalName: catOrig,
            normName: catNorm,
            subs,
          })
        }
      }
    }

    const isCatalogAvailable = realCatalog.length > 0

    // Encontra o par real (categoria real + subcategoria real) usando matching tolerante
    const matchTolerantPair = (
      proposedCat?: string | null,
      proposedSub?: string | null,
    ): { matchedCat: string; matchedSub: string | null } | null => {
      if (!isCatalogAvailable) {
        return {
          matchedCat: proposedCat || 'Compras',
          matchedSub: proposedSub || null,
        }
      }
      if (!proposedCat) return null

      const propCatNorm = stripAccents(proposedCat)
      const propSubNorm = proposedSub ? stripAccents(proposedSub) : ''

      // 1. Localiza a categoria real (exata, contenção ou token-overlap)
      let targetCat = realCatalog.find((c) => c.normName === propCatNorm)
      if (!targetCat) {
        targetCat = realCatalog.find(
          (c) => c.normName.includes(propCatNorm) || propCatNorm.includes(c.normName),
        )
      }
      if (!targetCat) {
        const propCatTokens = tokenize(propCatNorm)
        let bestScore = 0
        for (const c of realCatalog) {
          const cTokens = tokenize(c.normName)
          const common = propCatTokens.filter((t) => cTokens.includes(t))
          if (common.length > bestScore) {
            bestScore = common.length
            targetCat = c
          }
        }
      }

      if (!targetCat) return null
      if (!propSubNorm || targetCat.subs.length === 0) {
        return { matchedCat: targetCat.originalName, matchedSub: null }
      }

      // 2. Casa a subcategoria dentro da categoria real encontrada
      // (a) Igualdade exata após normalização
      const exactSub = targetCat.subs.find((s) => s.normName === propSubNorm)
      if (exactSub) {
        return { matchedCat: targetCat.originalName, matchedSub: exactSub.originalName }
      }

      // (b) Contenção mútua
      const containSub = targetCat.subs.find(
        (s) => s.normName.includes(propSubNorm) || propSubNorm.includes(s.normName),
      )
      if (containSub) {
        return { matchedCat: targetCat.originalName, matchedSub: containSub.originalName }
      }

      // (c) Matching por Sinônimos / Aliases canônicos
      const aliases = CANONICAL_ALIASES[propSubNorm] || []
      for (const alias of aliases) {
        const aliasNorm = stripAccents(alias)
        const matched = targetCat.subs.find(
          (s) =>
            s.normName === aliasNorm ||
            s.normName.includes(aliasNorm) ||
            aliasNorm.includes(s.normName),
        )
        if (matched) {
          return { matchedCat: targetCat.originalName, matchedSub: matched.originalName }
        }
      }

      // (d) Token-overlap dentro da categoria real (ignora stopwords)
      const propSubTokens = tokenize(propSubNorm)
      let bestSub: { originalName: string; normName: string } | null = null
      let bestSubScore = 0

      for (const s of targetCat.subs) {
        const sTokens = tokenize(s.normName)
        const common = propSubTokens.filter((t) => sTokens.includes(t))
        if (common.length > bestSubScore) {
          bestSubScore = common.length
          bestSub = s
        }
      }

      if (bestSub && bestSubScore > 0) {
        return { matchedCat: targetCat.originalName, matchedSub: bestSub.originalName }
      }

      // (e) Se a subcategoria proposta tem token em comum com a própria categoria ou aliases globais
      const catTokens = tokenize(targetCat.normName)
      const overlapWithCat = propSubTokens.some((t) => catTokens.includes(t))
      if (overlapWithCat && targetCat.subs.length > 0) {
        // Casa a subcategoria mais representativa dessa categoria
        return { matchedCat: targetCat.originalName, matchedSub: targetCat.subs[0].originalName }
      }

      return null
    }

    // Valida itens propostos na raiz ou em transacao
    let validatedItens = Array.isArray(parsedAiJson?.itens)
      ? [...parsedAiJson.itens]
      : Array.isArray(parsedAiJson?.transacao?.itens)
        ? [...parsedAiJson.transacao.itens]
        : null

    const unmappedItems: Array<{ descricao: string; suggestedCat: string; suggestedSub: string }> =
      []

    if (isCatalogAvailable && Array.isArray(validatedItens)) {
      validatedItens = validatedItens.map((it: any) => {
        const cat = it?.categoria_proposta || null
        const sub = it?.subcategoria_proposta || null
        if (!cat) return it

        const match = matchTolerantPair(cat, sub)
        if (match) {
          // Atualiza para os NOMES REAIS do catálogo da família
          return {
            ...it,
            categoria_proposta: match.matchedCat,
            subcategoria_proposta: match.matchedSub,
            duvida_categoria: false,
          }
        }

        console.warn(
          `[voice-parse] Item sem gaveta real correspondente: "${cat} › ${sub}" para item "${it?.descricao}"`,
        )
        // Encontra categoria mais próxima no catálogo real (ex: 'Compras')
        let fallbackCat = 'Compras'
        const realCompras = realCatalog.find((c) => c.normName.includes('compras'))
        if (realCompras) {
          fallbackCat = realCompras.originalName
        } else if (realCatalog.length > 0) {
          fallbackCat = realCatalog[0].originalName
        }

        const suggestedSubName = sanitizeItemNameForSub(it?.descricao || '')
        unmappedItems.push({
          descricao: it?.descricao || 'item',
          suggestedCat: fallbackCat,
          suggestedSub: suggestedSubName,
        })
        return {
          ...it,
          categoria_proposta: null,
          subcategoria_proposta: null,
          duvida_categoria: true,
          requer_confirmacao: true,
        }
      })
    }

    // Valida transação individual se houver
    let validatedTx = isConsulta
      ? null
      : parsedAiJson?.transacao
        ? { ...parsedAiJson.transacao }
        : null
    if (isCatalogAvailable && validatedTx && validatedTx.categoria) {
      const match = matchTolerantPair(validatedTx.categoria, validatedTx.subcategoria)
      if (match) {
        validatedTx.categoria = match.matchedCat
        validatedTx.subcategoria = match.matchedSub
      } else {
        console.warn(
          `[voice-parse] Par sem gaveta real na transação: "${validatedTx.categoria} › ${validatedTx.subcategoria}"`,
        )
        const invalidDesc = validatedTx.descricao || 'gasto'
        let fallbackCat = 'Compras'
        const realCompras = realCatalog.find((c) => c.normName.includes('compras'))
        if (realCompras) fallbackCat = realCompras.originalName
        validatedTx.categoria = fallbackCat
        validatedTx.subcategoria = null
        // ANTIDOUTRINA c02 (26/10): lançamento simples (Classe 1) com valor presente NUNCA
        // desce para clarificacao por par de categoria sem gaveta — cai na gaveta fallback
        // (mais próxima) e segue "sucesso"; o usuário reclassifica depois. O downgrade
        // honesto continua valendo para CESTAS multi-item (validatedItens acima).
        console.warn(
          `[voice-parse] Tx sem gaveta real → fallback ${fallbackCat} (item "${invalidDesc}")`,
        )
      }
    }

    let defensiveClarification = parsedAiJson?.pergunta_clarificacao ?? null
    let defensiveMensagem = finalMensagemAmigavel

    if (unmappedItems.length > 0) {
      const firstUnmapped = unmappedItems[0]
      const honestSuggestion = `Nenhuma gaveta encaixa bem para ${firstUnmapped.descricao} — sugiro criar ${firstUnmapped.suggestedSub} em ${firstUnmapped.suggestedCat}. Posso criar?`
      defensiveClarification = honestSuggestion
      defensiveMensagem = honestSuggestion
    }

    const sanitizedResponse = {
      status: unmappedItems.length > 0 && status === 'sucesso' ? 'clarificacao' : status,
      acao: parsedAiJson?.acao ?? null,
      mes_alvo: mesAlvo,
      // LANÇAMENTO RECORRENTE (21/10, B6): propaga a intenção de conta fixa
      recorrente: parsedAiJson?.transacao?.recorrente === true || parsedAiJson?.recorrente === true,
      dia_recorrente:
        typeof parsedAiJson?.transacao?.dia_recorrente === 'number'
          ? parsedAiJson.transacao.dia_recorrente
          : typeof parsedAiJson?.dia_recorrente === 'number'
            ? parsedAiJson.dia_recorrente
            : null,
      tipo_resposta: isConsulta
        ? 'consulta'
        : isConsultoriaCategoria
          ? 'consultoria_categoria'
          : parsedAiJson?.acao === 'desfazer' || isMudarMes
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
      itens: validatedItens,
      confianca: routerConfianca ?? parsedAiJson?.confianca ?? null,
      lacunas: Array.isArray(parsedAiJson?.lacunas)
        ? parsedAiJson.lacunas
        : Array.isArray(parsedAiJson?.router?.lacunas)
          ? parsedAiJson.router.lacunas
          : null,
      resposta_consulta: respostaConsulta,
      transacao: validatedTx,
      pergunta_clarificacao: defensiveClarification,
      opcoes_sugestao: normalizedOptions,
      mensagem_amigavel: defensiveMensagem,
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
