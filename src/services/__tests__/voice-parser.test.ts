import { describe, it, expect } from 'vitest'
import {
  parseWordsToNumber,
  extractAmountFromVoiceText,
  extractPaymentMethod,
  extractTransactionType,
  parseVoiceInput,
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
      { id: '1', name: 'Alimentação', type: 'expense', budget_bucket: 'essential' },
      { id: '2', name: 'Lazer', type: 'expense', budget_bucket: 'lifestyle' },
      { id: '3', name: 'Saúde', type: 'expense', budget_bucket: 'essential' },
      { id: '4', name: 'Salário', type: 'income', budget_bucket: 'essential' },
    ]

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

    it('classifica frase ambígua com valor ("pindamonhangaba 8 reais") como "clarificacao"', () => {
      const parsed = parseVoiceInput('pindamonhangaba 8 reais', mockCategories)
      expect(parsed.amountCents).toBe(800)
      expect(parsed.amountFormatted).toMatch(/8[,.]00/)
      expect(parsed.aiStatus).toBe('clarificacao')
      expect(parsed.clarificationQuestion).toBe('O que foi Pindamonhangaba?')
      expect(parsed.friendlyMessage).toContain('Entendi')
      expect(parsed.friendlyMessage).toContain('Pindamonhangaba')
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
      expect(parsed.friendlyMessage).toContain('Não consegui identificar o valor')
    })
  })
})
