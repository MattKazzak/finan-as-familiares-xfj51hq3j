import { describe, it, expect } from 'vitest'
import { parseVoiceWithAi } from '../voice-ai'
import { mapAiResponseToParsedTransaction, parseVoiceInput, VoiceAiResponse } from '../voice-parser'
import { analyzeBasketMission, isBasketInput } from '../basket-missions'

describe('Contrato de Comportamento do Copilot v1.0 — Router de Intenções (Fase 1)', () => {
  // Mock das categorias da família padrão ouro
  const mockCategories = [
    {
      id: 'cat-alimentacao',
      name: 'Alimentação',
      type: 'expense' as const,
      budget_bucket: 'essentials',
      subcategories: [
        { id: 'sub-supermercado', name: 'Supermercado & Atacado' },
        { id: 'sub-hortifruti', name: 'Hortifruti & Feira' },
      ],
    },
    {
      id: 'cat-lazer',
      name: 'Lazer',
      type: 'expense' as const,
      budget_bucket: 'lifestyle',
      subcategories: [{ id: 'sub-eventos', name: 'Eventos & Reuniões' }],
    },
    {
      id: 'cat-transporte',
      name: 'Transporte',
      type: 'expense' as const,
      budget_bucket: 'essentials',
      subcategories: [{ id: 'sub-combustivel', name: 'Combustível' }],
    },
  ]

  describe('TAREFA 1 & 4 — Classe 2: "comprei algumas coisas" → Pergunta ITENS antes de valor', () => {
    it('deve priorizar a pergunta de itens quando a descrição for genérica sem itens declarados', () => {
      const genericAiResponse: VoiceAiResponse = {
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
          descricao: 'compras',
          estabelecimento: null,
          valor: null,
          tipo: 'despesa',
          balde: 'Necessidades Essenciais',
          categoria: 'Alimentação',
          subcategoria: null,
          metodo_pagamento: null,
        },
        pergunta_clarificacao: 'O que você comprou?',
        opcoes_sugestao: null,
        mensagem_amigavel: 'O que você comprou? Me conta os itens que eu já organizo pra você!',
      }

      const parsed = mapAiResponseToParsedTransaction(genericAiResponse, 'comprei algumas coisas')

      expect(parsed.aiStatus).toBe('falta_valor')
      expect(parsed.routerClasse).toBe(2)
      expect(parsed.routerLacunas).toContain('itens')
      expect(parsed.clarificationQuestion).toBe('O que você comprou?')
      expect(parsed.friendlyMessage).toContain('O que você comprou?')
      // Nunca deve perguntar "quanto custou?" antes dos itens para descrição genérica
      expect(parsed.friendlyMessage).not.toContain('Quanto custou?')
    })

    it('deve perguntar o valor apenas quando a descrição for específica ("paguei o mercado")', () => {
      const specificAiResponse: VoiceAiResponse = {
        status: 'falta_valor',
        tipo_resposta: 'transacao',
        intencao: 'transacao',
        router: {
          classe: 2,
          nome_classe: 'lancamento_vago',
          confianca: 0.95,
          lacunas: ['valor'],
        },
        confianca: 0.95,
        lacunas: ['valor'],
        transacao: {
          descricao: 'Mercado',
          estabelecimento: 'Mercado',
          valor: null,
          tipo: 'despesa',
          balde: 'Necessidades Essenciais',
          categoria: 'Alimentação',
          subcategoria: 'Supermercado & Atacado',
          metodo_pagamento: null,
        },
        pergunta_clarificacao: 'Quanto custou?',
        opcoes_sugestao: null,
        mensagem_amigavel: 'Identifiquei Mercado. Quanto custou? 👍',
      }

      const parsed = mapAiResponseToParsedTransaction(specificAiResponse, 'paguei o mercado')

      expect(parsed.aiStatus).toBe('falta_valor')
      expect(parsed.routerClasse).toBe(2)
      expect(parsed.routerLacunas).toEqual(['valor'])
      expect(parsed.clarificationQuestion).toBe('Quanto custou?')
      expect(parsed.friendlyMessage).toContain('Quanto custou?')
    })
  })

  describe('TAREFA 1 — Classe 1: "gastei 80 no mercado" → Lançamento completo imediato', () => {
    it('deve classificar como Classe 1 e lançar com sucesso', () => {
      const fullExpenseResponse: VoiceAiResponse = {
        status: 'sucesso',
        tipo_resposta: 'transacao',
        intencao: 'transacao',
        router: {
          classe: 1,
          nome_classe: 'lancamento_completo',
          confianca: 0.98,
          lacunas: null,
        },
        confianca: 0.98,
        lacunas: null,
        transacao: {
          descricao: 'Mercado',
          estabelecimento: 'Mercado',
          valor: 80,
          tipo: 'despesa',
          balde: 'Necessidades Essenciais',
          categoria: 'Alimentação',
          subcategoria: 'Supermercado & Atacado',
          metodo_pagamento: null,
        },
        pergunta_clarificacao: null,
        opcoes_sugestao: null,
        mensagem_amigavel: 'Lançado: R$ 80,00 em Alimentação › Supermercado & Atacado 👍!',
      }

      const parsed = mapAiResponseToParsedTransaction(fullExpenseResponse, 'gastei 80 no mercado')

      expect(parsed.aiStatus).toBe('sucesso')
      expect(parsed.routerClasse).toBe(1)
      expect(parsed.amountCents).toBe(8000)
      expect(parsed.categoryNameSuggestion).toBe('Alimentação')
      expect(parsed.subcategoryNameSuggestion).toBe('Supermercado & Atacado')
      expect(parsed.friendlyMessage).toBe(
        'Lançado: R$ 80,00 em Alimentação › Supermercado & Atacado 👍!',
      )
    })
  })

  describe('TAREFA 5 — Classe 7: "bom dia" → Resposta social acolhedora SEM lançamento', () => {
    it('deve mapear saudação social para consulta/social sem transação financeira e sem erro invalido', () => {
      const greetingResponse: VoiceAiResponse = {
        status: 'consulta',
        tipo_resposta: 'consulta',
        intencao: 'social',
        router: {
          classe: 7,
          nome_classe: 'social_saudacao',
          confianca: 1.0,
          lacunas: null,
        },
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
      expect(parsed.tipoResposta).toBe('consulta')
      expect(parsed.intencao).toBe('social')
      expect(parsed.routerClasse).toBe(7)
      expect(parsed.amountCents).toBe(0)
      expect(parsed.friendlyMessage).toContain('Bom dia! Pronto pra registrar algo')
    })
  })

  describe('TAREFA 6 — Classe 6: "quanto gastei este mês?" → Consulta financeira', () => {
    it('deve responder consulta com resumo financeiro sem card de despesa', () => {
      const consultResponse: VoiceAiResponse = {
        status: 'consulta',
        tipo_resposta: 'consulta',
        intencao: 'consulta',
        router: {
          classe: 6,
          nome_classe: 'pergunta_financas',
          confianca: 0.95,
          lacunas: null,
        },
        confianca: 0.95,
        lacunas: null,
        resposta_consulta: 'Você já registrou R$ 1.450,00 em despesas neste mês.',
        transacao: null,
        pergunta_clarificacao: null,
        opcoes_sugestao: null,
        mensagem_amigavel: 'Você já registrou R$ 1.450,00 em despesas neste mês.',
      }

      const parsed = mapAiResponseToParsedTransaction(consultResponse, 'quanto gastei este mês?')

      expect(parsed.aiStatus).toBe('consulta')
      expect(parsed.routerClasse).toBe(6)
      expect(parsed.amountCents).toBe(0)
      expect(parsed.respostaConsulta).toBe('Você já registrou R$ 1.450,00 em despesas neste mês.')
    })
  })

  describe('TAREFA 6 — Classe 8: "cancela" → Descarta pendência com comando explícito', () => {
    it('deve executar comando de descarte/cancelar com status acao_executada', () => {
      const cancelResponse: VoiceAiResponse = {
        status: 'acao_executada',
        acao: 'desfazer',
        tipo_resposta: 'acao',
        intencao: 'desfazer',
        router: {
          classe: 8,
          nome_classe: 'comandos',
          confianca: 1.0,
          lacunas: null,
        },
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
      expect(parsed.tipoResposta).toBe('acao')
      expect(parsed.acao).toBe('desfazer')
      expect(parsed.routerClasse).toBe(8)
      expect(parsed.friendlyMessage).toContain('cancelado')
    })
  })

  describe('TAREFA 3 — Classe 4 Formal: Lista Mista de Mercado (Fim do Falso Churrasco)', () => {
    it('Lista da Mercearia Parada Certa (cerveja, sabão em pó, salame, miojo) NÃO dispara pergunta de churrasco e grava mercado direto', () => {
      const text =
        'uma caixa de cerveja, uma caixa de sabão em pó, dois salames, dois miojos de pote, tudo na mercearia Parada Certa. Ficou 118 reais'

      // Matcher determinístico subordinado ao router
      const analysis = analyzeBasketMission(text, 11800)

      // Sabão em pó e miojo contradizem a ocasião de lazer/churrasco
      expect(analysis.requiresConfirmation).toBe(false)
      expect(analysis.missionType).toBe('pantry_staple')
      expect(analysis.suggestedCategory).toBe('Alimentação')
      expect(analysis.suggestedSubcategory).toBe('Supermercado & Atacado')
      expect(analysis.naturalQuestion).toBeUndefined()
    })

    it('Se o router classificar explicitamente como Classe 4, a análise subordina e descarta qualquer pergunta', () => {
      const text = 'cerveja, salame e amaciante tudo 90'
      const analysis = analyzeBasketMission(text, 9000, { routerClasse: 4 })

      expect(analysis.requiresConfirmation).toBe(false)
      expect(analysis.suggestedCategory).toBe('Alimentação')
      expect(analysis.suggestedSubcategory).toBe('Supermercado & Atacado')
      expect(analysis.naturalQuestion).toBeUndefined()
    })

    it('Conjunto coerente ("carne, carvão e cerveja, tudo 100") é Classe 3 e dispara pergunta de ocasião exatamente 1 vez', () => {
      const text = 'carne, carvão e cerveja, tudo 100'
      const analysis = analyzeBasketMission(text, 10000)

      expect(analysis.isBasket).toBe(true)
      expect(analysis.requiresConfirmation).toBe(true)
      expect(analysis.missionType).toBe('social_event')
      expect(analysis.naturalQuestion).toBeDefined()
      expect(analysis.naturalQuestion).toContain('churrasco')
    })
  })

  describe('TAREFA 1 — Classe 9: Mensagem fora de escopo (política, previsão do tempo)', () => {
    it('deve produzir redirecionamento elegante sem tentar extrair transação', () => {
      const outOfScopeResponse: VoiceAiResponse = {
        status: 'invalido',
        tipo_resposta: 'consulta',
        intencao: null,
        router: {
          classe: 9,
          nome_classe: 'fora_escopo',
          confianca: 0.99,
          lacunas: null,
        },
        confianca: 0.99,
        lacunas: null,
        resposta_consulta:
          'Prefiro não opinar sobre isso! Mas se quiser falar sobre os gastos, receitas ou metas da família, estou 100% por aqui.',
        transacao: null,
        pergunta_clarificacao: null,
        opcoes_sugestao: null,
        mensagem_amigavel:
          'Prefiro não opinar sobre isso! Mas se quiser falar sobre os gastos, receitas ou metas da família, estou 100% por aqui.',
      }

      const parsed = mapAiResponseToParsedTransaction(
        outOfScopeResponse,
        'quem vai ganhar a eleição?',
      )

      expect(parsed.routerClasse).toBe(9)
      expect(parsed.amountCents).toBe(0)
      expect(parsed.friendlyMessage).toContain('Prefiro não opinar sobre isso')
    })
  })

  describe('FASE 2 — Contrato de Comportamento do Copilot v1.0 (Testes Dedicados)', () => {
    // (a) o caso da chupeta/sachês/copo/doação → propostas por item com confirmação
    it('(a) Caso Canônico da Chupeta (Classe 5): deve propor categorias por item, isolar discrepantes e exigir confirmação', () => {
      const text =
        'uma chupeta para o meu filho, 4 sachês para o meu cachorro, um jogo de copo novo, uma doação que fiz para o catador de latinhas'

      const parsedLocal = parseVoiceInput(text, mockCategories)

      expect(parsedLocal.routerClasse).toBe(5)
      expect(parsedLocal.aiStatus).toBe('clarificacao')
      expect(parsedLocal.extractedItems).toBeDefined()
      expect(parsedLocal.extractedItems?.length).toBeGreaterThanOrEqual(4)

      const items = parsedLocal.extractedItems || []
      const babyItem = items.find((i) => i.categoria_proposta === 'Compras')
      const petItem = items.find((i) => i.categoria_proposta === 'Pets')
      const homeItem = items.find((i) => i.categoria_proposta === 'Casa & Conforto')
      const donationItem = items.find((i) => i.duvida_categoria || i.categoria_proposta === null)

      expect(babyItem).toBeDefined()
      expect(babyItem?.subcategoria_proposta).toBe('Bebês & Crianças')
      expect(petItem).toBeDefined()
      expect(homeItem).toBeDefined()
      expect(donationItem).toBeDefined()
      // Doação sem categoria adequada -> perguntar como tratar
      expect(donationItem?.duvida_categoria).toBe(true)
      expect(parsedLocal.friendlyMessage).toContain('doação')
      expect(parsedLocal.isUncertainSuggestion).toBe(true)

      // Teste do mapper com resposta da Edge Function da Classe 5
      const edgeClass5Response: VoiceAiResponse = {
        status: 'clarificacao',
        tipo_resposta: 'transacao',
        intencao: 'transacao',
        router: {
          classe: 5,
          nome_classe: 'itens_heterogeneos',
          confianca: 0.9,
          lacunas: ['itens', 'valor'],
        },
        confianca: 0.85,
        lacunas: ['itens', 'valor'],
        itens: [
          {
            descricao: 'uma chupeta para o meu filho',
            categoria_proposta: 'Compras',
            subcategoria_proposta: 'Bebês & Crianças',
            confianca: 0.95,
            requer_confirmacao: true,
            duvida_categoria: false,
          },
          {
            descricao: '4 sachês para o meu cachorro',
            categoria_proposta: 'Pets',
            subcategoria_proposta: 'Alimentação Pet',
            confianca: 0.9,
            requer_confirmacao: true,
            duvida_categoria: false,
          },
          {
            descricao: 'um jogo de copo novo',
            categoria_proposta: 'Casa & Conforto',
            subcategoria_proposta: 'Utensílios & Cozinha',
            confianca: 0.85,
            requer_confirmacao: true,
            duvida_categoria: false,
          },
          {
            descricao: 'uma doação que fiz para o catador de latinhas',
            categoria_proposta: null,
            subcategoria_proposta: null,
            confianca: 0.4,
            requer_confirmacao: true,
            duvida_categoria: true,
          },
        ],
        transacao: null,
        pergunta_clarificacao:
          'Separei assim: chupeta em Bebês & Crianças, sachês em Pets, jogo de copo em Utensílios & Cozinha e a doação em Doações. Está certo assim?',
        opcoes_sugestao: null,
        mensagem_amigavel:
          'Separei assim: chupeta em Bebês & Crianças, sachês em Pets, jogo de copo em Utensílios & Cozinha e a doação em Doações. Está certo assim?',
      }

      const parsedMapped = mapAiResponseToParsedTransaction(edgeClass5Response, text)

      expect(parsedMapped.routerClasse).toBe(5)
      expect(parsedMapped.aiStatus).toBe('clarificacao')
      expect(parsedMapped.extractedItems?.length).toBe(4)
      expect(parsedMapped.isUncertainSuggestion).toBe(true) // Doação tem confiança < 0.6 e duvida_categoria
      expect(parsedMapped.friendlyMessage).toContain('doação')
    })

    // (b) "paguei o mercado" (específico sem valor) → pergunta o valor
    it('(b) "paguei o mercado" (descrição específica sem valor) → pergunta o valor', () => {
      const text = 'paguei o mercado'
      const parsed = parseVoiceInput(text, mockCategories)

      expect(parsed.aiStatus).toBe('falta_valor')
      expect(parsed.routerClasse).toBe(2)
      expect(parsed.routerLacunas).toEqual(['valor'])
      expect(parsed.clarificationQuestion).toBe('Quanto custou?')
      expect(parsed.friendlyMessage).toContain('Quanto custou?')
    })

    // (c) "comprei umas paradas" (vago) → pergunta os itens
    it('(c) "comprei umas paradas" (descrição vaga) → pergunta os itens primeiro', () => {
      const text = 'comprei umas paradas'
      const parsed = parseVoiceInput(text, mockCategories)

      expect(parsed.aiStatus).toBe('falta_valor')
      expect(parsed.routerClasse).toBe(2)
      expect(parsed.routerLacunas).toContain('itens')
      expect(parsed.clarificationQuestion).toBe('O que você comprou?')
      expect(parsed.friendlyMessage).toContain('O que você comprou?')
      expect(parsed.friendlyMessage).not.toContain('Quanto custou?')
    })

    // (d) lista mista nomeada ("na Parada Certa") → mercado direto com local preservado
    it('(d) Lista mista nomeada ("na Parada Certa") → mercado direto com estabelecimento preservado (Classe 4 formal)', () => {
      const text =
        'uma caixa de cerveja, sabão em pó, salame e miojo na Mercearia Parada Certa deu 118 reais'

      const analysis = analyzeBasketMission(text, 11800, { routerClasse: 4 })
      expect(analysis.requiresConfirmation).toBe(false)
      expect(analysis.suggestedCategory).toBe('Alimentação')
      expect(analysis.suggestedSubcategory).toBe('Supermercado & Atacado')

      // Resposta simulada da Edge Function para a Classe 4 formal
      const edgeClass4Response: VoiceAiResponse = {
        status: 'sucesso',
        tipo_resposta: 'transacao',
        intencao: 'transacao',
        router: {
          classe: 4,
          nome_classe: 'lista_mista_mercado',
          confianca: 0.96,
          lacunas: null,
        },
        confianca: 0.96,
        lacunas: null,
        transacao: {
          descricao: 'cerveja, sabão em pó, salame, miojo — mercado',
          estabelecimento: 'Mercearia Parada Certa',
          valor: 118,
          tipo: 'despesa',
          balde: 'Necessidades Essenciais',
          categoria: 'Alimentação',
          subcategoria: 'Supermercado & Atacado',
          metodo_pagamento: null,
        },
        pergunta_clarificacao: null,
        opcoes_sugestao: null,
        mensagem_amigavel: 'Lançado: R$ 118,00 em Alimentação › Supermercado & Atacado 👍!',
      }

      const parsed = mapAiResponseToParsedTransaction(edgeClass4Response, text)

      expect(parsed.routerClasse).toBe(4)
      expect(parsed.aiStatus).toBe('sucesso')
      expect(parsed.establishment).toBe('Mercearia Parada Certa')
      expect(parsed.categoryNameSuggestion).toBe('Alimentação')
      expect(parsed.subcategoryNameSuggestion).toBe('Supermercado & Atacado')
      expect(parsed.amountCents).toBe(11800)
    })

    // (e) interação que atinge o limite de 2 perguntas → sugestão incerta no gap restante
    it('(e) Limite de 2 perguntas atingido: não faz 3ª pergunta e assinala sugestão incerta no gap restante', () => {
      // Simula uma resposta da Edge após esgotar o limite de perguntas (2 turnos de slot-filling)
      const afterTwoQuestionsResponse: VoiceAiResponse = {
        status: 'sucesso',
        tipo_resposta: 'transacao',
        intencao: 'transacao',
        router: {
          classe: 1,
          nome_classe: 'lancamento_completo',
          confianca: 0.55, // Confiança baixa residual
          lacunas: ['local', 'data'],
        },
        confianca: 0.55,
        lacunas: ['local', 'data'],
        transacao: {
          descricao: 'Compras diversas',
          estabelecimento: null,
          valor: 50,
          tipo: 'despesa',
          balde: 'Necessidades Essenciais',
          categoria: 'Alimentação',
          subcategoria: null,
          metodo_pagamento: null,
        },
        pergunta_clarificacao: null, // Sem nova pergunta! Limite de 2 perguntas atingido
        opcoes_sugestao: null,
        mensagem_amigavel: 'Lançado: R$ 50,00 em Alimentação 👍!',
      }

      const parsed = mapAiResponseToParsedTransaction(afterTwoQuestionsResponse, 'deu 50 reais')

      expect(parsed.aiStatus).toBe('sucesso')
      expect(parsed.clarificationQuestion).toBeNull()
      // Deve ter badge de sugestão incerta ativa devido à confiança < 0.6
      expect(parsed.confidence).toBeLessThan(0.6)
      expect(parsed.isUncertainSuggestion).toBe(true)
    })
  })
})
