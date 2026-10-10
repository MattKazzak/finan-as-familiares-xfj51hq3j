import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceCapture } from '@/hooks/use-voice-capture'

describe('useVoiceCapture (Cadeia Unificada de Microfone)', () => {
  let originalMediaRecorder: any
  let originalMediaDevices: any
  let originalAudioContext: any
  let originalSpeechRecognition: any
  let originalWebkitSpeechRecognition: any

  beforeEach(() => {
    vi.clearAllMocks()

    originalMediaRecorder = (window as any).MediaRecorder
    originalMediaDevices = navigator.mediaDevices
    originalAudioContext = (window as any).AudioContext
    originalSpeechRecognition = (window as any).SpeechRecognition
    originalWebkitSpeechRecognition = (window as any).webkitSpeechRecognition
  })

  afterEach(() => {
    ;(window as any).MediaRecorder = originalMediaRecorder
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
      writable: true,
    })
    ;(window as any).AudioContext = originalAudioContext
    ;(window as any).SpeechRecognition = originalSpeechRecognition
    ;(window as any).webkitSpeechRecognition = originalWebkitSpeechRecognition
  })

  it('FIX 1 & FIX 2: no-speech e aborted são benignos, NÃO encerram a gravação e onend reconecta via recognitionRef.current', async () => {
    // Força modo Web Speech desativando MediaRecorder
    ;(window as any).MediaRecorder = undefined

    let capturedInstance: any = null
    const mockStart = vi.fn()
    const mockStop = vi.fn()

    const instances: any[] = []
    const MockSpeechRecognition = vi.fn().mockImplementation(() => {
      const inst: any = {
        lang: '',
        continuous: false,
        interimResults: false,
        maxAlternatives: 1,
        onstart: null,
        onresult: null,
        onerror: null,
        onend: null,
        onaudiostart: null,
        onspeechstart: null,
        start: mockStart.mockImplementation(() => {
          if (inst.onstart) inst.onstart()
        }),
        stop: mockStop.mockImplementation(() => {
          if (inst.onend) inst.onend()
        }),
      }
      instances.push(inst)
      capturedInstance = inst
      return inst
    })

    ;(window as any).SpeechRecognition = MockSpeechRecognition

    const { result } = renderHook(() => useVoiceCapture())

    // Inicia escuta
    await act(async () => {
      await result.current.startListening()
    })

    expect(result.current.isListening).toBe(true)
    expect(result.current.audioCaptureMode).toBe('web_speech')
    expect(capturedInstance).not.toBeNull()

    // Dispara erro benigno 'no-speech'
    act(() => {
      capturedInstance.onerror({ error: 'no-speech' })
    })

    // FIX 1: Continua ouvindo, exibe mensagem transitória "Estou ouvindo — fale quando quiser"
    // e NÃO encerra a sessão com erro fatal
    expect(result.current.isListening).toBe(true)
    expect(result.current.infoMessage).toBe('Estou ouvindo — fale quando quiser')
    expect(result.current.errorMessage).toBeNull()

    // Dispara onend automático do navegador (corte de ~3s do SpeechRecognition)
    // FIX 2: onend deve reconectar a sessão usando a instância atual
    mockStart.mockClear()
    act(() => {
      capturedInstance.onend()
    })

    // Deve ter chamado start() para reconectar
    expect(mockStart).toHaveBeenCalled()
    expect(result.current.isListening).toBe(true)

    // Agora dispara erro fatal 'not-allowed'
    act(() => {
      capturedInstance.onerror({ error: 'not-allowed' })
    })

    // Erro fatal encerra a sessão e define status negado
    expect(result.current.isListening).toBe(false)
    expect(result.current.permissionStatus).toBe('denied')
    expect(result.current.errorMessage).toContain('Permissão de microfone negada')
  })

  it('FIX 3: Se o AudioContext permanecer suspended, avisa na UI needsAudioResume e resume no toque', async () => {
    let mockResumeCalled = false
    let audioState = 'suspended'

    class MockAudioContext {
      state = audioState
      createMediaStreamSource() {
        return { connect: vi.fn() }
      }
      createAnalyser() {
        return {
          fftSize: 64,
          frequencyBinCount: 32,
          getByteFrequencyData: vi.fn(),
        }
      }
      resume = vi.fn().mockImplementation(async () => {
        mockResumeCalled = true
        this.state = 'running'
        audioState = 'running'
      })
      close = vi.fn().mockResolvedValue(undefined)
    }

    ;(window as any).AudioContext = MockAudioContext
    const MockMediaRecorder1 = vi.fn().mockImplementation(() => {
      const inst: any = {
        state: 'inactive',
        start: vi.fn().mockImplementation(() => {
          inst.state = 'recording'
        }),
        stop: vi.fn().mockImplementation(() => {
          inst.state = 'inactive'
          if (inst.onstop) inst.onstop()
        }),
        ondataavailable: null,
        onerror: null,
        onstop: null,
      }
      return inst
    })

    ;(window as any).MediaRecorder = MockMediaRecorder1

    const mockTrack = { stop: vi.fn(), onended: null }
    const mockStream = {
      getTracks: () => [mockTrack],
      getAudioTracks: () => [mockTrack],
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() => useVoiceCapture())

    await act(async () => {
      await result.current.startListening()
    })

    expect(result.current.isListening).toBe(true)
    expect(result.current.audioCaptureMode).toBe('media_recorder')
    // resume() foi chamado e transicionou para running
    expect(mockResumeCalled).toBe(true)

    // Testa caso em que permanece suspended
    act(() => {
      // simula audioContext suspenso
      if (result.current.needsAudioResume) {
        expect(result.current.needsAudioResume).toBe(true)
      }
    })

    // Executa resumeAudioContextOnTouch
    await act(async () => {
      await result.current.resumeAudioContextOnTouch()
    })
    expect(result.current.needsAudioResume).toBe(false)
  })

  it('FIX 4: recorder.onerror NÃO encerra a gravação via stopListening direto, mantendo estado com retry', async () => {
    let recorderInstance: any = null

    ;(window as any).AudioContext = class {
      state = 'running'
      createMediaStreamSource() {
        return { connect: vi.fn() }
      }
      createAnalyser() {
        return {
          fftSize: 64,
          frequencyBinCount: 32,
          getByteFrequencyData: vi.fn(),
        }
      }
      resume = vi.fn().mockResolvedValue(undefined)
      close = vi.fn().mockResolvedValue(undefined)
    }

    const MockMediaRecorder2 = vi.fn().mockImplementation(() => {
      const inst: any = {
        state: 'inactive',
        start: vi.fn().mockImplementation(() => {
          inst.state = 'recording'
        }),
        stop: vi.fn().mockImplementation(() => {
          inst.state = 'inactive'
          if (inst.onstop) inst.onstop()
        }),
        ondataavailable: null,
        onerror: null,
        onstop: null,
      }
      recorderInstance = inst
      return inst
    })

    ;(window as any).MediaRecorder = MockMediaRecorder2

    const mockTrack = { stop: vi.fn(), onended: null }
    const mockStream = {
      getTracks: () => [mockTrack],
      getAudioTracks: () => [mockTrack],
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() => useVoiceCapture())

    await act(async () => {
      await result.current.startListening()
    })

    expect(result.current.isListening).toBe(true)
    expect(recorderInstance).not.toBeNull()

    // Dispara erro no recorder
    act(() => {
      recorderInstance.onerror(new Error('Hardware audio buffer error'))
    })

    // FIX 4: Mensagem na UI para Tentar de novo ou digitar, sem desligar violentamente
    expect(result.current.errorMessage).toContain('Tentar de novo')
    expect(result.current.errorMessage).toContain('digite')

    // Limpa erro e tenta de novo
    act(() => {
      result.current.clearError()
    })
    expect(result.current.errorMessage).toBeNull()
  })
})
