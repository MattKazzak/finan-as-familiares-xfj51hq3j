import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { NewTransactionDialog } from '../NewTransactionDialog'

const mockFamily = {
  id: 'fam-1',
  name: 'Silva',
  monthly_net_income_cents: 800000,
}

const mockMembers = [
  { id: 'm-1', name: 'Lucas', is_admin: true, user_id: 'user-1' },
  { id: 'm-2', name: 'Ana', is_admin: false, user_id: 'user-2' },
]

const mockCategories = [
  {
    id: 'cat-salario',
    name: 'Salário',
    type: 'income',
    budget_bucket: 'essentials',
    subcategories: [],
  },
  {
    id: 'cat-alimentacao',
    name: 'Alimentação',
    type: 'expense',
    budget_bucket: 'essentials',
    subcategories: [],
  },
]

let mockContextPrefill: any = null
let mockActiveMemberId: string | null = 'm-1'
let currentMembers = [...mockMembers]

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: mockFamily,
    members: currentMembers,
    categories: mockCategories,
    activeMemberId: mockActiveMemberId,
    newTransactionDefaultType: 'income',
    newTransactionPrefill: mockContextPrefill,
    triggerRefresh: vi.fn(),
    openImportStatement: vi.fn(),
    voiceTransactionData: null,
    setVoiceTransactionData: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@curiangoo.com' },
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

vi.mock('@/services/categorization-rules', () => ({
  fetchCategorizationRules: vi.fn().mockResolvedValue([
    {
      id: 'rule-1',
      family_id: 'fam-1',
      pattern: 'SUPERMERCADO',
      category_id: 'cat-alimentacao',
    },
  ]),
  upsertCategorizationRule: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/services/transactions', () => ({
  createTransaction: vi.fn().mockResolvedValue({ id: 'tx-1' }),
  createTransactionsBatch: vi.fn().mockResolvedValue([]),
  updateTransaction: vi.fn().mockResolvedValue({ id: 'tx-1' }),
}))

vi.mock('@/services/recurring-incomes', () => ({
  createRecurringIncome: vi.fn().mockResolvedValue({ id: 'rec-1' }),
  updateRecurringIncome: vi.fn().mockResolvedValue({ id: 'rec-1' }),
}))

describe('NewTransactionDialog - Modal Unificado de Nova Transação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockContextPrefill = null
    mockActiveMemberId = 'm-1'
    currentMembers = [...mockMembers]
  })

  it('abre como modal unificado com toggle Receita selecionado por padrão (R67) e campos vazios', () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText('Nova Transação')).toBeDefined()
    const amountInput = screen.getByPlaceholderText('0,00') as HTMLInputElement
    expect(amountInput.value).toBe('')

    // Toggle com ordem visual preservada: Receita à esquerda (1º), Despesa à direita (2º)
    const toggleButtons = screen.getByTestId('transaction-type-toggle').querySelectorAll('button')
    expect(toggleButtons).toHaveLength(2)
    expect(toggleButtons[0].textContent).toContain('Receita')
    expect(toggleButtons[1].textContent).toContain('Despesa')

    // Toggle Receita ativo por padrão (R67) seguindo newTransactionDefaultType: 'income'
    const incomeBtn = screen.getByRole('button', { name: /Receita/i })
    expect(incomeBtn.className).toContain('bg-finance-income')

    // Toggle Despesa inativo por padrão
    const expenseBtn = screen.getByRole('button', { name: /Despesa/i })
    expect(expenseBtn.className).not.toContain('bg-finance-expense')

    // Toggle "Repetir todo mês" existe na tela
    expect(screen.getByText(/Repetir todo mês/i)).toBeDefined()

    // Link para gerenciar contas fixas está presente
    expect(screen.getByText(/Gerenciar contas fixas/i)).toBeDefined()
  })

  it('permite carregar uma regra recorrente para edição através de editingRecurringRule', () => {
    const mockRule = {
      id: 'rec-1',
      family_id: 'fam-1',
      member_id: 'm-2',
      category_id: 'cat-alimentacao',
      subcategory_id: null,
      name: 'Supermercado Mensal',
      type: 'expense' as const,
      amount_cents: 125000,
      day_of_month: 10,
      active: true,
      created_at: '2025-01-01',
    }

    render(
      <NewTransactionDialog open={true} onOpenChange={vi.fn()} editingRecurringRule={mockRule} />,
    )

    expect(screen.getByText('Editar Regra Recorrente')).toBeDefined()
    const descInput = screen.getByPlaceholderText(/Ex:/i) as HTMLInputElement
    expect(descInput.value).toBe('Supermercado Mensal')

    const amountInput = screen.getByPlaceholderText('0,00') as HTMLInputElement
    expect(amountInput.value).toBe('1.250,00')

    expect(screen.getByText(/Regra Recorrente:/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /Salvar Regra Fixa/i })).toBeDefined()
  })

  it('permite alternar entre Receita e Despesa pelo toggle segmentado', () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />)

    // Inicia em Receita (R67)
    const incomeBtn = screen.getByRole('button', { name: /Receita/i })
    expect(incomeBtn.className).toContain('bg-finance-income')

    // Alterna para Despesa
    const expenseBtn = screen.getByRole('button', { name: /Despesa/i })
    fireEvent.click(expenseBtn)
    expect(expenseBtn.className).toContain('bg-finance-expense')
    expect(incomeBtn.className).not.toContain('bg-finance-income')

    // Alterna de volta para Receita
    fireEvent.click(incomeBtn)
    expect(incomeBtn.className).toContain('bg-finance-income')
    expect(expenseBtn.className).not.toContain('bg-finance-expense')
  })

  it('popula formulário diretamente via props initialType, initialAmountCents, initialDescription e initialCategoryId', () => {
    render(
      <NewTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        initialType="income"
        initialAmountCents={800000}
        initialDescription="Salário mensal"
        initialCategoryId="cat-salario"
        initialMemberId="m-2"
      />,
    )

    const amountInput = screen.getByPlaceholderText('0,00') as HTMLInputElement
    expect(amountInput.value).toBe('8.000,00')

    const descInput = screen.getByPlaceholderText(/Ex:/i) as HTMLInputElement
    expect(descInput.value).toBe('Salário mensal')

    const incomeBtn = screen.getByRole('button', { name: /Receita/i })
    expect(incomeBtn.className).toContain('bg-finance-income')
  })

  it('popula formulário a partir de newTransactionPrefill do contexto', () => {
    mockContextPrefill = {
      initialType: 'income',
      initialAmountCents: 500000,
      initialDescription: 'Freelance',
      initialCategoryId: 'cat-salario',
      initialMemberId: 'm-1',
    }

    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />)

    const amountInput = screen.getByPlaceholderText('0,00') as HTMLInputElement
    expect(amountInput.value).toBe('5.000,00')

    const descInput = screen.getByPlaceholderText(/Ex:/i) as HTMLInputElement
    expect(descInput.value).toBe('Freelance')
  })

  it('ativa seletor de dia do mês quando toggle "Repetir todo mês" é ligado', async () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />)

    // Inicialmente não mostra "Dia do mês"
    expect(screen.queryByText('Dia do mês')).toBeNull()

    // Clica no switch de repetir todo mês
    const repeatSwitch = screen.getByRole('switch')
    fireEvent.click(repeatSwitch)

    // Agora revela o seletor de dia do mês e a mensagem explicativa
    await waitFor(() => {
      expect(screen.getByText('Dia do mês')).toBeDefined()
      expect(screen.getByText(/Contas & Rendas Recorrentes/i)).toBeDefined()
    })
  })

  it('(a) esconde completamente o bloco "Quem pagou / recebeu?" quando a família tem apenas 1 membro', () => {
    currentMembers = [mockMembers[0]] // Apenas Lucas (admin)
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />)

    // O bloco de membro não deve estar no DOM
    expect(screen.queryByTestId('transaction-member-block')).toBeNull()
    expect(screen.queryByText(/Quem pagou:/i)).toBeNull()
    expect(screen.queryByText(/Quem recebeu:/i)).toBeNull()
  })

  it('(b) família com 2+ membros mostra linha discreta e expande ao toque, recolhendo na seleção', () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />)

    // Bloco presente com a linha discreta
    const memberBlock = screen.getByTestId('transaction-member-block')
    expect(memberBlock).toBeDefined()
    expect(screen.getByText(/Quem pagou:/i)).toBeDefined()

    // Inicialmente recolhido (sem container de chips expandidos)
    expect(screen.queryByTestId('member-chips-container')).toBeNull()
    const summaryTrigger = screen.getByTestId('member-summary-trigger')
    expect(summaryTrigger.textContent).toContain('Lucas')
    expect(summaryTrigger.textContent).toContain('(Você)')

    // Clica para expandir
    fireEvent.click(summaryTrigger)
    expect(screen.getByTestId('member-chips-container')).toBeDefined()

    // Mostra chips de Lucas e Ana
    const anaBtn = screen.getByRole('button', { name: /Ana/i })
    expect(anaBtn).toBeDefined()

    // Seleciona Ana -> deve recolher o bloco e atualizar a linha
    fireEvent.click(anaBtn)
    expect(screen.queryByTestId('member-chips-container')).toBeNull()
    expect(screen.getByTestId('member-summary-trigger').textContent).toContain('Ana')
  })

  it('(c) linha de categoria recolhida mostra a categoria selecionada na edição e na criação, e edição preserva o tipo da transação (despesa ou receita)', () => {
    const mockEditingExpenseTx = {
      id: 'tx-existing-expense',
      family_id: 'fam-1',
      member_id: 'm-2',
      category_id: 'cat-alimentacao',
      subcategory_id: null,
      type: 'expense' as const,
      amount_cents: 4500,
      description: 'Padaria da esquina',
      transaction_date: '2025-05-10',
      payment_method: 'pix',
      is_recurring: false,
      status: 'confirmed',
      created_at: '2025-05-10T10:00:00Z',
    } as any

    const { unmount } = render(
      <NewTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        editingTransaction={mockEditingExpenseTx}
      />,
    )

    // O trigger da categoria mostra Alimentação
    const categoryTrigger = screen.getByTestId('category-summary-trigger')
    expect(categoryTrigger.textContent).toContain('Alimentação')

    // O trigger do membro mostra Ana (m-2 da transação)
    const memberTrigger = screen.getByTestId('member-summary-trigger')
    expect(memberTrigger.textContent).toContain('Ana')

    // Tipo na edição é mantido como Despesa (não é forçado para Receita)
    const expenseBtn = screen.getByRole('button', { name: /Despesa/i })
    expect(expenseBtn.className).toContain('bg-finance-expense')

    unmount()

    // Testar edição de transação do tipo Receita
    const mockEditingIncomeTx = {
      id: 'tx-existing-income',
      family_id: 'fam-1',
      member_id: 'm-1',
      category_id: 'cat-salario',
      subcategory_id: null,
      type: 'income' as const,
      amount_cents: 800000,
      description: 'Salário Trabalho',
      transaction_date: '2025-05-05',
      payment_method: 'pix',
      is_recurring: false,
      status: 'confirmed',
      created_at: '2025-05-05T10:00:00Z',
    } as any

    render(
      <NewTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        editingTransaction={mockEditingIncomeTx}
      />,
    )

    const incomeBtn = screen.getByRole('button', { name: /Receita/i })
    expect(incomeBtn.className).toContain('bg-finance-income')
  })

  it('(d) "Sem categoria" acessível no bloco expandido e recolhe após clique', () => {
    render(
      <NewTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        initialCategoryId="cat-alimentacao"
      />,
    )

    const categoryTrigger = screen.getByTestId('category-summary-trigger')
    expect(categoryTrigger.textContent).toContain('Alimentação')

    // Inicialmente recolhido
    expect(screen.queryByTestId('category-expanded-grid')).toBeNull()

    // Expande
    fireEvent.click(categoryTrigger)
    const expandedGrid = screen.getByTestId('category-expanded-grid')
    expect(expandedGrid).toBeDefined()

    // Clica em "Sem categoria"
    const uncategorizedBtn = screen.getByRole('button', { name: /Sem categoria/i })
    fireEvent.click(uncategorizedBtn)

    // Recolhe de volta
    expect(screen.queryByTestId('category-expanded-grid')).toBeNull()
    expect(screen.getByTestId('category-summary-trigger').textContent).toContain('Sem categoria')
  })
})
