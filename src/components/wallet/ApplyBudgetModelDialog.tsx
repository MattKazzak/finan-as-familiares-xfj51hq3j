import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Family, TransactionCategory } from '@/types/finance'
import {
  BUDGET_PRESETS,
  BudgetPreset,
  BUCKET_METADATA,
  matchCategoryToPresetKey,
} from '@/types/budget-presets'
import { applyBudgetPreset } from '@/services/budget-model'
import { formatBRL, parseBRLToCents } from '@/lib/formatters'
import {
  Sparkles,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Info,
  RotateCcw,
  GraduationCap,
} from 'lucide-react'

interface ApplyBudgetModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  family: Family | null
  categories: TransactionCategory[]
  onSuccess?: () => void
}

export function ApplyBudgetModelDialog({
  open,
  onOpenChange,
  family,
  categories,
  onSuccess,
}: ApplyBudgetModelDialogProps) {
  const { toast } = useToast()

  // Fluxo em 3 etapas:
  // 1: Confirmar renda líquida
  // 2: Escolher perfil/preset
  // 3: Conferir & Aplicar (com inputs editáveis por categoria)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('50_30_20')
  const [incomeInput, setIncomeInput] = useState<string>('')
  const [isApplying, setIsApplying] = useState(false)

  // Valores customizados editados pelo usuário no Passo 3: Record<categoryId, string (formatada)>
  const [categoryAmountsInput, setCategoryAmountsInput] = useState<Record<string, string>>({})

  // Inicializa a renda a partir da família
  useEffect(() => {
    if (family?.monthly_net_income_cents) {
      setIncomeInput((family.monthly_net_income_cents / 100).toFixed(2).replace('.', ','))
    }
  }, [family])

  const parsedNetIncomeCents = useMemo(() => {
    return parseBRLToCents(incomeInput)
  }, [incomeInput])

  const selectedPreset: BudgetPreset | undefined = useMemo(() => {
    const list = Array.isArray(BUDGET_PRESETS)
      ? (BUDGET_PRESETS as BudgetPreset[])
      : Object.values(BUDGET_PRESETS as Record<string, BudgetPreset>)
    return list.find((p) => p.id === selectedPresetId)
  }, [selectedPresetId])

  // Apenas categorias de despesa são orçadas
  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'expense')
  }, [categories])

  // Itens mapeados do preset para as categorias da família
  const mappedCategories = useMemo(() => {
    if (!selectedPreset) return []
    return expenseCategories.map((cat) => {
      const matchedKey = matchCategoryToPresetKey(cat.name)
      const presetItem = selectedPreset.categories.find((p) => p.matchKey === matchedKey)
      const defaultPercent = presetItem?.percent || 0
      const defaultAmountCents = Math.round((parsedNetIncomeCents * defaultPercent) / 100)
      const bucket = presetItem?.bucket || cat.budget_bucket || 'lifestyle'

      return {
        category: cat,
        matched: !!presetItem,
        presetItem,
        defaultPercent,
        defaultAmountCents,
        bucket,
      }
    })
  }, [expenseCategories, selectedPreset, parsedNetIncomeCents])

  // Ao entrar no Passo 3 ou trocar preset/renda, pré-preenche os inputs de valor com o preset
  useEffect(() => {
    if (step === 3 && mappedCategories.length > 0) {
      setCategoryAmountsInput((prev) => {
        const initialMap: Record<string, string> = {}
        mappedCategories.forEach((item) => {
          const currentInput = prev[item.category.id]
          if (currentInput === undefined) {
            const reais = (item.defaultAmountCents / 100).toFixed(2).replace('.', ',')
            initialMap[item.category.id] = reais
          } else {
            initialMap[item.category.id] = currentInput
          }
        })
        return initialMap
      })
    }
  }, [step, mappedCategories])

  // Resetar inputs para valores originais do preset
  const handleResetToPreset = () => {
    const resetMap: Record<string, string> = {}
    mappedCategories.forEach((item) => {
      resetMap[item.category.id] = (item.defaultAmountCents / 100).toFixed(2).replace('.', ',')
    })
    setCategoryAmountsInput(resetMap)
  }

  // Cálculos dinâmicos em tempo real no Passo 3
  const step3Summary = useMemo(() => {
    let totalCustomBudgetCents = 0
    const amountsByCatId: Record<string, number> = {}

    mappedCategories.forEach((item) => {
      const rawInput = categoryAmountsInput[item.category.id]
      const cents = rawInput !== undefined ? parseBRLToCents(rawInput) : item.defaultAmountCents
      amountsByCatId[item.category.id] = cents
      totalCustomBudgetCents += cents
    })

    const rawPercent =
      parsedNetIncomeCents > 0 ? (totalCustomBudgetCents / parsedNetIncomeCents) * 100 : 0
    // Formatação amigável do percentual (arredondado ou com 1 casa se decimal)
    const percentOfIncome = rawPercent % 1 === 0 ? rawPercent : Math.round(rawPercent * 10) / 10
    const isOver100 = rawPercent > 100
    const diffCents = totalCustomBudgetCents - parsedNetIncomeCents

    return {
      totalCustomBudgetCents,
      amountsByCatId,
      percentOfIncome,
      isOver100,
      diffCents,
    }
  }, [mappedCategories, categoryAmountsInput, parsedNetIncomeCents])

  const handleApply = async () => {
    if (!family) return
    if (parsedNetIncomeCents <= 0) {
      toast({
        title: 'Renda inválida',
        description: 'Informe uma renda líquida mensal maior que zero.',
        variant: 'destructive',
      })
      setStep(1)
      return
    }

    try {
      setIsApplying(true)
      const res = await applyBudgetPreset(
        family.id,
        selectedPresetId,
        categories,
        parsedNetIncomeCents,
        step3Summary.amountsByCatId,
      )

      toast({
        title: 'Modelo aplicado com sucesso! 🎉',
        description: `${res.appliedCount} tetos de categorias foram personalizados e atualizados.`,
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao aplicar modelo',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsApplying(false)
    }
  }

  const handleNext = () => {
    if (step === 1) {
      if (parsedNetIncomeCents <= 0) {
        toast({
          title: 'Informe a renda',
          description: 'A renda líquida é necessária para calcular a sugestão de tetos.',
          variant: 'destructive',
        })
        return
      }
      setStep(2)
    } else if (step === 2) {
      // Ao avançar para o passo 3, inicializa os inputs de valores
      const initialMap: Record<string, string> = {}
      mappedCategories.forEach((item) => {
        initialMap[item.category.id] = (item.defaultAmountCents / 100).toFixed(2).replace('.', ',')
      })
      setCategoryAmountsInput(initialMap)
      setStep(3)
    }
  }

  const handleBack = () => {
    if (step === 2) setStep(1)
    if (step === 3) setStep(2)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[95vw] rounded-3xl p-5 sm:p-7 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
              Assistente de Orçamento
            </span>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900">
            {step === 1 && 'Passo 1: Qual é a renda líquida mensal?'}
            {step === 2 && 'Passo 2: Escolha o perfil da sua família'}
            {step === 3 && 'Passo 3: Conferir & Aplicar'}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-slate-500">
            {step === 1 &&
              'Base sobre a qual os tetos sugeridos serão distribuídos. Você poderá personalizar tudo a qualquer momento.'}
            {step === 2 &&
              'Selecione o modelo que melhor reflete o momento atual. Ele servirá de ponto de partida editável.'}
            {step === 3 &&
              'Altere livremente os valores em R$ de qualquer categoria antes de salvar. Nada é engessado.'}
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de passos */}
        <div className="flex items-center gap-2 my-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-all ${
                step >= s ? 'bg-brand-amber' : 'bg-brand-gray'
              }`}
            />
          ))}
        </div>

        {/* CONTEÚDO PASSO 1: RENDA */}
        {step === 1 && (
          <div className="space-y-4 py-3">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-3">
              <Label htmlFor="net-income-input" className="text-xs font-bold text-slate-800">
                Renda Líquida Familiar Mensal (R$)
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  R$
                </span>
                <Input
                  id="net-income-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  className="pl-11 text-lg font-bold tabular-nums bg-white h-12 rounded-2xl"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Soma de salários líquidos, pró-labores, rendimentos e receitas fixas regulares da
                casa.
              </p>
            </div>

            <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-2xl flex items-start gap-2.5">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <p className="text-xs text-sky-900 leading-snug">
                Você pode editar o teto de qualquer categoria individualmente em R$ no próximo
                passo. Os modelos são apenas referências financeiras para economizar seu tempo.
              </p>
            </div>
          </div>
        )}

        {/* CONTEÚDO PASSO 2: ESCOLHER MODELO */}
        {step === 2 && (
          <div className="space-y-3 py-2">
            {(Array.isArray(BUDGET_PRESETS)
              ? (BUDGET_PRESETS as BudgetPreset[])
              : Object.values(BUDGET_PRESETS as Record<string, BudgetPreset>)
            ).map((preset: BudgetPreset) => {
              const isSelected = selectedPresetId === preset.id
              return (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900">{preset.name}</h4>
                        {preset.badgeText && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {preset.badgeText}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-snug">
                        {preset.shortDescription}
                      </p>
                      {preset.sourceCaption && (
                        <div className="flex items-start gap-1.5 mt-2 pt-1.5 text-[11px] text-slate-500 italic leading-snug border-t border-slate-100/80">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 not-italic" />
                          <span>{preset.sourceCaption}</span>
                        </div>
                      )}
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'border-brand-amber bg-brand-amber text-brand'
                          : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  {/* Distribuição visual dos 3 Baldes */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                    <div className="bg-sky-50/80 rounded-xl p-2 border border-sky-100">
                      <span className="text-[10px] uppercase font-bold text-sky-800 block">
                        Essenciais
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-sky-900">
                        {preset.bucketDistribution.essentials}%
                      </span>
                    </div>
                    <div className="bg-amber-50/80 rounded-xl p-2 border border-amber-100">
                      <span className="text-[10px] uppercase font-bold text-amber-800 block">
                        Estilo de Vida
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-amber-900">
                        {preset.bucketDistribution.lifestyle}%
                      </span>
                    </div>
                    <div className="bg-emerald-50/80 rounded-xl p-2 border border-emerald-100">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                        Futuro & Metas
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-emerald-900">
                        {preset.bucketDistribution.future}%
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CONTEÚDO PASSO 3: CONFERIR & APLICAR (INPUTS DE MOEDA EDITÁVEIS EM R$) */}
        {step === 3 && selectedPreset && (
          <div className="space-y-4 py-2">
            {/* Banner Dinâmico em tempo real: Total orçado: R$ X de R$ Y (Z% da renda) + alerta sutil se Z > 100% */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                step3Summary.isOver100
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  {step3Summary.isOver100 ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold leading-tight">
                      Total orçado: {formatBRL(step3Summary.totalCustomBudgetCents)} de{' '}
                      {formatBRL(parsedNetIncomeCents)} ({step3Summary.percentOfIncome}% da renda)
                    </p>
                    {step3Summary.isOver100 ? (
                      <p className="text-[11px] text-amber-900 mt-1 leading-snug">
                        O total orçado ultrapassou 100% da renda líquida familiar. Você pode
                        continuar e aplicar assim mesmo, ou reequilibrar manualmente reduzindo
                        outras categorias abaixo antes de aplicar.
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-800 mt-0.5 leading-snug">
                        Orçamento dentro da renda líquida planejada. Saldo livre planejado:{' '}
                        <strong>
                          {formatBRL(parsedNetIncomeCents - step3Summary.totalCustomBudgetCents)}
                        </strong>
                        .
                      </p>
                    )}
                  </div>
                </div>

                {/* Botão para restaurar valores originais do preset */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToPreset}
                  className="text-[11px] h-7 px-2 text-slate-600 hover:text-slate-900 shrink-0 gap-1 rounded-lg"
                  title="Restaurar valores sugeridos pelo modelo"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Restaurar</span>
                </Button>
              </div>
            </div>

            {/* Lista de Categorias com Inputs de Moeda Editáveis em R$ */}
            <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
              {mappedCategories.map((item) => {
                const currentVal = categoryAmountsInput[item.category.id] ?? ''
                const currentCents = parseBRLToCents(currentVal)
                const dynamicPercent =
                  parsedNetIncomeCents > 0
                    ? Math.round((currentCents / parsedNetIncomeCents) * 1000) / 10
                    : 0

                return (
                  <div
                    key={item.category.id}
                    className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.category.color || '#64748B' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 break-words leading-tight">
                            {item.category.name}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none whitespace-nowrap ${
                              BUCKET_METADATA[item.bucket]?.bgLight || 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {BUCKET_METADATA[item.bucket]?.shortLabel}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Preset original: {item.defaultPercent}% (
                          {formatBRL(item.defaultAmountCents)})
                        </span>
                      </div>
                    </div>

                    {/* Input de Moeda Editável em R$ + badge com percentual recalculado dinamicamente */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-1.5 py-1 rounded-lg tabular-nums">
                        {dynamicPercent}% da renda
                      </span>
                      <div className="relative w-32 sm:w-36">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                          R$
                        </span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={currentVal}
                          onChange={(e) => {
                            const val = e.target.value
                            setCategoryAmountsInput((prev) => ({
                              ...prev,
                              [item.category.id]: val,
                            }))
                          }}
                          placeholder="0,00"
                          className="h-8 pl-8 pr-2 text-xs sm:text-sm font-bold tabular-nums text-right rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="text-[11px] text-slate-500 leading-snug">
              Ao aplicar, cada categoria terá seu teto padrão atualizado para o valor customizado
              digitado. Você também poderá alterá-los a qualquer momento no lápis de cada categoria
              na tela de Orçamento.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-slate-100">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={isApplying}
              className="rounded-xl text-xs gap-1.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </Button>
          )}

          {step < 3 ? (
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="bg-brand-amber hover:bg-[#e08e08] text-brand font-bold rounded-xl text-xs gap-1.5 border-0"
            >
              <span>Avançar</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={isApplying}
              className="bg-brand-amber hover:bg-[#e08e08] text-brand font-bold rounded-xl text-xs gap-1.5 shadow-sm border-0"
            >
              {isApplying ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Aplicando tetos...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Aplicar Orçamento</span>
                </span>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
