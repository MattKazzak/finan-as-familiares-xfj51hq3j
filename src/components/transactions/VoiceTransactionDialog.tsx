import React, { useState, useEffect, useRef } from 'react'
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
  const [speechSupported, setSpeechSupported] = useState(true)
  const [parsedResult, setParsedResult] = useState<ParsedVoiceTransaction | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [manualTextMode, setManualTextMode] = useState(false)
  const [manualTextInput, setManualTextInput] = useState('')

  // Refs para controle do SpeechRecognition e timer de silêncio
  const recognitionRef = useRef<any>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSpokenTimeRef = useRef<number>(Date.now())

  // Resetar ao abrir/fechar
  useEffect(() => {
    if (open) {
      setTranscript('')
      setInterimTranscript('')
      setParsedResult(null)
      setManualTextMode(false)
      setManualTextInput('')
      setSelectedMemberId(currentMember?.id || members[0]?.id || '')

      // Verificar suporte do navegador
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (SpeechRecognition) {
        setSpeechSupported(true)
        startListening()
      } else {
        setSpeechSupported(false)
        setManualTextMode(true)
      }
    } else {
      stopListening()
    }

    return () => {
      stopListening()
    }
  }, [open])

  // Iniciar reconhecimento de voz
  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setSpeechSupported(false)
      setManualTextMode(true)
      return
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // silenciar erro
        }
      }

      const recognition = new SpeechRecognition()
      recognition.lang = 'pt-BR'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
        lastSpokenTimeRef.current = Date.now()
        resetSilenceTimer()
      }

      recognition.onresult = (event: any) => {
        lastSpokenTimeRef.current = Date.now()
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
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast({
            title: 'Microfone não permitido',
            description: 'Permita o acesso ao microfone no navegador ou digite a frase abaixo.',
            variant: 'destructive',
          })
          setSpeechSupported(false)
          setManualTextMode(true)
        }
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.warn('Erro ao inicializar microfone:', err)
      setSpeechSupported(false)
      setManualTextMode(true)
    }
  }

  // Timer de ~2 segundos de silêncio contínuo para parada automática
  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
    }

    silenceTimerRef.current = setTimeout(() => {
      // 2 segundos sem fala
      handleStopAndProcess()
    }, 2200)
  }

  const stopListening = () => {
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
    setIsListening(false)
  }

  // Parar gravação e disparar interpretação com o texto capturado
  const handleStopAndProcess = (overrideText?: string) => {
    stopListening()

    const textToProcess =
      overrideText !== undefined ? overrideText : `${transcript} ${interimTranscript}`.trim()

    if (!textToProcess) {
      return
    }

    const parsed = parseVoiceInput(textToProcess, categories)
    setParsedResult(parsed)
  }

  // Submeter modo texto manual
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
          <div className="space-y-5 pt-2">
            {!manualTextMode ? (
              <div className="flex flex-col items-center justify-center py-6 px-4 bg-gradient-to-b from-emerald-50/70 to-slate-50 rounded-2xl border border-emerald-100 text-center relative overflow-hidden">
                {/* Animação de Ondas Sonoras / Pulso */}
                <div className="relative mb-5 flex items-center justify-center">
                  {isListening ? (
                    <>
                      <div className="absolute w-24 h-24 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
                      <div className="absolute w-20 h-20 rounded-full bg-emerald-500/30 animate-pulse pointer-events-none" />
                      <div className="w-16 h-16 rounded-full bg-[#064E3B] text-white flex items-center justify-center shadow-lg shadow-emerald-900/30 z-10">
                        <Mic className="w-8 h-8 animate-bounce text-emerald-300" />
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={startListening}
                      className="w-16 h-16 rounded-full bg-slate-200 text-slate-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center shadow-md transition-all active:scale-95"
                      title="Toque para começar a falar"
                    >
                      <MicOff className="w-7 h-7" />
                    </button>
                  )}
                </div>

                {/* Status textual */}
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  {isListening ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Escutando em tempo real...
                    </>
                  ) : (
                    'Microfone pausado'
                  )}
                </span>

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

                {/* Barrinhas de áudio visual animadas quando ouvindo */}
                {isListening && (
                  <div className="flex items-center gap-1 mt-4">
                    <span className="w-1 h-3 bg-emerald-600 rounded-full animate-pulse" />
                    <span className="w-1 h-5 bg-emerald-600 rounded-full animate-bounce delay-75" />
                    <span className="w-1 h-7 bg-emerald-600 rounded-full animate-pulse delay-100" />
                    <span className="w-1 h-4 bg-emerald-600 rounded-full animate-bounce delay-150" />
                    <span className="w-1 h-6 bg-emerald-600 rounded-full animate-pulse delay-200" />
                  </div>
                )}
              </div>
            ) : (
              /* MODO DIGITAÇÃO ALTERNATIVO (Navegador sem suporte ou usuário preferiu digitar) */
              <form onSubmit={handleManualTextSubmit} className="space-y-3">
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900">
                    {!speechSupported
                      ? 'Seu navegador não suporta reconhecimento de voz direto. Digite a frase como falaria que a IA entenderá do mesmo jeito!'
                      : 'Modo digitação rápido ativado:'}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    O que você gastou ou recebeu?
                  </label>
                  <Input
                    value={manualTextInput}
                    onChange={(e) => setManualTextInput(e.target.value)}
                    placeholder="Ex: Almoço 45 reais no débito"
                    className="rounded-xl h-11 text-sm bg-white"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!manualTextInput.trim()}
                  className="w-full bg-[#064E3B] hover:bg-emerald-900 text-white rounded-xl font-bold text-xs h-10 gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Interpretar com IA
                </Button>
              </form>
            )}

            {/* Ações do rodapé do modo escuta */}
            {!manualTextMode ? (
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    stopListening()
                    setManualTextMode(true)
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Prefiro digitar</span>
                </button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTranscript('')
                      setInterimTranscript('')
                      startListening()
                    }}
                    className="text-xs rounded-xl"
                  >
                    Recomeçar
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={!currentDisplaySpeech}
                    onClick={() => handleStopAndProcess()}
                    className="bg-[#064E3B] hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    Parar e Processar
                  </Button>
                </div>
              </div>
            ) : speechSupported ? (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setManualTextMode(false)
                    startListening()
                  }}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1.5 mx-auto transition-colors"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Voltar para microfone de voz</span>
                </button>
              </div>
            ) : null}
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
                  if (speechSupported && !manualTextMode) startListening()
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
