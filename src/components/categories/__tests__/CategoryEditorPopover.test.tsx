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

describe('CategoryEditorPopover - inteligência financeira das cotas e equilíbrio global', () => {
  it('Cenário 1: atualiza imediatamente % renda e Cota do Balde quando o usuário digita "1.000"', () => {
    // Balde Essenciais: Meta = 50% de 10.000 = R$ 5.000 (500.000 centavos)
    // otherCategoriesInBucketSum = R$ 2.000 (200.000 centavos)
    // Se digitar 1.000:
    // currentInputCents = 100.000 centavos (R$ 1.000,00)
    // % renda = (1.000 / 10.000) * 100 = 10%
    // remainingBucketCents = 5.000 - (2.000 + 1.000) = R$ 2.000,00 livres
    // allOtherCategoriesSum = 2.000 (Moradia)
    // remainingGlobalCents = 10.000 - (2.000 + 1.000) = 7.000
    // freeInOtherBucketsCents = Math.max(0, 7.000 - 2.000) = 5.000
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

    // % renda deve exibir 10%
    expect(screen.getByText('10%')).toBeDefined()

    // Card de Cota do Balde deve exibir R$ 2.000,00 livres neste balde
    expect(screen.getByText(/🛡️ Cota de Essenciais: Você ainda tem/i)).toBeDefined()
    expect(screen.getByText('R$ 2.000,00')).toBeDefined()
    expect(screen.getByText(/livres neste balde\./i)).toBeDefined()

    // Texto de apoio 💡 de sobra em outros baldes (R$ 5.000,00)
    expect(screen.getByText(/💡 Você também possui/i)).toBeDefined()
    expect(screen.getByText('R$ 5.000,00')).toBeDefined()
    expect(
      screen.getByText(/livres de outros baldes que pode alocar aqui se precisar\./i),
    ).toBeDefined()
  })

  it('Cenário 1 com pontuações pt-BR variadas: "1.000,00", "1000" e "1000,00"', () => {
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

  it('Cenário 1 fronteira: se remainingBucketCents === 0, exibe R$ 0,00 livres', () => {
    // 5.000 meta - 2.000 outras = 3.000 restante
    // Se digitar 3.000 -> remainingBucketCents = 0 -> R$ 0,00 livres neste balde
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

    expect(screen.getByText(/🛡️ Cota de Essenciais: Você ainda tem/i)).toBeDefined()
    expect(screen.getByText('R$ 0,00')).toBeDefined()
    expect(screen.getByText(/livres neste balde\./i)).toBeDefined()
  })

  it('Cenário 2: acima da meta do balde, mas equilibrado no geral (remainingBucketCents < 0 && remainingGlobalCents >= 0)', () => {
    // Meta Essenciais = 5.000 (50%)
    // Outras no balde = 2.000 (20%)
    // Se digitar 4.000:
    // Balde = 2.000 + 4.000 = 6.000 (60% da renda -> acima da meta de 50%)
    // remainingBucketCents = 5.000 - 6.000 = -1.000 (< 0)
    // allOtherCategoriesSum = 2.000
    // remainingGlobalCents = 10.000 - (2.000 + 4.000) = 4.000 (>= 0)
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

    expect(screen.getByText(/⚖️ Equilíbrio Global Mantido:/i)).toBeDefined()
    expect(screen.getByText('60%')).toBeDefined()
    expect(
      screen.getByText(
        /mas o orçamento geral da família segue equilibrado utilizando a folga dos outros baldes\./i,
      ),
    ).toBeDefined()
  })

  it('Cenário 3: estouro da renda familiar total (remainingGlobalCents < 0)', () => {
    // Se digitar 9.000:
    // Balde = 2.000 + 9.000 = 11.000
    // allOtherCategoriesSum = 2.000
    // Total tetos = 2.000 + 9.000 = 11.000
    // remainingGlobalCents = 10.000 - 11.000 = -1.000 (< 0)
    render(
      <CategoryEditorPopover
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        defaultType="expense"
      />,
    )

    const limitInput = screen.getByLabelText(/Teto orçamentário mensal/i) as HTMLInputElement
    fireEvent.change(limitInput, { target: { value: '9.000' } })

    expect(screen.getByText(/⚠️ Orçamento Geral Excedido:/i)).toBeDefined()
    expect(
      screen.getByText(
        /Os tetos cadastrados de toda a casa ultrapassam a renda líquida mensal em/i,
      ),
    ).toBeDefined()
    expect(screen.getByText('R$ 1.000,00')).toBeDefined()
  })

  it('funciona corretamente com bucketsSummary fornecido via props', () => {
    // bucketsSummary com outros baldes preenchidos
    const bucketsSummary = {
      essentials: { budgetCents: 200000, spentCents: 0 }, // 2.000
      lifestyle: { budgetCents: 250000, spentCents: 0 }, // 2.500
      future: { budgetCents: 150000, spentCents: 0 }, // 1.500
    }
    // Total outros baldes = 2.000 + 2.500 + 1.500 = 6.000
    // Digita 1.000 em nova categoria de Essenciais:
    // otherCategoriesInBucketSum = 2.000
    // remainingBucketCents = 5.000 - (2.000 + 1.000) = 2.000
    // allOtherCategoriesSum = 6.000
    // remainingGlobalCents = 10.000 - (6.000 + 1.000) = 3.000
    // freeInOtherBucketsCents = Math.max(0, 3.000 - 2.000) = 1.000
    render(
      <CategoryEditorPopover
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        defaultType="expense"
        bucketsSummary={bucketsSummary}
      />,
    )

    const limitInput = screen.getByLabelText(/Teto orçamentário mensal/i) as HTMLInputElement
    fireEvent.change(limitInput, { target: { value: '1.000' } })

    expect(screen.getByText(/🛡️ Cota de Essenciais: Você ainda tem/i)).toBeDefined()
    expect(screen.getByText('R$ 2.000,00')).toBeDefined()
    expect(screen.getByText('R$ 1.000,00')).toBeDefined()
    expect(
      screen.getByText(/livres de outros baldes que pode alocar aqui se precisar\./i),
    ).toBeDefined()
  })
})
