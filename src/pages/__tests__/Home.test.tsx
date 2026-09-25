import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import Home from '../Home'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

let mockFamily: any = {
  id: 'fam-1',
  name: 'Silva',
  monthly_net_income_cents: 600000, // R$ 6.000,00 -> 50% = R$ 3.000, 30% = R$ 1.800, 20% = R$ 1.200
}

const mockCategories = [
  { id: 'cat-1', name: 'Moradia', type: 'expense', budget_bucket: 'essentials' },
  { id: 'cat-2', name: 'Lazer', type: 'expense', budget_bucket: 'lifestyle' },
  { id: 'cat-3', name: 'Reserva', type: 'expense', budget_bucket: 'future' },
]

const todayStr = new Date().toISOString().slice(0, 7) + '-10'

let mockTransactions: any[] = [
  // Necessidades: R$ 1.500
  {
    id: 'tx-1',
    family_id: 'fam-1',
    category_id: 'cat-1',
    type: 'expense',
    amount_cents: 150000,
    transaction_date: todayStr,
    created_at: new Date().toISOString(),
    description: 'Aluguel',
  },
  // Estilo de vida: R$ 600
  {
    id: 'tx-2',
    family_id: 'fam-1',
    category_id: 'cat-2',
    type: 'expense',
    amount_cents: 60000,
    transaction_date: todayStr,
    created_at: new Date().toISOString(),
    description: 'Restaurante',
  },
  // Futuro: R$ 400
  {
    id: 'tx-3',
    family_id: 'fam-1',
    category_id: 'cat-3',
    type: 'expense',
    amount_cents: 40000,
    transaction_date: todayStr,
    created_at: new Date().toISOString(),
    description: 'Aporte CDB',
  },
]

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: mockFamily,
    members: [{ id: 'm-1', name: 'Lucas', is_admin: true }],
    categories: mockCategories,
    currentMember: { id: 'm-1', name: 'Lucas', is_admin: true },
    openWhoIsUsing: vi.fn(),
    selectedMemberId: null,
    setSelectedMemberId: vi.fn(),
    openNewTransaction: vi.fn(),
    refreshTrigger: 0,
    triggerRefresh: vi.fn(),
  }),
}))

vi.mock('@/services/transactions', () => ({
  fetchTransactions: vi.fn(() => Promise.resolve(mockTransactions)),
  fetchDefaultBudgets: vi.fn(() => Promise.resolve([])),
  fetchMonthBudgetOverrides: vi.fn(() => Promise.resolve([])),
  deleteTransaction: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/services/recurring-incomes', () => ({
  fetchRecurringIncomes: vi.fn(() => Promise.resolve([])),
  fetchRecurringIncomeOverrides: vi.fn(() => Promise.resolve([])),
  processAutoRecurringIncomes: vi.fn(() => Promise.resolve()),
}))

describe('Home Page - Card Orçamento em 3 Baldes (50/30/20)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFamily = {
      id: 'fam-1',
      name: 'Silva',
      monthly_net_income_cents: 600000,
    }
  })

  it('renderiza o título "Orçamento em 3 Baldes" e remove o antigo "Orçamento do Mês"', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByText('Orçamento em 3 Baldes')).toBeDefined()
    expect(screen.getByText('Modelo 50 / 30 / 20')).toBeDefined()
    expect(screen.queryByText('Orçamento do Mês')).toBeNull()
  })

  it('exibe os 3 baldes com seus rótulos, percentuais e valores calculados a partir da renda', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    // Necessidades (50% de 6.000 = 3.000)
    expect(screen.getByText('Necessidades')).toBeDefined()
    expect(screen.getByText('(50%)')).toBeDefined()
    expect(screen.getByText(/1\.500,00/)).toBeDefined()
    expect(screen.getByText(/\/ R\$\s*3\.000,00/)).toBeDefined()

    // Estilo de Vida (30% de 6.000 = 1.800)
    expect(screen.getByText('Estilo de Vida')).toBeDefined()
    expect(screen.getByText('(30%)')).toBeDefined()
    expect(screen.getByText(/600,00/)).toBeDefined()
    expect(screen.getByText(/\/ R\$\s*1\.800,00/)).toBeDefined()

    // Futuro & Metas (20% de 6.000 = 1.200)
    expect(screen.getByText('Futuro & Metas')).toBeDefined()
    expect(screen.getByText('(20%)')).toBeDefined()
    expect(screen.getByText(/400,00/)).toBeDefined()
    expect(screen.getByText(/\/ R\$\s*1\.200,00/)).toBeDefined()
  })

  it('exibe o destaque "Disponível em Estilo de Vida" com o saldo restante (1.800 - 600 = 1.200)', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Disponível em Estilo de Vida/i)).toBeDefined()
    // Valor restante R$ 1.200,00
    expect(screen.getByText(/1\.200,00/)).toBeDefined()
  })

  it('navega para /carteira ao clicar em "Ver detalhes na Carteira →"', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const linkBtn = screen.getByRole('button', { name: /Ver detalhes na Carteira →/i })
    fireEvent.click(linkBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/carteira')
  })

  it('degrada com elegância quando a família não tem renda configurada (monthly_net_income_cents = null)', () => {
    mockFamily = {
      id: 'fam-1',
      name: 'Silva',
      monthly_net_income_cents: null,
    }

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByText('Orçamento em 3 Baldes')).toBeDefined()
    expect(
      screen.getByText('Defina a renda na Carteira para calcular o saldo livre.'),
    ).toBeDefined()
    // Mostra tetos como 0,00 sem travar ou quebrar
    expect(screen.getAllByText(/\/ R\$\s*0,00/).length).toBe(3)
  })
})
