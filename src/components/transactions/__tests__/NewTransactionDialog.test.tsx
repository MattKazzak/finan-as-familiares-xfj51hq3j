import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { NewTransactionDialog } from '../NewTransactionDialog'

const mockFamily = {
  id: 'fam-1',
  name: 'Silva',
  monthly_net_income_cents: 800000,
}

const mockMembers = [
  { id: 'm-1', name: 'Lucas', is_admin: true },
  { id: 'm-2', name: 'Ana', is_admin: false },
]

const mockCategories = [
  { id: 'cat-salario', name: 'Salário', type: 'income', budget_bucket: 'essentials' },
  { id: 'cat-alimentacao', name: 'Alimentação', type: 'expense', budget_bucket: 'essentials' },
]

let mockContextPrefill: any = null

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: mockFamily,
    members: mockMembers,
    categories: mockCategories,
    newTransactionDefaultType: 'expense',
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

describe('NewTransactionDialog - suporte a prefill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockContextPrefill = null
  })

  it('abre vazio por padrão sem props de prefill', () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText('Nova Transação')).toBeDefined()
    const amountInput = screen.getByPlaceholderText('0,00') as HTMLInputElement
    expect(amountInput.value).toBe('')
    const descInput = screen.getByPlaceholderText(/Supermercado/i) as HTMLInputElement
    expect(descInput.value).toBe('')
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

    const descInput = screen.getByPlaceholderText(/Supermercado/i) as HTMLInputElement
    expect(descInput.value).toBe('Salário mensal')

    // Botão Receita selecionado (estilizado com bg-emerald-600)
    const incomeBtn = screen.getByRole('button', { name: /Receita/i })
    expect(incomeBtn.className).toContain('bg-emerald-600')
  })

  it('popula formulário a partir de newTransactionPrefill do contexto (quando aberto globalmente)', () => {
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

    const descInput = screen.getByPlaceholderText(/Supermercado/i) as HTMLInputElement
    expect(descInput.value).toBe('Freelance')
  })
})
