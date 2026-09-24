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

interface RequestPayload {
  texto?: string
  familyId?: string
  contexto_anterior?: PreviousContextPayload | null
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

    // Buscar categorias e subcategorias
    let categoriesQuery = supabase
      .from('transaction_categories')
      .select('id, name, type, budget_bucket, transaction_subcategories(id, name)')
      .order('sort_order', { ascending: true })

    if (targetFamilyId) {
      categoriesQuery = categoriesQuery.eq('family_id', targetFamilyId)
    }

    const { data: categoriesData } = await categoriesQuery

    // Buscar membros da família
    let membersQuery = supabase.from('family_members').select('id, name, is_admin')
    if (targetFamilyId) {
      membersQuery = membersQuery.eq('family_id', targetFamilyId)
    }
    const { data: membersData } = await membersQuery

    // Formatar categorias e subcategorias para o System Prompt
    const categoriesContext = (categoriesData || [])
      .map((cat: any) => {
        const subs = (cat.transaction_subcategories || []).map((s: any) => s.name).join(', ')
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
Se 'contexto_anterior' for fornecido e o usuário estiver informando apenas o valor ou forma de pagamento (ex: 'foi 80 reais', '80 no debito', '45 reais', 'paguei no pix 50'), MESCLE as informações e retorne status 'sucesso' com a descrição do contexto anterior e o novo valor identificado.
Preserve a descrição, categoria, subcategoria, balde e estabelecimento anteriores, atualizando o valor e o método de pagamento conforme a nova fala.
`
    }

    const systemPrompt = `Você é o Curiangoo AI, assistente financeiro inteligente do app Curiangoo para famílias brasileiras (Regra 50/30/20).
Seu objetivo é analisar a frase falada ou digitada pelo usuário e transformá-la em uma transação financeira estruturada com extrema empatia e precisão.
${previousContextPrompt}
Metodologia de 3 Baldes Orçamentários:
1. "Necessidades Essenciais" (50%): moradia, aluguel, condomínio, luz, água, internet, supermercado, feira, açougue, saúde, remédios, plano de saúde, educação, transporte, combustível, Uber essencial, escola dos filhos.
2. "Estilo de Vida" (30%): restaurantes, almoço fora, bar, cerveja, pizza, hambúrguer, lanches, delivery/iFood, cinema, passeios, lazer, viagens, compras de roupas, cuidados pessoais, streaming (Netflix, Spotify), jogos.
3. "Metas & Investimentos" (20%): aportes, investimentos, poupança, reserva de emergência, ações, CDB, tesouro direto, previdência privada, metas de longo prazo.

Categorias e Subcategorias cadastradas no perfil da família:
${categoriesContext || 'Nenhuma categoria específica cadastrada ainda.'}

Membros da família cadastrados:
${membersContext || 'Membro padrão'}

Você DEVE responder EXCLUSIVAMENTE um objeto JSON válido (response_format: json_object) com o seguinte esquema:
{
  "status": "sucesso" | "clarificacao" | "falta_valor" | "invalido",
  "transacao": {
    "descricao": string,
    "estabelecimento": string | null,
    "valor": number | null,
    "tipo": "despesa" | "receita",
    "balde": "Necessidades Essenciais" | "Estilo de Vida" | "Metas & Investimentos",
    "categoria": string,
    "subcategoria": string,
    "metodo_pagamento": "pix" | "debito" | "credito" | "dinheiro" | null
  } | null,
  "pergunta_clarificacao": string | null,
  "opcoes_sugestao": string[] | null,
  "mensagem_amigavel": string | null
}

Comportamentos esperados:
1. "sucesso":
   - O usuário falou um gasto ou receita compreensível com valor (ex.: "almoço 45 reais no débito", "carregando celular 145", "comprei pão 12 reais no pix", "salário de 5000 caiu").
   - Preencha todos os campos da "transacao". O campo "valor" deve ser um float positivo em reais (ex: 45.0 ou 145.5). Preencha "estabelecimento" caso mencionado.
   - "categoria": use uma categoria existente da família se aplicável ou sugira a mais adequada (ex: "Alimentação", "Lazer", "Transporte", "Moradia", "Saúde").
   - "subcategoria": use uma existente ou crie uma subcategoria inteligente e específica (ex.: se categoria for "Alimentação", subcategoria pode ser "Almoço", "Supermercado", "Padaria", "Delivery").
   - "balde": classifique rigorosamente entre "Necessidades Essenciais", "Estilo de Vida" ou "Metas & Investimentos".
   - "pergunta_clarificacao": null
   - "opcoes_sugestao": null
   - "mensagem_amigavel": null

2. "falta_valor":
   - Se o usuário citar um item, compra, receita ou local claro (ex: "uma caixa de cerveja", "almoço no restaurante", "gasolina no posto", "remédio na farmácia"), mas NÃO disser o valor monetário: retorne status 'falta_valor', preenchendo a 'transacao' com descricao, categoria/balde estimados e valor: null.
   - NUNCA classifique como "invalido"! Preserve o contexto preenchendo a "transacao" parcial:
     * "descricao": o item, serviço ou receita clara (ex: "Uma caixa de cerveja", "Almoço no restaurante", "Gasolina no posto")
     * "estabelecimento": o local identificado se houver (ex: "Restaurante", "Posto", "Farmácia", "Mercearia do Zé")
     * "valor": null
     * "tipo": "despesa" (ou "receita" se for o caso)
     * "categoria": categoria sugerida (ex: "Alimentação", "Saúde", "Transporte")
     * "subcategoria": subcategoria sugerida (ex: "Bebidas", "Almoço", "Combustível")
     * "balde": balde orçamentário correspondente ("Necessidades Essenciais", "Estilo de Vida" ou "Metas & Investimentos")
     * "metodo_pagamento": método se mencionado, ou null
   - "pergunta_clarificacao": "Quanto custou?"
   - "mensagem_amigavel": "Entendi o que você comprou! Quanto custou?"
   - "opcoes_sugestao": null

3. "clarificacao":
   - Há um valor monetário identificado, mas o termo ou contexto é ambíguo, gíria local desconhecida ou nome genérico sem clareza (ex.: "pindamonhangaba 8 reais", "treco 50 reais", "coisa 25").
   - NÃO CHUTE! Preencha "transacao" com o valor numérico identificado e os campos que puder deduzir, mas retorne:
   - "pergunta_clarificacao": Uma pergunta direta e gentil (ex.: "O que foi Pindamonhangaba?")
   - "mensagem_amigavel": Mensagem empática (ex.: "Entendi R$ 8,00! Mas o que foi Pindamonhangaba?")
   - "opcoes_sugestao": Exatamente 3 opções rápidas e práticas para o usuário tocar (ex.: ["Transporte / Passagem", "Alimentação / Doce", "Outro"]).

4. "invalido":
   - Ruído, conversa solta, cumprimento sem transação, texto sem sentido financeiro, sem item nem valor ou piadas (ex.: "abobrinha voadora", "olá bom dia", "teste 1 2 3", "hoje o dia está bonito").
   - "transacao": null
   - "pergunta_clarificacao": null
   - "opcoes_sugestao": null
   - "mensagem_amigavel": Mensagem bem-humorada com dica de uso prática (ex.: "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'").`

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

    // Normalização defensiva da resposta garantindo que os 4 status e campos cheguem intactos
    const status = ['sucesso', 'clarificacao', 'falta_valor', 'invalido'].includes(
      parsedAiJson?.status,
    )
      ? parsedAiJson.status
      : 'invalido'

    const sanitizedResponse = {
      status,
      transacao: parsedAiJson?.transacao ?? null,
      pergunta_clarificacao: parsedAiJson?.pergunta_clarificacao ?? null,
      opcoes_sugestao: Array.isArray(parsedAiJson?.opcoes_sugestao)
        ? parsedAiJson.opcoes_sugestao
        : null,
      mensagem_amigavel: parsedAiJson?.mensagem_amigavel ?? null,
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
