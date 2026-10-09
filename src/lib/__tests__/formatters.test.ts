import { describe, it, expect } from 'vitest'
import { normalizeFamilyName, formatFamilyDisplayName, parseBRLToCents } from '../formatters'

describe('parseBRLToCents', () => {
  it('converts Brazilian Portuguese thousand format without decimals ("1.000" -> 100000 cents)', () => {
    expect(parseBRLToCents('1.000')).toBe(100000)
    expect(parseBRLToCents('1.500')).toBe(150000)
    expect(parseBRLToCents('10.000')).toBe(1000000)
    expect(parseBRLToCents('1.000.000')).toBe(100000000)
  })

  it('converts plain integer strings ("1000" -> 100000 cents)', () => {
    expect(parseBRLToCents('1000')).toBe(100000)
    expect(parseBRLToCents('50')).toBe(5000)
    expect(parseBRLToCents('0')).toBe(0)
  })

  it('converts Brazilian thousand with decimals ("1.000,00" -> 100000 cents, "1.250,50" -> 125050 cents)', () => {
    expect(parseBRLToCents('1.000,00')).toBe(100000)
    expect(parseBRLToCents('1.250,50')).toBe(125050)
  })

  it('converts standard comma decimals without thousand dot ("1000,00" -> 100000 cents, "50,00" -> 5000 cents)', () => {
    expect(parseBRLToCents('1000,00')).toBe(100000)
    expect(parseBRLToCents('50,00')).toBe(5000)
    expect(parseBRLToCents('1000,50')).toBe(100050)
  })

  it('removes spaces and "R$" prefix ("R$ 1.000" -> 100000 cents)', () => {
    expect(parseBRLToCents('R$ 1.000')).toBe(100000)
    expect(parseBRLToCents('R$ 1.250,50')).toBe(125050)
    expect(parseBRLToCents(' R$   50,00 ')).toBe(5000)
  })

  it('handles numeric numbers directly', () => {
    expect(parseBRLToCents(1000)).toBe(100000)
    expect(parseBRLToCents(50.5)).toBe(5050)
  })

  it('handles empty or invalid inputs', () => {
    expect(parseBRLToCents('')).toBe(0)
    expect(parseBRLToCents('   ')).toBe(0)
    expect(parseBRLToCents('invalid')).toBe(0)
  })

  it('handles standard dot decimal when not 3 digits thousand ("10.5", "10.50")', () => {
    expect(parseBRLToCents('10.5')).toBe(1050)
    expect(parseBRLToCents('10.50')).toBe(1050)
  })
})

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

  it('returns empty string when rawName is empty, null or undefined without fallback', () => {
    expect(formatFamilyDisplayName('')).toBe('')
    expect(formatFamilyDisplayName('   ')).toBe('')
    expect(formatFamilyDisplayName(null)).toBe('')
    expect(formatFamilyDisplayName(undefined)).toBe('')
  })

  it('uses custom fallback if provided', () => {
    expect(formatFamilyDisplayName(null, 'Oliveira')).toBe('Família Oliveira')
    expect(formatFamilyDisplayName('', 'Família Souza')).toBe('Família Souza')
    expect(formatFamilyDisplayName(undefined, 'Costa')).toBe('Família Costa')
  })
})
