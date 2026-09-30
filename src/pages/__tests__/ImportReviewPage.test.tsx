import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ImportReviewPage from '@/pages/ImportReviewPage'
import { ImportSessionProvider, useImportSession } from '@/contexts/ImportSessionContext'
import type { ReviewItem } from '@/components/transactions/ImportStatementDialog'

// Mocks
const mockTriggerRefresh = vi.fn()
const mockSetLastImportSummary = vi.fn()
const mockCreateTransactionsBatch = vi.fn().mockResolvedValue([])
const mockUpdateTransaction = vi.fn().mockResolvedValue({})
const mockUpsertCategorizationRule = vi.fn().mockResolvedValue({})

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'fam-test', name: 'Família Teste' },
    members: [{ id: 'mem-1', name: 'Membro 1', is_admin: true }],
    categories: [
      {
        id: 'cat-alimentacao',
        name: 'Alimentação',
        color: '#10B981',
        icon: 'Utensils',
        type: 'expense',
        subcategories: [{ id: 'sub-delivery', name: 'Delivery' }],
      },
      {
        id: 'cat-transporte',
        name: 'Transporte',
        color: '#3B82F6',
        icon: 'Car',
        type: 'expense',
        subcategories: [],
      },
    ],
    addNewCategory: vi.fn(),
    triggerRefresh: mockTriggerRefresh,
    setLastImportSummary: mockSetLastImportSummary,
  }),
}))

vi.mock('@/services/transactions', () => ({
  createTransactionsBatch: (...args: any[]) => mockCreateTransactionsBatch(...args),
  updateTransaction: (...args: any[]) => mockUpdateTransaction(...args),
}))

vi.mock('@/services/categorization-rules', () => ({
  upsertCategorizationRule: (...args: any[]) => mockUpsertCategorizationRule(...args),
}))

const mockInitialItems: ReviewItem[] = [
  {
    id: 'item-1',
    date: '2025-02-10',
    description: 'IFOOD *BURGER KING',
    amount_cents: 4500,
    type: 'expense',
    selected: true,
    category_id: null,
    subcategory_id: null,
    member_id: 'mem-1',
    isDuplicate: false,
    source: 'ai_suggestion',
    aiConfidence: 0.6,
  },
  {
    id: 'item-2',
    date: '2025-02-11',
    description: 'IFOOD *PIZZARIA BELLA',
    amount_cents: 6200,
    type: 'expense',
    selected: true,
    category_id: null,
    subcategory_id: null,
    member_id: 'mem-1',
    isDuplicate: false,
    source: 'ai_suggestion',
    aiConfidence: 0.5,
  },
  {
    id: 'item-3',
    date: '2025-02-12',
    description: 'SALARIO EMPRESA',
    amount_cents: 500000,
    type: 'income',
    selected: true,
    category_id: null,
    subcategory_id: null,
    member_id: 'mem-1',
    isDuplicate: false,
  },
]

// Componente auxiliar para injetar itens na sessão de teste
const SessionPopulator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setImportSession } = useImportSession()

  React.useEffect(() => {
    setImportSession({
      items: mockInitialItems,
      fileInfo: { name: 'fatura_teste.pdf', size: 1024, format: 'Fatura PDF' },
      declaredTotalCents: null,
      failedPages: [],
      sourceRoute: '/carteira',
    })
  }, [setImportSession])

  return <>{children}</>
}

describe('ImportReviewPage - Tela de Trabalho de Revisão', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('renderiza os lançamentos e o rodapé fixo de confirmação com totais calculados', async () => {
    render(
      <MemoryRouter initialEntries={['/importar']}>
        <ImportSessionProvider>
          <SessionPopulator>
            <Routes>
              <Route path="/importar" element={<ImportReviewPage />} />
            </Routes>
          </SessionPopulator>
        </ImportSessionProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Revisão de Importação')).toBeDefined()
    })

    // Lista de lançamentos
    expect(screen.getByText('IFOOD *BURGER KING')).toBeDefined()
    expect(screen.getByText('SALARIO EMPRESA')).toBeDefined()

    // Rodapé fixo
    expect(screen.getByText(/3 de 3 lançamentos selecionados/i)).toBeDefined()
    expect(screen.getByText(/Importar 3 lançamentos/i)).toBeDefined()
  })

  it('permite filtrar por lançamentos sem categoria e por incerteza de IA', async () => {
    render(
      <MemoryRouter initialEntries={['/importar']}>
        <ImportSessionProvider>
          <SessionPopulator>
            <Routes>
              <Route path="/importar" element={<ImportReviewPage />} />
            </Routes>
          </SessionPopulator>
        </ImportSessionProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Revisão de Importação')).toBeDefined()
    })

    // Clica no filtro "IA Incerta"
    const uncertainBtn = screen.getByRole('button', { name: /IA Incerta/i })
    fireEvent.click(uncertainBtn)

    // Ambos os iFood tinham confiança < 0.85
    expect(screen.getByText('IFOOD *BURGER KING')).toBeDefined()
    expect(screen.getByText('IFOOD *PIZZARIA BELLA')).toBeDefined()
    // O salário (income sem source ai_suggestion) deve ser filtrado
    expect(screen.queryByText('SALARIO EMPRESA')).toBeNull()
  })

  it('permite aplicar categoria a semelhantes (mesmo estabelecimento) de uma vez só', async () => {
    render(
      <MemoryRouter initialEntries={['/importar']}>
        <ImportSessionProvider>
          <SessionPopulator>
            <Routes>
              <Route path="/importar" element={<ImportReviewPage />} />
            </Routes>
          </SessionPopulator>
        </ImportSessionProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('IFOOD *BURGER KING')).toBeDefined()
    })

    // Clica no primeiro item para selecioná-lo para o editor
    fireEvent.click(screen.getByText('IFOOD *BURGER KING'))

    // Altera categoria do item 1 para Alimentação
    // Selecionamos o trigger de categoria
    const categorySelects = screen.getAllByRole('combobox')
    // No editor desktop, o select de categoria é o segundo (após membro)
    const catSelectTrigger = categorySelects.find(
      (s) =>
        s.textContent?.includes('Pendente de categoria') ||
        s.textContent?.includes('Sem categoria'),
    )

    if (catSelectTrigger) {
      fireEvent.click(catSelectTrigger)
      const alimentacaoOption = await screen.findByRole('option', { name: /Alimentação/i })
      fireEvent.click(alimentacaoOption)
    }

    // O card de "Aplicar a semelhantes" deve aparecer mostrando que há 1 outro lançamento iFood semelhante
    await waitFor(() => {
      expect(screen.getByText(/1 outro lançamento semelhante/i)).toBeDefined()
    })

    const applySimilarBtn = screen.getByRole('button', {
      name: /Aplicar a todos os 1 semelhantes/i,
    })
    fireEvent.click(applySimilarBtn)

    // Mensagem de sucesso do similar
    await waitFor(() => {
      expect(screen.getByText(/✓ Categoria aplicada aos lançamentos semelhantes!/i)).toBeDefined()
    })
  })

  it('grava no banco e limpa sessão ao confirmar importação', async () => {
    render(
      <MemoryRouter initialEntries={['/importar']}>
        <ImportSessionProvider>
          <SessionPopulator>
            <Routes>
              <Route path="/importar" element={<ImportReviewPage />} />
              <Route path="/carteira" element={<div>Tela da Carteira</div>} />
            </Routes>
          </SessionPopulator>
        </ImportSessionProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Importar 3 lançamentos/i)).toBeDefined()
    })

    const confirmBtn = screen.getByRole('button', { name: /Importar 3 lançamentos/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockCreateTransactionsBatch).toHaveBeenCalledTimes(1)
      expect(mockTriggerRefresh).toHaveBeenCalled()
      expect(mockSetLastImportSummary).toHaveBeenCalled()
    })

    // Deve redirecionar para /carteira
    await waitFor(() => {
      expect(screen.getByText('Tela da Carteira')).toBeDefined()
    })
  })
})
