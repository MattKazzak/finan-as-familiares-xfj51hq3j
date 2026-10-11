import React, { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { parseISO } from 'date-fns'

export interface ActiveMonthContextValue {
  /**
   * Mês ativo global no formato YYYY-MM (ex: "2026-10")
   * ÚNICA fonte de verdade sobre o mês visto em todo o app.
   */
  activeMonth: string

  /**
   * Data correspondente ao activeMonth (sempre dia 1 do mês, ex: new Date(2026, 9, 1))
   */
  activeDate: Date

  /**
   * Altera o mês ativo diretamente para um novo valor YYYY-MM (respeitando limite de mês futuro se enforcesLimit)
   */
  setActiveMonth: (monthStr: string) => void

  /**
   * Navega para o mês anterior (activeMonth - 1 mês)
   */
  prevMonth: () => void

  /**
   * Navega para o próximo mês (activeMonth + 1 mês), bloqueado se já estiver no mês atual
   */
  nextMonth: () => void

  /**
   * Retorna se a navegação para o próximo mês está bloqueada (activeMonth >= mês atual corrente)
   */
  isNextMonthDisabled: boolean

  /**
   * Mês atual corrente do relógio local do usuário (YYYY-MM)
   */
  currentSystemMonth: string
}

const ActiveMonthContext = createContext<ActiveMonthContextValue | null>(null)

/**
 * Retorna o mês atual do sistema no formato YYYY-MM (ex: "2026-10")
 */
export function getCurrentSystemMonthStr(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * Converte "YYYY-MM" em Date (dia 1 do mês)
 */
export function parseMonthStrToDate(monthStr: string): Date {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  const [yearStr, monthNumStr] = monthStr.split('-')
  const year = parseInt(yearStr, 10)
  const monthIdx = parseInt(monthNumStr, 10) - 1
  return new Date(year, monthIdx, 1)
}

/**
 * Formata um Date em string "YYYY-MM"
 */
export function formatDateToMonthStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * Retorna a estação do ano no Hemisfério Sul baseada no mês (1-12)
 * Primavera: Out, Nov, Dez
 * Verão: Jan, Fev, Mar
 * Outono: Abr, Mai, Jun
 * Inverno: Jul, Ago, Set
 */
export function getSouthernHemisphereSeason(monthNumber: number): string {
  // monthNumber: 1 a 12
  if (monthNumber >= 1 && monthNumber <= 3) {
    return 'Verão'
  }
  if (monthNumber >= 4 && monthNumber <= 6) {
    return 'Outono'
  }
  if (monthNumber >= 7 && monthNumber <= 9) {
    return 'Inverno'
  }
  return 'Primavera'
}

export function ActiveMonthProvider({
  children,
  initialMonth,
}: {
  children: React.ReactNode
  initialMonth?: string
}) {
  const currentSystemMonth = useMemo(() => getCurrentSystemMonthStr(), [])

  const [activeMonth, setActiveMonthState] = useState<string>(() => {
    if (initialMonth && /^\d{4}-\d{2}$/.test(initialMonth)) {
      // Limite: não permitir inicializar além do mês atual
      return initialMonth > currentSystemMonth ? currentSystemMonth : initialMonth
    }
    return currentSystemMonth
  })

  const activeDate = useMemo(() => {
    return parseMonthStrToDate(activeMonth)
  }, [activeMonth])

  // Limite estrito: não permitir navegar para meses futuros além do mês atual
  const isNextMonthDisabled = useMemo(() => {
    return activeMonth >= currentSystemMonth
  }, [activeMonth, currentSystemMonth])

  const setActiveMonth = useCallback(
    (monthStr: string) => {
      if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return
      // Limita ao mês atual se tentar ir para o futuro
      if (monthStr > currentSystemMonth) {
        setActiveMonthState(currentSystemMonth)
      } else {
        setActiveMonthState(monthStr)
      }
    },
    [currentSystemMonth],
  )

  const prevMonth = useCallback(() => {
    setActiveMonthState((prev) => {
      const d = parseMonthStrToDate(prev)
      d.setMonth(d.getMonth() - 1)
      return formatDateToMonthStr(d)
    })
  }, [])

  const nextMonth = useCallback(() => {
    setActiveMonthState((prev) => {
      if (prev >= currentSystemMonth) {
        return prev // Bloqueado: não avança além do mês atual
      }
      const d = parseMonthStrToDate(prev)
      d.setMonth(d.getMonth() + 1)
      const nextStr = formatDateToMonthStr(d)
      return nextStr > currentSystemMonth ? currentSystemMonth : nextStr
    })
  }, [currentSystemMonth])

  const value = useMemo<ActiveMonthContextValue>(() => {
    return {
      activeMonth,
      activeDate,
      setActiveMonth,
      prevMonth,
      nextMonth,
      isNextMonthDisabled,
      currentSystemMonth,
    }
  }, [
    activeMonth,
    activeDate,
    setActiveMonth,
    prevMonth,
    nextMonth,
    isNextMonthDisabled,
    currentSystemMonth,
  ])

  return <ActiveMonthContext.Provider value={value}>{children}</ActiveMonthContext.Provider>
}

export function useActiveMonth(): ActiveMonthContextValue {
  const context = useContext(ActiveMonthContext)
  if (!context) {
    throw new Error('useActiveMonth deve ser usado dentro de um ActiveMonthProvider')
  }
  return context
}
