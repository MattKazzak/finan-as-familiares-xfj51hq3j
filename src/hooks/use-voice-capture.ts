import { useState, useRef, useCallback, useEffect } from 'react'
import { transcribeVoiceAudio, getSupportedAudioMimeType } from '@/services/voice-transcribe'

export type AudioCaptureMode = 'media_recorder' | 'web_speech' | null
export type AudioPermissionStatus = 'idle' | 'granted' | 'denied' | 'unsupported'

export interface UseVoiceCaptureOptions {
  /** Callback opcional chamado quando a transcrição final é concluída com sucesso */
  onTranscriptReady?: (transcript: string) => void
  /** Callback opcional chamado quando ocorre erro */
  onError?: (errorMessage: string) => void
  /** Duração máxima de gravação em segundos (padrão: 60) */
  maxDurationSeconds?: number
}

export interface UseVoiceCaptureReturn {
  isListening: boolean
  isTranscribing: boolean
  audioCaptureMode: AudioCaptureMode
  permissionStatus: AudioPermissionStatus
  errorMessage: string | null
  infoMessage: string | null
  needsAudioResume: boolean
  realAudioLevels: number[]
  audioDetected: boolean
  elapsedSeconds: number
  interimTranscript: string
  startListening: () => Promise<void>
  stopListeningAndProcess: () => Promise<string | null>
  cancelListening: () => void
  retryListening: () => Promise<void>
  clearError: () => void
  resumeAudioContextOnTouch: () => Promise<void>
}

// Erros benignos do Web Speech que NÃO devem abortar a sessão nem setar hadErrorRef
const BENIGN_SPEECH_ERRORS = new Set(['no-speech', 'aborted'])

// Erros fatais que realmente exigem encerramento
const FATAL_SPEECH_ERRORS = new Set([
  'not-allowed',
  'service-not-allowed',
  'permission-denied',
  'audio-capture',
])

export function useVoiceCapture(options: UseVoiceCaptureOptions = {}): UseVoiceCaptureReturn {
  const { onTranscriptReady, onError, maxDurationSeconds = 60 } = options

  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [audioCaptureMode, setAudioCaptureMode] = useState<AudioCaptureMode>(null)
  const [permissionStatus, setPermissionStatus] = useState<AudioPermissionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [needsAudioResume, setNeedsAudioResume] = useState(false)
  const [realAudioLevels, setRealAudioLevels] = useState<number[]>([0.15, 0.25, 0.2, 0.3, 0.15])
  const [audioDetected, setAudioDetected] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [interimTranscript, setInterimTranscript] = useState('')

  // Refs de controle de ciclo de vida
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const recordingTimerRef = useRef<any>(null)
  const userRequestedStopRef = useRef(false)
  const hadFatalErrorRef = useRef(false)
  const infoMessageTimeoutRef = useRef<any>(null)

  // FIX 2: recognitionRef guarda sempre a instância atual e ativa
  const recognitionRef = useRef<any>(null)
  const finalBufferRef = useRef('')
  const latestTranscriptRef = useRef('')

  // Limpeza de buffers e analisadores Web Audio
  const cleanupAudioAnalyser = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      } catch {
        // silenciar
      }
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close().catch(() => {})
      } catch {
        // silenciar
      }
      audioContextRef.current = null
    }
    analyserRef.current = null
    setRealAudioLevels([0.15, 0.25, 0.2, 0.3, 0.15])
    setNeedsAudioResume(false)
  }, [])

  // Parada interna das fontes de captura
  const stopSources = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (infoMessageTimeoutRef.current) {
      clearTimeout(infoMessageTimeoutRef.current)
      infoMessageTimeoutRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // silenciar
      }
    }

    const currentRec = recognitionRef.current
    recognitionRef.current = null
    if (currentRec) {
      try {
        currentRec.stop()
      } catch {
        // silenciar
      }
    }

    cleanupAudioAnalyser()
    setIsListening(false)
    setAudioDetected(false)
    setElapsedSeconds(0)
  }, [cleanupAudioAnalyser])

  // FIX 3: Tentar resume() no próximo toque caso AudioContext tenha ficado suspenso
  const resumeAudioContextOnTouch = useCallback(async () => {
    const ctx = audioContextRef.current
    if (ctx) {
      const currentState = ctx.state as string
      if (currentState === 'suspended') {
        try {
          await ctx.resume()
          if ((ctx.state as string) === 'running') {
            setNeedsAudioResume(false)
          }
        } catch (err) {
          console.warn('[AudioCapture] Erro ao retomar AudioContext no toque:', err)
        }
      } else if (currentState === 'running') {
        setNeedsAudioResume(false)
      }
    }
  }, [])

  // Escuta global por pointerdown/click quando needsAudioResume for true
  useEffect(() => {
    if (!needsAudioResume) return

    const handlePointerResume = () => {
      resumeAudioContextOnTouch()
    }

    window.addEventListener('pointerdown', handlePointerResume, { passive: true })
    window.addEventListener('click', handlePointerResume, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', handlePointerResume)
      window.removeEventListener('click', handlePointerResume)
    }
  }, [needsAudioResume, resumeAudioContextOnTouch])

  // FIX 1 & FIX 2: Fábrica de SpeechRecognition em que TODOS os callbacks
  // referenciam recognitionRef.current — nunca a instância capturada no closure.
  const createRecognitionInstance = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return null

    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      // Confirma que a instância atual no ref é esta mesma
      setIsListening(true)
      setPermissionStatus('granted')
      setErrorMessage(null)
      setElapsedSeconds(0)
    }

    recognition.onaudiostart = () => {
      setAudioDetected(true)
    }

    recognition.onspeechstart = () => {
      setAudioDetected(true)
    }

    recognition.onresult = (event: any) => {
      let sessionFinal = ''
      let sessionInterim = ''

      if (event.results) {
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i]
          const piece = res[0]?.transcript || ''
          if (res.isFinal) {
            sessionFinal = sessionFinal ? `${sessionFinal} ${piece.trim()}` : piece.trim()
          } else {
            sessionInterim = sessionInterim ? `${sessionInterim} ${piece.trim()}` : piece.trim()
          }
        }
      }

      let combinedFinal = finalBufferRef.current.trim()
      if (sessionFinal) {
        combinedFinal = combinedFinal ? `${combinedFinal} ${sessionFinal}` : sessionFinal
      }

      let fullTranscript = combinedFinal
      if (sessionInterim) {
        fullTranscript = fullTranscript ? `${fullTranscript} ${sessionInterim}` : sessionInterim
      }

      fullTranscript = fullTranscript.replace(/\s+/g, ' ').trim()
      latestTranscriptRef.current = fullTranscript
      setInterimTranscript(fullTranscript)
    }

    // FIX 1: onerror - no-speech e aborted são benignos, NÃO encerram a gravação
    recognition.onerror = (event: any) => {
      const errorKind: string = event?.error || ''
      console.warn('[AudioCapture] SpeechRecognition onerror:', errorKind)

      if (BENIGN_SPEECH_ERRORS.has(errorKind)) {
        // Erro benigno: NÃO seta hadFatalErrorRef nem encerra a gravação
        // Mensagem de UI transitória "Estou ouvindo — fale quando quiser"
        if (errorKind === 'no-speech') {
          setInfoMessage('Estou ouvindo — fale quando quiser')
          if (infoMessageTimeoutRef.current) {
            clearTimeout(infoMessageTimeoutRef.current)
          }
          infoMessageTimeoutRef.current = setTimeout(() => {
            setInfoMessage(null)
          }, 4000)
        }
        return
      }

      // Se for erro fatal, registra e encerra
      if (FATAL_SPEECH_ERRORS.has(errorKind)) {
        hadFatalErrorRef.current = true
        recognitionRef.current = null
        setIsListening(false)
        setAudioDetected(false)

        let msg = 'Falha no microfone.'
        if (
          errorKind === 'not-allowed' ||
          errorKind === 'service-not-allowed' ||
          errorKind === 'permission-denied'
        ) {
          setPermissionStatus('denied')
          msg =
            'Permissão de microfone negada. Toque no ícone de cadeado do navegador e libere o microfone.'
        } else if (errorKind === 'audio-capture') {
          msg = 'Nenhum microfone encontrado ou o áudio do aparelho está bloqueado.'
        }

        setErrorMessage(msg)
        onError?.(msg)
        return
      }

      // Outros erros de rede/servidor
      hadFatalErrorRef.current = true
      recognitionRef.current = null
      setIsListening(false)
      setAudioDetected(false)
      const msg =
        errorKind === 'network'
          ? 'Problema de conexão com o serviço de voz. Verifique sua internet.'
          : 'Não consegui entender com clareza. Toque no microfone e tente falar novamente.'
      setErrorMessage(msg)
      onError?.(msg)
    }

    // FIX 2: onend sempre consulta e reconecta via recognitionRef.current
    recognition.onend = () => {
      if (latestTranscriptRef.current.trim()) {
        finalBufferRef.current = latestTranscriptRef.current.trim()
      }

      // Se a parada NÃO foi solicitada pelo usuário e NÃO houve erro fatal, reconecta
      if (!userRequestedStopRef.current && !hadFatalErrorRef.current) {
        console.log(
          '[AudioCapture] Web Speech onend automático — reconectando via recognitionRef.current...',
        )
        try {
          const currentInst = recognitionRef.current
          if (currentInst && typeof currentInst.start === 'function') {
            currentInst.start()
            return
          }
        } catch (reconnectErr) {
          console.warn(
            '[AudioCapture] Falha ao reconectar instância atual, recriando:',
            reconnectErr,
          )
        }

        try {
          const fresh = createRecognitionInstance()
          if (fresh) {
            recognitionRef.current = fresh
            fresh.start()
            return
          }
        } catch (freshErr) {
          console.warn('[AudioCapture] Falha ao iniciar nova instância no onend:', freshErr)
        }
      }

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      recognitionRef.current = null
      setIsListening(false)
      setAudioDetected(false)
    }

    return recognition
  }, [onError])

  // Iniciar captação (MediaRecorder padrão + Fallback Web Speech)
  const startListening = useCallback(async () => {
    userRequestedStopRef.current = false
    hadFatalErrorRef.current = false
    setErrorMessage(null)
    setInfoMessage(null)
    setInterimTranscript('')
    latestTranscriptRef.current = ''
    finalBufferRef.current = ''
    audioChunksRef.current = []
    setElapsedSeconds(0)

    stopSources()

    const hasMediaRecorder =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof window.MediaRecorder !== 'undefined'

    // CAMINHO 1: MediaRecorder com AnalyserNode (PADRÃO sempre que disponível)
    if (hasMediaRecorder) {
      setAudioCaptureMode('media_recorder')

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream

        const audioTrack = stream.getAudioTracks()[0]
        if (audioTrack) {
          audioTrack.onended = () => {
            console.warn('[AudioCapture] Faixa de áudio encerrada pelo sistema.')
            setErrorMessage('Gravação interrompida pelo sistema ou troca de aplicativo.')
            stopSources()
          }
        }

        // Waveform real via AnalyserNode (5 frequências)
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass()

            // FIX 3: resume() visível — se permanecer 'suspended', avisa na UI
            if (audioCtx.state === 'suspended') {
              audioCtx
                .resume()
                .then(() => {
                  if (audioCtx.state === 'suspended') {
                    setNeedsAudioResume(true)
                  } else {
                    setNeedsAudioResume(false)
                  }
                })
                .catch((resErr) => {
                  console.warn('[AudioCapture] Falha ao resumir AudioContext:', resErr)
                  setNeedsAudioResume(true)
                })
            } else {
              setNeedsAudioResume(false)
            }

            const source = audioCtx.createMediaStreamSource(stream)
            const analyser = audioCtx.createAnalyser()
            analyser.fftSize = 64
            source.connect(analyser)

            audioContextRef.current = audioCtx
            analyserRef.current = analyser

            const dataArray = new Uint8Array(analyser.frequencyBinCount)

            const updateWaveform = () => {
              if (!analyserRef.current) return
              analyserRef.current.getByteFrequencyData(dataArray)

              const bandSize = Math.max(1, Math.floor(dataArray.length / 5))
              const bands: number[] = []
              let totalEnergy = 0

              for (let i = 0; i < 5; i++) {
                let sum = 0
                const startIdx = i * bandSize
                const endIdx = Math.min(dataArray.length, startIdx + bandSize)
                for (let j = startIdx; j < endIdx; j++) {
                  sum += dataArray[j]
                }
                const avg = sum / (endIdx - startIdx || 1)
                totalEnergy += avg
                const normalized = Math.max(0.15, Math.min(1.0, avg / 128))
                bands.push(normalized)
              }

              if (totalEnergy > 10) {
                setAudioDetected(true)
              }
              setRealAudioLevels(bands)
              animationFrameRef.current = requestAnimationFrame(updateWaveform)
            }

            animationFrameRef.current = requestAnimationFrame(updateWaveform)
          }
        } catch (ctxErr) {
          console.warn('[AudioCapture] Erro ao criar AudioContext:', ctxErr)
        }

        // MediaRecorder com formato preferido + bitrate otimizado para voz.
        // 32 kbps: qualidade de sobra para fala (Whisper reamostra p/ 16kHz mono) e
        // arquivo ~8x menor que o default (~256 kbps) -> upload e transcrição muito mais rápidos.
        const preferredMime = getSupportedAudioMimeType()
        let recorder: MediaRecorder
        try {
          recorder = preferredMime
            ? new MediaRecorder(stream, { mimeType: preferredMime, audioBitsPerSecond: 32000 })
            : new MediaRecorder(stream, { audioBitsPerSecond: 32000 })
        } catch {
          recorder = new MediaRecorder(stream)
        }

        recorder.ondataavailable = (evt) => {
          if (evt.data && evt.data.size > 0) {
            audioChunksRef.current.push(evt.data)
          }
        }

        // FIX 4: recorder.onerror NÃO chama stopListening() diretamente
        // Registra erro e deixa usuário decidir (Tentar de novo ou digitar)
        recorder.onerror = (recErr: any) => {
          console.warn('[AudioCapture] MediaRecorder onerror:', recErr)
          const errorMsg =
            'Falha na gravação de áudio. Toque em "Tentar de novo" ou digite sua mensagem.'
          setErrorMessage(errorMsg)
          onError?.(errorMsg)
          // NÃO chamamos stopSources() aqui — mantém estado visível
        }

        recorder.onstop = () => {
          cleanupAudioAnalyser()
        }

        mediaRecorderRef.current = recorder
        recorder.start(250)

        setIsListening(true)
        setPermissionStatus('granted')
        setErrorMessage(null)
        setElapsedSeconds(0)

        // Cronômetro
        recordingTimerRef.current = setInterval(() => {
          setElapsedSeconds((prev) => {
            const next = prev + 1
            if (next >= maxDurationSeconds) {
              // Limite atingido
              stopListeningAndProcess()
            }
            return next
          })
        }, 1000)

        return
      } catch (mediaErr: any) {
        console.error('[AudioCapture] Falha no MediaRecorder/getUserMedia:', mediaErr)
        setAudioCaptureMode('media_recorder')

        let msg = `Não foi possível iniciar a gravação (${mediaErr?.message || 'erro de áudio'}).`
        if (
          mediaErr?.name === 'NotAllowedError' ||
          mediaErr?.name === 'PermissionDeniedError' ||
          mediaErr?.name === 'SecurityError'
        ) {
          setPermissionStatus('denied')
          msg = 'Permissão de microfone negada. Libere o microfone nas configurações do navegador.'
        } else if (
          mediaErr?.name === 'NotFoundError' ||
          mediaErr?.name === 'DevicesNotFoundError'
        ) {
          msg = 'Nenhum microfone detectado no aparelho ou áudio bloqueado pelo sistema.'
        }

        setErrorMessage(msg)
        setIsListening(false)
        onError?.(msg)
        return
      }
    }

    // CAMINHO 2: Fallback Web Speech API
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setAudioCaptureMode(null)
      setPermissionStatus('unsupported')
      const msg =
        'Seu navegador não suporta captura por voz nativa nem MediaRecorder. Digite abaixo.'
      setErrorMessage(msg)
      setIsListening(false)
      onError?.(msg)
      return
    }

    setAudioCaptureMode('web_speech')
    try {
      const recognition = createRecognitionInstance()
      if (!recognition) {
        throw new Error('Falha ao instanciar SpeechRecognition')
      }
      recognitionRef.current = recognition
      recognition.start()
      setIsListening(true)
      setPermissionStatus('granted')
      setErrorMessage(null)

      recordingTimerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1
          if (next >= maxDurationSeconds) {
            stopListeningAndProcess()
          }
          return next
        })
      }, 1000)
    } catch (speechErr: any) {
      console.warn('[AudioCapture] Erro síncrono no SpeechRecognition:', speechErr)
      setIsListening(false)
      const msg = 'Não foi possível ativar o microfone do navegador. Digite abaixo.'
      setErrorMessage(msg)
      onError?.(msg)
    }
  }, [cleanupAudioAnalyser, createRecognitionInstance, maxDurationSeconds, onError, stopSources])

  // Parar gravação e transcrever áudio ou retornar texto capturado
  const stopListeningAndProcess = useCallback(async (): Promise<string | null> => {
    userRequestedStopRef.current = true

    const recorder = mediaRecorderRef.current
    const isUsingMediaRecorder = recorder && recorder.state !== 'inactive'

    // Se estiver usando MediaRecorder, aguarda o último chunk e transcreve via Whisper
    if (isUsingMediaRecorder) {
      setIsTranscribing(true)

      try {
        await new Promise<void>((resolve) => {
          if (!recorder) {
            resolve()
            return
          }
          recorder.onstop = () => {
            resolve()
          }
          recorder.stop()
        })
      } catch {
        // silenciar
      }

      stopSources()

      const chunks = audioChunksRef.current
      const mime = recorder?.mimeType || 'audio/webm'
      const audioBlob = new Blob(chunks, { type: mime })
      audioChunksRef.current = []

      if (!audioBlob || audioBlob.size === 0) {
        setIsTranscribing(false)
        const emptyMsg = 'Nenhum áudio foi capturado. Fale algo ou digite abaixo.'
        setErrorMessage(emptyMsg)
        onError?.(emptyMsg)
        return null
      }

      try {
        const transcribeRes = await transcribeVoiceAudio(audioBlob)
        setIsTranscribing(false)

        if (transcribeRes.error || !transcribeRes.text) {
          const errDetail =
            transcribeRes.error ||
            'Não foi possível transcrever sua fala. Digite ou tente novamente.'
          setErrorMessage(errDetail)
          onError?.(errDetail)
          return null
        }

        const recognizedText = transcribeRes.text.trim()
        setInterimTranscript(recognizedText)
        onTranscriptReady?.(recognizedText)
        return recognizedText
      } catch (err: any) {
        setIsTranscribing(false)
        console.warn('[AudioCapture] Erro ao chamar transcribeVoiceAudio:', err)
        const errMsg = 'Falha ao se comunicar com o serviço de transcrição Whisper. Digite abaixo.'
        setErrorMessage(errMsg)
        onError?.(errMsg)
        return null
      }
    }

    // Fallback Web Speech
    const captured = latestTranscriptRef.current.trim() || interimTranscript.trim()
    stopSources()

    if (captured) {
      setInterimTranscript(captured)
      onTranscriptReady?.(captured)
      return captured
    }

    const emptyFallbackMsg = 'Nenhuma fala foi capturada. Fale algo ou digite abaixo.'
    setErrorMessage(emptyFallbackMsg)
    onError?.(emptyFallbackMsg)
    return null
  }, [interimTranscript, onError, onTranscriptReady, stopSources])

  // Cancelar gravação sem transcrever
  const cancelListening = useCallback(() => {
    userRequestedStopRef.current = true
    stopSources()
    audioChunksRef.current = []
    latestTranscriptRef.current = ''
    finalBufferRef.current = ''
    setInterimTranscript('')
    setIsTranscribing(false)
    setInfoMessage(null)
  }, [stopSources])

  // Tentar de novo
  const retryListening = useCallback(async () => {
    setErrorMessage(null)
    setInfoMessage(null)
    await startListening()
  }, [startListening])

  const clearError = useCallback(() => {
    setErrorMessage(null)
  }, [])

  // Desmonte do componente
  useEffect(() => {
    return () => {
      userRequestedStopRef.current = true
      stopSources()
    }
  }, [stopSources])

  return {
    isListening,
    isTranscribing,
    audioCaptureMode,
    permissionStatus,
    errorMessage,
    infoMessage,
    needsAudioResume,
    realAudioLevels,
    audioDetected,
    elapsedSeconds,
    interimTranscript,
    startListening,
    stopListeningAndProcess,
    cancelListening,
    retryListening,
    clearError,
    resumeAudioContextOnTouch,
  }
}
