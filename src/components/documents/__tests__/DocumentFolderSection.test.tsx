import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import DocumentsPage from '@/pages/DocumentsPage'
import ProfilePage from '@/pages/Profile'
import * as familyDocsService from '@/services/family-documents'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-456', email: 'familiasilva@exemplo.com' },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'fam-123', name: 'Silva', monthly_net_income_cents: 800000, avatar_url: null },
    members: [{ id: 'm-1', name: 'Matheus', is_admin: true }],
    categories: [],
    currentMember: { id: 'm-1', name: 'Matheus', is_admin: true },
    activeMemberId: 'm-1',
    openWhoIsUsing: vi.fn(),
    addMember: vi.fn(),
    editMember: vi.fn(),
    removeMember: vi.fn(),
    updateFamily: vi.fn(),
    uploadFamilyAvatar: vi.fn(),
    triggerRefresh: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-pwa-install', () => ({
  usePwaInstall: () => ({
    isStandalone: false,
    isIos: false,
    hasNativePrompt: true,
    deferredPrompt: null,
    triggerInstall: vi.fn(),
    isDismissed: true,
  }),
}))

vi.mock('@/components/wallet/ApplyBudgetModelDialog', () => ({
  ApplyBudgetModelDialog: () => null,
}))

vi.mock('@/services/family-documents', async () => {
  const actual = await vi.importActual<typeof familyDocsService>('@/services/family-documents')
  return {
    ...actual,
    fetchFamilyDocuments: vi.fn(),
    getDocumentSignedUrl: vi.fn().mockResolvedValue('https://signed.url/test.pdf'),
  }
})

describe('Documentos no Perfil e DocumentsPage', () => {
  const mockFamilyId = 'fam-123'
  const mockUserId = 'user-456'

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

  it('no Profile, Documentos aparece como acordeão e navega para /perfil/documentos ao clicar', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    // O acordeão de Documentos deve estar presente no Perfil
    const docSection = screen.getByRole('region', { name: 'Pasta de Documentos' })
    expect(docSection).toBeDefined()

    // O botão do acordeão exibe o título "Documentos"
    const docButton = screen.getByRole('button', { name: /Documentos/i })
    expect(docButton).toBeDefined()

    // Não deve renderizar a grade embutida no Perfil (o card solto anterior)
    expect(screen.queryByTestId('documents-grid')).toBeNull()

    // Ao clicar, aciona navegação para a página de documentos
    fireEvent.click(docButton)
    expect(mockNavigate).toHaveBeenCalledWith('/perfil/documentos')
  })

  it('exibe resumo de contagem de documentos no item do acordeão', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      // 2 documentos cadastrados
      expect(screen.getByText(/2 documentos cadastrados/i)).toBeDefined()
    })
  })

  it('DocumentsPage renderiza a grade estilo Windows Explorer com botão Adicionar e os cartões', async () => {
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>,
    )

    // Botão voltar presente
    expect(screen.getByRole('button', { name: /Voltar ao Perfil/i })).toBeDefined()

    await waitFor(() => {
      // Título e botão Adicionar na grade
      expect(screen.getByRole('button', { name: /Adicionar/i })).toBeDefined()
      expect(screen.getByText('RG Matheus')).toBeDefined()
      expect(screen.getByText('Comprovante Luz Outubro')).toBeDefined()

      const grid = screen.getByTestId('documents-grid')
      expect(grid).toBeDefined()
      expect(grid.className).toContain('grid-cols-2')

      // Os cartões individuais
      expect(screen.getByTestId('doc-card-doc-1')).toBeDefined()
      expect(screen.getByTestId('doc-card-doc-2')).toBeDefined()

      // Indica quando é privado
      expect(screen.getByText('Privado')).toBeDefined()

      // Ações embaixo do cartão
      expect(screen.getByLabelText('Visualizar RG Matheus')).toBeDefined()
      expect(screen.getByLabelText('Compartilhar RG Matheus')).toBeDefined()
      expect(screen.getByLabelText('Mais opções para RG Matheus')).toBeDefined()
    })
  })

  it('DocumentsPage botão Voltar navega de volta para /perfil', () => {
    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>,
    )

    const backButton = screen.getByRole('button', { name: /Voltar ao Perfil/i })
    fireEvent.click(backButton)
    expect(mockNavigate).toHaveBeenCalledWith('/perfil')
  })
})
