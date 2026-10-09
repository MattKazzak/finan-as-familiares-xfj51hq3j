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
  // 1. Remove espaços e o prefixo "R$"
  let clean = val.replace(/[R$\s]/g, '').trim()
  if (!clean) return 0

  const hasComma = clean.includes(',')
  const hasDot = clean.includes('.')

  if (hasComma && hasDot) {
    // Ex: "1.250,50" -> remover todos os pontos e substituir vírgula por ponto
    clean = clean.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    // Ex: "1000,50" ou "50,00" -> substituir a vírgula por ponto
    clean = clean.replace(',', '.')
  } else if (hasDot) {
    // Apenas ponto presente
    // Se tiver formato de milhar com blocos de 3 dígitos após ponto (ex: "1.000" ou "1.500" ou "1.000.000")
    // Tratar como separador de milhar brasileiro se tiver 3 dígitos após o ponto, convertendo para 1000 ou 1500;
    // ou limpar os pontos de milhar antes da conversão.
    const dotParts = clean.split('.')
    const afterLastDot = dotParts[dotParts.length - 1]
    const allIntermediateValidThousands = dotParts.slice(1).every((part) => part.length === 3)

    if (allIntermediateValidThousands && afterLastDot.length === 3) {
      // Ex: "1.000", "15.000", "1.250.000" -> separador de milhar brasileiro
      clean = clean.replace(/\./g, '')
    } else {
      // Se não for milhar (ex: "10.5" ou "10.50"), deixa como float americano padrão
      // caso o usuário digite com ponto decimal
    }
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

/**
 * Normaliza o nome da família removendo prefixos redundantes "Família" ou "Familia" do início
 * Ex.: "Família Matheus" -> "Matheus"
 *      "Familia Silva" -> "Silva"
 *      "Matheus" -> "Matheus"
 */
export function normalizeFamilyName(rawName?: string | null): string {
  if (!rawName) return ''
  const trimmed = rawName.trim()
  // Remove prefixo "Família " ou "Familia " repetido no início (case-insensitive)
  const cleaned = trimmed.replace(/^(?:fam[íi]lia\s*)+/i, '').trim()
  return cleaned || trimmed
}

/**
 * Formata o nome de exibição da família garantindo que a palavra "Família"
 * nunca apareça duplicada.
 * Se o nome for omitido ou vazio e não houver fallback neutro, retorna string vazia.
 * Se o nome já começa com "Família" (case-insensitive), mantém com capitalização correta.
 * Caso contrário, adiciona o prefixo "Família {nome}".
 *
 * Exemplos:
 *   formatFamilyDisplayName("Família Matheus") => "Família Matheus"
 *   formatFamilyDisplayName("Familia Matheus") => "Família Matheus"
 *   formatFamilyDisplayName("Matheus")         => "Família Matheus"
 *   formatFamilyDisplayName("Silva")           => "Família Silva"
 *   formatFamilyDisplayName("Família Silva")   => "Família Silva"
 *   formatFamilyDisplayName(undefined)         => ""
 *   formatFamilyDisplayName("", "Oliveira")    => "Família Oliveira"
 */
export function formatFamilyDisplayName(rawName?: string | null, fallback: string = ''): string {
  const trimmed = (rawName || '').trim()
  if (!trimmed) {
    const trimmedFallback = (fallback || '').trim()
    if (!trimmedFallback) return ''
    // Se o fallback já vier com "Família", respeita; senão prefixa
    if (/^fam[íi]lia\b/i.test(trimmedFallback)) {
      const cleanFallback = trimmedFallback.replace(/^fam[íi]lia\s*/i, '')
      return cleanFallback ? `Família ${cleanFallback}` : 'Família'
    }
    return `Família ${trimmedFallback}`
  }

  // Verifica se o nome já começa com "Família" ou "Familia" (case-insensitive)
  const match = trimmed.match(/^fam[íi]lia\s*(.*)$/i)
  if (match) {
    const remainder = match[1].trim()
    // Pode haver casos onde o usuário salvou "Família Família Matheus" anteriormente
    const fullyCleaned = normalizeFamilyName(remainder)
    return fullyCleaned ? `Família ${fullyCleaned}` : 'Família'
  }

  return `Família ${trimmed}`
}
