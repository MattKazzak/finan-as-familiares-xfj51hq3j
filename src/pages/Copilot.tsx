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
import { useActiveMonth } from '@/contexts/ActiveMonthContext'
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
import { createTransaction, updateTransaction, fetchTransactions } from '@/services/transactions'
import { BUCKET_METADATA } from '@/types/budget-presets'
import { formatBRL } from '@/lib/formatters'
import type { BudgetBucket } from '@/types/finance'
import {
  type ParsedVoiceTransaction,
  type StructuredSuggestionOption,
  extractAllAmountsFromVoiceText,
  matchTolerantPairAgainstCatalog,
  matchCategoryAgainstCatalog,
  handleCatalogQuestion,
  isCatalogQuestion,
  stripAccentsText,
  tokenizeText,
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

  // Suporte a quebras de linha e lista vertical com marcadores
  const lines = text.split(/\r?\n/)
  return lines.map((line, lIdx) => {
    const hasAsterisks = line.includes('**')
    const content = hasAsterisks
      ? line.split(/(\*\*[^*]+\*\*)/g).map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <strong key={pIdx} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            )
          }
          return part
        })
      : line

    return (
      <span key={lIdx} className="block leading-relaxed">
        {content || '\u00A0'}
      </span>
    )
  })
}

export function CopilotPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { family, members, categories, currentMember, triggerRefresh } = useFamily()
  const { activeMonth, setActiveMonth } = useActiveMonth()

  const [messages, setMessages] = useState<CopilotChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasConsent, setHasConsent] = useState<boolean>(getLocalAiConsent())
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [pendingTx, setPendingTx] = useState<ParsedVoiceTransaction | null>(null)
  const lastCreatedTxIdRef = useRef<string | null>(null)
  // Estado para proposta de movimento de categoria aguardando confirmação (Classe 8)
  const [pendingCategoryMovement, setPendingCategoryMovement] = useState<{
    txId: string
    description: string
    amountCents: number
    oldCat: string
    oldSub: string | null
    newCat: string
    newSub: string | null
  } | null>(null)

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

        // Anti-chute (18/10, varredura de portas de entrada): se o nome sugerido
        // pela edge não casar com o catálogo real da família, a transação nasce
        // SEM categoria e cai no deck de revisão — igual ao resto do app.
        // O fallback antigo (primeira categoria do tipo) era o único chute cego
        // restante do sistema e contrariava a edge que já pergunta honestamente.
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

        if (created?.id) {
          lastCreatedTxIdRef.current = created.id
        }

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

    // GUARDA 2 — TEXTO SEM CONTEÚDO (21/10, relato do Matheus: "aldndnwksksk"):
    // sem vogais + consoantes repetidas = ruído digitado ou transcrição inventada
    // do Whisper pra silêncio/assobio. NÃO gasta chamada de IA — responde na hora.
    const letters = text.replace(/[^a-zà-úA-ZÀ-Ú]/g, '')
    const vowels = letters.match(/[aeiouáàâãéêíóôõú]/gi)?.length ?? 0
    if (letters.length >= 6 && vowels / letters.length < 0.2) {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant' as const,
          text: 'Não consegui entender isso — parece que veio algo sem sentido. Pode repetir com outras palavras? Consigo lançar gastos ("gastei 30 no mercado"), responder saldos e tirar dúvidas das finanças de vocês.',
          timestamp: new Date(),
          cardType: 'consulta',
        },
      ])
      return
    }

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
      // TAREFA 2: HANDLER DE PERGUNTAS SOBRE O CATÁLOGO (FIM DO FALLBACK EM PERGUNTA IN-SCOPE)
      // Perguntas sobre categorias/subcategorias do app ("quais são as subcategorias de X?", "existe categoria Y?") NUNCA caem no fallback
      if (isCatalogQuestion(text)) {
        const catalogResult = handleCatalogQuestion(text, categories)
        if (catalogResult.handled) {
          if (family?.id) {
            saveCopilotMessage({
              familyId: family.id,
              role: 'assistant',
              content: catalogResult.response,
              cardType: 'consulta',
            }).catch(() => {})
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              sender: 'assistant',
              text: catalogResult.response,
              timestamp: new Date(),
              cardType: 'consulta',
            },
          ])
          setIsProcessing(false)
          return
        }
      }

      // TAREFA 1: Confirmação de Movimento de Categoria pendente ("Pode ser?", "Sim", "Confirma", etc.)
      const isAffirmativeMovementConfirm =
        /^(sim|pode\s+ser|pode|confirmo|confirmar|isso|est[aá]\s+certo|perfeito|beleza|fechado)\b/i.test(
          text.replace(/[.!?]/g, '').trim(),
        )

      if (pendingCategoryMovement && isAffirmativeMovementConfirm) {
        const movement = pendingCategoryMovement
        setPendingCategoryMovement(null)

        // Localiza a categoria e subcategoria de destino
        let targetCat = categories.find(
          (c) => stripAccentsText(c.name) === stripAccentsText(movement.newCat),
        )
        if (!targetCat) {
          targetCat = categories.find((c) =>
            stripAccentsText(c.name).includes(stripAccentsText(movement.newCat)),
          )
        }

        let targetSubId: string | null = null
        if (targetCat && movement.newSub) {
          const rawSubs =
            targetCat.subcategories || (targetCat as any).transaction_subcategories || []
          const foundSub = rawSubs.find(
            (s: any) =>
              stripAccentsText(typeof s === 'string' ? s : s?.name || '') ===
              stripAccentsText(movement.newSub!),
          )
          if (foundSub && typeof foundSub !== 'string') {
            targetSubId = foundSub.id
          }
        }

        try {
          const updatePayload: any = {}
          if (targetCat) updatePayload.category_id = targetCat.id
          if (targetSubId) updatePayload.subcategory_id = targetSubId

          const updated = await updateTransaction(movement.txId, updatePayload)
          if (updated) {
            triggerRefresh()
            const amtFmt = formatBRL(movement.amountCents)
            const targetPairFmt = movement.newSub
              ? `${movement.newCat} › ${movement.newSub}`
              : movement.newCat
            const confirmReply = `Movido: ${amtFmt} agora em ${targetPairFmt} ✅`

            if (family?.id) {
              saveCopilotMessage({
                familyId: family.id,
                role: 'assistant',
                content: confirmReply,
                cardType: 'acao',
              }).catch(() => {})
            }

            setMessages((prev) => [
              ...prev,
              {
                id: `asst-${Date.now()}`,
                sender: 'assistant',
                text: confirmReply,
                timestamp: new Date(),
                cardType: 'acao',
              },
            ])
            setIsProcessing(false)
            return
          }
        } catch (updateErr) {
          console.warn('[CopilotPage] Erro ao mover transação de categoria:', updateErr)
        }
      }

      // TAREFA 1: Interceptar intenção de correção pós-lançamento de CATEGORIA (Classe 8 expandida)
      // Mensagens como:
      // "As long necks não é para o churrasco, eu comprei para me beber durante a semana"
      // "o carvão não é para churrasco, é para casa"
      // "o almoço não é lazer, muda para alimentação"
      // "muda para alimentação"
      const isPostLaunchCategoryCorrection =
        /(?:n[aã]o\s+[eé]\s+(?:para|pra|pro)|comprei\s+para\s+(?:me\s+)?beber|muda\s+(?:para|pra)|coloca\s+em|altera\s+(?:para|pra)|o\s+.*n[aã]o\s+[eé]\s+para)/i.test(
          text,
        )

      if (isPostLaunchCategoryCorrection && family?.id) {
        try {
          const recentTxs = await fetchTransactions({
            familyId: family.id,
            limit: 10,
          })

          if (recentTxs && recentTxs.length > 0) {
            // 1. Identificar a transação alvo
            // Procura por tokens da descrição da transação na mensagem do usuário
            const userTokens = tokenizeText(text)
            let matchedTx = recentTxs.find((tx) => {
              const txTokens = tokenizeText(tx.description)
              return txTokens.some((t) => userTokens.includes(t))
            })

            // Se não casar por token específico, tenta sinônimos como 'long neck' -> 'cerveja' ou última transação
            if (!matchedTx && /long\s*neck|cerveja|pack/i.test(text)) {
              matchedTx = recentTxs.find((tx) =>
                /long\s*neck|cerveja|pack|bebida/i.test(tx.description),
              )
            }
            if (!matchedTx && lastCreatedTxIdRef.current) {
              matchedTx = recentTxs.find((tx) => tx.id === lastCreatedTxIdRef.current)
            }
            if (!matchedTx) {
              matchedTx = recentTxs[0]
            }

            if (matchedTx) {
              // 2. Determinar o par novo via casamento tolerante (R47)
              // Se a mensagem mencionar bebidas/semana/casa -> Alimentação › Água & Bebidas para Casa
              let targetPairMatch = null
              if (/beber|semana|casa|bebida|long\s*neck|cerveja/i.test(text)) {
                targetPairMatch = matchTolerantPairAgainstCatalog(
                  'Alimentação',
                  'Água & Bebidas para Casa',
                  categories,
                )
              }
              if (!targetPairMatch) {
                // Tenta extrair menção explícita de categoria (ex: "muda para Lazer", "coloca em Mercado")
                const explicitCat = text.match(
                  /(?:para|pra|em)\s+([a-zA-Zá-úÁ-Ú&]+(?:\s+[a-zA-Zá-úÁ-Ú&]+)?)/i,
                )
                if (explicitCat) {
                  targetPairMatch = matchTolerantPairAgainstCatalog(
                    explicitCat[1].trim(),
                    null,
                    categories,
                  )
                }
              }

              if (targetPairMatch) {
                // Obtém o nome da categoria antiga
                const oldCatObj = categories.find((c) => c.id === matchedTx?.category_id)
                const oldCatName = oldCatObj?.name || 'Lazer'
                const oldSubObj = oldCatObj?.subcategories?.find(
                  (s) => s.id === matchedTx?.subcategory_id,
                )
                const oldSubName = oldSubObj?.name || 'Eventos & Reuniões'
                const oldPairFmt = oldSubName ? `${oldCatName} › ${oldSubName}` : oldCatName
                const newPairFmt = targetPairMatch.matchedSub
                  ? `${targetPairMatch.matchedCat} › ${targetPairMatch.matchedSub}`
                  : targetPairMatch.matchedCat

                const amtFmt = formatBRL(matchedTx.amount_cents)
                const proposalMsg = `Vou mover os ${amtFmt} de ${oldPairFmt} para ${newPairFmt}. Pode ser?`

                setPendingCategoryMovement({
                  txId: matchedTx.id,
                  description: matchedTx.description,
                  amountCents: matchedTx.amount_cents,
                  oldCat: oldCatName,
                  oldSub: oldSubName,
                  newCat: targetPairMatch.matchedCat,
                  newSub: targetPairMatch.matchedSub,
                })

                if (family.id) {
                  saveCopilotMessage({
                    familyId: family.id,
                    role: 'assistant',
                    content: proposalMsg,
                    cardType: 'clarificacao',
                  }).catch(() => {})
                }

                setMessages((prev) => [
                  ...prev,
                  {
                    id: `asst-${Date.now()}`,
                    sender: 'assistant',
                    text: proposalMsg,
                    timestamp: new Date(),
                    cardType: 'clarificacao',
                  },
                ])
                setIsProcessing(false)
                return
              }
            }
          }
        } catch (fetchErr) {
          console.warn(
            '[CopilotPage] Erro ao buscar transações recentes para correção de categoria:',
            fetchErr,
          )
        }
      }

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

      // H2/H3: Caminho 'Posso dizer para cada um?' ou confirmação da proposta -> Pergunta valores
      const isSplitEachPrompt =
        /\b(?:posso\s+dizer\s+(?:o\s+valor\s+)?para\s+cada\s+um|posso\s+dizer\s+cada\s+um|vou\s+dizer\s+cada\s+um|dizer\s+separado)\b/i.test(
          text.replace(/[.!?]/g, '').trim(),
        )

      if (
        isClass5ProposalPending &&
        effectivePendingTx &&
        (isAffirmativeConfirmation || isSplitEachPrompt)
      ) {
        const askValuesMsg = 'Pode dizer! Quanto foi cada item?'
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
              let itemCat = item.categoria_proposta || 'Outros'
              let itemSub = item.subcategoria_proposta || 'Outros'
              if (itemCat.toLowerCase() === 'geral') itemCat = 'Outros'
              if (itemSub.toLowerCase() === 'geral') itemSub = 'Outros'
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

        // H8: Verificação de divergência — se houver total declarado no contexto da pendência
        // e a soma dos itens informados for diferente do total declarado, CONFERIR E PERGUNTAR antes de lançar!
        if (foundAmounts.length >= pendingItems.length) {
          const declaredTotalCents = effectivePendingTx.amountCents || 0
          const itemsSumCents = foundAmounts
            .slice(0, pendingItems.length)
            .reduce((acc, curr) => acc + curr.amountCents, 0)

          if (declaredTotalCents > 0 && itemsSumCents !== declaredTotalCents) {
            const declaredFormatted = formatBRL(declaredTotalCents)
            const sumFormatted = formatBRL(itemsSumCents)
            const divergenceMsg = `A soma dos itens deu ${sumFormatted}, mas o total informado foi ${declaredFormatted}. Gostaria de conferir os valores antes de lançar?`

            const updatedPendingWithDivergence: ParsedVoiceTransaction = {
              ...effectivePendingTx,
              clarificationQuestion: divergenceMsg,
              friendlyMessage: divergenceMsg,
              aiStatus: 'clarificacao',
            }

            setPendingTx(updatedPendingWithDivergence)

            if (family?.id) {
              saveCopilotMessage({
                familyId: family.id,
                role: 'assistant',
                content: divergenceMsg,
                cardType: 'clarificacao',
              }).catch(() => {})
            }

            setMessages((prev) => [
              ...prev,
              {
                id: `asst-${Date.now()}`,
                sender: 'assistant',
                text: divergenceMsg,
                timestamp: new Date(),
                cardData: updatedPendingWithDivergence,
                cardType: 'clarificacao',
              },
            ])
            setIsProcessing(false)
            return
          }

          // Caso C: Todos os valores informados de uma vez (foundAmounts.length >= pendingItems.length)
          const resultsSummary: string[] = []
          for (let i = 0; i < pendingItems.length; i++) {
            const item = pendingItems[i]
            const itemAmountCents = foundAmounts[i].amountCents
            let itemCat = item.categoria_proposta || 'Outros'
            let itemSub = item.subcategoria_proposta || 'Outros'

            // BLOQUEAR 'Geral' NO CÓDIGO
            if (itemCat.toLowerCase() === 'geral') itemCat = 'Outros'
            if (itemSub.toLowerCase() === 'geral') itemSub = 'Outros'

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

      // TAREFA 1 & TAREFA 2 (PATCH 3): Atualização semântica do estado de itens pendentes
      // Se há pendência multi-item ativa e o usuário faz correção (churrasco OU menção de categoria/subcategoria do catálogo)
      let updatedExtractedItems = effectivePendingTx?.extractedItems
        ? [...effectivePendingTx.extractedItems]
        : null

      const isMultiItemPending =
        Boolean(effectivePendingTx) &&
        Boolean(updatedExtractedItems && updatedExtractedItems.length >= 2)

      if (isMultiItemPending && updatedExtractedItems) {
        const textNorm = stripAccentsText(text)
        const isChurrascoMention = /churrasco/i.test(text)
        const isCorrectionIntent =
          isChurrascoMention ||
          /^(n[oó]s\s+temos|temos\s+a\s+categoria|[eé]\s+para\s+o|[eé]\s+pra|vai\s+em|coloca\s+em|muda\s+pra|isso\s+vai\s+em|isso\s+[eé]\s+em)/i.test(
            textNorm,
          ) ||
          /(?:vai\s+em|coloca\s+em|muda\s+pra|categoria)\s+[a-z]+/i.test(textNorm)

        if (isCorrectionIntent) {
          if (isChurrascoMention) {
            // Caso de churrasco (Lazer › Eventos & Reuniões)
            const mentionsCarne = /carne/i.test(text)
            const mentionsCarvao = /ca(?:rv|v)[aã]o/i.test(text)
            updatedExtractedItems = updatedExtractedItems.map((it) => {
              const isTarget =
                (mentionsCarne && /carne/i.test(it.descricao)) ||
                (mentionsCarvao && /ca(?:rv|v)[aã]o/i.test(it.descricao)) ||
                (!mentionsCarne && !mentionsCarvao) // se não especificou, alvo = todos relacionados
              if (isTarget) {
                return {
                  ...it,
                  categoria_proposta: 'Lazer',
                  subcategoria_proposta: 'Eventos & Reuniões',
                }
              }
              return it
            })

            setPendingTx((prev) =>
              prev ? { ...prev, extractedItems: updatedExtractedItems } : prev,
            )

            const totalNum =
              effectivePendingTx.amountCents > 0
                ? effectivePendingTx.amountCents / 100
                : Number(
                    effectivePendingTx.amountFormatted?.replace(/[^\d,]/g, '').replace(',', '.') ||
                      0,
                  )
            const totalFormatted =
              effectivePendingTx.amountFormatted ||
              (totalNum > 0
                ? totalNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : 'R$ 0,00')

            const lines = updatedExtractedItems.map((it) => {
              const cat = it.categoria_proposta || 'Outros'
              const sub = it.subcategoria_proposta ? ` › **${it.subcategoria_proposta}**` : ''
              return `• ${it.descricao} → **${cat}**${sub}`
            })

            const correctedItemsNames =
              updatedExtractedItems
                .filter((it) => it.categoria_proposta === 'Lazer')
                .map((it) => it.descricao)
                .join(' e ') || 'carne e carvão'

            const remainingItemsNames =
              updatedExtractedItems
                .filter((it) => it.categoria_proposta !== 'Lazer')
                .map((it) => it.descricao)
                .join(', ') || 'demais itens'

            const divisionPart =
              totalNum > 0
                ? `\n\nEntendi — ${correctedItemsNames} vão para **Lazer** › **Eventos & Reuniões** e ${remainingItemsNames} ficam nas gavetas deles. Como o total é único (${totalFormatted}), preciso dividir: aproximadamente quanto foi da parte do churrasco?`
                : '\n\nEstá certo assim?'

            const oneCorrectionResponse = `Entendi! Então separei assim:\n${lines.join('\n')}${divisionPart}`

            if (family?.id) {
              saveCopilotMessage({
                familyId: family.id,
                role: 'assistant',
                content: oneCorrectionResponse,
                cardType: 'clarificacao',
              }).catch(() => {})
            }

            setMessages((prev) => [
              ...prev,
              {
                id: `asst-${Date.now()}`,
                sender: 'assistant',
                text: oneCorrectionResponse,
                timestamp: new Date(),
                cardType: 'clarificacao',
                cardData: {
                  ...effectivePendingTx,
                  extractedItems: updatedExtractedItems,
                },
              },
            ])
            setIsProcessing(false)
            return
          } else {
            // Correção semântica genérica de categoria/subcategoria (ex: "Nós temos a categoria pet", "é para o cachorro, vai em pet", "isso vai em bebidas")
            // 1. Tenta extrair a categoria ou par citado
            let candidateCat: string | null = null
            let candidateSub: string | null = null

            // Extrai possíveis termos após "categoria", "em", "pra"
            const matchExplicit = text.match(
              /(?:categoria|em|pra|para)\s+([a-zA-Zá-úÁ-Ú&]+(?:\s+[a-zA-Zá-úÁ-Ú&]+)?)/i,
            )
            if (matchExplicit) {
              const term = matchExplicit[1].trim()
              // Testa se o termo casa com categoria do catálogo
              const pairMatch = matchTolerantPairAgainstCatalog(term, null, categories)
              if (pairMatch) {
                candidateCat = pairMatch.matchedCat
                candidateSub = pairMatch.matchedSub
              } else {
                // Tenta achar categoria que tenha token overlap
                for (const cat of categories) {
                  const m = matchTolerantPairAgainstCatalog(cat.name, term, categories)
                  if (m) {
                    candidateCat = m.matchedCat
                    candidateSub = m.matchedSub
                    break
                  }
                }
              }
            }

            // Fallback: busca por palavras-chave diretas no texto da mensagem
            if (!candidateCat) {
              if (/pet|cachorro|gato|sach[eê]|ra[cç][aã]o/i.test(textNorm)) {
                const m = matchTolerantPairAgainstCatalog('Pets', 'Ração & Petiscos', categories)
                if (m) {
                  candidateCat = m.matchedCat
                  candidateSub = m.matchedSub
                }
              } else if (/bebida|cerveja|refrigerante|suco|agua|água/i.test(textNorm)) {
                const m = matchTolerantPairAgainstCatalog(
                  'Alimentação',
                  'Água & Bebidas para Casa',
                  categories,
                )
                if (m) {
                  candidateCat = m.matchedCat
                  candidateSub = m.matchedSub
                }
              }
            }

            if (candidateCat) {
              // Identifica qual item da pendência sofre a correção
              let targetItemDesc = ''
              updatedExtractedItems = updatedExtractedItems.map((it) => {
                const itNorm = stripAccentsText(it.descricao)
                // Se a mensagem citar palavras do item ou o contexto semântico do item
                const itTokens = tokenizeText(it.descricao)
                const textTokens = tokenizeText(text)
                const isTarget =
                  itTokens.some((t) => textTokens.includes(t)) ||
                  (/pet|cachorro|gato/i.test(textNorm) &&
                    /sach[eê]|pet|cachorro|gato|racao/i.test(itNorm)) ||
                  (/bebida/i.test(textNorm) && /pack|long neck|cerveja|bebida/i.test(itNorm)) ||
                  (/filho|crian[cç]a|bebe/i.test(textNorm) && /roda|brinquedo|fralda/i.test(itNorm))

                if (isTarget) {
                  targetItemDesc = it.descricao
                  return {
                    ...it,
                    categoria_proposta: candidateCat!,
                    subcategoria_proposta: candidateSub || it.subcategoria_proposta || null,
                  }
                }
                return it
              })

              if (!targetItemDesc) {
                targetItemDesc = updatedExtractedItems[0].descricao
                updatedExtractedItems[0] = {
                  ...updatedExtractedItems[0],
                  categoria_proposta: candidateCat,
                  subcategoria_proposta:
                    candidateSub || updatedExtractedItems[0].subcategoria_proposta || null,
                }
              }

              // Grava IMEDIATAMENTE no estado da pendência antes de responder
              setPendingTx((prev) =>
                prev ? { ...prev, extractedItems: updatedExtractedItems } : prev,
              )

              const catDisplay = candidateCat
              const subDisplay = candidateSub ? ` › ${candidateSub}` : ''
              const ackMsg = `Você tem razão — ${targetItemDesc} vai para ${catDisplay}${subDisplay}.`

              const lines = updatedExtractedItems.map((it) => {
                const cat = it.categoria_proposta || 'Outros'
                const sub = it.subcategoria_proposta ? ` › **${it.subcategoria_proposta}**` : ''
                return `• ${it.descricao} → **${cat}**${sub}`
              })

              const fullReply = `${ackMsg}\n\nSeparei assim:\n${lines.join('\n')}\n\nEstá certo assim?`

              if (family?.id) {
                saveCopilotMessage({
                  familyId: family.id,
                  role: 'assistant',
                  content: fullReply,
                  cardType: 'clarificacao',
                }).catch(() => {})
              }

              setMessages((prev) => [
                ...prev,
                {
                  id: `asst-${Date.now()}`,
                  sender: 'assistant',
                  text: fullReply,
                  timestamp: new Date(),
                  cardType: 'clarificacao',
                  cardData: {
                    ...effectivePendingTx,
                    extractedItems: updatedExtractedItems,
                  },
                },
              ])
              setIsProcessing(false)
              return
            }
          }
        }
      }

      // TAREFA 2: Re-exibição reflete correções acumuladas
      const isShowSeparationRequest =
        Boolean(effectivePendingTx) &&
        /^(me\s+)?(mostre|mostra|veja|ver)\s+(como\s+)?(vc\s+|voc[eê]\s+)?(separou|ficou)|como\s+(vc\s+|voc[eê]\s+)?separou\??$/i.test(
          text.trim(),
        )

      if (isShowSeparationRequest && effectivePendingTx && effectivePendingTx.extractedItems) {
        const itemsToDisplay = updatedExtractedItems || effectivePendingTx.extractedItems
        const lines = itemsToDisplay.map((it) => {
          const cat = it.categoria_proposta || 'Outros'
          const sub = it.subcategoria_proposta ? ` › **${it.subcategoria_proposta}**` : ''
          return `• ${it.descricao} → **${cat}**${sub}`
        })
        const reDisplayMsg = `Separei assim:\n${lines.join('\n')}\n\nEstá certo assim?`

        if (family?.id) {
          saveCopilotMessage({
            familyId: family.id,
            role: 'assistant',
            content: reDisplayMsg,
            cardType: 'clarificacao',
          }).catch(() => {})
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            sender: 'assistant',
            text: reDisplayMsg,
            timestamp: new Date(),
            cardType: 'clarificacao',
            cardData: {
              ...effectivePendingTx,
              extractedItems: itemsToDisplay,
            },
          },
        ])
        setIsProcessing(false)
        return
      }

      // ATENÇÃO 11 (27/10): perguntas sobre lançamento recente ("e a Netflix?",
      // "onde lançou o Spotify?") chegam SEM pendência ativa — o previousCtx
      // antigo só existia durante um fluxo pendente. Sem saber o que foi
      // lançado há pouco, a edge relançava o item mencionado. Agora o contexto
      // carrega as últimas transações reais da família.
      let lancamentosRecentes: Array<{
        descricao: string
        valor: number
        data: string
      }> = []
      if (family?.id) {
        try {
          const recentes = await fetchTransactions({
            familyId: family.id,
            limit: 5,
          })
          lancamentosRecentes = recentes.map((t) => ({
            descricao: t.description,
            valor: (Number(t.amount_cents) || 0) / 100,
            data: t.transaction_date,
          }))
        } catch (e) {
          console.warn('Copilot: falha ao buscar lançamentos recentes p/ contexto:', e)
        }
      }

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
            itens: updatedExtractedItems || effectivePendingTx.extractedItems,
          }
        : undefined

      const parsed = await parseVoiceWithAi({
        texto: text,
        familyId: family?.id,
        categories,
        activeMonth,
        contexto_anterior: previousCtx as any,
        historico_mensagens: historicoSanitizado as any,
        lancamentos_recentes: lancamentosRecentes as any,
      })

      // TAREFA 5: Interceptar comandos de correção de valor e comandos ainda não suportados (Fim do Fingimento)
      const isValueCorrectionIntent =
        parsed.acao === 'ajustar_valor' ||
        (parsed.intencao === 'correcao' && parsed.amountCents > 0) ||
        (/^(na verdade,? foi|n[aã]o,? era|foi \d+|corrigir valor|valor errado|o valor foi)/i.test(
          text,
        ) &&
          parsed.amountCents > 0)

      // TAREFA 3: Comando da Classe 8 de troca explícita de mês ("me mostra janeiro", etc.)
      const isMonthNavigationCommand =
        parsed.acao === 'mudar_mes' ||
        (parsed.routerClasse === 8 && /mudar_mes|trocar_mes/i.test(parsed.acao || '')) ||
        /^(me\s+mostra|mostrar?|mudar?\s+para|ir\s+para|trocar?\s+m[eê]s\s+para|mudar?\s+m[eê]s\s+para|ver)\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+\d{4})?/i.test(
          text.trim(),
        )

      if (isMonthNavigationCommand) {
        // Mapeamento em português
        const monthsMapPt: Record<string, string> = {
          janeiro: '01',
          fevereiro: '02',
          marco: '03',
          março: '03',
          abril: '04',
          maio: '05',
          junho: '06',
          julho: '07',
          agosto: '08',
          setembro: '09',
          outubro: '10',
          novembro: '11',
          dezembro: '12',
        }

        let targetMonthStr = parsed.mesAlvo || null

        if (!targetMonthStr) {
          const match = text.match(
            /(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?/i,
          )
          if (match) {
            const rawMonthName = match[1].toLowerCase()
            const monthCode = monthsMapPt[rawMonthName]
            const yearStr =
              match[2] || activeMonth?.split('-')[0] || String(new Date().getFullYear())
            if (monthCode) {
              targetMonthStr = `${yearStr}-${monthCode}`
            }
          }
        }

        if (targetMonthStr && /^\d{4}-\d{2}$/.test(targetMonthStr)) {
          // Atualiza o activeMonth global (Home, Transações e Orçamentos)
          setActiveMonth(targetMonthStr)
          triggerRefresh()

          const [y, m] = targetMonthStr.split('-')
          const monthNamesList = [
            'janeiro',
            'fevereiro',
            'março',
            'abril',
            'maio',
            'junho',
            'julho',
            'agosto',
            'setembro',
            'outubro',
            'novembro',
            'dezembro',
          ]
          const monthLabel = `${monthNamesList[parseInt(m, 10) - 1]} de ${y}`
          const confirmationText = `Mostrando ${monthLabel} — Home, Transações e Orçamentos atualizados.`

          if (family?.id) {
            saveCopilotMessage({
              familyId: family.id,
              role: 'assistant',
              content: confirmationText,
              cardType: 'acao',
            }).catch(() => {})
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              sender: 'assistant',
              text: confirmationText,
              timestamp: new Date(),
              cardType: 'acao',
            },
          ])
          setIsProcessing(false)
          return
        }
      }

      const isUnsupportedCommand =
        /^(apaga|apagar|deleta|deletar|remove|remover|exclui|excluir)\b/i.test(text.trim())

      if (isUnsupportedCommand) {
        const honestMsg =
          'Ainda não consigo fazer isso por aqui — por favor, ajuste ou exclua manualmente no extrato do app.'
        if (family?.id) {
          saveCopilotMessage({
            familyId: family.id,
            role: 'assistant',
            content: honestMsg,
            cardType: 'consulta',
          }).catch(() => {})
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            sender: 'assistant',
            text: honestMsg,
            timestamp: new Date(),
            cardType: 'consulta',
          },
        ])
        setIsProcessing(false)
        return
      }

      if (isValueCorrectionIntent && family?.id) {
        const newAmountCents = parsed.amountCents > 0 ? parsed.amountCents : 0

        // Busca a última transação criada pelo usuário na família
        let targetTxId = lastCreatedTxIdRef.current
        let previousAmountCents = 0

        try {
          if (!targetTxId) {
            const recentTxs = await fetchTransactions({
              familyId: family.id,
              limit: 1,
            })
            if (recentTxs && recentTxs.length > 0) {
              targetTxId = recentTxs[0].id
              previousAmountCents = recentTxs[0].amount_cents
            }
          } else {
            const recentTxs = await fetchTransactions({
              familyId: family.id,
              limit: 5,
            })
            const match = recentTxs.find((t) => t.id === targetTxId)
            if (match) {
              previousAmountCents = match.amount_cents
            }
          }

          if (targetTxId && newAmountCents > 0) {
            const updated = await updateTransaction(targetTxId, {
              amount_cents: newAmountCents,
            })

            if (updated && updated.amount_cents === newAmountCents) {
              triggerRefresh()
              const newFmt = formatBRL(newAmountCents)
              const confirmMsg = previousAmountCents
                ? `Ajustado: de ${formatBRL(previousAmountCents)} para ${newFmt} ✅`
                : `Ajustado: valor agora é ${newFmt} ✅`

              saveCopilotMessage({
                familyId: family.id,
                role: 'assistant',
                content: confirmMsg,
                cardType: 'acao',
              }).catch(() => {})

              setMessages((prev) => [
                ...prev,
                {
                  id: `asst-${Date.now()}`,
                  sender: 'assistant',
                  text: confirmMsg,
                  timestamp: new Date(),
                  cardType: 'acao',
                },
              ])
              setIsProcessing(false)
              return
            }
          }
        } catch (updateErr: any) {
          console.warn(
            '[CopilotPage] Erro ao executar UPDATE real de correção de valor:',
            updateErr,
          )
        }
      }

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

        // Se houver itens acumulados atualizados (ex.: pós-correção semântica), garante persistência no pendingTx
        if (updatedExtractedItems) {
          parsed.extractedItems = updatedExtractedItems
        }

        assistantText =
          parsed.friendlyMessage ||
          parsed.clarificationQuestion ||
          (isAskingForItems
            ? 'O que você comprou? Me conta os itens que eu já organizo pra você!'
            : `Entendi "${parsed.description}". Qual foi o valor?`)
      } else if (
        parsed.aiStatus === 'sucesso' &&
        (parsed.amountCents > 0 ||
          // MULTI-ITEM SEM VALOR TOTAL (27/10, bug real do Matheus): a edge às
          // vezes responde itens completos com valor MAS sem o valor somado no
          // objeto transacao (valor: undefined). O caminho antigo exigia
          // amountCents > 0 e NUNCA gravava — o chat dizia "Lançado!" e o
          // banco ficava vazio. Itens prontos também são lançamento válido.
          (parsed.extractedItems || []).filter((it) => typeof it.valor === 'number' && it.valor > 0)
            .length >= 2)
      ) {
        setPendingTx(null)
        cardType = 'transacao'

        // SÉRIE DE PARCELAS (27/10, ordem do Matheus): "6x de 45" e "11 parcelas
        // de 320 desde janeiro" agora criam a SÉRIE completa — uma transação por
        // mês, vinculadas por installment_group_id, com is_installment = true.
        // Retroativo: mes_inicio pode estar no passado (a edge extrai do texto).
        if (parsed.parcelas && parsed.parcelas.total >= 2 && family) {
          const { total, valorParcelaCents, mesInicio } = parsed.parcelas
          const groupId = crypto.randomUUID()
          const [y0, m0] = mesInicio.split('-').map(Number)
          const memberId = currentMember?.id || members[0]?.id || ''
          let cat = categories.find(
            (cx) =>
              cx.type === parsed.type &&
              (cx.name.toLowerCase() === parsed.categoryNameSuggestion?.toLowerCase() ||
                cx.name.toLowerCase().includes(parsed.categoryNameSuggestion?.toLowerCase() || '')),
          )
          const categoryId = cat?.id || null
          let subcategoryId: string | null = null
          if (cat && parsed.subcategoryNameSuggestion) {
            const sub = cat.subcategories?.find(
              (sx) => sx.name.toLowerCase() === parsed.subcategoryNameSuggestion?.toLowerCase(),
            )
            if (sub) subcategoryId = sub.id
          }

          let savedCount = 0
          for (let i = 0; i < total; i++) {
            // mês da parcela i: mesInicio + i meses (clamp de dezembro→janeiro)
            const mi = m0 - 1 + i
            const yy = y0 + Math.floor(mi / 12)
            const mm = (mi % 12) + 1
            const dateStr = `${yy}-${String(mm).padStart(2, '0')}-01`
            const created = await createTransaction({
              family_id: family.id,
              member_id: memberId,
              category_id: categoryId,
              subcategory_id: subcategoryId,
              type: parsed.type,
              amount_cents: valorParcelaCents,
              description: parsed.description,
              transaction_date: dateStr,
              status: 'confirmed',
              is_installment: true,
              installment_number: i + 1,
              installment_total: total,
              installment_group_id: groupId,
            })
            if (created) savedCount++
          }

          const [yEnd, mEnd] = [y0, m0]
          const lastMonth = mEnd - 1 + (total - 1)
          const yyEnd = y0 + Math.floor(lastMonth / 12)
          const mmEnd = (lastMonth % 12) + 1
          const monthNamesPt = [
            'janeiro',
            'fevereiro',
            'março',
            'abril',
            'maio',
            'junho',
            'julho',
            'agosto',
            'setembro',
            'outubro',
            'novembro',
            'dezembro',
          ]
          // Transparência total (27/10, pedido do Matheus): a resposta diz ONDE
          // caiu — categoria › subcategoria › balde. Sem categoria casada
          // (anti-chute), avisa honestamente que vai pro deck de revisão.
          const bucketLabel =
            cat?.budget_bucket === 'essentials'
              ? 'Necessidades Essenciais'
              : cat?.budget_bucket === 'lifestyle'
                ? 'Estilo de Vida'
                : cat?.budget_bucket === 'future'
                  ? 'Metas & Investimentos'
                  : null
          const destinoTxt = cat
            ? `${cat.name}${subcategoryId ? ` › ${parsed.subcategoryNameSuggestion}` : ''}${
                bucketLabel ? ` (${bucketLabel})` : ''
              }`
            : 'sem categoria — confira no deck de revisão'
          const fmtBRL = (cents: number) =>
            (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          assistantText = `✅ ${savedCount} parcela(s) de ${fmtBRL(
            valorParcelaCents,
          )} gravadas — de ${monthNamesPt[m0 - 1]}/${String(y0).slice(2)} a ${
            monthNamesPt[mmEnd - 1]
          }/${String(yyEnd).slice(2)} (total ${parsed.amountFormatted}) em ${destinoTxt}.`
          lastCreatedTxIdRef.current = null
          setIsProcessing(false)
          if (family?.id) {
            saveCopilotMessage({
              familyId: family.id,
              role: 'assistant',
              content: assistantText,
              cardType: 'transacao',
            }).catch(() => {})
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              sender: 'assistant',
              text: assistantText,
              timestamp: new Date(),
              cardType: 'transacao',
            },
          ])
          return
        }

        // MULTI-ITEM COM VALORES (27/10, bug do Matheus): quando a edge devolve
        // vários itens TODOS com valor (ex.: "250 de água, 350 de luz, 1620 de
        // aluguel"), o caminho antigo gravava UMA transação com a SOMA —
        // R$ 2.220 numa categoria só, itens perdidos, e uma única conta fixa
        // com o valor total. Agora: cada item vira SUA transação na categoria
        // certa; se o pedido é recorrente, cada item vira SUA conta fixa.
        const itensProntos = (parsed.extractedItems || []).filter(
          (it) => typeof it.valor === 'number' && it.valor > 0,
        )
        if (itensProntos.length >= 2) {
          const memberId = currentMember?.id || members[0]?.id || ''
          const wantsRecurringMulti =
            parsed.recorrente === true ||
            /\b(todo|todos|toda|todas)\s+(os\s+|as\s+)?m[eê]s(es)?\b|\bfix[ao]\b|\brecorrente\b/i.test(
              text,
            )
          const resultados: string[] = []
          for (const item of itensProntos) {
            const itemCents = Math.round(item.valor * 100)
            let itemCat = categories.find(
              (cx) =>
                cx.type === 'expense' &&
                (cx.name.toLowerCase() === item.categoria_proposta?.toLowerCase() ||
                  cx.name.toLowerCase().includes(item.categoria_proposta?.toLowerCase() || '')),
            )
            let itemSubId: string | null = null
            if (itemCat && item.subcategoria_proposta) {
              const sub = itemCat.subcategories?.find(
                (sx) => sx.name.toLowerCase() === item.subcategoria_proposta?.toLowerCase(),
              )
              if (sub) itemSubId = sub.id
            }
            const todayStr = new Date().toISOString().split('T')[0]
            const createdItem = await createTransaction({
              family_id: family.id,
              member_id: memberId,
              category_id: itemCat?.id || null,
              subcategory_id: itemSubId,
              type: 'expense',
              amount_cents: itemCents,
              description: item.descricao,
              transaction_date: todayStr,
              status: 'confirmed',
            })
            if (!createdItem) continue
            let linha = `${formatBRL(itemCents)} em ${item.categoria_proposta || 'Sem categoria'}${
              item.subcategoria_proposta ? ` › ${item.subcategoria_proposta}` : ''
            }`
            if (wantsRecurringMulti && createdItem) {
              try {
                const { createRecurringIncome } = await import('@/services/recurring-incomes')
                const recRule = await createRecurringIncome({
                  family_id: family.id,
                  member_id: memberId,
                  category_id: itemCat?.id || null,
                  subcategory_id: itemSubId,
                  name: item.descricao,
                  type: 'expense',
                  amount_cents: itemCents,
                  day_of_month: new Date().getDate(),
                })
                if (recRule?.id) {
                  await updateTransaction(createdItem.id, {
                    recurring_income_id: recRule.id,
                    is_recurring: true,
                    recurring_month: todayStr.slice(0, 7) + '-01',
                  })
                  linha += ' 🔁'
                }
              } catch (recErr) {
                console.warn('Copilot: erro ao criar conta fixa do item:', recErr)
              }
            }
            resultados.push(linha)
          }
          triggerRefresh()
          assistantText = `Lancei ${resultados.length} ${
            resultados.length === 1 ? 'conta' : 'contas'
          }:\n${resultados.map((r) => `• ${r}`).join('\n')}`
          setIsProcessing(false)
          if (family?.id) {
            saveCopilotMessage({
              familyId: family.id,
              role: 'assistant',
              content: assistantText,
              cardType: 'transacao',
            }).catch(() => {})
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `asst-${Date.now()}`,
              sender: 'assistant',
              text: assistantText,
              timestamp: new Date(),
              cardType: 'transacao',
            },
          ])
          return
        }

        const savedTx = await executeAutonomousSave(parsed)

        // LANÇAMENTO RECORRENTE VIA COPILOT (21/10, pedido do Matheus):
        // "aluguel de 1200 todo dia 5" cria a CONTA FIXA além da transação.
        // Detecção local por regex (zero custo, funciona já) — quando a edge
        // redeployar com a regra B6 do prompt, parsed.recorrente também chega.
        const RECUR_RE =
          /\b(todo|todos|toda|todas)\s+(os\s+|as\s+)?m[eê]s(es)?\b|\bfix[ao]\b|\brecorrente\b|\bsempre no dia\b|\bpor m[eê]s\b|\bmensal(mente)?\b/i
        const recDayMatch = text.match(/dia\s+(\d{1,2})/i)
        const wantsRecurring = parsed.recorrente === true || RECUR_RE.test(text)
        if (wantsRecurring && family && savedTx) {
          const recDay = Math.max(
            1,
            Math.min(
              31,
              (recDayMatch && parseInt(recDayMatch[1], 10)) ||
                parseInt((savedTx.transaction_date || '').slice(8, 10), 10) ||
                new Date().getDate(),
            ),
          )
          try {
            const { createRecurringIncome } = await import('@/services/recurring-incomes')
            const recRule = await createRecurringIncome({
              family_id: family.id,
              member_id: savedTx.member_id,
              category_id: savedTx.category_id,
              subcategory_id: savedTx.subcategory_id,
              name: parsed.description || text.slice(0, 60),
              type: parsed.type,
              amount_cents: parsed.amountCents,
              day_of_month: recDay,
            })
            if (recRule?.id) {
              await updateTransaction(savedTx.id, {
                recurring_income_id: recRule.id,
                is_recurring: true,
                recurring_month: (savedTx.transaction_date || '').slice(0, 7) + '-01',
              })
            }
            assistantText = `${parsed.friendlyMessage || 'Lançamento feito! 👍'} 🔁 Vou lançar automaticamente todo dia ${recDay}.`
          } catch (recErr) {
            console.warn('Copilot: erro ao criar conta fixa recorrente:', recErr)
          }
        }
      } else if (
        parsed.aiStatus === 'clarificacao' ||
        parsed.aiStatus === 'clarificacao_categoria'
      ) {
        if (updatedExtractedItems) {
          parsed.extractedItems = updatedExtractedItems
        }
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
    <div className="flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100dvh-6rem)] max-w-2xl mx-auto bg-white/70 backdrop-blur-sm rounded-3xl border border-border/40 shadow-curiango overflow-hidden relative">
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

      {/* Rodapé e Barra de Entrada (Texto + Microfone Unificado CDS v1.0)
          FIX 27/10 (Matheus: "a barra navy pula ao enviar mensagem"): o pulo
          era o viewport fixo (100vh) + o teclado mobile reajustando o layout.
          100dvh acompanha o viewport DINÂMICO (teclado abre/fecha sem salto)
          e o padding-bottom respeita a barra de gestos. */}
      <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-white border-t border-border/40 space-y-2">
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
