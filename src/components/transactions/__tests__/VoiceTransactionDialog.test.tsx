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
      // Card verde com botão [ Confirmar Lançamento ] e SEM botões 'Ajustar' ou 'Falar de novo'
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
      expect(screen.queryByText('Ajustar')).toBeNull()
      expect(screen.queryByText('Falar de novo')).toBeNull()
      expect(screen.getByText('R$ 45,00')).toBeDefined()
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
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
      expect(screen.getByText('R$ 8,00')).toBeDefined()
    })
  })

  it('comportamento "invalido": exibe mensagem acolhedora com botão [ 🎤 Falar Novamente ], sem card de confirmação', async () => {
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
      expect(screen.getByText('🎤 Falar Novamente')).toBeDefined()
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

  it('no modo "Falar apenas o valor", ao concluir a fala encerra definitivamente sem reiniciar recognition', async () => {
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
      friendlyMessage: 'Entendi o almoço! Quanto custou?',
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
      expect(screen.getByText('🎤 Falar apenas o valor')).toBeDefined()
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

    // Usuário clica no botão "Falar apenas o valor"
    const amountOnlyBtn = screen.getByText('🎤 Falar apenas o valor')
    fireEvent.click(amountOnlyBtn)

    // O microfone foi reativado pelo clique explícito do usuário (startCallCount = 2)
    expect(startCallCount).toBe(2)

    // Usuário fala "45 reais"
    capturedRecognitionInstance.onresult({
      results: [[{ transcript: '45 reais' }]],
    })

    // Dispara onend (silêncio/fim de fala)
    capturedRecognitionInstance.onend()

    // NÃO deve ter reiniciar automaticamente: startCallCount continua 2
    expect(startCallCount).toBe(2)

    await waitFor(() => {
      // Card verde exibido com o valor mesclado
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
      expect(screen.getByText('R$ 45,00')).toBeDefined()
    })

    // Microfone permanece em repouso
    expect(startCallCount).toBe(2)
    expect(screen.getByText('Microfone pronto')).toBeDefined()
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

  it('processa somente após 3s de silêncio reais (silenceTimerRef 3000ms)', async () => {
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

    // Avança 2.5s: ainda não deve processar
    vi.advanceTimersByTime(2500)
    expect(mockParseVoiceWithAi).not.toHaveBeenCalled()

    // Avança mais 600ms (total > 3000ms de silêncio real)
    vi.advanceTimersByTime(600)

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
      // 2. Resposta do assistente perguntando o valor
      expect(
        screen.getByText(
          /Entendi:\s*2 caixas de cerveja na Parada Certa!\s*🍻\s*Mas quanto custou\?/i,
        ),
      ).toBeDefined()
      // Card de falta_valor com input de R$
      expect(
        screen.getByText(/Entendi:\s*2 caixas de cerveja\s*em\s*Estilo de Vida/i),
      ).toBeDefined()
      expect(screen.getByPlaceholderText('0,00')).toBeDefined()
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
      // Card Verde de Confirmação MESCLADO com a transação pendente anterior
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
      expect(screen.getByText('2 caixas de cerveja')).toBeDefined()
      expect(screen.getByText('R$ 80,00')).toBeDefined()
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
        screen.getByText(/Identifiquei R\$ 140,00! Mas ainda não temos essa categoria cadastrada/i),
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

      // 2. Card verde de confirmação aparece imediatamente preenchido
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
      expect(screen.getByText('Manicure')).toBeDefined()
      expect(screen.getByText('R$ 140,00')).toBeDefined()
      expect(screen.getByText(/Cuidados Pessoais/i)).toBeDefined()
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

  it('salva transação e fecha modal quando o usuário clica em [ ✅ Confirmar Lançamento ]', async () => {
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
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
    })

    fireEvent.click(screen.getByText('✅ Confirmar Lançamento'))

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          family_id: 'fam-1',
          type: 'expense',
          amount_cents: 4500,
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
