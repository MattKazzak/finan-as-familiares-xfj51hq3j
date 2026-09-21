import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSafeDateForMonth, processAutoRecurringIncomes } from '../recurring-incomes'
import { supabase } from '@/lib/supabase/client'

// Mock do supabase client
vi.mock('@/lib/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  }
})

describe('recurring-incomes service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSafeDateForMonth', () => {
    it('deve formatar data padrão com padding de dois dígitos', () => {
      expect(getSafeDateForMonth('2026-03', 5)).toBe('2026-03-05')
      expect(getSafeDateForMonth('2026-03', 15)).toBe('2026-03-15')
    })

    it('deve limitar para o último dia do mês se o dia solicitado exceder (fevereiro não-bissexto / bissexto)', () => {
      // 2026 não é bissexto: fevereiro tem 28 dias
      expect(getSafeDateForMonth('2026-02', 31)).toBe('2026-02-28')
      expect(getSafeDateForMonth('2026-02', 30)).toBe('2026-02-28')

      // Abril tem 30 dias
      expect(getSafeDateForMonth('2026-04', 31)).toBe('2026-04-30')

      // Março tem 31 dias
      expect(getSafeDateForMonth('2026-03', 31)).toBe('2026-03-31')
    })
  })

  describe('processAutoRecurringIncomes idempotência', () => {
    it('não deve recriar transação se o mês já possuir transação vinculada à receita fixa', async () => {
      const mockFamilyId = 'fam-123'
      const mockMonth = '2026-03'

      // Mock da consulta recurring_incomes
      const recurringIncomesMock = [
        {
          id: 'rec-1',
          family_id: mockFamilyId,
          member_id: 'mem-1',
          name: 'Salário Fixo',
          amount_cents: 500000,
          day_of_month: 5,
          active: true,
          category_id: null,
          subcategory_id: null,
        },
      ]

      // Mock da consulta recurring_income_overrides (vazia)
      const overridesMock: any[] = []

      // Mock de transações existentes no mês com vínculo à receita fixa rec-1
      const existingTxsMock = [
        {
          id: 'tx-existing-1',
          recurring_income_id: 'rec-1',
          recurring_month: '2026-03-01',
        },
      ]

      const insertMock = vi.fn()

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'recurring_incomes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: recurringIncomesMock, error: null }),
                }),
              }),
            }),
          }
        }
        if (table === 'recurring_income_overrides') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: overridesMock, error: null }),
              }),
            }),
          }
        }
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: existingTxsMock, error: null }),
              }),
            }),
            insert: insertMock,
          }
        }
        return {}
      })

      ;(supabase.from as any) = fromMock

      const result = await processAutoRecurringIncomes({
        familyId: mockFamilyId,
        targetMonthStr: mockMonth,
        forceAllDays: true,
      })

      expect(result.generatedCount).toBe(0)
      expect(insertMock).not.toHaveBeenCalled()
    })

    it('deve gerar 1 transação se ainda não existe para aquele mês e dia alcançado', async () => {
      const mockFamilyId = 'fam-123'
      const mockMonth = '2026-03'

      const recurringIncomesMock = [
        {
          id: 'rec-2',
          family_id: mockFamilyId,
          member_id: 'mem-1',
          name: 'Pró-labore',
          amount_cents: 700000,
          day_of_month: 5,
          active: true,
          category_id: null,
          subcategory_id: null,
        },
      ]

      const overridesMock: any[] = []
      const existingTxsMock: any[] = []

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'recurring_incomes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: recurringIncomesMock, error: null }),
                }),
              }),
            }),
          }
        }
        if (table === 'recurring_income_overrides') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: overridesMock, error: null }),
              }),
            }),
          }
        }
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: existingTxsMock, error: null }),
              }),
            }),
            insert: insertMock,
          }
        }
        return {}
      })

      ;(supabase.from as any) = fromMock

      const result = await processAutoRecurringIncomes({
        familyId: mockFamilyId,
        targetMonthStr: mockMonth,
        forceAllDays: true,
      })

      expect(result.generatedCount).toBe(1)
      expect(insertMock).toHaveBeenCalledTimes(1)
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          family_id: mockFamilyId,
          member_id: 'mem-1',
          type: 'income',
          amount_cents: 700000,
          description: 'Pró-labore',
          recurring_income_id: 'rec-2',
          is_recurring: true,
          recurring_month: '2026-03-01',
        }),
      )
    })

    it('deve gerar despesa fixa com type "expense"', async () => {
      const mockFamilyId = 'fam-123'
      const mockMonth = '2026-03'

      const recurringExpenseMock = [
        {
          id: 'rec-exp-1',
          family_id: mockFamilyId,
          member_id: 'mem-1',
          name: 'Aluguel Apartamento',
          type: 'expense',
          amount_cents: 350000,
          day_of_month: 10,
          active: true,
          category_id: null,
          subcategory_id: null,
        },
      ]

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'recurring_incomes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: recurringExpenseMock, error: null }),
                }),
              }),
            }),
          }
        }
        if (table === 'recurring_income_overrides') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            insert: insertMock,
          }
        }
        return {}
      })

      ;(supabase.from as any) = fromMock

      const result = await processAutoRecurringIncomes({
        familyId: mockFamilyId,
        targetMonthStr: mockMonth,
        forceAllDays: true,
      })

      expect(result.generatedCount).toBe(1)
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          family_id: mockFamilyId,
          type: 'expense',
          amount_cents: 350000,
          description: 'Aluguel Apartamento',
          recurring_income_id: 'rec-exp-1',
          is_recurring: true,
        }),
      )
    })
  })
})
