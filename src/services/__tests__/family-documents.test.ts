import { describe, it, expect } from 'vitest'
import {
  DOCUMENT_CATEGORIES,
  getDocumentExpirationStatus,
  formatDocumentSize,
  SHARE_DURATION_CONFIG,
} from '@/services/family-documents'

describe('Serviço de Documentos da Família (Pasta de Documentos)', () => {
  it('contém exatamente as 5 pastas canônicas acordadas com a usuária', () => {
    const ids = DOCUMENT_CATEGORIES.map((c) => c.id)
    expect(ids).toEqual(['identidade', 'familia', 'residencia', 'saude', 'outros'])
  })

  it('calcula status de validade e expiração corretamente', () => {
    // Sem data de validade
    expect(getDocumentExpirationStatus(null)).toEqual({
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
      label: null,
    })

    // Data no passado (vencido)
    const expiredStatus = getDocumentExpirationStatus('2020-01-01')
    expect(expiredStatus.isExpired).toBe(true)
    expect(expiredStatus.label).toBe('Vencido')

    // Data futura distante (> 30 dias)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 90)
    const futureDateStr = futureDate.toISOString().split('T')[0]
    const futureStatus = getDocumentExpirationStatus(futureDateStr)
    expect(futureStatus.isExpired).toBe(false)
    expect(futureStatus.isExpiringSoon).toBe(false)
    expect(futureStatus.label).toBeNull()

    // Data próxima (ex.: 10 dias)
    const soonDate = new Date()
    soonDate.setDate(soonDate.getDate() + 10)
    const soonDateStr = soonDate.toISOString().split('T')[0]
    const soonStatus = getDocumentExpirationStatus(soonDateStr)
    expect(soonStatus.isExpired).toBe(false)
    expect(soonStatus.isExpiringSoon).toBe(true)
    expect(soonStatus.label).toMatch(/Vence em (9|10|11) dias/)
  })

  it('formata tamanho de arquivo de forma legível em KB e MB', () => {
    expect(formatDocumentSize(0)).toBe('0 KB')
    expect(formatDocumentSize(500 * 1024)).toBe('500 KB')
    expect(formatDocumentSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })

  it('oferece opções seguras de duração de link temporário (15m, 1h, 24h)', () => {
    expect(SHARE_DURATION_CONFIG['15m'].seconds).toBe(15 * 60)
    expect(SHARE_DURATION_CONFIG['1h'].seconds).toBe(60 * 60)
    expect(SHARE_DURATION_CONFIG['24h'].seconds).toBe(24 * 60 * 60)
  })
})
