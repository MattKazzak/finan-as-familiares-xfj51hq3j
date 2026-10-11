import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import React from 'react'
import {
  ActiveMonthProvider,
  useActiveMonth,
  getSouthernHemisphereSeason,
  getCurrentSystemMonthStr,
  parseMonthStrToDate,
  formatDateToMonthStr,
} from '@/contexts/ActiveMonthContext'
import { MonthSelector } from '@/components/common/MonthSelector'

describe('ActiveMonthContext & MonthSelector - Estado Global e Seletor Reutilizável', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Funções utilitárias de data e estação', () => {
    it('calcula as estações do Hemisfério Sul corretamente', () => {
      // Verão: Jan (1), Fev (2), Mar (3)
      expect(getSouthernHemisphereSeason(1)).toBe('Verão')
      expect(getSouthernHemisphereSeason(2)).toBe('Verão')
      expect(getSouthernHemisphereSeason(3)).toBe('Verão')

      // Outono: Abr (4), Mai (5), Jun (6)
      expect(getSouthernHemisphereSeason(4)).toBe('Outono')
      expect(getSouthernHemisphereSeason(5)).toBe('Outono')
      expect(getSouthernHemisphereSeason(6)).toBe('Outono')

      // Inverno: Jul (7), Ago (8), Set (9)
      expect(getSouthernHemisphereSeason(7)).toBe('Inverno')
      expect(getSouthernHemisphereSeason(8)).toBe('Inverno')
      expect(getSouthernHemisphereSeason(9)).toBe('Inverno')

      // Primavera: Out (10), Nov (11), Dez (12)
      expect(getSouthernHemisphereSeason(10)).toBe('Primavera')
      expect(getSouthernHemisphereSeason(11)).toBe('Primavera')
      expect(getSouthernHemisphereSeason(12)).toBe('Primavera')
    })

    it('converte e formata string YYYY-MM e Date com precisão', () => {
      const d = parseMonthStrToDate('2026-10')
      expect(d.getFullYear()).toBe(2026)
      expect(d.getMonth()).toBe(9) // 0-indexed: 9 = outubro
      expect(formatDateToMonthStr(d)).toBe('2026-10')
    })
  })

  describe('ActiveMonthContext - Estado e Regras de Limite', () => {
    it('inicia no mês atual do sistema por padrão', () => {
      const current = getCurrentSystemMonthStr()
      const { result } = renderHook(() => useActiveMonth(), {
        wrapper: ({ children }) => <ActiveMonthProvider>{children}</ActiveMonthProvider>,
      })

      expect(result.current.activeMonth).toBe(current)
      expect(result.current.isNextMonthDisabled).toBe(true)
    })

    it('bloqueia navegação para o futuro além do mês atual', () => {
      const current = getCurrentSystemMonthStr()
      const { result } = renderHook(() => useActiveMonth(), {
        wrapper: ({ children }) => <ActiveMonthProvider>{children}</ActiveMonthProvider>,
      })

      expect(result.current.isNextMonthDisabled).toBe(true)

      // Chamar nextMonth não deve avançar
      act(() => {
        result.current.nextMonth()
      })
      expect(result.current.activeMonth).toBe(current)

      // Chamar setActiveMonth para um mês futuro deve limitar ao mês atual
      act(() => {
        result.current.setActiveMonth('2099-12')
      })
      expect(result.current.activeMonth).toBe(current)
    })

    it('permite navegar para meses anteriores e reabilitar avanço até o limite', () => {
      // Inicia em um mês passado conhecido, ex: 2024-05
      const { result } = renderHook(() => useActiveMonth(), {
        wrapper: ({ children }) => (
          <ActiveMonthProvider initialMonth="2024-05">{children}</ActiveMonthProvider>
        ),
      })

      expect(result.current.activeMonth).toBe('2024-05')
      expect(result.current.isNextMonthDisabled).toBe(false)

      // Retroceder 1 mês
      act(() => {
        result.current.prevMonth()
      })
      expect(result.current.activeMonth).toBe('2024-04')

      // Avançar 1 mês
      act(() => {
        result.current.nextMonth()
      })
      expect(result.current.activeMonth).toBe('2024-05')
    })
  })

  describe('Componente MonthSelector', () => {
    it('renderiza mês em destaque no MonthSelector sem estação (removida na R53)', () => {
      render(
        <ActiveMonthProvider initialMonth="2024-10">
          <MonthSelector />
        </ActiveMonthProvider>,
      )

      // Outubro 2024 em destaque
      expect(screen.getByText(/Outubro 2024/i)).toBeDefined()
      // Estação removida do chip / seletor
      expect(screen.queryByText('Primavera')).toBeNull()
      expect(screen.queryByText('Verão')).toBeNull()
      expect(screen.queryByText('Outono')).toBeNull()
      expect(screen.queryByText('Inverno')).toBeNull()
    })

    it('ao clicar na seta esquerda retrocede o mês ativo', () => {
      render(
        <ActiveMonthProvider initialMonth="2024-10">
          <MonthSelector />
        </ActiveMonthProvider>,
      )

      expect(screen.getByText(/Outubro 2024/i)).toBeDefined()

      const prevBtn = screen.getByRole('button', { name: /mês anterior/i })
      fireEvent.click(prevBtn)

      // Setembro 2024
      expect(screen.getByText(/Setembro 2024/i)).toBeDefined()
      expect(screen.queryByText('Inverno')).toBeNull()
    })

    it('desabilita o botão próximo mês quando atinge o mês atual do sistema', () => {
      const current = getCurrentSystemMonthStr()
      render(
        <ActiveMonthProvider initialMonth={current}>
          <MonthSelector />
        </ActiveMonthProvider>,
      )

      const nextBtn = screen.getByRole('button', { name: /próximo mês/i })
      expect((nextBtn as HTMLButtonElement).disabled).toBe(true)
    })
  })

  describe('Sincronia Global entre Telas (Home, Transações e Orçamentos)', () => {
    function MockHomeScreen() {
      const { activeMonth } = useActiveMonth()
      return (
        <div data-testid="screen-home">
          <span>Home Mês: {activeMonth}</span>
          <MonthSelector />
        </div>
      )
    }

    function MockTransactionsScreen() {
      const { activeMonth } = useActiveMonth()
      return (
        <div data-testid="screen-transactions">
          <span>Transações Mês: {activeMonth}</span>
          <MonthSelector />
        </div>
      )
    }

    function MockBudgetsScreen() {
      const { activeMonth } = useActiveMonth()
      return (
        <div data-testid="screen-budgets">
          <span>Orçamentos Mês: {activeMonth}</span>
          <MonthSelector />
        </div>
      )
    }

    it('trocar o mês em uma tela atualiza instantaneamente as outras duas telas', () => {
      render(
        <ActiveMonthProvider initialMonth="2024-08">
          <MockHomeScreen />
          <MockTransactionsScreen />
          <MockBudgetsScreen />
        </ActiveMonthProvider>,
      )

      // Todas as telas iniciam em 2024-08
      expect(screen.getByText('Home Mês: 2024-08')).toBeDefined()
      expect(screen.getByText('Transações Mês: 2024-08')).toBeDefined()
      expect(screen.getByText('Orçamentos Mês: 2024-08')).toBeDefined()

      // Troca de mês acionada na tela de Transações (seta anterior do seletor)
      const prevButtons = screen.getAllByRole('button', { name: /mês anterior/i })
      // Clica no seletor de Transações (segundo botão)
      fireEvent.click(prevButtons[1])

      // Todas as 3 telas agora refletem 2024-07
      expect(screen.getByText('Home Mês: 2024-07')).toBeDefined()
      expect(screen.getByText('Transações Mês: 2024-07')).toBeDefined()
      expect(screen.getByText('Orçamentos Mês: 2024-07')).toBeDefined()

      // Agora clica no seletor de Orçamentos (terceiro botão) para avançar
      const nextButtons = screen.getAllByRole('button', { name: /próximo mês/i })
      fireEvent.click(nextButtons[2])

      // Todas as 3 telas retornam sincronizadas para 2024-08
      expect(screen.getByText('Home Mês: 2024-08')).toBeDefined()
      expect(screen.getByText('Transações Mês: 2024-08')).toBeDefined()
      expect(screen.getByText('Orçamentos Mês: 2024-08')).toBeDefined()
    })
  })
})
