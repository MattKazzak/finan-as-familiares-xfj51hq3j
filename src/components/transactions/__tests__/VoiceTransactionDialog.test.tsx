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

  it('comportamento "invalido": exibe mensagem exata, subtítulo exato e botão [ 🎤 Falar Novamente ], NUNCA abre confirmação', async () => {
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
      friendlyMessage: 'Não consegui identificar uma despesa nessa fala. 😄',
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
    fireEvent.change(input, { target: { value: 'GPT ormini falando' } })
    fireEvent.click(screen.getByText('Processar com IA'))

    await waitFor(() => {
      // Mensagem exata (Regra 2)
      expect(screen.getByText('Não consegui identificar uma despesa nessa fala. 😄')).toBeDefined()
      // Subtítulo exato (Regra 2)
      expect(
        screen.getByText("Dica: Fale o item e o valor, ex: 'Almoço 45 reais no débito'."),
      ).toBeDefined()
      // Botão exato (Regra 2)
      expect(screen.getByText('🎤 Falar Novamente')).toBeDefined()
      // NUNCA abre a confirmação (Regra 1)
      expect(screen.queryByText('✅ Confirmar Lançamento')).toBeNull()
      expect(screen.queryByText('Despesa Detectada')).toBeNull()
      expect(screen.queryByText('Ajustar')).toBeNull()
    })
  })

  it('bloqueia confirmação se a IA retornar status "sucesso" mas com valor zerado/inválido', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'Gasolina',
      amountCents: 0,
      amountFormatted: 'R$ 0,00',
      type: 'expense',
      description: 'Gasolina',
      confidence: 0.5,
      processingSource: 'openai',
      aiStatus: 'sucesso',
      clarificationQuestion: null,
      clarificationOptions: null,
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
    fireEvent.change(input, { target: { value: 'Gasolina' } })
    fireEvent.click(screen.getByText('Processar com IA'))

    await waitFor(() => {
      // Cai no estado invalido pela guard dupla (status === 'sucesso' && valor > 0)
      expect(screen.getByText('Não consegui identificar uma despesa nessa fala. 😄')).toBeDefined()
      expect(screen.queryByText('✅ Confirmar Lançamento')).toBeNull()
    })
  })

  it('exibe badge "✨ GPT-4o Mini Ativo" quando a resposta vem da OpenAI com sucesso', async () => {
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

  it('exibe alerta vermelho com erro exato retornado quando houver erro de requisição/rede', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'Almoço 45 reais',
      amountCents: 0,
      amountFormatted: 'R$ 0,00',
      type: 'expense',
      description: 'Almoço 45 reais',
      confidence: 0,
      processingSource: 'openai',
      aiStatus: 'invalido',
      friendlyMessage:
        'Falha na IA [HTTP 500]: Chave OPENAI_API_KEY não configurada no backend Supabase.. Toque para tentar novamente.',
      aiError: 'Falha na IA [HTTP 500]: Chave OPENAI_API_KEY não configurada no backend Supabase.',
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
      // Alerta com a mensagem exata de erro
      expect(
        screen.getAllByText(
          'Falha na IA [HTTP 500]: Chave OPENAI_API_KEY não configurada no backend Supabase.',
        ).length,
      ).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Erro de Conexão com IA:')).toBeDefined()
      // Card de erro amigável na tela (aiStatus: invalido)
      expect(screen.getByTestId('invalid-error-card')).toBeDefined()
      // Botão Falar Novamente visível
      expect(screen.getByText('🎤 Falar Novamente')).toBeDefined()
      // NUNCA exibe confirmação
      expect(screen.queryByText('✅ Confirmar Lançamento')).toBeNull()
      // Badge da OpenAI ativa não deve estar visível
      expect(screen.queryByText(/✨ GPT-4o Mini Ativo/i)).toBeNull()
    })
  })

  it('BUG 3: Bloqueio rígido — aiStatus === "invalido" NUNCA renderiza confirmação nem ajuste manual', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'frase aleatoria sem sentido',
      amountCents: 0,
      amountFormatted: 'R$ 0,00',
      type: 'expense',
      description: 'frase aleatoria sem sentido',
      confidence: 0,
      processingSource: 'openai',
      aiStatus: 'invalido',
      friendlyMessage: 'Não consegui identificar uma despesa nessa fala. 😄',
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
    fireEvent.change(input, { target: { value: 'frase aleatoria sem sentido' } })
    fireEvent.click(screen.getByText('Processar com IA'))

    await waitFor(() => {
      expect(screen.getByText('Não consegui identificar uma despesa nessa fala. 😄')).toBeDefined()
      expect(
        screen.getByText("Dica: Fale o item e o valor, ex: 'Almoço 45 reais no débito'."),
      ).toBeDefined()
      expect(screen.getByText('🎤 Falar Novamente')).toBeDefined()
      expect(screen.queryByText('✅ Confirmar Lançamento')).toBeNull()
      expect(screen.queryByText('Ajustar')).toBeNull()
      expect(screen.queryByText('Despesa Detectada')).toBeNull()
      expect(screen.queryByText('Receita Detectada')).toBeNull()
    })
  })

  it('BUG 3: clarificacao renderiza EXCLUSIVAMENTE as opções de pílulas e NÃO a confirmação até o clique', async () => {
    mockParseVoiceWithAi.mockResolvedValueOnce({
      rawText: 'padaria 15',
      amountCents: 1500,
      amountFormatted: 'R$ 15,00',
      type: 'expense',
      description: 'Padaria',
      confidence: 0.7,
      processingSource: 'openai',
      aiStatus: 'clarificacao',
      clarificationQuestion: 'Qual a categoria da Padaria?',
      clarificationOptions: ['Alimentação / Café da manhã', 'Lazer / Lanche', 'Outro'],
      friendlyMessage: 'Entendi R$ 15,00! Qual a categoria?',
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
    fireEvent.change(input, { target: { value: 'padaria 15' } })
    fireEvent.click(screen.getByText('Processar com IA'))

    await waitFor(() => {
      expect(screen.getByText('Qual a categoria da Padaria?')).toBeDefined()
      expect(screen.getByText('Alimentação / Café da manhã')).toBeDefined()
      // Card de confirmação NÃO pode estar aberto ainda
      expect(screen.queryByText('✅ Confirmar Lançamento')).toBeNull()
    })

    // Clicando na pílula abre a confirmação
    fireEvent.click(screen.getByText('Alimentação / Café da manhã'))

    await waitFor(() => {
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
      expect(screen.getByText('R$ 15,00')).toBeDefined()
    })
  })

  it('BUG 1: handleStopAndProcess não reinicia nem aborta o recognition a cada palavra falada (usa latestTranscriptRef)', async () => {
    let capturedRecognitionInstance: any = null
    let abortCallCount = 0
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
        abort() {
          abortCallCount++
        },
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
      expect(abortCallCount).toBe(0)
    })

    // Simular transcrições parciais contínuas (como ocorrem na fala do usuário palavra a palavra)
    capturedRecognitionInstance.onresult({
      results: [[{ transcript: 'Almoço' }]],
    })

    await waitFor(() => {
      expect(screen.getByText(/Almoço/i)).toBeDefined()
    })

    // Não deve abortar nem recriar recognition no meio da fala
    expect(abortCallCount).toBe(0)
    expect(startCallCount).toBe(1)

    // Próxima palavra
    capturedRecognitionInstance.onresult({
      results: [[{ transcript: 'Almoço 45' }]],
    })

    await waitFor(() => {
      expect(screen.getByText(/Almoço 45/i)).toBeDefined()
    })

    expect(abortCallCount).toBe(0)
    expect(startCallCount).toBe(1)

    // Final da fala
    capturedRecognitionInstance.onresult({
      results: [[{ transcript: 'Almoço 45 reais no débito' }]],
    })

    expect(abortCallCount).toBe(0)
    expect(startCallCount).toBe(1)

    // Quando terminar a fala, chama onend uma única vez
    capturedRecognitionInstance.onend()

    await waitFor(() => {
      expect(mockParseVoiceWithAi).toHaveBeenCalledWith(
        expect.objectContaining({
          texto: 'Almoço 45 reais no débito',
        }),
      )
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
