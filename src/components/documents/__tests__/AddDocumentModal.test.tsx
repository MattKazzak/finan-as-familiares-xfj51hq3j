import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddDocumentModal } from '../AddDocumentModal'
import * as familyDocsService from '@/services/family-documents'

vi.mock('@/services/family-documents', async () => {
  const actual = await vi.importActual<typeof familyDocsService>('@/services/family-documents')
  return {
    ...actual,
    uploadFamilyDocument: vi.fn(),
  }
})

describe('AddDocumentModal', () => {
  const mockFamilyId = 'fam-123'
  const mockUploadedByName = 'Matheus'
  const mockOnSuccess = vi.fn()
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('não renderiza o bloco "Pasta de Organização" nem os botões de categorias', () => {
    render(
      <AddDocumentModal
        open={true}
        onOpenChange={mockOnOpenChange}
        familyId={mockFamilyId}
        uploadedByName={mockUploadedByName}
        onSuccess={mockOnSuccess}
      />,
    )

    // O label do bloco removido não deve existir no DOM
    expect(screen.queryByText('Pasta de Organização')).toBeNull()

    // Botões ou descrições específicas das pastas não devem existir no formulário
    expect(screen.queryByText('Documentos pessoais civis')).toBeNull()
    expect(screen.queryByText('Atos civis e certidões familiares')).toBeNull()
    expect(screen.queryByText('Comprovantes e moradia')).toBeNull()
    expect(screen.queryByText('Convênios e prontuários')).toBeNull()
    expect(screen.queryByText('Diversos e profissionais')).toBeNull()

    // O bloco de Data de Validade também não deve existir no DOM
    expect(screen.queryByText('Data de Validade')).toBeNull()
    expect(screen.queryByText('Avisa na lista quando estiver perto de vencer')).toBeNull()

    // Mas os outros elementos continuam presentes
    expect(screen.getByText('Como deseja adicionar?')).toBeDefined()
    expect(screen.getByText('Tirar Foto')).toBeDefined()
    expect(screen.getByText('Importar')).toBeDefined()
    expect(screen.getByText('Escanear')).toBeDefined()
    expect(screen.getByLabelText(/Nome do documento/i)).toBeDefined()
    expect(screen.getByText('Compartilhado com a família')).toBeDefined()
  })

  it('salva o documento usando a categoria padrão "outros" silenciosamente', async () => {
    const fakeDoc: familyDocsService.FamilyDocument = {
      id: 'doc-999',
      family_id: mockFamilyId,
      uploaded_by: 'user-1',
      uploaded_by_name: mockUploadedByName,
      title: 'Nota Fiscal Geladeira',
      category: 'outros',
      storage_path: `${mockFamilyId}/doc-999.pdf`,
      file_name: 'nf-geladeira.pdf',
      file_size_bytes: 1024,
      mime_type: 'application/pdf',
      expires_at: null,
      is_shared_with_family: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    vi.mocked(familyDocsService.uploadFamilyDocument).mockResolvedValue(fakeDoc)

    render(
      <AddDocumentModal
        open={true}
        onOpenChange={mockOnOpenChange}
        familyId={mockFamilyId}
        uploadedByName={mockUploadedByName}
        onSuccess={mockOnSuccess}
      />,
    )

    // Simula seleção de arquivo via input
    const testFile = new File(['dummy-content'], 'nf-geladeira.pdf', { type: 'application/pdf' })
    const fileInputs = document.querySelectorAll('input[type="file"]')
    const importInput = fileInputs[1] as HTMLInputElement // o segundo é o fileInputRef de importar arquivo

    fireEvent.change(importInput, { target: { files: [testFile] } })

    // O título é pré-preenchido automaticamente a partir do nome do arquivo
    const titleInput = screen.getByLabelText(/Nome do documento/i) as HTMLInputElement
    expect(titleInput.value).toBe('Nf geladeira')

    // Altera o título para um valor desejado
    fireEvent.change(titleInput, { target: { value: 'Nota Fiscal Geladeira' } })

    // Clica em salvar
    const submitBtn = screen.getByRole('button', { name: /Salvar na Pasta/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(familyDocsService.uploadFamilyDocument).toHaveBeenCalledWith({
        familyId: mockFamilyId,
        file: testFile,
        fileName: 'nf-geladeira.pdf',
        mimeType: 'application/pdf',
        title: 'Nota Fiscal Geladeira',
        category: 'outros',
        expiresAt: null,
        isSharedWithFamily: true,
        uploadedByName: mockUploadedByName,
      })
      expect(mockOnSuccess).toHaveBeenCalledWith(fakeDoc)
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('permite especificar um defaultCategory customizado silencioso se fornecido via props', async () => {
    const fakeDoc: familyDocsService.FamilyDocument = {
      id: 'doc-888',
      family_id: mockFamilyId,
      uploaded_by: 'user-1',
      uploaded_by_name: mockUploadedByName,
      title: 'Comprovante Aluguel',
      category: 'residencia',
      storage_path: `${mockFamilyId}/doc-888.pdf`,
      file_name: 'aluguel.pdf',
      file_size_bytes: 2048,
      mime_type: 'application/pdf',
      expires_at: null,
      is_shared_with_family: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    vi.mocked(familyDocsService.uploadFamilyDocument).mockResolvedValue(fakeDoc)

    render(
      <AddDocumentModal
        open={true}
        onOpenChange={mockOnOpenChange}
        familyId={mockFamilyId}
        uploadedByName={mockUploadedByName}
        defaultCategory="residencia"
        onSuccess={mockOnSuccess}
      />,
    )

    const testFile = new File(['dummy-content'], 'aluguel.pdf', { type: 'application/pdf' })
    const fileInputs = document.querySelectorAll('input[type="file"]')
    const importInput = fileInputs[1] as HTMLInputElement

    fireEvent.change(importInput, { target: { files: [testFile] } })

    const titleInput = screen.getByLabelText(/Nome do documento/i)
    fireEvent.change(titleInput, { target: { value: 'Comprovante Aluguel' } })

    const submitBtn = screen.getByRole('button', { name: /Salvar na Pasta/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(familyDocsService.uploadFamilyDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'residencia',
        }),
      )
    })
  })
})
