import { describe, it, expect } from 'vitest'
import { generatePdfFitid } from '../pdf-parser'

describe('pdf-parser service', () => {
  it('gera FITID determinístico curto a partir de data, descrição e valor', () => {
    const fitid1 = generatePdfFitid('2025-05-15', 'Uber *Trip', 2490)
    const fitid2 = generatePdfFitid('2025-05-15', 'Uber *Trip', 2490)
    const fitid3 = generatePdfFitid('2025-05-15', 'Uber *Outra', 2490)

    expect(fitid1).toBe(fitid2)
    expect(fitid1.startsWith('PDF-20250515-')).toBe(true)
    expect(fitid1).not.toBe(fitid3)
  })
})
