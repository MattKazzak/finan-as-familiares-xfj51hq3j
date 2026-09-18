// Utilitários de formatação financeira e datas para Finanças da Família
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Formata valor em centavos para moeda BRL: "R$ 1.234,56"
 */
export function formatBRL(cents: number | null | undefined): string {
  const safeCents = typeof cents === 'number' && !isNaN(cents) ? cents : 0
  const reais = safeCents / 100
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(reais)
}

/**
 * Formata apenas o número em BRL sem prefixo "R$"
 */
export function formatNumberBRL(cents: number | null | undefined): string {
  const safeCents = typeof cents === 'number' && !isNaN(cents) ? cents : 0
  const reais = safeCents / 100
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(reais)
}

/**
 * Converte string digitada ("1.234,56" ou "1234.56" ou "12,50") para centavos inteiros
 */
export function parseBRLToCents(val: string | number): number {
  if (typeof val === 'number') {
    return Math.round(val * 100)
  }
  if (!val) return 0
  // Remove R$, espaços
  let clean = val.replace(/[R$\s]/g, '').trim()
  if (!clean) return 0

  // Se tiver vírgula como separador decimal: "1.250,50" -> "1250.50"
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.')
  }
  const parsed = parseFloat(clean)
  return isNaN(parsed) ? 0 : Math.round(parsed * 100)
}

/**
 * Formata data relativa amigável: "Hoje", "Ontem", "12 mar" ou "12 mar 2026"
 */
export function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = parseISO(dateStr.slice(0, 10))
    if (isToday(d)) return 'Hoje'
    if (isYesterday(d)) return 'Ontem'
    return format(d, "d 'de' MMM", { locale: ptBR })
  } catch {
    return dateStr
  }
}

/**
 * Formata cabeçalho de grupo de dia em formato pt-BR amigável:
 * "Hoje, 17 de janeiro", "Ontem, 16 de janeiro", ou "14 de jan." / "14 de jan. de 2025"
 */
export function formatDayGroupHeader(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = parseISO(dateStr.slice(0, 10))
    const now = new Date()
    const isSameYear = d.getFullYear() === now.getFullYear()

    if (isToday(d)) {
      return `Hoje, ${format(d, "d 'de' MMMM", { locale: ptBR })}`
    }
    if (isYesterday(d)) {
      return `Ontem, ${format(d, "d 'de' MMMM", { locale: ptBR })}`
    }
    if (isSameYear) {
      return format(d, "d 'de' MMM.", { locale: ptBR })
    }
    return format(d, "d 'de' MMM. 'de' yyyy", { locale: ptBR })
  } catch {
    return dateStr
  }
}

/**
 * Formata data completa: "17 de março de 2026"
 */
export function formatFullDate(date: Date | string = new Date()): string {
  try {
    const d = typeof date === 'string' ? parseISO(date.slice(0, 10)) : date
    return format(d, "EEEE, d 'de' MMMM", { locale: ptBR })
  } catch {
    return ''
  }
}

/**
 * Formata mês e ano: "Março 2026"
 */
export function formatMonthYear(date: Date | string = new Date()): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    const formatted = format(d, 'MMMM yyyy', { locale: ptBR })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch {
    return ''
  }
}

/**
 * Formata prazo: "dezembro de 2026"
 */
export function formatDeadline(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = parseISO(dateStr.slice(0, 10))
    return format(d, "MMMM 'de' yyyy", { locale: ptBR })
  } catch {
    return dateStr
  }
}
