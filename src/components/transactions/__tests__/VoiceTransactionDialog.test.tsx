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

  it('exibe estado visual "Ouvindo... pode falar" quando microfone é ativado', async () => {
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
      expect(screen.getByText(/Ouvindo\.\.\. pode falar/i)).toBeDefined()
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
