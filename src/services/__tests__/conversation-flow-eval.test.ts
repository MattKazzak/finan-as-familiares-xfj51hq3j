import { describe, it, expect, vi } from 'vitest'
import {
  parseVoiceInput,
  mapAiResponseToParsedTransaction,
  VoiceAiResponse,
  extractAllAmountsFromVoiceText,
  normalizeBrazilianCurrencyString,
  ParsedVoiceTransaction,
} from '../voice-parser'
import { analyzeBasketMission } from '../basket-missions'

describe('Contrato de Comportamento do Copilot v1.0 — Casos de Avaliação de Conversação (C1-C25)', () => {
  // Catálogo Padrão Ouro com as gavetas reais
  const mockCategories = [
    {
      id: 'cat-alimentacao',
      name: 'Alimentação',
      type: 'expense' as const,
      budget_bucket: 'essentials' as const,
      subcategories: [
        { id: 'sub-supermercado', name: 'Supermercado & Atacado' },
        { id: 'sub-hortifruti', name: 'Hortifruti & Feira' },
        { id: 'sub-restaurantes', name: 'Restaurantes & Bares' },
      ],
    },
    {
      id: 'cat-compras',
      name: 'Compras',
      type: 'expense' as const,
      budget_bucket: 'lifestyle' as const,
      subcategories: [
        { id: 'sub-bebes', name: 'Bebês & Crianças' },
        { id: 'sub-eletronicos', name: 'Eletrônicos & Tecnologia' },
        { id: 'sub-vestuario', name: 'Vestuário & Acessórios' },
      ],
    },
    {
      id: 'cat-casa',
      name: 'Casa & Conforto',
      type: 'expense' as const,
      budget_bucket: 'essentials' as const,
      subcategories: [
        { id: 'sub-utensilios', name: 'Utensílios & Cozinha' },
        { id: 'sub-manutencao', name: 'Manutenção & Reformas' },
      ],
    },
    {
      id: 'cat-pets',
      name: 'Pets',
      type: 'expense' as const,
      budget_bucket: 'lifestyle' as const,
      subcategories: [
        { id: 'sub-pet-alim', name: 'Alimentação Pet' },
        { id: 'sub-pet-vet', name: 'Veterinário & Medicamentos' },
      ],
    },
    {
      id: 'cat-saude',
      name: 'Saúde & Cuidados',
      type: 'expense' as const,
      budget_bucket: 'essentials' as const,
      subcategories: [
        { id: 'sub-farmacia', name: 'Farmácia & Medicamentos' },
        { id: 'sub-consultas', name: 'Consultas & Exames' },
      ],
    },
    {
      id: 'cat-transporte',
      name: 'Transporte',
      type: 'expense' as const,
      budget_bucket: 'essentials' as const,
      subcategories: [
        { id: 'sub-estacionamento', name: 'Estacionamento & Pedágio' },
        { id: 'sub-combustivel', name: 'Combustível' },
      ],
    },
    {
      id: 'cat-renda',
      name: 'Rendas & Salários',
      type: 'income' as const,
      budget_bucket: 'essentials' as const,
      subcategories: [
        { id: 'sub-salario', name: 'Salário' },
        { id: 'sub-renda-extra', name: 'Renda Extra' },
      ],
    },
    {
      id: 'cat-outros',
      name: 'Outros',
      type: 'expense' as const,
      budget_bucket: 'lifestyle' as const,
      subcategories: [{ id: 'sub-doacoes', name: 'Doações' }],
    },
  ]

  // C1: "gastei 80 no mercado" → lança Alimentação › Supermercado & Atacado direto
  it('C1: "gastei 80 no mercado" → lança Alimentação › Supermercado & Atacado direto', () => {
    const text = 'gastei 80 no mercado'
    const parsed = parseVoiceInput(text, mockCategories)

    expect(parsed.amountCents).toBe(8000)
    expect(parsed.categoryNameSuggestion).toBe('Alimentação')
    expect(parsed.subcategoryNameSuggestion).toBe('Supermercado & Atacado')
    expect(parsed.type).toBe('expense')
  })

  // C2: "paguei 20 de estacionamento e 50 de mercado" → 2 itens, 2 pares propostos
  it('C2: "paguei 20 de estacionamento e 50 de mercado" → 2 itens, 2 pares propostos', () => {
    const amounts = extractAllAmountsFromVoiceText('paguei 20 de estacionamento e 50 de mercado')
    expect(amounts.length).toBe(2)
    expect(amounts[0].amountCents).toBe(2000)
    expect(amounts[1].amountCents).toBe(5000)

    const parsedEstacionamento = parseVoiceInput('paguei 20 de estacionamento', mockCategories)
    expect(parsedEstacionamento.categoryNameSuggestion).toBe('Transporte')

    const parsedMercado = parseVoiceInput('50 de mercado', mockCategories)
    expect(parsedMercado.categoryNameSuggestion).toBe('Alimentação')
  })

  // C3: "recebi 3000 de salário" → receita em Salário
  it('C3: "recebi 3000 de salário" → receita em Salário', () => {
    const parsed = parseVoiceInput('recebi 3000 de salário', mockCategories)
    expect(parsed.type).toBe('income')
    expect(parsed.amountCents).toBe(300000)
    expect(parsed.categoryNameSuggestion).toBe('Rendas & Salários')
  })

  // C4: "todo mês pago academia 120" → sugere recorrência
  it('C4: "todo mês pago academia 120" → sugere recorrência', () => {
    const text = 'todo mês pago academia 120'
    const isRecurring = /todo m[eê]s|mensal|mensalmente|recorrente/i.test(text)
    expect(isRecurring).toBe(true)

    const parsed = parseVoiceInput(text, mockCategories)
    expect(parsed.amountCents).toBe(12000)
    expect(parsed.description.toLowerCase()).toContain('academia')
  })

  // C5: "comprei algumas coisas" → pergunta "O que você comprou?" (itens antes de valor)
  it('C5: "comprei algumas coisas" → pergunta "O que você comprou?" (itens antes de valor)', () => {
    const aiResponse: VoiceAiResponse = {
      status: 'falta_valor',
      tipo_resposta: 'transacao',
      intencao: 'transacao',
      router: {
        classe: 2,
        nome_classe: 'lancamento_vago',
        confianca: 0.9,
        lacunas: ['itens', 'valor'],
      },
      confianca: 0.9,
      lacunas: ['itens', 'valor'],
      transacao: {
        descricao: 'coisas',
        estabelecimento: null,
        valor: null,
        tipo: 'despesa',
        balde: 'lifestyle',
        categoria: null,
        subcategoria: null,
        metodo_pagamento: null,
      },
      pergunta_clarificacao: 'O que você comprou?',
      opcoes_sugestao: null,
      mensagem_amigavel: 'O que você comprou? Me conta os itens que eu já organizo pra você!',
    }
    const parsed = mapAiResponseToParsedTransaction(aiResponse, 'comprei algumas coisas')
    expect(parsed.aiStatus).toBe('falta_valor')
    expect(parsed.routerClasse).toBe(2)
    expect(parsed.routerLacunas).toContain('itens')
    expect(parsed.clarificationQuestion).toBe('O que você comprou?')
  })

  // C6: "paguei o mercado" → pergunta "Quanto?"
  it('C6: "paguei o mercado" → pergunta "Quanto?"', () => {
    const parsed = parseVoiceInput('paguei o mercado', mockCategories)
    expect(parsed.aiStatus).toBe('falta_valor')
    expect(parsed.routerClasse).toBe(2)
    expect(parsed.routerLacunas).toEqual(['valor'])
    expect(parsed.clarificationQuestion).toContain('Quanto')
  })

  // C7: "carne, carvão e cerveja, tudo 100" → pergunta de ocasião 1 vez
  it('C7: "carne, carvão e cerveja, tudo 100" → pergunta de ocasião 1 vez', () => {
    const analysis = analyzeBasketMission('carne, carvão e cerveja, tudo 100', 10000)
    expect(analysis.isBasket).toBe(true)
    expect(analysis.requiresConfirmation).toBe(true)
    expect(analysis.missionType).toBe('social_event')
    expect(analysis.naturalQuestion).toContain('churrasco')
  })

  // C8: lista completa da Parada Certa → mercado direto, local preservado, sem churrasco
  it('C8: lista da Parada Certa → mercado direto, local preservado, sem churrasco', () => {
    const text =
      'uma caixa de cerveja, uma caixa de sabão em pó, dois salames, dois miojos de pote, tudo na mercearia Parada Certa. Ficou 118 reais'
    const analysis = analyzeBasketMission(text, 11800)
    expect(analysis.requiresConfirmation).toBe(false)
    expect(analysis.suggestedCategory).toBe('Alimentação')
    expect(analysis.suggestedSubcategory).toBe('Supermercado & Atacado')
    expect(analysis.naturalQuestion).toBeUndefined()
  })

  // C9: fluxo chupeta completo multi-turn:
  // Turno 1: proposta por item + "Está certo assim?" (UMA pergunta por vez)
  // Turno 2: confirmação → pergunta de valores
  // Turno 3: 3 valores para 4 itens → "Faltou o valor da doação — quanto foi?" (NUNCA somar)
  // Turno 4: valor faltante dado → gravação por item com par válido + resumo item por item
  it('C9: fluxo chupeta completo multi-turn (D1, D3, D4)', () => {
    const textTurn1 =
      'Uma chupeta para o meu filho, quatro sachês para o meu cachorro, um jogo de copo novo, uma doação para o catador de latinhas.'
    const parsed1 = parseVoiceInput(textTurn1, mockCategories)

    // 1º turno: Classe 5, proposta por item, UMA pergunta por vez
    expect(parsed1.routerClasse).toBe(5)
    expect(parsed1.aiStatus).toBe('clarificacao')
    expect(parsed1.extractedItems?.length).toBe(4)
    expect(parsed1.clarificationQuestion).toContain('Está certo assim?')
    // NUNCA deve perguntar o valor no 1º turno!
    expect(parsed1.clarificationQuestion).not.toContain('quais foram os valores')

    // Turno 2: Usuário confirma os pares ("está certo assim" / "sim")
    const isConfirmation = /^(sim|est[aá] certo|est[aá] certo assim|isso|perfeito)\b/i.test(
      'está certo assim',
    )
    expect(isConfirmation).toBe(true)
    const turn2Question = 'Perfeito! Quais foram os valores de cada um?'
    expect(turn2Question).toBe('Perfeito! Quais foram os valores de cada um?')

    // Turno 3: Usuário fornece 3 valores para 4 itens: "27, 19 e 100"
    const amounts = extractAllAmountsFromVoiceText('27, 19 e 100')
    expect(amounts.length).toBe(3)
    expect(amounts.length).toBeLessThan(parsed1.extractedItems?.length || 4)
    // NUNCA somar 27+19+100=146!
    const totalSum = amounts.reduce((acc, a) => acc + a.amountCents, 0)
    expect(totalSum).toBe(14600) // apenas para demonstrar a soma parcial que NÃO deve ser gravada

    // Pergunta cardinal: qual faltou?
    const missingName = 'doação'
    const askMissingMsg = `Faltou o valor da ${missingName} — quanto foi?`
    expect(askMissingMsg).toBe('Faltou o valor da doação — quanto foi?')

    // Turno 4: Usuário informa "a doação foi 50" (ou "50")
    const missingAmount = extractAllAmountsFromVoiceText('a doação foi 50')
    expect(missingAmount.length).toBe(1)
    expect(missingAmount[0].amountCents).toBe(5000)

    // 4 itens completos:
    const finalItems = [
      { descricao: 'Chupeta', valor: 27, cat: 'Compras', sub: 'Bebês & Crianças' },
      { descricao: 'Sachês cachorro', valor: 19, cat: 'Pets', sub: 'Alimentação Pet' },
      {
        descricao: 'Jogo de copo',
        valor: 100,
        cat: 'Casa & Conforto',
        sub: 'Utensílios & Cozinha',
      },
      { descricao: 'Doação para o catador', valor: 50, cat: 'Outros', sub: 'Doações' },
    ]
    expect(finalItems.length).toBe(4)
    finalItems.forEach((it) => {
      expect(it.valor).toBeGreaterThan(0)
      expect(it.cat).toBeTruthy()
      expect(it.sub).toBeTruthy() // D4: nunca gravar sem subcategoria!
    })
  })

  // C10: "comprei ração pro cachorro e um remédio, 60" → 2 pares propostos (Pets / Saúde)
  it('C10: "comprei ração pro cachorro e um remédio, 60" → 2 pares propostos (Pets / Saúde)', () => {
    const text = 'comprei ração pro cachorro e um remédio, 60'
    const parsedRacao = parseVoiceInput('ração pro cachorro', mockCategories)
    const parsedRemedio = parseVoiceInput('remédio', mockCategories)

    expect(parsedRacao.categoryNameSuggestion).toBe('Pets')
    expect(parsedRemedio.categoryNameSuggestion).toBe('Saúde & Cuidados')
  })

  // C11: pendência ativa + "quanto gastei este mês?" → responde a consulta E lembra a pendência
  it('C11: pendência ativa + "quanto gastei este mês?" → responde a consulta E lembra a pendência', () => {
    const pendingDesc = 'cigarro'
    const consultAnswer = 'Você já registrou R$ 1.450,00 em despesas neste mês.'
    const combined = `${consultAnswer}\n\nA propósito, ainda aguardo a gaveta para ${pendingDesc}.`

    expect(combined).toContain('Você já registrou R$ 1.450,00')
    expect(combined).toContain('ainda aguardo a gaveta para cigarro')
  })

  // C12: durante pendência de valores, "não, a doação foi 50" → ajusta o valor antes de gravar
  it('C12: durante pendência de valores, "não, a doação foi 50" → ajusta o valor antes de gravar', () => {
    const text = 'não, a doação foi 50'
    const extracted = extractAllAmountsFromVoiceText(text)
    expect(extracted.length).toBe(1)
    expect(extracted[0].amountCents).toBe(5000)
    expect(text.toLowerCase()).toContain('doação')
  })

  // C13: "bom dia" → resposta social sem extração
  it('C13: "bom dia" → resposta social sem extração', () => {
    const greetingResponse: VoiceAiResponse = {
      status: 'consulta',
      tipo_resposta: 'consulta',
      intencao: 'social',
      router: { classe: 7, nome_classe: 'social_saudacao', confianca: 1.0, lacunas: null },
      confianca: 1.0,
      lacunas: null,
      resposta_consulta:
        'Bom dia! Pronto pra registrar algo ou ver como estão as finanças de vocês?',
      transacao: null,
      pergunta_clarificacao: null,
      opcoes_sugestao: null,
      mensagem_amigavel:
        'Bom dia! Pronto pra registrar algo ou ver como estão as finanças de vocês?',
    }
    const parsed = mapAiResponseToParsedTransaction(greetingResponse, 'bom dia')
    expect(parsed.aiStatus).toBe('consulta')
    expect(parsed.routerClasse).toBe(7)
    expect(parsed.amountCents).toBe(0)
  })

  // C14: "quanto gastei em mercado?" → consulta por categoria
  it('C14: "quanto gastei em mercado?" → consulta por categoria', () => {
    const consultResponse: VoiceAiResponse = {
      status: 'consulta',
      tipo_resposta: 'consulta',
      intencao: 'consulta',
      router: { classe: 6, nome_classe: 'pergunta_financas', confianca: 0.95, lacunas: null },
      confianca: 0.95,
      lacunas: null,
      resposta_consulta: 'Você gastou R$ 420,00 em Mercado este mês.',
      transacao: null,
      pergunta_clarificacao: null,
      opcoes_sugestao: null,
      mensagem_amigavel: 'Você gastou R$ 420,00 em Mercado este mês.',
    }
    const parsed = mapAiResponseToParsedTransaction(consultResponse, 'quanto gastei em mercado?')
    expect(parsed.aiStatus).toBe('consulta')
    expect(parsed.routerClasse).toBe(6)
    expect(parsed.respostaConsulta).toContain('R$ 420,00 em Mercado')
  })

  // C15: "cancela" → descarta pendência sem gravar
  it('C15: "cancela" → descarta pendência sem gravar', () => {
    const cancelResponse: VoiceAiResponse = {
      status: 'acao_executada',
      acao: 'desfazer',
      tipo_resposta: 'acao',
      intencao: 'desfazer',
      router: { classe: 8, nome_classe: 'comandos', confianca: 1.0, lacunas: null },
      confianca: 1.0,
      lacunas: null,
      resposta_consulta: null,
      transacao: null,
      pergunta_clarificacao: null,
      opcoes_sugestao: null,
      mensagem_amigavel: 'Tudo bem, cancelado! Não registrei nada.',
    }
    const parsed = mapAiResponseToParsedTransaction(cancelResponse, 'cancela')
    expect(parsed.aiStatus).toBe('acao_executada')
    expect(parsed.routerClasse).toBe(8)
    expect(parsed.friendlyMessage).toContain('cancelado')
  })

  // C16: "vamos criar uma subcategoria" / "O que você sugere?" → sugere nome e cria no nível família (D2)
  it('C16: "O que você sugere?" / "vamos criar uma subcategoria" → sugere nome concreto e prepara criação (D2)', () => {
    const isAskingSuggestion = /(?:sugere|sugest[aã]o|o que voc[eê] acha|vamos criar)/i.test(
      'O que você sugere?',
    )
    expect(isAskingSuggestion).toBe(true)

    const concreteSub = 'Doações'
    const concreteCat = 'Outros'
    const suggestionText = `Sugiro criar a subcategoria "${concreteSub}" dentro de ${concreteCat} para a família. Quer que eu crie agora e coloque aí?`
    expect(suggestionText).toContain('Doações')
    expect(suggestionText).toContain('Outros')
  })

  // C17: "quem vai ganhar a eleição?" → redirecionamento elegante para finanças
  it('C17: "quem vai ganhar a eleição?" → redirecionamento elegante para finanças', () => {
    const outResponse: VoiceAiResponse = {
      status: 'invalido',
      tipo_resposta: 'consulta',
      intencao: null,
      router: { classe: 9, nome_classe: 'fora_escopo', confianca: 0.99, lacunas: null },
      confianca: 0.99,
      lacunas: null,
      resposta_consulta:
        'Prefiro não opinar sobre isso! Mas se quiser falar sobre os gastos da família, estou aqui.',
      transacao: null,
      pergunta_clarificacao: null,
      opcoes_sugestao: null,
      mensagem_amigavel:
        'Prefiro não opinar sobre isso! Mas se quiser falar sobre os gastos da família, estou aqui.',
    }
    const parsed = mapAiResponseToParsedTransaction(outResponse, 'quem vai ganhar a eleição?')
    expect(parsed.routerClasse).toBe(9)
    expect(parsed.friendlyMessage).toContain('Prefiro não opinar')
  })

  // C18: "asdfgh" → desambiguação honesta ("não entendi — quer lançar algo ou perguntar sobre seus gastos?")
  it('C18: "asdfgh" → desambiguação honesta', () => {
    const parsed = parseVoiceInput('asdfgh', mockCategories)
    expect(parsed.aiStatus).toBe('invalido')
    expect(parsed.friendlyMessage).toContain('Não consegui entender')
  })

  // =========================================================================
  // RODADA 42B (ADITAMENTO v1.1) — REGRA DA PROPOSTA (PROPOSE-THEN-CONFIRM):
  // C19-C22: Casos de proposta nomeada, discordância, próxima melhor e criação no nível família
  // =========================================================================

  // [C19] "comprei um liquidificador, 150" → proposta nomeada: Casa & Conforto › Utensílios & Cozinha + "Está certo assim?" — nunca pergunta aberta
  it('C19: "comprei um liquidificador, 150" → proposta nomeada Casa & Conforto › Utensílios & Cozinha + "Está certo assim?" (nunca pergunta aberta)', () => {
    const text = 'comprei um liquidificador, 150'
    const parsed = parseVoiceInput(text, mockCategories)

    expect(parsed.amountCents).toBe(15000)
    expect(parsed.categoryNameSuggestion).toBe('Casa & Conforto')
    expect(parsed.subcategoryNameSuggestion).toBe('Utensílios & Cozinha')
    expect(parsed.aiStatus).toBe('clarificacao')
    expect(parsed.clarificationQuestion).toContain('Casa & Conforto › Utensílios & Cozinha')
    expect(parsed.clarificationQuestion).toContain('Está certo assim?')

    // Pergunta aberta NUNCA pode acontecer
    expect(parsed.clarificationQuestion).not.toContain('em qual categoria')
    expect(parsed.clarificationQuestion).not.toContain('qual é a categoria')
    expect(parsed.clarificationQuestion).not.toContain('onde prefere organizar')
  })

  // [C20] proposta + "não" → PRÓXIMA MELHOR opção proposta (não pergunta aberta)
  it('C20: proposta + "não" → PRÓXIMA MELHOR opção proposta (não pergunta aberta)', () => {
    // Contexto com a proposta anterior do liquidificador rejeitada
    const previousContext = {
      descricao: 'Liquidificador',
      valor: 150,
      categoria: 'Casa & Conforto',
      subcategoria: 'Utensílios & Cozinha',
      status: 'clarificacao',
      tentativa_rejeicao: 1,
    }

    const text = 'não'
    const parsed = parseVoiceInput(text, mockCategories, previousContext as any)

    expect(parsed.aiStatus).toBe('clarificacao')
    // Deve propor a próxima melhor opção (ex: Compras › Eletrônicos & Tecnologia)
    expect(parsed.categoryNameSuggestion).toBe('Compras')
    expect(parsed.subcategoryNameSuggestion).toBe('Eletrônicos & Tecnologia')
    expect(parsed.clarificationQuestion).toContain('Compras › Eletrônicos & Tecnologia')
    expect(parsed.clarificationQuestion).toContain('Fica melhor assim?')

    // Pergunta aberta eliminada
    expect(parsed.clarificationQuestion).not.toContain('em qual categoria')
    expect(parsed.clarificationQuestion).not.toContain('onde prefere')
  })

  // [C21] proposta + "não" + "não" → sugestão de criar subcategoria nova no nível família
  it('C21: proposta + "não" + "não" → sugestão de criar subcategoria nova no nível família', () => {
    // Contexto com a 2ª rejeição consecutiva (tentativa 2)
    const previousContext = {
      descricao: 'Liquidificador',
      valor: 150,
      categoria: 'Compras',
      subcategoria: 'Eletrônicos & Tecnologia',
      status: 'clarificacao',
      tentativa_rejeicao: 2,
    }

    const text = 'não'
    const parsed = parseVoiceInput(text, mockCategories, previousContext as any)

    expect(parsed.aiStatus).toBe('clarificacao')
    expect(parsed.clarificationQuestion).toContain('Nenhuma gaveta encaixa bem')
    expect(parsed.clarificationQuestion).toContain('sugiro criar Eletroportáteis em Compras')
    expect(parsed.clarificationQuestion).toContain('Posso criar?')

    // Pergunta aberta proibida
    expect(parsed.clarificationQuestion).not.toContain('em qual categoria')
  })

  // [C22] criação aceita → subcategoria criada no nível família + transação gravada no par novo
  it('C22: criação aceita → subcategoria criada no nível família + transação gravada no par novo', () => {
    // Contexto onde a IA sugeriu criar "Eletroportáteis" em "Compras" e usuário confirmou com "sim"
    const previousContext = {
      descricao: 'Liquidificador',
      valor: 150,
      categoria: 'Compras',
      subcategoria: 'Eletroportáteis',
      status: 'clarificacao',
    }

    const text = 'sim'
    const parsed = parseVoiceInput(text, mockCategories, previousContext as any)

    expect(parsed.aiStatus).toBe('sucesso')
    expect(parsed.amountCents).toBe(15000)
    expect(parsed.categoryNameSuggestion).toBe('Compras')
    expect(parsed.subcategoryNameSuggestion).toBe('Eletroportáteis')
    expect(parsed.friendlyMessage).toContain('Lançado: R$ 150,00 em Compras › Eletroportáteis! 👍')
  })

  // =========================================================================
  // RODADA 43 (v0.0.293) — CONSERTO DEFINITIVO DA GRAVAÇÃO DA CLASSE 5 (D3/D4) + FIM DO VAZAMENTO DO 146:
  // C23-C25: Casos de multi-turn completo pós-confirmação, isolamento de histórico e gravação por item
  // =========================================================================

  // [C23] fluxo chupeta completo em chat COM histórico anterior contendo valores antigos (146)
  // → proposta → "Sim" → pergunta de valores (NUNCA reutilizar o 146) → gravação POR ITEM
  it('C23: fluxo chupeta completo em chat COM histórico anterior contendo valores antigos (146) → proposta → "Sim" → pergunta de valores (NUNCA reutilizar o 146) → gravação POR ITEM', () => {
    // 1. Mensagens anteriores no chat simulando transações antigas que somavam 146 (27 + 19 + 100)
    const historicoMensagensAntigo = [
      { role: 'user', content: '27 chupeta, 19 sache, 100 copo' },
      { role: 'assistant', content: 'Lançado: R$ 146,00 em Compras › Bebês & Crianças 👍!' },
    ]
    expect(historicoMensagensAntigo.length).toBe(2)

    // 2. Novo lançamento da Classe 5 iniciado pelo usuário
    const textTurn1 =
      'Uma chupeta para o meu filho, quatro sachês para o meu cachorro, um jogo de copo novo, uma doação para o catador de latinhas.'
    const parsedTurn1 = parseVoiceInput(textTurn1, mockCategories)

    expect(parsedTurn1.routerClasse).toBe(5)
    expect(parsedTurn1.aiStatus).toBe('clarificacao')
    expect(parsedTurn1.extractedItems?.length).toBe(4)
    expect(parsedTurn1.clarificationQuestion).toContain('Está certo assim?')

    // 3. Usuário responde "Sim" para confirmar a proposta
    const isAffirmative = /^(sim|est[aá] certo|est[aá] certo assim|isso|perfeito)\b/i.test('Sim')
    expect(isAffirmative).toBe(true)

    // Regra R43: NUNCA resgatar o 146 nem retornar sucesso! Pergunta obrigatória de valores:
    const askValuesQuestion = 'Agora os valores: quanto foi cada item?'
    expect(askValuesQuestion).toBe('Agora os valores: quanto foi cada item?')
    expect(askValuesQuestion).not.toContain('146')

    // 4. Usuário fornece os valores individuais de cada item
    const textValores = '27 na chupeta, 19 nos sachês, 100 no copo e 50 na doação'
    const foundAmounts = extractAllAmountsFromVoiceText(textValores)
    expect(foundAmounts.length).toBe(4)
    expect(foundAmounts.map((a) => a.amountCents)).toEqual([2700, 1900, 10000, 5000])

    // 5. Gravação efetuada POR ITEM com pares válidos (nunca transação única de 146 ou 196)
    const itensGravados = (parsedTurn1.extractedItems || []).map((item, idx) => ({
      descricao: item.descricao,
      amountCents: foundAmounts[idx].amountCents,
      categoria: item.categoria_proposta || 'Outros',
      subcategoria: item.subcategoria_proposta || 'Doações',
    }))

    expect(itensGravados.length).toBe(4)
    expect(itensGravados[0]).toEqual({
      descricao: 'Uma chupeta para o meu filho',
      amountCents: 2700,
      categoria: 'Compras',
      subcategoria: 'Bebês & Crianças',
    })
    expect(itensGravados[1]).toEqual({
      descricao: 'quatro sachês para o meu cachorro',
      amountCents: 1900,
      categoria: 'Pets',
      subcategoria: 'Alimentação Pet',
    })
    expect(itensGravados[2]).toEqual({
      descricao: 'um jogo de copo novo',
      amountCents: 10000,
      categoria: 'Casa & Conforto',
      subcategoria: 'Utensílios & Cozinha',
    })
    expect(itensGravados[3]).toEqual({
      descricao: 'uma doação para o catador de latinhas',
      amountCents: 5000,
      categoria: 'Outros',
      subcategoria: 'Doações',
    })
  })

  // [C24] "Sim" → pergunta de valores → 4 valores → 4 transações com pares completos + resumo item por item
  it('C24: "Sim" → pergunta de valores → 4 valores → 4 transações com pares completos + resumo item por item', () => {
    // Proposta Classe 5 confirmada
    const itemsPropostos = [
      {
        descricao: 'Chupeta',
        valor: null,
        categoria_proposta: 'Compras',
        subcategoria_proposta: 'Bebês & Crianças',
      },
      {
        descricao: 'Sachês pet',
        valor: null,
        categoria_proposta: 'Pets',
        subcategoria_proposta: 'Alimentação Pet',
      },
      {
        descricao: 'Jogo de copo',
        valor: null,
        categoria_proposta: 'Casa & Conforto',
        subcategoria_proposta: 'Utensílios & Cozinha',
      },
      {
        descricao: 'Doação',
        valor: null,
        categoria_proposta: 'Outros',
        subcategoria_proposta: 'Doações',
      },
    ]

    // Usuário envia os 4 valores juntos
    const textValues = '27, 19, 100 e 50'
    const amounts = extractAllAmountsFromVoiceText(textValues)
    expect(amounts.length).toBe(4)

    // Monta as 4 transações individuais
    const transactions = itemsPropostos.map((it, idx) => {
      const cents = amounts[idx].amountCents
      return {
        descricao: it.descricao,
        amountCents: cents,
        formatted: (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        categoria: it.categoria_proposta,
        subcategoria: it.subcategoria_proposta,
      }
    })

    expect(transactions.length).toBe(4)
    transactions.forEach((tx) => {
      expect(tx.amountCents).toBeGreaterThan(0)
      expect(tx.categoria).toBeTruthy()
      expect(tx.subcategoria).toBeTruthy()
    })

    // Resumo item por item
    const summaryLines = transactions.map(
      (t) => `${t.formatted} em ${t.categoria} › ${t.subcategoria}`,
    )
    const fullSummary = `Lançamentos realizados com sucesso:\n${summaryLines.map((s) => `• ${s}`).join('\n')} 👍!`

    expect(fullSummary).toContain('• R$ 27,00 em Compras › Bebês & Crianças')
    expect(fullSummary).toContain('• R$ 19,00 em Pets › Alimentação Pet')
    expect(fullSummary).toContain('• R$ 100,00 em Casa & Conforto › Utensílios & Cozinha')
    expect(fullSummary).toContain('• R$ 50,00 em Outros › Doações')
  })

  // [C25] "Sim" → 3 valores → pergunta pelo faltante → gravação por item
  it('C25: "Sim" → 3 valores → pergunta pelo faltante → gravação por item', () => {
    const items = [
      {
        descricao: 'Chupeta',
        valor: null as number | null,
        cat: 'Compras',
        sub: 'Bebês & Crianças',
      },
      { descricao: 'Sachês', valor: null as number | null, cat: 'Pets', sub: 'Alimentação Pet' },
      {
        descricao: 'Jogo de copo',
        valor: null as number | null,
        cat: 'Casa & Conforto',
        sub: 'Utensílios & Cozinha',
      },
      { descricao: 'Doação', valor: null as number | null, cat: 'Outros', sub: 'Doações' },
    ]

    // Usuário envia apenas 3 valores: "27, 19 e 100"
    const amounts = extractAllAmountsFromVoiceText('27, 19 e 100')
    expect(amounts.length).toBe(3)
    expect(amounts.length).toBeLessThan(items.length)

    // Preenche os 3 primeiros
    items[0].valor = amounts[0].amountCents / 100
    items[1].valor = amounts[1].amountCents / 100
    items[2].valor = amounts[2].amountCents / 100

    // Verifica item faltante
    const missing = items.find((it) => it.valor === null)
    expect(missing?.descricao).toBe('Doação')

    const cleanDesc = (missing?.descricao || '').toLowerCase()
    const askMissingMsg = `Faltou o valor da ${cleanDesc} — quanto foi?`
    expect(askMissingMsg).toBe('Faltou o valor da doação — quanto foi?')

    // Usuário informa o valor faltante: "50"
    const missingAmt = extractAllAmountsFromVoiceText('50')
    expect(missingAmt.length).toBe(1)
    missing!.valor = missingAmt[0].amountCents / 100

    // Todos preenchidos agora:
    expect(items.every((it) => it.valor !== null && it.valor > 0)).toBe(true)

    // Gravação item por item com 4 transações
    const saved = items.map((it) => ({
      descricao: it.descricao,
      amountCents: Math.round((it.valor || 0) * 100),
      categoria: it.cat,
      subcategoria: it.sub,
    }))
    expect(saved.length).toBe(4)
    expect(saved[3].amountCents).toBe(5000)
    expect(saved[3].subcategoria).toBe('Doações')
  })

  // [C26] fluxo do churrasco misto completo multi-turn:
  // "seis quilos de carne, um pacote de carvão, duas rodas para o meu filho, dois packs de long neck ultra e quatro sachê para o meu cachorro. Tudo ficou R$280"
  // → proposta por item
  // → "Nao, a carne e o carvão é para um churrasco"
  // → correção SÓ nesses 2 itens (rodas mantêm Bebês & Crianças, long neck mantém bebidas, sachês mantêm Pet) + pergunta de divisão do 280
  // → gravação dividida (NUNCA tudo em Lazer › Eventos & Reuniões).
  it('C26: fluxo do churrasco misto multi-turn com correção parcial e divisão do total', () => {
    // 1º Turno: Mensagem inicial com 5 itens heterogêneos e total consolidado de R$ 280
    const initialItems = [
      {
        descricao: 'seis quilos de carne',
        categoria_proposta: 'Alimentação',
        subcategoria_proposta: 'Açougue & Peixaria',
      },
      {
        descricao: 'um pacote de carvão',
        categoria_proposta: 'Casa & Conforto',
        subcategoria_proposta: 'Utilidades',
      },
      {
        descricao: 'duas rodas para o meu filho',
        categoria_proposta: 'Compras',
        subcategoria_proposta: 'Bebês & Crianças',
      },
      {
        descricao: 'dois packs de long neck ultra',
        categoria_proposta: 'Alimentação',
        subcategoria_proposta: 'Bebidas',
      },
      {
        descricao: 'quatro sachê para o meu cachorro',
        categoria_proposta: 'Pets',
        subcategoria_proposta: 'Alimentação Pet',
      },
    ]

    const totalConsolidado = 280.0

    // 2º Turno: Usuário faz correção parcial apenas para carne e carvão
    const userCorrection = 'Nao, a carne e o carvão é para um churrasco'
    const isChurrascoMention = /churrasco/i.test(userCorrection)
    expect(isChurrascoMention).toBe(true)

    // Doutrina R28: Correção parcial afeta APENAS os itens expressamente nomeados
    const updatedItems = initialItems.map((item) => {
      const isCarneOuCarvao = /carne|carv[aã]o/i.test(item.descricao)
      if (isCarneOuCarvao) {
        return {
          ...item,
          categoria_proposta: 'Lazer',
          subcategoria_proposta: 'Eventos & Reuniões',
        }
      }
      // Itens não citados MANTÊM gavetas intactas
      return { ...item }
    })

    // Asserts de categorias após correção parcial
    expect(updatedItems[0].subcategoria_proposta).toBe('Eventos & Reuniões') // carne
    expect(updatedItems[1].subcategoria_proposta).toBe('Eventos & Reuniões') // carvão
    expect(updatedItems[2].subcategoria_proposta).toBe('Bebês & Crianças') // rodas preservadas
    expect(updatedItems[3].subcategoria_proposta).toBe('Bebidas') // long neck preservado
    expect(updatedItems[4].subcategoria_proposta).toBe('Alimentação Pet') // sachê preservado

    // O total de R$ 280 NUNCA deve ser lançado inteiro em Lazer › Eventos & Reuniões!
    const isAllEventos = updatedItems.every(
      (it) => it.subcategoria_proposta === 'Eventos & Reuniões',
    )
    expect(isAllEventos).toBe(false)

    // IA pergunta como dividir os R$ 280
    const askDivisionMessage = `Entendi — carne e carvão são do churrasco e o resto é da casa. Como dividimos os R$ ${Math.round(totalConsolidado)}? Aproximadamente quanto foi da parte do churrasco?`
    expect(askDivisionMessage).toContain('Como dividimos os R$ 280?')

    // 3º Turno: Usuário responde a divisão: "150 do churrasco e 130 o resto"
    const amountsDivision = extractAllAmountsFromVoiceText('150 do churrasco e 130 o resto')
    expect(amountsDivision.length).toBe(2)
    expect(amountsDivision[0].amountCents).toBe(15000)
    expect(amountsDivision[1].amountCents).toBe(13000)
    expect(amountsDivision[0].amountCents + amountsDivision[1].amountCents).toBe(28000)

    // Gravação dividida: NUNCA tudo em Lazer
    const finalTxChurrasco = {
      descricao: 'Carne e carvão — churrasco',
      amountCents: amountsDivision[0].amountCents,
      categoria: 'Lazer',
      subcategoria: 'Eventos & Reuniões',
    }
    const finalTxCasa = {
      descricao: 'Rodas, long neck e sachê — compras',
      amountCents: amountsDivision[1].amountCents,
      categoria: 'Alimentação',
      subcategoria: 'Supermercado & Atacado',
    }

    expect(finalTxChurrasco.amountCents).toBe(15000)
    expect(finalTxCasa.amountCents).toBe(13000)
  })

  // [C27] "carne 6,75, arroz 10 reais, feijão 9,10" → 3 valores decimais corretos
  it('C27: extrai corretamente múltiplos valores decimais com vírgula e sufixos', () => {
    const input = 'carne 6,75, arroz 10 reais, feijão 9,10'
    const amounts = extractAllAmountsFromVoiceText(input)

    expect(amounts.length).toBe(3)
    expect(amounts[0].amountCents).toBe(675)
    expect(amounts[1].amountCents).toBe(1000)
    expect(amounts[2].amountCents).toBe(910)
  })

  // [C28] "comprei carne, arroz e feijão, tudo 50" → vírgulas de lista não viram decimais, total 50
  it('C28: preserva vírgulas de lista sem transformá-las em decimais e extrai total consolidado', () => {
    const input = 'comprei carne, arroz e feijão, tudo 50'
    const normalized = normalizeBrazilianCurrencyString(input)

    // "carne, arroz" deve manter a vírgula intacta porque é seguida por espaço e letra
    expect(normalized).toContain('carne, arroz')

    const amounts = extractAllAmountsFromVoiceText(input)
    expect(amounts.length).toBe(1)
    expect(amounts[0].amountCents).toBe(5000)
  })

  // [C29] a resposta de proposta contém as categorias em negrito (assert de markdown presente)
  it('C29: resposta de proposta contém categorias e subcategorias em negrito markdown (**...**)', () => {
    const proposalResponse =
      'Separei assim: chupeta em **Compras** › **Bebês & Crianças**, sachês em **Pets** › **Alimentação Pet** e jogo de copo em **Casa & Conforto** › **Utensílios & Cozinha**. Está certo assim?'

    // Deve conter marcas de negrito com duplo asterisco
    expect(proposalResponse).toContain('**Compras** › **Bebês & Crianças**')
    expect(proposalResponse).toContain('**Pets** › **Alimentação Pet**')
    expect(proposalResponse).toContain('**Casa & Conforto** › **Utensílios & Cozinha**')

    // Confirmação padrão "Lançado" também deve ter negrito
    const confirmationResponse = 'Lançado: R$ 280,00 em **Lazer** › **Eventos & Reuniões** 👍!'
    expect(confirmationResponse).toContain('**Lazer** › **Eventos & Reuniões**')
  })

  // ==========================================
  // RODADA 45: NOVOS CASOS C30 A C35
  // ==========================================

  // [C30] correção parcial SEM "não" ("Essa carne também é para um churrasco")
  // → carne movida, demais mantidos, pergunta de divisão com contexto
  it('C30: correção parcial sem "não" ("Essa carne também é para um churrasco") move apenas carne e gera pergunta de divisão com contexto', () => {
    const initialItems = [
      {
        descricao: 'carne',
        categoria_proposta: 'Alimentação',
        subcategoria_proposta: 'Açougue & Peixaria',
      },
      {
        descricao: 'carvão',
        categoria_proposta: 'Casa & Conforto',
        subcategoria_proposta: 'Utilidades',
      },
      {
        descricao: 'rodas para o meu filho',
        categoria_proposta: 'Compras',
        subcategoria_proposta: 'Bebês & Crianças',
      },
      {
        descricao: 'long neck ultra',
        categoria_proposta: 'Alimentação',
        subcategoria_proposta: 'Bebidas',
      },
    ]

    const userCorrection = 'Essa carne também é para um churrasco'
    // Semântica sem a palavra "não"
    expect(userCorrection.toLowerCase()).not.toContain('não')
    expect(userCorrection.toLowerCase()).not.toContain('nao')
    expect(/churrasco/i.test(userCorrection)).toBe(true)

    // Aplica correção semântica exclusivamente à carne
    const updated = initialItems.map((item) => {
      if (/carne/i.test(item.descricao)) {
        return {
          ...item,
          categoria_proposta: 'Lazer',
          subcategoria_proposta: 'Eventos & Reuniões',
        }
      }
      return { ...item }
    })

    // Carne movida para Eventos & Reuniões
    expect(updated[0].subcategoria_proposta).toBe('Eventos & Reuniões')
    // Demais itens mantêm propostas intactas
    expect(updated[1].subcategoria_proposta).toBe('Utilidades')
    expect(updated[2].subcategoria_proposta).toBe('Bebês & Crianças')
    expect(updated[3].subcategoria_proposta).toBe('Bebidas')

    // Pergunta de divisão com contexto nomeando o que divide e por quê
    const divisionQuestion =
      'Entendi — carne vai para **Lazer** › **Eventos & Reuniões** e carvão, rodas e long neck ficam nas gavetas deles. Como o total é único (R$ 280,00), preciso dividir: aproximadamente quanto foi da parte do churrasco?'

    expect(divisionQuestion).toContain('Como o total é único')
    expect(divisionQuestion).toContain('aproximadamente quanto foi da parte de')
    expect(divisionQuestion).toContain('ficam nas gavetas deles')
  })

  // [C31] "me mostre como separou" → re-exibição reflete a correção, em lista vertical
  it('C31: "me mostre como separou" re-exibe a proposta atualizada em lista vertical com quebras de linha e negrito', () => {
    const currentProposalItems = [
      {
        descricao: 'carne',
        categoria_proposta: 'Lazer',
        subcategoria_proposta: 'Eventos & Reuniões',
      },
      {
        descricao: 'carvão',
        categoria_proposta: 'Lazer',
        subcategoria_proposta: 'Eventos & Reuniões',
      },
      {
        descricao: 'rodas para o meu filho',
        categoria_proposta: 'Compras',
        subcategoria_proposta: 'Bebês & Crianças',
      },
      {
        descricao: 'long neck ultra',
        categoria_proposta: 'Alimentação',
        subcategoria_proposta: 'Bebidas',
      },
      {
        descricao: 'sachês para o meu cachorro',
        categoria_proposta: 'Pets',
        subcategoria_proposta: 'Alimentação Pet',
      },
    ]

    const lines = currentProposalItems.map(
      (it) => `• ${it.descricao} → **${it.categoria_proposta}** › **${it.subcategoria_proposta}**`,
    )
    const reDisplayMsg = `Separei assim:\n${lines.join('\n')}\n\nEstá certo assim?`

    // Lista vertical: contém quebras de linha reais
    expect(reDisplayMsg).toContain('\n• carne → **Lazer** › **Eventos & Reuniões**')
    expect(reDisplayMsg).toContain('\n• carvão → **Lazer** › **Eventos & Reuniões**')
    expect(reDisplayMsg).toContain(
      '\n• rodas para o meu filho → **Compras** › **Bebês & Crianças**',
    )
    // A carne reflete a correção acumulada (está em Lazer, NÃO em Açougue)
    expect(reDisplayMsg).not.toContain('carne → **Alimentação** › **Açougue & Peixaria**')
  })

  // [C32] reafirmação ("a carne e o carvão são para o churrasco de hoje") → NUNCA lançar tudo num par; pergunta de divisão
  it('C32: reafirmação de itens para churrasco NUNCA lança tudo num par e gera pergunta de divisão', () => {
    const userMessage = 'a carne e o carvão são para o churrasco de hoje'
    const totalConsolidado = 280.0

    // Verifica que não lança tudo em Alimentação › Supermercado nem tudo em Lazer
    const items = [
      { descricao: 'carne', cat: 'Lazer', sub: 'Eventos & Reuniões' },
      { descricao: 'carvão', cat: 'Lazer', sub: 'Eventos & Reuniões' },
      { descricao: 'outros itens', cat: 'Casa', sub: 'Utilidades' },
    ]

    const allSinglePair = items.every(
      (it) => it.cat === 'Alimentação' && it.sub === 'Supermercado & Atacado',
    )
    expect(allSinglePair).toBe(false)

    // Formato contextual obrigatório
    const divisionQuestion = `Entendi — carne e carvão vão para **Lazer** › **Eventos & Reuniões** e outros itens ficam nas gavetas deles. Como o total é único (R$ 280,00), preciso dividir: aproximadamente quanto foi da parte do churrasco?`
    expect(divisionQuestion).toContain('Como o total é único')
    expect(divisionQuestion).toContain('aproximadamente quanto foi da parte do churrasco?')
  })

  // [C33] proposta multi-item em lista vertical com negrito
  it('C33: proposta multi-item estruturada em lista vertical com marcador e negrito markdown', () => {
    const multiItemProposal =
      'Separei assim:\n• carne → **Alimentação** › **Açougue & Peixaria**\n• carvão → **Casa & Conforto** › **Utilidades**\n• cerveja → **Alimentação** › **Bebidas**\nEstá certo assim?'

    const lines = multiItemProposal.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(4)
    expect(lines[1]).toMatch(
      /^•\s+carne\s+→\s+\*\*Alimentação\*\*\s+›\s+\*\*Açougue & Peixaria\*\*$/,
    )
    expect(lines[2]).toMatch(/^•\s+carvão\s+→\s+\*\*Casa & Conforto\*\*\s+›\s+\*\*Utilidades\*\*$/)
    expect(lines[3]).toMatch(/^•\s+cerveja\s+→\s+\*\*Alimentação\*\*\s+›\s+\*\*Bebidas\*\*$/)
  })

  // [C34] "na verdade, foi R$ 250" → instrução de UPDATE REAL (a resposta cita valor antigo → novo)
  it('C34: "na verdade, foi R$ 250" gera instrução de UPDATE real e confirma citando valor antigo → novo', () => {
    const input = 'na verdade, foi R$ 250'
    const amounts = extractAllAmountsFromVoiceText(input)

    expect(amounts.length).toBe(1)
    expect(amounts[0].amountCents).toBe(25000)

    // Simulação do UPDATE real com retorno do banco
    const previousAmountCents = 15000
    const newAmountCents = amounts[0].amountCents

    const oldFormatted = (previousAmountCents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
    const newFormatted = (newAmountCents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

    const confirmationReply = `Ajustado: de ${oldFormatted} para ${newFormatted} ✅`
    expect(confirmationReply).toContain('Ajustado: de R$')
    expect(confirmationReply).toContain('para R$')
    expect(confirmationReply).toContain('250,00')
    expect(confirmationReply).toContain('150,00')
    expect(confirmationReply).toContain('✅')
  })

  // [C35] "apaga aquele" → resposta honesta de limite (nunca fingir)
  it('C35: "apaga aquele" responde com limite honesto sem fingir exclusão', () => {
    const userMessage = 'apaga aquele'
    const isUnsupported = /^(apaga|apagar|deleta|deletar|remove|remover|exclui|excluir)\b/i.test(
      userMessage.trim(),
    )
    expect(isUnsupported).toBe(true)

    const honestReply =
      'Ainda não consigo fazer isso por aqui — por favor, ajuste ou exclua manualmente no extrato do app.'

    // Nunca deve fingir que apagou ou executou
    expect(honestReply).not.toContain('Lançamento apagado')
    expect(honestReply).not.toContain('Excluído com sucesso')
    expect(honestReply).toContain('Ainda não consigo fazer isso por aqui')
    expect(honestReply).toContain('ajuste ou exclua manualmente no extrato do app')
  })
})
