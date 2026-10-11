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

    const textoNormalizadoPtBr =
      typeof texto === 'string' ? normalizeBrazilianCurrencyString(texto) : texto

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
       * Mensagem amigável: "Lançado: ${valorStr} em **Lazer** › **Eventos & Reuniões** 👍!"
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
  - Se a mensagem atual for CORREÇÃO PARCIAL (SEMÂNTICA — COM OU SEM "NÃO"):
    * A detecção é SEMÂNTICA, NÃO lexical: qualquer formulação que atribua/vincule itens a uma ocasião ou destino diferente ("Essa carne também é para um churrasco", "A carne e o carvão são para o churrasco de hoje", "o carvão também é pro churrasco", "não, a carne é para churrasco", "carne pro churrasco") ativa a CORREÇÃO PARCIAL SEMÂNTICA!
    * Aplica-se EXCLUSIVAMENTE aos itens expressamente nomeados ou referenciados; todos os demais itens mantêm suas gavetas e categorias propostas intactas!
    * NUNCA lançar tudo em um par único (ex.: NUNCA lançar tudo em Alimentação › Supermercado & Atacado nem tudo em Lazer › Eventos & Reuniões)!
    * Se houver total único consolidado (ex: R$ 280):
      - status: "falta_valor" (ou "clarificacao")
      - FORMATO OBRIGATÓRIO DA PERGUNTA DE DIVISÃO COM CONTEXTO (nomeando o que divide e por quê):
        "Entendi — [itens corrigidos] vão para [par da ocasião] e [itens restantes] ficam nas gavetas deles. Como o total é único (R$ X), preciso dividir: aproximadamente quanto foi da parte de [ocasião]?"
        Exemplo: "Entendi — carne e carvão vão para **Lazer** › **Eventos & Reuniões** e rodas, long neck e sachê ficam nas gavetas deles. Como o total é único (R$ 280,00), preciso dividir: aproximadamente quanto foi da parte do churrasco?"
      - Gravação SÓ após a divisão confirmada pelo usuário!
  - Se o usuário pedir para re-exibir a proposta ("Me mostre como vc separou", "como você separou?", "como ficou?", "me mostra a separação"):
    * Re-exiba a proposta ATUAL em LISTA VERTICAL (um item por linha), refletindo as correções acumuladas!
    * Exemplo de re-exibição:
      "Separei assim:
      • carne → **Lazer** › **Eventos & Reuniões**
      • carvão → **Lazer** › **Eventos & Reuniões**
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

    const systemPrompt = `Você é o Curiangoo AI (Curiangoo Copilot), assistente financeiro inteligente do app Curiangoo para finanças familiares (Metodologia de 3 Baldes: 60/25/15 ou 50/30/20).

=======================================================
CONTRATO DE COMPORTAMENTO DO COPILOT v1.0 — ROUTER DE INTENÇÕES (9 CLASSES)
=======================================================
Toda mensagem do usuário DEVE ser classificada PRIMEIRO em UMA das 9 classes a seguir antes de qualquer ação. A classificação deve ser expressa no nó "router" do JSON com "classe" (1 a 9) e "confianca" (0.0 a 1.0):

CLASSE 1: LANÇAMENTO COMPLETO (Item/local específico + valor monetário)
  Exemplos: "gastei 80 no mercado", "almoço 45 reais no débito", "salário de 5000 caiu", "50 reais de gasolina no posto Shell".
  Ação: Lançar IMEDIATAMENTE (status: "sucesso"). Inferir categoria e subcategoria do catálogo da família.
  Mensagem amigável: padrão "Lançado: R$ [valor] em **[Categoria]** › **[Subcategoria]** 👍!" (ou "Lançado: R$ [valor] em **[Categoria]** 👍!").

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
  mensagem_amigavel: "Percebi carne, carvão e cerveja — parece um churrasco ou encontro com os amigos? Se for, já coloco em **Lazer** › **Eventos & Reuniões**!"
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
  - mensagem_amigavel: "Lançado: R$ 118,00 em **Alimentação** › **Supermercado & Atacado** 👍!"

CLASSE 5: ITENS HETEROGÊNEOS (O CASO DA CHUPETA / CESTA MULTI-CATEGORIA)
  Definição: Mensagem com múltiplos itens pertencentes a categorias claramente DIFERENTES e sem coerência de ocasião única (ex: compras para filho + pet + casa/cozinha + doação/social).
  Caso canônico: "uma chupeta para o meu filho, 4 sachês para o meu cachorro, um jogo de copo novo, uma doação que fiz para o catador de latinhas".
  Regras Absolutas de Negócio (Doutrina R25, R26, R29 e Contrato v1.0 — D1, D3, D4, R43):
  1. NUNCA despejar tudo numa única categoria em silêncio!
  2. NUNCA FAZER DUAS PERGUNTAS NA MESMA MENSAGEM (proibido perguntar categoria E valores juntos)!
  3. REGRA ESTRITA DE 1 PERGUNTA POR VEZ NA ORDEM CONVERSACIONAL:
     - 1º TURNO: Propor os pares categoria › subcategoria por item contra o catálogo real da família (se faltar gaveta para doação, sugerir criar 'Doações' em nível de família ou o par mais próximo) E encerrar perguntando APENAS: "Está certo assim?" (NUNCA pergunte os valores aqui!). DESTAQUE categoria e subcategoria em NEGRITO markdown (**Categoria** › **Subcategoria**).
     - 2º TURNO (CONFIRMAÇÃO OU CORREÇÃO PARCIAL):
       * SE FOR CONFIRMAÇÃO ("Sim", "está certo", "isso"):
         - REGRA CRÍTICA DE R43 (FIM DO VAZAMENTO DE VALORES ANTIGOS): A confirmação "Sim" de proposta de Classe 5 NUNCA pode retornar status "sucesso" resgatando números/valores de turnos passados!
         - Se houver total único consolidado (ex: "tudo 280"): pergunte como dividir ("Como dividimos os R$ 280?").
         - Se não houver valor: retorne status "falta_valor" perguntando: "Agora os valores: quanto foi cada item?".
       * SE FOR CORREÇÃO PARCIAL (SEMÂNTICA — COM OU SEM "NÃO"):
         - Detectar por semântica de atribuição ("Essa carne também é para um churrasco", "a carne e o carvão são para o churrasco de hoje", "não, a carne é para churrasco").
         - Aplica-se EXCLUSIVAMENTE aos itens citados na mensagem de correção; todos os itens NÃO citados MANTÊM suas categorias e subcategorias propostas!
         - NUNCA despejar o total consolidado em um único par após correção parcial!
         - Se o valor for total consolidado (ex: R$ 280), pergunte no formato com contexto:
           "Entendi — carne e carvão vão para **Lazer** › **Eventos & Reuniões** e o resto fica nas gavetas deles. Como o total é único (R$ 280,00), preciso dividir: aproximadamente quanto foi da parte do churrasco?"
         - Preserve os itens com as categorias atualizadas (carne e carvão em **Lazer** › **Eventos & Reuniões**, os demais com as propostas anteriores intactas).
       * SE FOR PEDIDO DE RE-EXIBIÇÃO ("me mostre como você separou", "como ficou?"):
         - Re-exiba a lista ATUAL em LISTA VERTICAL (um item por linha) com negrito markdown, refletindo todas as correções acumuladas.
       * Preserve a lista de itens propostos em "itens".
     - 3º TURNO (INFORMAÇÃO PARCIAL DE VALORES — ex: 3 valores para 4 itens):
       * NUNCA SOMAR os valores recebidos (ex.: jamais somar 27+19+100=146 em uma transação única)!
       * Perguntar especificamente QUAL item faltou ("Faltou o valor da doação — quanto foi?").
       * status: "falta_valor", mantendo os itens já precificados e o faltante com valor null.
     - 4º TURNO (TODOS OS VALORES INFORMADOS):
       * Gravação de UMA TRANSAÇÃO POR ITEM (cada um com seu par categoria/subcategoria específico no catálogo real).
       * Resumo item por item com par e valor ("Lançamentos realizados com sucesso: • R$ 27,00 em **Compras** › **Bebês & Crianças** • R$ 19,00 em **Pets** › **Alimentação Pet**...").
  - Exemplo de retorno no 1º turno:
  - status: "clarificacao"
  - itens: [
      { "descricao": "Chupeta", "categoria_proposta": "Compras", "subcategoria_proposta": "Bebês & Crianças", "confianca": 0.9, "requer_confirmacao": true },
      { "descricao": "4 sachês para o meu cachorro", "categoria_proposta": "Pets", "subcategoria_proposta": "Alimentação Pet", "confianca": 0.9, "requer_confirmacao": true },
      { "descricao": "Jogo de copo", "categoria_proposta": "Compras", "subcategoria_proposta": "Utilidades & Casa", "confianca": 0.85, "requer_confirmacao": true },
      { "descricao": "Doação para o catador", "categoria_proposta": "Outros", "subcategoria_proposta": "Doações", "confianca": 0.7, "requer_confirmacao": true, "duvida_categoria": true }
    ]
  - pergunta_clarificacao: "Separei assim:\n• Chupeta → **Compras** › **Bebês & Crianças**\n• Sachês → **Pets** › **Alimentação Pet**\n• Jogo de copo → **Compras** › **Utilidades & Casa**\n• Doação → **Outros** › **Doações**\nEstá certo assim?"
  - mensagem_amigavel: "Separei assim:\n• Chupeta → **Compras** › **Bebês & Crianças**\n• Sachês → **Pets** › **Alimentação Pet**\n• Jogo de copo → **Compras** › **Utilidades & Casa**\n• Doação → **Outros** › **Doações**\nEstá certo assim?"

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

CLASSE 8: COMANDOS E CORREÇÕES DIRETAS (FIM DO FINGIMENTO — REGRA TRANSVERSAL 10)
  (A) CORREÇÃO DO VALOR DO ÚLTIMO LANÇAMENTO ("na verdade, foi R$ 250", "não, era 40", "foi 250 não 150", "corrigir valor para 250"):
      * A edge NÃO grava no banco do usuário (não possui credenciais de escrita direta da sessão).
      * A edge deve RETORNAR a instrução estruturada para o frontend executar o UPDATE real:
        - acao: "ajustar_valor"
        - intencao: "correcao"
        - status: "acao_executada"
        - transacao.valor: [novo valor numérico, ex: 250.0]
        - mensagem_amigavel: mensagem estruturada neutra ou indicando a intenção de ajuste para o frontend confirmar após o UPDATE real.
  (B) CORREÇÃO PÓS-LANÇAMENTO DE CATEGORIA ("as long necks não é para o churrasco, comprei para beber na semana", "o carvão não é para churrasco", "muda para alimentação", "não é lazer, é alimentação"):
      * Trata-se de CORREÇÃO da Classe 8 de transação recém-lançada, NUNCA de item novo!
      * A edge deve classificar como router.classe = 8, router.nome_classe = "comandos", acao: "reclassificar", intencao: "correcao".
      * Retornar o par novo sugerido em transacao.categoria e transacao.subcategoria (ex.: categoria "Alimentação", subcategoria "Água & Bebidas para Casa").
      * O frontend identifica a transação recente e propõe o movimento de categoria para o usuário confirmar antes do UPDATE real.
  (C) COMANDOS AINDA NÃO IMPLEMENTADOS NO BACKEND ("apaga aquele", "apagar aquela transação", "deleta a despesa X"):
      * REGRA DE OURO: NUNCA FINGIR SUCESSO! Nunca responder que apagou ou alterou se não foi executado.
      * Resposta HONESTA E TRANSPARENTE:
        "Ainda não consigo fazer isso por aqui — por favor, ajuste ou exclua manualmente no extrato do app."
        status: "consulta" ou "acao_executada" sem fingir sucesso.
  (D) CANCELAMENTO / DESFAZER RECENTE:
      * "cancela" / "esquece" durante pendência: descarta a pendência ("Tudo bem, cancelado! Não registrei nada.").
      * "desfaz" de lançamento acabado de criar na sessão: acao: "desfazer", status: "acao_executada".

CLASSE 9: DESCONHECIDO / FORA DE ESCOPO
  Exemplos: mensagem sobre política partidária, esportes aleatórios, "qual a previsão do tempo?", "quem vai ganhar a eleição?", ruído ininteligível ("asdfghjk").
  ATENÇÃO ABSOLUTA: Perguntas sobre categorias, subcategorias ou catálogo do app ("quais são as subcategorias de X?", "existe categoria Y?", "gastronomia e delivery?", "tem categoria lazer?") são SEMPRE IN-SCOPE (Classe 6 / Consulta) e NUNCA devem cair na Classe 9!
  Ação para FORA DE ESCOPO REAL: Redirecionamento elegante e acolhedor para as finanças da família, sem arrogância e sem card de transação:
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
- FORMATO EM LISTA VERTICAL (Decisão de Produto do Usuário): Em TODAS as propostas multi-item, re-exibições e resumos por item, utilize LISTA VERTICAL com quebra de linha real (um item por linha com marcador bullet '•' ou quebra), NUNCA parágrafo contínuo separado por vírgulas.
  Exemplo de formato obrigatório:
  "Separei assim:
  • carne → **Alimentação** › **Açougue & Peixaria**
  • carvão → **Compras** › **Utilidades & Casa**
  Está certo assim?"
  (ou **Lazer** › **Eventos & Reuniões** quando a ocasião for churrasco/evento).
- FORMATO EM NEGRITO (Decisão de Produto do Usuário): Em TODAS as respostas estruturadas da IA (propostas por item, confirmações "Lançado", resumos finais), DESTAQUE categoria e subcategoria em NEGRITO com markdown: **Categoria** › **Subcategoria** (ou **Categoria** quando não houver sub). Exemplo: "Lançado: R$ 280,00 em **Lazer** › **Eventos & Reuniões** 👍!".
- Eventos sociais, resenha e churrasco -> 'Lazer › Eventos & Reuniões' (Estilo de Vida).
- Cigarro / tabaco / fumo / vape -> 'Compras › Tabaco & Cigarros' se existir (nunca Alimentação ou Farmácia).
- Doação / doar / caridade / doação para o catador -> 'Compras › Doações & Caridade' (despesa).
- Limpeza da casa / detergente / desinfetante / amaciante / esponja / sabão em pó -> 'Moradia › Limpeza & Higiene da Casa' (NUNCA Alimentação).
- Cerveja / long neck / refrigerante / água / bebidas compradas para casa -> 'Alimentação › Água & Bebidas para Casa' (NUNCA Tabaco & Cigarros).
- Ração / sachê / sachês de pet / petiscos de cachorro ou gato -> 'Pets › Ração & Petiscos' (NUNCA Alimentação Pet ou Compras).
- Fralda / fraldas / lenço umedecido de bebê -> 'Compras › Bebês & Crianças' (NUNCA balde genérico).
- Remédio / medicamento / farmácia -> 'Saúde › Farmácia & Medicamentos' (NUNCA balde genérico).
- Comida de rua / lanches / pastel consumido no local -> 'Restaurantes & Delivery › Fast Food & Lanches' ou 'Restaurantes & Bares' (nunca 'Delivery' a menos que seja entrega em domicílio/app).
- Hortifruti e compras de abastecimento -> 'Alimentação › Hortifruti & Feira'.

=======================================================
11ª REGRA TRANSVERSAL — REGRA DA PROPOSTA (PROPOSE-THEN-CONFIRM)
=======================================================
Aplicável a TODAS as classes de lançamento (1, 2, 3, 4, 5).
Decisão de Produto (ADITAMENTO v1.1 do Contrato de Comportamento):
O usuário NÃO deve precisar conhecer o catálogo — a IA é a especialista em ONDE encaixa; o usuário é a autoridade sobre O QUE comprou.
(a) PERGUNTA ABERTA DE CATEGORIA É TERMINANTEMENTE PROIBIDA em qualquer classe de lançamento ("em qual categoria?", "qual é a categoria?", "onde quer organizar?"). A IA SEMPRE PROPÕE o par mais provável e confirma;
(b) A IA propõe o par (categoria › subcategoria) mais provável para cada item, NOMEANDO o par completo ("Separei liquidificador em **Compras** › **Utilidades & Casa**. Está certo assim?" ou "chupeta → **Compras** › **Bebês & Crianças**"), usando: catálogo real da família + contexto da mensagem + regras de aprendizado existentes;
(c) Se o usuário confirma ("sim", "isso", "pode", "está certo", "pode ser"): o fluxo segue imediatamente para conclusão;
(d) Se o usuário discorda ("não", "não é isso", "errado"): a IA propõe a PRÓXIMA MELHOR opção (ex.: "Que tal **Compras** › **Eletrônicos & Tecnologia**? Fica melhor assim?") — NUNCA volta à pergunta aberta;
(e) Se nada encaixa ou o usuário discordar novamente: a IA propõe CRIAR subcategoria nova ("Nenhuma gaveta encaixa bem — sugiro criar Eletroportáteis em **Compras**. Posso criar?"). Com a confirmação do usuário, a subcategoria é criada no nível da FAMÍLIA (nunca no catálogo canônico global — regra R29);
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
      { role: 'user', content: textoNormalizadoPtBr || texto },
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
          finalMensagemAmigavel = `Lançado: ${valorFormatado} em **${cat}** › **${sub}** 👍!`
        }
      } else {
        const hasCatInMessage =
          typeof finalMensagemAmigavel === 'string' &&
          finalMensagemAmigavel.toLowerCase().includes(cat.toLowerCase())

        if (!hasCatInMessage || finalMensagemAmigavel.includes(' › ')) {
          finalMensagemAmigavel = `Lançado: ${valorFormatado} em **${cat}** 👍!`
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
        if (status === 'sucesso') {
          unmappedItems.push({
            descricao: invalidDesc,
            suggestedCat: fallbackCat,
            suggestedSub: sanitizeItemNameForSub(invalidDesc),
          })
        }
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
