import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { RecurringIncomesDialog } from '../RecurringIncomesDialog'
import type { RecurringIncome } from '@/types/finance'

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'fam-1', name: 'Família Silva' },
    members: [{ id: 'mem-1', name: 'Arthur' }],
    categories: [],
  }),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

describe('RecurringIncomesDialog', () => {
  const mockRecurringIncomes: RecurringIncome[] = [
    {
      id: 'rec-1',
      family_id: 'fam-1',
      member_id: 'mem-1',
      category_id: null,
      subcategory_id: null,
      name: 'Salário Arthur',
      type: 'income',
      amount_cents: 800000,
      day_of_month: 5,
      active: true,
      created_at: '2025-01-01',
      member: { id: 'mem-1', name: 'Arthur' } as any,
    },
    {
      id: 'rec-2',
      family_id: 'fam-1',
      member_id: 'mem-1',
      category_id: null,
      subcategory_id: null,
      name: 'Aluguel do Apartamento',
      type: 'expense',
      amount_cents: 250000,
      day_of_month: 10,
      active: false,
      created_at: '2025-01-01',
      member: { id: 'mem-1', name: 'Arthur' } as any,
    },
  ]

  it('renderiza as regras recorrentes com status ativa e pausada, valores e dias', () => {
    render(
      <RecurringIncomesDialog
        open={true}
        onOpenChange={vi.fn()}
        currentMonthDate={new Date('2025-03-01T00:00:00Z')}
        recurringIncomes={mockRecurringIncomes}
        recurringOverrides={[]}
        onSuccess={vi.fn()}
      />,
    )

    expect(screen.getByText('Regras Recorrentes')).toBeDefined()
    expect(screen.getByText('Salário Arthur')).toBeDefined()
    expect(screen.getByText('Aluguel do Apartamento')).toBeDefined()
    expect(screen.getByText('Ativa')).toBeDefined()
    expect(screen.getByText('Pausada')).toBeDefined()
    expect(screen.getByText('Dia 5')).toBeDefined()
    expect(screen.getByText('Dia 10')).toBeDefined()
  })

  it('exibe estado amigável quando não houver regras', () => {
    render(
      <RecurringIncomesDialog
        open={true}
        onOpenChange={vi.fn()}
        currentMonthDate={new Date('2025-03-01T00:00:00Z')}
        recurringIncomes={[]}
        recurringOverrides={[]}
        onSuccess={vi.fn()}
      />,
    )

    expect(screen.getByText('Nenhuma regra recorrente ainda')).toBeDefined()
    expect(screen.getByText(/Use o botão \+ e ative "Repetir todo mês"/i)).toBeDefined()
  })

  it('dispara onEditRecurringRule ao clicar em Editar', () => {
    const handleEdit = vi.fn()
    render(
      <RecurringIncomesDialog
        open={true}
        onOpenChange={vi.fn()}
        currentMonthDate={new Date('2025-03-01T00:00:00Z')}
        recurringIncomes={mockRecurringIncomes}
        recurringOverrides={[]}
        onSuccess={vi.fn()}
        onEditRecurringRule={handleEdit}
      />,
    )

    const editButtons = screen.getAllByRole('button', { name: /Editar regra/i })
    fireEvent.click(editButtons[0])
    expect(handleEdit).toHaveBeenCalledWith(mockRecurringIncomes[0])
  })
})
