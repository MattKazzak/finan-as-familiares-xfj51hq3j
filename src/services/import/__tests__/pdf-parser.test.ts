import { describe, it, expect } from 'vitest'
import {
  generatePdfFitid,
  isPdfPasswordError,
  classifyPdfPasswordError,
  PdfPasswordProtectedError,
} from '../pdf-parser'

describe('pdf-parser service', () => {
  it('gera FITID determinístico curto a partir de data, descrição e valor', () => {
    const fitid1 = generatePdfFitid('2025-05-15', 'Uber *Trip', 2490)
    const fitid2 = generatePdfFitid('2025-05-15', 'Uber *Trip', 2490)
    const fitid3 = generatePdfFitid('2025-05-15', 'Uber *Outra', 2490)

    expect(fitid1).toBe(fitid2)
    expect(fitid1.startsWith('PDF-20250515-')).toBe(true)
    expect(fitid1).not.toBe(fitid3)
  })

  it('detecta erros de senha do PDF (PasswordException, No password given, etc.)', () => {
    expect(isPdfPasswordError({ name: 'PasswordException', message: 'No password given' })).toBe(
      true,
    )
    expect(isPdfPasswordError(new Error('No password given'))).toBe(true)
    expect(isPdfPasswordError(new Error('Password required to open this PDF'))).toBe(true)
    expect(isPdfPasswordError(new Error('Incorrect password'))).toBe(true)
    expect(isPdfPasswordError(new PdfPasswordProtectedError('NEED_PASSWORD'))).toBe(true)
    expect(isPdfPasswordError(new Error('Invalid PDF structure'))).toBe(false)
    expect(isPdfPasswordError(null)).toBe(false)
  })

  it('classifica corretamente entre NEED_PASSWORD e INCORRECT_PASSWORD', () => {
    // 1. Falha sem senha prévia (No password given) -> NEED_PASSWORD
    const errInitial = classifyPdfPasswordError(
      { name: 'PasswordException', message: 'No password given' },
      false,
    )
    expect(errInitial.kind).toBe('NEED_PASSWORD')
    expect(errInitial.message).toBe('Esta fatura é protegida por senha.')

    // 2. Falha com código 2 (pdfjs INCORRECT_PASSWORD)
    const errCode2 = classifyPdfPasswordError(
      { name: 'PasswordException', code: 2, message: 'Password required' },
      false,
    )
    expect(errCode2.kind).toBe('INCORRECT_PASSWORD')
    expect(errCode2.message).toBe('Senha incorreta. Tente novamente.')

    // 3. Falha quando uma senha já havia sido tentada (hadPassword = true)
    const errAfterAttempt = classifyPdfPasswordError(
      { name: 'PasswordException', message: 'No password given' },
      true,
    )
    expect(errAfterAttempt.kind).toBe('INCORRECT_PASSWORD')
    expect(errAfterAttempt.message).toBe('Senha incorreta. Tente novamente.')
  })
})
