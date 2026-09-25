import { describe, it, expect } from 'vitest'
import {
  parseInstallmentFromDescription,
  addMonthsToDate,
  generateInstallmentTransactions,
  cleanInstallmentBaseDescription,
  formatTransactionTitle,
  groupInstallmentTransactions,
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

  describe('groupInstallmentTransactions', () => {
    it('groups multiple installments belonging to the same purchase into a single line', () => {
      const mockTxs = [
        {
          id: 'tx-10',
          member_id: 'm-1',
          description: 'Flavios Calcados - Parcela 1/10 (10/10)',
          is_installment: true,
          installment_number: 10,
          installment_total: 10,
          installment_group_id: 'grp-flavios',
          transaction_date: '2027-06-01',
          amount_cents: 30145,
          type: 'expense' as const,
        },
        {
          id: 'tx-9',
          member_id: 'm-1',
          description: 'Flavios Calcados - Parcela 1/10 (09/10)',
          is_installment: true,
          installment_number: 9,
          installment_total: 10,
          installment_group_id: 'grp-flavios',
          transaction_date: '2027-05-01',
          amount_cents: 30145,
          type: 'expense' as const,
        },
        {
          id: 'tx-8',
          member_id: 'm-1',
          description: 'Flavios Calcados - Parcela 1/10 (08/10)',
          is_installment: true,
          installment_number: 8,
          installment_total: 10,
          installment_group_id: 'grp-flavios',
          transaction_date: '2027-04-01',
          amount_cents: 30145,
          type: 'expense' as const,
        },
        {
          id: 'tx-hifly-6',
          member_id: 'm-1',
          description: 'Hifly Goiania - Parcela 1/6 (06/06)',
          is_installment: true,
          installment_number: 6,
          installment_total: 6,
          installment_group_id: 'grp-hifly',
          transaction_date: '2027-02-01',
          amount_cents: 10330,
          type: 'expense' as const,
        },
        {
          id: 'tx-normal',
          member_id: 'm-1',
          description: 'Supermercado Carrefour',
          is_installment: false,
          transaction_date: '2026-08-10',
          amount_cents: 15420,
          type: 'expense' as const,
        },
      ]

      const grouped = groupInstallmentTransactions(mockTxs)

      // Expected: 3 items (Flavios consolidated, Hifly consolidated, Supermercado normal)
      expect(grouped.length).toBe(3)

      // 1. Flavios Calcados (mais recente: 2027-06-01)
      const flavios = grouped[0]
      expect(flavios.isGroup).toBe(true)
      expect(flavios.baseDescription).toBe('Flavios Calcados')
      expect(flavios.currentInstallment).toBe(10)
      expect(flavios.totalInstallments).toBe(10)
      expect(flavios.installmentCount).toBe(3)
      expect(flavios.amountCents).toBe(30145)
      expect(flavios.transactionDate).toBe('2027-06-01')

      // 2. Hifly Goiania (data: 2027-02-01)
      const hifly = grouped[1]
      expect(hifly.isGroup).toBe(true)
      expect(hifly.baseDescription).toBe('Hifly Goiania')
      expect(hifly.currentInstallment).toBe(6)
      expect(hifly.totalInstallments).toBe(6)
      expect(hifly.installmentCount).toBe(1)
      expect(hifly.amountCents).toBe(10330)

      // 3. Regular transaction (data: 2026-08-10)
      const carrefour = grouped[2]
      expect(carrefour.isGroup).toBe(false)
      expect(carrefour.baseDescription).toBe('Supermercado Carrefour')
      expect(carrefour.amountCents).toBe(15420)
    })

    it('orders grouped result in descending order by transactionDate even if input is unordered', () => {
      // Simula caso real reportado: transação de ontem inserida depois de transações futuras/passadas
      const mockTxs = [
        {
          id: 'old-parc',
          member_id: 'm-1',
          description: 'Hifly Goiania - Parcela 1/6 (06/06)',
          is_installment: true,
          installment_number: 6,
          installment_total: 6,
          transaction_date: '2025-02-01',
          amount_cents: 10000,
        },
        {
          id: 'manicure-ontem',
          member_id: 'm-1',
          description: 'Manicure',
          is_installment: false,
          transaction_date: '2026-03-29',
          amount_cents: 8000,
        },
        {
          id: 'padaria-hoje',
          member_id: 'm-1',
          description: 'Padaria',
          is_installment: false,
          transaction_date: '2026-03-30',
          amount_cents: 2500,
        },
        {
          id: 'futuro-parc',
          member_id: 'm-1',
          description: 'Geladeira 01/10',
          is_installment: true,
          installment_number: 1,
          installment_total: 10,
          transaction_date: '2026-03-28',
          amount_cents: 20000,
        },
      ]

      const grouped = groupInstallmentTransactions(mockTxs)

      // Ordem esperada: Padaria (2026-03-30) > Manicure (2026-03-29) > Geladeira (2026-03-28) > Hifly (2025-02-01)
      expect(grouped.map((g) => g.baseDescription)).toEqual([
        'Padaria',
        'Manicure',
        'Geladeira',
        'Hifly Goiania',
      ])
      expect(grouped.map((g) => g.transactionDate)).toEqual([
        '2026-03-30',
        '2026-03-29',
        '2026-03-28',
        '2025-02-01',
      ])
    })

    it('groups installments even without installment_group_id if cleanDescription and member match', () => {
      const mockTxs = [
        {
          id: 'a1',
          member_id: 'm-1',
          description: 'Magazine Luiza 02/05',
          is_installment: true,
          installment_number: 2,
          installment_total: 5,
          transaction_date: '2026-09-01',
          amount_cents: 8000,
        },
        {
          id: 'a2',
          member_id: 'm-1',
          description: 'Magazine Luiza 01/05',
          is_installment: true,
          installment_number: 1,
          installment_total: 5,
          transaction_date: '2026-08-01',
          amount_cents: 8000,
        },
      ]

      const grouped = groupInstallmentTransactions(mockTxs)
      expect(grouped.length).toBe(1)
      expect(grouped[0].baseDescription).toBe('Magazine Luiza')
      expect(grouped[0].currentInstallment).toBe(2)
      expect(grouped[0].totalInstallments).toBe(5)
    })
  })
})
