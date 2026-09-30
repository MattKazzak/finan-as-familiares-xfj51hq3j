import { describe, it, expect } from 'vitest'
import {
  generatePdfFitid,
  isPdfPasswordError,
  classifyPdfPasswordError,
  PdfPasswordProtectedError,
  deduplicateExtractedTransactions,
  isDeterministicNonExpense,
  normalizeDescriptionForDedup,
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

  describe('deduplicateExtractedTransactions', () => {
    it('remove duplicatas entre blocos (mesma data + descrição normalizada + valor)', () => {
      const items = [
        {
          date: '2025-02-10',
          description: 'DROGASIL SAO PAULO',
          cleanMerchant: 'Drogasil',
          amountCents: 4590,
        },
        {
          date: '2025-02-10',
          description: 'DROGASIL SÃO PAULO',
          cleanMerchant: 'Drogasil',
          amountCents: 4590, // Duplicata da fronteira de páginas
        },
        {
          date: '2025-02-11',
          description: 'UBER *TRIP',
          cleanMerchant: 'Uber',
          amountCents: 2450,
        },
        {
          date: '2025-02-10',
          description: 'DROGASIL',
          cleanMerchant: 'Drogasil',
          amountCents: 3200, // Valor diferente -> NÃO é duplicata
        },
      ]

      const deduplicated = deduplicateExtractedTransactions(items)
      expect(deduplicated).toHaveLength(3)
      expect(deduplicated[0].cleanMerchant).toBe('Drogasil')
      expect(deduplicated[0].amountCents).toBe(4590)
      expect(deduplicated[1].cleanMerchant).toBe('Uber')
      expect(deduplicated[2].amountCents).toBe(3200)
    })
  })

  describe('isDeterministicNonExpense', () => {
    it('intercepta quitações e pagamentos de fatura anterior', () => {
      expect(isDeterministicNonExpense('Pagamento recebido em 05/02/2025')).toBe(true)
      expect(isDeterministicNonExpense('PAGAMENTO DE FATURA')).toBe(true)
      expect(isDeterministicNonExpense('Pagamento Efetuado')).toBe(true)
      expect(isDeterministicNonExpense('PAGTO FATURA')).toBe(true)
      expect(isDeterministicNonExpense('Pagamento Mínimo')).toBe(true)
      expect(isDeterministicNonExpense('PAGAMENTO TITULO')).toBe(true)
      expect(isDeterministicNonExpense('Quitacao de Fatura')).toBe(true)
    })

    it('intercepta ajustes, encargos e IOF', () => {
      expect(isDeterministicNonExpense('AJUSTE DE CREDITO')).toBe(true)
      expect(isDeterministicNonExpense('Ajuste a debito')).toBe(true)
      expect(isDeterministicNonExpense('ENCARGOS DE FINANCIAMENTO')).toBe(true)
      expect(isDeterministicNonExpense('IOF COMPRA INTERNACIONAL')).toBe(true)
      expect(isDeterministicNonExpense('IOF DIARIO')).toBe(true)
    })

    it('NÃO intercepta tarifa (regra explícita: não aprovado)', () => {
      expect(isDeterministicNonExpense('Tarifa de anuidade')).toBe(false)
      expect(isDeterministicNonExpense('TARIFA BANCARIA')).toBe(false)
    })

    it('NÃO intercepta compras normais', () => {
      expect(isDeterministicNonExpense('Uber *Trip')).toBe(false)
      expect(isDeterministicNonExpense('IFOOD *RESTAURANTE')).toBe(false)
      expect(isDeterministicNonExpense('DROGASIL 01/03')).toBe(false)
      expect(isDeterministicNonExpense('MERCADO LIVRE')).toBe(false)
    })
  })

  describe('normalizeDescriptionForDedup', () => {
    it('normaliza removendo acentos, pontuações e caixa alta', () => {
      expect(normalizeDescriptionForDedup('PAG*Drogasil S/A (01/03)')).toBe('pagdrogasilsa0103')
      expect(normalizeDescriptionForDedup('Açougue & Cia.')).toBe('acouguecia')
    })
  })
})
