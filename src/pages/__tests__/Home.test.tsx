import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ActiveMonthProvider } from '@/contexts/ActiveMonthContext'
import Home from '../Home'
import * as transactionsService from '@/services/transactions'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ActiveMonthProvider>{ui}</ActiveMonthProvider>
    </MemoryRouter>,
  )
}

const mockOpenNewTransaction = vi.fn()

let mockFamily: any = {
  id: 'fam-1',
  name: 'Silva',
  monthly_net_income_cents: 600000, // R$ 6.000,00 -> 50% = R$ 3.000, 30% = R$ 1.800, 20% = R$ 1.200
}

let mockCategories: any[] = [
  { id: 'cat-1', name: 'Moradia', type: 'expense', budget_bucket: 'essentials' },
  { id: 'cat-2', name: 'Lazer', type: 'expense', budget_bucket: 'lifestyle' },
  { id: 'cat-3', name: 'Reserva', type: 'expense', budget_bucket: 'future' },
  { id: 'cat-salario', name: 'Salário', type: 'income', budget_bucket: 'essentials' },
]

const nowTest = new Date()
const currentMonthTest = `${nowTest.getFullYear()}-${String(nowTest.getMonth() + 1).padStart(2, '0')}`
const todayStr = `${currentMonthTest}-10`

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
    openNewTransaction: mockOpenNewTransaction,
    openVoiceDialog: vi.fn(),
    openOnboarding: vi.fn(),
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

describe('Home Page - R58 Nova Home Completa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFamily = {
      id: 'fam-1',
      name: 'Silva',
      monthly_net_income_cents: 600000,
      budget_model: '50_30_20',
    }
    vi.mocked(transactionsService.fetchDefaultBudgets).mockResolvedValue([
      {
        id: 'bg-1',
        family_id: 'fam-1',
        category_id: 'cat-1',
        subcategory_id: null,
        amount_cents: 300000,
        created_at: new Date().toISOString(),
      },
      {
        id: 'bg-2',
        family_id: 'fam-1',
        category_id: 'cat-2',
        subcategory_id: null,
        amount_cents: 180000,
        created_at: new Date().toISOString(),
      },
      {
        id: 'bg-3',
        family_id: 'fam-1',
        category_id: 'cat-3',
        subcategory_id: null,
        amount_cents: 120000,
        created_at: new Date().toISOString(),
      },
    ])
    vi.mocked(transactionsService.fetchMonthBudgetOverrides).mockResolvedValue([])
    vi.mocked(transactionsService.fetchTransactions).mockResolvedValue(mockTransactions)
  })

  it('T1: o herói mora no fundo sangrado marinho (#14213D) e o primeiro card claro sobrepõe o marinho', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Saldo Total da Família')).toBeDefined()
    })

    const bleedingHero = screen.getByTestId('hero-bleeding-top')
    expect(bleedingHero).toBeDefined()
    expect(bleedingHero.className).toContain('bg-ink')

    // Saudação, seletor de mês e saldo moram dentro do fundo sangrado marinho
    const greetingRow = screen.getByTestId('header-greeting-row')
    const monthRow = screen.getByTestId('header-month-row')
    const balanceRegion = screen.getByRole('region', { name: /card de saldo da família/i })

    expect(bleedingHero.contains(greetingRow)).toBe(true)
    expect(bleedingHero.contains(monthRow)).toBe(true)
    expect(bleedingHero.contains(balanceRegion)).toBe(true)

    // Atalhos rápidos no fundo marinho
    expect(screen.getByText('Nova despesa')).toBeDefined()
    expect(screen.getByText('Nova receita')).toBeDefined()
    expect(screen.getByText('Extrato')).toBeDefined()

    // Primeiro card claro flutuante sobrepõe o bloco escuro (-mt-6 / -mt-8 e rounded-3xl)
    const firstFloatingCard = screen.getByTestId('first-floating-card')
    expect(firstFloatingCard).toBeDefined()
    expect(firstFloatingCard.className).toContain('rounded-3xl')
    expect(firstFloatingCard.closest('.relative')?.className).toContain('-mt-6')
  })

  it('T2: anel do previsto renderiza percentual correto com cap em 100% e superação informativa', async () => {
    mockFamily = {
      id: 'fam-1',
      name: 'Silva',
      monthly_net_income_cents: 600000, // R$ 6.000,00 previstos
    }
    const currentMonth = currentMonthTest
    vi.mocked(transactionsService.fetchTransactions).mockResolvedValue([
      {
        id: 'tx-inc-super',
        family_id: 'fam-1',
        member_id: 'm-1',
        category_id: 'cat-salario',
        amount_cents: 900000, // R$ 9.000,00 realizado (150%)
        type: 'income',
        status: 'confirmed',
        description: 'Salário + Bônus',
        transaction_date: `${currentMonth}-05`,
        created_at: `${currentMonth}-05T12:00:00Z`,
      },
    ])

    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Receitas Previstas do Mês')).toBeDefined()
    })

    // Anel SVG com progressbar
    const donutRing = screen.getByRole('progressbar', {
      name: /anel de progresso da renda recebida/i,
    })
    expect(donutRing).toBeDefined()
    // Cap visual em 100%
    expect(donutRing.getAttribute('aria-valuenow')).toBe('100')
    // Texto informativo exibe 150% e badge "acima do previsto"
    expect(screen.getByText('150%')).toBeDefined()
    expect(screen.getByText('acima do previsto')).toBeDefined()
  })

  it('T3: mini-gráfico de barras por categoria renderiza top categorias do mês ativo e possui estado vazio', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Gastos por Categoria')).toBeDefined()
    })

    // Categoria Moradia com R$ 1.500 (maior gasto)
    expect(screen.getByText('Moradia')).toBeDefined()
    expect(screen.getByText('Lazer')).toBeDefined()
    expect(screen.getByText('Reserva')).toBeDefined()

    const progressBarMoradia = screen.getByRole('progressbar', {
      name: /gastos na categoria moradia/i,
    })
    expect(progressBarMoradia).toBeDefined()
    // Moradia é o valor máximo, então sua barra preenche 100%
    expect(progressBarMoradia.getAttribute('aria-valuenow')).toBe('100')
  })

  it('T3 (b): gráfico de barras exibe estado vazio amigável quando não houver despesas no mês', async () => {
    vi.mocked(transactionsService.fetchTransactions).mockResolvedValue([])

    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Gastos por Categoria')).toBeDefined()
    })

    expect(screen.getByText('Nenhum gasto registrado neste mês')).toBeDefined()
  })

  it('T4 (b): blocos Receitas/Despesas do herói navegam ao Extrato com o filtro correspondente', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Saldo Total da Família')).toBeDefined()
    })

    // Blocos viraram botões navegáveis (sem botão "+" dentro — criação é do FAB)
    const receitas = screen.getByTestId('summary-receitas')
    const despesas = screen.getByTestId('summary-despesas')
    expect(receitas.tagName).toBe('BUTTON')
    expect(despesas.tagName).toBe('BUTTON')

    // "Receitas" → /carteira com filtro de entradas
    fireEvent.click(receitas)
    expect(mockNavigate).toHaveBeenCalledWith('/carteira', {
      state: { filterType: 'income' },
    })

    // "Despesas" → /carteira com filtro de saídas
    fireEvent.click(despesas)
    expect(mockNavigate).toHaveBeenCalledWith('/carteira', {
      state: { filterType: 'expense' },
    })
  })

  it('T4: orçamento em 3 baldes mantém cálculos com tetos reais e links', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Orçamento em 3 Baldes')).toBeDefined()
    })

    expect(screen.getByText('Necessidades')).toBeDefined()
    expect(screen.getByText('(50%)')).toBeDefined()
    expect(screen.getByText(/resta R\$\s*1\.500,00/i)).toBeDefined()
  })

  it('T5: proteção contra overflow horizontal em mobile 360px', async () => {
    const { container } = renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Saldo Total da Família')).toBeDefined()
    })

    const rootDiv = container.firstElementChild as HTMLElement
    expect(rootDiv.className).toContain('overflow-x-hidden')
    expect(rootDiv.className).toContain('min-w-0')
  })
})
