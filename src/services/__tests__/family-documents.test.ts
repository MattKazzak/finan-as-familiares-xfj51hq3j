import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import {
  DOCUMENT_CATEGORIES,
  getDocumentExpirationStatus,
  formatDocumentSize,
  SHARE_DURATION_CONFIG,
  shareDocumentFileOrLink,
  FamilyDocument,
} from '@/services/family-documents'
import * as familyDocsModule from '@/services/family-documents'

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

  it('deriva o formato correto e monta o subtítulo FORMATO • TAMANHO', async () => {
    const { getDocumentFormatLabel, formatDocumentSubtitle } =
      await import('@/services/family-documents')

    // Formatos por MIME e por extensão
    expect(getDocumentFormatLabel('application/pdf', 'fatura.pdf')).toBe('PDF')
    expect(getDocumentFormatLabel('image/jpeg', 'foto.jpg')).toBe('JPEG')
    expect(getDocumentFormatLabel('image/png', 'recibo.png')).toBe('PNG')
    expect(getDocumentFormatLabel('image/webp', 'avatar.webp')).toBe('WEBP')
    expect(getDocumentFormatLabel('text/plain', 'notas.txt')).toBe('TXT')
    expect(getDocumentFormatLabel(null, 'documento.pdf')).toBe('PDF')
    expect(getDocumentFormatLabel('application/octet-stream', 'planilha.xlsx')).toBe('XLSX')

    // Subtítulo completo: "FORMATO • TAMANHO"
    expect(formatDocumentSubtitle('application/pdf', 100 * 1024, 'doc.pdf')).toBe('PDF • 100 KB')
    expect(formatDocumentSubtitle('image/jpeg', 11 * 1024, 'foto.jpg')).toBe('JPEG • 11 KB')
    expect(formatDocumentSubtitle('image/png', 25 * 1024, 'print.png')).toBe('PNG • 25 KB')
    expect(formatDocumentSubtitle('application/pdf', 920 * 1024, 'contrato.pdf')).toBe(
      'PDF • 920 KB',
    )

    // Nunca exibe nomes de categoria no subtítulo
    expect(formatDocumentSubtitle('application/pdf', 11 * 1024, 'outros.pdf')).not.toContain(
      'Outros',
    )
  })

  it('oferece opções seguras de duração de link temporário (15m, 1h, 24h)', () => {
    expect(SHARE_DURATION_CONFIG['15m'].seconds).toBe(15 * 60)
    expect(SHARE_DURATION_CONFIG['1h'].seconds).toBe(60 * 60)
    expect(SHARE_DURATION_CONFIG['24h'].seconds).toBe(24 * 60 * 60)
  })

  describe('shareDocumentFileOrLink (compartilhamento nativo e fallbacks)', () => {
    const mockDoc: FamilyDocument = {
      id: 'doc-share-1',
      family_id: 'fam-123',
      uploaded_by: 'user-1',
      uploaded_by_name: 'Usuário',
      title: 'Minha CNH Digital',
      category: 'identidade',
      storage_path: 'fam-123/cnh.pdf',
      file_name: 'cnh.pdf',
      file_size_bytes: 200 * 1024,
      mime_type: 'application/pdf',
      expires_at: null,
      is_shared_with_family: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    it('compartilha o ARQUIVO real via navigator.share quando canShare({ files }) for suportado', async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined)
      const canShareMock = vi.fn().mockReturnValue(true)

      // Mock navigator.share e canShare
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          share: shareMock,
          canShare: canShareMock,
        },
        writable: true,
        configurable: true,
      })

      // Mock fetch para devolver blob do arquivo
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: vi.fn().mockResolvedValue(new Blob(['conteudo pdf'], { type: 'application/pdf' })),
      } as any)

      vi.spyOn(familyDocsModule, 'getDocumentSignedUrl').mockResolvedValue(
        'https://supabase.signed/cnh.pdf',
      )

      const result = await shareDocumentFileOrLink(mockDoc)

      expect(result.method).toBe('native-file')
      expect(canShareMock).toHaveBeenCalled()
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Minha CNH Digital',
          files: expect.any(Array),
        }),
      )

      globalThis.fetch = originalFetch
    })

    it('compartilha a URL pública quando o navegador tiver navigator.share mas sem suporte a arquivos', async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined)
      const canShareMock = vi.fn().mockReturnValue(false) // Sem suporte a arquivos

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          share: shareMock,
          canShare: canShareMock,
        },
        writable: true,
        configurable: true,
      })

      vi.spyOn(familyDocsModule, 'createDocumentTemporaryShare').mockResolvedValue({
        share: {} as any,
        publicUrl: 'https://curiangoo.com/doc/token123',
      })

      const result = await shareDocumentFileOrLink(mockDoc)

      expect(result.method).toBe('native-link')
      expect(shareMock).toHaveBeenCalledWith({
        title: 'Minha CNH Digital',
        url: 'https://curiangoo.com/doc/token123',
      })
    })

    it('copia o link temporário no clipboard quando for desktop / sem navigator.share', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined)

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          clipboard: {
            writeText: writeTextMock,
          },
        },
        writable: true,
        configurable: true,
      })

      vi.spyOn(familyDocsModule, 'createDocumentTemporaryShare').mockResolvedValue({
        share: {} as any,
        publicUrl: 'https://curiangoo.com/doc/token456',
      })

      const result = await shareDocumentFileOrLink(mockDoc)

      expect(result.method).toBe('clipboard-link')
      expect(writeTextMock).toHaveBeenCalledWith('https://curiangoo.com/doc/token456')
    })
  })
})
