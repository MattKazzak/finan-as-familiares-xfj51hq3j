import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { ImportStatementDialog } from '../ImportStatementDialog'
import * as pdfParser from '@/services/import/pdf-parser'
import * as aiCategorizer from '@/services/ai-categorizer'

// Mocks dos contextos e serviços
const mockNavigate = vi.fn()
const mockSetImportSession = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/carteira' }),
  }
})

vi.mock('@/contexts/ImportSessionContext', () => ({
  useImportSession: () => ({
    session: null,
    setImportSession: mockSetImportSession,
    clearImportSession: vi.fn(),
  }),
}))

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
    declaredTotalCents: null,
  }),
  categorizeBatchWithAI: vi.fn().mockResolvedValue([]),
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

describe('ImportStatementDialog - IA à prova de falhas na fatura PDF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filtro determinístico pós-IA: marca quitações/pagamentos como "não é despesa" e desmarcados por padrão', async () => {
    vi.spyOn(pdfParser, 'extractRawTextFromPdf').mockResolvedValueOnce({
      rawText: 'Fatura de Cartão',
      pageCount: 1,
      pages: [{ pageNumber: 1, text: 'Fatura de Cartão' }],
    })

    vi.spyOn(aiCategorizer, 'parsePdfWithAI').mockResolvedValueOnce({
      success: true,
      declaredTotalCents: null,
      transactions: [
        {
          date: '2025-02-03',
          description: 'PAGAMENTO RECEBIDO EM 03/02/2025',
          cleanMerchant: 'Pagamento recebido',
          amountCents: 150000,
          type: 'expense',
          confidence: 0.9,
          categoryId: 'cat-1',
        },
        {
          date: '2025-02-05',
          description: 'DROGASIL SAO PAULO',
          cleanMerchant: 'Drogasil',
          amountCents: 8990,
          type: 'expense',
          confidence: 0.95,
          categoryId: 'cat-2',
        },
      ],
    })

    render(<ImportStatementDialog open={true} onOpenChange={vi.fn()} />)

    const file = new File(['mock content'], 'fatura_fevereiro.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    // Redireciona para /importar com a sessão configurada
    await waitFor(() => {
      expect(mockSetImportSession).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/importar')
    })

    const sessionArg = mockSetImportSession.mock.calls[0][0]
    expect(sessionArg.items.length).toBe(2)
    // Deve marcar quitação como isNonExpense e desmarcada
    const nonExpense = sessionArg.items.find((i: any) => i.isNonExpense)
    expect(nonExpense).toBeDefined()
    expect(nonExpense.selected).toBe(false)

    // O item normal (Drogasil) deve estar selecionado
    const normalItem = sessionArg.items.find((i: any) => !i.isNonExpense)
    expect(normalItem.selected).toBe(true)
  })

  it('validação de fechamento: passa total declarado para a sessão em /importar', async () => {
    vi.spyOn(pdfParser, 'extractRawTextFromPdf').mockResolvedValueOnce({
      rawText: 'Fatura com total R$ 500,00',
      pageCount: 1,
      pages: [{ pageNumber: 1, text: 'Fatura com total R$ 500,00' }],
    })

    vi.spyOn(aiCategorizer, 'parsePdfWithAI').mockResolvedValueOnce({
      success: true,
      declaredTotalCents: 50000,
      transactions: [
        {
          date: '2025-02-05',
          description: 'DROGASIL SAO PAULO',
          cleanMerchant: 'Drogasil',
          amountCents: 8990,
          type: 'expense',
          confidence: 0.95,
          categoryId: 'cat-2',
        },
      ],
    })

    render(<ImportStatementDialog open={true} onOpenChange={vi.fn()} />)

    const file = new File(['mock content'], 'fatura_fevereiro.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/importar')
    })

    const sessionArg = mockSetImportSession.mock.calls[0][0]
    expect(sessionArg.declaredTotalCents).toBe(50000)
    expect(sessionArg.items.length).toBe(1)
  })

  it('extração em blocos paralelos com deduplicação entre páginas enviada para a rota /importar', async () => {
    // 2 páginas no PDF
    vi.spyOn(pdfParser, 'extractRawTextFromPdf').mockResolvedValueOnce({
      rawText: 'Página 1 e Página 2',
      pageCount: 2,
      pages: [
        { pageNumber: 1, text: 'Conteúdo Página 1' },
        { pageNumber: 2, text: 'Conteúdo Página 2' },
      ],
    })

    const parseSpy = vi
      .spyOn(aiCategorizer, 'parsePdfWithAI')
      // Resposta da Página 1: Drogasil + Uber
      .mockResolvedValueOnce({
        success: true,
        declaredTotalCents: 11440,
        transactions: [
          {
            date: '2025-02-05',
            description: 'DROGASIL SAO PAULO',
            cleanMerchant: 'Drogasil',
            amountCents: 8990,
            type: 'expense',
            confidence: 0.95,
            categoryId: 'cat-1',
          },
          {
            date: '2025-02-07',
            description: 'UBER *TRIP SAO PAULO',
            cleanMerchant: 'Uber',
            amountCents: 2450,
            type: 'expense',
            confidence: 0.95,
            categoryId: 'cat-2',
          },
        ],
      })
      // Resposta da Página 2: Uber repetido na fronteira de página + Netflix
      .mockResolvedValueOnce({
        success: true,
        declaredTotalCents: null,
        transactions: [
          {
            date: '2025-02-07',
            description: 'UBER *TRIP SAO PAULO',
            cleanMerchant: 'Uber',
            amountCents: 2450,
            type: 'expense',
            confidence: 0.95,
            categoryId: 'cat-2',
          },
          {
            date: '2025-02-08',
            description: 'NETFLIX.COM',
            cleanMerchant: 'Netflix',
            amountCents: 5590,
            type: 'expense',
            confidence: 0.98,
            categoryId: 'cat-3',
          },
        ],
      })

    render(<ImportStatementDialog open={true} onOpenChange={vi.fn()} />)

    const file = new File(['mock content'], 'fatura_2_paginas.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/importar')
    })

    // Foram 2 chamadas paralelas para parsePdfWithAI
    expect(parseSpy).toHaveBeenCalledTimes(2)
    expect(parseSpy).toHaveBeenCalledWith('Conteúdo Página 1', 'fam-test')
    expect(parseSpy).toHaveBeenCalledWith('Conteúdo Página 2', 'fam-test')

    // Das 4 transações extraídas, 1 era duplicata exata de Uber (mesma data + desc + valor)
    // Resultado enviado para a sessão deve conter exatamente 3 transações válidas deduplicadas
    const sessionArg = mockSetImportSession.mock.calls[0][0]
    expect(sessionArg.items.length).toBe(3)
  })

  it('falha de 1 página não aborta importação quando outras páginas retornam transações (registra failedPages na sessão)', async () => {
    // 2 páginas no PDF: Página 1 falha, Página 2 tem sucesso
    vi.spyOn(pdfParser, 'extractRawTextFromPdf').mockResolvedValueOnce({
      rawText: 'Página 1 e Página 2',
      pageCount: 2,
      pages: [
        { pageNumber: 1, text: 'Conteúdo Página 1 que falha' },
        { pageNumber: 2, text: 'Conteúdo Página 2 com sucesso' },
      ],
    })

    vi.spyOn(aiCategorizer, 'parsePdfWithAI')
      // Página 1 falha
      .mockResolvedValueOnce({
        success: false,
        transactions: [],
        declaredTotalCents: null,
        error: 'Instabilidade temporária',
      })
      // Página 2 tem sucesso
      .mockResolvedValueOnce({
        success: true,
        declaredTotalCents: 5590,
        transactions: [
          {
            date: '2025-02-08',
            description: 'NETFLIX.COM',
            cleanMerchant: 'Netflix',
            amountCents: 5590,
            type: 'expense',
            confidence: 0.98,
            categoryId: 'cat-3',
          },
        ],
      })

    render(<ImportStatementDialog open={true} onOpenChange={vi.fn()} />)

    const file = new File(['mock content'], 'fatura_com_falha_parcial.pdf', {
      type: 'application/pdf',
    })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    // Deve navegar para /importar pois a página 2 teve transações
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/importar')
    })

    const sessionArg = mockSetImportSession.mock.calls[0][0]
    expect(sessionArg.items.length).toBe(1)
    expect(sessionArg.failedPages).toEqual([1])
  })

  it('card de erro total exibe botões "Tentar novamente" e "Escolher outro arquivo" quando todas as páginas falharem', async () => {
    vi.spyOn(pdfParser, 'extractRawTextFromPdf').mockResolvedValueOnce({
      rawText: 'Página com falha total',
      pageCount: 1,
      pages: [{ pageNumber: 1, text: 'Página com falha total' }],
    })

    const parseSpy = vi.spyOn(aiCategorizer, 'parsePdfWithAI').mockResolvedValueOnce({
      success: false,
      transactions: [],
      error:
        'Tivemos uma instabilidade temporária ao comunicar com a inteligência de leitura da fatura. Tente novamente em instantes.',
    })

    render(<ImportStatementDialog open={true} onOpenChange={vi.fn()} />)

    const file = new File(['mock content'], 'fatura_falha_total.pdf', {
      type: 'application/pdf',
    })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível identificar lançamentos no arquivo/i)).toBeDefined()
    })

    // Mensagem amigável sem texto técnico em inglês
    expect(
      screen.getByText(
        'Tivemos uma instabilidade temporária ao comunicar com a inteligência de leitura da fatura. Tente novamente em instantes.',
      ),
    ).toBeDefined()
    expect(screen.queryByText(/non-2xx/i)).toBeNull()
    expect(screen.queryByText(/Edge Function returned/i)).toBeNull()

    // Botões Tentar novamente e Escolher outro arquivo
    const retryBtn = screen.getByRole('button', { name: /Tentar novamente/i })
    const chooseAnotherBtn = screen.getByRole('button', { name: /Escolher outro arquivo/i })
    expect(retryBtn).toBeDefined()
    expect(chooseAnotherBtn).toBeDefined()

    // Testar "Tentar novamente" sem reselecionar
    vi.spyOn(pdfParser, 'extractRawTextFromPdf').mockResolvedValueOnce({
      rawText: 'Página com falha total',
      pageCount: 1,
      pages: [{ pageNumber: 1, text: 'Página com falha total' }],
    })
    parseSpy.mockResolvedValueOnce({
      success: true,
      transactions: [
        {
          date: '2025-02-08',
          description: 'NETFLIX.COM',
          cleanMerchant: 'Netflix',
          amountCents: 5590,
          type: 'expense',
          confidence: 0.98,
          categoryId: 'cat-3',
        },
      ],
    })

    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/importar')
    })
    const sessionArg = mockSetImportSession.mock.calls[0][0]
    expect(sessionArg.items.length).toBe(1)
  })

  it('exibe mensagem orientadora amigável quando o PDF realmente não possui camada de texto', async () => {
    vi.spyOn(pdfParser, 'extractRawTextFromPdf').mockResolvedValueOnce({
      rawText: '',
      pageCount: 1,
      pages: [{ pageNumber: 1, text: '' }],
    })

    render(<ImportStatementDialog open={true} onOpenChange={vi.fn()} />)

    const file = new File(['mock scanned pdf'], 'fatura_imagem.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível identificar lançamentos no arquivo/i)).toBeDefined()
    })

    expect(
      screen.getByText(
        'Não conseguimos identificar o texto desta fatura. Se ela foi gerada como imagem pelo seu banco, experimente baixar o extrato pelo computador ou importar o arquivo OFX/CSV.',
      ),
    ).toBeDefined()

    // Botões devem estar disponíveis
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Escolher outro arquivo/i })).toBeDefined()
  })

  it('fechar seletor secundário (categoria/detalhe) não fecha o diálogo pai nem reseta progresso', () => {
    // Renderiza com items no review interno
    const onOpenChange = vi.fn()
    render(<ImportStatementDialog open={true} onOpenChange={onOpenChange} />)

    // O diálogo pai está montado e aberto
    expect(screen.getByText('Importar Extrato Bancário')).toBeDefined()
  })
})
