import { describe, it, expect } from 'vitest'
import { normalizeFamilyName, formatFamilyDisplayName } from '../formatters'

describe('normalizeFamilyName', () => {
  it('handles null, undefined or empty strings returning empty string', () => {
    expect(normalizeFamilyName(null)).toBe('')
    expect(normalizeFamilyName(undefined)).toBe('')
    expect(normalizeFamilyName('')).toBe('')
    expect(normalizeFamilyName('   ')).toBe('')
  })

  it('keeps raw name if no prefix is present', () => {
    expect(normalizeFamilyName('Matheus')).toBe('Matheus')
    expect(normalizeFamilyName('Silva')).toBe('Silva')
    expect(normalizeFamilyName('  Oliveira  ')).toBe('Oliveira')
  })

  it('removes "Família " prefix (com acento)', () => {
    expect(normalizeFamilyName('Família Matheus')).toBe('Matheus')
    expect(normalizeFamilyName('família Matheus')).toBe('Matheus')
    expect(normalizeFamilyName('FAMÍLIA Matheus')).toBe('Matheus')
  })

  it('removes "Familia " prefix (sem acento também limpa)', () => {
    expect(normalizeFamilyName('Familia Silva')).toBe('Silva')
    expect(normalizeFamilyName('familia Silva')).toBe('Silva')
    expect(normalizeFamilyName('FAMILIA Silva')).toBe('Silva')
  })

  it('deduplicates multiple prefixes like "Família Família Matheus"', () => {
    expect(normalizeFamilyName('Família Família Matheus')).toBe('Matheus')
    expect(normalizeFamilyName('Familia Familia Silva')).toBe('Silva')
    expect(normalizeFamilyName('Família Familia Matheus')).toBe('Matheus')
    expect(normalizeFamilyName('familia  Família   Santos')).toBe('Santos')
  })

  it('handles string with only "Família" or "Familia"', () => {
    expect(normalizeFamilyName('Família')).toBe('Família')
    expect(normalizeFamilyName('Familia')).toBe('Familia')
  })
})

describe('formatFamilyDisplayName', () => {
  it('adds prefix when only surname is provided ("Matheus" -> "Família Matheus")', () => {
    expect(formatFamilyDisplayName('Matheus')).toBe('Família Matheus')
    expect(formatFamilyDisplayName('Silva')).toBe('Família Silva')
  })

  it('does not duplicate prefix if already present ("Família Matheus" -> "Família Matheus")', () => {
    expect(formatFamilyDisplayName('Família Matheus')).toBe('Família Matheus')
    expect(formatFamilyDisplayName('Família Silva')).toBe('Família Silva')
  })

  it('cleans and formats when without accent ("Familia Silva" -> "Família Silva")', () => {
    expect(formatFamilyDisplayName('Familia Silva')).toBe('Família Silva')
    expect(formatFamilyDisplayName('familia matheus')).toBe('Família matheus')
  })

  it('deduplicates doubled prefix ("Família Família Matheus" -> "Família Matheus")', () => {
    expect(formatFamilyDisplayName('Família Família Matheus')).toBe('Família Matheus')
    expect(formatFamilyDisplayName('Familia Família Matheus')).toBe('Família Matheus')
    expect(formatFamilyDisplayName('Família Familia Matheus')).toBe('Família Matheus')
  })

  it('uses fallback "Silva" when rawName is empty, null or undefined', () => {
    expect(formatFamilyDisplayName('')).toBe('Família Silva')
    expect(formatFamilyDisplayName('   ')).toBe('Família Silva')
    expect(formatFamilyDisplayName(null)).toBe('Família Silva')
    expect(formatFamilyDisplayName(undefined)).toBe('Família Silva')
  })

  it('uses custom fallback if provided', () => {
    expect(formatFamilyDisplayName(null, 'Oliveira')).toBe('Família Oliveira')
    expect(formatFamilyDisplayName('', 'Família Souza')).toBe('Família Souza')
    expect(formatFamilyDisplayName(undefined, 'Costa')).toBe('Família Costa')
  })
})
