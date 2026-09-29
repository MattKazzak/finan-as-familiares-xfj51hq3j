import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
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
    openNewTransaction: mockOpenNewTransaction,
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

  it('exibe os 3 baldes simplificados com seus rótulos, percentuais e valores restantes calculados', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    // Necessidades (50% de 6.000 = 3.000, gasto 1.500 -> resta 1.500)
    expect(screen.getByText('Necessidades')).toBeDefined()
    expect(screen.getByText('(50%)')).toBeDefined()
    expect(screen.getByText(/resta R\$\s*1\.500,00/i)).toBeDefined()

    // Estilo de Vida (30% de 6.000 = 1.800, gasto 600 -> resta 1.200)
    expect(screen.getByText('Estilo de Vida')).toBeDefined()
    expect(screen.getByText('(30%)')).toBeDefined()
    expect(screen.getByText(/resta R\$\s*1\.200,00/i)).toBeDefined()

    // Futuro & Metas (20% de 6.000 = 1.200, gasto 400 -> resta 800)
    expect(screen.getByText('Futuro & Metas')).toBeDefined()
    expect(screen.getByText('(20%)')).toBeDefined()
    expect(screen.getByText(/resta R\$\s*800,00/i)).toBeDefined()
  })

  it('exibe o mês de referência no cabeçalho e não exibe o número herói safe-to-spend', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    // O cabeçalho deve exibir o modelo e o mês de referência formatado
    expect(screen.getByText('Modelo 50 / 30 / 20')).toBeDefined()
    // O herói "Livre para gastar este mês" foi completamente removido
    expect(screen.queryByText(/Livre para gastar este mês/i)).toBeNull()
    expect(screen.queryByText(/Atenção/i)).toBeNull()
    expect(screen.queryByText(/Estourado/i)).toBeNull()
    // Não exibe o badge de renda no cabeçalho do card
    expect(screen.queryByText(/6\.000,00\/mês/)).toBeNull()
  })

  it('navega para /orcamentos ao clicar em "Ver detalhes na Carteira →"', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const linkBtn = screen.getByRole('button', { name: /Ver detalhes na Carteira →/i })
    fireEvent.click(linkBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/orcamentos')
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
    // Herói removido: não há mensagem "Defina a renda na Carteira para calcular o saldo livre."
    expect(screen.queryByText('Defina a renda na Carteira para calcular o saldo livre.')).toBeNull()
    // Baldes mostram os gastos sem travar
    expect(screen.getByText('Necessidades')).toBeDefined()
    expect(screen.getByText('Estilo de Vida')).toBeDefined()
    expect(screen.getByText('Futuro & Metas')).toBeDefined()
  })

  describe('Rótulo Visual Inteligente de Receitas', () => {
    it('caso (a): monthIncomeCents === 0 e plannedIncomeCents > 0 exibe R$ 0,00, badge de previsto e micro-ação', async () => {
      mockFamily = {
        id: 'fam-1',
        name: 'Silva',
        monthly_net_income_cents: 800000, // R$ 8.000,00 previsto
      }
      // Nenhuma transação de receita no mês
      vi.mocked(transactionsService.fetchTransactions).mockResolvedValue([])

      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText('Receitas do Mês')).toBeDefined()
      })

      // Valor realizado zerado
      expect(screen.getByText('R$ 0,00')).toBeDefined()

      // Badge/texto sutil com o previsto
      expect(screen.getByText('(Previsto: R$ 8.000,00)')).toBeDefined()

      // Linha de apoio e micro-ação
      expect(screen.getByText('Aguardando entradas do mês')).toBeDefined()
      const salaryBtn = screen.getByRole('button', { name: '[Registrar salário]' })
      expect(salaryBtn).toBeDefined()

      // Clicar em "Registrar salário" chama openNewTransaction com preenchimento pré-configurado
      fireEvent.click(salaryBtn)
      expect(mockOpenNewTransaction).toHaveBeenCalledWith({
        initialType: 'income',
        initialCategoryId: 'cat-salario',
        initialAmountCents: 800000,
        initialDescription: 'Salário mensal',
      })
    })

    it('caso (b.1): monthIncomeCents > 0 e menor que plannedIncomeCents exibe meta discreta "de {previsto}"', async () => {
      mockFamily = {
        id: 'fam-1',
        name: 'Silva',
        monthly_net_income_cents: 600000, // R$ 6.000,00 previsto
      }
      const currentMonth = new Date().toISOString().slice(0, 7)
      vi.mocked(transactionsService.fetchTransactions).mockResolvedValue([
        {
          id: 'tx-inc-partial',
          family_id: 'fam-1',
          member_id: 'm-1',
          category_id: 'cat-salario',
          amount_cents: 300000, // R$ 3.000,00 realizado
          type: 'income',
          status: 'confirmed',
          description: 'Adiantamento',
          transaction_date: `${currentMonth}-05`,
          created_at: `${currentMonth}-05T12:00:00Z`,
        },
      ])

      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText('Receitas do Mês')).toBeDefined()
      })

      expect(screen.getByText('R$ 3.000,00')).toBeDefined()
      expect(screen.getByText('de R$ 6.000,00')).toBeDefined()
      expect(screen.queryByText('Aguardando entradas do mês')).toBeNull()
      expect(screen.queryByText('✓ Previsto atingido')).toBeNull()
    })

    it('caso (b.2): monthIncomeCents >= plannedIncomeCents exibe "✓ Previsto atingido"', async () => {
      mockFamily = {
        id: 'fam-1',
        name: 'Silva',
        monthly_net_income_cents: 600000, // R$ 6.000,00 previsto
      }
      const currentMonth = new Date().toISOString().slice(0, 7)
      vi.mocked(transactionsService.fetchTransactions).mockResolvedValue([
        {
          id: 'tx-inc-full',
          family_id: 'fam-1',
          member_id: 'm-1',
          category_id: 'cat-salario',
          amount_cents: 600000, // R$ 6.000,00 realizado
          type: 'income',
          status: 'confirmed',
          description: 'Salário integral',
          transaction_date: `${currentMonth}-05`,
          created_at: `${currentMonth}-05T12:00:00Z`,
        },
      ])

      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText('Receitas do Mês')).toBeDefined()
      })

      expect(screen.getByText('R$ 6.000,00')).toBeDefined()
      expect(screen.getByText('✓ Previsto atingido')).toBeDefined()
      expect(screen.queryByText(/de R\$/)).toBeNull()
      expect(screen.queryByText('Aguardando entradas do mês')).toBeNull()
    })

    it('caso (c): plannedIncomeCents === 0 mantém o comportamento atual (só valor realizado)', async () => {
      mockFamily = {
        id: 'fam-1',
        name: 'Silva',
        monthly_net_income_cents: 0, // Sem previsão definida
      }
      const currentMonth = new Date().toISOString().slice(0, 7)
      vi.mocked(transactionsService.fetchTransactions).mockResolvedValue([
        {
          id: 'tx-inc-only',
          family_id: 'fam-1',
          member_id: 'm-1',
          category_id: 'cat-salario',
          amount_cents: 250000,
          type: 'income',
          status: 'confirmed',
          description: 'Receita avulsa',
          transaction_date: `${currentMonth}-02`,
          created_at: `${currentMonth}-02T12:00:00Z`,
        },
      ])

      render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText('Receitas do Mês')).toBeDefined()
      })

      expect(screen.getByText('R$ 2.500,00')).toBeDefined()
      expect(screen.queryByText(/Previsto/)).toBeNull()
      expect(screen.queryByText('Aguardando entradas do mês')).toBeNull()
      expect(screen.queryByText('[Registrar salário]')).toBeNull()
    })

    it('não possui truncate nos elementos principais da Home (baldes 50/30/20, chips de membros, transações)', async () => {
      mockFamily = {
        id: 'fam-1',
        name: 'Silva',
        monthly_net_income_cents: 600000,
      }
      const currentMonth = new Date().toISOString().slice(0, 7)
      vi.mocked(transactionsService.fetchTransactions).mockResolvedValue([
        {
          id: 'tx-long-name',
          family_id: 'fam-1',
          member_id: 'm-1',
          category_id: 'cat-1',
          amount_cents: 50000,
          type: 'expense',
          status: 'confirmed',
          description: 'Supermercado e Feira de Orgânicos da Família',
          transaction_date: `${currentMonth}-08`,
          created_at: `${currentMonth}-08T10:00:00Z`,
        },
      ])

      const { container } = render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText('Orçamento em 3 Baldes')).toBeDefined()
      })

      // Linha de exemplos unificada presente
      expect(
        screen.getByText(
          'Necessidades: moradia e mercado · Estilo: lazer e refeições · Futuro: reserva e metas',
        ),
      ).toBeDefined()

      // O container principal da Home não deve ter elementos com a classe truncate
      const truncatedElements = container.querySelectorAll('.truncate')
      expect(truncatedElements.length).toBe(0)
    })
  })
})
