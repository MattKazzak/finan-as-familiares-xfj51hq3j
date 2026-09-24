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
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Send,
  Loader2,
  RotateCcw,
  Tag,
  HelpCircle,
  MessageSquare,
} from 'lucide-react'
import { ParsedVoiceTransaction } from '@/services/voice-parser'
import { parseVoiceWithAi } from '@/services/voice-ai'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { createTransaction } from '@/services/transactions'
import { BUCKET_METADATA } from '@/types/budget-presets'
import { BudgetBucket } from '@/types/finance'

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: Date
  cardData?: ParsedVoiceTransaction | null
  cardType?: 'sucesso' | 'falta_valor' | 'clarificacao' | 'invalido' | 'consulta'
  aiError?: string | null
}

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

  // Mini-Chat: Histórico de mensagens mantido em memória durante a sessão do modal
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputVal, setInputVal] = useState('')

  // Estado da transação parcial em 2 turnos (sobrevive a reinícios do microfone e mensagens)
  const [pendingTransaction, setPendingTransaction] = useState<ParsedVoiceTransaction | null>(null)

  // Estados de voz e transcrição
  const [isListening, setIsListening] = useState(false)
  const [audioDetected, setAudioDetected] = useState(false)
  const [textoFalado, setTextoFalado] = useState('')
  const [isProcessingAi, setIsProcessingAi] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  // Permissão nativa e status de erro amigável
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Input de valor rápido no card falta_valor
  const [missingAmountInput, setMissingAmountInput] = useState('')
  const [isListeningForAmountOnly, setIsListeningForAmountOnly] = useState(false)
  const missingAmountInputRef = useRef<HTMLInputElement | null>(null)

  // Refs de controle
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const latestTranscriptRef = useRef<string>('')
  const hadErrorRef = useRef<boolean>(false)
  const silenceTimerRef = useRef<any>(null)
  const shouldKeepListeningRef = useRef<boolean>(false)
  const userStoppedManuallyRef = useRef<boolean>(false)
  const isListeningForAmountOnlyRef = useRef<boolean>(false)
  const pendingTransactionRef = useRef<ParsedVoiceTransaction | null>(null)

  // Manter refs sincronizadas
  useEffect(() => {
    pendingTransactionRef.current = pendingTransaction
  }, [pendingTransaction])

  useEffect(() => {
    isListeningForAmountOnlyRef.current = isListeningForAmountOnly
  }, [isListeningForAmountOnly])

  // Scroll automático para a última mensagem sempre que o array de mensagens mudar
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
      }
    }, 60)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isProcessingAi, isListening, textoFalado, scrollToBottom])

  // Limpar timer de silêncio de 3s
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
        // silenciar
      }
      recognitionRef.current = null
    }
    setIsListening(false)
    setAudioDetected(false)
    setIsListeningForAmountOnly(false)
  }, [clearSilenceTimer])

  // Helper para construir contexto_anterior a partir de transação parcial pendente
  const buildPreviousContext = useCallback((base: ParsedVoiceTransaction | null) => {
    if (!base) return null
    return {
      descricao: base.description,
      estabelecimento: base.establishment || null,
      categoria: base.categoryNameSuggestion,
      subcategoria: base.subcategoryNameSuggestion,
      balde: base.bucketSuggestion,
      tipo: base.type === 'income' ? ('receita' as const) : ('despesa' as const),
    }
  }, [])

  // Mesclar novo valor com transação parcial pendente
  const handleMergeAmountIntoTransaction = useCallback(
    (
      newAmountCents: number,
      paymentMethodOverride?: 'pix' | 'debito' | 'credito' | 'dinheiro',
      mergedCandidate?: Partial<ParsedVoiceTransaction>,
    ): ParsedVoiceTransaction | null => {
      const base = pendingTransactionRef.current
      if (!base || newAmountCents <= 0) return null

      const formatted = (newAmountCents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })

      // Preservar sempre a descrição anterior, exceto se a nova for um item real e não apenas valor
      const candidateDesc = mergedCandidate?.description?.trim()
      const isCandidateDescJustAmount =
        !candidateDesc ||
        /^(\d+|r\$|reais|real|foi|no|na|via|pix|debito|débito|credito|crédito|dinheiro|\s)+$/i.test(
          candidateDesc,
        )

      const finalDescription =
        !isCandidateDescJustAmount && candidateDesc ? candidateDesc : base.description

      const merged: ParsedVoiceTransaction = {
        ...base,
        ...mergedCandidate,
        amountCents: newAmountCents,
        amountFormatted: formatted,
        description: finalDescription,
        establishment: mergedCandidate?.establishment || base.establishment,
        categoryNameSuggestion:
          mergedCandidate?.categoryNameSuggestion || base.categoryNameSuggestion,
        subcategoryNameSuggestion:
          mergedCandidate?.subcategoryNameSuggestion || base.subcategoryNameSuggestion,
        bucketSuggestion: mergedCandidate?.bucketSuggestion || base.bucketSuggestion,
        paymentMethod:
          paymentMethodOverride || mergedCandidate?.paymentMethod || base.paymentMethod,
        aiStatus: 'sucesso',
        confidence: 0.95,
        clarificationQuestion: null,
        clarificationOptions: null,
        friendlyMessage: null,
      }

      setPendingTransaction(merged)
      pendingTransactionRef.current = merged
      setMissingAmountInput('')
      setIsListeningForAmountOnly(false)
      isListeningForAmountOnlyRef.current = false
      return merged
    },
    [],
  )

  // Enviar fala/texto para a IA e adicionar mensagens correspondentes ao chat
  const handleStopAndProcess = useCallback(
    async (overrideText?: string) => {
      const isAmountOnly = isListeningForAmountOnlyRef.current
      const existingPartial = pendingTransactionRef.current

      stopListening()

      const textToProcess = (
        overrideText !== undefined ? overrideText : latestTranscriptRef.current
      ).trim()

      if (!textToProcess) {
        return
      }

      // Adiciona a fala do usuário como balão à direita no chat
      const userMsgId = `user-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          sender: 'user',
          text: textToProcess,
          timestamp: new Date(),
        },
      ])
      setTextoFalado('')
      latestTranscriptRef.current = ''

      try {
        setIsProcessingAi(true)
        const previousContext =
          isAmountOnly || existingPartial?.aiStatus === 'falta_valor'
            ? buildPreviousContext(existingPartial)
            : null

        const parsed = await parseVoiceWithAi({
          texto: textToProcess,
          familyId: family?.id,
          categories,
          contexto_anterior: previousContext,
        })

        // Caso 1: Consulta rápida (resposta acolhedora da IA sem card de lançamento)
        if (parsed.aiStatus === 'consulta' || parsed.tipoResposta === 'consulta') {
          const resposta =
            parsed.respostaConsulta ||
            parsed.friendlyMessage ||
            'Aqui estão as informações solicitadas.'

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              text: resposta,
              timestamp: new Date(),
              cardType: 'consulta',
            },
          ])
          return
        }

        // Caso 2: Falta de valor (início do fluxo em 2 turnos)
        if (parsed.aiStatus === 'falta_valor') {
          setPendingTransaction(parsed)
          pendingTransactionRef.current = parsed

          const friendlyMsg =
            parsed.friendlyMessage ||
            `Entendi: ${parsed.description}${parsed.establishment ? ` em ${parsed.establishment}` : ''}! 🍻 Mas quanto custou?`

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              text: friendlyMsg,
              timestamp: new Date(),
              cardData: parsed,
              cardType: 'falta_valor',
            },
          ])
          return
        }

        // Caso 3: Segundo turno — usuário informou o valor após uma transação parcial pendente
        if (existingPartial && (isAmountOnly || existingPartial.aiStatus === 'falta_valor')) {
          if (parsed.amountCents > 0) {
            const merged = handleMergeAmountIntoTransaction(
              parsed.amountCents,
              parsed.paymentMethod,
              parsed,
            )

            const confirmedData = merged || {
              ...existingPartial,
              amountCents: parsed.amountCents,
              amountFormatted: parsed.amountFormatted,
              aiStatus: 'sucesso' as const,
            }

            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                sender: 'assistant',
                text: `Perfeito! Registrei o valor de ${parsed.amountFormatted}. Confira abaixo e confirme o lançamento:`,
                timestamp: new Date(),
                cardData: confirmedData,
                cardType: 'sucesso',
              },
            ])
            return
          } else {
            toast({
              title: 'Valor não identificado',
              description:
                'Não conseguimos identificar o valor falado. Tente digitar ou falar novamente.',
              variant: 'destructive',
            })
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                sender: 'assistant',
                text: 'Não consegui identificar o valor em reais. Você pode falar apenas o número (ex: "80 reais") ou digitar abaixo.',
                timestamp: new Date(),
                cardData: existingPartial,
                cardType: 'falta_valor',
              },
            ])
            return
          }
        }

        // Caso 4: Transação completa com sucesso logo no primeiro turno
        if (parsed.aiStatus === 'sucesso' && parsed.amountCents > 0) {
          setPendingTransaction(parsed)
          pendingTransactionRef.current = parsed

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              text: `Entendido! Identifiquei o lançamento de ${parsed.description} (${parsed.amountFormatted}). Toque em confirmar para registrar:`,
              timestamp: new Date(),
              cardData: parsed,
              cardType: 'sucesso',
            },
          ])
          return
        }

        // Caso 5: Clarificação (valor existe mas descrição/categoria ambígua)
        if (parsed.aiStatus === 'clarificacao' && parsed.amountCents > 0) {
          setPendingTransaction(parsed)
          pendingTransactionRef.current = parsed

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              text:
                parsed.clarificationQuestion ||
                parsed.friendlyMessage ||
                `Entendi ${parsed.amountFormatted}! Mas qual a categoria deste gasto?`,
              timestamp: new Date(),
              cardData: parsed,
              cardType: 'clarificacao',
            },
          ])
          return
        }

        // Caso 6: Inválido ou erro
        const fallbackMsg =
          parsed.friendlyMessage ||
          "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'"

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: fallbackMsg,
            timestamp: new Date(),
            cardData: parsed,
            cardType: 'invalido',
            aiError: parsed.aiError || null,
          },
        ])
      } catch (err: any) {
        console.error('Erro ao processar áudio com IA:', err)
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: 'Ocorreu uma falha ao interpretar seu comando. Tente falar novamente.',
            timestamp: new Date(),
            cardType: 'invalido',
            aiError: err?.message || 'Falha de conexão',
          },
        ])
      } finally {
        setIsProcessingAi(false)
      }
    },
    [
      buildPreviousContext,
      categories,
      family?.id,
      handleMergeAmountIntoTransaction,
      stopListening,
      toast,
    ],
  )

  // Iniciar SpeechRecognition nativo com controle estrito de silêncio (3000ms)
  const startRecording = useCallback(
    (options?: { forAmountOnly?: boolean }) => {
      const isForAmount = Boolean(options?.forAmountOnly)
      setIsListeningForAmountOnly(isForAmount)
      isListeningForAmountOnlyRef.current = isForAmount

      setErrorMessage(null)
      hadErrorRef.current = false
      userStoppedManuallyRef.current = false
      shouldKeepListeningRef.current = true
      setAudioDetected(false)
      clearSilenceTimer()

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
          'Seu navegador não suporta reconhecimento de voz nativo. Digite abaixo e envie para o Copilot.',
        )
        setIsListening(false)
        return
      }

      try {
        const recognition = new SpeechRecognition()
        recognition.lang = 'pt-BR'
        // Contrato 1: continuous = true para escuta contínua no ritmo do usuário
        recognition.continuous = true
        recognition.interimResults = true
        recognition.maxAlternatives = 1

        recognition.onstart = () => {
          setIsListening(true)
          setPermissionStatus('granted')
          setErrorMessage(null)
        }

        recognition.onaudiostart = () => {
          setAudioDetected(true)
        }
        recognition.onspeechstart = () => {
          setAudioDetected(true)
        }

        // Função chamada estritamente quando o timer de 3000ms de silêncio expira
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

          handleStopAndProcess(captured)
        }

        // Contrato 1: Temporizador de 3s (3000ms) de silêncio real
        const scheduleSilenceProcessing = () => {
          clearSilenceTimer()
          silenceTimerRef.current = setTimeout(() => {
            triggerFinalProcessing()
          }, 3000)
        }

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('')
          latestTranscriptRef.current = transcript
          setTextoFalado(transcript)

          // Reiniciar timer de 3s a cada fala detectada
          scheduleSilenceProcessing()
        }

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

        // Contrato 1: onend mobile prematuro — se timer de 3s não expirou e usuário não parou manualmente, REINICIA
        recognition.onend = () => {
          if (
            shouldKeepListeningRef.current &&
            !userStoppedManuallyRef.current &&
            !hadErrorRef.current
          ) {
            try {
              recognition.start()
              setIsListening(true)
              return
            } catch (restartErr) {
              console.warn('Erro ao reiniciar recognition no onend prematuro:', restartErr)
            }
          }

          clearSilenceTimer()
          setIsListening(false)
          setAudioDetected(false)
          recognitionRef.current = null

          const finalCapturado = latestTranscriptRef.current.trim()

          // Se a parada foi manual pelo botão do microfone, processa imediatamente
          if (userStoppedManuallyRef.current && finalCapturado && !hadErrorRef.current) {
            userStoppedManuallyRef.current = false
            shouldKeepListeningRef.current = false
            handleStopAndProcess(finalCapturado)
          } else if (!shouldKeepListeningRef.current) {
            setIsListeningForAmountOnly(false)
          }
        }

        recognitionRef.current = recognition
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
          'Não foi possível ativar o microfone. Você pode digitar abaixo e enviar com o Copilot.',
        )
      }
    },
    [clearSilenceTimer, handleStopAndProcess],
  )

  // Auto-foco no input de valor quando entra no estado 'falta_valor'
  useEffect(() => {
    if (pendingTransaction?.aiStatus === 'falta_valor') {
      const timer = setTimeout(() => {
        missingAmountInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [pendingTransaction?.aiStatus])

  // Iniciar sessão do modal: zera histórico ao abrir e dispara escuta
  useEffect(() => {
    if (open) {
      setMessages([
        {
          id: 'welcome-1',
          sender: 'assistant',
          text: 'Olá! Sou o Curiangoo Copilot. 🌿 Você pode falar seus gastos e receitas no seu ritmo ou me fazer uma pergunta rápida (ex: "quanto ainda posso gastar esse mês?").',
          timestamp: new Date(),
        },
      ])
      setInputVal('')
      setTextoFalado('')
      latestTranscriptRef.current = ''
      setPendingTransaction(null)
      pendingTransactionRef.current = null
      setErrorMessage(null)
      setMissingAmountInput('')
      setIsListeningForAmountOnly(false)
      isListeningForAmountOnlyRef.current = false
      hadErrorRef.current = false
      userStoppedManuallyRef.current = false
      shouldKeepListeningRef.current = false
      setAudioDetected(false)
      setIsProcessingAi(false)
      setSelectedMemberId(currentMember?.id || members[0]?.id || '')
      setPermissionStatus('idle')

      startRecording()
    } else {
      stopListening()
      setPermissionStatus('idle')
      setIsProcessingAi(false)
      setMissingAmountInput('')
      setIsListeningForAmountOnly(false)
      setPendingTransaction(null)
      pendingTransactionRef.current = null
    }

    return () => {
      stopListening()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Submeter modo texto do rodapé do mini-chat
  const handleChatTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    clearSilenceTimer()
    const textToSend = inputVal.trim()
    if (!textToSend) return
    setInputVal('')
    handleStopAndProcess(textToSend)
  }

  // Confirmar valor digitado diretamente no card falta_valor
  const handleConfirmMissingAmount = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const base = pendingTransactionRef.current
    if (!base) return

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

    // Registra como fala do usuário no chat
    const userMsgId = `user-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: `R$ ${missingAmountInput}`,
        timestamp: new Date(),
      },
    ])

    const merged = handleMergeAmountIntoTransaction(cents)
    if (merged) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: `Valor de ${merged.amountFormatted} registrado! Confira o lançamento abaixo:`,
          timestamp: new Date(),
          cardData: merged,
          cardType: 'sucesso',
        },
      ])
    }
  }

  // Ação ao clicar em uma opção de sugestão da IA no estado "clarificacao"
  const handleSelectClarificationOption = (option: string, cardData?: ParsedVoiceTransaction) => {
    const base = cardData || pendingTransactionRef.current
    if (!base || base.amountCents <= 0) return

    const parts = option.split('/').map((p) => p.trim())
    const catName = parts[0]
    const subName = parts[1] || ''

    const matchedCategory = categories.find(
      (c) =>
        c.type === base.type &&
        (c.name.toLowerCase() === catName.toLowerCase() ||
          c.name.toLowerCase().includes(catName.toLowerCase()) ||
          catName.toLowerCase().includes(c.name.toLowerCase())),
    )

    const updated: ParsedVoiceTransaction = {
      ...base,
      aiStatus: 'sucesso',
      categoryNameSuggestion: matchedCategory ? matchedCategory.name : catName,
      subcategoryNameSuggestion: subName || base.subcategoryNameSuggestion,
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

    setPendingTransaction(updated)
    pendingTransactionRef.current = updated

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: option,
        timestamp: new Date(),
      },
      {
        id: `assistant-${Date.now() + 1}`,
        sender: 'assistant',
        text: `Ótimo! Categoria ${updated.categoryNameSuggestion} selecionada. Pronto para confirmar:`,
        timestamp: new Date(),
        cardData: updated,
        cardType: 'sucesso',
      },
    ])
  }

  // Tentar novamente (voltar à escuta do zero)
  const handleRetryListening = () => {
    setPendingTransaction(null)
    pendingTransactionRef.current = null
    setTextoFalado('')
    setMissingAmountInput('')
    setIsListeningForAmountOnly(false)
    isListeningForAmountOnlyRef.current = false
    latestTranscriptRef.current = ''
    startRecording()
  }

  // Confirmar lançamento diretamente no Supabase
  const handleConfirmTransaction = async (cardData?: ParsedVoiceTransaction | null) => {
    const dataToSave = cardData || pendingTransaction
    if (!family || !dataToSave) return

    if (dataToSave.amountCents <= 0) {
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

      let targetCategory = categories.find((c) => {
        if (c.type !== dataToSave.type) return false
        if (dataToSave.categoryNameSuggestion) {
          return c.name.toLowerCase() === dataToSave.categoryNameSuggestion.toLowerCase()
        }
        return false
      })

      if (!targetCategory && dataToSave.categoryNameSuggestion) {
        targetCategory = categories.find(
          (c) =>
            c.type === dataToSave.type &&
            (c.name.toLowerCase().includes(dataToSave.categoryNameSuggestion!.toLowerCase()) ||
              dataToSave.categoryNameSuggestion!.toLowerCase().includes(c.name.toLowerCase())),
        )
      }

      if (!targetCategory) {
        targetCategory = categories.find((c) => c.type === dataToSave.type)
      }

      const categoryId = targetCategory?.id || null
      let subcategoryId: string | null = null

      if (targetCategory && dataToSave.subcategoryNameSuggestion) {
        const subName = dataToSave.subcategoryNameSuggestion.trim()
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
        type: dataToSave.type,
        amount_cents: dataToSave.amountCents,
        description: dataToSave.description || 'Lançamento por Voz',
        transaction_date: new Date().toISOString().slice(0, 10),
        status: 'confirmed',
      })

      toast({
        title: 'Lançamento registrado com sucesso! 🎉',
        description: `${dataToSave.description} (${dataToSave.amountFormatted}) adicionado ao saldo da família.`,
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
  const handleAdjustManually = (cardData?: ParsedVoiceTransaction | null) => {
    const dataToAdjust = cardData || pendingTransaction
    if (!dataToAdjust) return

    const targetCategory = categories.find((c) => {
      if (c.type !== dataToAdjust.type) return false
      if (dataToAdjust.categoryNameSuggestion) {
        return c.name.toLowerCase() === dataToAdjust.categoryNameSuggestion.toLowerCase()
      }
      return false
    })

    onOpenChange(false)
    onOpenManualTransaction({
      type: dataToAdjust.type,
      amountCents: dataToAdjust.amountCents,
      description: dataToAdjust.description,
      categoryId: targetCategory?.id,
      memberId: selectedMemberId || currentMember?.id || members[0]?.id,
    })
  }

  // Renderizador do Card Verde de Confirmação dentro do Chat
  const renderSuccessCard = (data: ParsedVoiceTransaction) => {
    const bucketLabel = data.bucketSuggestion
      ? BUCKET_METADATA[
          (data.bucketSuggestion === 'goals'
            ? 'future'
            : data.bucketSuggestion === 'essential'
              ? 'essentials'
              : data.bucketSuggestion) as BudgetBucket
        ]?.shortLabel || 'Estilo de Vida'
      : 'Estilo de Vida'

    return (
      <div className="mt-2.5 rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50/95 via-teal-50/70 to-white p-3.5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-xs ${
                data.type === 'income' ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {data.type === 'income' ? (
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              {data.type === 'income' ? 'Receita Detectada' : 'Despesa Detectada'}
            </span>
          </div>

          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            {Math.round(data.confidence * 100)}% precisão
          </span>
        </div>

        <div>
          <h4 className="text-sm font-bold text-slate-900 leading-snug break-words">
            {data.description}
          </h4>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-slate-900 tabular-nums">
              {data.amountCents > 0 ? data.amountFormatted : 'R$ 0,00'}
            </span>
            <span className="text-[11px] font-medium text-emerald-800">
              ({data.categoryNameSuggestion || 'Geral'} • {bucketLabel})
            </span>
          </div>
        </div>

        {/* Botões de Ação no próprio balão de chat */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-200/70">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleAdjustManually(data)}
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-9 gap-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Ajustar
          </Button>

          <Button
            type="button"
            onClick={() => handleConfirmTransaction(data)}
            disabled={isSaving || data.amountCents <= 0}
            className="bg-[#064E3B] hover:bg-emerald-900 text-white rounded-xl font-bold text-xs h-9 gap-1.5 shadow-sm transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            {isSaving ? 'Salvando...' : '✅ Confirmar Lançamento'}
          </Button>
        </div>
      </div>
    )
  }

  // Renderizador do Card falta_valor no Chat
  const renderMissingAmountCard = (data: ParsedVoiceTransaction) => {
    const bucketLabel = data.bucketSuggestion
      ? BUCKET_METADATA[
          (data.bucketSuggestion === 'goals'
            ? 'future'
            : data.bucketSuggestion === 'essential'
              ? 'essentials'
              : data.bucketSuggestion) as BudgetBucket
        ]?.shortLabel || 'Estilo de Vida'
      : 'Estilo de Vida'

    return (
      <div className="mt-2.5 rounded-2xl border border-sky-300 bg-gradient-to-br from-sky-50/95 to-white p-3.5 space-y-3 shadow-md">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block">
            📝 Item Identificado
          </span>
          <h4 className="text-sm font-bold text-slate-900 leading-snug break-words">
            Entendi: {data.description} em {data.categoryNameSuggestion || bucketLabel}
          </h4>
          {data.establishment && (
            <p className="text-[11px] text-sky-900">
              Local: <strong>{data.establishment}</strong>
            </p>
          )}
        </div>

        <div className="space-y-2 pt-1 border-t border-sky-200">
          <form onSubmit={handleConfirmMissingAmount} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                R$
              </span>
              <Input
                ref={missingAmountInputRef}
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={missingAmountInput}
                onChange={(e) => setMissingAmountInput(e.target.value)}
                className="pl-8 text-sm font-bold tabular-nums rounded-xl h-9 bg-white border-slate-300 focus:border-emerald-500"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              disabled={!missingAmountInput.trim()}
              className="bg-[#064E3B] hover:bg-emerald-900 text-white rounded-xl font-bold text-xs h-9 px-3 shrink-0"
            >
              Confirmar
            </Button>
          </form>

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
            className={`w-full rounded-xl font-bold text-xs h-9 gap-1.5 transition-all ${
              isListening && isListeningForAmountOnly
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-emerald-700" />
            {isListening && isListeningForAmountOnly
              ? 'Ouvindo valor... fale agora'
              : '🎤 Falar apenas o valor'}
          </Button>
        </div>
      </div>
    )
  }

  // Renderizador do Card clarificacao no Chat
  const renderClarificationCard = (data: ParsedVoiceTransaction) => {
    return (
      <div className="mt-2.5 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3 space-y-2.5">
        <p className="text-xs font-semibold text-slate-800 leading-snug">
          {data.clarificationQuestion || 'Identifiquei o valor! Escolha uma opção para completar:'}
        </p>

        {data.clarificationOptions && data.clarificationOptions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {data.clarificationOptions.map((opcao, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectClarificationOption(opcao, data)}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-between text-xs font-semibold text-slate-800 group shadow-xs active:scale-[0.99]"
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {opcao}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600" />
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleRetryListening}
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold h-8 flex-1"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Falar de novo
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleAdjustManually(data)}
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold h-8 flex-1"
          >
            <SlidersHorizontal className="w-3 h-3 mr-1" />
            Ajustar
          </Button>
        </div>
      </div>
    )
  }

  // Renderizador do Card invalido no Chat
  const renderInvalidCard = (msg: ChatMessage) => {
    return (
      <div className="mt-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-left space-y-2">
        {msg.aiError ? (
          <div
            role="alert"
            data-testid="invalid-error-card"
            className="border border-rose-200 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-900"
          >
            <span className="font-bold block text-rose-950">Erro de Conexão com IA:</span>
            <span className="font-mono text-[11px] break-words">{msg.aiError}</span>
          </div>
        ) : (
          <p className="text-xs text-amber-900 leading-relaxed font-medium">
            Dica: Fale o item e o valor, ex: &apos;Almoço 45 reais no débito no restaurante&apos;.
          </p>
        )}

        <Button
          type="button"
          onClick={handleRetryListening}
          className="bg-[#064E3B] hover:bg-emerald-900 text-white rounded-xl font-bold text-xs h-9 gap-1.5 w-full shadow-xs"
        >
          <Mic className="w-3.5 h-3.5 text-emerald-300" />🎤 Falar Novamente
        </Button>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 sm:max-w-md md:max-w-lg shadow-2xl flex flex-col max-h-[90vh] h-[640px]">
        {/* Header do Copilot */}
        <DialogHeader className="text-left space-y-0.5 pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4 text-emerald-700" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  Curiangoo Copilot
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Mini-Chat IA
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Fale lançamentos ou faça perguntas sobre suas finanças
                </DialogDescription>
              </div>
            </div>

            {/* Seletor de Membro */}
            <div className="flex items-center gap-1 text-xs">
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer"
                title="Membro responsável"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Alerta de erro da Edge Function se houver */}
          {errorMessage && (
            <div
              role="alert"
              data-testid="alert-ai-error"
              className="mt-2 text-xs px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 flex items-start gap-1.5 text-left"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-tight font-medium">{errorMessage}</p>
            </div>
          )}
        </DialogHeader>

        {/* ================= CORPO DO MINI-CHAT: HISTÓRICO DE MENSAGENS ================= */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto pr-1 py-3 space-y-3 scroll-smooth text-xs"
        >
          {messages.map((msg) => {
            const isUser = msg.sender === 'user'

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in-50 duration-150`}
              >
                {/* Balão de Mensagem */}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs ${
                    isUser
                      ? 'bg-[#064E3B] text-white rounded-br-xs'
                      : 'bg-slate-100 text-slate-900 rounded-bl-xs border border-slate-200/80'
                  }`}
                >
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                  {/* Cards Contextuais acoplados ao balão do assistente */}
                  {!isUser &&
                    msg.cardType === 'sucesso' &&
                    msg.cardData &&
                    renderSuccessCard(msg.cardData)}

                  {!isUser &&
                    msg.cardType === 'falta_valor' &&
                    msg.cardData &&
                    renderMissingAmountCard(msg.cardData)}

                  {!isUser &&
                    msg.cardType === 'clarificacao' &&
                    msg.cardData &&
                    renderClarificationCard(msg.cardData)}

                  {!isUser && msg.cardType === 'invalido' && renderInvalidCard(msg)}
                </div>
              </div>
            )
          })}

          {/* Indicador de carregamento / IA processando */}
          {isProcessingAi && (
            <div className="flex items-start gap-2 animate-in fade-in duration-200">
              <div className="bg-slate-100 border border-slate-200/80 text-slate-700 rounded-2xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-2 shadow-xs">
                <Loader2 className="w-3.5 h-3.5 text-emerald-700 animate-spin" />
                <span className="text-xs font-semibold">Curiangoo Copilot pensando...</span>
              </div>
            </div>
          )}

          {/* Transcrição em tempo real do microfone dentro do chat */}
          {isListening && textoFalado.trim() && (
            <div className="flex items-end justify-end animate-in fade-in duration-100">
              <div className="bg-emerald-900/80 text-emerald-100 rounded-2xl rounded-br-xs px-3 py-2 italic text-xs max-w-[80%] border border-emerald-700">
                &ldquo;{textoFalado.trim()}&rdquo;
              </div>
            </div>
          )}
        </div>

        {/* ================= RODAPÉ FIXO: CONTROLES SEMPRE VISÍVEIS ================= */}
        <div className="pt-2 border-t border-slate-100 shrink-0 space-y-2">
          {/* Status do microfone */}
          <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              {isListening ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-800 font-bold">
                    Ouvindo... pode falar no seu ritmo
                  </span>
                </>
              ) : (
                <span className="text-slate-400">Microfone pronto</span>
              )}
            </span>

            {isListening && (
              <span className="text-[10px] text-slate-400">Pausa de 3s envia automaticamente</span>
            )}
          </div>

          {/* Linha de Ação: Microfone Central + Campo de Digitação */}
          <div className="flex items-center gap-2">
            {/* Botão Central de Microfone */}
            <div className="relative shrink-0">
              {isListening ? (
                <button
                  type="button"
                  onClick={() => {
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
                  className="w-11 h-11 rounded-2xl bg-[#064E3B] text-white flex items-center justify-center shadow-md shadow-emerald-900/30 transition-transform active:scale-95 animate-pulse"
                  title="Toque para concluir"
                >
                  <Mic className="w-5 h-5 text-emerald-300" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startRecording()}
                  className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-300 text-slate-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center shadow-xs transition-all active:scale-95"
                  title="Toque para começar a falar"
                >
                  <MicOff className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Input de Texto + Botão Enviar */}
            <form onSubmit={handleChatTextSubmit} className="flex-1 flex items-center gap-1.5">
              <Input
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Fale no microfone ou digite aqui..."
                className="rounded-2xl h-11 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
              <Button
                type="submit"
                disabled={!inputVal.trim() || isProcessingAi}
                className="bg-[#064E3B] hover:bg-emerald-900 text-white rounded-2xl font-bold text-xs h-11 px-3.5 gap-1 shrink-0 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
