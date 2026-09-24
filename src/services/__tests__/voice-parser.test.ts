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
  })
})
