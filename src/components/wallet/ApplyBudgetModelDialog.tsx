import { useState, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { formatBRL, parseBRLToCents, formatNumberBRL } from '@/lib/formatters'
import {
  BUDGET_PRESETS,
  BUCKET_METADATA,
  matchCategoryToPresetKey,
  type BudgetPreset,
} from '@/types/budget-presets'
import type { Family, TransactionCategory } from '@/types/finance'
import { applyBudgetPreset } from '@/services/budget-model'
import { useToast } from '@/hooks/use-toast'
import {
  Check,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Info,
  ShieldCheck,
  Sliders,
  DollarSign,
  TrendingUp,
  PieChart,
} from 'lucide-react'

interface ApplyBudgetModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  family: Family | null
  categories: TransactionCategory[]
  onSuccess: () => void
  initialStep?: 1 | 2 | 3
}

export function ApplyBudgetModelDialog({
  open,
  onOpenChange,
  family,
  categories,
  onSuccess,
  initialStep = 1,
}: ApplyBudgetModelDialogProps) {
  const { toast } = useToast()

  const [step, setStep] = useState<1 | 2 | 3>(initialStep)
  const [incomeStr, setIncomeStr] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState<'equilibrado' | 'enxuto' | 'acelerador'>(
    'equilibrado',
  )
  const [isApplying, setIsApplying] = useState(false)

  useEffect(() => {
    if (open) {
      setStep(initialStep)
      const currentCents = family?.monthly_net_income_cents || 0
      setIncomeStr(currentCents > 0 ? formatNumberBRL(currentCents) : '')
    }
  }, [open, family, initialStep])

  const parsedIncomeCents = parseBRLToCents(incomeStr)
  const selectedPreset = BUDGET_PRESETS.find((p) => p.id === selectedPresetId) || BUDGET_PRESETS[0]

  // Mapeamento e simulação das categorias com valores em reais
  const categorySimulations = selectedPreset.categories.map((item) => {
    const matchedCategory = categories.find(
      (c) => c.type === 'expense' && matchCategoryToPresetKey(c.name) === item.key,
    )
    const amountCents =
      parsedIncomeCents > 0 ? Math.round((parsedIncomeCents * item.percent) / 100) : 0

    return {
      ...item,
      matchedCategory,
      amountCents,
    }
  })

  const totalCalculatedCents = categorySimulations.reduce((acc, c) => acc + c.amountCents, 0)
  const matchedCategoriesCount = categorySimulations.filter((c) => !!c.matchedCategory).length

  const handleNext = () => {
    if (step === 1) {
      if (parsedIncomeCents <= 0) {
        toast({
          title: 'Informe a renda líquida',
          description: 'Insira o valor mensal da renda líquida familiar para continuar.',
          variant: 'destructive',
        })
        return
      }
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  const handleBack = () => {
    if (step === 3) setStep(2)
    else if (step === 2) setStep(1)
  }

  const handleApply = async () => {
    if (!family) return
    if (parsedIncomeCents <= 0) {
      toast({
        title: 'Renda líquida necessária',
        description: 'Defina a renda líquida para calcular os valores em reais.',
        variant: 'destructive',
      })
      setStep(1)
      return
    }

    try {
      setIsApplying(true)
      const res = await applyBudgetPreset({
        familyId: family.id,
        presetId: selectedPresetId,
        monthlyNetIncomeCents: parsedIncomeCents,
        existingCategories: categories,
      })

      toast({
        title: 'Modelo aplicado com sucesso!',
        description: `Tetos calculados para ${res.updatedBudgetsCount} categorias. Seus ajustes pontuais dos meses foram preservados.`,
      })
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao aplicar modelo:', err)
      toast({
        title: 'Erro ao aplicar modelo',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[94vw] rounded-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800">
              <Sparkles className="w-4 h-4" />
            </span>
            <DialogTitle className="text-lg font-black text-slate-900">
              Modelo Orçamentário Inteligente
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Ajuste os tetos da sua família conforme os percentuais ideais da renda líquida
            recomendados por consultores financeiros.
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de Passos */}
        <div className="flex items-center justify-between py-2 border-y border-slate-100 my-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              1
            </span>
            <span
              className={`text-xs font-semibold ${step === 1 ? 'text-emerald-700' : 'text-slate-500'}`}
            >
              Renda Líquida
            </span>
          </div>

          <div className="h-0.5 w-6 bg-slate-200" />

          <div className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              2
            </span>
            <span
              className={`text-xs font-semibold ${step === 2 ? 'text-emerald-700' : 'text-slate-500'}`}
            >
              Perfil
            </span>
          </div>

          <div className="h-0.5 w-6 bg-slate-200" />

          <div className="flex items-center gap-1.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= 3 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              3
            </span>
            <span
              className={`text-xs font-semibold ${step === 3 ? 'text-emerald-700' : 'text-slate-500'}`}
            >
              Conferir & Aplicar
            </span>
          </div>
        </div>

        {/* PASSO 1: RENDA LÍQUIDA MENSAL DA FAMÍLIA */}
        {step === 1 && (
          <div className="space-y-4 py-2 animate-in fade-in-50 duration-150">
            <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-4 text-xs text-emerald-950 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Base única de cálculo: Renda Líquida</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Use a renda que <strong>efetivamente cai na conta</strong> da família (salários
                líquidos após descontos de INSS/IR, pró-labore líquido, rendimentos médios). Nunca
                use salário bruto.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="net-income-input" className="text-xs font-bold text-slate-800">
                Renda Líquida Mensal da Família (R$)
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  R$
                </span>
                <Input
                  id="net-income-input"
                  type="text"
                  placeholder="Ex.: 10.000,00"
                  value={incomeStr}
                  onChange={(e) => setIncomeStr(e.target.value)}
                  className="pl-10 text-base font-bold text-slate-900 rounded-2xl h-12"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Você poderá atualizar esse valor a qualquer momento no seu Perfil ou nesta aba.
              </p>
            </div>

            {parsedIncomeCents > 0 && (
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Renda líquida reconhecida:
                </span>
                <span className="text-sm font-extrabold text-emerald-700 tabular-nums">
                  {formatBRL(parsedIncomeCents)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* PASSO 2: ESCOLHA DO PERFIL (PRESET) */}
        {step === 2 && (
          <div className="space-y-3 py-2 animate-in fade-in-50 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Escolha o momento financeiro da família:
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Base: <strong className="text-emerald-700">{formatBRL(parsedIncomeCents)}</strong>
              </span>
            </div>

            <div className="space-y-2.5">
              {BUDGET_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all relative ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-600/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{preset.title}</h4>
                          {preset.id === 'equilibrado' && (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] font-bold border-0 px-2 py-0.5 rounded-full">
                              Recomendado
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                          {preset.subtitle}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                          {preset.description}
                        </p>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    {/* Barra de distribuição dos 3 baldes */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-sky-700">
                          <span className="w-2 h-2 rounded-full bg-sky-500" />
                          Essenciais {preset.bucketDistribution.essentials}%
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-amber-700">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          Estilo {preset.bucketDistribution.lifestyle}%
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Futuro {preset.bucketDistribution.future}%
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* PASSO 3: CONFERÊNCIA DOS VALORES EM REAIS */}
        {step === 3 && (
          <div className="space-y-4 py-2 animate-in fade-in-50 duration-150">
            {/* Resumo Tangível em Reais */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                <span>Perfil: {selectedPreset.title}</span>
                <span className="font-bold text-emerald-400">
                  Renda Líquida: {formatBRL(parsedIncomeCents)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700/80 text-center">
                <div className="bg-white/5 rounded-xl p-2">
                  <span className="text-[10px] text-sky-300 font-bold uppercase block">
                    Essenciais ({selectedPreset.bucketDistribution.essentials}%)
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-white mt-0.5 block tabular-nums">
                    {formatBRL(
                      Math.round(
                        (parsedIncomeCents * selectedPreset.bucketDistribution.essentials) / 100,
                      ),
                    )}
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-2">
                  <span className="text-[10px] text-amber-300 font-bold uppercase block">
                    Estilo ({selectedPreset.bucketDistribution.lifestyle}%)
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-white mt-0.5 block tabular-nums">
                    {formatBRL(
                      Math.round(
                        (parsedIncomeCents * selectedPreset.bucketDistribution.lifestyle) / 100,
                      ),
                    )}
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-2">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase block">
                    Futuro ({selectedPreset.bucketDistribution.future}%)
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-white mt-0.5 block tabular-nums">
                    {formatBRL(
                      Math.round(
                        (parsedIncomeCents * selectedPreset.bucketDistribution.future) / 100,
                      ),
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Aviso de Não Destruição / Preservação de Overrides */}
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-200/80 p-3 rounded-2xl text-[11px] text-slate-600">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p>
                  <strong>Seus dados e históricos estão seguros:</strong> O modelo atualiza apenas
                  os tetos padrão das categorias correspondentes (foram mapeadas{' '}
                  <strong>{matchedCategoriesCount}</strong> categorias existentes).
                </p>
                <p className="text-slate-500 mt-0.5">
                  Ajustes pontuais específicos de meses já cadastrados continuarão intactos. Depois
                  de aplicar, você pode customizar individualmente qualquer percentual ou valor em
                  reais.
                </p>
              </div>
            </div>

            {/* Lista detalhada por categoria */}
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Tetos Calculados em Reais por Categoria:
              </span>

              {categorySimulations.map((sim) => {
                const bMeta = BUCKET_METADATA[sim.bucket]
                return (
                  <div
                    key={sim.key}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {sim.matchedCategory ? sim.matchedCategory.name : sim.name}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${bMeta.bgLight}`}
                        >
                          {bMeta.shortLabel}
                        </span>
                        {!sim.matchedCategory && (
                          <span className="text-[9px] text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                            Será vinculada
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {sim.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-extrabold text-slate-900 block tabular-nums">
                        {formatBRL(sim.amountCents)}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                        {sim.percent}% da renda
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-slate-100">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={isApplying}
              className="rounded-xl text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Voltar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isApplying}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
          )}

          {step < 3 ? (
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold gap-1.5"
            >
              <span>Avançar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={isApplying}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5"
            >
              {isApplying ? (
                <span>Aplicando modelo...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Aplicar Tetos na Família</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
