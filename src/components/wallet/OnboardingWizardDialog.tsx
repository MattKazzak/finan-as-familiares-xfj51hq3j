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
import { formatBRL, parseBRLToCents, normalizeFamilyName } from '@/lib/formatters'
import { seedStandardizedCategoriesAndApplyPlan } from '@/services/onboarding'
import { updateFamilyDetails, activateFamilyOnboardingPlanRpc } from '@/services/family'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useFamily } from '@/hooks/use-family'
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  SlidersHorizontal,
  Shield,
  SunMedium,
  Target,
  ArrowRight,
  Home,
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
  const { user } = useAuth()
  const { members, triggerRefresh, updateFamily } = useFamily()

  // 3 Etapas Limpas:
  // 1: Vamos criar o espaço da sua família (Nome da família pré-preenchido com "Família {primeiro nome}", editável)
  // 2: Renda Mensal Familiar (Renda Líquida Total dos Membros)
  // 3: Seu Orçamento em 3 Caixas (Resumo 50/30/20 + alternativo + Concluir e Ativar meu Plano)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [familyNameInput, setFamilyNameInput] = useState<string>('')
  const [incomeInput, setIncomeInput] = useState<string>('')
  const [selectedModelId, setSelectedModelId] = useState<BudgetModelId>(() => {
    const existing = family?.budget_model
    if (existing === '50_30_20' || existing === '60_25_15' || existing === '70_20_10') {
      return existing
    }
    return '50_30_20'
  })
  const [showModelPicker, setShowModelPicker] = useState<boolean>(false)
  const [isActivating, setIsActivating] = useState(false)

  // Calcula a sugestão automática "Família {primeiro nome}"
  // Extrai o primeiro nome de user.user_metadata?.name ou do membro admin
  const computeSuggestedFamilyName = (): string => {
    // 1. Tenta pegar primeiro nome de user.user_metadata?.name
    const rawUserName = (user?.user_metadata?.name as string)?.trim()
    if (rawUserName) {
      const firstName = rawUserName.split(/\s+/)[0]
      if (firstName) {
        return `Família ${firstName}`
      }
    }

    // 2. Tenta pegar primeiro nome do membro admin
    const adminMember = members.find((m) => m.is_admin) || members[0]
    if (adminMember?.name) {
      const firstName = adminMember.name.trim().split(/\s+/)[0]
      if (firstName) {
        return `Família ${firstName}`
      }
    }

    // 3. Fallback do e-mail do usuário se existir
    if (user?.email) {
      const emailPrefix = user.email.split('@')[0]
      const capitalized = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
      if (capitalized) {
        return `Família ${capitalized}`
      }
    }

    // Se nenhum metadado ou identificador estiver disponível, mantém input vazio
    return ''
  }

  // Pré-preenche o nome da família e renda ao abrir o diálogo
  useEffect(() => {
    if (open) {
      setStep(1)
      setShowModelPicker(false)

      // Se a família tiver nome gravado e não for o padrão temporário 'Minha Família', usa ele;
      // Caso contrário, calcula a sugestão automática "Família {primeiro nome}"
      const currentName = family?.name?.trim()
      if (currentName && currentName !== 'Minha Família' && currentName !== '') {
        // Se já não começar com "Família", mantém ou formata
        setFamilyNameInput(currentName)
      } else {
        setFamilyNameInput(computeSuggestedFamilyName())
      }

      if (family?.monthly_net_income_cents && family.monthly_net_income_cents > 0) {
        setIncomeInput((family.monthly_net_income_cents / 100).toFixed(2).replace('.', ','))
      }

      // Hidrata o modelo orçamentário do family.budget_model quando válido
      const existingModel = family?.budget_model
      if (
        existingModel === '50_30_20' ||
        existingModel === '60_25_15' ||
        existingModel === '70_20_10'
      ) {
        setSelectedModelId(existingModel)
      } else {
        setSelectedModelId('50_30_20')
      }
    }
  }, [open, family?.id, family?.budget_model, family?.monthly_net_income_cents, user?.id, members])

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

  const handleNextFromStep1 = () => {
    const trimmed = familyNameInput.trim()
    if (!trimmed) {
      toast({
        title: 'Nome da família obrigatório',
        description: 'Digite um nome para o espaço da sua família.',
        variant: 'destructive',
      })
      return
    }
    setStep(2)
  }

  const handleNextFromStep2 = () => {
    if (parsedNetIncomeCents <= 0) {
      toast({
        title: 'Informe a renda líquida',
        description: 'Digite o valor líquido mensal que entra na conta da família.',
        variant: 'destructive',
      })
      return
    }
    setStep(3)
  }

  const handleActivatePlan = async () => {
    if (!family) return
    const trimmedName = familyNameInput.trim()
    if (!trimmedName) {
      toast({
        title: 'Nome da família obrigatório',
        description: 'Defina o nome da família antes de concluir.',
        variant: 'destructive',
      })
      setStep(1)
      return
    }

    if (parsedNetIncomeCents <= 0) {
      toast({
        title: 'Renda inválida',
        description: 'Informe uma renda líquida mensal maior que zero.',
        variant: 'destructive',
      })
      setStep(2)
      return
    }

    try {
      setIsActivating(true)

      // Captura o modelo selecionado de forma imutável para esta operação (evita race condition)
      const confirmedModelId: BudgetModelId =
        selectedModelId === '60_25_15' || selectedModelId === '70_20_10'
          ? selectedModelId
          : '50_30_20'

      const normalizedName = normalizeFamilyName(trimmedName)

      // Persistência ATÔMICA: atualiza APENAS o nome da família aqui.
      // A gravação de budget_model e monthly_net_income_cents é delegada exclusivamente
      // à RPC activate_family_onboarding_plan via seedStandardizedCategoriesAndApplyPlan.
      try {
        if (updateFamily) {
          await updateFamily({
            name: normalizedName,
          })
        } else {
          await updateFamilyDetails(family.id, {
            name: normalizedName,
          })
        }
      } catch (famErr) {
        console.warn(
          'Erro ao atualizar nome da família no onboarding, tentando updateFamilyDetails direto:',
          famErr,
        )
        await updateFamilyDetails(family.id, {
          name: normalizedName,
        })
      }

      // Executa a ativação com RPC atômica (grava budget_model, monthly_net_income_cents e categorias)
      await seedStandardizedCategoriesAndApplyPlan({
        familyId: family.id,
        monthlyNetIncomeCents: parsedNetIncomeCents,
        modelPresetId: confirmedModelId,
      })

      // Guarda de completude: verifica se a família possui o catálogo 19/116 e regras completas
      try {
        const [{ count: catCount }, { count: subCount }, { count: rulesCount }] = await Promise.all(
          [
            (supabase as any)
              .from('transaction_categories')
              .select('id', { count: 'exact', head: true })
              .eq('family_id', family.id),
            (supabase as any)
              .from('transaction_subcategories')
              .select('id', { count: 'exact', head: true })
              .eq('family_id', family.id),
            (supabase as any)
              .from('categorization_rules')
              .select('id', { count: 'exact', head: true })
              .eq('family_id', family.id),
          ],
        )

        const totalCats = catCount ?? 0
        const totalSubs = subCount ?? 0
        const totalRules = rulesCount ?? 0

        if (totalCats !== 19 || totalSubs !== 116 || totalRules < 40) {
          console.warn(
            `[onboarding] Guarda de completude acionada: catálogo parcial detectado (${totalCats}/19 categorias, ${totalSubs}/116 subs, ${totalRules} regras). Re-executando activate_family_onboarding_plan...`,
          )
          await activateFamilyOnboardingPlanRpc({
            familyId: family.id,
            monthlyNetIncomeCents: parsedNetIncomeCents,
            modelPresetId: confirmedModelId,
          })
        }
      } catch (guardErr) {
        console.warn('[onboarding] Falha não impeditiva na guarda de completude:', guardErr)
      }

      triggerRefresh?.()

      toast({
        title: 'Tudo pronto! 🎉',
        description: `Espaço da ${normalizedName} configurado com sucesso.`,
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      console.error('Erro ao ativar onboarding:', err)
      toast({
        title: 'Não foi possível ativar seu plano',
        description:
          err?.message ||
          'Ocorreu um erro ao configurar o orçamento da sua família. Por favor, tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg rounded-3xl p-4 sm:p-7 bg-white border border-slate-200/80 shadow-2xl max-h-[92vh] overflow-x-hidden overflow-y-auto box-border min-w-0"
        onInteractOutside={(e) => {
          // Mantém modal acolhedor focado até o usuário concluir ou clicar em fechar
          e.preventDefault()
        }}
      >
        <DialogHeader className="space-y-2 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
              Boas-vindas ao Curiangoo
            </span>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight break-words min-w-0">
            {step === 1 && 'Vamos criar o espaço da sua família'}
            {step === 2 && 'Renda Mensal Familiar'}
            {step === 3 && 'Seu Orçamento em 3 Caixas'}
          </DialogTitle>

          <DialogDescription className="text-xs sm:text-sm text-slate-500 leading-relaxed break-words min-w-0">
            {step === 1 && 'Dê um nome afetuoso ou sobrenome para o workspace de vocês.'}
            {step === 2 && 'Quanto entra líquido na conta da família por mês?'}
            {step === 3 &&
              'Separamos seu dinheiro em 3 caixas inteligentes para equilibrar o mês sem esforço.'}
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de progresso em 3 etapas limpas */}
        <div className="flex items-center gap-2 my-2 w-full min-w-0">
          <div
            className={`h-1.5 flex-1 min-w-0 rounded-full transition-all duration-300 ${
              step >= 1 ? 'bg-brand-amber' : 'bg-brand-gray'
            }`}
          />
          <div
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              step >= 2 ? 'bg-brand-amber' : 'bg-brand-gray'
            }`}
          />
          <div
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              step >= 3 ? 'bg-brand-amber' : 'bg-brand-gray'
            }`}
          />{' '}
        </div>

        {/* ETAPA 1: VAMOS CRIAR O ESPAÇO DA SUA FAMÍLIA (NOME DA FAMÍLIA) */}
        {step === 1 && (
          <div className="space-y-5 py-2 w-full min-w-0">
            <div className="p-5 sm:p-6 bg-gradient-to-b from-slate-50/90 to-slate-100/50 rounded-3xl border border-slate-200/80 text-center space-y-4 min-w-0">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Home className="w-6 h-6" />
              </div>

              <div>
                <label
                  htmlFor="onboarding-family-name-input"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wide cursor-pointer break-words"
                >
                  Nome da família
                </label>
                <p className="text-[11px] text-slate-500 mt-1">
                  Sugerimos um nome automático com base no seu cadastro, mas você pode editar
                  livremente:
                </p>
              </div>

              <div className="relative max-w-sm mx-auto w-full min-w-0">
                <Input
                  id="onboarding-family-name-input"
                  type="text"
                  placeholder="Ex.: Família Santos ou Família Matheus"
                  value={familyNameInput}
                  onChange={(e) => setFamilyNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && familyNameInput.trim()) {
                      handleNextFromStep1()
                    }
                  }}
                  autoFocus
                  className="h-14 px-4 text-center text-lg sm:text-xl font-bold bg-white border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20 text-slate-900 rounded-2xl shadow-xs"
                />
              </div>

              <p className="text-[11px] sm:text-xs text-slate-400 leading-snug break-words">
                Você também poderá trocar esse nome a qualquer momento na página de Perfil.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2 w-full min-w-0">
              <Button
                type="button"
                onClick={handleNextFromStep1}
                disabled={!familyNameInput.trim()}
                className="w-full h-12 bg-brand-amber hover:bg-[#e08e08] text-brand font-bold text-sm sm:text-base rounded-2xl shadow-md shadow-black/10 flex items-center justify-center gap-2 transition-all cursor-pointer border-0"
              >
                <span>Continuar para a Renda</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 2: RENDA MENSAL FAMILIAR */}
        {step === 2 && (
          <div className="space-y-5 py-2 w-full min-w-0">
            <div className="p-5 sm:p-6 bg-gradient-to-b from-slate-50/90 to-slate-100/50 rounded-3xl border border-slate-200/80 text-center space-y-4 min-w-0">
              <label
                htmlFor="onboarding-income-input"
                className="block text-xs font-semibold text-slate-600 uppercase tracking-wide cursor-pointer break-words"
              >
                Renda Líquida Total dos Membros
              </label>

              <div className="relative max-w-xs mx-auto w-full min-w-0">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xl sm:text-2xl select-none">
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
                      handleNextFromStep2()
                    }
                  }}
                  autoFocus
                  className="pl-14 pr-4 h-16 text-2xl sm:text-3xl font-semibold tabular-nums bg-white border-slate-300 focus:border-emerald-600 focus:ring-emerald-500/20 text-slate-900 rounded-2xl shadow-xs"
                />
              </div>

              <p className="text-[11px] sm:text-xs text-slate-500 leading-snug break-words">
                Soma dos salários líquidos, pró-labores e rendas fixas de quem mora junto.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 w-full min-w-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="w-full sm:w-auto rounded-2xl text-xs gap-1.5 h-11 text-slate-600 border-slate-200 hover:bg-slate-50 shrink-0"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Voltar</span>
              </Button>

              <Button
                type="button"
                onClick={handleNextFromStep2}
                disabled={parsedNetIncomeCents <= 0}
                className="w-full flex-1 h-12 bg-brand-amber hover:bg-[#e08e08] text-brand font-bold text-sm sm:text-base rounded-2xl shadow-md shadow-black/10 flex items-center justify-center gap-2 transition-all cursor-pointer border-0"
              >
                <span>Continuar para as 3 Caixas</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 3: SEU ORÇAMENTO EM 3 CAIXAS */}
        {step === 3 && (
          <div className="space-y-4 py-1 w-full min-w-0">
            <div className="text-center px-1 min-w-0">
              <p className="text-xs text-slate-500 break-words">
                Baseado na sua renda de{' '}
                <strong className="text-slate-800 font-bold whitespace-nowrap">
                  {formatBRL(parsedNetIncomeCents)}
                </strong>
                , seu plano de referência é o{' '}
                <strong className="text-emerald-700">{currentModel.name}</strong>:
              </p>
            </div>

            {/* As 3 Caixas Visuais em Destaque */}
            <div className="space-y-3 w-full min-w-0">
              {/* Caixa 1: Necessidades (50%) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-sky-50/80 border border-sky-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs min-w-0 transition-all">
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-buckets-essentials text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 sm:mt-0">
                    <Shield className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="font-bold text-sm text-sky-950 break-words flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-buckets-essentials" strokeWidth={1.5} />
                        <span>Necessidades</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-200/70 text-sky-800 shrink-0">
                        {currentModel.essentialsPct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-700/90 break-words leading-relaxed mt-0.5">
                      Moradia, alimentação, transporte, saúde e contas
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0 pl-13 sm:pl-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-sky-200/60 flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-x-2">
                  <span className="text-base sm:text-lg md:text-xl font-semibold text-sky-950 tabular-nums break-words">
                    {formatBRL(bucketAmounts.essentials)}
                  </span>
                  <span className="text-[10px] font-medium text-sky-600 shrink-0">
                    teto planejado
                  </span>
                </div>
              </div>

              {/* Caixa 2: Estilo de Vida (30%) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs min-w-0 transition-all">
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-buckets-lifestyle text-brand flex items-center justify-center shrink-0 shadow-sm mt-0.5 sm:mt-0">
                    <SunMedium className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="font-bold text-sm text-amber-950 break-words flex items-center gap-1.5">
                        <SunMedium className="w-4 h-4 text-buckets-lifestyle" strokeWidth={1.5} />
                        <span>Estilo de Vida</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-800 shrink-0">
                        {currentModel.lifestylePct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-700/90 break-words leading-relaxed mt-0.5">
                      Lazer, restaurantes, compras, assinaturas e pets
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0 pl-13 sm:pl-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-amber-200/60 flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-x-2">
                  <span className="text-base sm:text-lg md:text-xl font-semibold text-amber-950 tabular-nums break-words">
                    {formatBRL(bucketAmounts.lifestyle)}
                  </span>
                  <span className="text-[10px] font-medium text-amber-600 shrink-0">
                    teto planejado
                  </span>
                </div>
              </div>

              {/* Caixa 3: Futuro & Metas (20%) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs min-w-0 transition-all">
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-buckets-goals text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 sm:mt-0">
                    <Target className="w-5 h-5" strokeWidth={1.5} />
                  </div>{' '}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="font-bold text-sm text-emerald-950 break-words flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-buckets-goals" strokeWidth={1.5} />
                        <span>Futuro & Metas</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-800 shrink-0">
                        {currentModel.futurePct}%
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700/90 break-words leading-relaxed mt-0.5">
                      Reserva de emergência, investimentos e sonhos
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0 pl-13 sm:pl-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-emerald-200/60 flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-x-2">
                  <span className="text-base sm:text-lg md:text-xl font-semibold text-emerald-950 tabular-nums break-words">
                    {formatBRL(bucketAmounts.future)}
                  </span>
                  <span className="text-[10px] font-medium text-emerald-600 shrink-0">
                    teto planejado
                  </span>
                </div>
              </div>
            </div>

            {/* Link sutil para alternar modelo */}
            <div className="pt-1 text-center min-w-0">
              {!showModelPicker ? (
                <button
                  type="button"
                  onClick={() => setShowModelPicker(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700 transition-colors font-medium underline underline-offset-4 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>Prefere outro modelo?</span>
                </button>
              ) : (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-left animate-in fade-in-50 duration-200 min-w-0">
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
                  <div className="grid grid-cols-1 gap-1.5 min-w-0">
                    {BUDGET_MODEL_OPTIONS.map((opt) => {
                      const isSelected = selectedModelId === opt.id
                      return (
                        <div
                          key={opt.id}
                          onClick={() => {
                            setSelectedModelId(opt.id)
                            setShowModelPicker(false)
                          }}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between gap-2 transition-all min-w-0 ${
                            isSelected
                              ? 'bg-emerald-50/80 border-emerald-500 font-semibold text-emerald-950'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="font-semibold">{opt.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 shrink-0">
                                {opt.label}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5 break-words">
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

            {/* Ações da Etapa 3 */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2 w-full min-w-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
                disabled={isActivating}
                className="w-full sm:w-auto rounded-2xl text-xs gap-1.5 h-11 text-slate-600 border-slate-200 hover:bg-slate-50 shrink-0"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Alterar Renda</span>
              </Button>

              {/* Botão principal de ativação */}
              <Button
                type="button"
                onClick={handleActivatePlan}
                disabled={isActivating}
                className="w-full flex-1 h-12 bg-brand-amber hover:bg-[#e08e08] text-brand font-bold text-sm sm:text-base rounded-2xl shadow-md shadow-black/10 flex items-center justify-center gap-2 transition-all cursor-pointer min-w-0 px-4 disabled:opacity-75 disabled:cursor-not-allowed border-0"
              >
                {isActivating ? (
                  <span className="flex items-center justify-center gap-2 break-words text-center">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="break-words">Criando categorias e ativando...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2 break-words text-center">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span className="break-words">Concluir e Ativar meu Plano</span>
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
