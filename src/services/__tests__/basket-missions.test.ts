/**
 * basket-missions.test.ts
 *
 * Testes unitários para Modo Cesta — Inferência de Missão de Compra com Resposta Livre
 * CURIANGOO v0.0.277 (Rodada 28)
 */

import { describe, it, expect } from 'vitest'
import {
  extractEnumeratedItems,
  isBasketInput,
  analyzeBasketMission,
  interpretFreeTextBasketResponse,
} from '../basket-missions'
import { parseVoiceInput } from '../voice-parser'
import { CANONICAL_CATEGORIES } from '@/types/finance'

// Adaptar CANONICAL_CATEGORIES com IDs para simular catálogo real carregado
const realCategories = CANONICAL_CATEGORIES.map((cat, catIdx) => ({
  id: `cat-${catIdx}-${cat.name}`,
  name: cat.name,
  type: cat.type,
  color: cat.color,
  icon: cat.icon,
  bucket: cat.bucket,
  subcategories: cat.subcategories.map((sub, subIdx) => ({
    id: `sub-${catIdx}-${subIdx}-${sub.name}`,
    name: sub.name,
    icon: sub.icon,
  })),
}))

describe('Modo Cesta — Missão de Compra (Rodada 28)', () => {
  describe('Detecção e Extração de Itens (extractEnumeratedItems & isBasketInput)', () => {
    it('detecta enumeração com "tudo 100 reais" como cesta', () => {
      const text = '1 salame, 1 suco de maracujá e 1 caixa de cerveja, tudo 100 reais'
      expect(isBasketInput(text)).toBe(true)

      const items = extractEnumeratedItems(text)
      expect(items.length).toBe(3)
      expect(items.map((i) => i.name.toLowerCase())).toContain('salame')
      expect(items.map((i) => i.name.toLowerCase())).toContain('suco de maracuja')
      expect(items.map((i) => i.name.toLowerCase())).toContain('cerveja')
    })

    it('detecta cesta com arroz, feijão e leite', () => {
      const text = 'arroz, feijão e leite no total 45 reais'
      expect(isBasketInput(text)).toBe(true)
      const items = extractEnumeratedItems(text)
      expect(items.length).toBe(3)
    })
  })

  describe('Dicionário de Missões e Ocasiões (analyzeBasketMission)', () => {
    it('Caso 1: Cerveja + Salame + Suco → detecta ocasião de Churrasco/Evento e EXIGE confirmação', () => {
      const text = '1 salame, 1 suco de maracujá e 1 caixa de cerveja, tudo 100 reais'
      const analysis = analyzeBasketMission(text, 10000)

      expect(analysis.isBasket).toBe(true)
      expect(analysis.requiresConfirmation).toBe(true) // Regra c: NUNCA grava evento em silêncio!
      expect(analysis.missionType).toBe('social_event')
      expect(analysis.suggestedCategory).toBe('Lazer')
      expect(analysis.suggestedSubcategory).toBe('Eventos & Reuniões')
      expect(analysis.suggestedBucket).toBe('lifestyle')
      expect(analysis.naturalQuestion).toContain('Percebi')
      expect(analysis.naturalQuestion).toContain('churrasco')
    })

    it('Caso 2: Arroz + Feijão + Leite → Cesta óbvia do dia a dia → SEM pergunta, grava em Alimentação', () => {
      const text = 'arroz, feijão e leite, tudo 50 reais'
      const analysis = analyzeBasketMission(text, 5000)

      expect(analysis.isBasket).toBe(true)
      expect(analysis.requiresConfirmation).toBe(false) // Regra b: SEM pergunta
      expect(analysis.missionType).toBe('pantry_staple')
      expect(analysis.suggestedCategory).toBe('Alimentação')
      expect(analysis.suggestedSubcategory).toBe('Supermercado & Atacado')
      expect(analysis.suggestedBucket).toBe('essentials')
    })

    it('Caso 3: Pipoca + Refrigerante + Chocolate → Ocasião Noite de Filme → Exige pergunta', () => {
      const text = 'pipoca, coca cola e barra de chocolate, deu 35 reais'
      const analysis = analyzeBasketMission(text, 3500)

      expect(analysis.requiresConfirmation).toBe(true)
      expect(analysis.missionType).toBe('movie_party')
      expect(analysis.suggestedCategory).toBe('Lazer')
      expect(analysis.naturalQuestion).toContain('filme')
    })

    it('Caso 4: Flores + bombom de presente → Ocasião Presente', () => {
      const text = 'buquê de flores e caixa de bombom, tudo 80 reais'
      const analysis = analyzeBasketMission(text, 8000)

      expect(analysis.requiresConfirmation).toBe(true)
      expect(analysis.missionType).toBe('gift')
      expect(analysis.suggestedCategory).toBe('Compras')
      expect(analysis.suggestedSubcategory).toBe('Presentes')
    })

    it('Caso 5: Fralda + pomada + lenço umedecido → Compras › Bebês & Crianças direto', () => {
      const text = 'pacote de fraldas, pomada de assadura e lencinho, 90 reais tudo'
      const analysis = analyzeBasketMission(text, 9000)

      expect(analysis.requiresConfirmation).toBe(false)
      expect(analysis.missionType).toBe('baby')
      expect(analysis.suggestedCategory).toBe('Compras')
      expect(analysis.suggestedSubcategory).toBe('Bebês & Crianças')
    })
  })

  describe('Interpretação de Resposta LIVRE (sem chips/cards)', () => {
    const churrascoAnalysis = analyzeBasketMission(
      '1 salame, 1 suco de maracujá e 1 caixa de cerveja, tudo 100 reais',
      10000,
    )

    it('confirmação afirmativa: "foi um churrasco sim" → Lazer › Eventos & Reuniões', () => {
      const interpretation = interpretFreeTextBasketResponse(
        'foi um churrasco sim',
        churrascoAnalysis,
      )
      expect(interpretation.intent).toBe('confirm_event')
      expect(interpretation.category).toBe('Lazer')
      expect(interpretation.subcategory).toBe('Eventos & Reuniões')
      expect(interpretation.bucket).toBe('lifestyle')
    })

    it('confirmação alternativa: "sim, resenha com os amigos" → Lazer › Eventos & Reuniões', () => {
      const interpretation = interpretFreeTextBasketResponse(
        'sim, resenha com os amigos',
        churrascoAnalysis,
      )
      expect(interpretation.intent).toBe('confirm_event')
      expect(interpretation.category).toBe('Lazer')
    })

    it('negação/rejeição: "não, compra de casa" → Alimentação › Supermercado & Atacado', () => {
      const interpretation = interpretFreeTextBasketResponse(
        'não, compra de casa',
        churrascoAnalysis,
      )
      expect(interpretation.intent).toBe('reject_event')
      expect(interpretation.category).toBe('Alimentação')
      expect(interpretation.subcategory).toBe('Supermercado & Atacado')
      expect(interpretation.bucket).toBe('essentials')
    })

    it('divisão contextual: "cerveja pro churrasco, resto é da casa" → propõe divisão com confirmação de valores', () => {
      const interpretation = interpretFreeTextBasketResponse(
        'cerveja pro churrasco, resto é da casa',
        churrascoAnalysis,
      )
      expect(interpretation.intent).toBe('split_basket')
      expect(interpretation.splitItems?.length).toBe(2)
      // Confirmação dos valores estimados (~R$ 40 cerveja e ~R$ 60 casa)
      expect(interpretation.confirmationQuestion).toContain('40')
      expect(interpretation.confirmationQuestion).toContain('60')
    })

    it('resposta ambígua: "sei lá" → pergunta de follow-up com sugestão incerta', () => {
      const interpretation = interpretFreeTextBasketResponse('sei lá', churrascoAnalysis)
      expect(interpretation.intent).toBe('ambiguous')
      expect(interpretation.isUncertainSuggestion).toBe(true)
      expect(interpretation.confirmationQuestion).toContain('Não entendi')
    })
  })

  describe('Integração com parseVoiceInput (Multi-Turno)', () => {
    it('Turno 1: Lança cesta de churrasco → devolve status modo_cesta com pergunta natural e SEM chips', () => {
      const parsed = parseVoiceInput(
        '1 salame, 1 suco de maracujá e 1 caixa de cerveja, tudo 100 reais',
        realCategories,
      )

      expect(parsed.aiStatus).toBe('modo_cesta')
      expect(parsed.amountCents).toBe(10000)
      expect(parsed.clarificationOptions).toBeNull() // Decisão UX fixa: SEM chips/cards de resposta rápida
      expect(parsed.clarificationQuestion).toContain('Percebi')
      expect(parsed.clarificationQuestion).toContain('churrasco')
    })

    it('Turno 2: Usuário responde livremente "foi um churrasco sim" → Lança 1 transação em Lazer com descrição dos itens', () => {
      const parsedTurn2 = parseVoiceInput('foi um churrasco sim', realCategories, {
        descricao: 'Salame, suco de maracujá, cerveja',
        valor: 100,
        status: 'modo_cesta',
        categoria: 'Lazer',
        subcategoria: 'Eventos & Reuniões',
        balde: 'lifestyle',
      })

      expect(parsedTurn2.aiStatus).toBe('sucesso')
      expect(parsedTurn2.amountCents).toBe(10000)
      expect(parsedTurn2.categoryNameSuggestion).toBe('Lazer')
      expect(parsedTurn2.subcategoryNameSuggestion).toBe('Eventos & Reuniões')
      expect(parsedTurn2.bucketSuggestion).toBe('lifestyle')
      expect(parsedTurn2.description).toContain('Salame')
      expect(parsedTurn2.description).toContain('churrasco')
    })

    it('Turno 2 alternativo: Usuário responde "não, compra de casa" → Lança em Alimentação › Supermercado & Atacado', () => {
      const parsedTurn2 = parseVoiceInput('não, compra de casa', realCategories, {
        descricao: 'Salame, suco de maracujá, cerveja',
        valor: 100,
        status: 'modo_cesta',
        categoria: 'Lazer',
        subcategoria: 'Eventos & Reuniões',
        balde: 'lifestyle',
      })

      expect(parsedTurn2.aiStatus).toBe('sucesso')
      expect(parsedTurn2.amountCents).toBe(10000)
      expect(parsedTurn2.categoryNameSuggestion).toBe('Alimentação')
      expect(parsedTurn2.subcategoryNameSuggestion).toBe('Supermercado & Atacado')
      expect(parsedTurn2.bucketSuggestion).toBe('essentials')
      expect(parsedTurn2.description).toContain('casa')
    })

    it('Cesta óbvia: "arroz, feijão e leite 40 reais" → Grava direto em Alimentação sem pergunta', () => {
      const parsed = parseVoiceInput('arroz, feijão e leite, tudo 40 reais', realCategories)

      expect(parsed.aiStatus).toBe('sucesso')
      expect(parsed.amountCents).toBe(4000)
      expect(parsed.categoryNameSuggestion).toBe('Alimentação')
      expect(parsed.subcategoryNameSuggestion).toBe('Supermercado & Atacado')
      expect(parsed.clarificationQuestion).toBeNull()
    })
  })
})
