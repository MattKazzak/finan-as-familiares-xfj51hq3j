import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { ImportStatementDialog } from '../ImportStatementDialog'
import * as pdfParser from '@/services/import/pdf-parser'

// Mocks dos contextos e serviços
vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'fam-test', name: 'Família Teste' },
    members: [{ id: 'mem-1', name: 'Membro 1', is_admin: true }],
    categories: [],
    addNewCategory: vi.fn(),
    triggerRefresh: vi.fn(),
    setLastImportSummary: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}))

vi.mock('@/services/transactions', () => ({
  fetchTransactions: vi.fn().mockResolvedValue([]),
  createTransactionsBatch: vi.fn().mockResolvedValue([]),
  updateTransaction: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/services/categorization-rules', () => ({
  fetchCategorizationRules: vi.fn().mockResolvedValue([]),
  upsertCategorizationRule: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/services/ai-categorizer', () => ({
  parsePdfWithAI: vi.fn().mockResolvedValue({
    success: true,
    transactions: [],
  }),
}))

describe('ImportStatementDialog - PDF com senha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exibe alerta amigável de fatura protegida por senha e formulário de desbloqueio quando o PDF pede senha', async () => {
    // Simula pdfjs lançando PasswordException / No password given
    vi.spyOn(pdfParser, 'extractRawTextFromPdf').mockRejectedValueOnce({
      name: 'PasswordException',
      message: 'No password given',
      code: 1,
    })

    const onOpenChange = vi.fn()
    render(<ImportStatementDialog open={true} onOpenChange={onOpenChange} />)

    const file = new File(['%PDF-1.4 mock content'], 'fatura_cartao.pdf', {
      type: 'application/pdf',
    })

    const input =
      (screen.getByRole('textbox', { hidden: true }) as HTMLInputElement) ||
      (document.querySelector('input[type="file"]') as HTMLInputElement)

    fireEvent.change(input, { target: { files: [file] } })

    // Deve exibir mensagem amigável e NÃO o erro técnico bruto "No password given"
    await waitFor(() => {
      expect(screen.getByText('Esta fatura é protegida por senha')).toBeDefined()
    })
    expect(screen.queryByText('No password given')).toBeNull()

    // Campo de senha e botões devem estar visíveis
    expect(screen.getByPlaceholderText('Digite a senha da fatura')).toBeDefined()
    expect(screen.getByRole('button', { name: /Desbloquear e Continuar/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Escolher outro arquivo/i })).toBeDefined()
  })

  it('permite alternar visibilidade da senha (mostrar/ocultar)', async () => {
    vi.spyOn(pdfParser, 'extractRawTextFromPdf').mockRejectedValueOnce({
      name: 'PasswordException',
      message: 'No password given',
    })

    render(<ImportStatementDialog open={true} onOpenChange={vi.fn()} />)

    const file = new File(['%PDF-1.4 mock'], 'fatura.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Digite a senha da fatura')).toBeDefined()
    })

    const passwordInput = screen.getByPlaceholderText(
      'Digite a senha da fatura',
    ) as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    const toggleBtn = screen.getByLabelText(/Ver senha/i)
    fireEvent.click(toggleBtn)

    expect(passwordInput.type).toBe('text')

    const hideBtn = screen.getByLabelText(/Ocultar senha/i)
    fireEvent.click(hideBtn)

    expect(passwordInput.type).toBe('password')
  })

  it('exibe "Senha incorreta. Tente novamente." se a senha informada falhar', async () => {
    const extractSpy = vi
      .spyOn(pdfParser, 'extractRawTextFromPdf')
      // 1ª chamada sem senha
      .mockRejectedValueOnce({
        name: 'PasswordException',
        message: 'No password given',
      })
      // 2ª chamada com senha errada
      .mockRejectedValueOnce({
        name: 'PasswordException',
        message: 'Incorrect password',
        code: 2,
      })

    render(<ImportStatementDialog open={true} onOpenChange={vi.fn()} />)

    const file = new File(['%PDF-1.4 mock'], 'fatura.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Digite a senha da fatura')).toBeDefined()
    })

    const passwordInput = screen.getByPlaceholderText('Digite a senha da fatura')
    fireEvent.change(passwordInput, { target: { value: 'senha123' } })

    const submitBtn = screen.getByRole('button', { name: /Desbloquear e Continuar/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Senha incorreta. Tente novamente.')).toBeDefined()
    })

    expect(extractSpy).toHaveBeenCalledTimes(2)
    expect(extractSpy).toHaveBeenLastCalledWith(file, { password: 'senha123' })
  })

  it('cancela e volta ao estado normal ao clicar em "Escolher outro arquivo"', async () => {
    vi.spyOn(pdfParser, 'extractRawTextFromPdf').mockRejectedValueOnce({
      name: 'PasswordException',
      message: 'No password given',
    })

    render(<ImportStatementDialog open={true} onOpenChange={vi.fn()} />)

    const file = new File(['%PDF-1.4 mock'], 'fatura.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Esta fatura é protegida por senha')).toBeDefined()
    })

    const cancelBtn = screen.getByRole('button', { name: /Escolher outro arquivo/i })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByText('Esta fatura é protegida por senha')).toBeNull()
      expect(screen.queryByPlaceholderText('Digite a senha da fatura')).toBeNull()
    })
  })
})
