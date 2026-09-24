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

  it('configura o SpeechRecognition com pt-BR, continuous=true, interimResults=true e maxAlternatives=1', async () => {
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
      expect(capturedRecognitionInstance.continuous).toBe(true)
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
      // Card verde com botões [ Confirmar Lançamento ] e [ Ajustar ]
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
      expect(screen.getByText('Ajustar')).toBeDefined()
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
