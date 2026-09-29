import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { CategoryEditorPopover } from '../CategoryEditorPopover'

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: {
      id: 'fam-1',
      name: 'Silva',
      monthly_net_income_cents: 1000000, // R$ 10.000,00 de renda mensal líquida
    },
    categories: [
      {
        id: 'cat-outra',
        name: 'Moradia',
        type: 'expense',
        budget_bucket: 'essentials',
        percent_default: 20, // 20% de 10.000 = 2.000 (200.000 centavos)
      },
    ],
  }),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

describe('CategoryEditorPopover - cálculo dinâmico de teto com pontuação pt-BR', () => {
  it('atualiza imediatamente % renda e Cota do Balde quando o usuário digita "1.000"', () => {
    // Balde Essenciais: Meta = 50% de 10.000 = R$ 5.000 (500.000 centavos)
    // otherCategoriesSum = R$ 2.000 (200.000 centavos)
    // Se digitar 1.000:
    // currentInputCents = 100.000 centavos (R$ 1.000,00)
    // % renda = (1.000 / 10.000) * 100 = 10%
    // remainingBudgetCents = 5.000 - (2.000 + 1.000) = R$ 2.000,00 livres
    render(
      <CategoryEditorPopover
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        defaultType="expense"
      />,
    )

    const limitInput = screen.getByLabelText(/Teto orçamentário mensal/i) as HTMLInputElement
    expect(limitInput).toBeDefined()

    // Digita "1.000"
    fireEvent.change(limitInput, { target: { value: '1.000' } })

    // % renda deve exibir 10% (e não 0%)
    expect(screen.getByText('10%')).toBeDefined()

    // Card de Cota do Balde deve exibir R$ 2.000,00 livres
    expect(screen.getByText(/🛡️ Cota de Essenciais:/i)).toBeDefined()
    expect(screen.getByText('R$ 2.000,00')).toBeDefined()
  })

  it('atualiza imediatamente ao digitar "1.000,00", "1000" e "1000,00"', () => {
    render(
      <CategoryEditorPopover
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        defaultType="expense"
      />,
    )

    const limitInput = screen.getByLabelText(/Teto orçamentário mensal/i) as HTMLInputElement

    // Caso "1000"
    fireEvent.change(limitInput, { target: { value: '1000' } })
    expect(screen.getByText('10%')).toBeDefined()
    expect(screen.getByText('R$ 2.000,00')).toBeDefined()

    // Caso "1.000,00"
    fireEvent.change(limitInput, { target: { value: '1.000,00' } })
    expect(screen.getByText('10%')).toBeDefined()
    expect(screen.getByText('R$ 2.000,00')).toBeDefined()

    // Caso "1000,00"
    fireEvent.change(limitInput, { target: { value: '1000,00' } })
    expect(screen.getByText('10%')).toBeDefined()
    expect(screen.getByText('R$ 2.000,00')).toBeDefined()
  })

  it('atualiza o card para "100% preenchida" quando o teto preenche exatamente a cota', () => {
    // 5.000 meta - 2.000 outras = 3.000 restante
    // Se digitar 3.000 -> remainingBudgetCents = 0 -> "✓ Cota de Essenciais 100% preenchida."
    render(
      <CategoryEditorPopover
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        defaultType="expense"
      />,
    )

    const limitInput = screen.getByLabelText(/Teto orçamentário mensal/i) as HTMLInputElement
    fireEvent.change(limitInput, { target: { value: '3.000' } })

    expect(screen.getByText(/✓ Cota de Essenciais 100% preenchida/i)).toBeDefined()
  })

  it('atualiza o card para "⚠️ Atenção" quando ultrapassa a meta', () => {
    // Se digitar 4.000 -> restante = 5.000 - (2.000 + 4.000) = -1.000 (acima da meta de 50%)
    render(
      <CategoryEditorPopover
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        defaultType="expense"
      />,
    )

    const limitInput = screen.getByLabelText(/Teto orçamentário mensal/i) as HTMLInputElement
    fireEvent.change(limitInput, { target: { value: '4.000' } })

    expect(screen.getByText(/⚠️ Atenção: Os tetos deste balde estão/i)).toBeDefined()
    expect(screen.getByText('R$ 1.000,00')).toBeDefined()
    expect(screen.getByText(/acima da meta de 50%/i)).toBeDefined()
  })
})
