import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentExplorerGrid } from '../DocumentExplorerGrid'
import { FamilyDocument } from '@/services/family-documents'
import * as familyDocsModule from '@/services/family-documents'

vi.mock('@/services/family-documents', async () => {
  const actual = await vi.importActual<typeof import('@/services/family-documents')>(
    '@/services/family-documents',
  )
  return {
    ...actual,
    fetchFamilyDocuments: vi.fn(),
    shareDocumentFileOrLink: vi.fn(),
    shareMultipleDocuments: vi.fn(),
    getDocumentSignedUrl: vi.fn().mockImplementation((path: string) => {
      return Promise.resolve(`https://signed.url/${path}`)
    }),
  }
})

describe('DocumentExplorerGrid - Seleção múltipla e compartilhamento em lote', () => {
  const mockDocs: FamilyDocument[] = [
    {
      id: 'doc-1',
      family_id: 'fam-1',
      uploaded_by: 'user-1',
      uploaded_by_name: 'Usuário',
      title: 'RG Matheus',
      category: 'identidade',
      storage_path: 'fam-1/rg.jpg',
      file_name: 'rg.jpg',
      file_size_bytes: 200 * 1024,
      mime_type: 'image/jpeg',
      expires_at: null,
      is_shared_with_family: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'doc-2',
      family_id: 'fam-1',
      uploaded_by: 'user-1',
      uploaded_by_name: 'Usuário',
      title: 'Certidão Casamento',
      category: 'familia',
      storage_path: 'fam-1/certidao.pdf',
      file_name: 'certidao.pdf',
      file_size_bytes: 500 * 1024,
      mime_type: 'application/pdf',
      expires_at: null,
      is_shared_with_family: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'doc-3',
      family_id: 'fam-1',
      uploaded_by: 'user-1',
      uploaded_by_name: 'Usuário',
      title: 'Comprovante Residência',
      category: 'residencia',
      storage_path: 'fam-1/residencia.pdf',
      file_name: 'residencia.pdf',
      file_size_bytes: 350 * 1024,
      mime_type: 'application/pdf',
      expires_at: null,
      is_shared_with_family: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(familyDocsModule.fetchFamilyDocuments).mockResolvedValue(mockDocs)
  })

  it('renderiza os documentos e NÃO exibe o botão "Selecionar vários" no cabeçalho', async () => {
    render(
      <DocumentExplorerGrid
        familyId="fam-1"
        currentUserId="user-1"
        currentUserName="Usuário Teste"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('RG Matheus')).toBeDefined()
      expect(screen.getByText('Certidão Casamento')).toBeDefined()
      expect(screen.getByText('Comprovante Residência')).toBeDefined()
    })

    // Botão "Selecionar vários" / "Selecionar" foi removido conforme solicitação
    expect(screen.queryByTitle('Selecionar vários documentos para compartilhar')).toBeNull()
    expect(screen.queryByText('Selecionar vários')).toBeNull()
  })

  it('entra no modo de seleção via long press (~500ms) no cartão, exibe contador e botões de ação', async () => {
    vi.useFakeTimers()

    render(
      <DocumentExplorerGrid
        familyId="fam-1"
        currentUserId="user-1"
        currentUserName="Usuário Teste"
      />,
    )

    // Aguarda o término da Promise de fetchFamilyDocuments
    await vi.waitFor(() => {
      expect(screen.getByText('RG Matheus')).toBeDefined()
    })

    const card1 = screen.getByTestId('doc-card-doc-1')

    // Dispara touchstart para iniciar o timer de long press
    fireEvent.touchStart(card1, { touches: [{ clientX: 100, clientY: 100 }] })
    vi.advanceTimersByTime(550)

    // Barra de modo de seleção deve surgir com 1 selecionado (o cartão que sofreu long press)
    const selectionBar = screen.getByTestId('selection-mode-bar')
    expect(selectionBar).toBeDefined()
    expect(screen.getByText('1 selecionado')).toBeDefined()

    // Botão Selecionar tudo presente
    const selectAllBtn = screen.getByText('Selecionar tudo')
    expect(selectAllBtn).toBeDefined()

    // Clicar em "Selecionar tudo" seleciona todos os 3 documentos
    fireEvent.click(selectAllBtn)
    expect(screen.getByText('3 selecionados')).toBeDefined()

    // Clicar no X cancela e fecha o modo de seleção
    const cancelBtn = screen.getByLabelText('Cancelar seleção')
    fireEvent.click(cancelBtn)
    expect(screen.queryByTestId('selection-mode-bar')).toBeNull()

    vi.useRealTimers()
  })

  it('suprime contextmenu nativo na grade ao clicar sobre os cartões', async () => {
    render(
      <DocumentExplorerGrid
        familyId="fam-1"
        currentUserId="user-1"
        currentUserName="Usuário Teste"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('RG Matheus')).toBeDefined()
    })

    const grid = screen.getByTestId('documents-grid')
    const card = screen.getByTestId('doc-card-doc-1')

    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    })
    const preventDefaultSpy = vi.spyOn(contextMenuEvent, 'preventDefault')

    card.dispatchEvent(contextMenuEvent)
    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('aciona shareMultipleDocuments com os documentos selecionados ao clicar em Compartilhar', async () => {
    vi.mocked(familyDocsModule.shareMultipleDocuments).mockResolvedValue({
      method: 'clipboard-links',
      success: true,
      count: 2,
      publicUrls: ['https://curiangoo.com/doc/1', 'https://curiangoo.com/doc/2'],
    })

    vi.useFakeTimers()

    render(
      <DocumentExplorerGrid
        familyId="fam-1"
        currentUserId="user-1"
        currentUserName="Usuário Teste"
      />,
    )

    await vi.waitFor(() => {
      expect(screen.getByText('RG Matheus')).toBeDefined()
    })

    // Entra no modo de seleção via long press no cartão 1
    const card1 = screen.getByTestId('doc-card-doc-1')
    fireEvent.touchStart(card1, { touches: [{ clientX: 100, clientY: 100 }] })
    vi.advanceTimersByTime(550)

    expect(screen.getByText('1 selecionado')).toBeDefined()

    // No modo de seleção ativo, tocar no cartão 2 adiciona-o à seleção
    const card2 = screen.getByTestId('doc-card-doc-2')
    // No modo de seleção, tocar/clicar seleciona
    const card2Button = screen.getByRole('button', {
      name: 'Visualizar documento Certidão Casamento',
    })
    fireEvent.click(card2Button)

    expect(screen.getByText('2 selecionados')).toBeDefined()

    // Clica no botão Compartilhar da barra
    const shareBatchBtn = screen.getByRole('button', { name: /Compartilhar/i })
    fireEvent.click(shareBatchBtn)

    await vi.waitFor(() => {
      expect(familyDocsModule.shareMultipleDocuments).toHaveBeenCalledWith(
        [mockDocs[0], mockDocs[1]],
        '24h',
      )
    })

    vi.useRealTimers()
  })
})
