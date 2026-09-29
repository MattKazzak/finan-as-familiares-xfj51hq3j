import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Family } from '@/types/finance'
import { formatBRL, parseBRLToCents } from '@/lib/formatters'
import { seedStandardizedCategoriesAndApplyPlan } from '@/services/onboarding'
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  SlidersHorizontal,
  Shield,
  Sun,
  Target,
  ArrowRight,
} from 'lucide-react'

export type BudgetModelId = '50_30_20' | '60_25_15' | '70_20_10'

interface BudgetModelOption {
  id: BudgetModelId
  name: string
  label: string
  description: string
  essentialsPct: number
  lifestylePct: number
  futurePct: number
}

const BUDGET_MODEL_OPTIONS: BudgetModelOption[] = [
  {
    id: '50_30_20',
    name: 'Padrão 50 / 30 / 20',
    label: 'Equilibrado',
    description: 'Equilíbrio clássico entre viver com qualidade hoje e construir patrimônio.',
    essentialsPct: 50,
    lifestylePct: 30,
    futurePct: 20,
  },
  {
    id: '60_25_15',
    name: 'Modelo 60 / 25 / 15',
    label: 'Custo Fixo Alto',
    description:
      'Ideal para quem mora em capitais, tem aluguel alto ou custos familiares elevados.',
    essentialsPct: 60,
    lifestylePct: 25,
    futurePct: 15,
  },
  {
    id: '70_20_10',
    name: 'Modelo 70 / 20 / 10',
    label: 'Organização & Começo',
    description: 'Focado em reorganização de dívidas e estabilização de contas essenciais.',
    essentialsPct: 70,
    lifestylePct: 20,
    futurePct: 10,
  },
]

interface OnboardingWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  family: Family | null
  onSuccess?: () => void
}

export function OnboardingWizardDialog({
  open,
  onOpenChange,
  family,
  onSuccess,
}: OnboardingWizardDialogProps) {
  const { toast } = useToast()

  // 2 Etapas Limpas:
  // 1: Renda Mensal Familiar
  // 2: Seu Orçamento em 3 Caixas (Resumo 50/30/20 com valores na hora + seletor alternativo + botão Concluir e Ativar meu Plano)
  const [step, setStep] = useState<1 | 2>(1)
  const [incomeInput, setIncomeInput] = useState<string>('')
  const [selectedModelId, setSelectedModelId] = useState<BudgetModelId>('50_30_20')
  const [showModelPicker, setShowModelPicker] = useState<boolean>(false)
  const [isActivating, setIsActivating] = useState(false)

  // Pré-preenche renda se já existir na família
  useEffect(() => {
    if (family?.monthly_net_income_cents && family.monthly_net_income_cents > 0) {
      const formatted = (family.monthly_net_income_cents / 100).toFixed(2).replace('.', ',')
      setIncomeInput(formatted)
    }
  }, [family])

  // Reseta estado quando o diálogo abre
  useEffect(() => {
    if (open) {
      setStep(1)
      setShowModelPicker(false)
      if (family?.monthly_net_income_cents && family.monthly_net_income_cents > 0) {
        setIncomeInput((family.monthly_net_income_cents / 100).toFixed(2).replace('.', ','))
      }
    }
  }, [open, family])

  const parsedNetIncomeCents = useMemo(() => {
    return parseBRLToCents(incomeInput)
  }, [incomeInput])

  const currentModel = useMemo(() => {
    return BUDGET_MODEL_OPTIONS.find((m) => m.id === selectedModelId) || BUDGET_MODEL_OPTIONS[0]
  }, [selectedModelId])

  // Valores calculados em tempo real para as 3 caixas
  const bucketAmounts = useMemo(() => {
    const essentials = Math.round((parsedNetIncomeCents * currentModel.essentialsPct) / 100)
    const lifestyle = Math.round((parsedNetIncomeCents * currentModel.lifestylePct) / 100)
    const future = Math.round((parsedNetIncomeCents * currentModel.futurePct) / 100)
    return {
      essentials,
      lifestyle,
      future,
    }
  }, [parsedNetIncomeCents, currentModel])

  const handleNextStep = () => {
    if (parsedNetIncomeCents <= 0) {
      toast({
        title: 'Informe a renda líquida',
        description: 'Digite o valor líquido mensal que entra na conta da família.',
        variant: 'destructive',
      })
      return
    }
    setStep(2)
  }

  const handleActivatePlan = async () => {
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
      setIsActivating(true)
      await seedStandardizedCategoriesAndApplyPlan({
        familyId: family.id,
        monthlyNetIncomeCents: parsedNetIncomeCents,
        modelPresetId: selectedModelId,
      })

      toast({
        title: 'Tudo pronto! 🎉',
        description: 'Seu planejamento familiar está ativo.',
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      console.error('Erro ao ativar onboarding:', err)
      toast({
        title: 'Erro ao configurar plano',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg rounded-3xl p-4 sm:p-7 bg-white border border-slate-200/80 shadow-2xl max-h-[92vh] overflow-x-hidden overflow-y-auto"
        onInteractOutside={(e) => {
          // Mantém modal acolhedor focado até o usuário concluir ou clicar em fechar
          e.preventDefault()
        }}
      >
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
              Boas-vindas ao Curiangoo
            </span>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {step === 1 ? 'Renda Mensal Familiar' : 'Seu Orçamento em 3 Caixas'}
          </DialogTitle>

          <DialogDescription className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            {step === 1
              ? 'Quanto entra líquido na conta da família por mês?'
              : 'Separamos seu dinheiro em 3 caixas inteligentes para equilibrar o mês sem esforço.'}
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de progresso limpo */}
        <div className="flex items-center gap-2 my-2">
          <div
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              step >= 1 ? 'bg-emerald-600' : 'bg-slate-200'
            }`}
          />
          <div
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              step >= 2 ? 'bg-emerald-600' : 'bg-slate-200'
            }`}
          />
        </div>

        {/* ETAPA 1: RENDA MENSAL FAMILIAR */}
        {step === 1 && (
          <div className="space-y-5 py-2">
            <div className="p-5 sm:p-6 bg-gradient-to-b from-slate-50/90 to-slate-100/50 rounded-3xl border border-slate-200/80 text-center space-y-4">
              <label
                htmlFor="onboarding-income-input"
                className="block text-xs font-semibold text-slate-600 uppercase tracking-wide cursor-pointer"
              >
                Renda Líquida Total dos Membros
              </label>

              <div className="relative max-w-xs mx-auto">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-xl sm:text-2xl select-none">
                  R$
                </span>
                <Input
                  id="onboarding-income-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && parsedNetIncomeCents > 0) {
                      handleNextStep()
                    }
                  }}
                  autoFocus
                  className="pl-14 pr-4 h-16 text-2xl sm:text-3xl font-black tabular-nums bg-white border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20 text-slate-900 rounded-2xl shadow-xs"
                />
              </div>

              <p className="text-[11px] sm:text-xs text-slate-500 leading-snug">
                Soma dos salários líquidos, pró-labores e rendas fixas de quem mora junto.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={parsedNetIncomeCents <= 0}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm sm:text-base rounded-2xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all"
              >
                <span>Continuar para as 3 Caixas</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 2: SEU ORÇAMENTO EM 3 CAIXAS */}
        {step === 2 && (
          <div className="space-y-4 py-1">
            <div className="text-center px-1">
              <p className="text-xs text-slate-500">
                Baseado na sua renda de{' '}
                <strong className="text-slate-800 font-bold">
                  {formatBRL(parsedNetIncomeCents)}
                </strong>
                , seu plano de referência é o{' '}
                <strong className="text-emerald-700">{currentModel.name}</strong>:
              </p>
            </div>

            {/* As 3 Caixas Visuais em Destaque */}
            <div className="space-y-2.5">
              {/* Caixa 1: Necessidades (50%) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-sky-50/80 border border-sky-200/90 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-sky-950">🛡️ Necessidades</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-200/70 text-sky-800">
                        {currentModel.essentialsPct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-700/90 truncate mt-0.5">
                      Moradia, alimentação, transporte, saúde e contas
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base sm:text-lg font-black text-sky-950 tabular-nums block">
                    {formatBRL(bucketAmounts.essentials)}
                  </span>
                  <span className="text-[10px] text-sky-600 block">teto planejado</span>
                </div>
              </div>

              {/* Caixa 2: Estilo de Vida (30%) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-amber-950">🏖️ Estilo de Vida</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-800">
                        {currentModel.lifestylePct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-700/90 truncate mt-0.5">
                      Lazer, restaurantes, compras, assinaturas e pets
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base sm:text-lg font-black text-amber-950 tabular-nums block">
                    {formatBRL(bucketAmounts.lifestyle)}
                  </span>
                  <span className="text-[10px] text-amber-600 block">teto planejado</span>
                </div>
              </div>

              {/* Caixa 3: Futuro & Metas (20%) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Target className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-emerald-950">🎯 Futuro & Metas</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-800">
                        {currentModel.futurePct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700/90 truncate mt-0.5">
                      Reserva de emergência, investimentos e sonhos
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base sm:text-lg font-black text-emerald-950 tabular-nums block">
                    {formatBRL(bucketAmounts.future)}
                  </span>
                  <span className="text-[10px] text-emerald-600 block">teto planejado</span>
                </div>
              </div>
            </div>

            {/* Link sutil para alternar modelo */}
            <div className="pt-1 text-center">
              {!showModelPicker ? (
                <button
                  type="button"
                  onClick={() => setShowModelPicker(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700 transition-colors font-medium underline underline-offset-4 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Prefere outro modelo?</span>
                </button>
              ) : (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-left animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Selecione o modelo orçamentário:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowModelPicker(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {BUDGET_MODEL_OPTIONS.map((opt) => {
                      const isSelected = selectedModelId === opt.id
                      return (
                        <div
                          key={opt.id}
                          onClick={() => {
                            setSelectedModelId(opt.id)
                            setShowModelPicker(false)
                          }}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-emerald-50/80 border-emerald-500 font-semibold text-emerald-950'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{opt.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                                {opt.label}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {opt.description}
                            </span>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Ações da Etapa 2 */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={isActivating}
                className="w-full sm:w-auto rounded-2xl text-xs gap-1.5 h-11 text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Alterar Renda</span>
              </Button>

              {/* Botão principal de ativação */}
              <Button
                type="button"
                onClick={handleActivatePlan}
                disabled={isActivating}
                className="w-full flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm sm:text-base rounded-2xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isActivating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Criando categorias e ativando...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Concluir e Ativar meu Plano</span>
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
