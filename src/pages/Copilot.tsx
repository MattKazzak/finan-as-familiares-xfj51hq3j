import React, { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mic,
  Send,
  Sparkles,
  ArrowLeft,
  Volume2,
  Shield,
  RotateCcw,
  Tag,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Square,
  X,
} from 'lucide-react'
import { useFamily } from '@/hooks/use-family'
import { CopilotTypingBubble } from '@/components/brand/CopilotTypingBubble'
import { CategoryHighlightChip } from '@/components/categories/CategoryHighlightChip'
import { useToast } from '@/hooks/use-toast'
import { parseVoiceWithAi } from '@/services/voice-ai'
import {
  fetchCopilotMessagesWithHasMore,
  saveCopilotMessage,
  type CopilotMessageRecord,
} from '@/services/copilot'
import {
  getLocalAiConsent,
  fetchUserPreferencesWithFallback,
  saveUserAiConsent,
} from '@/services/user-preferences'
import { createTransaction } from '@/services/transactions'
import { BUCKET_METADATA } from '@/types/budget-presets'
import { formatBRL } from '@/lib/formatters'
import type { BudgetBucket } from '@/types/finance'
import {
  type ParsedVoiceTransaction,
  type StructuredSuggestionOption,
  extractAllAmountsFromVoiceText,
} from '@/services/voice-parser'
import { useVoiceCapture } from '@/hooks/use-voice-capture'

export interface CopilotChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: Date
  cardType?: string | null
  cardData?: ParsedVoiceTransaction | null
}

/**
 * Renderizador de markdown para negrito (**texto**) nas mensagens do Copilot
 */
function renderMarkdownText(text: string): ReactNode {
  if (!text) return ''
  if (!text.includes('**')) return text

  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

export function CopilotPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { family, members, categories, currentMember, triggerRefresh } = useFamily()

  const [messages, setMessages] = useState<CopilotChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasConsent, setHasConsent] = useState<boolean>(getLocalAiConsent())
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [pendingTx, setPendingTx] = useState<ParsedVoiceTransaction | null>(null)

  // Paginação do histórico
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [oldestMessageDate, setOldestMessageDate] = useState<string | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollRef = useRef(true)

  // Cadeia unificada de voz via useVoiceCapture (MediaRecorder padrão + Whisper + fallback Web Speech)
  const voiceCapture = useVoiceCapture({
    onTranscriptReady: (transcript) => {
      // Na /copilot, a transcrição entra diretamente na caixa de mensagem para o usuário revisar e enviar
      setInputText(transcript)
      toast({
        title: 'Áudio transcrito!',
        description: 'Texto inserido no campo de mensagem.',
      })
    },
    onError: (err) => {
      console.warn('[CopilotPage] voiceCapture erro:', err)
    },
  })

  const {
    isListening,
    isTranscribing,
    audioCaptureMode,
    errorMessage: voiceErrorMessage,
    infoMessage: voiceInfoMessage,
    needsAudioResume,
    realAudioLevels,
    elapsedSeconds: voiceElapsedSeconds,
    interimTranscript,
    startListening,
    stopListeningAndProcess,
    cancelListening,
    retryListening,
    clearError: clearVoiceError,
    resumeAudioContextOnTouch,
  } = voiceCapture

  // Sincroniza transcrição intermediária em tempo real no input
  useEffect(() => {
    if (interimTranscript) {
      setInputText(interimTranscript)
    }
  }, [interimTranscript])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom()
    }
  }, [messages, isProcessing])

  // Inicialização: carrega consentimento do banco com fallback e lote inicial mais recente (25 msgs)
  useEffect(() => {
    fetchUserPreferencesWithFallback().then((pref) => {
      setHasConsent(pref.aiConsent)
      if (!pref.aiConsent) {
        setShowConsentModal(true)
      }
    })

    if (family?.id) {
      shouldAutoScrollRef.current = true
      fetchCopilotMessagesWithHasMore(family.id, { limitCount: 25 })
        .then(({ messages: history, hasMore }) => {
          setHasMoreOlder(hasMore)
          if (history && history.length > 0) {
            setOldestMessageDate(history[0].created_at)
            const mapped: CopilotChatMessage[] = history.map((rec) => ({
              id: rec.id,
              sender: rec.role,
              text: rec.content,
              timestamp: new Date(rec.created_at),
              cardType: rec.card_type,
            }))
            setMessages(mapped)
          } else {
            setOldestMessageDate(null)
            setMessages([
              {
                id: 'init-msg',
                sender: 'assistant',
                text: `Olá, ${currentMember?.name || 'família'}! Sou seu Copilot Curiangoo. O que deseja consultar ou registrar hoje?`,
                timestamp: new Date(),
                cardType: 'consulta',
              },
            ])
          }
        })
        .catch(() => {
          setHasMoreOlder(false)
          setOldestMessageDate(null)
          setMessages([
            {
              id: 'init-msg',
              sender: 'assistant',
              text: `Olá! Sou seu Copilot Curiangoo. Como posso ajudar com as finanças da sua casa hoje?`,
              timestamp: new Date(),
              cardType: 'consulta',
            },
          ])
        })
    }
  }, [family?.id, currentMember?.name])

  // Carrega lote anterior (mais antigas) preservando rigorosamente a posição de rolagem
  const handleLoadOlderMessages = async () => {
    if (!family?.id || isLoadingOlder || !hasMoreOlder || !oldestMessageDate) return

    const container = scrollContainerRef.current
    const prevScrollHeight = container?.scrollHeight ?? 0
    const prevScrollTop = container?.scrollTop ?? 0

    setIsLoadingOlder(true)
    shouldAutoScrollRef.current = false

    try {
      const { messages: olderRecords, hasMore } = await fetchCopilotMessagesWithHasMore(family.id, {
        limitCount: 25,
        beforeCreatedAt: oldestMessageDate,
      })

      if (olderRecords && olderRecords.length > 0) {
        setOldestMessageDate(olderRecords[0].created_at)
        setHasMoreOlder(hasMore)

        const olderMapped: CopilotChatMessage[] = olderRecords.map((rec) => ({
          id: rec.id,
          sender: rec.role,
          text: rec.content,
          timestamp: new Date(rec.created_at),
          cardType: rec.card_type,
        }))

        // Prepend das mensagens mais antigas no topo
        setMessages((prev) => [...olderMapped, ...prev])

        // Preserva o scroll milimetricamente no próximo tick de layout
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight
            const delta = newScrollHeight - prevScrollHeight
            container.scrollTop = prevScrollTop + delta
          }
        })
      } else {
        setHasMoreOlder(false)
      }
    } catch (err: any) {
      console.warn('[CopilotPage] Falha ao carregar mensagens antigas:', err?.message)
    } finally {
      setIsLoadingOlder(false)
    }
  }

  const handleConsentAccept = async () => {
    await saveUserAiConsent(true)
    setHasConsent(true)
    setShowConsentModal(false)
  }

  const handleConsentDismiss = () => {
    setShowConsentModal(false)
    navigate(-1)
  }

  // Execução de lançamento autônomo
  const executeAutonomousSave = useCallback(
    async (txData: ParsedVoiceTransaction) => {
      if (!family || txData.amountCents <= 0) return null

      try {
        let cat = categories.find(
          (c) =>
            c.type === txData.type &&
            (c.name.toLowerCase() === txData.categoryNameSuggestion?.toLowerCase() ||
              c.name.toLowerCase().includes(txData.categoryNameSuggestion?.toLowerCase() || '')),
        )

        if (!cat) {
          cat = categories.find((c) => c.type === txData.type)
        }

        const categoryId = cat?.id || null
        let subcategoryId: string | null = null

        if (cat && txData.subcategoryNameSuggestion) {
          const sub = cat.subcategories?.find(
            (s) => s.name.toLowerCase() === txData.subcategoryNameSuggestion?.toLowerCase(),
          )
          if (sub) subcategoryId = sub.id
        }

        const todayStr = new Date().toISOString().split('T')[0]
        const memberId = currentMember?.id || members[0]?.id || ''
        const created = await createTransaction({
          family_id: family.id,
          member_id: memberId,
          category_id: categoryId,
          subcategory_id: subcategoryId,
          type: txData.type,
          amount_cents: txData.amountCents,
          description: txData.description,
          transaction_date: todayStr,
          status: 'confirmed',
        })

        triggerRefresh()
        return created
      } catch (err: any) {
        console.warn('Erro ao salvar transação via CopilotPage:', err?.message)
        return null
      }
    },
    [categories, currentMember?.id, family, members, triggerRefresh],
  )

  // Envio do comando (texto ou voz)
  const processInput = async (textToSend: string) => {
    const text = textToSend.trim()
    if (!text || isProcessing) return

    if (!hasConsent && !getLocalAiConsent()) {
      setShowConsentModal(true)
      return
    }

    const userMsg: CopilotChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date(),
    }
    shouldAutoScrollRef.current = true
    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsProcessing(true)

    if (family?.id) {
      saveCopilotMessage({
        familyId: family.id,
        role: 'user' as const,
        content: text,
      }).catch(() => {})
    }

    try {
      // PONTO 1: Descartar pendência anterior ao iniciar fluxo NOVO de lançamento
      // Se há pendência ativa mas a mensagem do usuário é claramente o início de um novo lançamento independente
      // (ex.: "comprei...", "gastei...", "paguei...", ou novo lote multi-item), descartar a pendência anterior.
      const isStartingNewExpense =
        Boolean(pendingTx) &&
        /^(gastei|comprei|paguei|lan[cç]a|lan[cç]ar|registra|registrar|recebi|pix|deu|uma?\s+[a-z]+.*,)\b/i.test(
          text,
        )

      let effectivePendingTx = isStartingNewExpense ? null : pendingTx
      if (isStartingNewExpense && pendingTx) {
        setPendingTx(null)
      }

      // PONTO 2: Interceptar confirmação "Sim" de proposta da Classe 5
      // Se há proposta de Classe 5 pendente e usuário responde "Sim", "está certo", etc.:
      // NUNCA chamar a edge nem reutilizar valores antigos do histórico!
      // Obrigatoriamente perguntar os valores: "Agora os valores: quanto foi cada item?"
      const isClass5ProposalPending =
        Boolean(effectivePendingTx) &&
        effectivePendingTx?.routerClasse === 5 &&
        Array.isArray(effectivePendingTx?.extractedItems) &&
        effectivePendingTx.extractedItems.length >= 2

      const isAffirmativeConfirmation =
        /^(sim|est[aá] certo|est[aá] certo assim|isso|perfeito|pode ser|confirmo|beleza|fechado|pode gravar)\b/i.test(
          text.replace(/[.!?]/g, '').trim(),
        )

      if (isClass5ProposalPending && effectivePendingTx && isAffirmativeConfirmation) {
        const askValuesMsg = 'Agora os valores: quanto foi cada item?'
        const updatedPending: ParsedVoiceTransaction = {
          ...effectivePendingTx,
          aiStatus: 'falta_valor',
          clarificationQuestion: askValuesMsg,
          friendlyMessage: askValuesMsg,
        }
        setPendingTx(updatedPending)

        if (family?.id) {
          saveCopilotMessage({
            familyId: family.id,
            role: 'assistant',
            content: askValuesMsg,
            cardType: 'falta_valor',
          }).catch(() => {})
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            sender: 'assistant',
            text: askValuesMsg,
            timestamp: new Date(),
            cardType: 'falta_valor',
            cardData: updatedPending,
          },
        ])
        setIsProcessing(false)
        return
      }

      // PONTO 3: Gravação da Classe 5 pós-pergunta de valores:
      // Se a proposta da Classe 5 já está confirmada e aguardando valores (aiStatus === 'falta_valor')
      if (
        isClass5ProposalPending &&
        effectivePendingTx &&
        effectivePendingTx.aiStatus === 'falta_valor'
      ) {
        const pendingItems = effectivePendingTx.extractedItems || []
        const foundAmounts = extractAllAmountsFromVoiceText(text)

        // Caso A: Usuário enviou valor que faltava (1 valor faltante)
        const isSingleMissing =
          foundAmounts.length === 1 &&
          pendingItems.some((it) => it.valor === null || it.valor === undefined)

        if (isSingleMissing && pendingItems.filter((it) => it.valor).length >= 1) {
          const missingItem = pendingItems.find((it) => it.valor === null || it.valor === undefined)
          if (missingItem) {
            missingItem.valor = foundAmounts[0].amountCents / 100
          }

          const allHaveValues = pendingItems.every(
            (it) => typeof it.valor === 'number' && it.valor > 0,
          )

          if (allHaveValues) {
            const resultsSummary: string[] = []
            for (const item of pendingItems) {
              const itemAmountCents = Math.round((item.valor || 0) * 100)
              const itemCat = item.categoria_proposta || 'Outros'
              const itemSub = item.subcategoria_proposta || 'Outros'
              const itemFormatted = formatBRL(itemAmountCents)

              await executeAutonomousSave({
                rawText: `${item.descricao} ${itemAmountCents}`,
                amountCents: itemAmountCents,
                amountFormatted: itemFormatted,
                type: 'expense',
                description: item.descricao,
                categoryNameSuggestion: itemCat,
                subcategoryNameSuggestion: itemSub,
                bucketSuggestion: 'lifestyle',
                confidence: 0.95,
                aiStatus: 'sucesso',
              })

              resultsSummary.push(`${itemFormatted} em ${itemCat} › ${itemSub}`)
            }

            setPendingTx(null)
            const finalSummaryMsg = `Lançamentos realizados com sucesso:\n${resultsSummary.map((s) => `• ${s}`).join('\n')} 👍!`

            if (family?.id) {
              saveCopilotMessage({
                familyId: family.id,
                role: 'assistant',
                content: finalSummaryMsg,
                cardType: 'sucesso',
              }).catch(() => {})
            }

            setMessages((prev) => [
              ...prev,
              {
                id: `asst-${Date.now()}`,
                sender: 'assistant',
                text: finalSummaryMsg,
                timestamp: new Date(),
                cardType: 'sucesso',
              },
            ])
            setIsProcessing(false)
            return
          }
        }

        // Caso B: Menos valores que itens (ex: 3 valores para 4 itens) → NUNCA somar!
        if (foundAmounts.length > 0 && foundAmounts.length < pendingItems.length) {
          const updatedItems = pendingItems.map((it, idx) => {
            if (idx < foundAmounts.length) {
              return { ...it, valor: foundAmounts[idx].amountCents / 100 }
            }
            return { ...it, valor: null }
          })

          const missingItem = updatedItems.find((it) => it.valor === null)
          const rawDesc = (missingItem?.descricao || 'o item restante').toLowerCase()
          const cleanDesc = rawDesc.replace(/^(um|uma|o|a)\s+/i, '')
          const askMissingMsg = `Faltou o valor da ${cleanDesc} — quanto foi?`

          const updatedPendingClasse5: ParsedVoiceTransaction = {
            ...effectivePendingTx,
            extractedItems: updatedItems,
            clarificationQuestion: askMissingMsg,
            friendlyMessage: askMissingMsg,
            aiStatus: 'falta_valor',
          }

          setPendingTx(updatedPendingClasse5)

          if (family?.id) {
            saveCopilotMessage({
              familyId: family.id,
              role: 'assistant',
              content: askMissingMsg,
              cardType: 'falta_valor',
            }).catch(() => {})
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              sender: 'assistant',
              text: askMissingMsg,
              timestamp: new Date(),
              cardData: updatedPendingClasse5,
              cardType: 'falta_valor',
            },
          ])
          setIsProcessing(false)
          return
        }

        // Caso C: Todos os valores informados de uma vez (foundAmounts.length >= pendingItems.length)
        if (foundAmounts.length >= pendingItems.length) {
          const resultsSummary: string[] = []
          for (let i = 0; i < pendingItems.length; i++) {
            const item = pendingItems[i]
            const itemAmountCents = foundAmounts[i].amountCents
            const itemCat = item.categoria_proposta || 'Outros'
            const itemSub = item.subcategoria_proposta || 'Outros'
            const itemFormatted = formatBRL(itemAmountCents)

            await executeAutonomousSave({
              rawText: `${item.descricao} ${itemAmountCents}`,
              amountCents: itemAmountCents,
              amountFormatted: itemFormatted,
              type: 'expense',
              description: item.descricao,
              categoryNameSuggestion: itemCat,
              subcategoryNameSuggestion: itemSub,
              bucketSuggestion: 'lifestyle',
              confidence: 0.95,
              aiStatus: 'sucesso',
            })

            resultsSummary.push(`${itemFormatted} em ${itemCat} › ${itemSub}`)
          }

          setPendingTx(null)
          const finalSummaryMsg = `Lançamentos realizados com sucesso:\n${resultsSummary.map((s) => `• ${s}`).join('\n')} 👍!`

          if (family?.id) {
            saveCopilotMessage({
              familyId: family.id,
              role: 'assistant',
              content: finalSummaryMsg,
              cardType: 'sucesso',
            }).catch(() => {})
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              sender: 'assistant',
              text: finalSummaryMsg,
              timestamp: new Date(),
              cardType: 'sucesso',
            },
          ])
          setIsProcessing(false)
          return
        }
      }

      // Monta histórico recente sanitizado para o motor consultivo
      const historicoSanitizado = messages.slice(-6).map((m) => ({
        role: m.sender,
        content: m.text,
      }))

      const previousCtx = effectivePendingTx
        ? {
            descricao: effectivePendingTx.description,
            estabelecimento: effectivePendingTx.establishment,
            valor: effectivePendingTx.amountCents > 0 ? effectivePendingTx.amountCents / 100 : null,
            categoria: effectivePendingTx.categoryNameSuggestion,
            subcategoria: effectivePendingTx.subcategoryNameSuggestion,
            balde: effectivePendingTx.bucketSuggestion,
            tipo: effectivePendingTx.type,
            status: effectivePendingTx.aiStatus,
            routerClasse: effectivePendingTx.routerClasse,
            itens: effectivePendingTx.extractedItems,
          }
        : undefined

      const parsed = await parseVoiceWithAi({
        texto: text,
        familyId: family?.id,
        categories,
        contexto_anterior: previousCtx as any,
        historico_mensagens: historicoSanitizado as any,
      })

      let assistantText = parsed.friendlyMessage || 'Pronto!'
      let cardType: string | null = null

      if (parsed.aiStatus === 'consulta' || parsed.tipoResposta === 'consulta') {
        assistantText =
          parsed.respostaConsulta || parsed.friendlyMessage || 'Informações solicitadas:'
        cardType = 'consulta'
      } else if (parsed.aiStatus === 'falta_valor') {
        setPendingTx(parsed)
        cardType = 'falta_valor'
        const isAskingForItems =
          parsed.routerLacunas?.includes('itens') ||
          parsed.clarificationQuestion?.toLowerCase().includes('o que você comprou') ||
          parsed.friendlyMessage?.toLowerCase().includes('o que você comprou')

        assistantText =
          parsed.friendlyMessage ||
          parsed.clarificationQuestion ||
          (isAskingForItems
            ? 'O que você comprou? Me conta os itens que eu já organizo pra você!'
            : `Entendi "${parsed.description}". Qual foi o valor?`)
      } else if (parsed.aiStatus === 'sucesso' && parsed.amountCents > 0) {
        setPendingTx(null)
        cardType = 'transacao'
        await executeAutonomousSave(parsed)
      } else if (
        parsed.aiStatus === 'clarificacao' ||
        parsed.aiStatus === 'clarificacao_categoria'
      ) {
        setPendingTx(parsed)
        cardType = 'clarificacao'
        assistantText =
          parsed.clarificationQuestion || parsed.friendlyMessage || 'Qual categoria prefere?'
      } else {
        cardType = 'erro'
      }

      if (family?.id) {
        saveCopilotMessage({
          familyId: family.id,
          role: 'assistant',
          content: assistantText,
          cardType,
        }).catch(() => {})
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: assistantText,
          timestamp: new Date(),
          cardType,
          cardData: parsed,
        },
      ])
    } catch (err: any) {
      console.warn('Erro ao processar mensagem no CopilotPage:', err?.message)
      const errorMsg =
        'Houve uma falha momentânea ao processar sua pergunta. Poderia tentar novamente?'
      if (family?.id) {
        saveCopilotMessage({
          familyId: family.id,
          role: 'assistant',
          content: errorMsg,
          cardType: 'erro',
        }).catch(() => {})
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: errorMsg,
          timestamp: new Date(),
          cardType: 'erro',
        },
      ])
    } finally {
      setIsProcessing(false)
    }
  }

  // Controle de microfone unificado via useVoiceCapture
  const handleToggleListening = useCallback(async () => {
    if (isListening) {
      const text = await stopListeningAndProcess()
      if (text) {
        setInputText(text)
      }
      return
    }

    if (!hasConsent && !getLocalAiConsent()) {
      setShowConsentModal(true)
      return
    }

    startListening()
  }, [hasConsent, isListening, startListening, stopListeningAndProcess])

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] max-w-2xl mx-auto bg-white/70 backdrop-blur-sm rounded-3xl border border-border/40 shadow-curiango overflow-hidden relative">
      {/* Topo do Chat (CDS v1.0) */}
      <div className="flex items-center justify-between px-4 py-3 bg-brand text-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4 text-white" strokeWidth={1.5} />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-sm leading-tight">Copilot Curiangoo</h2>
              <span className="text-[10px] font-semibold bg-brand-amber text-brand px-1.5 py-0.2 rounded-full">
                IA
              </span>
            </div>
            <p className="text-[11px] text-white/70">Consultor financeiro & lançamentos rápidos</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-xl bg-brand-amber/20 border border-brand-amber/40 flex items-center justify-center text-brand-amber">
          <Sparkles className="w-4 h-4" strokeWidth={1.5} />
        </div>
      </div>

      {/* Área de Mensagens com scroll preservado */}
      <div
        ref={scrollContainerRef}
        data-testid="copilot-messages-container"
        className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50"
      >
        {/* Botão discreto no TOPO: Carregar mensagens mais antigas (CDS v1.0) */}
        {hasMoreOlder && (
          <div className="flex justify-center pt-1 pb-2">
            <button
              type="button"
              data-testid="load-older-messages-button"
              onClick={handleLoadOlderMessages}
              disabled={isLoadingOlder}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-slate-600 hover:text-brand bg-white/90 hover:bg-white border border-border/60 hover:border-brand-amber/50 shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              aria-label="Carregar mensagens mais antigas"
            >
              {isLoadingOlder ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-brand-amber border-t-transparent animate-spin" />
                  <span>Carregando anteriores...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3 h-3 text-slate-400 group-hover:text-brand" />
                  <span>Carregar mensagens mais antigas</span>
                </>
              )}
            </button>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.sender === 'user'
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs sm:text-sm leading-relaxed shadow-curiango ${
                  isUser
                    ? 'bg-brand text-white rounded-br-xs'
                    : 'bg-white text-brand border border-border/60 rounded-bl-xs'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{renderMarkdownText(m.text)}</p>

                {/* Renderização de Card de Lançamento se aplicável */}
                {m.cardData && m.cardData.amountCents > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-border/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {m.cardData.type === 'income' ? (
                          <TrendingUp
                            className="w-3.5 h-3.5 text-finance-income shrink-0"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <TrendingDown
                            className="w-3.5 h-3.5 text-finance-expense shrink-0"
                            strokeWidth={1.5}
                          />
                        )}
                        <span className="font-semibold text-slate-700">Lançamento registrado</span>
                      </div>
                      <span className="font-semibold text-brand shrink-0">
                        {formatBRL(m.cardData.amountCents)}
                      </span>
                    </div>

                    {/* Chip de categoria CDS com seletor contextual integrado e badge incerta */}
                    <div className="pt-0.5">
                      <CategoryHighlightChip
                        categoryName={
                          m.cardData.categoryNameSuggestion ||
                          categories.find((c) => c.type === m.cardData?.type)?.name ||
                          'Outro'
                        }
                        subcategoryName={m.cardData.subcategoryNameSuggestion}
                        confidence={m.cardData.confidence}
                        allCategories={categories}
                        onSelectSubcategory={(subId, catId) => {
                          const chosenCat = categories.find((c) => c.id === catId)
                          const chosenSub = chosenCat?.subcategories?.find((s) => s.id === subId)
                          if (m.cardData) {
                            m.cardData.categoryNameSuggestion =
                              chosenCat?.name || m.cardData.categoryNameSuggestion
                            m.cardData.subcategoryNameSuggestion = chosenSub?.name || null
                            setMessages((prev) => [...prev])
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Card de Opções de Clarificação se aplicável */}
                {!isUser &&
                  (m.cardType === 'clarificacao' || m.cardType === 'clarificacao_categoria') &&
                  m.cardData?.clarificationOptions &&
                  m.cardData.clarificationOptions.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-border/60 flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-brand">
                        Opções sugeridas:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {m.cardData.clarificationOptions.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => processInput(opt)}
                            className="text-xs px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-brand-amber/20 hover:text-brand border border-border/60 font-medium transition-colors cursor-pointer text-left break-words"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {m.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}

        {isProcessing && <CopilotTypingBubble label="Copilot pensando..." />}
        <div ref={messagesEndRef} />
      </div>

      {/* Rodapé e Barra de Entrada (Texto + Microfone Unificado CDS v1.0) */}
      <div className="p-3 bg-white border-t border-border/40 space-y-2">
        {/* Banner transitório de escuta contínua (ex: no-speech) */}
        {voiceInfoMessage && (
          <div
            data-testid="copilot-audio-info"
            className="text-xs px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50/95 text-amber-900 flex items-center gap-2 text-left animate-in fade-in"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <p className="text-[11px] leading-tight font-medium text-amber-800">
              {voiceInfoMessage}
            </p>
          </div>
        )}

        {/* FIX 3: Banner de ativação de áudio caso o AudioContext esteja suspenso */}
        {needsAudioResume && (
          <button
            type="button"
            data-testid="banner-audio-resume"
            onClick={resumeAudioContextOnTouch}
            className="w-full text-xs px-3 py-1.5 rounded-xl border border-sky-300 bg-sky-50 text-sky-950 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-sky-100 transition-colors animate-in fade-in"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Volume2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="text-[11px] font-semibold">Toque na tela para ativar o áudio</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-sky-700 shrink-0">Ativar</span>
          </button>
        )}

        {/* Alerta de erro de áudio com botão Tentar de novo */}
        {voiceErrorMessage && (
          <div
            role="alert"
            data-testid="copilot-audio-error"
            className="text-xs px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/90 text-rose-900 flex items-center justify-between gap-2 text-left animate-in fade-in"
          >
            <div className="flex items-start gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-tight font-medium break-words text-rose-800">
                {voiceErrorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                clearVoiceError()
                retryListening()
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-rose-300 hover:bg-rose-100/70 text-rose-900 text-[10px] font-semibold shrink-0 cursor-pointer transition-colors shadow-2xs"
            >
              <RotateCcw className="w-2.5 h-2.5 text-rose-600" />
              <span>Tentar de novo</span>
            </button>
          </div>
        )}

        {/* Status de transição quando transcrevendo áudio */}
        {isTranscribing && !isListening && (
          <div className="flex items-center gap-2 text-xs text-slate-600 px-1">
            <span className="w-2 h-2 rounded-full bg-brand-amber animate-pulse shrink-0" />
            <span className="font-medium text-[11px] text-[#14213D]">Transcrevendo áudio</span>
          </div>
        )}

        {/* TAREFA 1 & 2 & 3: Linha coesa de gravação (Waveform livre + Parar harmônico circular) OU Barra de input unificada com microfone interno */}
        {isListening ? (
          /* LINHA DE GRAVAÇÃO COESA CDS: Cronômetro discreto + Waveform livre flutuante no centro + Cancelar discreto + Parar circular harmônico */
          <div
            data-testid="copilot-recording-line"
            className="flex items-center justify-between gap-2.5 min-h-[48px] px-2.5 sm:px-3.5 py-1 w-full min-w-0"
          >
            {/* Lado esquerdo: Cronômetro discreto + badge sutil apenas se em fallback web_speech */}
            <div className="flex items-center gap-2 shrink-0">
              <span
                data-testid="copilot-elapsed-time"
                className="font-mono text-xs font-semibold text-[#14213D] tracking-tight tabular-nums"
              >
                {Math.floor(voiceElapsedSeconds / 60)
                  .toString()
                  .padStart(2, '0')}
                :{(voiceElapsedSeconds % 60).toString().padStart(2, '0')}
              </span>

              {audioCaptureMode === 'web_speech' && (
                <span
                  data-testid="audio-capture-mode-badge"
                  data-mode={audioCaptureMode}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium tracking-tight shrink-0 bg-amber-50 text-amber-800 border border-amber-200/80"
                >
                  Navegador
                </span>
              )}
            </div>

            {/* Centro: Waveform LIVRE — flutuando diretamente sobre o fundo, sem caixa/fundo azul/borda */}
            <div
              data-testid="copilot-waveform"
              className="flex-1 flex items-center justify-center gap-1.5 h-7 px-2 min-w-0"
              aria-label="Gravando áudio"
            >
              {realAudioLevels.map((lvl, bIdx) => {
                const barHeightPx = Math.max(4, Math.round(lvl * 24))
                return (
                  <span
                    key={bIdx}
                    className="w-1 bg-[#FCA311] rounded-full transition-[height] duration-150 ease-out"
                    style={{ height: `${barHeightPx}px` }}
                  />
                )
              })}
            </div>

            {/* Lado direito: Cancelar discreto + Botão Parar circular harmônico CDS (≥44px de toque) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={cancelListening}
                className="px-2 py-1.5 text-xs font-medium text-[#64748B] hover:text-[#14213D] transition-colors cursor-pointer"
                aria-label="Cancelar gravação"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleToggleListening}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#14213D] flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 group"
                aria-label="Parar gravação e transcrever"
                title="Parar gravação"
              >
                <Square className="w-4 h-4 fill-[#14213D] text-[#14213D] rounded-xs group-hover:scale-105 transition-transform" />
              </button>
            </div>
          </div>
        ) : (
          /* BARRA DE ENTRADA UNIFICADA: Microfone dentro do input à direita */
          <form
            onSubmit={(e) => {
              e.preventDefault()
              processInput(inputText)
            }}
            className="relative flex items-center w-full min-w-0"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pergunte algo ou lance um gasto..."
              disabled={isProcessing || isTranscribing}
              className="w-full bg-slate-50 border border-border/60 rounded-2xl h-11 px-3.5 pr-20 text-xs sm:text-sm text-slate-800 placeholder:text-muted-foreground focus:outline-none focus:bg-white focus:border-brand-amber focus:ring-1 focus:ring-brand-amber min-w-0 transition-colors"
            />

            <div className="absolute right-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={handleToggleListening}
                aria-label="Falar comando por voz"
                title="Falar comando por voz"
                disabled={isProcessing || isTranscribing}
                className="w-8 h-8 rounded-xl text-slate-600 hover:text-brand hover:bg-slate-200/60 flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-40"
              >
                <Mic className="w-4 h-4 text-[#14213D]" strokeWidth={1.5} />
              </button>

              <button
                type="submit"
                disabled={!inputText.trim() || isProcessing || isTranscribing}
                aria-label="Enviar mensagem"
                className="w-8 h-8 rounded-xl bg-brand text-white hover:bg-brand-light disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5 text-[#FCA311]" strokeWidth={1.5} />
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Modal / Overlay de Consentimento LGPD (IA) - mesmo padrão de diálogo da Rodada 7 */}
      {showConsentModal && (
        <div
          data-testid="ai-consent-modal"
          className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 rounded-3xl animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-200/90 max-w-sm w-full space-y-3.5 text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-amber/20 text-brand flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-brand-amber" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                Permitir processamento por IA?
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O Curiangoo Copilot utiliza inteligência artificial para transcrever sua gravação de
              voz, interpretar sua fala ou texto e sugerir categorias e valores automaticamente. O
              áudio é processado exclusivamente para transcrição e nenhum dado é compartilhado para
              fins externos. Deseja permitir o processamento por IA?
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleConsentDismiss}
                className="h-9 px-3 text-xs font-semibold rounded-xl text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={handleConsentAccept}
                className="h-9 px-4 text-xs font-semibold rounded-xl bg-brand hover:bg-brand-light text-white shadow-xs transition-colors cursor-pointer"
              >
                Permitir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default CopilotPage
