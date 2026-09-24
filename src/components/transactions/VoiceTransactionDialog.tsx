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
  Tag,
  HelpCircle,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { ParsedVoiceTransaction } from '@/services/voice-parser'
import { parseVoiceWithAi } from '@/services/voice-ai'
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
  const { family, members, currentMember, categories, triggerRefresh, addNewSubcategory } =
    useFamily()
  const { toast } = useToast()

  // Estados de voz e transcrição
  const [isListening, setIsListening] = useState(false)
  const [audioDetected, setAudioDetected] = useState(false)
  const [textoFalado, setTextoFalado] = useState('')
  const [isProcessingAi, setIsProcessingAi] = useState(false)
  const [parsedResult, setParsedResult] = useState<ParsedVoiceTransaction | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  // Permissão nativa e status de erro amigável
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Estado específico para o fluxo 'falta_valor'
  const [missingAmountInput, setMissingAmountInput] = useState('')
  const [isListeningForAmountOnly, setIsListeningForAmountOnly] = useState(false)
  const missingAmountInputRef = useRef<HTMLInputElement | null>(null)

  // Refs de controle
  const recognitionRef = useRef<any>(null)
  const latestTranscriptRef = useRef<string>('')
  const hadErrorRef = useRef<boolean>(false)
  const silenceTimerRef = useRef<any>(null)
  const shouldKeepListeningRef = useRef<boolean>(false)
  const userStoppedManuallyRef = useRef<boolean>(false)
  const isListeningForAmountOnlyRef = useRef<boolean>(false)
  const parsedResultRef = useRef<ParsedVoiceTransaction | null>(null)

  // Manter refs sincronizadas
  useEffect(() => {
    parsedResultRef.current = parsedResult
  }, [parsedResult])

  useEffect(() => {
    isListeningForAmountOnlyRef.current = isListeningForAmountOnly
  }, [isListeningForAmountOnly])

  // Limpar timer de silêncio
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  // Parar gravação ativa
  const stopListening = useCallback(() => {
    clearSilenceTimer()
    shouldKeepListeningRef.current = false
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // silenciar erro
      }
      recognitionRef.current = null
    }
    setIsListening(false)
    setAudioDetected(false)
    setIsListeningForAmountOnly(false)
  }, [clearSilenceTimer])

  // Parar gravação e disparar interpretação com IA (Edge Function)
  const handleStopAndProcess = useCallback(
    async (overrideText?: string) => {
      stopListening()

      const textToProcess = (
        overrideText !== undefined ? overrideText : latestTranscriptRef.current
      ).trim()

      if (!textToProcess) {
        return
      }

      try {
        setIsProcessingAi(true)
        const parsed = await parseVoiceWithAi({
          texto: textToProcess,
          familyId: family?.id,
          categories,
        })
        setParsedResult(parsed)
      } catch (err: any) {
        console.error('Erro ao processar áudio com IA:', err)
      } finally {
        setIsProcessingAi(false)
      }
    },
    [categories, family?.id, stopListening],
  )

  // Mesclar novo valor com transação parcial existente em 'falta_valor'
  const handleMergeAmountIntoTransaction = useCallback(
    (newAmountCents: number, paymentMethodOverride?: 'pix' | 'debito' | 'credito' | 'dinheiro') => {
      const base = parsedResultRef.current
      if (!base || newAmountCents <= 0) return

      const formatted = (newAmountCents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })

      setParsedResult({
        ...base,
        amountCents: newAmountCents,
        amountFormatted: formatted,
        paymentMethod: paymentMethodOverride || base.paymentMethod,
        aiStatus: 'sucesso',
        confidence: 0.95,
        clarificationQuestion: null,
        clarificationOptions: null,
        friendlyMessage: null,
      })
      setMissingAmountInput('')
      setIsListeningForAmountOnly(false)
    },
    [],
  )

  // Iniciar SpeechRecognition síncrono no evento de clique
  // options?: { forAmountOnly?: boolean }
  const startRecording = useCallback(
    (options?: { forAmountOnly?: boolean }) => {
      const isForAmount = Boolean(options?.forAmountOnly)
      setIsListeningForAmountOnly(isForAmount)
      isListeningForAmountOnlyRef.current = isForAmount

      // 1. Limpar estados anteriores
      setErrorMessage(null)
      hadErrorRef.current = false
      userStoppedManuallyRef.current = false
      shouldKeepListeningRef.current = true
      setAudioDetected(false)
      clearSilenceTimer()

      // Parar reconhecimento anterior se existir
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // silenciar
        }
        recognitionRef.current = null
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (!SpeechRecognition) {
        setPermissionStatus('unsupported')
        setErrorMessage(
          'Seu navegador não suporta reconhecimento de voz nativo. Digite abaixo e toque em "Processar com IA".',
        )
        setIsListening(false)
        return
      }

      try {
        const recognition = new SpeechRecognition()
        recognition.lang = 'pt-BR'
        // MELHORIA 1: continuous = true para não fechar antecipadamente
        recognition.continuous = true
        recognition.interimResults = true
        recognition.maxAlternatives = 1

        recognition.onstart = () => {
          setIsListening(true)
          setPermissionStatus('granted')
          setErrorMessage(null)
        }

        // Tratamento dos Eventos de Áudio: onaudiostart / onspeechstart
        recognition.onaudiostart = () => {
          setAudioDetected(true)
        }
        recognition.onspeechstart = () => {
          setAudioDetected(true)
        }

        // Função para processar quando o silêncio de 3s expira de fato
        const triggerFinalProcessing = () => {
          clearSilenceTimer()
          shouldKeepListeningRef.current = false

          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop()
            } catch {
              // silenciar
            }
          }
          setIsListening(false)
          setAudioDetected(false)

          const captured = latestTranscriptRef.current.trim()
          if (!captured) {
            setIsListeningForAmountOnly(false)
            return
          }

          if (isListeningForAmountOnlyRef.current && parsedResultRef.current) {
            setIsProcessingAi(true)
            parseVoiceWithAi({
              texto: captured,
              familyId: family?.id,
              categories,
            })
              .then((amountParsed) => {
                if (amountParsed.amountCents > 0) {
                  handleMergeAmountIntoTransaction(
                    amountParsed.amountCents,
                    amountParsed.paymentMethod,
                  )
                } else {
                  toast({
                    title: 'Valor não identificado',
                    description:
                      'Não conseguimos identificar o valor falado. Tente digitar ou falar novamente.',
                    variant: 'destructive',
                  })
                }
              })
              .catch((err) => {
                console.error('Erro ao interpretar áudio de valor:', err)
              })
              .finally(() => {
                setIsProcessingAi(false)
                setIsListeningForAmountOnly(false)
              })
          } else {
            handleStopAndProcess(captured)
          }
        }

        // Função de finalização por timeout de silêncio (3000ms após última fala)
        const scheduleSilenceProcessing = () => {
          clearSilenceTimer()
          silenceTimerRef.current = setTimeout(() => {
            triggerFinalProcessing()
          }, 3000)
        }

        // onresult: captura resultados parciais e finais em tempo real acumulando em latestTranscriptRef
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('')
          latestTranscriptRef.current = transcript
          setTextoFalado(transcript)

          // Reiniciar timer humanizado de 3s a cada fala detectada
          scheduleSilenceProcessing()
        }

        // onerror: tratamento amigável sem fechar o diálogo
        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition onerror:', event.error)
          hadErrorRef.current = true
          shouldKeepListeningRef.current = false
          clearSilenceTimer()
          setIsListening(false)
          setAudioDetected(false)
          setIsListeningForAmountOnly(false)

          if (
            event.error === 'not-allowed' ||
            event.error === 'service-not-allowed' ||
            event.error === 'permission-denied'
          ) {
            setPermissionStatus('denied')
            setErrorMessage(
              'Permissão de microfone negada. Toque no ícone de cadeado/configurações ao lado do link no navegador e libere o Microfone para este site.',
            )
          } else if (event.error === 'no-speech') {
            setErrorMessage(
              'Não consegui te ouvir. Toque no microfone novamente e fale um pouco mais perto.',
            )
          } else if (event.error === 'network') {
            setErrorMessage('Problema de conexão. Verifique sua internet e tente novamente.')
          } else if (event.error === 'audio-capture') {
            setErrorMessage('Nenhum microfone encontrado ou o áudio do aparelho está bloqueado.')
          } else {
            setErrorMessage(
              'Não consegui entender com clareza. Toque no microfone e tente falar novamente.',
            )
          }
        }

        // onend: se fechamento prematuro pelo navegador mobile antes dos 3s e sem parada manual -> REINICIAR
        recognition.onend = () => {
          // (a) Se ainda deve continuar ouvindo (silêncio de 3s NÃO expirou e usuário não parou manualmente nem houve erro)
          if (
            shouldKeepListeningRef.current &&
            !userStoppedManuallyRef.current &&
            !hadErrorRef.current
          ) {
            try {
              // Reinicia o reconhecimento mantendo o texto acumulado em latestTranscriptRef
              recognition.start()
              setIsListening(true)
              return
            } catch (restartErr) {
              // Se falhar (ex: InvalidStateError porque já está rodando ou estado travado), continua fluxo normal
              console.warn('Erro ao reiniciar recognition no onend prematuro:', restartErr)
            }
          }

          // (b) Silêncio expirou ou usuário parou manualmente ou erro
          clearSilenceTimer()
          setIsListening(false)
          setAudioDetected(false)
          recognitionRef.current = null

          const finalCapturado = latestTranscriptRef.current.trim()

          // Se a parada foi manual pelo usuário, processa imediatamente o que tiver acumulado
          if (userStoppedManuallyRef.current && finalCapturado && !hadErrorRef.current) {
            userStoppedManuallyRef.current = false
            shouldKeepListeningRef.current = false

            if (isListeningForAmountOnlyRef.current && parsedResultRef.current) {
              setIsProcessingAi(true)
              parseVoiceWithAi({
                texto: finalCapturado,
                familyId: family?.id,
                categories,
              })
                .then((amountParsed) => {
                  if (amountParsed.amountCents > 0) {
                    handleMergeAmountIntoTransaction(
                      amountParsed.amountCents,
                      amountParsed.paymentMethod,
                    )
                  } else {
                    toast({
                      title: 'Valor não identificado',
                      description:
                        'Não conseguimos identificar o valor falado. Digite ou fale novamente.',
                      variant: 'destructive',
                    })
                  }
                })
                .catch((err) => {
                  console.error('Erro ao interpretar áudio de valor no onend manual:', err)
                })
                .finally(() => {
                  setIsProcessingAi(false)
                  setIsListeningForAmountOnly(false)
                })
            } else {
              handleStopAndProcess(finalCapturado)
            }
          } else if (!shouldKeepListeningRef.current) {
            setIsListeningForAmountOnly(false)
          }
        }

        recognitionRef.current = recognition
        // Disparo imediato e síncrono
        recognition.start()
        setIsListening(true)
      } catch (err: any) {
        console.warn('Erro síncrono ao iniciar SpeechRecognition:', err)
        clearSilenceTimer()
        shouldKeepListeningRef.current = false
        setIsListening(false)
        setAudioDetected(false)
        setIsListeningForAmountOnly(false)
        setErrorMessage(
          'Não foi possível ativar o microfone. Você pode digitar abaixo e processar com IA.',
        )
      }
    },
    [
      categories,
      clearSilenceTimer,
      family?.id,
      handleMergeAmountIntoTransaction,
      handleStopAndProcess,
      toast,
    ],
  )

  // Auto-foco no input de valor quando entra no estado 'falta_valor'
  useEffect(() => {
    if (parsedResult?.aiStatus === 'falta_valor') {
      const timer = setTimeout(() => {
        missingAmountInputRef.current?.focus()
      }, 80)
      return () => clearTimeout(timer)
    }
  }, [parsedResult?.aiStatus])

  // Resetar ao abrir/fechar o modal
  useEffect(() => {
    if (open) {
      setTextoFalado('')
      latestTranscriptRef.current = ''
      setParsedResult(null)
      setErrorMessage(null)
      setMissingAmountInput('')
      setIsListeningForAmountOnly(false)
      hadErrorRef.current = false
      userStoppedManuallyRef.current = false
      shouldKeepListeningRef.current = false
      setAudioDetected(false)
      setIsProcessingAi(false)
      setSelectedMemberId(currentMember?.id || members[0]?.id || '')
      setPermissionStatus('idle')

      // Iniciar escuta síncrona imediatamente ao abrir o diálogo
      startRecording()
    } else {
      stopListening()
      setPermissionStatus('idle')
      setIsProcessingAi(false)
      setMissingAmountInput('')
      setIsListeningForAmountOnly(false)
    }

    return () => {
      stopListening()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Submeter modo texto manual
  const handleManualTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    clearSilenceTimer()
    if (!textoFalado.trim()) return
    handleStopAndProcess(textoFalado.trim())
  }

  // Confirmar valor digitado no estado 'falta_valor'
  const handleConfirmMissingAmount = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!parsedResult) return

    // Converte valor digitado (ex: "45,50" ou "45") para centavos
    const cleaned = missingAmountInput.replace(/[^\d,.]/g, '').replace(',', '.')
    const parsedNumber = parseFloat(cleaned)
    const cents = !isNaN(parsedNumber) && parsedNumber > 0 ? Math.round(parsedNumber * 100) : 0

    if (cents <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Digite um valor em reais maior que zero.',
        variant: 'destructive',
      })
      return
    }

    handleMergeAmountIntoTransaction(cents)
  }

  // Ação ao clicar em uma opção de sugestão da IA no estado "clarificacao"
  const handleSelectClarificationOption = (option: string) => {
    if (!parsedResult) return

    // Só permite transicionar para sucesso se o valor for válido (> 0)
    if (parsedResult.amountCents <= 0) {
      setParsedResult((prev) => (prev ? { ...prev, aiStatus: 'invalido' } : null))
      return
    }

    // Opção pode ser "Categoria / Subcategoria" ou nome simples
    const parts = option.split('/').map((p) => p.trim())
    const catName = parts[0]
    const subName = parts[1] || ''

    // Procurar categoria compatível
    const matchedCategory = categories.find(
      (c) =>
        c.type === parsedResult.type &&
        (c.name.toLowerCase() === catName.toLowerCase() ||
          c.name.toLowerCase().includes(catName.toLowerCase()) ||
          catName.toLowerCase().includes(c.name.toLowerCase())),
    )

    // Atualiza o resultado para o estado de sucesso
    setParsedResult((prev) => {
      if (!prev) return null
      return {
        ...prev,
        aiStatus: 'sucesso',
        categoryNameSuggestion: matchedCategory ? matchedCategory.name : catName,
        subcategoryNameSuggestion: subName || prev.subcategoryNameSuggestion,
        bucketSuggestion:
          (matchedCategory?.budget_bucket as any) ||
          (catName.toLowerCase().includes('transporte') ||
          catName.toLowerCase().includes('alimenta') ||
          catName.toLowerCase().includes('saude')
            ? 'essential'
            : 'lifestyle'),
        confidence: 0.9,
        clarificationQuestion: null,
        clarificationOptions: null,
      }
    })
  }

  // Tentar novamente (voltar à escuta)
  const handleRetryListening = () => {
    setParsedResult(null)
    setTextoFalado('')
    setMissingAmountInput('')
    setIsListeningForAmountOnly(false)
    latestTranscriptRef.current = ''
    startRecording()
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
      let targetCategory = categories.find((c) => {
        if (c.type !== parsedResult.type) return false
        if (parsedResult.categoryNameSuggestion) {
          return c.name.toLowerCase() === parsedResult.categoryNameSuggestion.toLowerCase()
        }
        return false
      })

      // Se não encontrou exata, tenta parcial
      if (!targetCategory && parsedResult.categoryNameSuggestion) {
        targetCategory = categories.find(
          (c) =>
            c.type === parsedResult.type &&
            (c.name.toLowerCase().includes(parsedResult.categoryNameSuggestion!.toLowerCase()) ||
              parsedResult.categoryNameSuggestion!.toLowerCase().includes(c.name.toLowerCase())),
        )
      }

      // Se ainda não encontrou, pega a primeira categoria do tipo
      if (!targetCategory) {
        targetCategory = categories.find((c) => c.type === parsedResult.type)
      }

      const categoryId = targetCategory?.id || null
      let subcategoryId: string | null = null

      // Se a IA sugeriu subcategoria, verifica se existe ou cria dinamicamente
      if (targetCategory && parsedResult.subcategoryNameSuggestion) {
        const subName = parsedResult.subcategoryNameSuggestion.trim()
        const existingSub = targetCategory.subcategories?.find(
          (s) => s.name.toLowerCase() === subName.toLowerCase(),
        )

        if (existingSub) {
          subcategoryId = existingSub.id
        } else if (subName) {
          try {
            const createdSub = await addNewSubcategory(targetCategory.id, subName)
            if (createdSub?.id) {
              subcategoryId = createdSub.id
            }
          } catch (subErr) {
            console.warn('Não foi possível auto-criar subcategoria:', subErr)
          }
        }
      }

      const memberId = selectedMemberId || currentMember?.id || members[0]?.id || null

      await createTransaction({
        family_id: family.id,
        member_id: memberId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
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

  const currentDisplaySpeech = textoFalado.trim()
  // Regra 1: Confirmação só abre se, e SOMENTE SE, a resposta tiver status === 'sucesso' E houver um valor numérico válido (> 0)
  const isConfirmationAllowed =
    Boolean(parsedResult) &&
    parsedResult?.aiStatus === 'sucesso' &&
    typeof parsedResult?.amountCents === 'number' &&
    parsedResult.amountCents > 0

  // Regra 2: Clarificação com valor existente (> 0)
  const isClarification =
    Boolean(parsedResult) &&
    !isConfirmationAllowed &&
    parsedResult?.aiStatus === 'clarificacao' &&
    typeof parsedResult?.amountCents === 'number' &&
    parsedResult.amountCents > 0

  // Regra 3: Estado falta_valor (item/estabelecimento identificado, mas falta valor)
  const isMissingAmount =
    Boolean(parsedResult) &&
    !isConfirmationAllowed &&
    !isClarification &&
    parsedResult?.aiStatus === 'falta_valor'

  // Se não é confirmação, nem clarificação com valor, nem falta_valor, o resultado é inválido
  const isInvalid =
    Boolean(parsedResult) && !isConfirmationAllowed && !isClarification && !isMissingAmount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 sm:max-w-lg shadow-2xl">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4 text-emerald-700" />
              </span>
              <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight">
                Lançamento por Voz com IA
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Fale naturalmente sua despesa ou receita
          </DialogDescription>

          {/* Regra 4: Alerta vermelho com erro exato se houver erro de requisição/rede ou da edge function */}
          {parsedResult && !isProcessingAi && parsedResult.aiError && (
            <div
              role="alert"
              data-testid="alert-ai-error"
              className="mt-2 text-xs px-3 py-2 rounded-xl border border-rose-300 bg-rose-50/95 text-rose-900 flex items-start gap-2 text-left"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">
                <span className="font-bold block text-rose-950">Erro de Conexão com IA:</span>
                <span className="text-rose-800 break-words font-mono text-[11px]">
                  {parsedResult.aiError}
                </span>
                <span className="block text-[11px] text-rose-700/90 mt-0.5">
                  Fallback local acionado.
                </span>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* ================= ESTADO DE PROCESSAMENTO IA ================= */}
        {isProcessingAi && (
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-3 bg-emerald-50/50 rounded-2xl border border-emerald-100">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 animate-spin">
                <Loader2 className="w-7 h-7 text-emerald-700" />
              </div>
              <Sparkles className="w-4 h-4 text-emerald-600 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Curiangoo AI analisando seu áudio...
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Identificando valor, categoria e balde orçamentário
              </p>
            </div>
          </div>
        )}

        {/* ================= ESTADO 1: ESCUTANDO / CAPTURA DE ÁUDIO ================= */}
        {!isProcessingAi && !parsedResult && (
          <div className="space-y-4 pt-2">
            {/* Bloco Central do Microfone */}
            <div className="flex flex-col items-center justify-center py-5 px-4 bg-gradient-to-b from-emerald-50/70 to-slate-50 rounded-2xl border border-emerald-100 text-center relative overflow-hidden">
              {/* Botão de gravação / estado */}
              <div className="relative mb-3 flex items-center justify-center">
                {isListening ? (
                  <>
                    <div className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
                    <div className="absolute w-24 h-24 rounded-full bg-emerald-500/30 animate-pulse pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => {
                        // Usuário clicou no microfone para parar/concluir manualmente
                        userStoppedManuallyRef.current = true
                        shouldKeepListeningRef.current = false
                        clearSilenceTimer()
                        if (recognitionRef.current) {
                          try {
                            recognitionRef.current.stop()
                          } catch {
                            // silenciar
                          }
                        } else {
                          const captured = latestTranscriptRef.current.trim()
                          if (captured) {
                            handleStopAndProcess(captured)
                          } else {
                            stopListening()
                          }
                        }
                      }}
                      className="w-16 h-16 rounded-full bg-[#064E3B] text-white flex items-center justify-center shadow-lg shadow-emerald-900/30 z-10 transition-transform active:scale-95"
                      title="Toque para concluir"
                    >
                      <Mic className="w-8 h-8 animate-pulse text-emerald-300" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => startRecording()}
                    className="w-16 h-16 rounded-full bg-slate-200 text-slate-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center shadow-md transition-all active:scale-95"
                    title="Toque para começar a falar"
                  >
                    <MicOff className="w-7 h-7" />
                  </button>
                )}
              </div>

              {/* Status textual */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  {isListening ? (
                    audioDetected ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ouvindo... pode falar no seu ritmo
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ouvindo... pode falar no seu ritmo
                      </>
                    )
                  ) : (
                    'Microfone pronto — toque para falar'
                  )}{' '}
                </span>
              </div>

              {/* Exibição em tempo real do que está sendo falado */}
              <div className="mt-2.5 min-h-[40px] max-w-sm flex items-center justify-center">
                {currentDisplaySpeech ? (
                  <p className="text-sm font-semibold text-slate-800 italic leading-snug break-words px-2">
                    &ldquo;{currentDisplaySpeech}&rdquo;
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Exemplo: &ldquo;Almoço 45 reais no débito&rdquo; ou &ldquo;Carregando celular
                    145&rdquo;
                  </p>
                )}
              </div>

              {/* Mensagem amigável de erro se houver (sem fechar o diálogo) */}
              {errorMessage && (
                <div
                  className={`mt-3 text-xs px-3 py-2 rounded-xl border flex items-start gap-2 text-left w-full ${
                    permissionStatus === 'denied'
                      ? 'text-rose-900 bg-rose-50 border-rose-200'
                      : 'text-amber-800 bg-amber-50 border-amber-200'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="leading-relaxed">{errorMessage}</p>
                    {permissionStatus === 'denied' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startRecording()}
                        className="mt-2 text-xs h-7 px-2.5 rounded-lg border-rose-300 text-rose-900 hover:bg-rose-100/60"
                      >
                        Tentar novamente
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Barrinhas animadas quando capturando áudio */}
              {isListening && (
                <div className="flex items-center gap-1.5 mt-3">
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

            {/* Fallback de digitação fluido */}
            <form
              onSubmit={handleManualTextSubmit}
              className="space-y-2 pt-2 border-t border-slate-100"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Texto falado ou digitado</span>
                </label>
                {textoFalado && (
                  <button
                    type="button"
                    onClick={() => {
                      setTextoFalado('')
                      latestTranscriptRef.current = ''
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-600"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  value={textoFalado}
                  onChange={(e) => {
                    setTextoFalado(e.target.value)
                    latestTranscriptRef.current = e.target.value
                  }}
                  placeholder="Ex: Almoço 45 reais no débito"
                  className="rounded-xl h-10 text-xs bg-white flex-1"
                />
                <Button
                  type="submit"
                  disabled={!textoFalado.trim()}
                  className="bg-[#064E3B] hover:bg-emerald-900 text-white rounded-xl font-bold text-xs h-10 px-3.5 gap-1.5 shrink-0 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Processar com IA
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ================= ESTADO 2A: IA IDENTIFICOU "INVALIDO" (RUÍDO / CONVERSA SEM SENTIDO OU SEM VALOR) ================= */}
        {!isProcessingAi && isInvalid && (
          <div className="space-y-4 pt-2 animate-in fade-in-50 duration-200">
            {parsedResult?.aiError ? (
              <div
                role="alert"
                data-testid="invalid-error-card"
                className="bg-rose-50/90 border border-rose-200/90 rounded-2xl p-5 text-center space-y-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-rose-950">
                    {parsedResult.friendlyMessage || 'Falha na IA'}
                  </h4>
                  <p className="text-xs text-rose-900/90 mt-1.5 leading-relaxed font-mono break-words">
                    {parsedResult.aiError}
                  </p>
                </div>
                {parsedResult?.rawText && (
                  <div className="bg-white/80 rounded-xl p-2.5 text-xs text-slate-600 italic border border-rose-100 break-words">
                    &ldquo;{parsedResult.rawText}&rdquo;
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-5 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                  <HelpCircle className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-amber-950">
                    {parsedResult?.friendlyMessage ||
                      "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'"}
                  </h4>
                  <p className="text-xs text-amber-900/90 mt-1.5 leading-relaxed font-medium">
                    Dica: Fale o item e o valor, ex: &apos;Almoço 45 reais no débito no
                    restaurante&apos;.
                  </p>
                </div>
                {parsedResult?.rawText && (
                  <div className="bg-white/80 rounded-xl p-2.5 text-xs text-slate-600 italic border border-amber-100 break-words">
                    &ldquo;{parsedResult.rawText}&rdquo;
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="button"
                onClick={handleRetryListening}
                className="bg-[#064E3B] hover:bg-emerald-900 text-white rounded-xl font-bold text-xs h-11 gap-2 shadow-sm"
              >
                <Mic className="w-4 h-4 text-emerald-300" />🎤 Falar Novamente
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-xs text-slate-500 hover:text-slate-700 h-9"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* ================= ESTADO 2B: IA IDENTIFICOU "CLARIFICACAO" (AMBÍGUO / GÍRIA) ================= */}
        {!isProcessingAi && isClarification && parsedResult && (
          <div className="space-y-4 pt-2 animate-in fade-in-50 duration-200">
            {/* Mensagem amigável da IA */}
            <div className="bg-gradient-to-br from-indigo-50/90 via-sky-50/70 to-white border border-indigo-200/80 rounded-2xl p-4 space-y-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Quase lá! Preciso de um detalhe
                </span>
              </div>

              <p className="text-sm font-semibold text-slate-900 leading-snug">
                {parsedResult.clarificationQuestion ||
                  parsedResult.friendlyMessage ||
                  'Identifiquei o valor, mas fiquei em dúvida sobre a categoria.'}
              </p>

              {parsedResult.amountCents > 0 && (
                <div className="pt-1 flex items-baseline gap-2">
                  <span className="text-xs text-slate-500 font-medium">Valor reconhecido:</span>
                  <span className="text-base font-extrabold text-slate-900 tabular-nums">
                    {parsedResult.amountFormatted}
                  </span>
                </div>
              )}
            </div>

            {/* Pílulas de Sugestão clicáveis (exatamente 3 opções rápidas) */}
            {parsedResult.clarificationOptions && parsedResult.clarificationOptions.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Escolha uma opção para completar:</span>
                </label>
                <div className="flex flex-col gap-2">
                  {parsedResult.clarificationOptions.map((opcao, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectClarificationOption(opcao)}
                      className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50/70 hover:border-indigo-300 transition-all flex items-center justify-between text-xs font-semibold text-slate-800 group shadow-xs active:scale-[0.99]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 group-hover:scale-125 transition-transform" />
                        {opcao}
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ações secundárias */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleRetryListening}
                className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10 gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Falar de novo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleAdjustManually}
                className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-10 gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Ajustar manual
              </Button>
            </div>
          </div>
        )}

        {/* ================= ESTADO 2B-2: IA IDENTIFICOU "FALTA_VALOR" (CONTEXTO PRESERVADO, PERGUNTAR QUANTO CUSTOU) ================= */}
        {!isProcessingAi && isMissingAmount && parsedResult && (
          <div className="space-y-4 pt-2 animate-in fade-in-50 duration-200">
            {/* Card no formato: "Entendi: [descricao] em [categoria/balde]" */}
            {(() => {
              const bucketLabel = parsedResult.bucketSuggestion
                ? BUCKET_METADATA[
                    (parsedResult.bucketSuggestion === 'goals'
                      ? 'future'
                      : parsedResult.bucketSuggestion === 'essential'
                        ? 'essentials'
                        : parsedResult.bucketSuggestion) as BudgetBucket
                  ]?.shortLabel || 'Estilo de Vida'
                : 'Estilo de Vida'
              const categoryOrBucket = parsedResult.categoryNameSuggestion
                ? `${parsedResult.categoryNameSuggestion} (${bucketLabel})`
                : bucketLabel

              return (
                <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50/90 via-blue-50/50 to-white p-4 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                      <span>📝 Item Identificado</span>
                    </span>
                    {parsedResult.categoryNameSuggestion && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-200">
                        {parsedResult.categoryNameSuggestion}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-900 leading-snug break-words">
                      Entendi: {parsedResult.description} em {categoryOrBucket}
                    </h4>
                    {parsedResult.establishment &&
                      parsedResult.establishment.toLowerCase() !==
                        parsedResult.description.toLowerCase() && (
                        <p className="text-xs text-sky-900 font-medium">
                          Local: <strong>{parsedResult.establishment}</strong>
                        </p>
                      )}
                  </div>
                </div>
              )
            })()}

            {/* Pergunta "Quanto custou?" com 2 caminhos rápidos */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Quanto custou?</h4>
                  <p className="text-xs text-slate-500">Escolha digitar ou falar apenas o valor</p>
                </div>
              </div>

              {/* CAMINHO A: Digitação de valor com máscara e foco automático */}
              <form onSubmit={handleConfirmMissingAmount} className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-600 block">
                  Digite o valor:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      R$
                    </span>
                    <Input
                      ref={missingAmountInputRef}
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={missingAmountInput}
                      onChange={(e) => setMissingAmountInput(e.target.value)}
                      className="pl-10 text-base font-bold tabular-nums rounded-xl h-10 bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={!missingAmountInput.trim()}
                    className="bg-[#064E3B] hover:bg-emerald-900 text-white rounded-xl font-bold text-xs h-10 px-3.5 gap-1.5 shrink-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    Confirmar Valor
                  </Button>
                </div>
              </form>

              {/* Divisor */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="flex-shrink mx-2 text-[10px] uppercase font-bold text-slate-400">
                  ou fale apenas o valor
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              {/* CAMINHO B: Microfone contextual [ 🎤 Falar apenas o valor ] */}
              <div className="space-y-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (isListening) {
                      userStoppedManuallyRef.current = true
                      shouldKeepListeningRef.current = false
                      clearSilenceTimer()
                      if (recognitionRef.current) {
                        try {
                          recognitionRef.current.stop()
                        } catch {
                          // silenciar
                        }
                      }
                    } else {
                      setTextoFalado('')
                      latestTranscriptRef.current = ''
                      startRecording({ forAmountOnly: true })
                    }
                  }}
                  className={`w-full rounded-xl font-bold text-xs h-11 gap-2 transition-all ${
                    isListening && isListeningForAmountOnly
                      ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs'
                  }`}
                >
                  <Mic className="w-4 h-4 text-emerald-700" />
                  {isListening && isListeningForAmountOnly
                    ? 'Ouvindo valor... fale agora (toque para pausar)'
                    : '🎤 Falar apenas o valor'}
                </Button>

                {isListening && isListeningForAmountOnly && (
                  <p className="text-[11px] text-center text-emerald-700 font-medium animate-pulse">
                    Ex: &ldquo;18 reais no débito&rdquo; ou &ldquo;45 no pix&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Ações de escape */}
            <div className="flex justify-between items-center pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={handleRetryListening}
                className="text-xs text-slate-500 hover:text-slate-700 h-9 gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Falar frase inteira de novo
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-xs text-slate-400 hover:text-slate-600 h-9"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* ================= ESTADO 2C: IA IDENTIFICOU "SUCESSO" (CARD VERDE DE CONFIRMAÇÃO) ================= */}
        {!isProcessingAi && isConfirmationAllowed && parsedResult && (
          <div className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
            {/* Frase original dita pelo usuário */}
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
                onClick={handleRetryListening}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline shrink-0"
              >
                Falar de novo
              </button>
            </div>

            {/* CARD HERO VERDE DE CONFIRMAÇÃO COM DADOS */}
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

                {/* 2. Categoria e Subcategoria Sugerida */}
                <div className="bg-white/80 border border-slate-200/70 rounded-xl p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    <Sparkles className="w-3 h-3 text-emerald-700" />
                    <span>Categoria</span>
                  </div>
                  <div className="mt-1 font-bold text-xs text-slate-800 truncate">
                    {parsedResult.categoryNameSuggestion || 'Geral / Outros'}
                  </div>
                  {parsedResult.subcategoryNameSuggestion && (
                    <div className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">
                      ↳ {parsedResult.subcategoryNameSuggestion}
                    </div>
                  )}
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
