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

describe('Home Page - Card Orçamento em 3 Baldes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFamily = {
      id: 'fam-1',
      name: 'Silva',
      monthly_net_income_cents: 600000,
      budget_model: '50_30_20',
    }
    // Mock padrão de orçamentos (50% = 3.000, 30% = 1.800, 20% = 1.200)
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

  it('renderiza o título "Orçamento em 3 Baldes" e remove o antigo "Orçamento do Mês"', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Orçamento em 3 Baldes')).toBeDefined()
    })
    expect(screen.getByText(/50 \/ 30 \/ 20/)).toBeDefined()
    expect(screen.queryByText('Orçamento do Mês')).toBeNull()
  })

  it('exibe os 3 baldes simplificados com seus rótulos, percentuais e valores restantes calculados a partir dos tetos reais', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Necessidades')).toBeDefined()
    })

    // Necessidades (3.000 / 6.000 = 50%, gasto 1.500 -> resta 1.500)
    expect(screen.getByText('(50%)')).toBeDefined()
    expect(screen.getByText(/resta R\$\s*1\.500,00/i)).toBeDefined()

    // Estilo de Vida (1.800 / 6.000 = 30%, gasto 600 -> resta 1.200)
    expect(screen.getByText('Estilo de Vida')).toBeDefined()
    expect(screen.getByText('(30%)')).toBeDefined()
    expect(screen.getByText(/resta R\$\s*1\.200,00/i)).toBeDefined()

    // Futuro & Metas (1.200 / 6.000 = 20%, gasto 400 -> resta 800)
    expect(screen.getByText('Futuro & Metas')).toBeDefined()
    expect(screen.getByText('(20%)')).toBeDefined()
    expect(screen.getByText(/resta R\$\s*800,00/i)).toBeDefined()
  })

  it('exibe percentuais dinâmicos e rótulo do modelo personalizado (ex: 60/25/15) a partir dos tetos reais', async () => {
    mockFamily = {
      id: 'fam-1',
      name: 'Silva',
      monthly_net_income_cents: 1000000, // R$ 10.000,00
      budget_model: '60_25_15',
    }

    // Tetos reais: 60% (6.000), 25% (2.500), 15% (1.500)
    vi.mocked(transactionsService.fetchDefaultBudgets).mockResolvedValue([
      {
        id: 'bg-1',
        family_id: 'fam-1',
        category_id: 'cat-1',
        subcategory_id: null,
        amount_cents: 600000,
        created_at: new Date().toISOString(),
      },
      {
        id: 'bg-2',
        family_id: 'fam-1',
        category_id: 'cat-2',
        subcategory_id: null,
        amount_cents: 250000,
        created_at: new Date().toISOString(),
      },
      {
        id: 'bg-3',
        family_id: 'fam-1',
        category_id: 'cat-3',
        subcategory_id: null,
        amount_cents: 150000,
        created_at: new Date().toISOString(),
      },
    ])

    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Modelo 60 / 25 / 15')).toBeDefined()
    })

    // Percentuais dinâmicos derivados dos tetos reais sobre os R$ 10.000 de renda
    expect(screen.getByText('(60%)')).toBeDefined()
    expect(screen.getByText('(25%)')).toBeDefined()
    expect(screen.getByText('(15%)')).toBeDefined()
  })

  it('respeita overrides pontuais do mês corrente nos tetos dos baldes', async () => {
    mockFamily = {
      id: 'fam-1',
      name: 'Silva',
      monthly_net_income_cents: 1000000, // R$ 10.000
      budget_model: '50_30_20',
    }

    // Default: cat-1 = 4.000 (40%)
    vi.mocked(transactionsService.fetchDefaultBudgets).mockResolvedValue([
      {
        id: 'bg-1',
        family_id: 'fam-1',
        category_id: 'cat-1',
        subcategory_id: null,
        amount_cents: 400000,
        created_at: new Date().toISOString(),
      },
    ])
    // Override deste mês: cat-1 subiu para 5.500 (55%)
    const currentMonth = currentMonthTest
    vi.mocked(transactionsService.fetchMonthBudgetOverrides).mockResolvedValue([
      {
        id: 'ov-1',
        family_id: 'fam-1',
        category_id: 'cat-1',
        subcategory_id: null,
        month: currentMonth,
        amount_cents: 550000,
        created_at: new Date().toISOString(),
      },
    ])

    renderWithProviders(<Home />)

    await waitFor(() => {
      // 5.500 / 10.000 = 55%
      expect(screen.getByText('(55%)')).toBeDefined()
    })
  })

  it('exibe o mês de referência no cabeçalho e não exibe o número herói safe-to-spend', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Orçamento em 3 Baldes')).toBeDefined()
    })

    // O cabeçalho deve exibir o modelo e o mês de referência formatado
    expect(screen.getByText(/50 \/ 30 \/ 20/)).toBeDefined()
    // O herói "Livre para gastar este mês" foi completamente removido
    expect(screen.queryByText(/Livre para gastar este mês/i)).toBeNull()
    expect(screen.queryByText(/Atenção/i)).toBeNull()
    expect(screen.queryByText(/Estourado/i)).toBeNull()
    // Não exibe o badge de renda no cabeçalho do card
    expect(screen.queryByText(/6\.000,00\/mês/)).toBeNull()
  })

  it('navega para /orcamentos ao clicar em "Ver detalhes na Carteira →"', () => {
    renderWithProviders(<Home />)

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

    renderWithProviders(<Home />)

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

      renderWithProviders(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Receitas')).toBeDefined()
      })

      // Abrir progressive disclosure do card de saldo
      const balanceCard = screen.getByRole('region', { name: /card de saldo da família/i })
      fireEvent.click(balanceCard)

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
      const currentMonth = currentMonthTest
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

      renderWithProviders(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Receitas')).toBeDefined()
      })

      // Abrir progressive disclosure
      const balanceCard = screen.getByRole('region', { name: /card de saldo da família/i })
      fireEvent.click(balanceCard)

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
      const currentMonth = currentMonthTest
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

      renderWithProviders(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Receitas')).toBeDefined()
      })

      // Abrir progressive disclosure
      const balanceCard = screen.getByRole('region', { name: /card de saldo da família/i })
      fireEvent.click(balanceCard)

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
      const currentMonth = currentMonthTest
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

      renderWithProviders(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Receitas')).toBeDefined()
      })

      // Abrir progressive disclosure
      const balanceCard = screen.getByRole('region', { name: /card de saldo da família/i })
      fireEvent.click(balanceCard)

      expect(screen.getByText('R$ 2.500,00')).toBeDefined()
      expect(screen.queryByText(/Previsto:/)).toBeNull()
      expect(screen.queryByText('Aguardando entradas do mês')).toBeNull()
      expect(screen.queryByText('[Registrar salário]')).toBeNull()
    })

    it('desconsidera transações projetadas no saldo total, nas receitas/despesas do mês e nos baldes', async () => {
      mockFamily = {
        id: 'fam-1',
        name: 'Silva',
        monthly_net_income_cents: 600000,
        budget_model: '50_30_20',
      }
      const currentMonth = currentMonthTest

      // Despesa confirmada R$ 100, receita confirmada R$ 1.000
      // Despesa projetada R$ 900 (não deve entrar no saldo nem nas despesas do mês)
      // Receita projetada R$ 5.000 (não deve entrar no saldo nem nas receitas do mês)
      vi.mocked(transactionsService.fetchTransactions).mockResolvedValue([
        {
          id: 'tx-conf-inc',
          family_id: 'fam-1',
          member_id: 'm-1',
          category_id: 'cat-salario',
          amount_cents: 100000,
          type: 'income',
          status: 'confirmed',
          description: 'Salário Efetivado',
          transaction_date: `${currentMonth}-01`,
          created_at: `${currentMonth}-01T10:00:00Z`,
        },
        {
          id: 'tx-conf-exp',
          family_id: 'fam-1',
          member_id: 'm-1',
          category_id: 'cat-1',
          amount_cents: 10000,
          type: 'expense',
          status: 'confirmed',
          description: 'Conta de Luz',
          transaction_date: `${currentMonth}-02`,
          created_at: `${currentMonth}-02T10:00:00Z`,
        },
        {
          id: 'tx-proj-exp',
          family_id: 'fam-1',
          member_id: 'm-1',
          category_id: 'cat-2',
          amount_cents: 90000,
          type: 'expense',
          status: 'projected',
          description: 'TV Parcelada 2/10',
          transaction_date: `${currentMonth}-15`,
          created_at: `${currentMonth}-15T10:00:00Z`,
        },
        {
          id: 'tx-proj-inc',
          family_id: 'fam-1',
          member_id: 'm-1',
          category_id: 'cat-salario',
          amount_cents: 500000,
          type: 'income',
          status: 'projected',
          description: 'Receita futura projetada',
          transaction_date: `${currentMonth}-25`,
          created_at: `${currentMonth}-25T10:00:00Z`,
        },
      ])

      renderWithProviders(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Receitas')).toBeDefined()
      })

      // Receitas do mês: apenas R$ 1.000,00 (não R$ 6.000,00)
      expect(screen.getByText('R$ 1.000,00')).toBeDefined()

      // Despesas do mês: apenas R$ 100,00 (não R$ 1.000,00)
      expect(screen.getByText('R$ 100,00')).toBeDefined()

      // Saldo total: R$ 900,00 (R$ 1.000 - R$ 100)
      expect(screen.getByText('R$ 900,00')).toBeDefined()
    })

    it('garante que o card de saldo não possui chamada duplicada ao Copilot e o saldo é o herói com progressive disclosure', async () => {
      renderWithProviders(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Receitas')).toBeDefined()
      })
      // O botão do Copilot foi removido de dentro do card de saldo na R52 (fica apenas o FAB flutuante no Layout)
      const copilotInsideCard = screen.queryByRole('button', { name: /falar com o curiangoo/i })
      expect(copilotInsideCard).toBeNull()

      // O saldo é o herói e receitas e despesas aparecem em linha limpa
      expect(screen.getByText('Saldo Total da Família')).toBeDefined()
      expect(screen.getByText('Despesas')).toBeDefined()

      // Ao clicar no card de saldo, ativa progressive disclosure
      const balanceCard = screen.getByRole('region', { name: /card de saldo da família/i })
      fireEvent.click(balanceCard)

      // Detalhes aparecem sob demanda
      expect(screen.getByText(/Receitas do Mês:/i)).toBeDefined()
    })

    it('não possui truncate nos elementos principais da Home (baldes 50/30/20, chips de membros, transações)', async () => {
      mockFamily = {
        id: 'fam-1',
        name: 'Silva',
        monthly_net_income_cents: 600000,
      }
      const currentMonth = currentMonthTest
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

      const { container } = renderWithProviders(<Home />)

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

    it('renderiza o novo Header moderno fintech com saudação por horário, subtítulo Curiangoo Família e botões de privacidade e notificações', async () => {
      renderWithProviders(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Receitas')).toBeDefined()
      })
      expect(screen.getByText('Curiangoo Família')).toBeDefined()
      expect(screen.getByRole('button', { name: /mostrar valores|ocultar valores/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /notificações/i })).toBeDefined()
      expect(
        screen.getByRole('button', { name: /trocar membro ativo ou abrir perfil/i }),
      ).toBeDefined()
    })

    it('botão de privacidade oculta o saldo e os valores monetários com máscara ao ser clicado', async () => {
      renderWithProviders(<Home />)

      await waitFor(() => {
        expect(screen.getByText('Receitas')).toBeDefined()
      })
      const privacyBtn = screen.getByRole('button', { name: /ocultar valores/i })
      expect(privacyBtn).toBeDefined()

      // Ao clicar, entra em modo privacidade
      fireEvent.click(privacyBtn)

      // Saldo mascarado
      expect(screen.getByText('R$ ••••••')).toBeDefined()

      // Clicar novamente restaura
      const showBtn = screen.getByRole('button', { name: /mostrar valores/i })
      fireEvent.click(showBtn)
      await waitFor(() => {
        expect(screen.queryByText('R$ ••••••')).toBeNull()
      })
    })
  })
})
