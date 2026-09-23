import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { VoiceTransactionDialog } from '../VoiceTransactionDialog'

// Mocks do hook useFamily e useToast
const mockTriggerRefresh = vi.fn()
const mockToast = vi.fn()
const mockCreateTransaction = vi.fn()

vi.mock('@/hooks/use-family', () => ({
  useFamily: () => ({
    family: { id: 'fam-1', name: 'Família Silva' },
    members: [{ id: 'mem-1', name: 'Carlos' }],
    currentMember: { id: 'mem-1', name: 'Carlos' },
    categories: [
      { id: 'cat-1', name: 'Alimentação', type: 'expense', budget_bucket: 'essential' },
      { id: 'cat-2', name: 'Salário', type: 'income', budget_bucket: 'essential' },
    ],
    triggerRefresh: mockTriggerRefresh,
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

describe('VoiceTransactionDialog', () => {
  let mockGetUserMedia: ReturnType<typeof vi.fn>
  let mockTrackStop: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockTrackStop = vi.fn()

    mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: mockTrackStop }, { stop: mockTrackStop }],
    })

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
      configurable: true,
    })
  })

  it('solicita permissão nativa de microfone via getUserMedia({ audio: true }) ao abrir o diálogo', async () => {
    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
    })
  })

  it('exibe estado visual "Ouvindo... fale agora" quando microfone é ativado', async () => {
    // Mock de SpeechRecognition simples
    class MockSpeechRecognition {
      lang = ''
      continuous = false
      interimResults = false
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
      expect(screen.getByText(/Ouvindo\.\.\. fale agora/i)).toBeDefined()
    })
  })

  it('configura o SpeechRecognition com pt-BR, continuous=false, interimResults=true e para as faixas de permissão imediatamente', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: false,
        interimResults: false,
        onstart: null as any,
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
    })

    // Confirma que as tracks do getUserMedia foram liberadas imediatamente após obter a permissão
    expect(mockTrackStop).toHaveBeenCalled()
  })

  it('captura fala em tempo real via onresult com interimResults e atualiza a tela', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: false,
        interimResults: false,
        onstart: null as any,
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
      resultIndex: 0,
      results: [[{ transcript: 'Almoço 45 reais no débito' }]],
    })

    await waitFor(() => {
      expect(screen.getByText(/Almoço 45 reais no débito/i)).toBeDefined()
    })
  })

  it('ao disparar onend ou clicar em Concluir, processa o texto falado final com o parser', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: false,
        interimResults: false,
        onstart: null as any,
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

    // Simula fala detectada
    capturedRecognitionInstance.onresult({
      resultIndex: 0,
      results: [[{ transcript: 'Almoço 45 reais no débito' }]],
    })

    await waitFor(() => {
      expect(screen.getByText(/Almoço 45 reais no débito/i)).toBeDefined()
    })

    // Botão Concluir presente
    const btnConcluir = screen.getByText('Concluir')
    expect(btnConcluir).toBeDefined()

    // Simula finalização da fala pelo reconhecimento nativo
    capturedRecognitionInstance.onend()

    // Transição para o estado de confirmação (resumo do parser com R$ 45,00)
    await waitFor(() => {
      expect(screen.getByText('✅ Confirmar Lançamento')).toBeDefined()
      expect(screen.getByText('Ajustar')).toBeDefined()
      expect(screen.getByText('R$ 45,00')).toBeDefined()
    })
  })

  it('exibe mensagem amigável em português quando ocorre onerror no SpeechRecognition (no-speech, network)', async () => {
    let capturedRecognitionInstance: any = null

    function MockSpeechRecognition() {
      const self = {
        lang: '',
        continuous: false,
        interimResults: false,
        onstart: null as any,
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
        screen.getByText('Não consegui ouvir nada. Tente falar mais perto do microfone.'),
      ).toBeDefined()
    })

    // Simula erro network
    capturedRecognitionInstance.onerror({ error: 'network' })

    await waitFor(() => {
      expect(
        screen.getByText('Problema de conexão. Verifique sua internet e tente de novo.'),
      ).toBeDefined()
    })
  })

  it('exibe botão "Toque aqui para autorizar o microfone e tentar novamente" quando a permissão é negada', async () => {
    const error = new Error('Permission denied')
    error.name = 'NotAllowedError'
    mockGetUserMedia.mockRejectedValueOnce(error)

    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByText('Toque aqui para autorizar o microfone e tentar novamente'),
      ).toBeDefined()
    })

    // Clicar no botão para tentar novamente dispara nova solicitação getUserMedia
    mockGetUserMedia.mockResolvedValueOnce({
      getTracks: () => [{ stop: mockTrackStop }],
    })

    fireEvent.click(screen.getByText('Toque aqui para autorizar o microfone e tentar novamente'))

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledTimes(2)
    })
  })

  it('fecha as faixas de áudio (stream.getTracks().forEach(t => t.stop())) ao fechar ou parar', async () => {
    const { unmount } = render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled()
    })

    unmount()

    expect(mockTrackStop).toHaveBeenCalled()
  })

  it('permite alternar para digitação com o rótulo "Ou prefere digitar?" como alternativa secundária', async () => {
    render(
      <VoiceTransactionDialog
        open={true}
        onOpenChange={vi.fn()}
        onOpenManualTransaction={vi.fn()}
      />,
    )

    const preferTypeBtn = screen.getByText('Ou prefere digitar?')
    expect(preferTypeBtn).toBeDefined()

    fireEvent.click(preferTypeBtn)

    expect(screen.getByPlaceholderText('Ex: Almoço 45 reais no débito')).toBeDefined()
  })
})
