import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CopilotPage } from '../Copilot'
import * as CopilotService from '@/services/copilot'
import * as VoiceAiService from '@/services/voice-ai'

// Mocks do router
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}))

// Mocks do contexto de família
vi.mock('@hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'fam-test-1', name: 'Família Teste' },
    currentMember: { id: 'mem-1', name: 'Membro Teste', role: 'admin' },
    categories: [
      {
        id: 'cat-1',
        name: 'Alimentação',
        color: '#FFC629',
        icon: 'Utensils',
        subcategories: [
          { id: 'sub-1', name: 'Restaurante', category_id: 'cat-1' },
          { id: 'sub-2', name: 'Supermercado', category_id: 'cat-1' },
        ],
      },
      {
        id: 'cat-2',
        name: 'Transporte',
        color: '#14213D',
        icon: 'Car',
        subcategories: [{ id: 'sub-3', name: 'Combustível', category_id: 'cat-2' }],
      },
    ],
    refreshTransactions: vi.fn(),
  }),
}))

vi.mock('@hooks/use-value-privacy', () => ({
  useValuePrivacy: () => ({
    formatValue: (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`,
    privacyEnabled: false,
    togglePrivacy: vi.fn(),
  }),
}))

vi.mock('@services/copilot', () => ({
  fetchCopilotMessages: vi.fn().mockResolvedValue([]),
  fetchCopilotMessagesWithHasMore: vi.fn().mockResolvedValue({ messages: [], hasMore: false }),
  saveCopilotMessage: vi.fn().mockResolvedValue({ id: 'msg-saved-1' }),
}))

vi.mock('@services/voice-ai', () => ({
  parseVoiceWithAi: vi.fn(),
}))

vi.mock('@services/transactions', () => ({
  createTransaction: vi.fn().mockResolvedValue({ id: 'tx-created-1' }),
}))

describe('CopilotPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(CopilotService.fetchCopilotMessages as any).mockResolvedValue([])
    ;(CopilotService.fetchCopilotMessagesWithHasMore as any).mockResolvedValue({
      messages: [],
      hasMore: false,
    })
  })

  it('renderiza CopilotTypingBubble durante processamento da mensagem e oculta quando concluído', async () => {
    let resolveAi: any
    ;(VoiceAiService.parseVoiceWithAi as any).mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveAi = res
        }),
    )

    render(<CopilotPage />)

    const input = screen.getByPlaceholderText(/Pergunte algo ou lance um gasto.../i)
    fireEvent.change(input, { target: { value: 'Comprei café por 12 reais' } })
    fireEvent.click(screen.getByRole('button', { name: /Enviar mensagem/i }))

    // CopilotTypingBubble exibido (apenas pássaro + reticências, sem texto)
    await waitFor(() => {
      expect(
        screen.queryByTestId('copilot-typing-bubble') ||
          screen.queryByTestId('copilot-typing-indicator'),
      ).toBeDefined()
      expect(screen.queryByTestId('copilot-typing-dots')).toBeDefined()
    })

    // Conclui processamento
    resolveAi({
      rawText: 'Comprei café por 12 reais',
      amountCents: 1200,
      amountFormatted: 'R$ 12,00',
      type: 'expense',
      description: 'Café',
      confidence: 0.95,
      processingSource: 'openai',
      aiStatus: 'sucesso',
      categoryNameSuggestion: 'Alimentação',
      subcategoryNameSuggestion: 'Restaurante',
      bucketSuggestion: 'lifestyle',
      friendlyMessage: 'Lançado R$ 12,00 em Café!',
    })

    await waitFor(() => {
      expect(screen.queryByTestId('copilot-typing-indicator')).toBeNull()
      expect(screen.getByText('Lançado R$ 12,00 em Café!')).toBeDefined()
    })
  })

  it('exibe botão "Carregar mensagens mais antigas" quando hasMore for true e carrega lote anterior preservando mensagens', async () => {
    const initialBatch = [
      {
        id: 'msg-2',
        family_id: 'fam-test-1',
        user_id: 'usr-1',
        role: 'user' as const,
        content: 'Segunda mensagem recente',
        card_type: null,
        created_at: '2026-03-30T12:00:00.000Z',
      },
    ]

    const olderBatch = [
      {
        id: 'msg-1',
        family_id: 'fam-test-1',
        user_id: 'usr-1',
        role: 'user' as const,
        content: 'Primeira mensagem antiga',
        card_type: null,
        created_at: '2026-03-30T11:00:00.000Z',
      },
    ]

    ;(CopilotService.fetchCopilotMessagesWithHasMore as any)
      .mockResolvedValueOnce({ messages: initialBatch, hasMore: true })
      .mockResolvedValueOnce({ messages: olderBatch, hasMore: false })

    render(<CopilotPage />)

    // Aguarda carregar mensagens iniciais
    await waitFor(() => {
      expect(screen.getByText('Segunda mensagem recente')).toBeDefined()
    })

    // Botão de carregar mais antigas deve estar visível
    const loadOlderBtn = screen.getByTestId('load-older-messages-button')
    expect(loadOlderBtn).toBeDefined()
    expect(loadOlderBtn.textContent).toContain('Carregar mensagens mais antigas')

    // Clica para carregar mensagens antigas
    fireEvent.click(loadOlderBtn)

    await waitFor(() => {
      expect(screen.getByText('Primeira mensagem antiga')).toBeDefined()
      expect(screen.getByText('Segunda mensagem recente')).toBeDefined()
    })

    // Botão some quando não há mais mensagens antigas (hasMore: false)
    await waitFor(() => {
      expect(screen.queryByTestId('load-older-messages-button')).toBeNull()
    })
  })

  it('exibe CategoryHighlightChip com badge "sugestão incerta" para transações com baixa confiança (< 0.6)', async () => {
    ;(VoiceAiService.parseVoiceWithAi as any).mockResolvedValueOnce({
      rawText: 'uber mercado 32 reais',
      amountCents: 3200,
      amountFormatted: 'R$ 32,00',
      type: 'expense',
      description: 'Uber Mercado',
      confidence: 0.42, // < 0.6 => incerta
      processingSource: 'openai',
      aiStatus: 'sucesso',
      categoryNameSuggestion: 'Transporte',
      subcategoryNameSuggestion: 'Combustível',
      bucketSuggestion: 'essential',
      friendlyMessage: 'Lançamento registrado com baixa certeza',
    })

    render(<CopilotPage />)

    const input = screen.getByPlaceholderText(/Pergunte algo ou lance um gasto.../i)
    fireEvent.change(input, { target: { value: 'uber mercado 32 reais' } })
    fireEvent.click(screen.getByRole('button', { name: /Enviar mensagem/i }))

    await waitFor(() => {
      // CategoryHighlightChip renderizado
      expect(screen.getByTestId('category-highlight-chip')).toBeDefined()
      // Badge de incerteza presente
      expect(screen.getByTestId('uncertain-suggestion-badge')).toBeDefined()
      expect(screen.getByText('sugestão incerta')).toBeDefined()
    })
  })
})
