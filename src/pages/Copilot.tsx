import React, { useState, useEffect, useRef, useCallback } from 'react'
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
import { fetchCopilotMessages, saveCopilotMessage } from '@/services/copilot'
import {
  getLocalAiConsent,
  fetchUserPreferencesWithFallback,
  saveUserAiConsent,
} from '@/services/user-preferences'
import { createTransaction } from '@/services/transactions'
import { BUCKET_METADATA } from '@/types/budget-presets'
import { formatBRL } from '@/lib/formatters'
import type { BudgetBucket } from '@/types/finance'
import type { ParsedVoiceTransaction, StructuredSuggestionOption } from '@/services/voice-parser'
import { useVoiceCapture } from '@/hooks/use-voice-capture'

export interface CopilotChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: Date
  cardType?: string | null
  cardData?: ParsedVoiceTransaction | null
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

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

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
    scrollToBottom()
  }, [messages, isProcessing])

  // Inicialização: carrega consentimento do banco com fallback e histórico das 20 mensagens
  useEffect(() => {
    fetchUserPreferencesWithFallback().then((pref) => {
      setHasConsent(pref.aiConsent)
      if (!pref.aiConsent) {
        setShowConsentModal(true)
      }
    })

    if (family?.id) {
      fetchCopilotMessages(family.id, 20)
        .then((history) => {
          if (history && history.length > 0) {
            const mapped: CopilotChatMessage[] = history.map((rec) => ({
              id: rec.id,
              sender: rec.role,
              text: rec.content,
              timestamp: new Date(rec.created_at),
              cardType: rec.card_type,
            }))
            setMessages(mapped)
          } else {
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
      // Monta histórico recente sanitizado para o motor consultivo
      const historicoSanitizado = messages.slice(-6).map((m) => ({
        role: m.sender,
        content: m.text,
      }))

      const previousCtx = pendingTx
        ? {
            descricao: pendingTx.description,
            estabelecimento: pendingTx.establishment,
            valor: pendingTx.amountCents > 0 ? pendingTx.amountCents / 100 : null,
            categoria: pendingTx.categoryNameSuggestion,
            subcategoria: pendingTx.subcategoryNameSuggestion,
            balde: pendingTx.bucketSuggestion,
            tipo: pendingTx.type,
            status: pendingTx.aiStatus,
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
        assistantText =
          parsed.friendlyMessage || `Entendi "${parsed.description}". Qual foi o valor?`
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

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
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
                <p className="whitespace-pre-wrap break-words">{m.text}</p>

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
              <span className="text-[11px] font-semibold truncate">
                Toque na tela para ativar o áudio
              </span>
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

        {/* Status de gravação: Badge de modo ("Captação estável" esmeralda / "Captação do navegador" âmbar) + Waveform */}
        {(isListening || isTranscribing) && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-[#FCA311]/50 shadow-xs text-xs animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              {isListening ? (
                <>
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FCA311] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E08E08]" />
                  </span>
                  <span className="text-[#14213D] font-bold text-[11px] truncate">
                    Ouvindo... fale naturalmente
                  </span>
                  {/* Badge de modo de captação CDS */}
                  <span
                    data-testid="audio-capture-mode-badge"
                    data-mode={audioCaptureMode || 'media_recorder'}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold tracking-wide shrink-0 ${
                      audioCaptureMode === 'web_speech'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300/80'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300/80'
                    }`}
                  >
                    {audioCaptureMode === 'web_speech'
                      ? 'Captação do navegador'
                      : 'Captação estável'}
                  </span>
                </>
              ) : (
                <span className="text-[#14213D] font-medium text-[11px] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FCA311] animate-pulse" />
                  Transcrevendo áudio...
                </span>
              )}
            </div>

            {isListening && (
              <div className="flex items-center gap-2 shrink-0">
                {/* Waveform REAL de 5 bandas */}
                <div
                  data-testid="copilot-waveform"
                  className="flex items-center gap-1 h-4 px-1.5 py-0.5 rounded-full bg-[#14213D] border border-[#FCA311]/60 shadow-xs"
                  aria-label="Gravando áudio"
                >
                  {realAudioLevels.map((lvl, bIdx) => {
                    const barHeightPx = Math.max(3, Math.round(lvl * 14))
                    return (
                      <span
                        key={bIdx}
                        className="w-0.5 bg-[#FCA311] rounded-full transition-all duration-75"
                        style={{ height: `${barHeightPx}px` }}
                      />
                    )
                  })}
                </div>

                <span
                  data-testid="copilot-elapsed-time"
                  className="font-mono text-[10px] font-bold text-white px-1.5 py-0.5 rounded-md bg-[#14213D] border border-[#FCA311]/40"
                >
                  {Math.floor(voiceElapsedSeconds / 60)
                    .toString()
                    .padStart(2, '0')}
                  :{(voiceElapsedSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Linha de Ação: Se estiver ouvindo, botões dedicados de Parar e Cancelar; senão formulário normal */}
        {isListening ? (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={cancelListening}
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300/80 text-[#64748B] hover:text-[#14213D] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-curiango active:scale-95"
              aria-label="Cancelar gravação"
            >
              <X className="w-4 h-4 text-[#64748B]" />
              <span>Cancelar</span>
            </button>

            {/* Centro: Indicador pulsante */}
            <div className="relative flex items-center justify-center">
              <span className="absolute -inset-1.5 rounded-full bg-[#FCA311]/30 animate-ping pointer-events-none" />
              <div className="relative w-11 h-11 rounded-full bg-[#14213D] text-white border-2 border-[#FCA311] flex items-center justify-center shadow-curiango">
                <Mic className="w-4 h-4 text-[#FCA311]" />
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleListening}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-2xl bg-[#14213D] hover:bg-[#14213D]/90 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-curiango active:scale-95 border border-[#FCA311]/40"
              aria-label="Parar gravação e transcrever"
            >
              <Square className="w-3.5 h-3.5 fill-[#FCA311] text-[#FCA311]" />
              <span>Concluir</span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              processInput(inputText)
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={handleToggleListening}
              aria-label="Falar comando por voz"
              disabled={isProcessing || isTranscribing}
              className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 hover:bg-brand-amber/20 hover:text-brand flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-40"
            >
              <Mic className="w-4 h-4" strokeWidth={1.5} />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pergunte algo ou lance um gasto..."
              disabled={isProcessing || isTranscribing}
              className="flex-1 bg-slate-50 border border-border/60 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-amber min-w-0"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing || isTranscribing}
              aria-label="Enviar mensagem"
              className="w-10 h-10 rounded-xl bg-brand text-white hover:bg-brand-light disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" strokeWidth={1.5} />
            </button>
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
              <h3 className="text-sm font-bold text-slate-900 leading-snug">
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
                className="h-9 px-4 text-xs font-bold rounded-xl bg-brand hover:bg-brand-light text-white shadow-xs transition-colors cursor-pointer"
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
