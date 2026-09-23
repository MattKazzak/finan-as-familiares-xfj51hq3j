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
  const [audioDetected, setAudioDetected] = useState(false)
  const [textoFalado, setTextoFalado] = useState('')
  const [parsedResult, setParsedResult] = useState<ParsedVoiceTransaction | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  // Permissão nativa e status de erro amigável
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Refs de controle
  const recognitionRef = useRef<any>(null)
  const latestTranscriptRef = useRef<string>('')
  const hadErrorRef = useRef<boolean>(false)

  // Parar gravação ativa
  const stopListening = useCallback(() => {
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
  }, [])

  // Parar gravação e disparar interpretação com o texto informado ou o texto atual da caixinha
  const handleStopAndProcess = useCallback(
    (overrideText?: string) => {
      stopListening()

      const textToProcess = (overrideText !== undefined ? overrideText : textoFalado).trim()

      if (!textToProcess) {
        return
      }

      const parsed = parseVoiceInput(textToProcess, categories)
      setParsedResult(parsed)
    },
    [categories, stopListening, textoFalado],
  )

  // Iniciar SpeechRecognition síncrono no evento de clique
  const startRecording = useCallback(() => {
    // 1. Limpar estados anteriores
    setErrorMessage(null)
    hadErrorRef.current = false
    setAudioDetected(false)

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
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
        setPermissionStatus('granted')
        setErrorMessage(null)
      }

      // 3. Tratamento dos Eventos de Áudio: onaudiostart / onspeechstart
      recognition.onaudiostart = () => {
        setAudioDetected(true)
      }
      recognition.onspeechstart = () => {
        setAudioDetected(true)
      }

      // onresult: captura resultados parciais e finais em tempo real e exibe na tela
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('')
        latestTranscriptRef.current = transcript
        setTextoFalado(transcript)
      }

      // onerror: tratamento amigável sem fechar o diálogo
      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition onerror:', event.error)
        hadErrorRef.current = true
        setIsListening(false)
        setAudioDetected(false)

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

      // onend: se houve texto capturado, envia para o parser e segue confirmação;
      // se não houve texto e não houve erro, volta ao estado inicial pronto para ouvir de novo (sem fechar)
      recognition.onend = () => {
        setIsListening(false)
        setAudioDetected(false)
        recognitionRef.current = null

        const finalCapturado = latestTranscriptRef.current.trim()
        if (finalCapturado && !hadErrorRef.current) {
          const parsed = parseVoiceInput(finalCapturado, categories)
          setParsedResult(parsed)
        }
      }

      recognitionRef.current = recognition
      // Disparo imediato e síncrono
      recognition.start()
      setIsListening(true)
    } catch (err: any) {
      console.warn('Erro síncrono ao iniciar SpeechRecognition:', err)
      setIsListening(false)
      setAudioDetected(false)
      setErrorMessage(
        'Não foi possível ativar o microfone. Você pode digitar abaixo e processar com IA.',
      )
    }
  }, [categories])

  // Resetar ao abrir/fechar o modal
  useEffect(() => {
    if (open) {
      setTextoFalado('')
      latestTranscriptRef.current = ''
      setParsedResult(null)
      setErrorMessage(null)
      hadErrorRef.current = false
      setAudioDetected(false)
      setSelectedMemberId(currentMember?.id || members[0]?.id || '')
      setPermissionStatus('idle')

      // Iniciar escuta síncrona imediatamente ao abrir o diálogo
      startRecording()
    } else {
      stopListening()
      setPermissionStatus('idle')
    }

    return () => {
      stopListening()
    }
  }, [open, currentMember?.id, members, startRecording, stopListening])

  // Submeter modo texto manual
  const handleManualTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!textoFalado.trim()) return
    handleStopAndProcess(textoFalado.trim())
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

  const currentDisplaySpeech = textoFalado.trim()

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
                    onClick={startRecording}
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
                        Gravando som detectado...
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ouvindo... fale agora
                      </>
                    )
                  ) : (
                    'Microfone pronto — toque para falar'
                  )}
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
                    Exemplo: &ldquo;Almoço 45 reais no débito&rdquo; ou &ldquo;Cerveja na mercearia
                    60&rdquo;
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
                        onClick={startRecording}
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

            {/* 4. FALLBACK DE DIGITAÇÃO FLUIDO:
                Mantenha a caixinha de texto logo abaixo preenchida com o que foi reconhecido
                (ou vazia para digitação rápida), permitindo que o usuário aperte "Processar com IA" */}
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
                  setTextoFalado('')
                  startRecording()
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
