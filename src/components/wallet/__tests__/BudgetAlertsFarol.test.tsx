import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BudgetAlertsFarol } from '@/components/wallet/BudgetAlertsFarol'
import type { Family, TransactionCategory } from '@/types/finance'
import type { BucketsSummaryData } from '@/components/wallet/BudgetOverviewCard'

const mockFamily: Family = {
  id: 'fam-test-1',
  name: 'Silva',
  created_by: 'user-1',
  created_at: '2026-01-01',
  monthly_net_income_cents: 1000000, // R$ 10.000,00
}

const mockBucketsSummary: BucketsSummaryData = {
  essentials: {
    spentCents: 400000,
    budgetCents: 500000,
    percentIncome: 50,
  },
  lifestyle: {
    spentCents: 200000,
    budgetCents: 300000,
    percentIncome: 30,
  },
  future: {
    spentCents: 50000,
    budgetCents: 200000,
    percentIncome: 20,
  },
  other: {
    spentCents: 0,
    budgetCents: 0,
    percentIncome: 0,
  },
}

const mockExpenseCategory: TransactionCategory = {
  id: 'cat-1',
  family_id: 'fam-test-1',
  name: 'Supermercado',
  icon: 'ShoppingCart',
  color: '#10B981',
  created_at: '2026-01-01',
  budget_bucket: 'essentials',
  type: 'expense',
}

const mockFutureCategory: TransactionCategory = {
  id: 'cat-future-1',
  family_id: 'fam-test-1',
  name: 'Reserva de Emergência',
  icon: 'Shield',
  color: '#3B82F6',
  created_at: '2026-01-01',
  budget_bucket: 'future',
  type: 'expense',
}

describe('BudgetAlertsFarol', () => {
  it('exibe estado neutro/calmo "✨ Tudo dentro das metas este mês" quando não houver alertas', () => {
    render(
      <BudgetAlertsFarol
        family={mockFamily}
        bucketsSummary={mockBucketsSummary}
        totalBudget={1000000}
        totalBudgetPercentOfIncome={100}
        categoryList={[
          {
            category: mockExpenseCategory,
            limitCents: 100000,
            spentCents: 50000,
            percent: 50,
            isOver: false,
          },
        ]}
        currentDate={new Date('2026-04-15')}
        monthKey="2026-04"
        onOpenCategoryEditor={vi.fn()}
      />,
    )

    expect(screen.getByText('Tudo dentro das metas este mês')).toBeDefined()
  })

  it('NÃO gera alerta de aporte baixo para categorias do balde Futuro & Metas (aporte < 70%)', () => {
    render(
      <BudgetAlertsFarol
        family={mockFamily}
        bucketsSummary={mockBucketsSummary}
        totalBudget={1000000}
        totalBudgetPercentOfIncome={100}
        categoryList={[
          {
            category: mockFutureCategory,
            limitCents: 200000, // R$ 2.000
            spentCents: 30000, // R$ 300 (15% de aporte, abaixo de 70%)
            percent: 15,
            isOver: false,
          },
        ]}
        currentDate={new Date('2026-04-15')}
        monthKey="2026-04"
        onOpenCategoryEditor={vi.fn()}
      />,
    )

    // Não deve haver nenhum alerta de "Priorize sua reserva" ou "Aporte em"
    expect(screen.queryByText(/Priorize sua reserva/i)).toBeNull()
    expect(screen.queryByText(/Aporte em/i)).toBeNull()
    // Deve ficar no estado calmo
    expect(screen.getByText('Tudo dentro das metas este mês')).toBeDefined()
  })

  it('exibe os 5 tipos de alerta previstos: estouro de renda, estourou teto, no limite >90%, atenção >=71%, balde acima da meta', () => {
    const mockExpenseOver: TransactionCategory = {
      id: 'cat-over',
      family_id: 'fam-test-1',
      name: 'Restaurante',
      icon: 'Utensils',
      color: '#EF4444',
      created_at: '2026-01-01',
      budget_bucket: 'lifestyle',
      type: 'expense',
    }
    const mockExpense90: TransactionCategory = {
      id: 'cat-90',
      family_id: 'fam-test-1',
      name: 'Lazer',
      icon: 'Film',
      color: '#F59E0B',
      created_at: '2026-01-01',
      budget_bucket: 'lifestyle',
      type: 'expense',
    }
    const mockExpense71: TransactionCategory = {
      id: 'cat-71',
      family_id: 'fam-test-1',
      name: 'Combustível',
      icon: 'Car',
      color: '#3B82F6',
      created_at: '2026-01-01',
      budget_bucket: 'essentials',
      type: 'expense',
    }

    const overBucketsSummary: BucketsSummaryData = {
      ...mockBucketsSummary,
      lifestyle: {
        spentCents: 350000,
        budgetCents: 350000, // 35% da renda (> 30%)
        percentIncome: 35,
      },
    }

    const onEditCategory = vi.fn()
    const onOpenModel = vi.fn()

    render(
      <BudgetAlertsFarol
        family={mockFamily}
        bucketsSummary={overBucketsSummary}
        totalBudget={1200000} // 120% da renda -> estouro de renda líquida (crítico fora do accordion)
        totalBudgetPercentOfIncome={120}
        categoryList={[
          {
            category: mockExpenseOver,
            limitCents: 100000,
            spentCents: 120000,
            percent: 120,
            isOver: true,
          },
          {
            category: mockExpense90,
            limitCents: 100000,
            spentCents: 95000,
            percent: 95,
            isOver: false,
          },
          {
            category: mockExpense71,
            limitCents: 100000,
            spentCents: 75000,
            percent: 75,
            isOver: false,
          },
          {
            // Categoria do balde futuro não deve virar alerta
            category: mockFutureCategory,
            limitCents: 200000,
            spentCents: 20000,
            percent: 10,
            isOver: false,
          },
        ]}
        currentDate={new Date('2026-04-15')}
        monthKey="2026-04"
        onOpenCategoryEditor={onEditCategory}
        onOpenModelDialog={onOpenModel}
      />,
    )

    // 1. Estouro da renda líquida fica visível imediatamente (fora do accordion)
    expect(screen.getByText('Estouro da Renda Líquida')).toBeDefined()
    expect(screen.getByText('Aviso Crítico')).toBeDefined()

    // 2. Farol resumido recolhido por padrão
    const toggleButton = screen.getByRole('button', { name: /Farol/i })
    expect(toggleButton).toBeDefined()

    // Expandir accordion
    fireEvent.click(toggleButton)

    // Categoria estourou teto
    expect(screen.getByText('Restaurante')).toBeDefined()
    expect(screen.getByText(/Estourou o teto/)).toBeDefined()

    // Categoria >90%
    expect(screen.getByText('Lazer')).toBeDefined()
    expect(screen.getByText(/90%\+ consumido/)).toBeDefined()

    // Categoria >=71%
    expect(screen.getByText('Combustível')).toBeDefined()
    expect(screen.getByText(/Atenção preventiva/)).toBeDefined()

    // Balde acima da meta
    expect(screen.getByText(/Balde Estilo de Vida acima da meta/)).toBeDefined()

    // Categoria do balde futuro NÃO está na lista
    expect(screen.queryByText('Reserva de Emergência')).toBeNull()
  })

  it('com budget_model 60_25_15 e tetos plenos (60%/25%/15%), o Farol NÃO acusa nenhum balde acima da meta', () => {
    const family602515: Family = {
      ...mockFamily,
      budget_model: '60_25_15',
    }

    // Tetos exatamente escalados no modelo 60/25/15:
    // Essenciais: 60% = R$ 6.000,00
    // Lifestyle: 25% = R$ 2.500,00
    // Future: 15% = R$ 1.500,00
    const summary602515: BucketsSummaryData = {
      essentials: {
        budgetCents: 600000,
        spentCents: 400000,
        percentIncome: 60,
      },
      lifestyle: {
        budgetCents: 250000,
        spentCents: 150000,
        percentIncome: 25,
      },
      future: {
        budgetCents: 150000,
        spentCents: 50000,
        percentIncome: 15,
      },
      other: {
        budgetCents: 0,
        spentCents: 0,
        percentIncome: 0,
      },
    }

    render(
      <BudgetAlertsFarol
        family={family602515}
        bucketsSummary={summary602515}
        totalBudget={1000000}
        totalBudgetPercentOfIncome={100}
        categoryList={[
          {
            category: mockExpenseCategory,
            limitCents: 600000,
            spentCents: 400000,
            percent: 66,
            isOver: false,
          },
        ]}
        currentDate={new Date('2026-04-15')}
        monthKey="2026-04"
        onOpenCategoryEditor={vi.fn()}
      />,
    )

    // Nenhum balde deve ser acusado como acima da meta
    expect(screen.queryByText(/acima da meta/i)).toBeNull()
    expect(screen.queryByText(/balde no limite/i)).toBeNull()
    expect(screen.getByText('Tudo dentro das metas este mês')).toBeDefined()
  })
})
