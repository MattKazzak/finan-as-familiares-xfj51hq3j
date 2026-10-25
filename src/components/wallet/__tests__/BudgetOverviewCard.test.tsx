import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BudgetOverviewCard } from '@/components/wallet/BudgetOverviewCard'
import { getBudgetModelTargets } from '@/services/budget-model'
import type { Family } from '@/types/finance'
import type { BucketsSummaryData } from '@/components/wallet/BudgetOverviewCard'

describe('getBudgetModelTargets', () => {
  it('retorna 60/25/15 para o modelo "60_25_15"', () => {
    expect(getBudgetModelTargets('60_25_15')).toEqual({
      essentials: 60,
      lifestyle: 25,
      future: 15,
    })
  })

  it('retorna 70/20/10 para o modelo "70_20_10"', () => {
    expect(getBudgetModelTargets('70_20_10')).toEqual({
      essentials: 70,
      lifestyle: 20,
      future: 10,
    })
  })

  it('retorna 60/20/20 para o modelo "60_20_20"', () => {
    expect(getBudgetModelTargets('60_20_20')).toEqual({
      essentials: 60,
      lifestyle: 20,
      future: 20,
    })
  })

  it('retorna 50/30/20 para "50_30_20", nulo, indefinido ou desconhecido', () => {
    expect(getBudgetModelTargets('50_30_20')).toEqual({
      essentials: 50,
      lifestyle: 30,
      future: 20,
    })
    expect(getBudgetModelTargets(null)).toEqual({
      essentials: 50,
      lifestyle: 30,
      future: 20,
    })
    expect(getBudgetModelTargets(undefined)).toEqual({
      essentials: 50,
      lifestyle: 30,
      future: 20,
    })
    expect(getBudgetModelTargets('outro_modelo')).toEqual({
      essentials: 50,
      lifestyle: 30,
      future: 20,
    })
  })
})

describe('BudgetOverviewCard', () => {
  const family602515: Family = {
    id: 'fam-test-1',
    name: 'Silva',
    created_by: 'user-1',
    created_at: '2026-01-01',
    monthly_net_income_cents: 770000, // R$ 7.700,00 (cenário reportado pelo usuário)
    budget_model: '60_25_15',
  }

  it('com budget_model 60_25_15 e teto = 60% da renda, o balde Essenciais exibe "✓ Cota 100% alocada" e NÃO exibe "acima da meta sugerida"', () => {
    // 60% de 7.700,00 = 4.620,00 (462000 centavos)
    // 25% de 7.700,00 = 1.925,00 (192500 centavos)
    // 15% de 7.700,00 = 1.155,00 (115500 centavos)
    const summaryFullAllocated: BucketsSummaryData = {
      essentials: {
        budgetCents: 462000,
        spentCents: 100000,
        percentIncome: 60,
      },
      lifestyle: {
        budgetCents: 192500,
        spentCents: 50000,
        percentIncome: 25,
      },
      future: {
        budgetCents: 115500,
        spentCents: 20000,
        percentIncome: 15,
      },
      other: {
        budgetCents: 0,
        spentCents: 0,
        percentIncome: 0,
      },
    }

    render(
      <BudgetOverviewCard
        family={family602515}
        bucketsSummary={summaryFullAllocated}
        totalBudget={770000}
        totalBudgetPercentOfIncome={100}
        totalSpent={170000}
        currentDate={new Date('2026-04-15')}
        monthKey="2026-04"
        categoryList={[]}
        onOpenModelDialog={vi.fn()}
      />,
    )

    // NÃO deve acusar "acima da meta sugerida" (antes acusava 770,00 acima porque comparava 60% com 50%)
    expect(screen.queryByText(/acima da meta sugerida/i)).toBeNull()

    // NÃO deve dizer "livres para alocar" quando o teto preenche 100% da cota
    expect(screen.queryByText(/livres para alocar/i)).toBeNull()

    // Os 3 baldes devem exibir "✓ Cota 100% alocada"
    const allocatedBadges = screen.getAllByText('✓ Cota 100% alocada')
    expect(allocatedBadges).toHaveLength(3)

    // NÃO deve exibir o texto removido "Comprometido: X% da renda"
    expect(screen.queryByText(/Comprometido:/i)).toBeNull()
  })

  it('com budget_model 60_25_15 e teto menor que a cota, exibe a folga livre para alocar calculada em cima do modelo', () => {
    // Essenciais tem apenas R$ 4.000 de teto (meta é 60% = R$ 4.620) -> R$ 620 livres
    const summaryPartial: BucketsSummaryData = {
      essentials: {
        budgetCents: 400000,
        spentCents: 100000,
        percentIncome: 52,
      },
      lifestyle: {
        budgetCents: 192500,
        spentCents: 50000,
        percentIncome: 25,
      },
      future: {
        budgetCents: 115500,
        spentCents: 20000,
        percentIncome: 15,
      },
      other: {
        budgetCents: 0,
        spentCents: 0,
        percentIncome: 0,
      },
    }

    render(
      <BudgetOverviewCard
        family={family602515}
        bucketsSummary={summaryPartial}
        totalBudget={708000}
        totalBudgetPercentOfIncome={92}
        totalSpent={170000}
        currentDate={new Date('2026-04-15')}
        monthKey="2026-04"
        categoryList={[]}
        onOpenModelDialog={vi.fn()}
      />,
    )

    expect(screen.getByText(/✨ \+ R\$ 620,00 livres para alocar/i)).toBeDefined()
  })
})
