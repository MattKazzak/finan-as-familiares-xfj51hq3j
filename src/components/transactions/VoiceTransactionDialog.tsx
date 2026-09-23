import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  Volume2,
  AlertCircle,
  Keyboard,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  User,
  PieChart,
  ShieldAlert,
  Radio,
  Loader2,
} from 'lucide-react'
import { parseVoiceInput, ParsedVoiceTransaction } from '@/services/voice-parser'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { createTransaction } from '@/services/transactions'
import { BUCKET_METADATA } from '@/types/budget-presets'
import { BudgetBucket } from '@/types/finance'

interface VoiceTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenManualTransaction: (data: {
    type: 'expense' | 'income'
    amountCents: number
    description: string
    categoryId?: string
    memberId?: string
  }) => void
  onSuccess?: () => void
}

type PermissionStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'

export const VoiceTransactionDialog: React.FC<VoiceTransactionDialogProps> = ({
  open,
  onOpenChange,
  onOpenManualTransaction,
  onSuccess,
}) => {
  const { family, members, currentMember, categories, triggerRefresh } = useFamily()
  const { toast } = useToast()

  // Estados de voz e transcrição
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [parsedResult, setParsedResult] = useState<ParsedVoiceTransaction | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  // Modo digitação manual secundário ("Ou prefere digitar?")
  const [manualTextMode, setManualTextMode] = useState(false)
  const [manualTextInput, setManualTextInput] = useState('')

  // Permissão nativa e status de erro amigável
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Gravação via MediaRecorder (fallback quando SpeechRecognition não existe)
  const [isMediaRecording, setIsMediaRecording] = useState(false)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)

  // Refs de controle
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechDetectedRef = useRef<boolean>(false)

  // Finalizar e fechar todas as faixas do microfone ativas
  const stopAudioTracks = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop()
        })
      } catch (err) {
        console.warn('Erro ao finalizar faixas de áudio:', err)
      }
      streamRef.current = null
    }
  }, [])

  // Parar qualquer gravação ativa e limpar timers
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // silenciar erro
      }
      recognitionRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // silenciar erro
      }
    }

    stopAudioTracks()
    setIsListening(false)
    setIsMediaRecording(false)
  }, [stopAudioTracks])

  // Parar gravação e disparar interpretação com o texto capturado
  const handleStopAndProcess = useCallback(
    (overrideText?: string) => {
      stopListening()

      const textToProcess =
        overrideText !== undefined ? overrideText : `${transcript} ${interimTranscript}`.trim()

      if (!textToProcess) {
        return
      }

      const parsed = parseVoiceInput(textToProcess, categories)
      setParsedResult(parsed)
    },
    [categories, interimTranscript, stopListening, transcript],
  )

  // Timer de ~2.2s de silêncio contínuo para parada automática
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
    }

    silenceTimerRef.current = setTimeout(() => {
      handleStopAndProcess()
    }, 2200)
  }, [handleStopAndProcess])

  // Iniciar reconhecimento de fala nativo (SpeechRecognition) usando a permissão já obtida
  const startSpeechRecognitionFlow = useCallback(
    (SpeechRecognitionClass: any) => {
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort()
          } catch {
            // silenciar erro
          }
        }

        const recognition = new SpeechRecognitionClass()
        recognition.lang = 'pt-BR'
        // continuous = false conforme requisito
        recognition.continuous = false
        recognition.interimResults = true
        recognition.maxAlternatives = 1

        recognition.onstart = () => {
          setIsListening(true)
          setErrorMessage(null)
          speechDetectedRef.current = false
        }

        recognition.onresult = (event: any) => {
          speechDetectedRef.current = true
          resetSilenceTimer()

          let currentInterim = ''
          let currentFinal = ''

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const item = event.results[i]
            if (item.isFinal) {
              currentFinal += item[0].transcript
            } else {
              currentInterim += item[0].transcript
            }
          }

          if (currentFinal) {
            setTranscript((prev) => (prev ? `${prev} ${currentFinal}` : currentFinal))
          }
          setInterimTranscript(currentInterim)
        }

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error)
          if (
            event.error === 'not-allowed' ||
            event.error === 'service-not-allowed' ||
            event.error === 'permission-denied'
          ) {
            setPermissionStatus('denied')
            setErrorMessage('Acesso ao microfone foi negado.')
          } else if (event.error === 'no-speech') {
            // Silêncio / sem fala detectada
            setIsListening(false)
          } else if (event.error === 'network') {
            setErrorMessage(
              'Falha de conexão com o serviço de voz. Verifique sua internet ou tente novamente.',
            )
          } else {
            setErrorMessage('Não conseguimos ouvir com clareza. Tente falar novamente.')
          }
          setIsListening(false)
        }

        recognition.onend = () => {
          setIsListening(false)
          // Se contínuo = false parou e temos transcrição capturada, processar
          setTranscript((currTranscript) => {
            setInterimTranscript((currInterim) => {
              const full = `${currTranscript} ${currInterim}`.trim()
              if (full && !parsedResult) {
                const parsed = parseVoiceInput(full, categories)
                setParsedResult(parsed)
              }
              return currInterim
            })
            return currTranscript
          })
          stopAudioTracks()
        }

        recognitionRef.current = recognition
        recognition.start()
      } catch (err: any) {
        console.warn('Erro ao inicializar SpeechRecognition:', err)
        setErrorMessage('Não foi possível iniciar o reconhecimento de voz. Tente novamente.')
        setIsListening(false)
        stopAudioTracks()
      }
    },
    [categories, parsedResult, resetSilenceTimer, stopAudioTracks],
  )

  // Iniciar fallback com MediaRecorder quando SpeechRecognition não existe nativamente
  const startMediaRecorderFallback = useCallback(
    (stream: MediaStream) => {
      try {
        audioChunksRef.current = []

        // Encontrar mimeType suportado
        let mimeType = ''
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus'
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm'
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4'
          } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            mimeType = 'audio/ogg'
          }
        }

        const options = mimeType ? { mimeType } : undefined
        const mediaRecorder = new MediaRecorder(stream, options)

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }

        mediaRecorder.onstart = () => {
          setIsListening(true)
          setIsMediaRecording(true)
          setErrorMessage(null)
          resetSilenceTimer()
        }

        mediaRecorder.onstop = async () => {
          setIsListening(false)
          setIsMediaRecording(false)
          stopAudioTracks()

          // Fallback gracioso: orientar para digitação com o texto capturado ou campo ativo
          setIsProcessingAudio(false)
        }

        mediaRecorderRef.current = mediaRecorder
        mediaRecorder.start(200)
      } catch (err) {
        console.warn('Erro ao iniciar MediaRecorder fallback:', err)
        setErrorMessage(
          'Reconhecimento de voz não suportado pelo navegador. Você pode digitar abaixo.',
        )
        setManualTextMode(true)
        stopAudioTracks()
      }
    },
    [resetSilenceTimer, stopAudioTracks],
  )

  // Função central: SOLICITAÇÃO ATIVA DE PERMISSÃO (nativa do SO)
  // const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const requestMicAndStartListening = useCallback(async () => {
    setErrorMessage(null)
    setPermissionStatus('requesting')

    if (!navigator?.mediaDevices?.getUserMedia) {
      setPermissionStatus('unsupported')
      setErrorMessage(
        'Seu navegador não possui suporte para acesso ao microfone. Use a digitação abaixo.',
      )
      setManualTextMode(true)
      return
    }

    try {
      // 1. Chamada OBRIGATÓRIA ao getUserMedia nativo do SO
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setPermissionStatus('granted')

      // Verificar suporte a SpeechRecognition
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (SpeechRecognitionClass) {
        // Fluxo com SpeechRecognition nativo
        startSpeechRecognitionFlow(SpeechRecognitionClass)
      } else {
        // Fluxo fallback com MediaRecorder autorizado
        startMediaRecorderFallback(stream)
      }
    } catch (err: any) {
      console.warn('Erro ao obter permissão de microfone:', err)
      stopAudioTracks()

      if (
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.message?.includes?.('Permission denied')
      ) {
        setPermissionStatus('denied')
        setErrorMessage('Permissão para uso do microfone foi negada.')
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setPermissionStatus('unsupported')
        setErrorMessage('Nenhum microfone foi encontrado no seu aparelho.')
      } else {
        setPermissionStatus('denied')
        setErrorMessage('Não foi possível acessar o microfone. Verifique as configurações.')
      }
    }
  }, [startMediaRecorderFallback, startSpeechRecognitionFlow, stopAudioTracks])

  // Resetar e iniciar gravação ao abrir/fechar o modal
  useEffect(() => {
    if (open) {
      setTranscript('')
      setInterimTranscript('')
      setParsedResult(null)
      setManualTextMode(false)
      setManualTextInput('')
      setErrorMessage(null)
      setSelectedMemberId(currentMember?.id || members[0]?.id || '')

      // Disparar imediatamente a solicitação de permissão nativa
      requestMicAndStartListening()
    } else {
      stopListening()
      setPermissionStatus('idle')
    }

    return () => {
      stopListening()
    }
  }, [open, currentMember?.id, members, requestMicAndStartListening, stopListening])

  // Submeter modo texto manual ("Ou prefere digitar?")
  const handleManualTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualTextInput.trim()) return
    handleStopAndProcess(manualTextInput.trim())
  }

  // Confirmar lançamento diretamente
  const handleConfirmTransaction = async () => {
    if (!family || !parsedResult) return

    if (parsedResult.amountCents <= 0) {
      toast({
        title: 'Valor não identificado',
        description:
          'Não conseguimos identificar o valor em reais. Toque em "Ajustar" para preencher.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSaving(true)

      // Identificar categoria correspondente
      const targetCategory = categories.find((c) => {
        if (c.type !== parsedResult.type) return false
        if (parsedResult.categoryNameSuggestion) {
          return c.name.toLowerCase() === parsedResult.categoryNameSuggestion.toLowerCase()
        }
        return false
      })

      const categoryId = targetCategory?.id || null
      const memberId = selectedMemberId || currentMember?.id || members[0]?.id || null

      await createTransaction({
        family_id: family.id,
        member_id: memberId,
        category_id: categoryId,
        subcategory_id: null,
        type: parsedResult.type,
        amount_cents: parsedResult.amountCents,
        description: parsedResult.description || 'Lançamento por Voz',
        transaction_date: new Date().toISOString().slice(0, 10),
        status: 'confirmed',
      })

      toast({
        title: 'Lançamento registrado com sucesso! 🎉',
        description: `${parsedResult.description} (${parsedResult.amountFormatted}) adicionado ao saldo da família.`,
      })

      triggerRefresh()
      if (onSuccess) onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao salvar lançamento de voz:', err)
      toast({
        title: 'Erro ao registrar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Abrir formulário manual já pré-preenchido
  const handleAdjustManually = () => {
    if (!parsedResult) return

    const targetCategory = categories.find((c) => {
      if (c.type !== parsedResult.type) return false
      if (parsedResult.categoryNameSuggestion) {
        return c.name.toLowerCase() === parsedResult.categoryNameSuggestion.toLowerCase()
      }
      return false
    })

    onOpenChange(false)
    onOpenManualTransaction({
      type: parsedResult.type,
      amountCents: parsedResult.amountCents,
      description: parsedResult.description,
      categoryId: targetCategory?.id,
      memberId: selectedMemberId || currentMember?.id || members[0]?.id,
    })
  }

  const currentDisplaySpeech = `${transcript} ${interimTranscript}`.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 sm:max-w-lg shadow-2xl">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4 text-emerald-700" />
            </span>
            <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight">
              Lançamento por Voz com IA
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Fale naturalmente sua despesa ou receita. Nossa inteligência local extrai valor, balde e
            categoria.
          </DialogDescription>
        </DialogHeader>

        {/* ================= ESTADO 1: ESCUTANDO / CAPTURA DE ÁUDIO ================= */}
        {!parsedResult ? (
          <div className="space-y-4 pt-2">
            {/* 1.1 CASO: Permissão Negada (NotAllowedError) */}
            {permissionStatus === 'denied' && (
              <div className="flex flex-col items-center justify-center py-6 px-4 bg-rose-50/80 rounded-2xl border border-rose-200 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-sm font-bold text-rose-950">Acesso ao microfone negado</h4>
                  <p className="text-xs text-rose-800">
                    {errorMessage ||
                      'O Curiangoo precisa da permissão do microfone para ouvir seu lançamento por voz.'}
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={requestMicAndStartListening}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-sm gap-2 mt-2"
                >
                  <Mic className="w-4 h-4" />
                  Toque aqui para autorizar o microfone e tentar novamente
                </Button>
              </div>
            )}

            {/* 1.2 CASO: Normal (Ouvindo ou pronto para ouvir) */}
            {permissionStatus !== 'denied' && (
              <div className="flex flex-col items-center justify-center py-6 px-4 bg-gradient-to-b from-emerald-50/70 to-slate-50 rounded-2xl border border-emerald-100 text-center relative overflow-hidden">
                {/* Animação de Ondas Sonoras / Pulso Verde */}
                <div className="relative mb-4 flex items-center justify-center">
                  {isListening ? (
                    <>
                      <div className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
                      <div className="absolute w-24 h-24 rounded-full bg-emerald-500/30 animate-pulse pointer-events-none" />
                      <button
                        type="button"
                        onClick={stopListening}
                        className="w-16 h-16 rounded-full bg-[#064E3B] text-white flex items-center justify-center shadow-lg shadow-emerald-900/30 z-10 transition-transform active:scale-95"
                        title="Toque para pausar"
                      >
                        <Mic className="w-8 h-8 animate-pulse text-emerald-300" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={requestMicAndStartListening}
                      disabled={permissionStatus === 'requesting'}
                      className="w-16 h-16 rounded-full bg-slate-200 text-slate-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center shadow-md transition-all active:scale-95"
                      title="Toque para começar a falar"
                    >
                      {permissionStatus === 'requesting' ? (
                        <Loader2 className="w-7 h-7 animate-spin text-emerald-700" />
                      ) : (
                        <MicOff className="w-7 h-7" />
                      )}
                    </button>
                  )}
                </div>

                {/* Status textual com texto EXATO solicitado: "Ouvindo... pode falar" */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    {isListening ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ouvindo... pode falar
                      </>
                    ) : permissionStatus === 'requesting' ? (
                      'Solicitando permissão...'
                    ) : (
                      'Microfone pausado'
                    )}
                  </span>
                  {isMediaRecording && (
                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                      Captura de áudio de alta fidelidade
                    </span>
                  )}
                </div>

                {/* Exibição da Transcrição Falada */}
                <div className="mt-3 min-h-[48px] max-w-sm flex items-center justify-center">
                  {currentDisplaySpeech ? (
                    <p className="text-sm font-semibold text-slate-800 italic leading-snug break-words px-2">
                      &ldquo;{currentDisplaySpeech}&rdquo;
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Exemplo: &ldquo;Almoço 45 reais no débito&rdquo; ou &ldquo;Cerveja na
                      mercearia 60&rdquo;
                    </p>
                  )}
                </div>

                {/* Mensagem amigável de erro se houver */}
                {errorMessage && (
                  <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Barrinhas de áudio visual verdes animadas quando ouvindo */}
                {isListening && (
                  <div className="flex items-center gap-1.5 mt-4">
                    <span className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="w-1 h-5 bg-emerald-600 rounded-full animate-bounce delay-75" />
                    <span className="w-1 h-8 bg-emerald-500 rounded-full animate-pulse delay-100" />
                    <span className="w-1 h-4 bg-emerald-600 rounded-full animate-bounce delay-150" />
                    <span className="w-1 h-7 bg-emerald-500 rounded-full animate-pulse delay-200" />
                    <span className="w-1 h-4 bg-emerald-600 rounded-full animate-bounce delay-100" />
                    <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
            )}

            {/* Ações do microfone: Recomeçar e Parar e Processar */}
            {permissionStatus !== 'denied' && (
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTranscript('')
                    setInterimTranscript('')
                    requestMicAndStartListening()
                  }}
                  className="text-xs rounded-xl"
                >
                  Recomeçar
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={!currentDisplaySpeech && !isMediaRecording}
                  onClick={() => handleStopAndProcess()}
                  className="bg-[#064E3B] hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  {isProcessingAudio ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Processando...
                    </>
                  ) : (
                    'Parar e Processar'
                  )}
                </Button>
              </div>
            )}

            {/* ALTERNATIVA SECUNDÁRIA: "Ou prefere digitar?" SEMPRE disponível abaixo */}
            <div className="pt-2 border-t border-slate-100">
              {!manualTextMode ? (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setManualTextMode(true)
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1.5 transition-colors py-1 px-2 rounded-lg hover:bg-slate-50"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ou prefere digitar?</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleManualTextSubmit} className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Keyboard className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Ou prefere digitar?</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setManualTextMode(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                    >
                      Ocultar digitação
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={manualTextInput}
                      onChange={(e) => setManualTextInput(e.target.value)}
                      placeholder="Ex: Almoço 45 reais no débito"
                      className="rounded-xl h-10 text-xs bg-white flex-1"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      disabled={!manualTextInput.trim()}
                      className="bg-[#064E3B] hover:bg-emerald-900 text-white rounded-xl font-bold text-xs h-10 px-3.5 gap-1.5 shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Interpretar
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* ================= ESTADO 2: RESUMO VISUAL LIMPO (ZERO FRICÇÃO) ================= */
          <div className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
            {/* Frase original */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-2.5">
              <Volume2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Você disse
                </span>
                <p className="text-xs font-medium text-slate-800 truncate">
                  &ldquo;{parsedResult.rawText}&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setParsedResult(null)
                  setTranscript('')
                  setInterimTranscript('')
                  requestMicAndStartListening()
                }}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline shrink-0"
              >
                Falar de novo
              </button>
            </div>

            {/* CARD HERO DE INTERPRETAÇÃO */}
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white p-4 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs ${
                      parsedResult.type === 'income' ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    {parsedResult.type === 'income' ? (
                      <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                    )}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {parsedResult.type === 'income' ? 'Receita Detectada' : 'Despesa Detectada'}
                  </span>
                </div>

                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {Math.round(parsedResult.confidence * 100)}% precisão
                </span>
              </div>

              {/* Descrição e Valor Gigante */}
              <div>
                <h4 className="text-lg font-bold text-slate-900 leading-snug break-words">
                  {parsedResult.description}
                </h4>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                    {parsedResult.amountCents > 0 ? parsedResult.amountFormatted : 'R$ 0,00'}
                  </span>
                  {parsedResult.amountCents === 0 && (
                    <span className="text-[11px] font-semibold text-rose-600">
                      (Valor não identificado — toque em Ajustar)
                    </span>
                  )}
                </div>
              </div>

              {/* Chips de Metadados Inteligentes (Balde, Categoria, Pagamento, Membro) */}
              <div className="pt-2 border-t border-emerald-200/60 grid grid-cols-2 gap-2 text-xs">
                {/* 1. Balde dos 3 Baldes */}
                <div className="bg-white/80 border border-slate-200/70 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    <PieChart className="w-3 h-3 text-emerald-700" />
                    <span>Balde Orçamentário</span>
                  </div>
                  <div className="mt-1">
                    {parsedResult.bucketSuggestion ? (
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded-md inline-block ${
                          BUCKET_METADATA[
                            (parsedResult.bucketSuggestion === 'goals'
                              ? 'future'
                              : parsedResult.bucketSuggestion === 'essential'
                                ? 'essentials'
                                : parsedResult.bucketSuggestion) as BudgetBucket
                          ]?.bgLight || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {BUCKET_METADATA[
                          (parsedResult.bucketSuggestion === 'goals'
                            ? 'future'
                            : parsedResult.bucketSuggestion === 'essential'
                              ? 'essentials'
                              : parsedResult.bucketSuggestion) as BudgetBucket
                        ]?.shortLabel || 'Estilo de Vida'}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">Estilo de Vida</span>
                    )}
                  </div>
                </div>

                {/* 2. Categoria Sugerida */}
                <div className="bg-white/80 border border-slate-200/70 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    <Sparkles className="w-3 h-3 text-emerald-700" />
                    <span>Categoria</span>
                  </div>
                  <div className="mt-1 font-bold text-xs text-slate-800 truncate">
                    {parsedResult.categoryNameSuggestion || 'Geral / Outros'}
                  </div>
                </div>

                {/* 3. Método de Pagamento */}
                <div className="bg-white/80 border border-slate-200/70 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    <CreditCard className="w-3 h-3 text-emerald-700" />
                    <span>Pagamento</span>
                  </div>
                  <div className="mt-1 font-bold text-xs text-slate-800 capitalize">
                    {parsedResult.paymentMethod || 'Não especificado'}
                  </div>
                </div>

                {/* 4. Membro Familiar Atribuído */}
                <div className="bg-white/80 border border-slate-200/70 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    <User className="w-3 h-3 text-emerald-700" />
                    <span>Membro</span>
                  </div>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="mt-1 w-full text-xs font-bold text-slate-800 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO: [ Ajustar ] e [ ✅ Confirmar Lançamento ] */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleAdjustManually}
                className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-11 gap-1.5"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Ajustar
              </Button>

              <Button
                type="button"
                onClick={handleConfirmTransaction}
                disabled={isSaving || parsedResult.amountCents <= 0}
                className="bg-[#064E3B] hover:bg-emerald-900 text-white rounded-xl font-bold text-xs h-11 gap-2 shadow-sm transition-all"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                {isSaving ? 'Salvando...' : '✅ Confirmar Lançamento'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
