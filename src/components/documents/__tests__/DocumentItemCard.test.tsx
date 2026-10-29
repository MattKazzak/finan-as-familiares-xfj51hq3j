import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentItemCard } from '../DocumentItemCard'
import { FamilyDocument } from '@/services/family-documents'
import * as pdfThumbnailModule from '@/services/pdf-thumbnail'

vi.mock('@/services/family-documents', async () => {
  const actual = await vi.importActual<typeof import('@/services/family-documents')>(
    '@/services/family-documents',
  )
  return {
    ...actual,
    getDocumentSignedUrl: vi.fn().mockImplementation((path: string) => {
      return Promise.resolve(`https://signed.url/${path}`)
    }),
  }
})

vi.mock('@/services/pdf-thumbnail', () => ({
  renderPdfFirstPageThumbnail: vi.fn(),
  clearPdfThumbnailCache: vi.fn(),
}))

describe('DocumentItemCard', () => {
  const samplePdfDoc: FamilyDocument = {
    id: 'doc-pdf-1',
    family_id: 'fam-1',
    uploaded_by: 'user-1',
    uploaded_by_name: 'Usuário Teste',
    title: 'Contrato de Aluguel',
    category: 'outros',
    storage_path: 'fam-1/doc.pdf',
    file_name: 'contrato.pdf',
    file_size_bytes: 920 * 1024, // 920 KB
    mime_type: 'application/pdf',
    expires_at: null,
    is_shared_with_family: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const sampleImageDoc: FamilyDocument = {
    id: 'doc-img-1',
    family_id: 'fam-1',
    uploaded_by: 'user-1',
    uploaded_by_name: 'Usuário Teste',
    title: 'Comprovante Residência',
    category: 'residencia',
    storage_path: 'fam-1/comprovante.jpg',
    file_name: 'comprovante.jpg',
    file_size_bytes: 11 * 1024, // 11 KB
    mime_type: 'image/jpeg',
    expires_at: null,
    is_shared_with_family: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exibe o subtítulo "PDF • 920 KB" para documento PDF e nunca mostra "Outros"', () => {
    render(
      <DocumentItemCard
        document={samplePdfDoc}
        currentUserId="user-1"
        onOpenViewer={vi.fn()}
        onShare={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    )

    // O título do documento deve estar visível
    expect(screen.getByText('Contrato de Aluguel')).toBeDefined()

    // O subtítulo do cartão deve conter exatamente 'PDF • 920 KB'
    const subtitle = screen.getByText('PDF • 920 KB')
    expect(subtitle).toBeDefined()
    expect(subtitle.className).toContain('text-[10px]')
    expect(subtitle.className).toContain('text-[#64748B]')
    expect(subtitle.className).toContain('truncate')

    // O texto "Outros" NÃO deve existir no documento
    expect(screen.queryByText(/Outros/i)).toBeNull()
  })

  it('aciona onShare ao clicar no botão de compartilhar do cartão', () => {
    const onShareMock = vi.fn()
    render(
      <DocumentItemCard
        document={samplePdfDoc}
        currentUserId="user-1"
        onOpenViewer={vi.fn()}
        onShare={onShareMock}
        onRequestDelete={vi.fn()}
      />,
    )

    const shareBtn = screen.getByTitle('Compartilhar documento')
    shareBtn.click()
    expect(onShareMock).toHaveBeenCalledWith(samplePdfDoc)
  })

  it('exibe o subtítulo "JPEG • 11 KB" para documento de imagem e nunca mostra a categoria interna', () => {
    render(
      <DocumentItemCard
        document={sampleImageDoc}
        currentUserId="user-1"
        onOpenViewer={vi.fn()}
        onShare={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    )

    expect(screen.getByText('Comprovante Residência')).toBeDefined()

    // O subtítulo deve conter exatamente 'JPEG • 11 KB'
    const subtitle = screen.getByText('JPEG • 11 KB')
    expect(subtitle).toBeDefined()
    expect(subtitle.className).toContain('text-[10px]')
    expect(subtitle.className).toContain('text-[#64748B]')

    // Categoria 'residencia' ou 'Outros' não aparece como rótulo no subtítulo
    expect(screen.queryByText(/Residência •/i)).toBeNull()
    expect(screen.queryByText(/Outros/i)).toBeNull()
  })

  it('renderiza a thumbnail da 1ª página do PDF quando gerada com sucesso', async () => {
    const mockDataUrl = 'data:image/jpeg;base64,mockPdfThumbnailBase64'
    vi.mocked(pdfThumbnailModule.renderPdfFirstPageThumbnail).mockResolvedValue(mockDataUrl)

    render(
      <DocumentItemCard
        document={samplePdfDoc}
        currentUserId="user-1"
        onOpenViewer={vi.fn()}
        onShare={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    )

    await waitFor(() => {
      const img = screen.getByAltText('Contrato de Aluguel') as HTMLImageElement
      expect(img).toBeDefined()
      expect(img.src).toBe(mockDataUrl)
    })
  })

  it('faz fallback gracioso para o ícone de PDF quando a renderização falha, sem quebrar a grade', async () => {
    vi.mocked(pdfThumbnailModule.renderPdfFirstPageThumbnail).mockRejectedValue(
      new Error('PDF corrompido ou erro de rede'),
    )

    render(
      <DocumentItemCard
        document={samplePdfDoc}
        currentUserId="user-1"
        onOpenViewer={vi.fn()}
        onShare={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    )

    await waitFor(() => {
      // Quando falha, não renderiza tag <img> com mockDataUrl, exibe badge PDF
      expect(screen.queryByAltText('Contrato de Aluguel')).toBeNull()
      expect(screen.getByText('PDF')).toBeDefined()
    })
  })
})
