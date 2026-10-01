import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { NewTransactionActionSheet } from '../NewTransactionActionSheet'

describe('NewTransactionActionSheet', () => {
  it('renderiza as opções de Nova Despesa, Nova Receita e Recorrentes', () => {
    const onSelectExpense = vi.fn()
    const onSelectIncome = vi.fn()
    const onSelectRecurring = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <NewTransactionActionSheet
        open={true}
        onOpenChange={onOpenChange}
        onSelectExpense={onSelectExpense}
        onSelectIncome={onSelectIncome}
        onSelectRecurringIncomes={onSelectRecurring}
      />,
    )

    expect(screen.getByText('O que você deseja registrar?')).toBeDefined()
    expect(screen.getByText('Nova Despesa')).toBeDefined()
    expect(screen.getByText('Nova Receita')).toBeDefined()
    expect(screen.getByText('Lançamentos Fixos / Recorrentes 🔁')).toBeDefined()

    // Não deve conter mais botão redundante de voz dentro do ActionSheet
    expect(screen.queryByText(/falar lançamento/i)).toBeNull()
    expect(screen.queryByText(/gravar áudio/i)).toBeNull()
  })

  it('aciona os callbacks corretos ao clicar nos cards', () => {
    const onSelectExpense = vi.fn()
    const onSelectIncome = vi.fn()
    const onSelectRecurring = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <NewTransactionActionSheet
        open={true}
        onOpenChange={onOpenChange}
        onSelectExpense={onSelectExpense}
        onSelectIncome={onSelectIncome}
        onSelectRecurringIncomes={onSelectRecurring}
      />,
    )

    fireEvent.click(screen.getByText('Nova Despesa'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSelectExpense).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Nova Receita'))
    expect(onSelectIncome).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Lançamentos Fixos / Recorrentes 🔁'))
    expect(onSelectRecurring).toHaveBeenCalledTimes(1)
  })
})
