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
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Send,
  Loader2,
  Tag,
  Bird,
  Folder,
} from 'lucide-react'
import { ParsedVoiceTransaction, StructuredSuggestionOption } from '@/services/voice-parser'
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
  cardType?:
    | 'sucesso'
    | 'falta_valor'
    | 'clarificacao'
    | 'clarificacao_categoria'
    | 'invalido'
    | 'consulta'
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
  const {
    family,
    members,
    currentMember,
    categories,
    triggerRefresh,
    addNewCategory,
    addNewSubcategory,
  } = useFamily()
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

  // Contagem regressiva visual do temporizador de silêncio (3s -> 2s -> 1s)
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)
  const silenceEndTimestampRef = useRef<number | null>(null)
  const countdownIntervalRef = useRef<any>(null)

  // Refs de controle
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const latestTranscriptRef = useRef<string>('')
  // Buffers dedicados para evitar duplicações cumulativas de interimResults e reinícios
  const finalBufferRef = useRef<string>('')
  const hadErrorRef = useRef<boolean>(false)
  const silenceTimerRef = useRef<any>(null)
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

  // Limpar timer de silêncio e contagem regressiva
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    silenceEndTimestampRef.current = null
    setSecondsRemaining(null)
  }, [])

  // Parar gravação ativa de forma segura
  const stopListening = useCallback(() => {
    clearSilenceTimer()
    const activeRecognition = recognitionRef.current
    recognitionRef.current = null

    if (activeRecognition) {
      try {
        activeRecognition.stop()
      } catch {
        // silenciar caso já tenha sido finalizado
      }
    }
    setIsListening(false)
    setAudioDetected(false)
    setIsListeningForAmountOnly(false)
    isListeningForAmountOnlyRef.current = false
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
      valor: base.amountCents > 0 ? base.amountCents / 100 : null,
      status: base.aiStatus,
      opcoes_sugestao: base.structuredOptions || base.clarificationOptions,
      opcoes_estruturadas: base.structuredOptions || null,
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
      finalBufferRef.current = ''

      try {
        setIsProcessingAi(true)
        const previousContext =
          isAmountOnly ||
          existingPartial?.aiStatus === 'falta_valor' ||
          existingPartial?.aiStatus === 'clarificacao_categoria' ||
          existingPartial?.aiStatus === 'clarificacao'
            ? buildPreviousContext(existingPartial)
            : null

        const parsed = await parseVoiceWithAi({
          texto: textToProcess,
          familyId: family?.id,
          categories,
          contexto_anterior: previousContext,
        })

        // Atalho conversacional: Se usuário falar/digitar "confirmar" / "confirma" com transação pronta pendente
        const isConfirmIntent =
          /^(confirmar|confirma|confirmado|pode confirmar|salvar|salva|gravar|grava|sim|ok|fechado|feito|confirme)$/i.test(
            textToProcess.replace(/[.!?]/g, '').trim(),
          )

        if (
          isConfirmIntent &&
          existingPartial &&
          existingPartial.amountCents > 0 &&
          existingPartial.aiStatus === 'sucesso'
        ) {
          await handleConfirmTransaction(existingPartial)
          return
        }

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

        // Caso 4: Resposta Consultiva da IA / Pergunta reflexiva enquanto em clarificação de categoria
        // "NUNCA assuma que uma resposta do usuário é o nome de uma categoria sem antes avaliar a intenção da mensagem"
        // Frases de dúvida/metaconversa ("Qual faz mais sentido?", "O que você acha?") NUNCA devem virar nome de categoria!
        const isConsultingResponse =
          parsed.tipoResposta === 'consultoria_categoria' ||
          parsed.intencao === 'consultiva' ||
          (existingPartial &&
            existingPartial.aiStatus === 'clarificacao_categoria' &&
            parsed.aiStatus === 'clarificacao_categoria' &&
            !parsed.categoryNameSuggestion)

        if (isConsultingResponse) {
          // Mantém a transação pendente original intacta na memória da sessão
          const preservedOptions =
            parsed.clarificationOptions && parsed.clarificationOptions.length > 0
              ? parsed.clarificationOptions
              : existingPartial?.clarificationOptions || []

          const preservedStructured =
            parsed.structuredOptions && parsed.structuredOptions.length > 0
              ? parsed.structuredOptions
              : existingPartial?.structuredOptions || null

          const updatedPending: ParsedVoiceTransaction = {
            ...(existingPartial || parsed),
            // Preserva a transação original intacta
            amountCents: existingPartial?.amountCents || parsed.amountCents,
            amountFormatted: existingPartial?.amountFormatted || parsed.amountFormatted,
            description: existingPartial?.description || parsed.description,
            clarificationOptions: preservedOptions,
            structuredOptions: preservedStructured,
            aiStatus: 'clarificacao_categoria',
          }

          setPendingTransaction(updatedPending)
          pendingTransactionRef.current = updatedPending

          const consultMsg =
            parsed.friendlyMessage ||
            parsed.respostaConsulta ||
            `Recomendo organizar de forma separada dos gastos gerais, mantendo a regra 50/30/20 visível.`

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              text: consultMsg,
              timestamp: new Date(),
              cardData: updatedPending,
              cardType: 'clarificacao_categoria',
            },
          ])
          return
        }

        // Caso 5: Escolha ou confirmação de categoria enquanto havia clarificação de categoria pendente
        if (
          existingPartial &&
          existingPartial.aiStatus === 'clarificacao_categoria' &&
          (parsed.intencao === 'escolha_categoria' ||
            parsed.categoryNameSuggestion ||
            parsed.amountCents <= 0)
        ) {
          const categoryChoiceToApply =
            parsed.categoryNameSuggestion ||
            (parsed.intencao === 'escolha_categoria' ? parsed.description : textToProcess)

          await handleApplyAndPersistCategory(categoryChoiceToApply, existingPartial)
          return
        }

        // Caso 6: Status 'clarificacao_categoria' vindo da IA (Human-in-the-Loop padrão ouro)
        if (parsed.aiStatus === 'clarificacao_categoria' && parsed.amountCents > 0) {
          setPendingTransaction(parsed)
          pendingTransactionRef.current = parsed

          // Composição com fallback inteligente: sempre inclui a descrição do gasto antes do valor
          const desc = (parsed.description || existingPartial?.description || '').trim()
          let friendlyMsg = parsed.friendlyMessage

          if (!friendlyMsg) {
            friendlyMsg =
              desc && desc !== 'Despesa' && desc !== 'Receita'
                ? `Identifiquei ${desc} ${parsed.amountFormatted}! Onde prefere organizar esse gasto?`
                : `Identifiquei ${parsed.amountFormatted}! Onde prefere organizar esse gasto?`
          } else if (desc && desc !== 'Despesa' && desc !== 'Receita') {
            // Se a mensagem amigável não contiver a descrição do item, recompõe no formato padrão ouro
            const descLower = desc.toLowerCase()
            const msgLower = friendlyMsg.toLowerCase()
            if (!msgLower.includes(descLower)) {
              friendlyMsg = `Identifiquei ${desc} ${parsed.amountFormatted}! Onde prefere organizar esse gasto?`
            }
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              text: friendlyMsg,
              timestamp: new Date(),
              cardData: parsed,
              cardType: 'clarificacao_categoria',
            },
          ])
          return
        }

        // Caso 6: Transação completa com sucesso logo no primeiro turno OU edição conversacional de transação pendente
        if (parsed.aiStatus === 'sucesso' && parsed.amountCents > 0) {
          let finalParsed = parsed

          // Se já existia uma transação pendente pronta, mescla edições conversacionais parciais
          // Exemplo: fala "na verdade foi 100 reais" ou "coloca em lazer"
          if (existingPartial && existingPartial.amountCents > 0) {
            const isCorrectionOnlyAmount =
              /^(na verdade|muda|corrige|altera|foi|era|coloca|para|sao|são)\b/i.test(
                textToProcess,
              ) || parsed.description.toLowerCase().includes('na verdade')

            const mergedDesc = isCorrectionOnlyAmount
              ? existingPartial.description
              : parsed.description || existingPartial.description

            finalParsed = {
              ...existingPartial,
              ...parsed,
              description: mergedDesc,
              categoryNameSuggestion:
                parsed.categoryNameSuggestion || existingPartial.categoryNameSuggestion,
              subcategoryNameSuggestion:
                parsed.subcategoryNameSuggestion || existingPartial.subcategoryNameSuggestion,
              bucketSuggestion: parsed.bucketSuggestion || existingPartial.bucketSuggestion,
            }
          }

          setPendingTransaction(finalParsed)
          pendingTransactionRef.current = finalParsed

          const isUpdate = Boolean(existingPartial && existingPartial.amountCents > 0)
          const introMsg = isUpdate
            ? `Atualizado! Identifiquei o ajuste para ${finalParsed.description} (${finalParsed.amountFormatted}). Confira e confirme o lançamento:`
            : `Entendido! Identifiquei o lançamento de ${finalParsed.description} (${finalParsed.amountFormatted}). Toque em confirmar para registrar:`

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              text: introMsg,
              timestamp: new Date(),
              cardData: finalParsed,
              cardType: 'sucesso',
            },
          ])
          return
        }

        // Caso 7: Clarificação tradicional (valor existe mas descrição/termo totalmente ambíguo)
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

        // Caso 8: Inválido ou erro
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
        // continuous = false: evita ciclo contínuo de restart/reciclagem de áudio no Chrome Android e Safari iOS
        // interimResults = true: mantém a transcrição em tempo real na tela enquanto o usuário fala
        recognition.continuous = false
        recognition.interimResults = true
        recognition.maxAlternatives = 1

        recognition.onstart = () => {
          setIsListening(true)
          setPermissionStatus('granted')
          setErrorMessage(null)
          // Inicia contagem regressiva de silêncio inicial de 3s logo que o microfone começa a ouvir
          scheduleSilenceProcessing()
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

          // Só solicita parada se houver sessão ativa
          const active = recognitionRef.current
          recognitionRef.current = null
          if (active) {
            try {
              active.stop()
            } catch {
              // silenciar
            }
          }

          setIsListening(false)
          setAudioDetected(false)

          const captured = latestTranscriptRef.current.trim()
          if (!captured) {
            setIsListeningForAmountOnly(false)
            isListeningForAmountOnlyRef.current = false
            return
          }

          handleStopAndProcess(captured)
        }

        // Temporizador de 3s (3000ms) de silêncio real com contagem regressiva visual
        const scheduleSilenceProcessing = () => {
          clearSilenceTimer()

          const durationMs = 3000
          const endTime = Date.now() + durationMs
          silenceEndTimestampRef.current = endTime
          setSecondsRemaining(3)

          countdownIntervalRef.current = setInterval(() => {
            const now = Date.now()
            const diffMs = endTime - now
            if (diffMs <= 0) {
              setSecondsRemaining(1)
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current)
                countdownIntervalRef.current = null
              }
            } else {
              const secs = Math.ceil(diffMs / 1000)
              setSecondsRemaining(Math.min(3, Math.max(1, secs)))
            }
          }, 100)

          silenceTimerRef.current = setTimeout(() => {
            triggerFinalProcessing()
          }, durationMs)
        }

        recognition.onresult = (event: any) => {
          // Separa os resultados da sessão atual entre finalizados (isFinal === true)
          // e segmento provisório (interim/não-final) corrente.
          let sessionFinal = ''
          let sessionInterim = ''

          if (event.results) {
            for (let i = 0; i < event.results.length; i++) {
              const res = event.results[i]
              const transcriptPiece = res[0]?.transcript || ''
              if (res.isFinal) {
                sessionFinal = sessionFinal
                  ? `${sessionFinal} ${transcriptPiece.trim()}`
                  : transcriptPiece.trim()
              } else {
                sessionInterim = sessionInterim
                  ? `${sessionInterim} ${transcriptPiece.trim()}`
                  : transcriptPiece.trim()
              }
            }
          }

          // Combina o buffer de sessões anteriores com os finais desta sessão
          let combinedFinal = finalBufferRef.current.trim()
          if (sessionFinal) {
            combinedFinal = combinedFinal ? `${combinedFinal} ${sessionFinal}` : sessionFinal
          }

          // O texto completo atual é o buffer final acumulado + o segmento provisório corrente (sempre substituído)
          let fullTranscript = combinedFinal
          if (sessionInterim) {
            fullTranscript = fullTranscript ? `${fullTranscript} ${sessionInterim}` : sessionInterim
          }

          // Remove espaços múltiplos
          fullTranscript = fullTranscript.replace(/\s+/g, ' ').trim()

          latestTranscriptRef.current = fullTranscript
          setTextoFalado(fullTranscript)

          // Reiniciar timer de 3s a cada fala detectada
          scheduleSilenceProcessing()
        }

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition onerror:', event.error)
          hadErrorRef.current = true
          clearSilenceTimer()
          recognitionRef.current = null
          setIsListening(false)
          setAudioDetected(false)
          setIsListeningForAmountOnly(false)
          isListeningForAmountOnlyRef.current = false

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

        // Ao encerrar a escuta: NUNCA reinicia automaticamente.
        // O microfone permanece desligado em repouso definitivo.
        recognition.onend = () => {
          clearSilenceTimer()
          recognitionRef.current = null
          setIsListening(false)
          setAudioDetected(false)

          // Ao encerrar a sessão de reconhecimento atual, congela o que já foi capturado no finalBufferRef
          // Isso garante que se o recognition reabrir/reiniciar sem o usuário ter cancelado,
          // o texto já falado é preservado e não se perde nem se duplica
          if (latestTranscriptRef.current.trim()) {
            finalBufferRef.current = latestTranscriptRef.current.trim()
          }

          const finalCapturado = latestTranscriptRef.current.trim()

          if (finalCapturado && !hadErrorRef.current) {
            userStoppedManuallyRef.current = false
            handleStopAndProcess(finalCapturado)
          } else {
            setIsListeningForAmountOnly(false)
            isListeningForAmountOnlyRef.current = false
          }
        }

        recognitionRef.current = recognition
        recognition.start()
        setIsListening(true)
      } catch (err: any) {
        console.warn('Erro síncrono ao iniciar SpeechRecognition:', err)
        clearSilenceTimer()
        setIsListening(false)
        setAudioDetected(false)
        setIsListeningForAmountOnly(false)
        isListeningForAmountOnlyRef.current = false
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
          text: "Olá! Eu sou o Curiangoo Copilot, seu assistente financeiro. Registre receitas e despesas por voz, no seu ritmo — por exemplo: 'almoço, 35 reais, no Restaurante do Zé'. Você também pode consultar informações como: 'quanto ainda posso gastar este mês?'.",
          timestamp: new Date(),
        },
      ])
      setInputVal('')
      setTextoFalado('')
      latestTranscriptRef.current = ''
      finalBufferRef.current = ''
      setPendingTransaction(null)
      pendingTransactionRef.current = null
      setErrorMessage(null)
      setMissingAmountInput('')
      setIsListeningForAmountOnly(false)
      isListeningForAmountOnlyRef.current = false
      hadErrorRef.current = false
      userStoppedManuallyRef.current = false
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

  // Extrai nome limpo da categoria, subcategoria, balde e tipo de opção (existente vs nova)
  // a partir de strings como:
  // "📁 Usar existente: Lazer › subcategoria Manicure"
  // "✨ Criar nova: Cuidados Pessoais (Estilo de Vida)"
  // "Manicure › dentro de Lazer (Estilo de Vida)" ou "Cuidados Pessoais (Estilo de Vida)"
  const parseCategoryOptionString = useCallback(
    (
      rawOption: string,
      fallbackBucket?: 'essential' | 'lifestyle' | 'goals',
      availableOptions?: string[] | null,
      structuredOptions?: StructuredSuggestionOption[] | null,
    ) => {
      let rawClean = rawOption.trim()

      // Se temos structuredOptions, tentar match direto pelo rotulo ou categoria
      if (structuredOptions && structuredOptions.length > 0) {
        const matched = structuredOptions.find(
          (s) =>
            s.rotulo.toLowerCase() === rawClean.toLowerCase() ||
            rawClean.toLowerCase().includes(s.rotulo.toLowerCase()) ||
            s.categoria.toLowerCase() === rawClean.toLowerCase(),
        )
        if (matched) {
          let b: 'essential' | 'lifestyle' | 'goals' = fallbackBucket || 'lifestyle'
          if (matched.balde) {
            const low = matched.balde.toLowerCase()
            if (low.includes('essencia') || low.includes('necessidade')) b = 'essential'
            else if (low.includes('meta') || low.includes('invest')) b = 'goals'
            else b = 'lifestyle'
          }
          return {
            categoryName: matched.categoria,
            subcategoryName: matched.subcategoria || undefined,
            bucket: b,
            optionType: matched.tipo,
          }
        }
      }

      // Remover prefixos comuns de confirmação se houver (ex: "fechado em cuidados pessoais", "pode ser em lazer")
      rawClean = rawClean
        .replace(
          /^(fechado\s+em|pode\s+ser\s+(em\s+)?|coloca\s+em\s+|prefiro\s+|quero\s+|vincula\s+em\s+|marca\s+como\s+)/i,
          '',
        )
        .trim()

      // Se o usuário falou algo curto e existe em availableOptions, tenta casar
      if (availableOptions && availableOptions.length > 0) {
        if (/^(a\s+primeira|primeira\s+opcao|opcao\s+1)$/i.test(rawClean)) {
          rawClean = availableOptions[0]
        } else if (
          /^(a\s+segunda|segunda\s+opcao|opcao\s+2)$/i.test(rawClean) &&
          availableOptions.length > 1
        ) {
          rawClean = availableOptions[1]
        } else {
          const matchedOpt = availableOptions.find(
            (opt) =>
              opt.toLowerCase().includes(rawClean.toLowerCase()) ||
              rawClean.toLowerCase().includes(opt.toLowerCase()),
          )
          if (matchedOpt) {
            rawClean = matchedOpt
          }
        }
      }

      // Detectar se é existente ou nova com base no prefixo
      const isExistente =
        rawClean.startsWith('📁') ||
        rawClean.toLowerCase().includes('usar existente') ||
        rawClean.toLowerCase().includes('› dentro de') ||
        rawClean.toLowerCase().includes('subcategoria')

      const optionType: 'existente' | 'nova' = isExistente ? 'existente' : 'nova'

      // Limpar emojis e tags
      let catName = rawClean
        .replace(/^[📁✨]\s*/, '')
        .replace(/^(usar\s+existente|criar\s+nova)\s*:\s*/i, '')
        .trim()

      let bucket: 'essential' | 'lifestyle' | 'goals' = fallbackBucket || 'lifestyle'
      let subName: string | undefined

      // Extrair o balde entre parênteses no final, ex: "(Estilo de Vida)"
      const parenMatch = catName.match(/^(.*?)\s*\((.*?)\)$/)
      if (parenMatch) {
        catName = parenMatch[1].trim()
        const rawBucketInside = parenMatch[2].toLowerCase()
        if (rawBucketInside.includes('essencia') || rawBucketInside.includes('necessidade')) {
          bucket = 'essential'
        } else if (rawBucketInside.includes('meta') || rawBucketInside.includes('invest')) {
          bucket = 'goals'
        } else {
          bucket = 'lifestyle'
        }
      }

      // Tratar formato: "Lazer › subcategoria Manicure"
      const subNestedMatch1 = catName.match(/^(.*?)\s*(?:›|>)\s*(?:subcategoria\s+)?(.*?)$/i)
      // Tratar formato: "Manicure › dentro de Lazer"
      const subNestedMatch2 = catName.match(/^(.*?)\s*(?:›|>)\s*dentro\s+de\s+(.*?)$/i)

      if (subNestedMatch2) {
        subName = subNestedMatch2[1].trim()
        catName = subNestedMatch2[2].trim()
      } else if (subNestedMatch1) {
        // Ex: "Lazer › subcategoria Manicure" -> catName = Lazer, subName = Manicure
        catName = subNestedMatch1[1].trim()
        subName = subNestedMatch1[2].trim()
      } else if (catName.includes('/')) {
        const parts = catName.split('/').map((p) => p.trim())
        catName = parts[0]
        subName = parts[1] || undefined
      }

      return { categoryName: catName, bucket, subcategoryName: subName, optionType }
    },
    [],
  )

  // Aplica a categoria e persiste a nova estrutura para a família (Human-in-the-Loop)
  const handleApplyAndPersistCategory = useCallback(
    async (
      rawCategoryChoice: string,
      cardData?: ParsedVoiceTransaction | null,
      structuredOption?: StructuredSuggestionOption | null,
    ) => {
      const base = cardData || pendingTransactionRef.current
      if (!base || base.amountCents <= 0) return

      let cleanCatName = ''
      let resolvedBucket: 'essential' | 'lifestyle' | 'goals' = base.bucketSuggestion || 'lifestyle'
      let subcategoryName: string | undefined
      let optionType: 'existente' | 'nova' = 'nova'

      if (structuredOption) {
        cleanCatName = structuredOption.categoria
        subcategoryName = structuredOption.subcategoria || undefined
        optionType = structuredOption.tipo
        if (structuredOption.balde) {
          const low = structuredOption.balde.toLowerCase()
          if (low.includes('essencia') || low.includes('necessidade')) resolvedBucket = 'essential'
          else if (low.includes('meta') || low.includes('invest')) resolvedBucket = 'goals'
          else resolvedBucket = 'lifestyle'
        }
      } else {
        const parsed = parseCategoryOptionString(
          rawCategoryChoice,
          base.bucketSuggestion,
          base.clarificationOptions,
          base.structuredOptions,
        )
        cleanCatName = parsed.categoryName
        resolvedBucket = parsed.bucket
        subcategoryName = parsed.subcategoryName
        optionType = parsed.optionType
      }

      // 1. Procurar se já existe categoria cadastrada com esse nome
      let matchedCategory = categories.find(
        (c) =>
          c.type === base.type &&
          (c.name.toLowerCase() === cleanCatName.toLowerCase() ||
            c.name.toLowerCase().includes(cleanCatName.toLowerCase()) ||
            cleanCatName.toLowerCase().includes(c.name.toLowerCase())),
      )

      // 2. Se for explicitamente criação de nova categoria OU se não existir, persistir no banco para a família
      let wasCreated = false
      if (!matchedCategory && family?.id) {
        try {
          const mappedBucket =
            resolvedBucket === 'goals'
              ? 'future'
              : resolvedBucket === 'essential'
                ? 'essentials'
                : 'lifestyle'

          const createdCategory = await addNewCategory(
            cleanCatName,
            base.type,
            '#64748B',
            'Tag',
            mappedBucket,
          )
          matchedCategory = createdCategory
          wasCreated = true
        } catch (catErr) {
          console.warn('Erro ao persistir nova categoria para a família:', catErr)
        }
      }

      // Se houver subcategoria a associar/persistir
      const finalSubName = subcategoryName || base.subcategoryNameSuggestion
      if (matchedCategory && finalSubName) {
        const existingSub = matchedCategory.subcategories?.find(
          (s) => s.name.toLowerCase() === finalSubName.toLowerCase(),
        )
        if (!existingSub) {
          try {
            await addNewSubcategory(matchedCategory.id, finalSubName)
          } catch (subErr) {
            console.warn('Erro ao persistir subcategoria:', subErr)
          }
        }
      }

      const updated: ParsedVoiceTransaction = {
        ...base,
        aiStatus: 'sucesso',
        categoryNameSuggestion: matchedCategory ? matchedCategory.name : cleanCatName,
        subcategoryNameSuggestion: finalSubName,
        bucketSuggestion: (matchedCategory?.budget_bucket as any) || resolvedBucket,
        confidence: 0.95,
        clarificationQuestion: null,
        clarificationOptions: null,
        structuredOptions: null,
        friendlyMessage: null,
      }

      setPendingTransaction(updated)
      pendingTransactionRef.current = updated

      const feedbackMsg =
        optionType === 'existente' || (!wasCreated && matchedCategory)
          ? `Perfeito! Usando categoria existente "${updated.categoryNameSuggestion}"${finalSubName ? ` (subcategoria: ${finalSubName})` : ''}. Pronto para confirmar o lançamento:`
          : `Ótimo! Categoria "${updated.categoryNameSuggestion}" criada e vinculada. Pronto para confirmar o lançamento:`

      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: rawCategoryChoice,
          timestamp: new Date(),
        },
        {
          id: `assistant-${Date.now() + 1}`,
          sender: 'assistant',
          text: feedbackMsg,
          timestamp: new Date(),
          cardData: updated,
          cardType: 'sucesso',
        },
      ])
    },
    [addNewCategory, addNewSubcategory, categories, family?.id, parseCategoryOptionString],
  )

  // Ação ao clicar em uma opção de sugestão da IA no estado "clarificacao" ou "clarificacao_categoria"
  const handleSelectClarificationOption = (
    option: string,
    cardData?: ParsedVoiceTransaction,
    structuredOpt?: StructuredSuggestionOption | null,
  ) => {
    handleApplyAndPersistCategory(option, cardData, structuredOpt)
  }

  // Reiniciar escuta para tentar novamente (usado pelo card inválido)
  const handleRetryListening = () => {
    setPendingTransaction(null)
    pendingTransactionRef.current = null
    setTextoFalado('')
    setMissingAmountInput('')
    setIsListeningForAmountOnly(false)
    isListeningForAmountOnlyRef.current = false
    latestTranscriptRef.current = ''
    finalBufferRef.current = ''
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
          'Não conseguimos identificar o valor em reais. Fale ou digite o valor no chat.',
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

  // Renderizador do Card Verde de Confirmação dentro do Chat
  const renderSuccessCard = (data: ParsedVoiceTransaction) => {
    const bucketKey = (
      data.bucketSuggestion === 'goals'
        ? 'future'
        : data.bucketSuggestion === 'essential'
          ? 'essentials'
          : data.bucketSuggestion || 'lifestyle'
    ) as BudgetBucket
    const bucketInfo = BUCKET_METADATA[bucketKey]
    const bucketLabel = bucketInfo?.shortLabel || 'Estilo de Vida'
    const categoryName = data.categoryNameSuggestion || 'Geral'
    const isExpense = data.type !== 'income'

    return (
      <div className="mt-2.5 w-full rounded-2xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50/95 via-teal-50/60 to-white p-3 sm:p-3.5 space-y-3 shadow-md text-left overflow-hidden">
        {/* Cabeçalho: Tipo à esquerda + Precisão à direita */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0 ${
                isExpense ? 'bg-rose-600' : 'bg-emerald-600'
              }`}
            >
              {isExpense ? (
                <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 truncate">
              {isExpense ? 'Despesa Detectada' : 'Receita Detectada'}
            </span>
          </div>

          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 whitespace-nowrap">
            {Math.round(data.confidence * 100)}% precisão
          </span>
        </div>

        {/* Bloco Central Mobile-First: Descrição, Valor em Destaque e Categorização Clara */}
        <div className="space-y-2.5 rounded-xl bg-white/85 p-2.5 sm:p-3 border border-emerald-200/70 shadow-xs">
          {/* Título / Descrição */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
              Descrição
            </span>
            <h4 className="text-sm font-bold text-slate-900 leading-snug break-words">
              {data.description}
            </h4>
            {data.establishment && (
              <p className="text-[11px] text-slate-500 break-words">
                Local: <strong className="text-slate-700">{data.establishment}</strong>
              </p>
            )}
          </div>

          {/* Valor em destaque próprio */}
          <div className="pt-2 border-t border-slate-100 flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Valor
            </span>
            <span
              className={`text-2xl font-black tabular-nums tracking-tight break-words ${
                isExpense ? 'text-slate-950' : 'text-emerald-700'
              }`}
            >
              {data.amountCents > 0 ? data.amountFormatted : 'R$ 0,00'}
            </span>
          </div>

          {/* Categoria e Balde bem visíveis em linhas/chips dedicados */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
              Classificação Orçamentária
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Chip da Categoria */}
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-100/90 text-[#064E3B] border border-emerald-300/80 max-w-full">
                <Tag className="w-3 h-3 shrink-0 text-emerald-700" />
                <span className="truncate" title={categoryName}>
                  {categoryName}
                  {data.subcategoryNameSuggestion ? ` › ${data.subcategoryNameSuggestion}` : ''}
                </span>
              </span>

              {/* Chip do Balde Orçamentário */}
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border max-w-full ${
                  bucketInfo?.bgLight || 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
                title={`Balde: ${bucketInfo?.name || bucketLabel}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-80" />
                <span className="truncate">{bucketLabel}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Botões de Ação no próprio balão de chat */}
        <div className="pt-1 border-t border-emerald-200/70">
          <Button
            type="button"
            onClick={() => handleConfirmTransaction(data)}
            disabled={isSaving || data.amountCents <= 0}
            className="w-full bg-[#064E3B] hover:bg-emerald-900 text-white rounded-xl font-bold text-xs h-11 gap-1.5 shadow-sm transition-all active:scale-[0.99]"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="truncate">{isSaving ? 'Salvando...' : '✅ Confirmar Lançamento'}</span>
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
                clearSilenceTimer()
                const captured = latestTranscriptRef.current.trim()
                const active = recognitionRef.current
                recognitionRef.current = null
                if (active) {
                  try {
                    active.stop()
                  } catch {
                    // silenciar
                  }
                }
                setIsListening(false)
                setAudioDetected(false)
                if (captured) {
                  handleStopAndProcess(captured)
                } else {
                  setIsListeningForAmountOnly(false)
                  isListeningForAmountOnlyRef.current = false
                }
              } else {
                setTextoFalado('')
                latestTranscriptRef.current = ''
                finalBufferRef.current = ''
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
            {isListening && isListeningForAmountOnly ? (
              <span className="flex items-center gap-1.5">
                <span>Ouvindo valor... fale agora</span>
                {secondsRemaining !== null && (
                  <span className="bg-white/25 px-1.5 py-0.5 rounded-full font-mono text-[10px]">
                    {secondsRemaining}s
                  </span>
                )}
              </span>
            ) : (
              '🎤 Falar apenas o valor'
            )}
          </Button>
        </div>
      </div>
    )
  }

  // Renderizador do Card clarificacao_categoria e clarificacao no Chat com pílulas interativas
  const renderClarificationCategoryCard = (data: ParsedVoiceTransaction) => {
    const isCategoryClarification = data.aiStatus === 'clarificacao_categoria'
    const titleText = isCategoryClarification
      ? 'Onde prefere organizar essa despesa?'
      : data.clarificationQuestion || 'Identifiquei o valor! Escolha uma opção para completar:'

    // Mapeamento estruturado das opções disponíveis (para renderizar com ícone de pasta/brilho)
    const optionsToRender: Array<{
      raw: string
      label: string
      tipo: 'existente' | 'nova'
      structured?: StructuredSuggestionOption | null
    }> = (data.clarificationOptions || []).map((opcao, idx) => {
      const structured = data.structuredOptions && data.structuredOptions[idx]
      if (structured) {
        return {
          raw: opcao,
          label: structured.rotulo || opcao,
          tipo: structured.tipo,
          structured,
        }
      }
      const isExistente =
        opcao.startsWith('📁') ||
        opcao.toLowerCase().includes('usar existente') ||
        opcao.toLowerCase().includes('› dentro de') ||
        opcao.toLowerCase().includes('subcategoria')
      return {
        raw: opcao,
        label: opcao,
        tipo: isExistente ? 'existente' : 'nova',
        structured: null,
      }
    })

    return (
      <div className="mt-2.5 rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/90 via-sky-50/50 to-white p-3 sm:p-3.5 space-y-3 shadow-sm text-left">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shadow-xs">
              <Tag className="w-3 h-3" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900">
              {isCategoryClarification ? 'Organização de Categoria' : 'Clarificação Necessária'}
            </span>
          </div>

          <p className="text-xs font-semibold text-slate-800 leading-snug">{titleText}</p>
        </div>

        {/* Pílulas interativas clicáveis com sugestões da IA e distinção visual existente vs nova */}
        {optionsToRender.length > 0 && (
          <div className="flex flex-col gap-2 pt-0.5">
            {optionsToRender.map((item, index) => {
              const isExistente = item.tipo === 'existente'
              return (
                <button
                  key={index}
                  type="button"
                  data-testid={`category-option-${item.tipo}-${index}`}
                  onClick={() => handleSelectClarificationOption(item.raw, data, item.structured)}
                  className={`inline-flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all text-xs font-semibold shadow-xs group active:scale-[0.98] cursor-pointer text-left w-full ${
                    isExistente
                      ? 'border-emerald-300 bg-emerald-50/60 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-emerald-950'
                      : 'border-violet-300 bg-violet-50/60 hover:bg-violet-600 hover:text-white hover:border-violet-600 text-violet-950'
                  }`}
                  title={`Selecionar: ${item.label}`}
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 self-start mt-0.5 sm:self-center sm:mt-0 ${
                        isExistente
                          ? 'bg-emerald-100 text-emerald-800 group-hover:bg-white group-hover:text-emerald-700'
                          : 'bg-violet-100 text-violet-800 group-hover:bg-white group-hover:text-violet-700'
                      }`}
                    >
                      {isExistente ? (
                        <Folder className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <span className="break-words leading-snug">{item.label}</span>
                  </span>
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 transition-colors self-start mt-1 sm:self-center sm:mt-0 ${
                      isExistente
                        ? 'text-emerald-500 group-hover:text-white'
                        : 'text-violet-500 group-hover:text-white'
                    }`}
                  />
                </button>
              )
            })}
          </div>
        )}

        <p className="text-[10px] text-slate-500 italic">
          Toque em uma opção ou fale/digite outra categoria abaixo.
        </p>
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
                  {msg.id === 'welcome-1' ? (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">
                      Olá! Eu sou o Curiangoo Copilot, seu assistente financeiro.{' '}
                      <span
                        className="inline-flex items-center justify-center align-middle mx-0.5 w-4 h-4 rounded-full bg-[#064E3B] p-0.5 shadow-xs border border-emerald-500/30 overflow-hidden shrink-0"
                        title="Curiangoo"
                      >
                        <img
                          src="/icon.svg"
                          alt="Curiangoo"
                          className="w-full h-full object-contain rounded-full"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = 'inline-block'
                          }}
                        />
                        <Bird className="w-2.5 h-2.5 text-white hidden" />
                      </span>{' '}
                      Registre receitas e despesas por voz, no seu ritmo — por exemplo:
                      &apos;almoço, 35 reais, no Restaurante do Zé&apos;. Você também pode consultar
                      informações como: &apos;quanto ainda posso gastar este mês?&apos;.
                    </p>
                  ) : (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  )}

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
                    (msg.cardType === 'clarificacao' ||
                      msg.cardType === 'clarificacao_categoria') &&
                    msg.cardData &&
                    renderClarificationCategoryCard(msg.cardData)}

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
                  <span
                    className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                      secondsRemaining === 3
                        ? 'bg-emerald-500 animate-pulse'
                        : secondsRemaining === 2
                          ? 'bg-emerald-400'
                          : secondsRemaining === 1
                            ? 'bg-slate-400'
                            : 'bg-emerald-500 animate-pulse'
                    }`}
                  />
                  <span className="text-emerald-800 font-bold">
                    Ouvindo... pode falar no seu ritmo
                  </span>
                </>
              ) : (
                <span className="text-slate-400">Microfone pronto</span>
              )}
            </span>

            {isListening && (
              <div className="flex items-center gap-1.5">
                {secondsRemaining !== null && (
                  <span
                    data-testid="silence-countdown-badge"
                    className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-full transition-all duration-300 ${
                      secondsRemaining === 3
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 scale-100'
                        : secondsRemaining === 2
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 scale-95 opacity-90'
                          : 'bg-slate-200 text-slate-600 border border-slate-300 scale-90 opacity-75'
                    }`}
                    title={`Enviando em ${secondsRemaining}s`}
                  >
                    <span>{secondsRemaining}s</span>
                  </span>
                )}
                <span className="text-[10px] text-slate-400">Pausa envia automaticamente</span>
              </div>
            )}
          </div>

          {/* Linha de Ação: Microfone Central + Campo de Digitação */}
          <div className="flex items-center gap-2">
            {/* Botão Central de Microfone com Badge/Anel de Contagem Regressiva */}
            <div className="relative shrink-0">
              {isListening ? (
                <button
                  type="button"
                  onClick={() => {
                    userStoppedManuallyRef.current = true
                    clearSilenceTimer()
                    const captured = latestTranscriptRef.current.trim()
                    const active = recognitionRef.current
                    recognitionRef.current = null
                    if (active) {
                      try {
                        active.stop()
                      } catch {
                        // silenciar
                      }
                    }
                    setIsListening(false)
                    setAudioDetected(false)
                    if (captured) {
                      handleStopAndProcess(captured)
                    } else {
                      stopListening()
                    }
                  }}
                  className={`relative w-11 h-11 rounded-2xl flex items-center justify-center shadow-md transition-all duration-300 active:scale-95 ${
                    secondsRemaining === 3
                      ? 'bg-[#064E3B] text-white shadow-emerald-900/30 animate-pulse'
                      : secondsRemaining === 2
                        ? 'bg-emerald-800 text-white shadow-emerald-900/20'
                        : secondsRemaining === 1
                          ? 'bg-slate-600 text-slate-200 shadow-slate-900/10'
                          : 'bg-[#064E3B] text-white shadow-emerald-900/30 animate-pulse'
                  }`}
                  title="Toque para concluir"
                >
                  <Mic
                    className={`w-5 h-5 transition-colors duration-300 ${
                      secondsRemaining === 1 ? 'text-slate-300' : 'text-emerald-300'
                    }`}
                  />
                  {secondsRemaining !== null && (
                    <span
                      key={secondsRemaining}
                      data-testid="mic-countdown-pill"
                      className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold font-mono flex items-center justify-center shadow-xs transition-all duration-300 animate-in zoom-in-75 ${
                        secondsRemaining === 3
                          ? 'bg-emerald-500 text-white ring-2 ring-white scale-100'
                          : secondsRemaining === 2
                            ? 'bg-emerald-400 text-white ring-2 ring-white scale-95 opacity-90'
                            : 'bg-slate-500 text-slate-100 ring-2 ring-white scale-90 opacity-80'
                      }`}
                    >
                      {secondsRemaining}
                    </span>
                  )}
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
