import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSupportedAudioMimeType, transcribeVoiceAudio } from '@/services/voice-transcribe'

describe('Serviço de Transcrição de Voz (MediaRecorder + Whisper)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('detecta mimeType preferencial suportado quando MediaRecorder está disponível', () => {
    const originalMediaRecorder = window.MediaRecorder

    // Mock do MediaRecorder.isTypeSupported
    window.MediaRecorder = {
      isTypeSupported: (mime: string) => mime === 'audio/webm;codecs=opus' || mime === 'audio/mp4',
    } as any

    const mime = getSupportedAudioMimeType()
    expect(mime).toBe('audio/webm;codecs=opus')

    window.MediaRecorder = originalMediaRecorder
  })

  it('retorna fallback audio/mp4 no Safari onde apenas audio/mp4 é suportado', () => {
    const originalMediaRecorder = window.MediaRecorder

    window.MediaRecorder = {
      isTypeSupported: (mime: string) => mime === 'audio/mp4',
    } as any

    const mime = getSupportedAudioMimeType()
    expect(mime).toBe('audio/mp4')

    window.MediaRecorder = originalMediaRecorder
  })

  it('retorna string vazia se MediaRecorder não existir no ambiente', () => {
    const originalMediaRecorder = window.MediaRecorder
    delete (window as any).MediaRecorder

    const mime = getSupportedAudioMimeType()
    expect(mime).toBe('')

    window.MediaRecorder = originalMediaRecorder
  })

  it('retorna erro se o áudio estiver vazio ou ausente', async () => {
    const emptyBlob = new Blob([], { type: 'audio/webm' })
    const result = await transcribeVoiceAudio(emptyBlob)

    expect(result.text).toBe('')
    expect(result.error).toMatch(/vazio/i)
  })

  it('envia áudio para a edge function voice-transcribe e retorna texto com sucesso', async () => {
    const fakeBlob = new Blob(['fake audio content'], { type: 'audio/webm' })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ text: 'Almoço 35 reais no débito' }),
    })
    globalThis.fetch = mockFetch

    const result = await transcribeVoiceAudio(fakeBlob)

    expect(result.text).toBe('Almoço 35 reais no débito')
    expect(result.error).toBeUndefined()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('trata erro retornado pela edge function voice-transcribe', async () => {
    const fakeBlob = new Blob(['fake audio content'], { type: 'audio/webm' })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: 'AUDIO_TOO_LARGE',
          message: 'O arquivo de áudio excede o limite máximo de 5MB.',
        }),
    })
    globalThis.fetch = mockFetch

    const result = await transcribeVoiceAudio(fakeBlob)

    expect(result.text).toBe('')
    expect(result.error).toBe('O arquivo de áudio excede o limite máximo de 5MB.')
    expect(result.status).toBe(400)
  })
})
