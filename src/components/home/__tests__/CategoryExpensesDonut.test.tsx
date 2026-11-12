import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoryExpensesDonut } from '../CategoryExpensesDonut'

const SAMPLE_ITEMS = [
  { id: 'cat-1', name: 'Moradia', amountCents: 150000 },
  { id: 'cat-2', name: 'Mercado', amountCents: 90000 },
  { id: 'cat-3', name: 'Lazer', amountCents: 60000 },
]

describe('CategoryExpensesDonut', () => {
  it('renderiza o donut com total do mês no centro e categorias na legenda', () => {
    render(
      <CategoryExpensesDonut
        items={SAMPLE_ITEMS}
        totalCents={300000}
        formatValue={(c) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`}
      />,
    )

    // Gráfico acessível
    expect(
      screen.getByRole('img', { name: /gráfico de rosca dos gastos por categoria/i }),
    ).toBeDefined()
    // Centro do donut
    expect(screen.getByText('Total do mês')).toBeDefined()
    expect(screen.getByText('R$ 3000,00')).toBeDefined()

    // Legenda com nomes, valores e porcentagens
    expect(screen.getByText('Moradia')).toBeDefined()
    expect(screen.getByText('Mercado')).toBeDefined()
    expect(screen.getByText('Lazer')).toBeDefined()

    expect(screen.getByText('R$ 1500,00')).toBeDefined()
    expect(screen.getByText('50%')).toBeDefined()
    expect(screen.getByText('30%')).toBeDefined()
    expect(screen.getByText('20%')).toBeDefined()
  })

  it('permite selecionar e desselecionar uma categoria ao clicar na legenda', () => {
    render(
      <CategoryExpensesDonut
        items={SAMPLE_ITEMS}
        totalCents={300000}
        formatValue={(c) => `R$ ${(c / 100).toFixed(2)}`}
      />,
    )

    const buttonMoradia = screen.getByRole('button', { name: /moradia/i })
    expect(buttonMoradia.getAttribute('aria-pressed')).toBe('false')

    // Clicar ativa
    fireEvent.click(buttonMoradia)
    expect(buttonMoradia.getAttribute('aria-pressed')).toBe('true')

    // Clicar de novo desseleciona
    fireEvent.click(buttonMoradia)
    expect(buttonMoradia.getAttribute('aria-pressed')).toBe('false')
  })

  it('renderiza estado vazio com R$ 0,00 e mensagem amigável sem quebrar', () => {
    render(<CategoryExpensesDonut items={[]} totalCents={0} formatValue={() => 'R$ 0,00'} />)

    expect(screen.getByText('Total do mês')).toBeDefined()
    expect(screen.getByText('R$ 0,00')).toBeDefined()
    expect(screen.getByText('Nenhum gasto registrado neste mês')).toBeDefined()
    expect(
      screen.getByText('Suas despesas aparecerão organizadas por categorias aqui.'),
    ).toBeDefined()
  })
})
