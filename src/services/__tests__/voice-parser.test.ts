import { describe, it, expect } from 'vitest'
import {
  parseWordsToNumber,
  extractAmountFromVoiceText,
  extractPaymentMethod,
  extractTransactionType,
  parseVoiceInput,
  mapAiResponseToParsedTransaction,
} from '../voice-parser'

describe('voice-parser', () => {
  describe('parseWordsToNumber', () => {
    it('converte unidades e dezenas', () => {
      expect(parseWordsToNumber(['oitenta', 'e', 'cinco'])).toBe(85)
      expect(parseWordsToNumber(['quarenta', 'e', 'dois'])).toBe(42)
      expect(parseWordsToNumber(['quinze'])).toBe(15)
    })

    it('converte centenas e milhares', () => {
      expect(parseWordsToNumber(['cento', 'e', 'cinquenta'])).toBe(150)
      expect(parseWordsToNumber(['duzentos', 'e', 'trinta'])).toBe(230)
      expect(parseWordsToNumber(['dois', 'mil', 'e', 'quinhentos'])).toBe(2500)
    })
  })

  describe('extractAmountFromVoiceText', () => {
    it('extrai números com dígitos e reais', () => {
      const res1 = extractAmountFromVoiceText('Almoço 45 reais no débito')
      expect(res1.amountCents).toBe(4500)

      const res2 = extractAmountFromVoiceText('Cerveja na mercearia 60')
      expect(res2.amountCents).toBe(6000)

      const res3 = extractAmountFromVoiceText('Comprei remédio por 25,50 reais')
      expect(res3.amountCents).toBe(2550)
    })

    it('extrai números por extenso', () => {
      const res1 = extractAmountFromVoiceText('Gastei oitenta e cinco reais na farmácia')
      expect(res1.amountCents).toBe(8500)

      const res2 = extractAmountFromVoiceText('Almoço quarenta e cinco reais')
      expect(res2.amountCents).toBe(4500)

      const res3 = extractAmountFromVoiceText('cento e vinte reais no mercado')
      expect(res3.amountCents).toBe(12000)
    })

    it('casos-alvo do bug: "paguei 2 coisas por 45 reais", "gastei 50", "45,90 no mercado", "duzentos e cinquenta reais"', () => {
      expect(extractAmountFromVoiceText('paguei 2 coisas por 45 reais').amountCents).toBe(4500)
      expect(extractAmountFromVoiceText('gastei 50').amountCents).toBe(5000)
      expect(extractAmountFromVoiceText('45,90 no mercado').amountCents).toBe(4590)
      expect(extractAmountFromVoiceText('duzentos e cinquenta reais').amountCents).toBe(25000)
    })
  })

  describe('extractPaymentMethod', () => {
    it('identifica débito, crédito, pix e dinheiro', () => {
      expect(extractPaymentMethod('Almoço 45 reais no débito').method).toBe('debito')
      expect(extractPaymentMethod('Supermercado 200 no crédito').method).toBe('credito')
      expect(extractPaymentMethod('Padaria 15 via pix').method).toBe('pix')
      expect(extractPaymentMethod('Estacionamento 10 em dinheiro').method).toBe('dinheiro')
    })
  })

  describe('extractTransactionType', () => {
    it('identifica despesa por padrão e remove prefixos', () => {
      const res = extractTransactionType('Almoço de domingo')
      expect(res.type).toBe('expense')

      const res2 = extractTransactionType('Comprei pão na padaria')
      expect(res2.type).toBe('expense')
      expect(res2.cleanedText).toContain('pão')
    })

    it('identifica receita com palavras-chave', () => {
      expect(extractTransactionType('Recebi salário de 5000').type).toBe('income')
      expect(extractTransactionType('Pix recebido de freela').type).toBe('income')
      expect(extractTransactionType('Reembolso da viagem').type).toBe('income')
    })
  })

  describe('parseVoiceInput (interpretação completa)', () => {
    const mockCategories = [
      {
        id: '1',
        name: 'Alimentação',
        type: 'expense',
        budget_bucket: 'essential',
        subcategories: [
          { id: 'sub-1', name: 'Supermercado' },
          { id: 'sub-2', name: 'Restaurante' },
        ],
      },
      {
        id: '2',
        name: 'Lazer',
        type: 'expense',
        budget_bucket: 'lifestyle',
        subcategories: [
          { id: 'sub-3', name: 'Cinema' },
          { id: 'sub-4', name: 'Viagem' },
        ],
      },
      { id: '3', name: 'Saúde', type: 'expense', budget_bucket: 'essential', subcategories: [] },
      { id: '4', name: 'Salário', type: 'income', budget_bucket: 'essential', subcategories: [] },
    ]

    it('priorização: encaixa "manicure" em categoria existente "Lazer" como subcategoria antes de criar nova categoria', () => {
      const parsed = parseVoiceInput('Manicure 140 reais', mockCategories)
      expect(parsed.amountCents).toBe(14000)
      expect(parsed.categoryNameSuggestion).toBe('Lazer')
      expect(parsed.subcategoryNameSuggestion).toBe('Manicure')
      expect(parsed.bucketSuggestion).toBe('lifestyle')
      expect(parsed.aiStatus).toBe('sucesso')
    })

    it('priorização: identifica subcategoria já existente na família', () => {
      const parsed = parseVoiceInput('Fui ao cinema 60 reais no crédito', mockCategories)
      expect(parsed.amountCents).toBe(6000)
      expect(parsed.categoryNameSuggestion).toBe('Lazer')
      expect(parsed.subcategoryNameSuggestion).toBe('Cinema')
      expect(parsed.bucketSuggestion).toBe('lifestyle')
      expect(parsed.paymentMethod).toBe('credito')
      expect(parsed.aiStatus).toBe('sucesso')
    })

    it('interpreta "Almoço 45 reais no débito"', () => {
      const parsed = parseVoiceInput('Almoço 45 reais no débito', mockCategories)
      expect(parsed.amountCents).toBe(4500)
      expect(parsed.paymentMethod).toBe('debito')
      expect(parsed.type).toBe('expense')
      expect(parsed.description.toLowerCase()).toContain('almoço')
    })

    it('interpreta "Cerveja na mercearia 60"', () => {
      const parsed = parseVoiceInput('Cerveja na mercearia 60', mockCategories)
      expect(parsed.amountCents).toBe(6000)
      expect(parsed.type).toBe('expense')
      expect(parsed.description.toLowerCase()).toContain('cerveja')
      expect(parsed.aiStatus).toBe('sucesso')
    })

    it('classifica fala com item/estabelecimento mas sem valor como "falta_valor"', () => {
      const res1 = parseVoiceInput('2 pacotes de peta no supermercado', mockCategories)
      expect(res1.amountCents).toBe(0)
      expect(res1.aiStatus).toBe('falta_valor')
      expect(res1.clarificationQuestion).toBe('Quanto custou?')
      expect(res1.establishment).toBe('Supermercado')
      expect(res1.categoryNameSuggestion).toBe('Alimentação')

      const res2 = parseVoiceInput('2 caixas de cerveja na mercearia do zé', mockCategories)
      expect(res2.amountCents).toBe(0)
      expect(res2.aiStatus).toBe('falta_valor')
      expect(res2.establishment?.toLowerCase()).toContain('mercearia')

      const res3 = parseVoiceInput('remédio na farmácia', mockCategories)
      expect(res3.amountCents).toBe(0)
      expect(res3.aiStatus).toBe('falta_valor')
      expect(res3.categoryNameSuggestion).toBe('Saúde')
    })

    it('interpreta números falados por extenso', () => {
      const parsed = parseVoiceInput('oitenta e cinco reais na farmácia no pix', mockCategories)
      expect(parsed.amountCents).toBe(8500)
      expect(parsed.paymentMethod).toBe('pix')
      expect(parsed.type).toBe('expense')
      expect(parsed.categoryNameSuggestion).toBe('Saúde')
      expect(parsed.bucketSuggestion).toBe('essential')
      expect(parsed.aiStatus).toBe('sucesso')
    })

    it('interpreta receita "Recebi 1500 de salário"', () => {
      const parsed = parseVoiceInput('Recebi 1500 de salário', mockCategories)
      expect(parsed.amountCents).toBe(150000)
      expect(parsed.type).toBe('income')
      expect(parsed.categoryNameSuggestion).toBe('Salário')
      expect(parsed.aiStatus).toBe('sucesso')
    })

    it('classifica frase ambígua com valor ("pindamonhangaba 8 reais") como "clarificacao" e inclui descrição e valor na mensagem amigável', () => {
      const parsed = parseVoiceInput('pindamonhangaba 8 reais', mockCategories)
      expect(parsed.amountCents).toBe(800)
      expect(parsed.amountFormatted).toMatch(/8[,.]00/)
      expect(parsed.aiStatus).toBe('clarificacao')
      expect(parsed.clarificationQuestion).toBe('O que foi Pindamonhangaba?')
      expect(parsed.friendlyMessage).toContain('Identifiquei Pindamonhangaba')
      expect(parsed.friendlyMessage).toContain('8,00')
      expect(parsed.friendlyMessage).toContain('Onde prefere organizar esse gasto?')
      expect(parsed.clarificationOptions).toEqual([
        'Transporte / Passagem',
        'Alimentação / Outro',
        'Outro',
      ])
      expect(parsed.processingSource).toBe('local')
    })

    it('classifica "treco 50 reais" como "clarificacao" com 3 pílulas genéricas', () => {
      const parsed = parseVoiceInput('treco 50 reais', mockCategories)
      expect(parsed.amountCents).toBe(5000)
      expect(parsed.aiStatus).toBe('clarificacao')
      expect(parsed.clarificationQuestion).toBe('O que foi Treco?')
      expect(parsed.clarificationOptions).toHaveLength(3)
    })

    it('classifica texto sem valor identificado como "invalido"', () => {
      const parsed = parseVoiceInput('abobrinha voadora', mockCategories)
      expect(parsed.amountCents).toBe(0)
      expect(parsed.aiStatus).toBe('invalido')
      expect(parsed.friendlyMessage).toBe(
        "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'",
      )
    })

    it('classifica "GPT ormini falando" como "invalido" sem valor', () => {
      const parsed = parseVoiceInput('GPT ormini falando', mockCategories)
      expect(parsed.amountCents).toBe(0)
      expect(parsed.aiStatus).toBe('invalido')
      expect(parsed.friendlyMessage).toBe(
        "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'",
      )
    })

    it('quando contextoAnterior é fornecido e a fala informa apenas valor/método, mescla e retorna sucesso', () => {
      const contextoAnterior = {
        descricao: 'Duas caixas de cerveja',
        estabelecimento: 'Parada Certa',
        categoria: 'Alimentação / Lazer',
        subcategoria: 'Bebidas',
        balde: 'lifestyle',
        tipo: 'despesa' as const,
      }

      const parsed = parseVoiceInput('foi 80 reais no debito', mockCategories, contextoAnterior)

      expect(parsed.aiStatus).toBe('sucesso')
      expect(parsed.amountCents).toBe(8000)
      expect(parsed.description).toBe('Duas caixas de cerveja')
      expect(parsed.establishment).toBe('Parada Certa')
      expect(parsed.paymentMethod).toBe('debito')
      expect(parsed.categoryNameSuggestion).toBe('Alimentação / Lazer')
    })

    describe('Modo Consultor e Perguntas Reflexivas com Clarificação Pendente', () => {
      const pendingContexto = {
        descricao: 'Manicure',
        valor: 297.5,
        balde: 'lifestyle',
        tipo: 'despesa' as const,
        status: 'clarificacao_categoria',
        opcoes_sugestao: [
          'Cuidados Pessoais (Estilo de Vida)',
          'Manicure › dentro de Lazer (Estilo de Vida)',
        ],
      }

      it('(a) "qual faz mais sentido?" com clarificação pendente NÃO vira categoria e dispara resposta consultiva mantendo a transação intacta', () => {
        const parsed = parseVoiceInput('Qual faz mais sentido?', mockCategories, pendingContexto)

        // NÃO pode virar categoria e não pode virar sucesso direto
        expect(parsed.categoryNameSuggestion).not.toBe('Qual faz mais sentido?')
        expect(parsed.categoryNameSuggestion).toBeUndefined()
        expect(parsed.aiStatus).toBe('clarificacao_categoria')
        expect(parsed.tipoResposta).toBe('consultoria_categoria')
        expect(parsed.intencao).toBe('consultiva')

        // Transação original de R$ 297,50 mantida intacta
        expect(parsed.amountCents).toBe(29750)
        expect(parsed.description).toBe('Manicure')

        // Resposta consultiva explicando a melhor prática 50/30/20 e pílulas preservadas
        expect(parsed.friendlyMessage).toContain('Recomendo')
        expect(parsed.friendlyMessage).toContain('50/30/20')
        expect(parsed.clarificationOptions).toHaveLength(2)
      })

      it('outras frases de dúvida/metalinguagem ("o que você acha?", "me ajuda a escolher", "tanto faz") NÃO viram categoria', () => {
        const duvidas = [
          'O que você acha?',
          'Qual a diferença?',
          'Me ajuda a escolher',
          'Tanto faz',
          'Não sei qual escolher',
        ]

        for (const frase of duvidas) {
          const parsed = parseVoiceInput(frase, mockCategories, pendingContexto)
          expect(parsed.categoryNameSuggestion).not.toBe(frase)
          expect(parsed.aiStatus).toBe('clarificacao_categoria')
          expect(parsed.tipoResposta).toBe('consultoria_categoria')
          expect(parsed.amountCents).toBe(29750)
        }
      })

      it('(b) "fechado em cuidados pessoais" aplica a escolha e monta o card com status sucesso', () => {
        const parsed = parseVoiceInput(
          'fechado em cuidados pessoais',
          mockCategories,
          pendingContexto,
        )

        expect(parsed.aiStatus).toBe('sucesso')
        expect(parsed.amountCents).toBe(29750)
        expect(parsed.categoryNameSuggestion?.toLowerCase()).toContain('cuidados pessoais')
        expect(parsed.description).toBe('Manicure')
      })

      it('"pode ser essa" ou "a primeira" seleciona a opção correspondente', () => {
        const parsed = parseVoiceInput('a primeira', mockCategories, pendingContexto)

        expect(parsed.aiStatus).toBe('sucesso')
        expect(parsed.amountCents).toBe(29750)
        expect(parsed.categoryNameSuggestion).toBe('Cuidados Pessoais (Estilo de Vida)')
      })

      it('(c) transparência e verdade: quando o usuário pergunta "Nós temos essa categoria?", a IA responde honestamente checando a lista real', () => {
        // Categoria 'Cuidados Pessoais' NÃO está cadastrada na família (só Alimentação, Transporte, Lazer)
        const parsed = parseVoiceInput('Nós temos essa categoria?', mockCategories, pendingContexto)

        expect(parsed.aiStatus).toBe('clarificacao_categoria')
        expect(parsed.tipoResposta).toBe('consultoria_categoria')
        expect(parsed.intencao).toBe('consultiva')
        // Preserva a transação pendente intacta
        expect(parsed.amountCents).toBe(29750)
        expect(parsed.description).toBe('Manicure')
        // Resposta honesta indicando que ainda não temos cadastrada e oferecendo criar ou usar existente
        expect(parsed.friendlyMessage).toContain('Ainda não temos essa categoria cadastrada')
        expect(parsed.friendlyMessage).toContain('sugestão que posso criar')
        expect(parsed.friendlyMessage).toContain('Lazer')
      })

      it('(d) se a categoria já constar na lista real da família, confirma que já existe', () => {
        const contextoComLazer = {
          ...pendingContexto,
          categoria: 'Lazer',
        }
        const parsed = parseVoiceInput(
          'Já temos essa categoria cadastrada?',
          mockCategories,
          contextoComLazer,
        )

        expect(parsed.friendlyMessage).toContain('já temos a categoria')
        expect(parsed.amountCents).toBe(29750)
      })
    })

    describe('Pílulas estruturadas com distinção "Usar existente" vs "Criar nova"', () => {
      it('converte opções da IA em itens estruturados com rótulos e tipo ("existente" | "nova")', () => {
        const rawAiData = {
          status: 'clarificacao_categoria' as const,
          tipo_resposta: 'transacao' as const,
          transacao: {
            descricao: 'Manicure',
            estabelecimento: null,
            valor: 98,
            tipo: 'despesa' as const,
            balde: 'Estilo de Vida' as const,
            categoria: null,
            subcategoria: 'Manicure',
            metodo_pagamento: null,
          },
          pergunta_clarificacao: 'Onde prefere organizar esse gasto?',
          opcoes_sugestao: [
            {
              tipo: 'existente' as const,
              rotulo: '📁 Usar existente: Lazer › subcategoria Manicure',
              categoria: 'Lazer',
              subcategoria: 'Manicure',
              balde: 'Estilo de Vida',
            },
            {
              tipo: 'nova' as const,
              rotulo: '✨ Criar nova: Cuidados Pessoais (Estilo de Vida)',
              categoria: 'Cuidados Pessoais',
              subcategoria: null,
              balde: 'Estilo de Vida',
            },
          ],
          mensagem_amigavel: 'Identifiquei R$ 98,00! Onde prefere organizar?',
        }

        const enriched = mapAiResponseToParsedTransaction(rawAiData, 'manicure 98 reais')

        expect(enriched.structuredOptions).toBeDefined()
        expect(enriched.structuredOptions?.length).toBe(2)
        expect(enriched.structuredOptions?.[0].tipo).toBe('existente')
        expect(enriched.structuredOptions?.[0].rotulo).toContain('📁 Usar existente:')
        expect(enriched.structuredOptions?.[1].tipo).toBe('nova')
        expect(enriched.structuredOptions?.[1].rotulo).toContain('✨ Criar nova:')
        expect(enriched.clarificationOptions?.[0]).toContain('📁 Usar existente')
      })
    })
  })
})
