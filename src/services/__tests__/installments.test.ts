import { describe, it, expect } from 'vitest'
import {
  parseInstallmentFromDescription,
  addMonthsToDate,
  generateInstallmentTransactions,
  cleanInstallmentBaseDescription,
  formatTransactionTitle,
} from '../installments'

describe('Installment parser & generator', () => {
  describe('parseInstallmentFromDescription', () => {
    it('detects standard Nubank XX/YY pattern: Compra 03/10', () => {
      const result = parseInstallmentFromDescription('Compra 03/10')
      expect(result.isInstallment).toBe(true)
      expect(result.current).toBe(3)
      expect(result.total).toBe(10)
      expect(result.cleanDescription).toBe('Compra')
    })

    it('detects PARC XX/YY format: PARC 3/10 Magazine Luiza', () => {
      const result = parseInstallmentFromDescription('PARC 3/10 Magazine Luiza')
      expect(result.isInstallment).toBe(true)
      expect(result.current).toBe(3)
      expect(result.total).toBe(10)
    })

    it('detects PARC XX format without explicit total: UBER TRIP PARC 02', () => {
      const result = parseInstallmentFromDescription('UBER TRIP PARC 02')
      expect(result.isInstallment).toBe(true)
      expect(result.current).toBe(2)
      expect(result.total).toBeGreaterThanOrEqual(2)
    })

    it('detects 1/YY: iPhone 1/12 Apple Store', () => {
      const result = parseInstallmentFromDescription('iPhone 1/12 Apple Store')
      expect(result.isInstallment).toBe(true)
      expect(result.current).toBe(1)
      expect(result.total).toBe(12)
    })

    it('returns false for regular non-installment descriptions', () => {
      const result = parseInstallmentFromDescription('Supermercado Pao de Acucar')
      expect(result.isInstallment).toBe(false)
      expect(result.current).toBe(1)
      expect(result.total).toBe(1)
    })
  })

  describe('addMonthsToDate', () => {
    it('adds months cleanly', () => {
      expect(addMonthsToDate('2026-03-15', 1)).toBe('2026-04-15')
      expect(addMonthsToDate('2026-03-15', 3)).toBe('2026-06-15')
      expect(addMonthsToDate('2026-11-15', 2)).toBe('2027-01-15')
    })

    it('handles end-of-month clamping (e.g. 31st of Jan -> Feb)', () => {
      // 2026 is not a leap year, Feb has 28 days
      expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28')
    })
  })

  describe('generateInstallmentTransactions', () => {
    it('generates 1 confirmed and N-1 projected transactions', () => {
      const gen = generateInstallmentTransactions({
        familyId: 'fam-1',
        memberId: 'mem-1',
        categoryId: 'cat-1',
        baseDescription: 'Sofá Sala',
        amountCents: 15000,
        baseDate: '2026-04-10',
        startInstallmentNumber: 1,
        totalInstallments: 4,
      })

      expect(gen.transactions.length).toBe(4)
      expect(gen.transactions[0].status).toBe('confirmed')
      expect(gen.transactions[0].installment_number).toBe(1)
      expect(gen.transactions[0].transaction_date).toBe('2026-04-10')

      expect(gen.transactions[1].status).toBe('projected')
      expect(gen.transactions[1].installment_number).toBe(2)
      expect(gen.transactions[1].transaction_date).toBe('2026-05-10')

      expect(gen.transactions[2].status).toBe('projected')
      expect(gen.transactions[2].installment_number).toBe(3)
      expect(gen.transactions[2].transaction_date).toBe('2026-06-10')

      expect(gen.transactions[3].status).toBe('projected')
      expect(gen.transactions[3].installment_number).toBe(4)
      expect(gen.transactions[3].transaction_date).toBe('2026-07-10')

      expect(gen.transactions.every((t) => t.installment_group_id === gen.groupId)).toBe(true)
      expect(gen.transactions.every((t) => t.is_installment === true)).toBe(true)
      expect(gen.transactions[0].description).toBe('Sofá Sala - Parcela 1/4')
      expect(gen.transactions[1].description).toBe('Sofá Sala - Parcela 2/4')
      expect(gen.transactions[2].description).toBe('Sofá Sala - Parcela 3/4')
      expect(gen.transactions[3].description).toBe('Sofá Sala - Parcela 4/4')
    })
  })

  describe('cleanInstallmentBaseDescription', () => {
    it('cleans - Parcela X/Y suffix and (XX/YY) suffix', () => {
      expect(cleanInstallmentBaseDescription('Flavios Calcados - Parcela 1/10')).toBe(
        'Flavios Calcados',
      )
      expect(cleanInstallmentBaseDescription('Flavios Calcados - Parcela 1/10 (02/10)')).toBe(
        'Flavios Calcados',
      )
      expect(cleanInstallmentBaseDescription('Hifly Goiania - Parcela 1/6 (06/06)')).toBe(
        'Hifly Goiania',
      )
      expect(cleanInstallmentBaseDescription('Wwwemba*Emb*Cantelle - Parcela 1/2')).toBe(
        'Wwwemba*Emb*Cantelle',
      )
    })

    it('cleans PARC 03/10 or simple 03/10 at the end', () => {
      expect(cleanInstallmentBaseDescription('Loja Zara PARC 02/05')).toBe('Loja Zara')
      expect(cleanInstallmentBaseDescription('Amazon 01/12')).toBe('Amazon')
    })
  })

  describe('formatTransactionTitle', () => {
    it('reconstructs title using real installment_number and installment_total from DB', () => {
      const formatted = formatTransactionTitle({
        description: 'Flavios Calcados - Parcela 1/10 (10/10)',
        is_installment: true,
        installment_number: 10,
        installment_total: 10,
      })
      expect(formatted).toBe('Flavios Calcados - Parcela 10/10')
    })

    it('formats intermediary installment without duplicate parentheses', () => {
      const formatted = formatTransactionTitle({
        description: 'Flavios Calcados - Parcela 1/10 (07/10)',
        is_installment: true,
        installment_number: 7,
        installment_total: 10,
      })
      expect(formatted).toBe('Flavios Calcados - Parcela 7/10')
    })

    it('formats first installment cleanly', () => {
      const formatted = formatTransactionTitle({
        description: 'Flavios Calcados - Parcela 1/10',
        is_installment: true,
        installment_number: 1,
        installment_total: 10,
      })
      expect(formatted).toBe('Flavios Calcados - Parcela 1/10')
    })

    it('returns clean description for regular transactions', () => {
      const formatted = formatTransactionTitle({
        description: 'Supermercado Pão de Açúcar',
        is_installment: false,
      })
      expect(formatted).toBe('Supermercado Pão de Açúcar')
    })

    it('falls back to category name if description is empty', () => {
      const formatted = formatTransactionTitle({
        description: '',
        is_installment: false,
        category: { name: 'Alimentação' },
      })
      expect(formatted).toBe('Alimentação')
    })
  })
})
