import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { VoiceTransactionDialog } from '../VoiceTransactionDialog'

// Mocks do hook useFamily e useToast
const mockTriggerRefresh = vi.fn()
const mockAddNewSubcategory = vi.fn()
const mockToast = vi.fn()
const mockCreateTransaction = vi.fn()
const mockParseVoiceWithAi = vi.fn()

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'fam-1', name: 'Família Silva' },
    members: [{ id: 'mem-1', name: 'Carlos' }],
    currentMember: { id: 'mem-1', name: 'Carlos' },
    categories: [
      {
        id: 'cat-1',
        name: 'Alimentação',
        type: 'expense',
        budget_bucket: 'essential',
        subcategories: [{ id: 'sub-1', name: 'Almoço' }],
      },
      { id: 'cat-2', name: 'Salário', type: 'income', budget_bucket: 'essential' },
    ],
    triggerRefresh: mockTriggerRefresh,
    addNewSubcategory: mockAddNewSubcategory,
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock('@/services/transactions', () => ({
  createTransaction: (...args: any[]) => mockCreateTransaction(...args),
}))

vi.mock('@/services/voice-ai', () => ({
  parseVoiceWithAi: (...args: any[]) => mockParseVoiceWithAi(...args),
}))

describe('VoiceTransactionDialog', () => {
  let mockGetUserMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock response: Sucesso
    mockParseVoiceWithAi.mockImplementation(async ({ texto }: { texto: string }) => {
      return {
        rawText: texto,
        amountCents: 4500,
        amountFormatted: 'R$ 45,00',
        type: 'expense',
        description: 'Almoço',
        paymentMethod: 'debito',
        categoryNameSuggestion: 'Alimentação',
        subcategoryNameSuggestion: 'Restaurante',
        bucketSuggestion: 'lifestyle',
        confidence: 0.95,
        processingSource: 'openai',
        aiStatus: 'sucesso',
        clarificationQuestion: null,
        clarificationOptions: null,
        friendlyMessage: null,
      }
    })

    mockGetUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
      configurable: true,
    })
  })

  it('NÃO chama getUserMedia ao abrir o diálogo nem ao gravar (SpeechRecognition gerencia nativamente)', async () => {
    class MockSpeechRecognition {
      lang = ''
      continuous = false
      interimResults = false
      maxAlternatives = 1
      onstart: any = null
      onresult: any = null
      onerror: any = null
      onend: any = null
      start() {
        if (this.onstart) this.onstart()
      }
      stop() {
        if (this.onend) this.onend()
      }
      abort() {}
    }

    ;(window as any).SpeechRecognition = MockSpeechRecognition

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    // Aguarda montagem
    await waitFor(() => {
      expect(screen.getByText(/Ouvindo\.\.\. fale agora/i)).toBeDefined()
    })

    // Confirma que getUserMedia NUNCA foi chamado
    expect(mockGetUserMedia).not.toHaveBeenCalled()
  })

  it('configura o SpeechRecognition com pt-BR, continuous=false, interimResults=true e maxAlternatives=1', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: false,
        interimResults: false,
        maxAlternatives: 1,
        onstart: null as any,
        onaudiostart: null as any,
        onspeechstart: null as any,
        onresult: null as any,
        onerror: null as any,
        onend: null as any,
        start() {
          if (self.onstart) self.onstart()
        },
        stop() {
          if (self.onend) self.onend()
        },
        abort() {},
      }
      capturedRecognitionInstance = self
      return self
    }

    ;(window as any).SpeechRecognition = MockSpeechRecognition

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(capturedRecognitionInstance).toBeTruthy()
      expect(capturedRecognitionInstance.lang).toBe('pt-BR')
      expect(capturedRecognitionInstance.continuous).toBe(false)
      expect(capturedRecognitionInstance.interimResults).toBe(true)
      expect(capturedRecognitionInstance.maxAlternatives).toBe(1)
    })
  })

  it('atualiza estado visual para "Gravando som detectado..." quando onaudiostart ou onspeechstart dispara', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: false,
        interimResults: false,
        maxAlternatives: 1,
        onstart: null as any,
        onaudiostart: null as any,
        onspeechstart: null as any,
        onresult: null as any,
        onerror: null as any,
        onend: null as any,
        start() {
          if (self.onstart) self.onstart()
        },
        stop() {
          if (self.onend) self.onend()
        },
        abort() {},
      }
      capturedRecognitionInstance = self
      return self
    }

    ;(window as any).SpeechRecognition = MockSpeechRecognition

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(capturedRecognitionInstance).toBeTruthy()
    })

    // Dispara onaudiostart
    capturedRecognitionInstance.onaudiostart()

    await waitFor(() => {
      expect(screen.getByText('Gravando som detectado...')).toBeDefined()
    })
  })

  it('captura fala em tempo real via onresult com Array.from e preenche a caixinha de texto', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: false,
        interimResults: false,
        maxAlternatives: 1,
        onstart: null as any,
        onaudiostart: null as any,
        onspeechstart: null as any,
        onresult: null as any,
        onerror: null as any,
        onend: null as any,
        start() {
          if (self.onstart) self.onstart()
        },
        stop() {
          if (self.onend) self.onend()
        },
        abort() {},
      }
      capturedRecognitionInstance = self
      return self
    }

    ;(window as any).SpeechRecognition = MockSpeechRecognition

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(capturedRecognitionInstance).toBeTruthy()
    })

    // Simula evento onresult com resultados parciais
    capturedRecognitionInstance.onresult({
      results: [[{ transcript: 'Almoço 45 reais no débito' }]],
    })

    await waitFor(() => {
      expect(screen.getByText(/Almoço 45 reais no débito/i)).toBeDefined()
      const input = screen.getByPlaceholderText('Ex: Almoço 45 reais no débito') as HTMLInputElement
      expect(input.value).toBe('Almoço 45 reais no débito')
    })
  })

  it('trata erro no-speech de forma amigável sem fechar o diálogo e mantendo o microfone re-clicável', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: false,
        interimResults: false,
        maxAlternatives: 1,
        onstart: null as any,
        onaudiostart: null as any,
        onspeechstart: null as any,
        onresult: null as any,
        onerror: null as any,
        onend: null as any,
        start() {
          if (self.onstart) self.onstart()
        },
        stop() {
          if (self.onend) self.onend()
        },
        abort() {},
      }
      capturedRecognitionInstance = self
      return self
    }

    ;(window as any).SpeechRecognition = MockSpeechRecognition

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(capturedRecognitionInstance).toBeTruthy()
    })

    // Simula erro no-speech
    capturedRecognitionInstance.onerror({ error: 'no-speech' })

    await waitFor(() => {
      expect(
        screen.getByText(
          'Não consegui te ouvir. Toque no microfone novamente e fale um pouco mais perto.',
        ),
      ).toBeDefined()
    })

    // Diálogo continua aberto e o botão para falar novamente está disponível
    expect(screen.getByTitle('Toque para começar a falar')).toBeDefined()
  })

  it('ao disparar onend com texto capturado, invoca a IA e exibe card de sucesso com confirmação', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: false,
        interimResults: false,
        maxAlternatives: 1,
        onstart: null as any,
        onaudiostart: null as any,
        onspeechstart: null as any,
        onresult: null as any,
        onerror: null as any,
        onend: null as any,
        start() {
          if (self.onstart) self.onstart()
        },
        stop() {
          if (self.onend) self.onend()
        },
        abort() {},
      }
      capturedRecognitionInstance = self
      return self
    }

    ;(window as any).SpeechRecognition = MockSpeechRecognition

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(capturedRecognitionInstance).toBeTruthy()
    })

    // Simula captura de fala
    capturedRecognitionInstance.onresult({
      results: [[{ transcript: 'Almoço 45 reais no débito' }]],
    })

    // Simula término da fala
    capturedRecognitionInstance.onend()

    await waitFor(() => {
      expect(mockParseVoiceWithAi).toHaveBeenCalledWith(
        expect.objectContaining({
          texto: 'Almoço 45 reais no débito',
        }),
      )
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
      expect(screen.getByText('Ajustar')).toBeDefined()
      expect(screen.getByText('R$ 45,00')).toBeDefined()
    })
  })

  it('comportamento "clarificacao": exibe pergunta empática da IA e 3 pílulas clicáveis', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'pindamonhangaba 8 reais',
      amountCents: 800,
      amountFormatted: 'R$ 8,00',
      type: 'expense',
      description: 'Pindamonhangaba',
      paymentMethod: null,
      categoryNameSuggestion: 'Outro',
      bucketSuggestion: 'lifestyle',
      confidence: 0.7,
      processingSource: 'openai',
      aiStatus: 'clarificacao',
      clarificationQuestion: 'O que foi Pindamonhangaba?',
      clarificationOptions: ['Transporte / Passagem', 'Alimentação / Doce', 'Lazer / Passeio'],
      friendlyMessage: 'Entendi R$ 8,00! Mas o que foi Pindamonhangaba?',
    })

    ;(window as any).SpeechRecognition = undefined
    ;(window as any).webkitSpeechRecognition = undefined

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Ex: Almoço 45 reais no débito')
    fireEvent.change(input, { target: { value: 'pindamonhangaba 8 reais' } })
    fireEvent.click(screen.getByText('Processar com IA'))

    await waitFor(() => {
      expect(screen.getByText('Entendi R$ 8,00! Mas o que foi Pindamonhangaba?')).toBeDefined()
      expect(screen.getByText('Transporte / Passagem')).toBeDefined()
      expect(screen.getByText('Alimentação / Doce')).toBeDefined()
      expect(screen.getByText('Lazer / Passeio')).toBeDefined()
    })

    // Clicar na pílula "Transporte / Passagem" completa o card para sucesso
    fireEvent.click(screen.getByText('Transporte / Passagem'))

    await waitFor(() => {
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
      expect(screen.getByText('R$ 8,00')).toBeDefined()
    })
  })

  it('comportamento "invalido": exibe mensagem amigável e botão [ 🎤 Tentar Novamente ]', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'abobrinha voadora',
      amountCents: 0,
      amountFormatted: 'R$ 0,00',
      type: 'expense',
      description: 'abobrinha voadora',
      confidence: 0.1,
      processingSource: 'openai',
      aiStatus: 'invalido',
      clarificationQuestion: null,
      clarificationOptions: null,
      friendlyMessage:
        'Não consegui entender esse lançamento financeiro. Tente falar algo como: "Almoço 45 reais".',
    })

    ;(window as any).SpeechRecognition = undefined
    ;(window as any).webkitSpeechRecognition = undefined

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Ex: Almoço 45 reais no débito')
    fireEvent.change(input, { target: { value: 'abobrinha voadora' } })
    fireEvent.click(screen.getByText('Processar com IA'))

    await waitFor(() => {
      expect(screen.getByText('Não consegui entender esse lançamento')).toBeDefined()
      expect(
        screen.getByText(
          'Não consegui entender esse lançamento financeiro. Tente falar algo como: "Almoço 45 reais".',
        ),
      ).toBeDefined()
      expect(screen.getByText('🎤 Tentar Novamente')).toBeDefined()
    })
  })

  it('exibe badge "✨ GPT-4o Mini Ativo" quando a resposta vem da OpenAI', async () => {
    ;(window as any).SpeechRecognition = undefined
    ;(window as any).webkitSpeechRecognition = undefined

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Ex: Almoço 45 reais no débito')
    fireEvent.change(input, { target: { value: 'Almoço 45 reais' } })
    fireEvent.click(screen.getByText('Processar com IA'))

    await waitFor(() => {
      expect(screen.getByText(/✨ GPT-4o Mini Ativo/i)).toBeDefined()
    })
  })

  it('exibe badge "⚠️ Fallback Local" e mensagem de erro detalhada quando chamada à OpenAI falha', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'Almoço 45 reais',
      amountCents: 4500,
      amountFormatted: 'R$ 45,00',
      type: 'expense',
      description: 'Almoço',
      paymentMethod: undefined,
      categoryNameSuggestion: 'Alimentação',
      subcategoryNameSuggestion: undefined,
      bucketSuggestion: 'lifestyle',
      confidence: 0.8,
      processingSource: 'local',
      aiStatus: 'sucesso',
      clarificationQuestion: null,
      clarificationOptions: null,
      friendlyMessage: null,
      aiError: 'Erro OpenAI: chave inválida ou não configurada (HTTP 401)',
    })

    ;(window as any).SpeechRecognition = undefined
    ;(window as any).webkitSpeechRecognition = undefined

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Ex: Almoço 45 reais no débito')
    fireEvent.change(input, { target: { value: 'Almoço 45 reais' } })
    fireEvent.click(screen.getByText('Processar com IA'))

    await waitFor(() => {
      expect(screen.getByText(/⚠️ Fallback Local/i)).toBeDefined()
      expect(
        screen.getByText(/Erro OpenAI: chave inválida ou não configurada \(HTTP 401\)/i),
      ).toBeDefined()
      expect(
        screen.getByText(
          /Processamos seu lançamento via parser local para não interromper seu fluxo/i,
        ),
      ).toBeDefined()
    })
  })

  it('salva lançamento via createTransaction quando usuário clica em "✅ Confirmar Lançamento"', async () => {
    mockCreateTransaction.mockResolvedValueOnce({ id: 'tx-1' })

    ;(window as any).SpeechRecognition = undefined
    ;(window as any).webkitSpeechRecognition = undefined

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Ex: Almoço 45 reais no débito')
    fireEvent.change(input, { target: { value: 'Supermercado 150 reais no débito' } })
    fireEvent.click(screen.getByText('Processar com IA'))

    await waitFor(() => {
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
    })

    fireEvent.click(screen.getByText('✅ Confirmar Lançamento'))

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          family_id: 'fam-1',
          type: 'expense',
          amount_cents: 4500,
          description: expect.stringContaining('Almoço'),
        }),
      )
      expect(mockTriggerRefresh).toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Lançamento registrado com sucesso'),
        }),
      )
    })
  })
})
