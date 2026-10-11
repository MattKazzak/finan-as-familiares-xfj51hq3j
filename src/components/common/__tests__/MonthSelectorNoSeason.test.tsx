import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ActiveMonthProvider } from '@/contexts/ActiveMonthContext'
import { MonthSelector } from '@/components/common/MonthSelector'

describe('MonthSelector - Verificação de remoção de estação (R53)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no modo chip (Home): renderiza apenas mês e ano, sem texto ou ícone de estação', () => {
    render(
      <ActiveMonthProvider initialMonth="2026-10">
        <MonthSelector variant="chip" />
      </ActiveMonthProvider>,
    )

    // Formato esperado de mês
    expect(screen.getByText(/Outubro 2026/i)).toBeDefined()

    // Estações NÃO devem estar presentes no DOM
    expect(screen.queryByText(/Primavera/i)).toBeNull()
    expect(screen.queryByText(/Verão/i)).toBeNull()
    expect(screen.queryByText(/Outono/i)).toBeNull()
    expect(screen.queryByText(/Inverno/i)).toBeNull()
  })

  it('no modo default (Carteira/Orçamentos): renderiza apenas mês e ano, sem texto ou ícone de estação', () => {
    render(
      <ActiveMonthProvider initialMonth="2026-07">
        <MonthSelector variant="default" />
      </ActiveMonthProvider>,
    )

    expect(screen.getByText(/Julho 2026/i)).toBeDefined()

    // Estações NÃO devem estar presentes no DOM
    expect(screen.queryByText(/Inverno/i)).toBeNull()
    expect(screen.queryByText(/Primavera/i)).toBeNull()
    expect(screen.queryByText(/Verão/i)).toBeNull()
    expect(screen.queryByText(/Outono/i)).toBeNull()
  })

  it('testa todos os 12 meses garantindo que nenhuma estação é renderizada em nenhuma variante', () => {
    const months = [
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ]

    for (const m of months) {
      const { unmount } = render(
        <ActiveMonthProvider initialMonth={m}>
          <MonthSelector variant="chip" />
          <MonthSelector variant="default" />
        </ActiveMonthProvider>,
      )

      expect(screen.queryByText(/Primavera/i)).toBeNull()
      expect(screen.queryByText(/Verão/i)).toBeNull()
      expect(screen.queryByText(/Outono/i)).toBeNull()
      expect(screen.queryByText(/Inverno/i)).toBeNull()

      unmount()
    }
  })
})
