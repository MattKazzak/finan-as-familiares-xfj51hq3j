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
  Tag,
  Folder,
  Square,
  X,
  RotateCcw,
} from 'lucide-react'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import { CopilotTypingBubble } from '@/components/brand/CopilotTypingBubble'
import { CategoryHighlightChip } from '@/components/categories/CategoryHighlightChip'
import { ParsedVoiceTransaction, StructuredSuggestionOption } from '@/services/voice-parser'
import { parseVoiceWithAi } from '@/services/voice-ai'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { createTransaction, updateTransaction, deleteTransaction } from '@/services/transactions'
import { BUCKET_METADATA } from '@/types/budget-presets'
import { BudgetBucket } from '@/types/finance'
import { fetchCopilotMessages, saveCopilotMessage } from '@/services/copilot'
import {
  getLocalAiConsent,
  fetchUserPreferencesWithFallback,
  saveUserAiConsent,
} from '@/services/user-preferences'

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
    | 'consulta'
    | 'acao'
  aiError?: string | null
  confirmedTxId?: string | null
  undoAction?: () => void
  editAction?: () => void
}

function getAiConsent(): boolean {
  return getLocalAiConsent()
}

function setAiConsent(consented: boolean) {
  saveUserAiConsent(consented)
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
  const [hasAiConsent, setHasAiConsent] = useState<boolean>(() => getAiConsent())
  const [showConsentPrompt, setShowConsentPrompt] = useState<boolean>(false)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const messagesRef = useRef<ChatMessage[]>([])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  const [inputVal, setInputVal] = useState('')

  // Estado da transação parcial em 2 turnos (sobrevive a reinícios do microfone e mensagens)
  const [pendingTransaction, setPendingTransaction] = useState<ParsedVoiceTransaction | null>(null)
  const [lastCreatedTransactionId, setLastCreatedTransactionId] = useState<string | null>(null)
  const lastCreatedTransactionIdRef = useRef<string | null>(null)

  useEffect(() => {
    lastCreatedTransactionIdRef.current = lastCreatedTransactionId
  }, [lastCreatedTransactionId])

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

  const [isListeningForAmountOnly, setIsListeningForAmountOnly] = useState(false)

  // Tempo decorrido de gravação em segundos (mm:ss)
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState<number>(0)
  const recordingTimerRef = useRef<any>(null)

  // Refs de controle
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const latestTranscriptRef = useRef<string>('')
  // Buffers dedicados para evitar duplicações cumulativas de interimResults e reinícios
  const finalBufferRef = useRef<string>('')
  const hadErrorRef = useRef<boolean>(false)
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

  // Parar gravação ativa de forma segura
  const stopListening = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setRecordingElapsedSeconds(0)

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
  }, [])

  // Helper para construir contexto_anterior a partir de transação parcial pendente ou última criada
  const buildPreviousContext = useCallback((base: ParsedVoiceTransaction | null) => {
    if (!base && !lastCreatedTransactionIdRef.current) return null
    return {
      descricao: base?.description,
      estabelecimento: base?.establishment || null,
      categoria: base?.categoryNameSuggestion,
      subcategoria: base?.subcategoryNameSuggestion,
      balde: base?.bucketSuggestion,
      tipo: base?.type === 'income' ? ('receita' as const) : ('despesa' as const),
      valor: base && base.amountCents > 0 ? base.amountCents / 100 : null,
      status: base?.aiStatus,
      opcoes_sugestao: base?.structuredOptions || base?.clarificationOptions,
      opcoes_estruturadas: base?.structuredOptions || null,
      lastCreatedTransactionId: lastCreatedTransactionIdRef.current,
    }
  }, [])

  // Mesclar novo valor com transação parcial pendente (preserva estritamente o item e sua categoria/subcategoria)
  const handleMergeAmountIntoTransaction = useCallback(
    (
      newAmountCents: number,
      paymentMethodOverride?: 'pix' | 'debito' | 'credito' | 'dinheiro',
      mergedCandidate?: Partial<ParsedVoiceTransaction>,
    ): ParsedVoiceTransaction | null => {
      const base = pendingTransactionRef.current
      if (!base && !mergedCandidate) return null

      const activeBase = base || ({} as ParsedVoiceTransaction)
      const cents = newAmountCents > 0 ? newAmountCents : mergedCandidate?.amountCents || 0

      const formatted = (cents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })

      // Regra Caso 1: Quando o usuário responde só com número no 2º turno,
      // a descrição e as categorias pré-identificadas no 1º turno NÃO DEVEM ser sobrescritas por "60" ou fallbacks vazios
      const candidateDescIsPureNumber =
        mergedCandidate?.description &&
        /^\d+([,.]\d{1,2})?$/.test(mergedCandidate.description.trim())

      const finalDescription =
        activeBase.description && candidateDescIsPureNumber
          ? activeBase.description
          : mergedCandidate?.description?.trim() || activeBase.description || 'Lançamento'

      const finalCategory =
        activeBase.categoryNameSuggestion || mergedCandidate?.categoryNameSuggestion
      const finalSubcategory =
        activeBase.subcategoryNameSuggestion || mergedCandidate?.subcategoryNameSuggestion
      const finalBucket =
        activeBase.bucketSuggestion || mergedCandidate?.bucketSuggestion || 'lifestyle'

      const merged: ParsedVoiceTransaction = {
        ...activeBase,
        ...mergedCandidate,
        amountCents: cents,
        amountFormatted: formatted,
        description: finalDescription,
        establishment: activeBase.establishment || mergedCandidate?.establishment,
        categoryNameSuggestion: finalCategory,
        subcategoryNameSuggestion: finalSubcategory,
        bucketSuggestion: finalBucket,
        paymentMethod:
          paymentMethodOverride || mergedCandidate?.paymentMethod || activeBase.paymentMethod,
        aiStatus: 'sucesso',
        confidence: Math.max(activeBase.confidence || 0.8, mergedCandidate?.confidence || 0.8),
        clarificationQuestion: null,
        clarificationOptions: null,
        friendlyMessage: mergedCandidate?.friendlyMessage || null,
      }

      setPendingTransaction(merged)
      pendingTransactionRef.current = merged
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

      // No instante exato em que parar a escuta, desativa o mic
      stopListening()

      const textToProcess = (
        overrideText !== undefined ? overrideText : latestTranscriptRef.current
      ).trim()

      if (!textToProcess) {
        return
      }

      // Exibe imediatamente o indicador de processamento ("digitando..." com bolinhas animadas)
      // eliminando qualquer sensação de tela travada enquanto a IA processa
      setIsProcessingAi(true)

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

      // Persistência em background da mensagem do usuário (Parte 1)
      if (family?.id) {
        saveCopilotMessage({
          familyId: family.id,
          role: 'user',
          content: textToProcess,
          cardType: null,
        }).catch(() => {})
      }

      try {
        const previousContext =
          isAmountOnly ||
          existingPartial?.aiStatus === 'falta_valor' ||
          existingPartial?.aiStatus === 'clarificacao_categoria' ||
          existingPartial?.aiStatus === 'clarificacao'
            ? buildPreviousContext(existingPartial)
            : null

        // Captura as últimas mensagens da conversa para enviar como memória contínua à Edge Function
        const historyForAi = messagesRef.current.slice(-6).map((m) => ({
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.text,
        }))

        const parsed = await parseVoiceWithAi({
          texto: textToProcess,
          familyId: family?.id,
          categories,
          contexto_anterior: previousContext,
          historico_mensagens: historyForAi,
        })

        // Intenção de Desfazer / Cancelar último lançamento
        const isUndoIntent =
          parsed.acao === 'desfazer' ||
          parsed.intencao === 'desfazer' ||
          /^(desfaz|desfazer|cancela|cancelar|apaga|apagar|exclui|excluir|deleta|deletar)\b/i.test(
            textToProcess.replace(/[.!?]/g, '').trim(),
          )

        if (isUndoIntent) {
          await handleUndoLastTransaction()
          return
        }

        // Intenção de Reclassificação / Ajuste de transação anterior já lançada
        const isCorrectionOfLastTx = Boolean(
          lastCreatedTransactionIdRef.current &&
          (parsed.acao === 'reclassificar' ||
            parsed.acao === 'ajustar_valor' ||
            parsed.acao === 'ajustar_descricao' ||
            parsed.intencao === 'correcao' ||
            /^(supermercado n[aã]o|n[aã]o \w+,? coloca em|coloca em|muda pra|muda para|altera para|n[aã]o [eé] esse valor|foi \d+|ops, n[aã]o [eé]|corrige)/i.test(
              textToProcess,
            )),
        )

        if (isCorrectionOfLastTx) {
          const newDesc =
            parsed.acao === 'ajustar_descricao' || /ops, n[aã]o [eé] \w+, [eé]/i.test(textToProcess)
              ? parsed.description
              : null
          const newAmount =
            parsed.acao === 'ajustar_valor' ||
            (parsed.amountCents > 0 && /n[aã]o [eé] esse valor|foi \d+|valor/i.test(textToProcess))
              ? parsed.amountCents
              : null
          const newCat = parsed.categoryNameSuggestion || null
          const newSub = parsed.subcategoryNameSuggestion || null

          const ok = await handleUpdateLastTransaction({
            categoryName: newCat,
            subcategoryName: newSub,
            amountCents: newAmount,
            description: newDesc,
          })

          if (ok) {
            let reply = 'Lançamento atualizado!'
            if (newCat) {
              reply = `Ajustado para ${newSub ? `${newCat} › ${newSub}` : newCat}!`
            } else if (newAmount) {
              reply = `Valor corrigido para ${parsed.amountFormatted}!`
            } else if (newDesc) {
              reply = `Descrição corrigida para ${newDesc}!`
            }

            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                sender: 'assistant',
                text: reply,
                timestamp: new Date(),
                cardType: 'acao',
              },
            ])
            return
          }
        }

        // Caso 1: Consulta rápida (resposta acolhedora da IA sem card de lançamento)
        if (parsed.aiStatus === 'consulta' || parsed.tipoResposta === 'consulta') {
          const resposta =
            parsed.respostaConsulta ||
            parsed.friendlyMessage ||
            'Aqui estão as informações solicitadas.'

          if (family?.id) {
            saveCopilotMessage({
              familyId: family.id,
              role: 'assistant',
              content: resposta,
              cardType: 'consulta',
            }).catch(() => {})
          }

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

          const localDesc = parsed.establishment
            ? `${parsed.description} na ${parsed.establishment}`
            : parsed.description
          const friendlyMsg =
            parsed.friendlyMessage || `Identifiquei ${localDesc}. Quanto custou? 🥐`

          if (family?.id) {
            saveCopilotMessage({
              familyId: family.id,
              role: 'assistant',
              content: friendlyMsg,
              cardType: 'falta_valor',
            }).catch(() => {})
          }

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

          // Deixar o mic pronto para ouvir o valor
          setTimeout(() => {
            startRecording({ forAmountOnly: true })
          }, 400)
          return
        }

        // Caso 3: Segundo turno — usuário informou o valor após uma transação parcial pendente
        if (existingPartial && (isAmountOnly || existingPartial.aiStatus === 'falta_valor')) {
          if (parsed.amountCents > 0) {
            // CASO 1: Preserva a categoria, subcategoria e descrição identificadas no 1º turno!
            // Se parsed trouxer nova categoria ou fallback, mantém o item e categoria do existingPartial se existirem
            const candidateWithPreservedCategory: Partial<ParsedVoiceTransaction> = {
              ...parsed,
              description: existingPartial.description || parsed.description,
              categoryNameSuggestion:
                existingPartial.categoryNameSuggestion || parsed.categoryNameSuggestion,
              subcategoryNameSuggestion:
                existingPartial.subcategoryNameSuggestion || parsed.subcategoryNameSuggestion,
              bucketSuggestion: existingPartial.bucketSuggestion || parsed.bucketSuggestion,
            }

            const merged = handleMergeAmountIntoTransaction(
              parsed.amountCents,
              parsed.paymentMethod,
              candidateWithPreservedCategory,
            )

            const confirmedData = merged || {
              ...existingPartial,
              ...parsed,
              amountCents: parsed.amountCents,
              amountFormatted: parsed.amountFormatted,
              categoryNameSuggestion:
                existingPartial.categoryNameSuggestion || parsed.categoryNameSuggestion,
              subcategoryNameSuggestion:
                existingPartial.subcategoryNameSuggestion || parsed.subcategoryNameSuggestion,
              bucketSuggestion: existingPartial.bucketSuggestion || parsed.bucketSuggestion,
              aiStatus: 'sucesso' as const,
            }

            // Limpa o item pendente após ser completado
            setPendingTransaction(null)
            pendingTransactionRef.current = null

            // Executa lançamento autônomo imediato no Supabase
            const result = await executeAutonomousTransaction(confirmedData)
            const catName = result?.categoryName || confirmedData.categoryNameSuggestion || 'Geral'
            const subName = (
              result?.subcategoryName ||
              confirmedData.subcategoryNameSuggestion ||
              ''
            ).trim()
            const txId = (result?.createdTx as any)?.id || null

            const confirmationText =
              parsed.friendlyMessage && !parsed.friendlyMessage.includes('?')
                ? parsed.friendlyMessage
                : subName
                  ? `Lançado: ${confirmedData.amountFormatted} em ${catName} › ${subName}! 👍`
                  : `Lançado: ${confirmedData.amountFormatted} em ${catName}! 👍`

            if (family?.id) {
              saveCopilotMessage({
                familyId: family.id,
                role: 'assistant',
                content: confirmationText,
                cardType: 'transacao',
              }).catch(() => {})
            }

            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                sender: 'assistant',
                text: confirmationText,
                timestamp: new Date(),
                cardData: confirmedData,
                cardType: 'sucesso',
                confirmedTxId: txId,
              },
            ])
            return
          }
          // Caso a IA não tenha retornado amountCents > 0 diretamente mesmo com contexto falta_valor,
          // NÃO re-imprime a pergunta anterior na tela nem repete "Identifiquei X. Quanto custou?".
          // Mantém o estado pendente e orienta objetivamente uma única vez.
          toast({
            title: 'Valor não identificado',
            description:
              'Não conseguimos identificar o valor falado. Fale apenas o número ou digite abaixo.',
            variant: 'destructive',
          })
          const repMsg =
            'Não identifiquei o valor em reais. Fale apenas o número (ex: "12 reais") ou digite no campo abaixo.'
          if (family?.id) {
            saveCopilotMessage({
              familyId: family.id,
              role: 'assistant',
              content: repMsg,
              cardType: 'falta_valor',
            }).catch(() => {})
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              text: repMsg,
              timestamp: new Date(),
              cardData: existingPartial,
              cardType: 'falta_valor',
            },
          ])
          return
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

        // Caso 5: Lançamento com valor e descrição presentes (execução autônoma padrão ouro)
        // Se a descrição e o valor existirem, lança diretamente no Supabase em vez de travar em card de formulário
        if (
          (parsed.aiStatus === 'sucesso' || parsed.aiStatus === 'clarificacao_categoria') &&
          parsed.amountCents > 0
        ) {
          let finalParsed = parsed

          if (existingPartial && existingPartial.amountCents > 0) {
            finalParsed = {
              ...existingPartial,
              ...parsed,
              description: parsed.description || existingPartial.description,
              categoryNameSuggestion:
                parsed.categoryNameSuggestion || existingPartial.categoryNameSuggestion,
              subcategoryNameSuggestion:
                parsed.subcategoryNameSuggestion || existingPartial.subcategoryNameSuggestion,
              bucketSuggestion: parsed.bucketSuggestion || existingPartial.bucketSuggestion,
            }
          }

          setPendingTransaction(finalParsed)
          pendingTransactionRef.current = finalParsed

          // Executa lançamento autônomo no banco de dados
          const result = await executeAutonomousTransaction(finalParsed)
          const catName = result?.categoryName || finalParsed.categoryNameSuggestion || 'Geral'
          const subName = (
            result?.subcategoryName ||
            finalParsed.subcategoryNameSuggestion ||
            ''
          ).trim()
          const txId = (result?.createdTx as any)?.id || null

          const launchText =
            parsed.friendlyMessage && !parsed.friendlyMessage.includes('?')
              ? parsed.friendlyMessage
              : subName
                ? `Lançado: ${finalParsed.amountFormatted} em ${catName} › ${subName}! 👍`
                : `Lançado: ${finalParsed.amountFormatted} em ${catName}! 👍`

          if (family?.id) {
            saveCopilotMessage({
              familyId: family.id,
              role: 'assistant',
              content: launchText,
              cardType: 'transacao',
            }).catch(() => {})
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              text: launchText,
              timestamp: new Date(),
              cardData: finalParsed,
              cardType: 'sucesso',
              confirmedTxId: txId,
            },
          ])
          return
        }

        // Caso 7: Clarificação tradicional (valor existe mas descrição/termo totalmente ambíguo)
        if (parsed.aiStatus === 'clarificacao' && parsed.amountCents > 0) {
          setPendingTransaction(parsed)
          pendingTransactionRef.current = parsed

          const clarText =
            parsed.clarificationQuestion ||
            parsed.friendlyMessage ||
            `Entendi ${parsed.amountFormatted}! Mas qual a categoria deste gasto?`

          if (family?.id) {
            saveCopilotMessage({
              familyId: family.id,
              role: 'assistant',
              content: clarText,
              cardType: 'clarificacao',
            }).catch(() => {})
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              sender: 'assistant',
              text: clarText,
              timestamp: new Date(),
              cardData: parsed,
              cardType: 'clarificacao',
            },
          ])
          return
        }

        // Caso 8: Inválido ou erro — renderizado exclusivamente como mensagem em balão de chat natural
        const fallbackMsg =
          parsed.friendlyMessage ||
          "Não consegui entender esse lançamento financeiro. Tente algo como: 'Almoço 45 reais no débito no restaurante' ou 'supermercado do zé 180 no pix'"

        if (family?.id) {
          saveCopilotMessage({
            familyId: family.id,
            role: 'assistant',
            content: fallbackMsg,
            cardType: 'erro',
          }).catch(() => {})
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: fallbackMsg,
            timestamp: new Date(),
          },
        ])
      } catch (err: any) {
        console.error('Erro ao processar áudio com IA:', err)
        const errMsg = 'Ocorreu uma falha ao interpretar seu comando. Pode repetir ou digitar aqui?'
        if (family?.id) {
          saveCopilotMessage({
            familyId: family.id,
            role: 'assistant',
            content: errMsg,
            cardType: 'erro',
          }).catch(() => {})
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: errMsg,
            timestamp: new Date(),
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

  // Iniciar SpeechRecognition nativo com continuous: true e SEM temporizador de silêncio
  // A gravação termina SOMENTE quando o usuário toca o botão Parar ou Cancelar
  const startRecording = useCallback((options?: { forAmountOnly?: boolean }) => {
    const isForAmount = Boolean(options?.forAmountOnly)
    setIsListeningForAmountOnly(isForAmount)
    isListeningForAmountOnlyRef.current = isForAmount

    setErrorMessage(null)
    hadErrorRef.current = false
    setAudioDetected(false)

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setRecordingElapsedSeconds(0)

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
      // continuous = true: escuta acumula resultados até o usuário parar manualmente
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
        setPermissionStatus('granted')
        setErrorMessage(null)
        setRecordingElapsedSeconds(0)
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
        }
        recordingTimerRef.current = setInterval(() => {
          setRecordingElapsedSeconds((prev) => prev + 1)
        }, 1000)
      }
      recognition.onaudiostart = () => {
        setAudioDetected(true)
      }
      recognition.onspeechstart = () => {
        setAudioDetected(true)
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
      }

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition onerror:', event.error)
        hadErrorRef.current = true
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
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
          setErrorMessage(
            'Problema de conexão com o serviço de voz. Verifique sua internet e tente novamente.',
          )
        } else if (event.error === 'audio-capture') {
          setErrorMessage('Nenhum microfone encontrado ou o áudio do aparelho está bloqueado.')
        } else {
          setErrorMessage(
            'Não consegui entender com clareza. Toque no microfone e tente falar novamente.',
          )
        }
      }

      // Ao encerrar a escuta: mantém o que foi gravado se houver parada
      recognition.onend = () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
        recognitionRef.current = null
        setIsListening(false)
        setAudioDetected(false)

        if (latestTranscriptRef.current.trim()) {
          finalBufferRef.current = latestTranscriptRef.current.trim()
        }
      }

      recognitionRef.current = recognition
      recognition.start()
      setIsListening(true)
    } catch (err: any) {
      console.warn('Erro síncrono ao iniciar SpeechRecognition:', err)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      setIsListening(false)
      setAudioDetected(false)
      setIsListeningForAmountOnly(false)
      isListeningForAmountOnlyRef.current = false
      setErrorMessage(
        'Não foi possível ativar o microfone. Você pode digitar abaixo e enviar com o Copilot.',
      )
    }
  }, [])

  // Cancelar gravação sem enviar nada para processamento
  const handleCancelRecording = useCallback(() => {
    stopListening()
    latestTranscriptRef.current = ''
    finalBufferRef.current = ''
    setTextoFalado('')
  }, [stopListening])

  // Parar gravação e enviar o áudio acumulado para processamento
  const handleStopRecordingAndProcess = useCallback(() => {
    const captured = latestTranscriptRef.current.trim() || textoFalado.trim()
    stopListening()
    if (captured) {
      handleStopAndProcess(captured)
    } else {
      setErrorMessage('Nenhuma fala foi capturada. Fale algo ou digite abaixo.')
    }
  }, [handleStopAndProcess, stopListening, textoFalado])

  const handleAllowAiConsent = useCallback(() => {
    setAiConsent(true)
    setHasAiConsent(true)
    setShowConsentPrompt(false)
    setTimeout(() => {
      startRecording()
    }, 150)
  }, [startRecording])

  const handleDeclineAiConsent = useCallback(() => {
    setShowConsentPrompt(false)
    // "Agora não" não envia nada e permite digitação manual normalmente
    onOpenChange(false)
    onOpenManualTransaction({
      type: 'expense',
      amountCents: 0,
      description: '',
      memberId: selectedMemberId || currentMember?.id,
    })
  }, [currentMember?.id, onOpenChange, onOpenManualTransaction, selectedMemberId])

  // Gerar saudação contextual baseada na hora e membro ativo
  const getContextualGreeting = useCallback(() => {
    const hour = new Date().getHours()
    const memberName = currentMember?.name || members[0]?.name || 'família'

    if (hour >= 5 && hour < 12) {
      return `Bom dia, ${memberName}! O que vamos registrar hoje?`
    }
    if (hour >= 12 && hour < 18) {
      return `Boa tarde, ${memberName}! Teve algum gasto agora há pouco?`
    }
    return `Boa noite, ${memberName}! Vamos fechar os lançamentos do dia?`
  }, [currentMember?.name, members])

  // Iniciar sessão do modal: carrega histórico das últimas 20 mensagens do banco e dispara saudação
  useEffect(() => {
    if (open) {
      const greeting = getContextualGreeting()
      const initialWelcomeMsg: ChatMessage = {
        id: 'welcome-1',
        sender: 'assistant',
        text: greeting,
        timestamp: new Date(),
      }

      // Sincroniza consentimento inicial com banco/localStorage
      const localConsented = getAiConsent()
      setHasAiConsent(localConsented)

      fetchUserPreferencesWithFallback().then((pref) => {
        setHasAiConsent(pref.aiConsent)
        if (!pref.aiConsent) {
          setShowConsentPrompt(true)
        }
      })

      // Carrega até 20 mensagens do histórico persistido da família (Parte 1.4)
      if (family?.id) {
        fetchCopilotMessages(family.id, 20)
          .then((historyRecords) => {
            if (historyRecords && historyRecords.length > 0) {
              const mappedHistory: ChatMessage[] = historyRecords.map((rec) => ({
                id: rec.id,
                sender: rec.role,
                text: rec.content,
                timestamp: new Date(rec.created_at),
                cardType: (rec.card_type as any) || undefined,
              }))
              setMessages(mappedHistory)
            } else {
              setMessages([initialWelcomeMsg])
            }
          })
          .catch(() => {
            setMessages([initialWelcomeMsg])
          })
      } else {
        setMessages([initialWelcomeMsg])
      }

      setInputVal('')
      setTextoFalado('')
      latestTranscriptRef.current = ''
      finalBufferRef.current = ''
      setPendingTransaction(null)
      pendingTransactionRef.current = null
      setLastCreatedTransactionId(null)
      lastCreatedTransactionIdRef.current = null
      setErrorMessage(null)
      setIsListeningForAmountOnly(false)
      isListeningForAmountOnlyRef.current = false
      hadErrorRef.current = false
      setAudioDetected(false)
      setIsProcessingAi(false)
      setSelectedMemberId(currentMember?.id || members[0]?.id || '')
      setPermissionStatus('idle')

      if (!localConsented) {
        setShowConsentPrompt(true)
      } else {
        setShowConsentPrompt(false)
        startRecording()
      }
    } else {
      stopListening()
      setShowConsentPrompt(false)
      setPermissionStatus('idle')
      setIsProcessingAi(false)
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
    const textToSend = inputVal.trim()
    if (!textToSend) return

    if (!hasAiConsent && !getAiConsent()) {
      setShowConsentPrompt(true)
      return
    }

    setInputVal('')
    handleStopAndProcess(textToSend)
  }

  // Extrai nome limpo da categoria, subcategoria, balde e tipo de opção (existente vs nova)
  // a partir de strings como:
  // "📁 Usar existente: Lazer › subcategoria Manicure"
  // "✨ Criar nova: Cuidados Pessoais (Estilo de Vida)"
  // "Manicure › dentro de Lazer (Estilo de Vida)" ou "Cuidados Pessoais (Estilo de Vida)"
  const parseCategoryOptionString = useCallback(
    (
      rawOption: string,
      fallbackBucket?: BudgetBucket,
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
          let b: BudgetBucket = fallbackBucket || 'lifestyle'
          if (matched.balde) {
            const low = matched.balde.toLowerCase()
            if (low.includes('essencia') || low.includes('necessidade')) b = 'essentials'
            else if (low.includes('meta') || low.includes('invest')) b = 'future'
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

      let bucket: BudgetBucket = fallbackBucket || 'lifestyle'
      let subName: string | undefined

      // Extrair o balde entre parênteses no final, ex: "(Estilo de Vida)"
      const parenMatch = catName.match(/^(.*?)\s*\((.*?)\)$/)
      if (parenMatch) {
        catName = parenMatch[1].trim()
        const rawBucketInside = parenMatch[2].toLowerCase()
        if (rawBucketInside.includes('essencia') || rawBucketInside.includes('necessidade')) {
          bucket = 'essentials'
        } else if (rawBucketInside.includes('meta') || rawBucketInside.includes('invest')) {
          bucket = 'future'
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
      let resolvedBucket: BudgetBucket = base.bucketSuggestion || 'lifestyle'
      let subcategoryName: string | undefined
      let optionType: 'existente' | 'nova' = 'nova'

      if (structuredOption) {
        cleanCatName = structuredOption.categoria
        subcategoryName = structuredOption.subcategoria || undefined
        optionType = structuredOption.tipo
        if (structuredOption.balde) {
          const low = structuredOption.balde.toLowerCase()
          if (low.includes('essencia') || low.includes('necessidade')) resolvedBucket = 'essentials'
          else if (low.includes('meta') || low.includes('invest')) resolvedBucket = 'future'
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
          const mappedBucket: BudgetBucket = resolvedBucket

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

  // Executar lançamento autônomo diretamente no Supabase sem fechar o diálogo
  const executeAutonomousTransaction = useCallback(
    async (txData: ParsedVoiceTransaction) => {
      if (!family || txData.amountCents <= 0) return null

      try {
        setIsSaving(true)

        // CASO 1: Validação de integridade contra o catálogo real da família.
        // JAMAIS permitir salvar par inválido/órfão como "Alimentação › Utilidades & Casa" (Utilidades é de Compras).
        let targetCategory = categories.find((c) => {
          if (c.type !== txData.type) return false
          if (txData.categoryNameSuggestion) {
            return c.name.toLowerCase() === txData.categoryNameSuggestion.toLowerCase()
          }
          return false
        })

        if (!targetCategory && txData.categoryNameSuggestion) {
          targetCategory = categories.find(
            (c) =>
              c.type === txData.type &&
              (c.name.toLowerCase().includes(txData.categoryNameSuggestion!.toLowerCase()) ||
                txData.categoryNameSuggestion!.toLowerCase().includes(c.name.toLowerCase())),
          )
        }

        // Se a categoria sugerida não existir no catálogo da família
        if (!targetCategory && txData.categoryNameSuggestion) {
          try {
            const bucketKey: BudgetBucket = txData.bucketSuggestion || 'lifestyle'
            targetCategory = await addNewCategory(
              txData.categoryNameSuggestion,
              txData.type,
              '#10B981',
              'Tag',
              bucketKey,
            )
          } catch (createErr) {
            console.warn('Erro ao auto-criar categoria para o Copilot:', createErr)
          }
        }

        if (!targetCategory) {
          targetCategory = categories.find((c) => c.type === txData.type)
        }

        const categoryId = targetCategory?.id || null
        let subcategoryId: string | null = null

        if (targetCategory && txData.subcategoryNameSuggestion) {
          const subName = txData.subcategoryNameSuggestion.trim()
          // 1. Procura na categoria target
          const existingSub = targetCategory.subcategories?.find(
            (s) => s.name.toLowerCase() === subName.toLowerCase(),
          )

          if (existingSub) {
            subcategoryId = existingSub.id
          } else {
            // Se a subcategoria NÃO pertence à targetCategory, verifica se ela pertence a OUTRA categoria
            // do catálogo (ex: Utilidades & Casa pertence a Compras, NÃO a Alimentação)
            const trueOwnerCategory = categories.find((c) =>
              c.subcategories?.some((s) => s.name.toLowerCase() === subName.toLowerCase()),
            )

            if (trueOwnerCategory) {
              // Realinha para a categoria dona legítima do par do catálogo
              targetCategory = trueOwnerCategory
              const realSub = trueOwnerCategory.subcategories?.find(
                (s) => s.name.toLowerCase() === subName.toLowerCase(),
              )
              subcategoryId = realSub?.id || null
            } else if (subName) {
              // Nova subcategoria legítima sob a categoria
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
        }

        const memberId = selectedMemberId || currentMember?.id || members[0]?.id || null

        const now = new Date()
        const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        const methodMap: Record<string, string> = {
          pix: 'pix',
          credito: 'credit',
          credit: 'credit',
          debito: 'debit',
          debit: 'debit',
          dinheiro: 'cash',
          cash: 'cash',
          voucher: 'voucher',
          other: 'other',
        }
        const mappedPaymentMethod = txData.paymentMethod
          ? methodMap[txData.paymentMethod] || 'other'
          : 'other'

        const created = await createTransaction({
          family_id: family.id,
          member_id: memberId,
          category_id: categoryId,
          subcategory_id: subcategoryId,
          type: txData.type,
          amount_cents: txData.amountCents,
          description: txData.description || 'Lançamento por Voz',
          transaction_date: localDateStr,
          payment_method: mappedPaymentMethod,
          status: 'confirmed',
        })

        const txId = (created as any)?.id || null
        if (txId) {
          setLastCreatedTransactionId(txId)
          lastCreatedTransactionIdRef.current = txId
        }

        triggerRefresh()
        if (onSuccess) onSuccess()

        return {
          createdTx: created,
          categoryName: targetCategory?.name,
          subcategoryName: txData.subcategoryNameSuggestion,
        }
      } catch (err: any) {
        console.error('Erro ao executar lançamento autônomo:', err)
        toast({
          title: 'Erro ao registrar',
          description: err?.message || 'Tente novamente.',
          variant: 'destructive',
        })
        return null
      } finally {
        setIsSaving(false)
      }
    },
    [
      addNewCategory,
      addNewSubcategory,
      categories,
      currentMember?.id,
      family,
      members,
      onSuccess,
      selectedMemberId,
      toast,
      triggerRefresh,
    ],
  )

  // Desfazer última transação do contexto
  const handleUndoLastTransaction = useCallback(
    async (targetTxId?: string | null) => {
      const idToDelete = targetTxId || lastCreatedTransactionIdRef.current
      if (!idToDelete) {
        toast({
          title: 'Nenhum lançamento recente',
          description: 'Não há transação recente para desfazer.',
        })
        return
      }

      try {
        setIsSaving(true)
        await deleteTransaction(idToDelete)
        setLastCreatedTransactionId(null)
        lastCreatedTransactionIdRef.current = null
        setPendingTransaction(null)
        pendingTransactionRef.current = null

        triggerRefresh()
        if (onSuccess) onSuccess()

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: 'Lançamento desfeito com sucesso! 🗑️',
            timestamp: new Date(),
            cardType: 'acao',
          },
        ])

        toast({
          title: 'Lançamento desfeito!',
          description: 'A transação foi removida do extrato da família.',
        })
      } catch (err: any) {
        console.error('Erro ao desfazer transação:', err)
        toast({
          title: 'Erro ao desfazer',
          description: err?.message || 'Não foi possível cancelar o lançamento.',
          variant: 'destructive',
        })
      } finally {
        setIsSaving(false)
      }
    },
    [onSuccess, toast, triggerRefresh],
  )

  // Abrir tela manual ou editar a transação
  const handleEditLastTransaction = useCallback(
    (txData?: ParsedVoiceTransaction | null) => {
      const base = txData || pendingTransactionRef.current
      if (!base) return

      onOpenChange(false)
      onOpenManualTransaction({
        type: base.type,
        amountCents: base.amountCents,
        description: base.description,
        categoryId: categories.find(
          (c) => c.name.toLowerCase() === base.categoryNameSuggestion?.toLowerCase(),
        )?.id,
        memberId: selectedMemberId || currentMember?.id,
      })
    },
    [categories, currentMember?.id, onOpenChange, onOpenManualTransaction, selectedMemberId],
  )

  // Atualizar transação anterior (reclassificação, valor ou descrição)
  const handleUpdateLastTransaction = useCallback(
    async (updates: {
      categoryName?: string | null
      subcategoryName?: string | null
      amountCents?: number | null
      description?: string | null
    }) => {
      const idToUpdate = lastCreatedTransactionIdRef.current
      if (!idToUpdate) return false

      try {
        setIsSaving(true)
        const payload: any = {}

        if (updates.description) {
          payload.description = updates.description
        }
        if (updates.amountCents && updates.amountCents > 0) {
          payload.amount_cents = updates.amountCents
        }
        if (updates.categoryName) {
          let cat = categories.find(
            (c) =>
              c.name.toLowerCase() === updates.categoryName!.toLowerCase() ||
              c.name.toLowerCase().includes(updates.categoryName!.toLowerCase()) ||
              updates.categoryName!.toLowerCase().includes(c.name.toLowerCase()),
          )
          if (!cat && family?.id) {
            try {
              cat = await addNewCategory(
                updates.categoryName,
                'expense',
                '#10B981',
                'Tag',
                'lifestyle',
              )
            } catch {
              // fallback
            }
          }
          if (cat) {
            payload.category_id = cat.id
            if (updates.subcategoryName) {
              const sub = cat.subcategories?.find(
                (s) => s.name.toLowerCase() === updates.subcategoryName!.toLowerCase(),
              )
              if (sub) {
                payload.subcategory_id = sub.id
              } else {
                try {
                  const createdSub = await addNewSubcategory(cat.id, updates.subcategoryName)
                  if (createdSub?.id) payload.subcategory_id = createdSub.id
                } catch {
                  // fallback
                }
              }
            }
          }
        }

        await updateTransaction(idToUpdate, payload)
        triggerRefresh()
        if (onSuccess) onSuccess()
        return true
      } catch (err) {
        console.warn('Erro ao atualizar última transação:', err)
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [addNewCategory, addNewSubcategory, categories, family?.id, onSuccess, triggerRefresh],
  )

  // Confirmar lançamento diretamente no Supabase (mantido para compatibilidade e testes)
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

    await executeAutonomousTransaction(dataToSave)
    toast({
      title: 'Lançamento registrado com sucesso! 🎉',
      description: `${dataToSave.description} (${dataToSave.amountFormatted}) adicionado ao saldo da família.`,
    })
    onOpenChange(false)
  }

  // Micro-link discreto [Desfazer] para reverter lançamento estilo WhatsApp
  const renderConfirmationMicroLinks = (msg: ChatMessage) => {
    return (
      <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 flex items-center gap-2.5 text-[11px]">
        <button
          type="button"
          onClick={() => handleUndoLastTransaction(msg.confirmedTxId)}
          className="text-rose-600 hover:text-rose-800 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
        >
          [Desfazer]
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={() => handleEditLastTransaction(msg.cardData)}
          className="text-slate-500 hover:text-slate-700 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
        >
          Alterar
        </button>
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

  const quickPrompts = [
    { label: '🎙️ "Almoço 35 reais"', text: 'Almoço 35 reais' },
    { label: '📊 "Quanto ainda posso gastar?"', text: 'Quanto ainda posso gastar?' },
    { label: '🔍 "Últimos lançamentos"', text: 'Últimos lançamentos' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-5 sm:max-w-md md:max-w-lg shadow-2xl flex flex-col max-h-[92vh] h-[640px] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:w-full overflow-hidden">
        {/* Header Elegante do Copilot estilo Apple Intelligence */}
        <DialogHeader className="text-left space-y-0.5 pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Avatar do Curiango com status verde ativo */}
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-2xl bg-brand text-white flex items-center justify-center font-bold shadow-sm p-1 border border-brand">
                  <CuriangoLogo size={22} color="#FCA311" />
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"
                  title="Copilot Online"
                />
              </div>

              <div className="min-w-0">
                <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span className="truncate">Curiango Copilot</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                    IA Ativa
                  </span>
                </DialogTitle>
                <DialogDescription className="text-[11px] sm:text-xs text-slate-500 truncate">
                  Assistente financeiro da família
                </DialogDescription>
              </div>
            </div>

            {/* Seletor de Membro */}
            <div className="flex items-center gap-1 text-xs shrink-0">
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer transition-colors max-w-[110px] truncate"
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

          {/* Alerta de erro com botão Tentar de novo */}
          {errorMessage && (
            <div
              role="alert"
              data-testid="alert-ai-error"
              className="mt-2 text-xs px-3 py-2 rounded-2xl border border-rose-200 bg-rose-50/90 text-rose-900 flex items-center justify-between gap-2 text-left animate-in fade-in"
            >
              <div className="flex items-start gap-1.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-tight font-medium break-words text-rose-800">
                  {errorMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null)
                  startRecording()
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-rose-300 hover:bg-rose-100/70 text-rose-900 text-[11px] font-semibold shrink-0 cursor-pointer transition-colors shadow-2xs"
              >
                <RotateCcw className="w-3 h-3 text-rose-600" />
                <span>Tentar de novo</span>
              </button>
            </div>
          )}
        </DialogHeader>

        {/* ================= CORPO DO MINI-CHAT: HISTÓRICO DE MENSAGENS ================= */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto px-1 py-3 space-y-3 scroll-smooth text-xs"
        >
          {messages.map((msg, index) => {
            const isUser = msg.sender === 'user'

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in-50 duration-150`}
              >
                {/* Balão de Mensagem Estilo iMessage / WhatsApp */}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs ${
                    isUser
                      ? 'bg-[#064E3B] text-white rounded-br-xs'
                      : 'bg-slate-100 text-slate-900 rounded-bl-xs border border-slate-200/80'
                  }`}
                >
                  <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </p>

                  {/* Chip de categoria CDS com seletor contextual integrado no balão de sucesso */}
                  {!isUser && (msg.confirmedTxId || msg.cardType === 'sucesso') && msg.cardData && (
                    <div className="mt-2 pt-2 border-t border-slate-200/70">
                      <CategoryHighlightChip
                        categoryName={
                          msg.cardData.categoryNameSuggestion ||
                          categories.find((c) => c.id === (msg.cardData as any)?.categoryId)
                            ?.name ||
                          'Geral'
                        }
                        subcategoryName={msg.cardData.subcategoryNameSuggestion}
                        confidence={msg.cardData.confidence}
                        allCategories={categories}
                        onSelectSubcategory={(subId, catId) => {
                          const chosenCat = categories.find((c) => c.id === catId)
                          const chosenSub = chosenCat?.subcategories?.find((s) => s.id === subId)
                          handleUpdateLastTransaction({
                            categoryName: chosenCat?.name || null,
                            subcategoryName: chosenSub?.name || null,
                          })
                        }}
                      />
                    </div>
                  )}

                  {/* Micro-link discreto [Desfazer] para reverter lançamento estilo WhatsApp */}
                  {!isUser &&
                    (msg.confirmedTxId || msg.cardType === 'sucesso') &&
                    renderConfirmationMicroLinks(msg)}

                  {/* Card clarificacao_categoria e clarificacao com pílulas de categorização se necessário */}
                  {!isUser &&
                    (msg.cardType === 'clarificacao' ||
                      msg.cardType === 'clarificacao_categoria') &&
                    msg.cardData &&
                    renderClarificationCategoryCard(msg.cardData)}
                </div>

                {/* Chips de Sugestão Rápida tocáveis logo abaixo da saudação inicial */}
                {index === 0 && msg.id === 'welcome-1' && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5 max-w-full">
                    {quickPrompts.map((prompt, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handleStopAndProcess(prompt.text)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-900 border border-slate-200 text-slate-700 transition-all active:scale-95 shadow-2xs"
                      >
                        {prompt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Indicador de carregamento / IA digitando via componente oficial CopilotTypingBubble */}
          {isProcessingAi && <CopilotTypingBubble label="Curiangoo processando..." />}

          {/* Transcrição em tempo real do microfone dentro do chat com animação suave de onda */}
          {isListening && textoFalado.trim() && (
            <div className="flex items-end justify-end animate-in fade-in duration-100">
              <div className="bg-emerald-900/90 text-emerald-100 rounded-2xl rounded-br-xs px-3.5 py-2 italic text-xs max-w-[85%] border border-emerald-700 shadow-xs">
                &ldquo;{textoFalado.trim()}&rdquo;
              </div>
            </div>
          )}
        </div>

        {/* ================= MODAL / OVERLAY DE CONSENTIMENTO LGPD (IA) ================= */}
        {showConsentPrompt && (
          <div
            data-testid="ai-consent-modal"
            className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 rounded-3xl animate-in fade-in duration-150"
          >
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-200/90 max-w-sm w-full space-y-3.5 text-left">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  Permitir processamento por IA?
                </h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                O Curiangoo Copilot utiliza inteligência artificial para interpretar sua fala ou
                texto e sugerir categorias e valores automaticamente. Nenhum dado é compartilhado
                para fins externos. Deseja permitir o processamento por IA?
              </p>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeclineAiConsent}
                  className="h-9 px-3 text-xs font-semibold rounded-xl text-slate-700 border-slate-300 hover:bg-slate-100"
                >
                  Agora não
                </Button>
                <Button
                  type="button"
                  onClick={handleAllowAiConsent}
                  className="h-9 px-4 text-xs font-bold rounded-xl bg-[#064E3B] hover:bg-emerald-900 text-white shadow-xs"
                >
                  Permitir
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ================= RODAPÉ FIXO: CONTROLES SEMPRE VISÍVEIS (CDS v1.0) ================= */}
        <div className="pt-2 border-t border-slate-100 shrink-0 space-y-2 max-w-full">
          {/* Status e Feedback Visual da Gravação (tempo decorrido + barras pulsantes waveform com alto contraste) */}
          <div
            className={`flex items-center justify-between text-xs px-2 py-1 rounded-xl transition-all ${
              isListening
                ? 'bg-amber-500/15 border border-[#FCA311]/50 shadow-xs'
                : 'text-slate-500'
            }`}
          >
            <span className="flex items-center gap-2 font-medium min-w-0">
              {isListening ? (
                <>
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FCA311] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E08E08]" />
                  </span>
                  <span className="text-[#14213D] font-bold text-xs truncate">
                    Ouvindo... Toque em Parar quando terminar
                  </span>
                </>
              ) : isProcessingAi ? (
                <span className="text-[#14213D] font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FCA311] animate-pulse" />
                  Processando com IA...
                </span>
              ) : (
                <span className="text-[#64748B]">Microfone pronto</span>
              )}
            </span>

            {isListening && (
              <div className="flex items-center gap-2 shrink-0">
                {/* Waveform animada com 5 barras pulsantes mais altas e visíveis */}
                <div
                  data-testid="recording-waveform"
                  className="flex items-center gap-1 h-5 px-2 py-0.5 rounded-full bg-[#14213D] border border-[#FCA311]/60 shadow-xs"
                  aria-label="Gravando áudio"
                >
                  <span
                    className="w-1 h-2.5 bg-[#FCA311] rounded-full animate-bounce"
                    style={{ animationDelay: '0ms', animationDuration: '600ms' }}
                  />
                  <span
                    className="w-1 h-4 bg-[#FCA311] rounded-full animate-bounce"
                    style={{ animationDelay: '150ms', animationDuration: '600ms' }}
                  />
                  <span
                    className="w-1 h-3 bg-[#FCA311] rounded-full animate-bounce"
                    style={{ animationDelay: '300ms', animationDuration: '600ms' }}
                  />
                  <span
                    className="w-1 h-4.5 bg-[#FCA311] rounded-full animate-bounce"
                    style={{ animationDelay: '100ms', animationDuration: '600ms' }}
                  />
                  <span
                    className="w-1 h-2 bg-[#FCA311] rounded-full animate-bounce"
                    style={{ animationDelay: '200ms', animationDuration: '600ms' }}
                  />
                </div>

                {/* Tempo decorrido em mm:ss com badge de destaque */}
                <span
                  data-testid="recording-elapsed-time"
                  className="font-mono text-xs font-bold text-white px-2 py-0.5 rounded-md bg-[#14213D] border border-[#FCA311]/40"
                >
                  {Math.floor(recordingElapsedSeconds / 60)
                    .toString()
                    .padStart(2, '0')}
                  :{(recordingElapsedSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
          </div>

          {/* Estado GRAVANDO: Controles dedicados PARAR e CANCELAR com anel pulsante */}
          {isListening ? (
            <div className="flex items-center justify-between gap-2 py-0.5">
              {/* Botão Cancelar: descarta sem enviar (>= 44px) */}
              <button
                type="button"
                onClick={handleCancelRecording}
                className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300/80 text-[#64748B] hover:text-[#14213D] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-curiango active:scale-95"
                aria-label="Cancelar gravação"
              >
                <X className="w-4 h-4 text-[#64748B]" />
                <span>Cancelar</span>
              </button>

              {/* Centro: Botão de microfone com anel pulsante visual */}
              <div className="relative flex items-center justify-center">
                <span className="absolute -inset-1.5 rounded-full bg-[#FCA311]/30 animate-ping pointer-events-none" />
                <span className="absolute -inset-3 rounded-full bg-[#FCA311]/15 animate-pulse pointer-events-none" />
                <div className="relative w-12 h-12 rounded-full bg-[#14213D] text-white border-2 border-[#FCA311] flex items-center justify-center shadow-curiango">
                  <Mic className="w-5 h-5 text-[#FCA311]" />
                </div>
              </div>

              {/* Botão Parar: conclui e envia para processamento (>= 44px) */}
              <button
                type="button"
                onClick={handleStopRecordingAndProcess}
                className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-2xl bg-[#14213D] hover:bg-[#14213D]/90 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-curiango active:scale-95 border border-[#FCA311]/40"
                aria-label="Parar gravação e processar"
              >
                <Square className="w-3.5 h-3.5 fill-[#FCA311] text-[#FCA311]" />
                <span>Parar</span>
              </button>
            </div>
          ) : (
            /* Estado REPOUSO: Microfone + Campo de digitação */
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!hasAiConsent && !getAiConsent()) {
                    setShowConsentPrompt(true)
                  } else {
                    startRecording()
                  }
                }}
                disabled={isProcessingAi}
                className="min-h-[44px] min-w-[44px] w-11 h-11 rounded-2xl bg-white border border-[rgba(20,33,61,0.12)] text-[#14213D] hover:bg-amber-50 hover:border-[#FCA311] hover:text-[#14213D] flex items-center justify-center shadow-curiango transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                title="Toque para começar a falar"
                aria-label="Começar a falar"
              >
                <Mic className="w-5 h-5 text-[#14213D]" />
              </button>

              {/* Input de Texto + Botão Enviar */}
              <form
                onSubmit={handleChatTextSubmit}
                className="flex-1 flex items-center gap-1.5 min-w-0"
              >
                <Input
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Fale no microfone ou digite aqui..."
                  disabled={isProcessingAi}
                  className="rounded-2xl h-11 text-xs bg-slate-50 border-[rgba(20,33,61,0.12)] text-[#14213D] focus:bg-white focus:border-[#FCA311] focus:ring-1 focus:ring-[#FCA311] transition-colors min-w-0"
                />
                <Button
                  type="submit"
                  disabled={!inputVal.trim() || isProcessingAi}
                  className="min-h-[44px] min-w-[44px] bg-[#14213D] hover:bg-[#14213D]/90 text-white rounded-2xl font-semibold text-xs h-11 px-3.5 gap-1 shrink-0 shadow-curiango disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5 text-[#FCA311]" />
                  <span>Enviar</span>
                </Button>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
