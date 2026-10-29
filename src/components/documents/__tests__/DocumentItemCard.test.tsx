import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DocumentItemCard } from '../DocumentItemCard'
import { FamilyDocument } from '@/services/family-documents'

vi.mock('@/services/family-documents', async () => {
  const actual = await vi.importActual<typeof import('@/services/family-documents')>(
    '@/services/family-documents',
  )
  return {
    ...actual,
    getDocumentSignedUrl: vi.fn().mockResolvedValue('https://signed.url/image.jpg'),
  }
})

describe('DocumentItemCard', () => {
  const sampleDoc: FamilyDocument = {
    id: 'doc-card-test',
    family_id: 'fam-1',
    uploaded_by: 'user-1',
    uploaded_by_name: 'Usuário Teste',
    title: 'Contrato de Aluguel',
    category: 'outros',
    storage_path: 'fam-1/doc.pdf',
    file_name: 'contrato.pdf',
    file_size_bytes: 11 * 1024, // 11 KB
    mime_type: 'application/pdf',
    expires_at: null,
    is_shared_with_family: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  it('exibe apenas o tamanho do arquivo no subtítulo e não exibe "Outros"', () => {
    render(
      <DocumentItemCard
        document={sampleDoc}
        currentUserId="user-1"
        onOpenViewer={vi.fn()}
        onShare={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    )

    // O título do documento deve estar visível
    expect(screen.getByText('Contrato de Aluguel')).toBeDefined()

    // O subtítulo do cartão deve conter exatamente '11 KB'
    const sizeSubtitle = screen.getByText('11 KB')
    expect(sizeSubtitle).toBeDefined()
    expect(sizeSubtitle.className).toContain('text-[10px]')
    expect(sizeSubtitle.className).toContain('text-[#64748B]')
    expect(sizeSubtitle.className).toContain('truncate')

    // O texto "Outros" NÃO deve existir no documento
    expect(screen.queryByText(/Outros/i)).toBeNull()
    expect(screen.queryByText(/Outros • 11 KB/i)).toBeNull()
  })
})
