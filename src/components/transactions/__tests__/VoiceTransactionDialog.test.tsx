import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { VoiceTransactionDialog } from '../VoiceTransactionDialog'

// Mocks do hook useFamily e useToast
const mockTriggerRefresh = vi.fn()
const mockAddNewCategory = vi.fn()
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
    addNewCategory: mockAddNewCategory,
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

describe('VoiceTransactionDialog (Curiangoo Copilot Mini-Chat)', () => {
  let mockGetUserMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Garantir consentimento prévio nos testes existentes de VoiceTransactionDialog
    localStorage.setItem(
      'curiangoo_ai_consent',
      JSON.stringify({ consented: true, consentedAt: new Date().toISOString() }),
    )

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

    await waitFor(() => {
      expect(screen.getByText(/Ouvindo\.\.\. pode falar no seu ritmo/i)).toBeDefined()
    })

    expect(mockGetUserMedia).not.toHaveBeenCalled()
  })

  it('configura o SpeechRecognition com pt-BR, continuous=false (evita loop no mobile), interimResults=true e maxAlternatives=1', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: true,
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

  it('exibe mensagem humanizada "Ouvindo... pode falar no seu ritmo" e controles de rodapé sempre visíveis', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: true,
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

    capturedRecognitionInstance.onaudiostart()

    await waitFor(() => {
      expect(screen.getByText('Ouvindo... pode falar no seu ritmo')).toBeDefined()
      // Botão central do microfone e campo de texto com botão Enviar presentes no rodapé
      expect(screen.getByTitle('Toque para concluir')).toBeDefined()
      expect(screen.getByPlaceholderText('Fale no microfone ou digite aqui...')).toBeDefined()
      expect(screen.getByText('Enviar')).toBeDefined()
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

    capturedRecognitionInstance.onerror({ error: 'no-speech' })

    await waitFor(() => {
      expect(
        screen.getByText(
          'Não consegui te ouvir. Toque no microfone novamente e fale um pouco mais perto.',
        ),
      ).toBeDefined()
    })

    expect(screen.getByTitle('Toque para começar a falar')).toBeDefined()
  })

  it('ao disparar onend com texto capturado via parada manual do microfone, invoca a IA e exibe balão com card verde de confirmação', async () => {
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

    // Fala do usuário
    capturedRecognitionInstance.onresult({
      results: [[{ transcript: 'Almoço 45 reais no débito' }]],
    })

    // Usuário clica no microfone para concluir
    const micButton = screen.getByTitle('Toque para concluir')
    fireEvent.click(micButton)

    await waitFor(() => {
      expect(mockParseVoiceWithAi).toHaveBeenCalledWith(
        expect.objectContaining({
          texto: 'Almoço 45 reais no débito',
        }),
      )
      // Balão do usuário à direita com o texto falado
      expect(screen.getByText('Almoço 45 reais no débito')).toBeDefined()
      // Mensagem conversacional com micro-link discreto [Desfazer]
      expect(screen.getByText(/Lançado: R\$ 45,00 em Geral/i)).toBeDefined()
      expect(screen.getByText('[Desfazer]')).toBeDefined()
    })
  })

  it('comportamento "clarificacao": exibe pergunta empática da IA e pílulas clicáveis', async () => {
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'pindamonhangaba 8 reais' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(screen.getByText('O que foi Pindamonhangaba?')).toBeDefined()
      expect(screen.getByText('Transporte / Passagem')).toBeDefined()
      expect(screen.getByText('Alimentação / Doce')).toBeDefined()
      expect(screen.getByText('Lazer / Passeio')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Transporte / Passagem'))

    await waitFor(() => {
      expect(screen.getByText(/Usando categoria existente "Transporte"/i)).toBeDefined()
      expect(screen.getByText('[Desfazer]')).toBeDefined()
    })
  })

  it('comportamento "invalido": exibe mensagem acolhedora exclusivamente em balão de chat, sem card rústico nem botão "Falar Novamente"', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'GPT ormini falando',
      amountCents: 0,
      amountFormatted: 'R$ 0,00',
      type: 'expense',
      description: 'GPT ormini falando',
      confidence: 0.1,
      processingSource: 'openai',
      aiStatus: 'invalido',
      clarificationQuestion: null,
      clarificationOptions: null,
      friendlyMessage:
        "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'",
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'GPT ormini falando' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(
        screen.getByText(
          "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'",
        ),
      ).toBeDefined()
      expect(screen.queryByText(/Falar Novamente/i)).toBeNull()
      expect(screen.queryByTestId('invalid-error-card')).toBeNull()
      expect(screen.queryByText('✅ Confirmar Lançamento')).toBeNull()
    })
  })

  it('eliminação do loop: onend NÃO reinicia o recognition automaticamente (permanece em repouso após encerramento)', async () => {
    let capturedRecognitionInstance: any = null
    let startCallCount = 0

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
          startCallCount++
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
      // Disparo inicial único ao abrir o modal
      expect(startCallCount).toBe(1)
    })

    // Usuário fala frase
    capturedRecognitionInstance.onresult({
      results: [[{ transcript: 'Almoço 35 reais' }]],
    })

    // Navegador dispara onend (ex: fim de fala natural)
    capturedRecognitionInstance.onend()

    // O recognition NUNCA deve ser reiniciado automaticamente (startCallCount permanece 1)
    expect(startCallCount).toBe(1)

    // O texto foi enviado para a IA
    await waitFor(() => {
      expect(mockParseVoiceWithAi).toHaveBeenCalledWith(
        expect.objectContaining({
          texto: 'Almoço 35 reais',
        }),
      )
    })

    // Após resposta da IA, o microfone permanece em repouso
    expect(startCallCount).toBe(1)
    expect(screen.getByText('Microfone pronto')).toBeDefined()
    expect(screen.getByTitle('Toque para começar a falar')).toBeDefined()
  })

  it('no modo "falta_valor", usuário informa o valor e o lançamento é concluído com balão conversacional e link desfazer', async () => {
    // Começa com uma transação em falta_valor
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'almoço no centro',
      amountCents: 0,
      amountFormatted: 'R$ 0,00',
      type: 'expense',
      description: 'Almoço no centro',
      confidence: 0.85,
      processingSource: 'openai',
      aiStatus: 'falta_valor',
      categoryNameSuggestion: 'Alimentação',
      bucketSuggestion: 'essential',
      clarificationQuestion: 'Quanto custou?',
      friendlyMessage: 'Identifiquei Almoço no centro. Quanto custou? 🥐',
    })

    let capturedRecognitionInstance: any = null
    let startCallCount = 0

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
          startCallCount++
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
      expect(startCallCount).toBe(1)
    })

    // Usuário fala primeiro comando sem valor
    capturedRecognitionInstance.onresult({
      results: [[{ transcript: 'almoço no centro' }]],
    })
    capturedRecognitionInstance.onend()

    await waitFor(() => {
      expect(screen.getByText(/Identifiquei Almoço no centro\. Quanto custou\?/i)).toBeDefined()
    })

    // Mock para a resposta da IA com o valor
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: '45 reais',
      amountCents: 4500,
      amountFormatted: 'R$ 45,00',
      type: 'expense',
      description: 'Almoço no centro',
      confidence: 0.95,
      processingSource: 'openai',
      aiStatus: 'sucesso',
      categoryNameSuggestion: 'Alimentação',
      bucketSuggestion: 'essential',
    })

    // Usuário fala "45 reais"
    capturedRecognitionInstance.onresult({
      results: [[{ transcript: '45 reais' }]],
    })

    // Dispara onend (silêncio/fim de fala)
    capturedRecognitionInstance.onend()

    await waitFor(() => {
      // Mensagem conversacional de confirmação
      expect(screen.getByText(/Lançado: R\$ 45,00/i)).toBeDefined()
      expect(screen.getByText('[Desfazer]')).toBeDefined()
    })
  })

  it('garante que nenhum start() é disparado a partir de onend ou timers automáticos (apenas toque explícito ou abertura inicial)', async () => {
    let capturedRecognitionInstance: any = null
    let startCallCount = 0

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
          startCallCount++
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
      expect(startCallCount).toBe(1)
    })

    // Disparar erro ou onend sem texto
    capturedRecognitionInstance.onend()

    // Garantir que permanece em 1 chamada (sem religamento)
    expect(startCallCount).toBe(1)
    expect(screen.getByText('Microfone pronto')).toBeDefined()

    // Ao clicar explicitamente no botão de microfone desligado, dispara nova gravação
    const startMicBtn = screen.getByTitle('Toque para começar a falar')
    fireEvent.click(startMicBtn)
    expect(startCallCount).toBe(2)

    // Encerra novamente
    capturedRecognitionInstance.onend()
    expect(startCallCount).toBe(2)
    expect(screen.getByText('Microfone pronto')).toBeDefined()
  })

  it('processa somente após 1s de silêncio real (silenceTimerRef 1000ms)', async () => {
    vi.useFakeTimers()
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

    expect(capturedRecognitionInstance).toBeTruthy()

    capturedRecognitionInstance.onresult({
      results: [[{ transcript: 'Gasolina 100 reais' }]],
    })

    // Logo após falar, o indicador de silêncio de 1s é ativado
    expect(screen.getByTestId('silence-countdown-badge')).toBeDefined()
    expect(screen.getByTestId('mic-countdown-pill').textContent).toBe('1')

    // Avança 500ms: ainda não deve processar
    vi.advanceTimersByTime(500)
    expect(mockParseVoiceWithAi).not.toHaveBeenCalled()

    // Avança mais 500ms (total 1000ms de silêncio real): dispara o processamento
    vi.advanceTimersByTime(500)

    expect(mockParseVoiceWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        texto: 'Gasolina 100 reais',
      }),
    )

    vi.useRealTimers()
  })

  it('fluxo exato de 2 turnos no mini-chat: fala sem valor → pergunta do assistente → resposta "80" → card verde com mescla', async () => {
    // Turno 1: fala sem valor "duas caixas de cerveja na parada certa"
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'duas caixas de cerveja na parada certa',
      amountCents: 0,
      amountFormatted: 'R$ 0,00',
      type: 'expense',
      description: '2 caixas de cerveja',
      establishment: 'Parada Certa',
      confidence: 0.85,
      processingSource: 'openai',
      aiStatus: 'falta_valor',
      categoryNameSuggestion: 'Estilo de Vida',
      bucketSuggestion: 'lifestyle',
      clarificationQuestion: 'Quanto custou?',
      friendlyMessage: 'Entendi: 2 caixas de cerveja na Parada Certa! 🍻 Mas quanto custou?',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'duas caixas de cerveja na parada certa' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      // 1. Fala do usuário aparece como balão à direita
      expect(screen.getByText('duas caixas de cerveja na parada certa')).toBeDefined()
      // 2. Resposta conversacional do assistente perguntando o valor
      expect(
        screen.getByText(
          /Entendi:\s*2 caixas de cerveja na Parada Certa!\s*🍻\s*Mas quanto custou\?/i,
        ),
      ).toBeDefined()
    })

    // Turno 2: Usuário responde digitando ou falando apenas "80"
    mockParseVoiceWithAi.mockImplementationOnce(async ({ texto, contexto_anterior }) => {
      expect(contexto_anterior).toEqual(
        expect.objectContaining({
          descricao: '2 caixas de cerveja',
          estabelecimento: 'Parada Certa',
        }),
      )
      return {
        rawText: texto,
        amountCents: 8000,
        amountFormatted: 'R$ 80,00',
        type: 'expense',
        description: contexto_anterior?.descricao || '2 caixas de cerveja',
        establishment: contexto_anterior?.estabelecimento || 'Parada Certa',
        categoryNameSuggestion: 'Estilo de Vida',
        bucketSuggestion: 'lifestyle',
        confidence: 0.95,
        processingSource: 'openai',
        aiStatus: 'sucesso',
      }
    })

    // O usuário envia "80" pelo campo do chat do rodapé
    fireEvent.change(input, { target: { value: '80' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      // Mensagem do usuário "80" registrada no chat
      expect(screen.getByText('80')).toBeDefined()
      // Mensagem conversacional confirmando o lançamento com [Desfazer]
      expect(screen.getByText(/Lançado: R\$ 80,00 em Estilo de Vida/i)).toBeDefined()
      expect(screen.getByText('[Desfazer]')).toBeDefined()
    })
  })

  it('suporte a consultas rápidas: pergunta no chat retorna balão direto da IA SEM card de despesa', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'quanto ainda posso gastar esse mês?',
      amountCents: 0,
      amountFormatted: 'R$ 0,00',
      type: 'expense',
      description: 'quanto ainda posso gastar esse mês?',
      confidence: 0.95,
      processingSource: 'openai',
      aiStatus: 'consulta',
      tipoResposta: 'consulta',
      respostaConsulta:
        'Você ainda pode gastar R$ 1.450,00 este mês com base no seu orçamento configurado. O balde de Estilo de Vida tem R$ 420,00 restantes.',
      friendlyMessage:
        'Você ainda pode gastar R$ 1.450,00 este mês com base no seu orçamento configurado.',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'quanto ainda posso gastar esse mês?' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      // Pergunta do usuário à direita
      expect(screen.getByText('quanto ainda posso gastar esse mês?')).toBeDefined()
      // Resposta em texto acolhedora da IA à esquerda
      expect(
        screen.getByText(
          /Você ainda pode gastar R\$ 1\.450,00 este mês com base no seu orçamento configurado/i,
        ),
      ).toBeDefined()
      // NENHUM card de despesa ou confirmação de lançamento foi gerado
      expect(screen.queryByText('✅ Confirmar Lançamento')).toBeNull()
      expect(screen.queryByText('Despesa Detectada')).toBeNull()
      expect(screen.queryByText('Receita Detectada')).toBeNull()
    })
  })

  it('não duplica nem repete trechos cumulativos durante a fala (interim substituído e final cumulativo sem repetição)', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: false,
        interimResults: true,
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

    // Simula a sequência exata de eventos reportada no bug:
    // "testar" -> "testar mesado" -> "testar mesclado em" -> "testar mesclado em duas falas"
    // Com interimResults = true, o navegador dispara sucessivos eventos com o mesmo índice ou adicionando
    capturedRecognitionInstance.onresult({
      results: [Object.assign([{ transcript: 'testar' }], { isFinal: false })],
    })

    // Em tempo real deve exibir provisoriamente "testar"
    await waitFor(() => {
      expect(screen.getByText('“testar”')).toBeDefined()
    })

    capturedRecognitionInstance.onresult({
      results: [Object.assign([{ transcript: 'testar mesado' }], { isFinal: false })],
    })

    // Substituiu o provisório, não duplicou "testartestar"
    await waitFor(() => {
      expect(screen.getByText('“testar mesado”')).toBeDefined()
      expect(screen.queryByText(/testartestar/i)).toBeNull()
    })

    capturedRecognitionInstance.onresult({
      results: [Object.assign([{ transcript: 'testar mesclado em' }], { isFinal: false })],
    })

    await waitFor(() => {
      expect(screen.getByText('“testar mesclado em”')).toBeDefined()
    })

    // Finalização do trecho completo pelo navegador
    capturedRecognitionInstance.onresult({
      results: [
        Object.assign([{ transcript: 'testar mesclado em duas falas' }], { isFinal: true }),
      ],
    })

    await waitFor(() => {
      expect(screen.getByText('“testar mesclado em duas falas”')).toBeDefined()
      expect(screen.queryByText(/testartestartestar/i)).toBeNull()
      expect(screen.queryByText(/mesado/i)).toBeNull()
    })

    // Conclusão manual do usuário
    const micButton = screen.getByTitle('Toque para concluir')
    fireEvent.click(micButton)

    await waitFor(() => {
      expect(mockParseVoiceWithAi).toHaveBeenCalledWith(
        expect.objectContaining({
          texto: 'testar mesclado em duas falas',
        }),
      )
    })
  })

  it('preserva texto anterior sem duplicações quando o recognition reinicia/reabre na mesma escuta', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: false,
        interimResults: true,
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

    // Sessão 1: fala a primeira parte com isFinal = true
    capturedRecognitionInstance.onresult({
      results: [Object.assign([{ transcript: 'testar mesclar' }], { isFinal: true })],
    })

    // O navegador dispara onend (ex: oscilação ou pausa no mobile)
    // O texto foi armazenado no buffer
    capturedRecognitionInstance.onend()

    // O usuário retoma a fala clicando no microfone para continuar
    const startMicBtn = screen.getByTitle('Toque para começar a falar')
    fireEvent.click(startMicBtn)

    // Sessão 2: nova instância ou nova rodada de resultados com interim seguido de final
    capturedRecognitionInstance.onresult({
      results: [Object.assign([{ transcript: 'em duas falas' }], { isFinal: false })],
    })

    // Na tela em tempo real deve unir a primeira parte finalizada com o provisório atual
    await waitFor(() => {
      expect(screen.getByText('“testar mesclar em duas falas”')).toBeDefined()
    })

    // Finaliza a segunda parte
    capturedRecognitionInstance.onresult({
      results: [Object.assign([{ transcript: 'em duas falas' }], { isFinal: true })],
    })

    // Conclusão
    const micButton = screen.getByTitle('Toque para concluir')
    fireEvent.click(micButton)

    await waitFor(() => {
      expect(mockParseVoiceWithAi).toHaveBeenCalledWith(
        expect.objectContaining({
          texto: 'testar mesclar em duas falas',
        }),
      )
    })
  })

  it('(a) "Qual faz mais sentido?" com clarificação pendente NÃO vira categoria, exibe resposta consultiva 50/30/20 e mantém pílulas e pendingTransaction intacta', async () => {
    // 1º turno: fala que gera clarificacao_categoria
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'Manicure 297 e 50',
      amountCents: 29750,
      amountFormatted: 'R$ 297,50',
      type: 'expense',
      description: 'Manicure',
      confidence: 0.85,
      processingSource: 'openai',
      aiStatus: 'clarificacao_categoria',
      categoryNameSuggestion: null,
      subcategoryNameSuggestion: 'Manicure',
      bucketSuggestion: 'lifestyle',
      clarificationQuestion: 'Onde prefere organizar esse lançamento?',
      clarificationOptions: [
        'Cuidados Pessoais (Estilo de Vida)',
        'Manicure › dentro de Lazer (Estilo de Vida)',
      ],
      friendlyMessage: 'Identifiquei R$ 297,50! Onde prefere organizar esse gasto?',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'Manicure 297 e 50' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(
        screen.getByText(/Identifiquei Manicure R\$ 297,50! Onde prefere organizar esse gasto\?/i),
      ).toBeDefined()
      expect(screen.getByText('Cuidados Pessoais (Estilo de Vida)')).toBeDefined()
      expect(screen.getByText('Manicure › dentro de Lazer (Estilo de Vida)')).toBeDefined()
      // Card verde AINDA NÃO deve aparecer
      expect(screen.queryByText('✅ Confirmar Lançamento')).toBeNull()
    })

    // 2º turno: O usuário faz uma pergunta reflexiva / dúvida "Qual faz mais sentido?"
    mockParseVoiceWithAi.mockImplementationOnce(async ({ texto, contexto_anterior }) => {
      expect(texto).toBe('Qual faz mais sentido?')
      expect(contexto_anterior).toEqual(
        expect.objectContaining({
          descricao: 'Manicure',
          valor: 297.5,
          status: 'clarificacao_categoria',
        }),
      )

      return {
        rawText: texto,
        amountCents: 29750,
        amountFormatted: 'R$ 297,50',
        type: 'expense',
        description: 'Manicure',
        confidence: 0.95,
        processingSource: 'openai',
        aiStatus: 'clarificacao_categoria',
        tipoResposta: 'consultoria_categoria',
        intencao: 'consultiva',
        clarificationOptions: [
          'Cuidados Pessoais (Estilo de Vida)',
          'Manicure › dentro de Lazer (Estilo de Vida)',
        ],
        friendlyMessage:
          "Recomendo 'Cuidados Pessoais'! Assim você separa o que é estética/bem-estar dos passeios de 'Lazer' (restaurantes, viagens), facilitando enxergar seu orçamento real no fim do mês. Quer que eu vincule em Cuidados Pessoais ou prefere deixar tudo em Lazer mesmo?",
      }
    })

    fireEvent.change(input, { target: { value: 'Qual faz mais sentido?' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      // Fala do usuário aparece no chat
      expect(screen.getByText('Qual faz mais sentido?')).toBeDefined()
      // Resposta consultiva didática do assistente
      expect(
        screen.getByText(
          /Recomendo 'Cuidados Pessoais'! Assim você separa o que é estética\/bem-estar dos passeios de 'Lazer'/i,
        ),
      ).toBeDefined()
      // JAMAIS cria ou exibe categoria com o texto "Qual faz mais sentido?"
      expect(mockAddNewCategory).not.toHaveBeenCalledWith(
        expect.stringMatching(/Qual faz mais sentido/i),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      )
      // Mantém as pílulas interativas clicáveis disponíveis
      expect(screen.getAllByText('Cuidados Pessoais (Estilo de Vida)').length).toBeGreaterThan(0)
      // O Card Verde de confirmação AINDA NÃO deve ser montado (usuário ainda não bateu o martelo)
      expect(screen.queryByText('✅ Confirmar Lançamento')).toBeNull()
    })
  })

  it('(b) "fechado em cuidados pessoais" após turno consultivo aplica a escolha e monta o card verde', async () => {
    // 1º turno: clarificacao_categoria inicial
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'Manicure 297 e 50',
      amountCents: 29750,
      amountFormatted: 'R$ 297,50',
      type: 'expense',
      description: 'Manicure',
      confidence: 0.85,
      processingSource: 'openai',
      aiStatus: 'clarificacao_categoria',
      categoryNameSuggestion: null,
      subcategoryNameSuggestion: 'Manicure',
      bucketSuggestion: 'lifestyle',
      clarificationQuestion: 'Onde prefere organizar esse lançamento?',
      clarificationOptions: [
        'Cuidados Pessoais (Estilo de Vida)',
        'Manicure › dentro de Lazer (Estilo de Vida)',
      ],
      friendlyMessage: 'Identifiquei R$ 297,50!',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'Manicure 297 e 50' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(screen.getByText('Cuidados Pessoais (Estilo de Vida)')).toBeDefined()
    })

    // 2º turno: O usuário decide "fechado em cuidados pessoais"
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'fechado em cuidados pessoais',
      amountCents: 29750,
      amountFormatted: 'R$ 297,50',
      type: 'expense',
      description: 'Manicure',
      confidence: 0.95,
      processingSource: 'openai',
      aiStatus: 'sucesso',
      tipoResposta: 'transacao',
      intencao: 'escolha_categoria',
      categoryNameSuggestion: 'Cuidados Pessoais (Estilo de Vida)',
      bucketSuggestion: 'lifestyle',
    })

    mockAddNewCategory.mockResolvedValueOnce({
      id: 'cat-cuidados',
      name: 'Cuidados Pessoais',
      type: 'expense',
      budget_bucket: 'lifestyle',
    })

    fireEvent.change(input, { target: { value: 'fechado em cuidados pessoais' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      // Confirmação conversacional após decisão final com link desfazer
      expect(screen.getByText(/Criada nova categoria "Cuidados Pessoais"/i)).toBeDefined()
      expect(screen.getByText('[Desfazer]')).toBeDefined()
    })
  })

  it('fluxo de padrão ouro clarificacao_categoria: sugere pílulas, persiste categoria e exibe card verde pronto para confirmar', async () => {
    mockAddNewCategory.mockResolvedValueOnce({
      id: 'cat-cuidados-pessoais',
      name: 'Cuidados Pessoais',
      type: 'expense',
      budget_bucket: 'lifestyle',
      subcategories: [],
    })

    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'Manicure 140 reais',
      amountCents: 14000,
      amountFormatted: 'R$ 140,00',
      type: 'expense',
      description: 'Manicure',
      confidence: 0.85,
      processingSource: 'openai',
      aiStatus: 'clarificacao_categoria',
      categoryNameSuggestion: null,
      subcategoryNameSuggestion: 'Manicure',
      bucketSuggestion: 'lifestyle',
      clarificationQuestion: 'Onde prefere organizar essa categoria?',
      clarificationOptions: [
        'Cuidados Pessoais (Estilo de Vida)',
        'Lazer & Beleza (Estilo de Vida)',
      ],
      friendlyMessage:
        'Identifiquei R$ 140,00! Mas ainda não temos essa categoria cadastrada. Onde prefere organizar?',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'Manicure 140 reais' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(
        screen.getByText(/Identifiquei Manicure R\$ 140,00! Onde prefere organizar esse gasto\?/i),
      ).toBeDefined()
      // Pílulas clicáveis exibidas
      expect(screen.getByText('Cuidados Pessoais (Estilo de Vida)')).toBeDefined()
      expect(screen.getByText('Lazer & Beleza (Estilo de Vida)')).toBeDefined()
    })

    // Usuário clica na pílula "Cuidados Pessoais (Estilo de Vida)"
    fireEvent.click(screen.getByText('Cuidados Pessoais (Estilo de Vida)'))

    await waitFor(() => {
      // 1. A nova categoria deve ter sido persistida para a família
      expect(mockAddNewCategory).toHaveBeenCalledWith(
        'Cuidados Pessoais',
        'expense',
        '#64748B',
        'Tag',
        'lifestyle',
      )

      // 2. Confirmação conversacional aparece imediatamente com link desfazer
      expect(screen.getByText(/Criada nova categoria "Cuidados Pessoais"/i)).toBeDefined()
      expect(screen.getByText('[Desfazer]')).toBeDefined()
    })
  })

  it('ausência dos botões isolados "Falar de novo" e "Ajustar" no modal do chat', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'Manicure 140 reais',
      amountCents: 14000,
      amountFormatted: 'R$ 140,00',
      type: 'expense',
      description: 'Manicure',
      confidence: 0.85,
      processingSource: 'openai',
      aiStatus: 'clarificacao_categoria',
      categoryNameSuggestion: null,
      subcategoryNameSuggestion: 'Manicure',
      bucketSuggestion: 'lifestyle',
      clarificationQuestion: 'Onde prefere organizar essa categoria?',
      clarificationOptions: [
        'Manicure › dentro de Lazer (Estilo de Vida)',
        'Cuidados Pessoais (Estilo de Vida)',
      ],
      friendlyMessage: 'Identifiquei R$ 140,00! Onde prefere organizar?',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'Manicure 140 reais' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(screen.getByText('Manicure › dentro de Lazer (Estilo de Vida)')).toBeDefined()
      // Botões 'Falar de novo' e 'Ajustar' NÃO devem existir no card de clarificação
      expect(screen.queryByText('Falar de novo')).toBeNull()
      expect(screen.queryByText('Ajustar')).toBeNull()
    })
  })

  it('edição conversacional da transação pendente: digitar nova mensagem atualiza o card pendente', async () => {
    // 1º lançamento
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'Almoço 80 reais',
      amountCents: 8000,
      amountFormatted: 'R$ 80,00',
      type: 'expense',
      description: 'Almoço',
      categoryNameSuggestion: 'Alimentação',
      bucketSuggestion: 'essential',
      confidence: 0.95,
      processingSource: 'openai',
      aiStatus: 'sucesso',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'Almoço 80 reais' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(screen.getByText('R$ 80,00')).toBeDefined()
      expect(screen.getByText('Almoço')).toBeDefined()
    })

    // Usuário corrige conversacionalmente: "na verdade foi 100 reais"
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'na verdade foi 100 reais',
      amountCents: 10000,
      amountFormatted: 'R$ 100,00',
      type: 'expense',
      description: 'na verdade foi 100 reais',
      confidence: 0.95,
      processingSource: 'openai',
      aiStatus: 'sucesso',
    })

    fireEvent.change(input, { target: { value: 'na verdade foi 100 reais' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      // O valor foi atualizado para R$ 100,00 preservando a descrição do gasto
      expect(screen.getByText('R$ 100,00')).toBeDefined()
      expect(screen.getByText(/Atualizado! Identifiquei o ajuste/i)).toBeDefined()
    })
  })

  it('atalho conversacional de confirmação: falar ou digitar "confirmar" salva a transação pendente', async () => {
    mockCreateTransaction.mockResolvedValueOnce({ id: 'tx-confirm-1' })

    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'Almoço 50 reais',
      amountCents: 5000,
      amountFormatted: 'R$ 50,00',
      type: 'expense',
      description: 'Almoço',
      categoryNameSuggestion: 'Alimentação',
      bucketSuggestion: 'essential',
      confidence: 0.95,
      processingSource: 'openai',
      aiStatus: 'sucesso',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'Almoço 50 reais' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(screen.getByText('R$ 50,00')).toBeDefined()
    })

    // Usuário digita "confirmar" no chat
    fireEvent.change(input, { target: { value: 'confirmar' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          family_id: 'fam-1',
          type: 'expense',
          amount_cents: 5000,
          description: 'Almoço',
        }),
      )
      expect(mockTriggerRefresh).toHaveBeenCalled()
    })
  })

  it('executa transação autônoma diretamente no Supabase e exibe confirmação e link [Desfazer]', async () => {
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'Supermercado 150 reais no débito' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          family_id: 'fam-1',
          type: 'expense',
          amount_cents: 4500,
        }),
      )
      expect(mockTriggerRefresh).toHaveBeenCalled()
      expect(screen.getByText(/Lançado: R\$ 45,00/i)).toBeDefined()
      expect(screen.getByText('[Desfazer]')).toBeDefined()
    })
  })

  it('exibe pílulas com distinção visual entre "📁 Usar existente" e "✨ Criar nova" e preserva transação pendente', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'Manicure 98 reais',
      amountCents: 9800,
      amountFormatted: 'R$ 98,00',
      type: 'expense',
      description: 'Manicure',
      confidence: 0.9,
      processingSource: 'openai',
      aiStatus: 'clarificacao_categoria',
      categoryNameSuggestion: null,
      subcategoryNameSuggestion: 'Manicure',
      bucketSuggestion: 'lifestyle',
      clarificationQuestion: 'Onde prefere organizar essa despesa?',
      clarificationOptions: [
        '📁 Usar existente: Lazer › subcategoria Manicure',
        '✨ Criar nova: Cuidados Pessoais (Estilo de Vida)',
      ],
      structuredOptions: [
        {
          tipo: 'existente',
          rotulo: '📁 Usar existente: Lazer › subcategoria Manicure',
          categoria: 'Lazer',
          subcategoria: 'Manicure',
          balde: 'Estilo de Vida',
        },
        {
          tipo: 'nova',
          rotulo: '✨ Criar nova: Cuidados Pessoais (Estilo de Vida)',
          categoria: 'Cuidados Pessoais',
          subcategoria: null,
          balde: 'Estilo de Vida',
        },
      ],
      friendlyMessage: 'Identifiquei R$ 98,00! Onde prefere organizar?',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'Manicure 98 reais' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      // Pílula com Usar Existente
      const pillExistente = screen.getByTestId('category-option-existente-0')
      expect(pillExistente).toBeDefined()
      expect(pillExistente.textContent).toContain('📁 Usar existente: Lazer')

      // Pílula com Criar Nova
      const pillNova = screen.getByTestId('category-option-nova-1')
      expect(pillNova).toBeDefined()
      expect(pillNova.textContent).toContain('✨ Criar nova: Cuidados Pessoais')
    })

    // Usuário pergunta: "Nós temos essa categoria?"
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'Nós temos essa categoria?',
      amountCents: 9800,
      amountFormatted: 'R$ 98,00',
      type: 'expense',
      description: 'Manicure',
      confidence: 0.95,
      processingSource: 'openai',
      aiStatus: 'clarificacao_categoria',
      tipoResposta: 'consultoria_categoria',
      intencao: 'consultiva',
      clarificationQuestion: 'O que você prefere?',
      clarificationOptions: [
        '📁 Usar existente: Lazer › subcategoria Manicure',
        '✨ Criar nova: Cuidados Pessoais (Estilo de Vida)',
      ],
      structuredOptions: [
        {
          tipo: 'existente',
          rotulo: '📁 Usar existente: Lazer › subcategoria Manicure',
          categoria: 'Lazer',
          subcategoria: 'Manicure',
          balde: 'Estilo de Vida',
        },
        {
          tipo: 'nova',
          rotulo: '✨ Criar nova: Cuidados Pessoais (Estilo de Vida)',
          categoria: 'Cuidados Pessoais',
          subcategoria: null,
          balde: 'Estilo de Vida',
        },
      ],
      friendlyMessage:
        "Ainda não temos essa categoria cadastrada! Ela é uma sugestão que posso criar agora mesmo para deixar seus gastos de estética organizados. O que você prefere: criar a categoria nova 'Cuidados Pessoais' ou encaixar dentro da existente 'Lazer'?",
    })

    fireEvent.change(input, { target: { value: 'Nós temos essa categoria?' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(screen.getByText(/Ainda não temos essa categoria cadastrada/i)).toBeDefined()
      // Mantém a opção existente e a nova na tela
      expect(screen.getByTestId('category-option-existente-0')).toBeDefined()
    })

    // Ao clicar na opção existente, reaproveita a categoria Lazer e prepara confirmação
    fireEvent.click(screen.getByTestId('category-option-existente-0'))

    await waitFor(() => {
      expect(screen.getByText(/Usando categoria existente "Lazer"/i)).toBeDefined()
      expect(screen.getByText('[Desfazer]')).toBeDefined()
    })
  })

  it('formata mensagem de clarificacao_categoria incluindo a descrição e o valor mesmo quando IA retorna mensagem sem a descrição', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'manicure 267',
      amountCents: 26700,
      amountFormatted: 'R$ 267,00',
      type: 'expense',
      description: 'manicure',
      confidence: 0.88,
      processingSource: 'openai',
      aiStatus: 'clarificacao_categoria',
      categoryNameSuggestion: null,
      subcategoryNameSuggestion: 'manicure',
      bucketSuggestion: 'lifestyle',
      clarificationQuestion: 'Onde prefere organizar esse lançamento?',
      clarificationOptions: [
        'Cuidados Pessoais (Estilo de Vida)',
        'Manicure › dentro de Lazer (Estilo de Vida)',
      ],
      // Simula resposta antiga da IA onde não vinha a descrição do gasto
      friendlyMessage: 'Identifiquei R$ 267,00! Onde prefere organizar esse gasto?',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'manicure 267' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      // O balão no mini-chat deve exibir "Identifiquei manicure R$ 267,00! Onde prefere organizar esse gasto?"
      expect(
        screen.getByText('Identifiquei manicure R$ 267,00! Onde prefere organizar esse gasto?'),
      ).toBeDefined()
      expect(screen.getByText('Cuidados Pessoais (Estilo de Vida)')).toBeDefined()
    })
  })

  it('formata mensagem de clarificacao_categoria com descrição e valor quando friendlyMessage está vazia', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'tatuagem 350',
      amountCents: 35000,
      amountFormatted: 'R$ 350,00',
      type: 'expense',
      description: 'tatuagem',
      confidence: 0.88,
      processingSource: 'openai',
      aiStatus: 'clarificacao_categoria',
      categoryNameSuggestion: null,
      subcategoryNameSuggestion: 'tatuagem',
      bucketSuggestion: 'lifestyle',
      clarificationQuestion: 'Onde prefere organizar esse lançamento?',
      clarificationOptions: ['Arte Corporal (Estilo de Vida)', 'Lazer (Estilo de Vida)'],
      friendlyMessage: '',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'tatuagem 350' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(
        screen.getByText('Identifiquei tatuagem R$ 350,00! Onde prefere organizar esse gasto?'),
      ).toBeDefined()
    })
  })

  it('regressão Bug 1: com pendingTransaction ativo em falta_valor, usuário falando "12 reais" envia imediatamente para parseVoiceWithAi com contexto_anterior e sem fallback local', async () => {
    // 1º turno: fala sem valor "estacionamento rotativo"
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'estacionamento rotativo',
      amountCents: 0,
      amountFormatted: 'R$ 0,00',
      type: 'expense',
      description: 'Estacionamento rotativo',
      confidence: 0.85,
      processingSource: 'openai',
      aiStatus: 'falta_valor',
      categoryNameSuggestion: 'Transporte',
      bucketSuggestion: 'essential',
      clarificationQuestion: 'Quanto custou?',
      friendlyMessage: 'Identifiquei Estacionamento rotativo. Quanto custou? 🚗',
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

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'estacionamento rotativo' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(
        screen.getByText(/Identifiquei Estacionamento rotativo\. Quanto custou\?/i),
      ).toBeDefined()
    })

    // 2º turno: usuário responde falando "12 reais"
    mockParseVoiceWithAi.mockImplementationOnce(
      async ({ texto, contexto_anterior, categorias }) => {
        expect(texto).toBe('12 reais')
        expect(contexto_anterior).toEqual(
          expect.objectContaining({
            descricao: 'Estacionamento rotativo',
            status: 'falta_valor',
          }),
        )
        // Garante que a lista de categorias também foi enviada para otimização da Edge Function
        expect(Array.isArray(categorias)).toBe(true)
        expect(categorias?.length).toBeGreaterThan(0)

        return {
          rawText: '12 reais',
          amountCents: 1200,
          amountFormatted: 'R$ 12,00',
          type: 'expense',
          description: 'Estacionamento rotativo',
          confidence: 0.98,
          processingSource: 'openai',
          aiStatus: 'sucesso',
          categoryNameSuggestion: 'Transporte',
          bucketSuggestion: 'essential',
          friendlyMessage: 'Lançado: R$ 12,00 em Transporte! 👍',
        }
      },
    )

    fireEvent.change(input, { target: { value: '12 reais' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      // Confirma que a mensagem foi processada pela IA e lançou sem re-imprimir pergunta
      expect(screen.getByText(/Lançado: R\$ 12,00 em Transporte! 👍/i)).toBeDefined()
      expect(screen.getByText('[Desfazer]')).toBeDefined()
    })
  })

  it('exibe saudação contextual dinâmica e chips de sugestão rápida', async () => {
    ;(window as any).SpeechRecognition = undefined
    ;(window as any).webkitSpeechRecognition = undefined

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    // Chips de sugestão rápida tocáveis
    expect(screen.getByText('🎙️ "Almoço 35 reais"')).toBeDefined()
    expect(screen.getByText('📊 "Quanto ainda posso gastar?"')).toBeDefined()
    expect(screen.getByText('🔍 "Últimos lançamentos"')).toBeDefined()
  })

  it('regressão memória de chat: pergunta "onde você lançou o almoço?" não é filtrada e envia historico_mensagens das últimas 6 mensagens', async () => {
    ;(window as any).SpeechRecognition = undefined
    ;(window as any).webkitSpeechRecognition = undefined

    // Turno 1: usuário lança almoço
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'almoço 35 no débito',
      amountCents: 3500,
      amountFormatted: 'R$ 35,00',
      type: 'expense',
      description: 'Almoço',
      confidence: 0.98,
      processingSource: 'openai',
      aiStatus: 'sucesso',
      categoryNameSuggestion: 'Alimentação',
      subcategoryNameSuggestion: 'Restaurante',
      bucketSuggestion: 'lifestyle',
      paymentMethod: 'debito',
      friendlyMessage: 'Lançado: R$ 35,00 em Alimentação › Restaurante! 👍',
    })

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Fale no microfone ou digite aqui...')
    fireEvent.change(input, { target: { value: 'almoço 35 no débito' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(screen.getByText(/Lançado: R\$ 35,00 em Alimentação › Restaurante!/i)).toBeDefined()
    })

    // Turno 2: usuário pergunta "onde você lançou o almoço?"
    mockParseVoiceWithAi.mockImplementationOnce(async (options) => {
      expect(options.texto).toBe('onde você lançou o almoço?')
      expect(Array.isArray(options.historico_mensagens)).toBe(true)
      expect(options.historico_mensagens!.length).toBeGreaterThan(0)
      expect(options.historico_mensagens!.length).toBeLessThanOrEqual(6)

      // Verifica se o histórico contém a conversa anterior
      const historyTexts = options.historico_mensagens!.map((m: any) => m.content)
      expect(historyTexts.some((t: string) => t.includes('almoço 35 no débito'))).toBe(true)

      return {
        rawText: 'onde você lançou o almoço?',
        amountCents: 0,
        amountFormatted: 'R$ 0,00',
        type: 'expense',
        description: 'onde você lançou o almoço?',
        confidence: 0.95,
        processingSource: 'openai',
        aiStatus: 'consulta',
        tipoResposta: 'consulta',
        respostaConsulta:
          'Lancei seu almoço de R$ 35,00 em Alimentação › Restaurante no débito! 🍽️',
        friendlyMessage: 'Lancei seu almoço de R$ 35,00 em Alimentação › Restaurante no débito! 🍽️',
      }
    })

    fireEvent.change(input, { target: { value: 'onde você lançou o almoço?' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      // Pergunta do usuário como balão
      expect(screen.getByText('onde você lançou o almoço?')).toBeDefined()
      // Resposta natural da IA em balão de texto (sem card de erro ou retry)
      expect(
        screen.getByText(
          'Lancei seu almoço de R$ 35,00 em Alimentação › Restaurante no débito! 🍽️',
        ),
      ).toBeDefined()
      expect(screen.queryByText(/Falar Novamente/i)).toBeNull()
      expect(screen.queryByTestId('invalid-error-card')).toBeNull()
    })
  })
})
