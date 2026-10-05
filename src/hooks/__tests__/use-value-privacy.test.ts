import { describe, it, expect } from 'vitest'
import { getTimeGreeting } from '../use-value-privacy'

describe('use-value-privacy: getTimeGreeting', () => {
  it('retorna "Bom dia" pela manhã (05:00 às 11:59)', () => {
    const morning = new Date(2026, 5, 15, 8, 30, 0)
    const result = getTimeGreeting(morning)
    expect(result.greeting).toBe('Bom dia')
    expect(result.period).toBe('morning')
    expect(result.fullGreeting('Lucas')).toBe('Bom dia, Lucas')
  })

  it('retorna "Boa tarde" no período da tarde (12:00 às 17:59)', () => {
    const afternoon = new Date(2026, 5, 15, 14, 0, 0)
    const result = getTimeGreeting(afternoon)
    expect(result.greeting).toBe('Boa tarde')
    expect(result.period).toBe('afternoon')
    expect(result.fullGreeting('Maria')).toBe('Boa tarde, Maria')
  })

  it('retorna "Boa noite" no período da noite/madrugada (18:00 às 04:59)', () => {
    const evening = new Date(2026, 5, 15, 20, 15, 0)
    const result = getTimeGreeting(evening)
    expect(result.greeting).toBe('Boa noite')
    expect(result.period).toBe('evening')
    expect(result.fullGreeting('Carlos')).toBe('Boa noite, Carlos')

    const night = new Date(2026, 5, 15, 2, 0, 0)
    expect(getTimeGreeting(night).greeting).toBe('Boa noite')
  })

  it('faz fallback seguro quando o nome for nulo ou vazio', () => {
    const morning = new Date(2026, 5, 15, 9, 0, 0)
    expect(getTimeGreeting(morning).fullGreeting(null)).toBe('Bom dia!')
    expect(getTimeGreeting(morning).fullGreeting('')).toBe('Bom dia!')
  })
})
