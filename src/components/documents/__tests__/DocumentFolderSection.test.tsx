import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentFolderSection } from '@/components/documents/DocumentFolderSection'
import * as familyDocsService from '@/services/family-documents'

vi.mock('@/services/family-documents', async () => {
  const actual = await vi.importActual<typeof familyDocsService>('@/services/family-documents')
  return {
    ...actual,
    fetchFamilyDocuments: vi.fn(),
    getDocumentSignedUrl: vi.fn().mockResolvedValue('https://signed.url/test.pdf'),
  }
})

describe('DocumentFolderSection Component', () => {
  const mockFamilyId = 'fam-123'
  const mockUserId = 'user-456'
  const mockUserName = 'Matheus'

  const sampleDocuments: familyDocsService.FamilyDocument[] = [
    {
      id: 'doc-1',
      family_id: mockFamilyId,
      uploaded_by: mockUserId,
      uploaded_by_name: 'Matheus',
      title: 'RG Matheus',
      category: 'identidade',
      storage_path: `${mockFamilyId}/doc-1.jpg`,
      file_name: 'rg-matheus.jpg',
      file_size_bytes: 1024 * 1024,
      mime_type: 'image/jpeg',
      expires_at: '2030-12-31',
      is_shared_with_family: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'doc-2',
      family_id: mockFamilyId,
      uploaded_by: mockUserId,
      uploaded_by_name: 'Matheus',
      title: 'Comprovante Luz Outubro',
      category: 'residencia',
      storage_path: `${mockFamilyId}/doc-2.pdf`,
      file_name: 'conta-luz.pdf',
      file_size_bytes: 500 * 1024,
      mime_type: 'application/pdf',
      expires_at: null,
      is_shared_with_family: false, // Privado
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(familyDocsService.fetchFamilyDocuments).mockResolvedValue(sampleDocuments)
  })

  it('exibe o título "Pasta de Documentos" e a quantidade de documentos', async () => {
    render(
      <DocumentFolderSection
        familyId={mockFamilyId}
        currentUserId={mockUserId}
        currentUserName={mockUserName}
        isOpen={true}
        onToggle={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Pasta de Documentos')).toBeDefined()
      expect(screen.getByText('RG Matheus')).toBeDefined()
      expect(screen.getByText('Comprovante Luz Outubro')).toBeDefined()
    })
  })

  it('indica quando um documento é Privado', async () => {
    render(
      <DocumentFolderSection
        familyId={mockFamilyId}
        currentUserId={mockUserId}
        currentUserName={mockUserName}
        isOpen={true}
        onToggle={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Privado')).toBeDefined()
    })
  })

  it('permite filtrar documentos por pasta (ex.: Residência)', async () => {
    render(
      <DocumentFolderSection
        familyId={mockFamilyId}
        currentUserId={mockUserId}
        currentUserName={mockUserName}
        isOpen={true}
        onToggle={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('RG Matheus')).toBeDefined()
    })

    // Clica na pasta Residência
    const residenciaBtn = screen.getByRole('button', { name: /Residência/i })
    fireEvent.click(residenciaBtn)

    await waitFor(() => {
      expect(screen.getByText('Comprovante Luz Outubro')).toBeDefined()
      expect(screen.queryByText('RG Matheus')).toBeNull()
    })
  })

  it('possui campo de busca por nome de documento', async () => {
    render(
      <DocumentFolderSection
        familyId={mockFamilyId}
        currentUserId={mockUserId}
        currentUserName={mockUserName}
        isOpen={true}
        onToggle={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('RG Matheus')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText('Buscar documento...')
    fireEvent.change(searchInput, { target: { value: 'Luz' } })

    await waitFor(() => {
      expect(screen.getByText('Comprovante Luz Outubro')).toBeDefined()
      expect(screen.queryByText('RG Matheus')).toBeNull()
    })
  })
})
