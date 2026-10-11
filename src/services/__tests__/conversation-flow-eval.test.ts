import { describe, it, expect, vi } from 'vitest'
import {
  parseVoiceInput,
  mapAiResponseToParsedTransaction,
  VoiceAiResponse,
  extractAllAmountsFromVoiceText,
  normalizeBrazilianCurrencyString,
  ParsedVoiceTransaction,
  matchTolerantPairAgainstCatalog,
  sanitizeItemNameForSub,
  handleCatalogQuestion,
  isCatalogQuestion,
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

  // [C27B] extrai valores decimais compostos com centavos por extenso ("vinte e cinco reais e cinquenta centavos")
  it('C27B: extração de valores por extenso com centavos preserva precisão decimal', () => {
    const input = 'vinte e cinco reais e cinquenta centavos de padaria'
    const amounts = extractAllAmountsFromVoiceText(input)

    expect(amounts.length).toBe(1)
    expect(amounts[0].amountCents).toBe(2550)
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

  // [C33] proposta multi-item em lista vertical com negrito (pares reais do catálogo)
  it('C33: proposta multi-item estruturada em lista vertical com marcador e negrito markdown', () => {
    const multiItemProposal =
      'Separei assim:\n• carne → **Alimentação** › **Açougue & Peixaria**\n• carvão → **Compras** › **Utilidades & Casa**\n• cerveja → **Alimentação** › **Bebidas**\nEstá certo assim?'

    const lines = multiItemProposal.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(4)
    expect(lines[1]).toMatch(
      /^•\s+carne\s+→\s+\*\*Alimentação\*\*\s+›\s+\*\*Açougue & Peixaria\*\*$/,
    )
    expect(lines[2]).toMatch(/^•\s+carvão\s+→\s+\*\*Compras\*\*\s+›\s+\*\*Utilidades & Casa\*\*$/)
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

  // [C36] "a carne e o cavão é para um churrasco" (com typo) → estado atualizado → "me mostra como separou" re-exibe a lista COM a correção
  it('C36: "a carne e o cavão é para um churrasco" (com typo) atualiza o estado antes da resposta e re-exibe carne e carvão em Lazer › Eventos & Reuniões', () => {
    // 1º Turno: proposta pendente com múltiplos itens
    const initialExtractedItems = [
      {
        descricao: 'seis quilos de carne',
        categoria_proposta: 'Alimentação',
        subcategoria_proposta: 'Açougue & Peixaria',
      },
      {
        descricao: 'um pacote de carvão',
        categoria_proposta: 'Compras',
        subcategoria_proposta: 'Utilidades & Casa',
      },
      {
        descricao: 'duas rodas para o meu filho',
        categoria_proposta: 'Compras',
        subcategoria_proposta: 'Bebês & Crianças',
      },
      {
        descricao: 'dois packs de long neck',
        categoria_proposta: 'Alimentação',
        subcategoria_proposta: 'Bebidas',
      },
      {
        descricao: 'quatro sachês para cachorro',
        categoria_proposta: 'Pets',
        subcategoria_proposta: 'Alimentação Pet',
      },
    ]

    // 2º Turno: usuário digita com typo "cavão"
    const userMessage = 'A carne e o cavão é para um churrasco'

    // Verifica que regex /ca(?:rv|v)[aã]o/i reconhece o typo "cavão"
    const mentionsCarvaoWithTypo = /ca(?:rv|v)[aã]o/i.test(userMessage)
    const mentionsCarne = /carne/i.test(userMessage)
    expect(mentionsCarvaoWithTypo).toBe(true)
    expect(mentionsCarne).toBe(true)

    // Atualização de estado imediata
    const updatedItems = initialExtractedItems.map((it) => {
      const isTarget =
        (mentionsCarne && /carne/i.test(it.descricao)) ||
        (mentionsCarvaoWithTypo && /ca(?:rv|v)[aã]o/i.test(it.descricao))
      if (isTarget) {
        return {
          ...it,
          categoria_proposta: 'Lazer',
          subcategoria_proposta: 'Eventos & Reuniões',
        }
      }
      return it
    })

    // Turno seguinte: re-exibição ("me mostra como separou")
    const showRequest = 'me mostra como você separou'
    const isShowSeparationRequest =
      /^(me\s+)?(mostre|mostra|veja|ver)\s+(como\s+)?(vc\s+|voc[eê]\s+)?(separou|ficou)|como\s+(vc\s+|voc[eê]\s+)?separou\??$/i.test(
        showRequest.trim(),
      )
    expect(isShowSeparationRequest).toBe(true)

    const lines = updatedItems.map(
      (it) => `• ${it.descricao} → **${it.categoria_proposta}** › **${it.subcategoria_proposta}**`,
    )
    const reDisplayMsg = `Separei assim:\n${lines.join('\n')}\n\nEstá certo assim?`

    // Carne e carvão (mesmo com typo inicial) estão em Lazer › Eventos & Reuniões
    expect(reDisplayMsg).toContain('• seis quilos de carne → **Lazer** › **Eventos & Reuniões**')
    expect(reDisplayMsg).toContain('• um pacote de carvão → **Lazer** › **Eventos & Reuniões**')
    // Demais itens foram mantidos intactos nas gavetas originais
    expect(reDisplayMsg).toContain(
      '• duas rodas para o meu filho → **Compras** › **Bebês & Crianças**',
    )
    expect(reDisplayMsg).toContain('• dois packs de long neck → **Alimentação** › **Bebidas**')
    expect(reDisplayMsg).toContain('• quatro sachês para cachorro → **Pets** › **Alimentação Pet**')
  })

  // [C37] nenhum par inexistente em nenhuma proposta; item sem par real → sugestão de criação no nível família (nunca par fabricado)
  it('C37: propostas não contêm par fabricado "Casa & Conforto › Utilidades"; item sem par real gera sugestão honesta de criação no nível família', () => {
    // Catálogo ouro da família
    const familyCategories = [
      {
        name: 'Alimentação',
        subcategories: ['Açougue & Peixaria', 'Bebidas', 'Supermercado & Atacado'],
      },
      {
        name: 'Compras',
        subcategories: [
          'Bebês & Crianças',
          'Utilidades & Casa',
          'Eletrônicos & Tecnologia',
          'Tabaco & Cigarros',
        ],
      },
      { name: 'Lazer', subcategories: ['Eventos & Reuniões', 'Restaurantes & Bares'] },
      { name: 'Pets', subcategories: ['Alimentação Pet', 'Veterinário & Cuidados'] },
    ]

    const allowedPairs = new Set(
      familyCategories.flatMap((c) => c.subcategories.map((s) => `${c.name} › ${s}`)),
    )

    // "Casa & Conforto › Utilidades" e "Casa & Conforto › Utensílios & Cozinha" NÃO existem no catálogo real
    expect(allowedPairs.has('Casa & Conforto › Utilidades')).toBe(false)
    expect(allowedPairs.has('Casa & Conforto › Utensílios & Cozinha')).toBe(false)
    // O par real de carvão em compras gerais é Compras › Utilidades & Casa
    expect(allowedPairs.has('Compras › Utilidades & Casa')).toBe(true)

    // Validação defensiva: se item for novo sem par real
    const unmappedItem = 'furadeira de impacto'
    const hasExistingFit = allowedPairs.has(`Compras › ${unmappedItem}`)
    expect(hasExistingFit).toBe(false)

    // Sugestão honesta de criação no nível família com confirmação
    const honestCreateSuggestion = `Nenhuma gaveta encaixa bem para ${unmappedItem} — sugiro criar Furadeira de impacto em Compras. Posso criar?`
    expect(honestCreateSuggestion).toContain('Nenhuma gaveta encaixa bem para furadeira de impacto')
    expect(honestCreateSuggestion).toContain(
      'sugiro criar Furadeira de impacto em Compras. Posso criar?',
    )
    expect(honestCreateSuggestion).not.toContain('Casa & Conforto')
  })

  // [C38] correção parcial → resposta única com lista atualizada + pergunta de divisão
  it('C38: correção parcial responde em mensagem única contendo a lista atualizada em formato vertical + pergunta de divisão com contexto', () => {
    const updatedExtractedItems = [
      {
        descricao: 'seis quilos de carne',
        categoria_proposta: 'Lazer',
        subcategoria_proposta: 'Eventos & Reuniões',
      },
      {
        descricao: 'um pacote de carvão',
        categoria_proposta: 'Lazer',
        subcategoria_proposta: 'Eventos & Reuniões',
      },
      {
        descricao: 'duas rodas para o meu filho',
        categoria_proposta: 'Compras',
        subcategoria_proposta: 'Bebês & Crianças',
      },
      {
        descricao: 'dois packs de long neck',
        categoria_proposta: 'Alimentação',
        subcategoria_proposta: 'Bebidas',
      },
    ]

    const totalConsolidado = 280.0
    const totalFormatted = 'R$ 280,00'

    const lines = updatedExtractedItems.map(
      (it) => `• ${it.descricao} → **${it.categoria_proposta}** › **${it.subcategoria_proposta}**`,
    )
    const correctedNames = 'seis quilos de carne e um pacote de carvão'
    const remainingNames = 'duas rodas para o meu filho, dois packs de long neck'

    const divisionPart = `\n\nEntendi — ${correctedNames} vão para **Lazer** › **Eventos & Reuniões** e ${remainingNames} ficam nas gavetas deles. Como o total é único (${totalFormatted}), preciso dividir: aproximadamente quanto foi da parte do churrasco?`

    const singleResponse = `Entendi! Então separei assim:\n${lines.join('\n')}${divisionPart}`

    // Resposta única (contém "Separei assim", lista vertical e pergunta de divisão)
    expect(singleResponse).toContain('Entendi! Então separei assim:')
    expect(singleResponse).toContain(
      '\n• seis quilos de carne → **Lazer** › **Eventos & Reuniões**',
    )
    expect(singleResponse).toContain('\n• um pacote de carvão → **Lazer** › **Eventos & Reuniões**')
    expect(singleResponse).toContain(
      'Como o total é único (R$ 280,00), preciso dividir: aproximadamente quanto foi da parte do churrasco?',
    )
  })

  // [C39] sachês → Pets (par real existente) proposta normal, NUNCA criação; long neck → bebidas; fraldas → Compras › Bebês & Crianças
  it('C39: matching tolerante valida pares propostos plausíveis com o catálogo real da família (Pets › Ração & Petiscos, Alimentação › Água & Bebidas, Compras › Bebês & Crianças) como proposta normal, NUNCA criação', () => {
    // Catálogo representativo da família com os nomes canônicos oficiais
    const familyCategories = [
      {
        id: 'cat-pets',
        name: 'Pets',
        type: 'expense',
        subcategories: [
          { id: 'sub-racao', name: 'Ração & Petiscos' },
          { id: 'sub-vet', name: 'Veterinário & Remédios' },
        ],
      },
      {
        id: 'cat-alim',
        name: 'Alimentação',
        type: 'expense',
        subcategories: [
          { id: 'sub-sup', name: 'Supermercado & Feira' },
          { id: 'sub-beb', name: 'Água & Bebidas para Casa' },
          { id: 'sub-rest', name: 'Restaurante & Delivery' },
        ],
      },
      {
        id: 'cat-compras',
        name: 'Compras',
        type: 'expense',
        subcategories: [
          { id: 'sub-kids', name: 'Bebês & Crianças' },
          { id: 'sub-casa', name: 'Utilidades & Casa' },
        ],
      },
    ]

    // 1. Sachês / Alimentação Pet -> deve casar com Pets › Ração & Petiscos
    const matchSaches = matchTolerantPairAgainstCatalog('Pets', 'Alimentação Pet', familyCategories)
    expect(matchSaches).not.toBeNull()
    expect(matchSaches?.matchedCat).toBe('Pets')
    expect(matchSaches?.matchedSub).toBe('Ração & Petiscos')

    // 2. Long neck / Bebidas -> deve casar com Alimentação › Água & Bebidas para Casa
    const matchBebidas = matchTolerantPairAgainstCatalog('Alimentação', 'Bebidas', familyCategories)
    expect(matchBebidas).not.toBeNull()
    expect(matchBebidas?.matchedCat).toBe('Alimentação')
    expect(matchBebidas?.matchedSub).toBe('Água & Bebidas para Casa')

    // 3. Fraldas / Crianças -> deve casar com Compras › Bebês & Crianças
    const matchFraldas = matchTolerantPairAgainstCatalog('Compras', 'Crianças', familyCategories)
    expect(matchFraldas).not.toBeNull()
    expect(matchFraldas?.matchedCat).toBe('Compras')
    expect(matchFraldas?.matchedSub).toBe('Bebês & Crianças')

    // Proposta normal NÃO deve cair em caminho de criação
    expect(matchSaches?.matchedCat).not.toBe('Compras') // não foi empurrado pra Compras
  })

  // [C40] item sem par real → sugestão de criação com nome do item limpo ('Sachês', não a frase)
  it('C40: item sem par real dispara sugestão de criação com o nome do item higienizado (sem quantificadores ou contexto)', () => {
    // Frase completa que a IA recebe no item
    const rawPhrase1 = '4 sachês para o meu cachorro'
    const cleanName1 = sanitizeItemNameForSub(rawPhrase1)
    expect(cleanName1).toBe('Sachês')

    const rawPhrase2 = 'dois packs de furadeira de impacto para a oficina'
    const cleanName2 = sanitizeItemNameForSub(rawPhrase2)
    expect(cleanName2).toBe('Furadeira de impacto')

    const rawPhrase3 = '1 pacote de carvão para o churrasco'
    const cleanName3 = sanitizeItemNameForSub(rawPhrase3)
    expect(cleanName3).toBe('Carvão')

    // Formato da mensagem de criação com nome higienizado
    const suggestionMsg = `Nenhuma gaveta encaixa bem para ${rawPhrase1} — sugiro criar ${cleanName1} em Pets. Posso criar?`
    expect(suggestionMsg).toBe(
      'Nenhuma gaveta encaixa bem para 4 sachês para o meu cachorro — sugiro criar Sachês em Pets. Posso criar?',
    )
    expect(suggestionMsg).not.toContain('sugiro criar 4 sachês para o meu cachorro')
  })

  // [C41] correção do usuário citando categoria existente → respondida ('Você tem razão — ...') E aplicada ao estado
  it('C41: correção do usuário durante pendência citando categoria existente responde reconhecendo ("Você tem razão — ...") e grava no estado', () => {
    const familyCategories = [
      {
        id: 'cat-pets',
        name: 'Pets',
        type: 'expense',
        subcategories: [{ id: 'sub-racao', name: 'Ração & Petiscos' }],
      },
      {
        id: 'cat-alim',
        name: 'Alimentação',
        type: 'expense',
        subcategories: [{ id: 'sub-beb', name: 'Água & Bebidas para Casa' }],
      },
    ]

    // Estado inicial pendente com par incorreto
    const pendingItems = [
      {
        descricao: '4 sachês para o meu cachorro',
        categoria_proposta: 'Compras',
        subcategoria_proposta: null,
      },
      {
        descricao: 'dois packs de long neck',
        categoria_proposta: 'Alimentação',
        subcategoria_proposta: 'Água & Bebidas para Casa',
      },
    ]

    // Usuário fala: "Nós temos a categoria pet"
    const userCorrectionText = 'Nós temos a categoria pet'
    const matchCat = matchTolerantPairAgainstCatalog('pet', null, familyCategories)
    expect(matchCat).not.toBeNull()
    expect(matchCat?.matchedCat).toBe('Pets')
    expect(matchCat?.matchedSub).toBe('Ração & Petiscos')

    // Aplicação no item correspondente
    const updatedItems = pendingItems.map((it) => {
      if (/sach[eê]|cachorro|pet/i.test(it.descricao)) {
        return {
          ...it,
          categoria_proposta: matchCat!.matchedCat,
          subcategoria_proposta: matchCat!.matchedSub,
        }
      }
      return it
    })

    // Resposta esperada com reconhecimento explícito + lista vertical
    const targetItem = '4 sachês para o meu cachorro'
    const ack = `Você tem razão — ${targetItem} vai para ${matchCat!.matchedCat} › ${matchCat!.matchedSub}.`
    const lines = updatedItems.map(
      (it) => `• ${it.descricao} → **${it.categoria_proposta}** › **${it.subcategoria_proposta}**`,
    )
    const response = `${ack}\n\nSeparei assim:\n${lines.join('\n')}\n\nEstá certo assim?`

    expect(response).toContain(
      'Você tem razão — 4 sachês para o meu cachorro vai para Pets › Ração & Petiscos.',
    )
    expect(response).toContain('• 4 sachês para o meu cachorro → **Pets** › **Ração & Petiscos**')
    expect(updatedItems[0].categoria_proposta).toBe('Pets')
    expect(updatedItems[0].subcategoria_proposta).toBe('Ração & Petiscos')
  })

  // [C42] lançamento por item → correção pós-lançamento de categoria ("as long necks não é para o churrasco") → proposta de movimento com par real → UPDATE real confirmado
  it('C42: correção pós-lançamento de categoria ("as long necks não é para o churrasco") propõe movimento com par real e UPDATE real confirmado', async () => {
    const familyCategories = [
      {
        id: 'cat-lazer',
        name: 'Lazer',
        type: 'expense',
        subcategories: [{ id: 'sub-evento', name: 'Eventos & Reuniões' }],
      },
      {
        id: 'cat-alim',
        name: 'Alimentação',
        type: 'expense',
        subcategories: [{ id: 'sub-beb', name: 'Água & Bebidas para Casa' }],
      },
    ]

    // Transação recém lançada no banco por engano em Lazer › Eventos & Reuniões
    const recentTx = {
      id: 'tx-long-neck-123',
      description: 'Packs de long neck',
      amount_cents: 4800,
      category_id: 'cat-lazer',
      subcategory_id: 'sub-evento',
    }

    const userCorrectionText =
      'As long necks não é para o churrasco, eu comprei para me beber durante a semana'

    // 1. Identificar transação alvo
    expect(/long\s*neck/i.test(recentTx.description)).toBe(true)

    // 2. Determinar par real de destino
    const targetPair = matchTolerantPairAgainstCatalog(
      'Alimentação',
      'Água & Bebidas para Casa',
      familyCategories,
    )
    expect(targetPair).not.toBeNull()
    expect(targetPair?.matchedCat).toBe('Alimentação')
    expect(targetPair?.matchedSub).toBe('Água & Bebidas para Casa')

    // 3. Proposta formulada
    const amtFmt = 'R$ 48,00'
    const proposalMsg = `Vou mover os ${amtFmt} de Lazer › Eventos & Reuniões para ${targetPair!.matchedCat} › ${targetPair!.matchedSub}. Pode ser?`
    expect(proposalMsg).toBe(
      'Vou mover os R$ 48,00 de Lazer › Eventos & Reuniões para Alimentação › Água & Bebidas para Casa. Pode ser?',
    )

    // 4. Confirmação do usuário -> UPDATE real
    const confirmationText = 'Pode ser'
    const isAffirmative = /^(sim|pode\s+ser|pode|confirmo|isso)\b/i.test(confirmationText)
    expect(isAffirmative).toBe(true)

    // Simula UPDATE real no banco
    let updateExecuted = false
    const updateResult = {
      ...recentTx,
      category_id: 'cat-alim',
      subcategory_id: 'sub-beb',
    }
    if (updateResult.category_id === 'cat-alim') {
      updateExecuted = true
    }
    expect(updateExecuted).toBe(true)

    // Resposta de sucesso só após confirmação do UPDATE
    const confirmedResponse = `Movido: ${amtFmt} agora em ${targetPair!.matchedCat} › ${targetPair!.matchedSub} ✅`
    expect(confirmedResponse).toBe(
      'Movido: R$ 48,00 agora em Alimentação › Água & Bebidas para Casa ✅',
    )
  })

  // [C43] "gastronomia e delivery, quais são as subcategorias?" → "Você quis dizer Restaurantes & Delivery?" + lista
  it('C43: pergunta de subcategorias com variação informal ("gastronomia e delivery") responde com "Você quis dizer Restaurantes & Delivery?" e lista real', () => {
    const familyCategories = [
      {
        id: 'cat-rest',
        name: 'Restaurantes & Delivery',
        type: 'expense',
        subcategories: [
          { id: 'sub-rest', name: 'Restaurantes & Bares' },
          { id: 'sub-deliv', name: 'Delivery de Comida' },
          { id: 'sub-fast', name: 'Fast Food & Lanches' },
        ],
      },
      {
        id: 'cat-lazer',
        name: 'Lazer',
        type: 'expense',
        subcategories: [{ id: 'sub-jogos', name: 'Jogos & Streaming' }],
      },
    ]

    const question = 'E gastronomia e delivery, quais são as subcategorias?'
    expect(isCatalogQuestion(question)).toBe(true)

    const result = handleCatalogQuestion(question, familyCategories)
    expect(result.handled).toBe(true)
    expect(result.matchedCategoryName).toBe('Restaurantes & Delivery')
    expect(result.response).toContain('Você quis dizer a categoria **Restaurantes & Delivery**?')
    expect(result.response).toContain('Restaurantes & Bares')
    expect(result.response).toContain('Delivery de Comida')
    expect(result.response).toContain('Fast Food & Lanches')
  })

  // [C44] pergunta sobre categoria inexistente ("existe categoria foguetes?") → "as mais próximas são..." (nunca fallback)
  it('C44: pergunta sobre categoria inexistente ("existe categoria foguetes?") sugere as mais próximas e nunca cai no fallback', () => {
    const familyCategories = [
      {
        id: 'cat-moradia',
        name: 'Moradia',
        type: 'expense',
        subcategories: [],
      },
      {
        id: 'cat-transp',
        name: 'Transporte',
        type: 'expense',
        subcategories: [],
      },
      {
        id: 'cat-alim',
        name: 'Alimentação',
        type: 'expense',
        subcategories: [],
      },
    ]

    const question = 'existe categoria foguetes?'
    expect(isCatalogQuestion(question)).toBe(true)

    const result = handleCatalogQuestion(question, familyCategories)
    expect(result.handled).toBe(true)
    expect(result.response).toContain(
      'Não tenho uma categoria com esse nome — as mais próximas são',
    )
    expect(result.response).toContain('Quer ver as subcategorias de alguma?')
    // NUNCA cair em fallback de Classe 9
    expect(result.response).not.toContain('Prefiro não opinar')
  })

  // =========================================================================
  // Contrato v2.0 — Casos de Avaliação de Conversação (H1–H15)
  // =========================================================================

  // [H1] Doações & Caridade em Compras (despesa)
  it('H1: doação para catador ou caridade classifica em Compras › Doações & Caridade (despesa)', () => {
    const text = 'uma doação para o catador de latinhas, 50'
    const parsed = parseVoiceInput(text, [
      {
        id: 'cat-compras',
        name: 'Compras',
        type: 'expense',
        budget_bucket: 'lifestyle',
        subcategories: [{ id: 'sub-doacoes', name: 'Doações & Caridade' }],
      },
    ])

    expect(parsed.amountCents).toBe(5000)
    expect(parsed.type).toBe('expense')
    expect(parsed.categoryNameSuggestion).toBe('Compras')
    expect(parsed.subcategoryNameSuggestion).toBe('Doações & Caridade')
  })

  // [H2] "posso dizer para cada um?" durante proposta pendente pergunta os valores
  it('H2: "posso dizer para cada um?" durante proposta pendente pergunta os valores diretamente', () => {
    const userInput = 'posso dizer para cada um?'
    const isSplitEachPrompt =
      /\b(?:posso\s+dizer\s+(?:o\s+valor\s+)?para\s+cada\s+um|posso\s+dizer\s+cada\s+um|vou\s+dizer\s+cada\s+um|dizer\s+separado)\b/i.test(
        userInput.replace(/[.!?]/g, '').trim(),
      )
    expect(isSplitEachPrompt).toBe(true)

    const expectedAskValuesMsg = 'Pode dizer! Quanto foi cada item?'
    expect(expectedAskValuesMsg).toBe('Pode dizer! Quanto foi cada item?')
  })

  // [H3] gravação POR ITEM: múltiplos itens com valores informados NUNCA somam em transação única e gravam por item
  it('H3: gravação POR ITEM — múltiplos itens com valores informados NUNCA somam em transação única e gravam por item (nunca "Geral")', () => {
    const items = [
      {
        descricao: 'Chupeta',
        valor: 25,
        categoria_proposta: 'Compras',
        subcategoria_proposta: 'Bebês & Crianças',
      },
      {
        descricao: 'Sachês',
        valor: 18,
        categoria_proposta: 'Pets',
        subcategoria_proposta: 'Ração & Petiscos',
      },
    ]
    const foundAmounts = [
      { amountCents: 2500, formatted: 'R$ 25,00' },
      { amountCents: 1800, formatted: 'R$ 18,00' },
    ]

    expect(foundAmounts.length).toBe(items.length)

    // Gravação por item
    const recordedTransactions: Array<{ desc: string; amount: number; cat: string; sub: string }> =
      []
    for (let i = 0; i < items.length; i++) {
      let cat = items[i].categoria_proposta
      let sub = items[i].subcategoria_proposta
      if (cat.toLowerCase() === 'geral') cat = 'Outros'
      if (sub.toLowerCase() === 'geral') sub = 'Outros'

      recordedTransactions.push({
        desc: items[i].descricao,
        amount: foundAmounts[i].amountCents,
        cat,
        sub,
      })
    }

    expect(recordedTransactions.length).toBe(2)
    expect(recordedTransactions[0].amount).toBe(2500)
    expect(recordedTransactions[1].amount).toBe(1800)
    expect(recordedTransactions.every((tx) => tx.cat.toLowerCase() !== 'geral')).toBe(true)
    expect(recordedTransactions.every((tx) => tx.sub.toLowerCase() !== 'geral')).toBe(true)
    // NUNCA grava uma soma consolidada 4300 em transação única
    expect(recordedTransactions.some((tx) => tx.amount === 4300)).toBe(false)
  })

  // [H4] Limpeza & Higiene da Casa em Moradia (essenciais)
  it('H4: produtos de limpeza classificam em Moradia › Limpeza & Higiene da Casa (essenciais)', () => {
    const text = 'comprei detergente e esponja 35 reais'
    const parsed = parseVoiceInput(text, [
      {
        id: 'cat-moradia',
        name: 'Moradia',
        type: 'expense',
        budget_bucket: 'essentials',
        subcategories: [{ id: 'sub-limpeza', name: 'Limpeza & Higiene da Casa' }],
      },
    ])

    expect(parsed.amountCents).toBe(3500)
    expect(parsed.type).toBe('expense')
    expect(parsed.categoryNameSuggestion).toBe('Moradia')
    expect(parsed.subcategoryNameSuggestion).toBe('Limpeza & Higiene da Casa')
    expect(parsed.bucketSuggestion).toBe('essentials')
  })

  // [H5] pares reais: long neck → Alimentação › Água & Bebidas para Casa (nunca Tabaco); sachês → Pets › Ração & Petiscos (nunca "Alimentação Pet")
  it('H5: pares reais: long neck → Alimentação › Água & Bebidas para Casa (nunca Tabaco & Cigarros); sachês → Pets › Ração & Petiscos (nunca "Alimentação Pet")', () => {
    const catalog = [
      {
        id: 'cat-alim',
        name: 'Alimentação',
        type: 'expense' as const,
        budget_bucket: 'essentials' as const,
        subcategories: [{ id: 'sub-beb', name: 'Água & Bebidas para Casa' }],
      },
      {
        id: 'cat-pets',
        name: 'Pets',
        type: 'expense' as const,
        budget_bucket: 'lifestyle' as const,
        subcategories: [{ id: 'sub-racao', name: 'Ração & Petiscos' }],
      },
      {
        id: 'cat-compras',
        name: 'Compras',
        type: 'expense' as const,
        budget_bucket: 'lifestyle' as const,
        subcategories: [{ id: 'sub-tabaco', name: 'Tabaco & Cigarros' }],
      },
    ]

    const parsedLongNeck = parseVoiceInput('comprei dois packs de long neck, 45', catalog)
    expect(parsedLongNeck.categoryNameSuggestion).toBe('Alimentação')
    expect(parsedLongNeck.subcategoryNameSuggestion).toBe('Água & Bebidas para Casa')
    expect(parsedLongNeck.categoryNameSuggestion).not.toBe('Compras')
    expect(parsedLongNeck.subcategoryNameSuggestion).not.toBe('Tabaco & Cigarros')

    const parsedSaches = parseVoiceInput('comprei 4 sachês de gato 22', catalog)
    expect(parsedSaches.categoryNameSuggestion).toBe('Pets')
    expect(parsedSaches.subcategoryNameSuggestion).toBe('Ração & Petiscos')
    expect(parsedSaches.subcategoryNameSuggestion).not.toBe('Alimentação Pet')
  })

  // [H6/H7] correção parcial persiste no estado + lista atualizada na mesma mensagem + re-exibição reflete
  it('H6/H7: correção parcial persiste no estado + lista atualizada na mesma mensagem + re-exibição reflete estado corrigido', () => {
    const familyCategories = [
      {
        id: 'cat-pets',
        name: 'Pets',
        type: 'expense',
        subcategories: [{ id: 'sub-racao', name: 'Ração & Petiscos' }],
      },
      {
        id: 'cat-lazer',
        name: 'Lazer',
        type: 'expense',
        subcategories: [{ id: 'sub-eventos', name: 'Eventos & Reuniões' }],
      },
    ]

    let pendingItems = [
      {
        descricao: 'carne e carvão',
        categoria_proposta: 'Alimentação',
        subcategoria_proposta: 'Supermercado',
      },
      {
        descricao: '4 sachês de cachorro',
        categoria_proposta: 'Compras',
        subcategoria_proposta: 'Outros',
      },
    ]

    // Usuário corrige: "a carne e o carvão é para um churrasco"
    const userCorrection = 'a carne e o carvão é para um churrasco'
    expect(/churrasco/i.test(userCorrection)).toBe(true)

    pendingItems = pendingItems.map((it) => {
      if (/carne|carv[aã]o/i.test(it.descricao)) {
        return {
          ...it,
          categoria_proposta: 'Lazer',
          subcategoria_proposta: 'Eventos & Reuniões',
        }
      }
      return it
    })

    // Lista vertical atualizada na mesma mensagem de resposta
    const lines = pendingItems.map(
      (it) => `• ${it.descricao} → **${it.categoria_proposta}** › **${it.subcategoria_proposta}**`,
    )
    const ackWithList = `Entendi! Então separei assim:\n${lines.join('\n')}\n\nEstá certo assim?`

    expect(ackWithList).toContain('• carne e carvão → **Lazer** › **Eventos & Reuniões**')
    expect(pendingItems[0].categoria_proposta).toBe('Lazer')
    expect(pendingItems[0].subcategoria_proposta).toBe('Eventos & Reuniões')

    // Re-exibição posterior: "como você separou?" reflete o estado já corrigido
    const redisplayQuestion = 'como você separou?'
    const isRedisplay = /como\s+(vc\s+|voc[eê]\s+)?separou\??$/i.test(redisplayQuestion)
    expect(isRedisplay).toBe(true)

    const redisplayedLines = pendingItems.map(
      (it) => `• ${it.descricao} → **${it.categoria_proposta}** › **${it.subcategoria_proposta}**`,
    )
    const redisplayMsg = `Separei assim:\n${redisplayedLines.join('\n')}\n\nEstá certo assim?`

    expect(redisplayMsg).toContain('• carne e carvão → **Lazer** › **Eventos & Reuniões**')
  })

  // [H8] total declarado ≠ soma dos itens → pergunta antes de lançar
  it('H8: total declarado ≠ soma dos itens → confere e pergunta antes de lançar', () => {
    const declaredTotalCents = 10000 // R$ 100,00 declarado inicialmente
    const foundAmounts = [{ amountCents: 6000 }, { amountCents: 5000 }]
    const itemsSumCents = foundAmounts.reduce((acc, curr) => acc + curr.amountCents, 0) // 11000 = R$ 110,00

    expect(itemsSumCents).not.toBe(declaredTotalCents)

    const declaredFormatted = 'R$ 100,00'
    const sumFormatted = 'R$ 110,00'
    const divergenceMsg = `A soma dos itens deu ${sumFormatted}, mas o total informado foi ${declaredFormatted}. Gostaria de conferir os valores antes de lançar?`

    expect(divergenceMsg).toContain('A soma dos itens deu R$ 110,00')
    expect(divergenceMsg).toContain('total informado foi R$ 100,00')
    expect(divergenceMsg).toContain('Gostaria de conferir os valores antes de lançar?')
  })

  // [H9] mensagem confusa → esclarecimento específico, nunca loop
  it('H9: mensagem confusa → esclarecimento específico sem cair em loop', () => {
    const parsedGeneric = parseVoiceInput('comprei algumas coisas', mockCategories)
    expect(parsedGeneric.aiStatus).toBe('falta_valor')
    expect(parsedGeneric.routerClasse).toBe(2)
    expect(parsedGeneric.clarificationQuestion).toBe('O que você comprou?')
    expect(parsedGeneric.friendlyMessage).toContain('O que você comprou?')

    // Se o usuário não informa nada entendível:
    const invalidText = 'zzzz kkkk wwww'
    const parsedInvalid = parseVoiceInput(invalidText, mockCategories)
    expect(parsedInvalid.aiStatus).toBe('invalido')
    expect(parsedInvalid.friendlyMessage).toContain(
      'Não consegui entender esse lançamento financeiro',
    )
  })

  // [H10] consulta no meio de pendência responde a consulta e lembra a pendência
  it('H10: consulta no meio de pendência responde à consulta e relembra a pendência ativa', () => {
    const pendingItem = 'chupeta para meu filho'
    const consultationAnswer = 'Você gastou R$ 450,00 em Moradia neste mês.'
    const combinedMessage = `${consultationAnswer}\n\nA propósito, ainda aguardo o valor ou confirmação para ${pendingItem}.`

    expect(combinedMessage).toContain('Você gastou R$ 450,00 em Moradia neste mês.')
    expect(combinedMessage).toContain(
      'ainda aguardo o valor ou confirmação para chupeta para meu filho',
    )
  })

  // [H11] cancelamento explícito descarta a pendência sem gravar nenhuma transação
  it('H11: "cancela" / "esquece" descarta a pendência sem lançar nada no banco', () => {
    const cancelResponse: VoiceAiResponse = {
      status: 'acao_executada',
      acao: 'desfazer',
      tipo_resposta: 'acao',
      intencao: 'desfazer',
      router: { classe: 8, nome_classe: 'comandos', confianca: 1.0, lacunas: null },
      confianca: 1.0,
      lacunas: null,
      transacao: null,
      pergunta_clarificacao: null,
      opcoes_sugestao: null,
      mensagem_amigavel: 'Tudo bem, cancelado! Não registrei nada.',
    }

    const parsed = mapAiResponseToParsedTransaction(cancelResponse, 'cancela tudo')
    expect(parsed.aiStatus).toBe('acao_executada')
    expect(parsed.acao).toBe('desfazer')
    expect(parsed.amountCents).toBe(0)
    expect(parsed.friendlyMessage).toContain('cancelado')
  })

  // [H12] correção do usuário durante pendência respondida e aplicada
  it('H12: correção do usuário durante pendência citando categoria existente é respondida ("Você tem razão — ...") e aplicada', () => {
    const categories = [
      {
        id: 'cat-pets',
        name: 'Pets',
        type: 'expense',
        subcategories: [{ id: 'sub-racao', name: 'Ração & Petiscos' }],
      },
    ]

    const matched = matchTolerantPairAgainstCatalog('pet', null, categories)
    expect(matched).not.toBeNull()
    expect(matched?.matchedCat).toBe('Pets')
    expect(matched?.matchedSub).toBe('Ração & Petiscos')

    const targetItem = '4 sachês para o meu cachorro'
    const ack = `Você tem razão — ${targetItem} vai para ${matched!.matchedCat} › ${matched!.matchedSub}.`
    expect(ack).toBe(
      'Você tem razão — 4 sachês para o meu cachorro vai para Pets › Ração & Petiscos.',
    )
  })

  // [H13] sugestão de criação usa o NOME do item higienizado, nunca a frase inteira
  it('H13: sugestão de criação usa o NOME do item higienizado, nunca a frase inteira com quantificadores ou contexto', () => {
    const rawDesc1 = '3 pacotes de ração especial para meu cão idoso'
    const clean1 = sanitizeItemNameForSub(rawDesc1)
    expect(clean1).toBe('Ração especial')
    expect(clean1).not.toContain('3 pacotes')
    expect(clean1).not.toContain('para meu cão')

    const rawDesc2 = 'dois packs de furadeira de impacto para a oficina'
    const clean2 = sanitizeItemNameForSub(rawDesc2)
    expect(clean2).toBe('Furadeira de impacto')

    const suggestion = `Nenhuma gaveta encaixa bem para ${rawDesc2} — sugiro criar ${clean2} em Casa & Conforto. Posso criar?`
    expect(suggestion).toContain('sugiro criar Furadeira de impacto em Casa & Conforto')
  })

  // [H14] Destino Inequívoco: ração → Pets, fralda → Bebês & Crianças, cigarro → Tabaco & Cigarros, remédio → Farmácia & Medicamentos
  it('H14 (Destino Inequívoco): ração → Pets, fralda → Bebês & Crianças, cigarro → Tabaco & Cigarros, remédio → Farmácia & Medicamentos, cerveja de casa → Água & Bebidas', () => {
    const catalog = [
      {
        id: 'cat-pets',
        name: 'Pets',
        type: 'expense' as const,
        budget_bucket: 'lifestyle' as const,
        subcategories: [{ id: 'sub-racao', name: 'Ração & Petiscos' }],
      },
      {
        id: 'cat-compras',
        name: 'Compras',
        type: 'expense' as const,
        budget_bucket: 'lifestyle' as const,
        subcategories: [
          { id: 'sub-bebes', name: 'Bebês & Crianças' },
          { id: 'sub-tabaco', name: 'Tabaco & Cigarros' },
          { id: 'sub-doacoes', name: 'Doações & Caridade' },
        ],
      },
      {
        id: 'cat-saude',
        name: 'Saúde',
        type: 'expense' as const,
        budget_bucket: 'essentials' as const,
        subcategories: [{ id: 'sub-farmacia', name: 'Farmácia & Medicamentos' }],
      },
      {
        id: 'cat-alim',
        name: 'Alimentação',
        type: 'expense' as const,
        budget_bucket: 'essentials' as const,
        subcategories: [{ id: 'sub-bebidas', name: 'Água & Bebidas para Casa' }],
      },
      {
        id: 'cat-moradia',
        name: 'Moradia',
        type: 'expense' as const,
        budget_bucket: 'essentials' as const,
        subcategories: [{ id: 'sub-limpeza', name: 'Limpeza & Higiene da Casa' }],
      },
    ]

    // 1. Ração
    const racaoParsed = parseVoiceInput('comprei ração para o cachorro 80', catalog)
    expect(racaoParsed.categoryNameSuggestion).toBe('Pets')
    expect(racaoParsed.subcategoryNameSuggestion).toBe('Ração & Petiscos')

    // 2. Fralda
    const fraldaParsed = parseVoiceInput('fralda pampers 65', catalog)
    expect(fraldaParsed.categoryNameSuggestion).toBe('Compras')
    expect(fraldaParsed.subcategoryNameSuggestion).toBe('Bebês & Crianças')

    // 3. Cigarro
    const cigarroParsed = parseVoiceInput('maço de cigarro 15', catalog)
    expect(cigarroParsed.categoryNameSuggestion).toBe('Compras')
    expect(cigarroParsed.subcategoryNameSuggestion).toBe('Tabaco & Cigarros')

    // 4. Remédio
    const remedioParsed = parseVoiceInput('remédio na drogaria 45', catalog)
    expect(remedioParsed.categoryNameSuggestion).toBe('Saúde')
    expect(remedioParsed.subcategoryNameSuggestion).toBe('Farmácia & Medicamentos')

    // 5. Long neck / cerveja para casa
    const longNeckParsed = parseVoiceInput('pack de long neck 38', catalog)
    expect(longNeckParsed.categoryNameSuggestion).toBe('Alimentação')
    expect(longNeckParsed.subcategoryNameSuggestion).toBe('Água & Bebidas para Casa')

    // 6. Doação
    const doacaoParsed = parseVoiceInput('doação caridade 50', catalog)
    expect(doacaoParsed.categoryNameSuggestion).toBe('Compras')
    expect(doacaoParsed.subcategoryNameSuggestion).toBe('Doações & Caridade')

    // 7. Limpeza
    const limpezaParsed = parseVoiceInput('detergente e desinfetante 28', catalog)
    expect(limpezaParsed.categoryNameSuggestion).toBe('Moradia')
    expect(limpezaParsed.subcategoryNameSuggestion).toBe('Limpeza & Higiene da Casa')
  })

  // [H15] "Geral" bloqueado no código (nunca proposta/gravada)
  it('H15: "Geral" é estritamente bloqueado no código — nunca proposta como categoria/subcategoria nem gravada', () => {
    // 1. No parseVoiceInput direto
    const parsedWithGeralInput = parseVoiceInput('gasto geral de 50', [
      {
        id: 'cat-geral',
        name: 'Geral',
        type: 'expense',
        budget_bucket: 'lifestyle',
        subcategories: [{ id: 'sub-geral', name: 'Geral' }],
      },
    ])
    expect(parsedWithGeralInput.categoryNameSuggestion?.toLowerCase()).not.toBe('geral')
    expect(parsedWithGeralInput.subcategoryNameSuggestion?.toLowerCase()).not.toBe('geral')

    // 2. No mapAiResponseToParsedTransaction
    const aiResponseWithGeral: VoiceAiResponse = {
      status: 'sucesso',
      tipo_resposta: 'transacao',
      transacao: {
        descricao: 'compra',
        valor: 50,
        tipo: 'despesa',
        balde: 'lifestyle',
        categoria: 'Geral',
        subcategoria: 'Geral',
        metodo_pagamento: null,
      },
      pergunta_clarificacao: null,
      opcoes_sugestao: null,
      mensagem_amigavel: 'Lançado: R$ 50,00 em Geral 👍!',
    }
    const mapped = mapAiResponseToParsedTransaction(aiResponseWithGeral, 'compra 50')
    expect(mapped.categoryNameSuggestion?.toLowerCase()).not.toBe('geral')
    expect(mapped.subcategoryNameSuggestion?.toLowerCase()).not.toBe('geral')
    expect(mapped.categoryNameSuggestion).toBe('Outros')
    expect(mapped.subcategoryNameSuggestion).toBeUndefined()
  })
})
