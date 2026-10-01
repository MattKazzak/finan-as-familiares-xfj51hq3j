import { describe, it, expect } from 'vitest'
import { sanitizeRawText } from '../text-sanitizer'

describe('text-sanitizer (sanitizeRawText)', () => {
  it('retorna string vazia para valores nulos, indefinidos ou vazios', () => {
    expect(sanitizeRawText(null)).toBe('')
    expect(sanitizeRawText(undefined)).toBe('')
    expect(sanitizeRawText('')).toBe('')
  })

  it('preserva quebras de linha normais (\n), tabs (\t) e pontuação PT-BR', () => {
    const valid = 'Linha 1\tValor: R$ 1.250,50\nLinha 2 (Cartão Titular) — Açaí & Pão'
    expect(sanitizeRawText(valid)).toBe(valid)
  })

  it('normaliza CRLF e CR para LF (\n)', () => {
    const mixedNewlines = 'Linha 1\r\nLinha 2\rLinha 3\nLinha 4'
    expect(sanitizeRawText(mixedNewlines)).toBe('Linha 1\nLinha 2\nLinha 3\nLinha 4')
  })

  it('remove caracteres de controle ASCII perigosos (\u0000-\u0008, \u000B, \u000C, \u000E-\u001F, \u007F)', () => {
    const dirty =
      'Pág 1\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008\u000B\u000C\u000E\u000F\u0010\u001F\u007FTítulo'
    expect(sanitizeRawText(dirty)).toBe('Pág 1Título')
  })

  it('remove caractere de substituição Unicode (\uFFFD) e BOM (\uFEFF)', () => {
    const dirty = '\uFEFFFatura Rico \uFFFDR$ 500,00'
    expect(sanitizeRawText(dirty)).toBe('Fatura Rico R$ 500,00')
  })

  it('remove marcas de formatação invisíveis zero-width (\u200B, \u200C, \u200D, etc.)', () => {
    const dirty = 'DROGASIL\u200B \u200C01/03\u200D SP'
    expect(sanitizeRawText(dirty)).toBe('DROGASIL 01/03 SP')
  })

  it('limpa texto típico corrompido de PDF bancário sem perder os dados da compra', () => {
    const corruptedPdfSnippet =
      '\u0000\u0001TOTAL DA FATURA: R$ 1.540,20\u000C\n\uFEFF12/03 DROGASIL 01/03 R$ 89,90\uFFFD\n15/03 IFOOD *RESTAURANTE R$ 45,00\u0007'

    const cleaned = sanitizeRawText(corruptedPdfSnippet)
    expect(cleaned).toBe(
      'TOTAL DA FATURA: R$ 1.540,20\n12/03 DROGASIL 01/03 R$ 89,90\n15/03 IFOOD *RESTAURANTE R$ 45,00',
    )
  })
})
