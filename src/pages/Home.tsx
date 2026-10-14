import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '@/hooks/use-family'
import { useActiveMonth } from '@/contexts/ActiveMonthContext'
import { MonthSelector } from '@/components/common/MonthSelector'
import {
  fetchTransactions,
  fetchDefaultBudgets,
  fetchMonthBudgetOverrides,
} from '@/services/transactions'
import { processAutoRecurringIncomes } from '@/services/recurring-incomes'
import {
  formatBRL,
  formatFamilyDisplayName,
  formatMonthYear,
  formatRelativeDate,
} from '@/lib/formatters'
import { CountUp } from '@/components/common/CountUp'
import { CategoryIconBox } from '@/components/common/CategoryIcon'
import { TransactionDetailDialog } from '@/components/transactions/TransactionDetailDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import { formatTransactionTitle, groupInstallmentTransactions } from '@/services/installments'
import { deleteTransaction } from '@/services/transactions'
import { useToast } from '@/hooks/use-toast'
import { useValuePrivacy, getTimeGreeting } from '@/hooks/use-value-privacy'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Transaction, DefaultBudget, Budget } from '@/types/finance'
import { BUDGET_PRESET_ITEMS } from '@/types/budget-presets'
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  WalletCards,
  ChevronRight,
  Users,
  Calendar,
  Sparkles,
  Eye,
  EyeOff,
  Bell,
  SunMedium,
  Coffee,
  Moon,
  Scale,
  Shield,
  Palmtree,
  Target,
  BarChart3,
  Receipt,
  PiggyBank,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function Home() {
  const {
    family,
    members,
    categories,
    completeness,
    currentMember,
    openWhoIsUsing,
    selectedMemberId,
    setSelectedMemberId,
    openNewTransaction,
    openOnboarding,
    refreshTrigger,
    triggerRefresh,
  } = useFamily()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { hideValues, toggleHideValues, maskValue } = useValuePrivacy()

  const [loading, setLoading] = useState(true)
  const isFamilyIncomplete = useMemo(() => {
    if (!family) return false
    if (completeness?.isIncomplete) return true
    const hasZeroIncome = !family.monthly_net_income_cents || family.monthly_net_income_cents <= 0
    const hasIncompleteCats = !categories || categories.length === 0 || categories.length !== 19
    return hasZeroIncome || hasIncompleteCats
  }, [family, completeness, categories])

  useEffect(() => {
    if (isFamilyIncomplete) {
      openOnboarding()
    }
  }, [isFamilyIncomplete, openOnboarding])

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [defaultBudgets, setDefaultBudgets] = useState<DefaultBudget[]>([])
  const [monthOverrides, setMonthOverrides] = useState<Budget[]>([])

  // Diálogo de detalhe e edição
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  // Carregamento prolongado (> ~2s): substitui o skeleton por mensagem amigável
  const [isLongLoading, setIsLongLoading] = useState(false)
  const isFamilyResolved = Boolean(family?.id)
  const isInitialDataLoading = loading || !isFamilyResolved

  useEffect(() => {
    if (!isInitialDataLoading) {
      setIsLongLoading(false)
      return
    }
    const timer = setTimeout(() => {
      setIsLongLoading(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [isInitialDataLoading])

  // Saudação personalizada dinâmica baseada no horário LOCAL do usuário
  const timeGreeting = useMemo(() => {
    const greetingData = getTimeGreeting(new Date())
    const memberFirstName = currentMember?.name ? currentMember.name.trim().split(/\s+/)[0] : null
    return {
      fullGreetingWithName: memberFirstName ? greetingData.fullGreeting(memberFirstName) : null,
      rawGreeting: greetingData.greeting,
      period: greetingData.period,
      memberName: memberFirstName,
    }
  }, [currentMember?.name])

  // Mês ativo global
  const { activeMonth, activeDate } = useActiveMonth()
  const [isBalanceDetailsExpanded, setIsBalanceDetailsExpanded] = useState(false)
  const currentMonthStr = activeMonth

  const loadData = useCallback(async () => {
    if (!family) return
    try {
      setLoading(true)
      try {
        await processAutoRecurringIncomes({
          familyId: family.id,
          targetMonthStr: currentMonthStr,
        })
      } catch (autoErr) {
        console.warn('Erro ao auto-lançar receitas fixas no Início:', autoErr)
      }

      const [allTx, defBgs, overrides] = await Promise.all([
        fetchTransactions({
          familyId: family.id,
          memberId: selectedMemberId,
        }),
        fetchDefaultBudgets(family.id),
        fetchMonthBudgetOverrides(family.id, currentMonthStr),
      ])
      setTransactions(allTx)
      setDefaultBudgets(defBgs)
      setMonthOverrides(overrides)
    } catch (err: any) {
      console.error('Erro ao carregar dados do início:', err)
      toast({
        title: 'Não foi possível carregar os dados',
        description: 'Verifique sua conexão ou tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [family, selectedMemberId, currentMonthStr, toast])

  useEffect(() => {
    loadData()
  }, [loadData, refreshTrigger])

  // Renda líquida prevista da família
  const plannedIncomeCents = family?.monthly_net_income_cents || 0

  // Totais de saldo e mês
  const {
    totalBalanceCents,
    monthIncomeCents,
    monthExpenseCents,
    prevMonthIncomeCents,
    prevMonthExpenseCents,
    prevMonthDate,
  } = useMemo(() => {
    let incomeTotal = 0
    let expenseTotal = 0
    let mIncome = 0
    let mExpense = 0
    let prevMIncome = 0
    let prevMExpense = 0

    const prevDate = new Date(activeDate.getFullYear(), activeDate.getMonth() - 1, 1)
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

    const effectiveTransactions = transactions.filter((tx) => tx.status !== 'projected')

    effectiveTransactions.forEach((tx) => {
      const txMonth = tx.transaction_date.slice(0, 7)
      if (tx.type === 'income') {
        incomeTotal += tx.amount_cents
        if (txMonth === currentMonthStr) mIncome += tx.amount_cents
        if (txMonth === prevMonthStr) prevMIncome += tx.amount_cents
      } else {
        expenseTotal += tx.amount_cents
        if (txMonth === currentMonthStr) mExpense += tx.amount_cents
        if (txMonth === prevMonthStr) prevMExpense += tx.amount_cents
      }
    })

    return {
      totalBalanceCents: incomeTotal - expenseTotal,
      monthIncomeCents: mIncome,
      monthExpenseCents: mExpense,
      prevMonthIncomeCents: prevMIncome,
      prevMonthExpenseCents: prevMExpense,
      prevMonthDate: prevDate,
    }
  }, [transactions, currentMonthStr, activeDate])

  // Mapa de baldes para categorias
  const categoryBucketMap = useMemo(() => {
    const map = new Map<string, 'essentials' | 'lifestyle' | 'future'>()
    categories.forEach((cat) => {
      const rawBucket = cat.budget_bucket
      if (rawBucket === 'essentials' || rawBucket === 'lifestyle' || rawBucket === 'future') {
        map.set(cat.id, rawBucket)
      } else {
        const catNameLower = (cat.name || '').toLowerCase()
        if (
          catNameLower.includes('moradia') ||
          catNameLower.includes('alimenta') ||
          catNameLower.includes('saúde') ||
          catNameLower.includes('saude') ||
          catNameLower.includes('transporte') ||
          catNameLower.includes('serviço') ||
          catNameLower.includes('servico') ||
          catNameLower.includes('educa')
        ) {
          map.set(cat.id, 'essentials')
        } else if (
          catNameLower.includes('reserva') ||
          catNameLower.includes('invest') ||
          catNameLower.includes('meta') ||
          catNameLower.includes('projeto') ||
          catNameLower.includes('futuro')
        ) {
          map.set(cat.id, 'future')
        } else {
          map.set(cat.id, 'lifestyle')
        }
      }
    })
    return map
  }, [categories])

  const budgetModelLabel = useMemo(() => {
    const modelId = family?.budget_model
    if (modelId) {
      const found = BUDGET_PRESET_ITEMS.find((item) => item.id === modelId)
      if (found) {
        return found.name
      }
      if (modelId === '60_25_15') {
        return 'Modelo 60 / 25 / 15'
      }
    }
    return 'Modelo 50 / 30 / 20'
  }, [family?.budget_model])

  // Agregação dos 3 Baldes
  const bucketsData = useMemo(() => {
    const netIncomeCents = family?.monthly_net_income_cents || 0

    const defCatBudgetMap: Record<string, DefaultBudget> = {}
    const defSubBudgetMap: Record<string, DefaultBudget> = {}
    defaultBudgets.forEach((b) => {
      if (b.subcategory_id) {
        defSubBudgetMap[b.subcategory_id] = b
      } else {
        defCatBudgetMap[b.category_id] = b
      }
    })

    const overrideCatBudgetMap: Record<string, Budget> = {}
    const overrideSubBudgetMap: Record<string, Budget> = {}
    monthOverrides.forEach((b) => {
      if (b.subcategory_id) {
        overrideSubBudgetMap[b.subcategory_id] = b
      } else {
        overrideCatBudgetMap[b.category_id] = b
      }
    })

    const catSpentMap: Record<string, number> = {}
    transactions.forEach((tx) => {
      if (
        tx.type === 'expense' &&
        tx.status !== 'projected' &&
        tx.transaction_date.slice(0, 7) === currentMonthStr
      ) {
        if (tx.category_id) {
          catSpentMap[tx.category_id] = (catSpentMap[tx.category_id] || 0) + tx.amount_cents
        }
      }
    })

    const bucketsSummary = {
      essentials: { budgetCents: 0, spentCents: 0 },
      lifestyle: { budgetCents: 0, spentCents: 0 },
      future: { budgetCents: 0, spentCents: 0 },
    }

    const expenseCategories = categories.filter((c) => c.type === 'expense')

    expenseCategories.forEach((cat) => {
      const subcats = cat.subcategories || []
      const subcatsLimitSum = subcats.reduce((acc, sub) => {
        const subOverride = overrideSubBudgetMap[sub.id]
        const subDefault = defSubBudgetMap[sub.id]
        const limit = subOverride
          ? subOverride.amount_cents
          : subDefault
            ? subDefault.amount_cents
            : 0
        return acc + limit
      }, 0)

      const catOverride = overrideCatBudgetMap[cat.id]
      const catDefault = defCatBudgetMap[cat.id]
      const explicitLimitCents = catOverride
        ? catOverride.amount_cents
        : catDefault
          ? catDefault.amount_cents
          : 0

      const limitCents = subcatsLimitSum > 0 ? subcatsLimitSum : explicitLimitCents
      const spentCents = catSpentMap[cat.id] || 0

      const bucket = categoryBucketMap.get(cat.id) || 'lifestyle'
      bucketsSummary[bucket].budgetCents += limitCents
      bucketsSummary[bucket].spentCents += spentCents
    })

    transactions.forEach((tx) => {
      if (
        tx.type === 'expense' &&
        tx.status !== 'projected' &&
        tx.transaction_date.slice(0, 7) === currentMonthStr &&
        !tx.category_id
      ) {
        bucketsSummary.lifestyle.spentCents += tx.amount_cents
      }
    })

    const essentialsIncomePct =
      netIncomeCents > 0
        ? Math.round((bucketsSummary.essentials.budgetCents / netIncomeCents) * 100)
        : null
    const lifestyleIncomePct =
      netIncomeCents > 0
        ? Math.round((bucketsSummary.lifestyle.budgetCents / netIncomeCents) * 100)
        : null
    const futureIncomePct =
      netIncomeCents > 0
        ? Math.round((bucketsSummary.future.budgetCents / netIncomeCents) * 100)
        : null

    const essentialsConsumptionPct =
      bucketsSummary.essentials.budgetCents > 0
        ? Math.round(
            (bucketsSummary.essentials.spentCents / bucketsSummary.essentials.budgetCents) * 100,
          )
        : 0
    const lifestyleConsumptionPct =
      bucketsSummary.lifestyle.budgetCents > 0
        ? Math.round(
            (bucketsSummary.lifestyle.spentCents / bucketsSummary.lifestyle.budgetCents) * 100,
          )
        : 0
    const futureConsumptionPct =
      bucketsSummary.future.budgetCents > 0
        ? Math.round((bucketsSummary.future.spentCents / bucketsSummary.future.budgetCents) * 100)
        : 0

    return {
      netIncomeCents,
      hasIncomeConfigured: netIncomeCents > 0,
      essentials: {
        spentCents: bucketsSummary.essentials.spentCents,
        limitCents: bucketsSummary.essentials.budgetCents,
        percent: essentialsConsumptionPct,
        percentIncome: essentialsIncomePct,
        isOver:
          bucketsSummary.essentials.spentCents > bucketsSummary.essentials.budgetCents &&
          bucketsSummary.essentials.budgetCents > 0,
      },
      lifestyle: {
        spentCents: bucketsSummary.lifestyle.spentCents,
        limitCents: bucketsSummary.lifestyle.budgetCents,
        percent: lifestyleConsumptionPct,
        percentIncome: lifestyleIncomePct,
        isOver:
          bucketsSummary.lifestyle.spentCents > bucketsSummary.lifestyle.budgetCents &&
          bucketsSummary.lifestyle.budgetCents > 0,
      },
      future: {
        spentCents: bucketsSummary.future.spentCents,
        limitCents: bucketsSummary.future.budgetCents,
        percent: futureConsumptionPct,
        percentIncome: futureIncomePct,
        isOver:
          bucketsSummary.future.spentCents > bucketsSummary.future.budgetCents &&
          bucketsSummary.future.budgetCents > 0,
      },
    }
  }, [
    family?.monthly_net_income_cents,
    transactions,
    currentMonthStr,
    categoryBucketMap,
    categories,
    defaultBudgets,
    monthOverrides,
  ])

  // R58 Tarefa 4: Gastos por Categoria no mês ativo (top 5-6 categorias, decrescente)
  const categoryExpenses = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; amountCents: number; icon?: string | null; color?: string | null }
    >()
    let totalExpensesInMonth = 0

    transactions.forEach((tx) => {
      if (
        tx.type === 'expense' &&
        tx.status !== 'projected' &&
        tx.transaction_date.slice(0, 7) === currentMonthStr
      ) {
        totalExpensesInMonth += tx.amount_cents
        const catId = tx.category_id || 'sem-categoria'
        const catName = tx.category?.name || 'Outros'
        const current = map.get(catId)
        if (current) {
          current.amountCents += tx.amount_cents
        } else {
          map.set(catId, {
            id: catId,
            name: catName,
            amountCents: tx.amount_cents,
            icon: tx.category?.icon || null,
            color: tx.category?.color || null,
          })
        }
      }
    })

    const list = Array.from(map.values())
      .filter((item) => item.amountCents > 0)
      .sort((a, b) => b.amountCents - a.amountCents)
      .slice(0, 6)

    const maxAmount = list.length > 0 ? list[0].amountCents : 0

    return {
      list,
      totalExpensesInMonth,
      maxAmount,
    }
  }, [transactions, currentMonthStr])

  // Transações recentes
  const recentItems = useMemo(() => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const grouped = groupInstallmentTransactions(transactions, { referenceDate: todayStr })

    const reachedItems = grouped.filter(
      (item) => item.representativeTx?.status !== 'projected' || item.transactionDate <= todayStr,
    )

    return reachedItems
      .slice()
      .sort((a, b) => {
        const dateCmp = b.transactionDate.localeCompare(a.transactionDate)
        if (dateCmp !== 0) return dateCmp
        const createdA = a.createdAt || a.representativeTx?.created_at || ''
        const createdB = b.createdAt || b.representativeTx?.created_at || ''
        return createdB.localeCompare(createdA)
      })
      .slice(0, 7)
  }, [transactions])

  const handleDelete = async (tx: Transaction) => {
    try {
      await deleteTransaction(tx.id)
      toast({ title: 'Transação excluída', description: 'O saldo foi recalculado.' })
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const memberInitial = currentMember?.name?.charAt(0).toUpperCase() || 'F'

  // Anel do previsto: cálculos
  const incomeProgressPercent = useMemo(() => {
    if (!plannedIncomeCents || plannedIncomeCents <= 0) return 0
    return Math.round((monthIncomeCents / plannedIncomeCents) * 100)
  }, [monthIncomeCents, plannedIncomeCents])

  const cappedIncomeProgress = Math.min(100, Math.max(0, incomeProgressPercent))
  const isIncomeOverPlanned = plannedIncomeCents > 0 && monthIncomeCents > plannedIncomeCents
  const isIncomeAtPlanned = plannedIncomeCents > 0 && monthIncomeCents === plannedIncomeCents

  if (isFamilyIncomplete) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-[#14213D] text-[#FCA311] flex items-center justify-center shadow-lg shadow-[#14213D]/20 mb-4 animate-pulse">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#14213D] tracking-tight">
          Configuração da Família Pendente
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
          O espaço da sua família precisa de alguns passos rápidos para ativar o orçamento
          inteligente e o catálogo de categorias.
        </p>
        <Button
          onClick={openOnboarding}
          className="mt-6 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold text-sm rounded-2xl px-6 h-12 shadow-md shadow-[#FCA311]/25 border-0"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Retomar Configuração da Família
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-[#F8F9FB]">
      {/* 1. FUNDO MARINHO SANGRADO NO TOPO (#14213D) */}
      <div
        data-testid="hero-bleeding-top"
        className="w-full bg-[#14213D] text-white pt-5 sm:pt-7 pb-10 sm:pb-12 px-4 sm:px-6 relative overflow-hidden"
      >
        {/* Efeitos de luz sutis */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#FCA311]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto space-y-5">
          {/* Linha 1 do cabeçalho (Saudação + Membro + Ações 👁 e 🔔) */}
          <div
            data-testid="header-greeting-row"
            className="flex items-center justify-between gap-2 sm:gap-3 min-w-0"
          >
            {/* Lado Esquerdo: Avatar + Saudação + Família */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={openWhoIsUsing}
                className="relative shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311] rounded-2xl active:scale-95 transition-transform cursor-pointer"
                aria-label="Trocar membro ativo ou abrir perfil"
                title={members.length > 1 ? 'Trocar perfil / membro' : 'Perfil do membro'}
              >
                <Avatar className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border-2 border-white/20 shadow-sm transition-all group-hover:border-[#FCA311] overflow-hidden">
                  {family?.avatar_url && (
                    <AvatarImage
                      src={family.avatar_url}
                      alt={family.name ? `Foto da Família ${family.name}` : 'Foto da Família'}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <AvatarFallback className="bg-gradient-to-tr from-white/10 to-white/20 text-white font-semibold text-xs sm:text-sm rounded-2xl">
                    {memberInitial}
                  </AvatarFallback>
                </Avatar>
                {members.length > 1 && (
                  <span
                    className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#FCA311] text-[#14213D] text-[8px] font-semibold rounded-full flex items-center justify-center border-2 border-[#14213D] shadow-2xs"
                    title="Mais membros disponíveis"
                  >
                    ▾
                  </span>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1
                    className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight truncate flex items-center gap-1.5"
                    title={timeGreeting.fullGreetingWithName || `${timeGreeting.rawGreeting}!`}
                  >
                    {timeGreeting.fullGreetingWithName ? (
                      <span className="truncate">{timeGreeting.fullGreetingWithName}</span>
                    ) : isLongLoading ? (
                      <span className="text-sm font-medium text-slate-300 animate-pulse">
                        Carregando seus dados...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 truncate">
                        <span>{timeGreeting.rawGreeting}!</span>
                        <span className="inline-block h-5 w-24 bg-white/20 rounded-md animate-pulse align-middle shrink-0" />
                      </span>
                    )}
                    {timeGreeting.period === 'morning' ? (
                      <Coffee className="w-4 h-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                    ) : timeGreeting.period === 'afternoon' ? (
                      <SunMedium className="w-4 h-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                    ) : (
                      <Moon className="w-4 h-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                    )}
                  </h1>
                </div>
                {family?.name?.trim() ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-[11px] sm:text-xs text-slate-300/80 font-medium leading-none truncate">
                      {formatFamilyDisplayName(family.name)}
                    </p>
                  </div>
                ) : isLongLoading ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-slate-400 italic leading-none truncate">
                      Carregando seus dados...
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Lado Direito: Ações (👁 e 🔔 adaptadas ao fundo marinho) */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={toggleHideValues}
                className="p-1.5 sm:p-2 rounded-2xl text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all active:scale-95 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
                aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
                title={
                  hideValues
                    ? 'Mostrar valores monetários'
                    : 'Ocultar valores monetários (modo privacidade)'
                }
              >
                {hideValues ? (
                  <EyeOff className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2] text-[#FCA311]" />
                ) : (
                  <Eye className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  toast({
                    title: 'Notificações do Curiangoo',
                    description: 'Você está em dia com todas as finanças e alertas da família!',
                  })
                }}
                className="relative p-1.5 sm:p-2 rounded-2xl text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all active:scale-95 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
                aria-label="Notificações"
                title="Notificações da família"
              >
                <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2]" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FCA311] ring-2 ring-[#14213D]" />
              </button>
            </div>
          </div>

          {/* Linha 2 do cabeçalho: Seletor de mês com tema escuro */}
          <div data-testid="header-month-row" className="flex items-center justify-start min-w-0">
            <MonthSelector variant="chip" theme="dark" />
          </div>

          {/* Filtro horizontal de membros adaptado ao fundo escuro */}
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full"
            role="group"
            aria-label="Filtro de membros"
          >
            <button
              type="button"
              onClick={() => setSelectedMemberId(null)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border touch-manipulation ${
                selectedMemberId === null
                  ? 'bg-[#FCA311] text-[#14213D] border-[#FCA311] shadow-sm'
                  : 'bg-white/10 text-white/80 border-white/10 hover:bg-white/15 hover:text-white'
              }`}
            >
              <Users
                className={`w-3.5 h-3.5 shrink-0 ${
                  selectedMemberId === null ? 'text-[#14213D]' : 'text-slate-300'
                }`}
              />
              <span>Todos</span>
            </button>
            {members.map((m) => {
              const isSelected = selectedMemberId === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMemberId(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border touch-manipulation ${
                    isSelected
                      ? 'bg-[#FCA311] text-[#14213D] border-[#FCA311] shadow-sm'
                      : 'bg-white/10 text-white/80 border-white/10 hover:bg-white/15 hover:text-white'
                  }`}
                  title={m.name}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                      isSelected ? 'bg-[#14213D] text-white' : 'bg-white/20 text-white'
                    }`}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span>{m.name}</span>
                </button>
              )
            })}
          </div>

          {/* O NOVO HERÓI: Saldo Total mora dentro do bloco sangrado marinho */}
          <div
            onClick={() => setIsBalanceDetailsExpanded((prev) => !prev)}
            role="region"
            aria-label="Card de Saldo da Família"
            className="pt-2 sm:pt-4 cursor-pointer select-none group"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs uppercase font-medium tracking-wider text-slate-300">
                Saldo Total da Família
              </span>
              <span className="text-[11px] text-white/70 group-hover:text-white transition-colors">
                {isBalanceDetailsExpanded ? '▾ Recolher' : '▸ Ver detalhes'}
              </span>
            </div>

            {loading ? (
              <Skeleton className="h-12 w-52 bg-white/20 rounded-lg my-2" />
            ) : (
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight tabular-nums my-1 sm:my-2 break-words text-white leading-tight">
                {hideValues ? (
                  <span>R$ ••••••</span>
                ) : (
                  <CountUp end={totalBalanceCents} formatter={(v) => formatBRL(v)} />
                )}
              </div>
            )}

            <p className="text-[11px] sm:text-xs text-slate-300/80 mb-5">
              {selectedMemberId
                ? `Filtrado por: ${members.find((m) => m.id === selectedMemberId)?.name}`
                : 'Consolidado de todos os membros'}
            </p>

            {/* Linha de Receitas e Despesas do Mês */}
            <div className="pt-3 border-t border-white/15 flex items-center justify-between gap-3 sm:gap-6">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">
                  <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-slate-300 font-normal block leading-tight">
                    Receitas
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-white tabular-nums block leading-tight mt-0.5 truncate">
                    {maskValue(formatBRL(monthIncomeCents))}
                  </span>
                </div>
              </div>

              <div className="w-px h-8 bg-white/15 shrink-0" aria-hidden="true" />

              <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end sm:justify-start">
                <div className="w-7 h-7 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-300 shrink-0">
                  <ArrowDownRight className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1 text-right sm:text-left">
                  <span className="text-[11px] text-slate-300 font-normal block leading-tight">
                    Despesas
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-white tabular-nums block leading-tight mt-0.5 truncate">
                    {maskValue(formatBRL(monthExpenseCents))}
                  </span>
                </div>
              </div>
            </div>

            {/* Progressive disclosure dos detalhes (preservando R50 e anel integrado) */}
            {isBalanceDetailsExpanded && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="mt-4 pt-3.5 border-t border-white/15 space-y-3.5 text-xs text-slate-200 animate-in fade-in slide-in-from-top-1 duration-200"
              >
                {/* Comparativo de receitas */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-slate-300 font-medium">Receitas do mês:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {plannedIncomeCents > 0 ? (
                        <span className="font-semibold text-white">
                          {maskValue(formatBRL(monthIncomeCents))} de{' '}
                          {maskValue(formatBRL(plannedIncomeCents))} previstos
                        </span>
                      ) : (
                        <span className="font-semibold text-white">
                          {maskValue(formatBRL(monthIncomeCents))}
                        </span>
                      )}
                      {isIncomeOverPlanned && (
                        <span className="text-[11px] font-medium text-emerald-300">
                          (acima do previsto)
                        </span>
                      )}
                      {isIncomeAtPlanned && (
                        <span className="text-[11px] font-medium text-emerald-300">
                          (previsto atingido)
                        </span>
                      )}
                    </div>
                  </div>

                  {plannedIncomeCents > 0 && (
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${cappedIncomeProgress}%` }}
                        role="progressbar"
                        aria-label="Progresso das receitas em relação ao previsto"
                        aria-valuenow={cappedIncomeProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  )}
                </div>

                {/* Comparativo de despesas */}
                {(() => {
                  const totalExpenseBudget =
                    bucketsData.essentials.limitCents +
                    bucketsData.lifestyle.limitCents +
                    bucketsData.future.limitCents

                  return (
                    <div className="space-y-1.5 pt-1 border-t border-white/10">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-slate-300 font-medium">Despesas do mês:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {totalExpenseBudget > 0 ? (
                            <span className="font-semibold text-white">
                              {maskValue(formatBRL(monthExpenseCents))} de{' '}
                              {maskValue(formatBRL(totalExpenseBudget))} orçados
                            </span>
                          ) : (
                            <span className="font-semibold text-white">
                              {maskValue(formatBRL(monthExpenseCents))}
                            </span>
                          )}
                          {totalExpenseBudget > 0 && monthExpenseCents > totalExpenseBudget && (
                            <span className="text-[11px] font-medium text-rose-300">
                              (acima do orçamento)
                            </span>
                          )}
                        </div>
                      </div>

                      {totalExpenseBudget > 0 && (
                        <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              monthExpenseCents > totalExpenseBudget
                                ? 'bg-rose-400'
                                : 'bg-slate-300'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  Math.round((monthExpenseCents / totalExpenseBudget) * 100),
                                ),
                              )}%`,
                            }}
                            role="progressbar"
                            aria-label="Progresso das despesas em relação ao orçamento"
                            aria-valuenow={Math.min(
                              100,
                              Math.max(
                                0,
                                Math.round((monthExpenseCents / totalExpenseBudget) * 100),
                              ),
                            )}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Comparação em linguagem natural */}
                {(() => {
                  const activeMonthLabel = formatMonthYear(activeDate)
                  const prevMonthLabel = formatMonthYear(prevMonthDate)

                  const hasAnyActivity =
                    monthIncomeCents > 0 ||
                    monthExpenseCents > 0 ||
                    prevMonthIncomeCents > 0 ||
                    prevMonthExpenseCents > 0

                  if (!hasAnyActivity) return null

                  return (
                    <div className="pt-2 border-t border-white/10 text-[11px] text-slate-300 space-y-1">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block">
                        Comparação ({prevMonthLabel.split(' ')[0]} vs{' '}
                        {activeMonthLabel.split(' ')[0]}
                        ):
                      </span>
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span>
                          Receitas: {prevMonthLabel.split(' ')[0]}:{' '}
                          <strong className="text-white font-medium">
                            {maskValue(formatBRL(prevMonthIncomeCents))}
                          </strong>{' '}
                          · {activeMonthLabel.split(' ')[0]}:{' '}
                          <strong className="text-white font-medium">
                            {maskValue(formatBRL(monthIncomeCents))}
                          </strong>
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span>
                          Despesas: {prevMonthLabel.split(' ')[0]}:{' '}
                          <strong className="text-white font-medium">
                            {maskValue(formatBRL(prevMonthExpenseCents))}
                          </strong>{' '}
                          · {activeMonthLabel.split(' ')[0]}:{' '}
                          <strong className="text-white font-medium">
                            {maskValue(formatBRL(monthExpenseCents))}
                          </strong>
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Atalhos Rápidos no Fundo Marinho (Chips consistentes) */}
        </div>
      </div>

      {/* 2. ÁREA CLARA (#F8F9FB) COM CARDS FLUTUANTES SOBREPONDO O FUNDO MARINHO */}
      <div className="relative -mt-6 sm:-mt-8 px-4 sm:px-6 pb-12 max-w-5xl mx-auto space-y-6">
        {/* PRIMEIRO CARD CLARO: Sobrepõe o marinho com rounded-3xl generoso e sombra R56 */}
        <div
          data-testid="first-floating-card"
          className="bg-white/95 backdrop-blur-sm rounded-3xl p-5 sm:p-7 border border-[rgba(20,33,61,0.06)] shadow-elevation-2 space-y-6"
        >
          {/* Seção A: Progresso das Receitas com ANEL DO PREVISTO (R58 Tarefa 3) */}
          <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 pb-6 border-b border-slate-100">
            {/* O Anel / Donut de Progresso */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Trilha do anel */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="text-slate-100 stroke-current"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Progresso do anel (cap em 100% de preenchimento, circunferência = 2 * PI * 40 = 251.32) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="text-emerald-500 stroke-current transition-all duration-700 ease-out"
                  strokeWidth="8"
                  strokeDasharray="251.32"
                  strokeDashoffset={251.32 - (251.32 * cappedIncomeProgress) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                  role="progressbar"
                  aria-label="Anel de progresso da renda recebida"
                  aria-valuenow={cappedIncomeProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </svg>

              {/* Centro do anel */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                <span className="text-xl sm:text-2xl font-bold text-[#14213D] tabular-nums leading-none">
                  {incomeProgressPercent}%
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-1">da renda</span>
              </div>
            </div>

            {/* Informações textuais do Anel da Renda Prevista */}
            <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="font-semibold text-base text-[#14213D] tracking-tight">
                  Receitas Previstas do Mês
                </h3>
                {isIncomeOverPlanned && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                    acima do previsto
                  </span>
                )}
                {isIncomeAtPlanned && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                    previsto atingido
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-600">
                {plannedIncomeCents > 0 ? (
                  <span>
                    Recebido{' '}
                    <strong className="text-[#14213D] font-semibold">
                      {maskValue(formatBRL(monthIncomeCents))}
                    </strong>{' '}
                    do total previsto de{' '}
                    <strong className="text-[#14213D] font-semibold">
                      {maskValue(formatBRL(plannedIncomeCents))}
                    </strong>
                  </span>
                ) : (
                  <span>
                    Total recebido:{' '}
                    <strong className="text-[#14213D] font-semibold">
                      {maskValue(formatBRL(monthIncomeCents))}
                    </strong>
                  </span>
                )}
              </p>

              {/* Comparativo em linguagem natural simplificada */}
              {prevMonthIncomeCents > 0 && (
                <p className="text-[11px] text-slate-400">
                  Mês anterior ({formatMonthYear(prevMonthDate).split(' ')[0]}):{' '}
                  {maskValue(formatBRL(prevMonthIncomeCents))}
                </p>
              )}
            </div>
          </div>

          {/* Seção B: Orçamento em 3 Baldes */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-[#14213D] flex items-center justify-center shrink-0 border border-[rgba(20,33,61,0.04)]">
                  <Scale className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm text-[#14213D] leading-tight">
                    Orçamento em 3 Baldes
                  </h3>
                  {budgetModelLabel && (
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {budgetModelLabel}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/orcamentos')}
                className="text-xs font-semibold text-[#14213D] hover:text-[#14213D] flex items-center gap-1 cursor-pointer"
              >
                <span>Ajustar</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#FCA311]" />
              </button>
            </div>

            {/* As 3 Barras */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  key: 'essentials',
                  name: 'Necessidades',
                  Icon: Shield,
                  percentIncome: bucketsData.essentials.percentIncome,
                  spent: bucketsData.essentials.spentCents,
                  limit: bucketsData.essentials.limitCents,
                  percent: bucketsData.essentials.percent,
                  isOver: bucketsData.essentials.isOver,
                  barGradient: 'bg-gradient-to-r from-[#14213D] to-[#1f3159]',
                },
                {
                  key: 'lifestyle',
                  name: 'Estilo de Vida',
                  Icon: Palmtree,
                  percentIncome: bucketsData.lifestyle.percentIncome,
                  spent: bucketsData.lifestyle.spentCents,
                  limit: bucketsData.lifestyle.limitCents,
                  percent: bucketsData.lifestyle.percent,
                  isOver: bucketsData.lifestyle.isOver,
                  barGradient: 'bg-gradient-to-r from-[#FCA311] to-[#fdb744]',
                },
                {
                  key: 'future',
                  name: 'Futuro & Metas',
                  Icon: Target,
                  percentIncome: bucketsData.future.percentIncome,
                  spent: bucketsData.future.spentCents,
                  limit: bucketsData.future.limitCents,
                  percent: bucketsData.future.percent,
                  isOver: bucketsData.future.isOver,
                  barGradient: 'bg-gradient-to-r from-[#10B981] to-[#34d399]',
                },
              ].map((bucket) => {
                const remaining = bucket.limit - bucket.spent
                const hasSpent = bucket.spent > 0
                const isOver = bucket.isOver
                const BucketIcon = bucket.Icon

                return (
                  <div
                    key={bucket.key}
                    className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1.5"
                  >
                    <div className="flex items-baseline justify-between gap-2 min-w-0">
                      <span className="font-semibold text-slate-800 text-xs flex items-center gap-1.5 min-w-0">
                        <BucketIcon
                          className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                          strokeWidth={1.5}
                        />
                        <span className="font-semibold break-words">{bucket.name}</span>
                        {bucket.percentIncome !== null && (
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">
                            ({bucket.percentIncome}%)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-right tabular-nums">
                      <span className="text-[11px] text-slate-500">
                        {bucket.limit > 0 ? (
                          isOver ? (
                            <span className="font-bold text-rose-600">
                              estourou {maskValue(formatBRL(Math.abs(remaining)))}
                            </span>
                          ) : !hasSpent ? (
                            <span className="font-semibold text-slate-700">
                              resta {maskValue(formatBRL(remaining))}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">
                                (intacto)
                              </span>
                            </span>
                          ) : (
                            <span className="font-bold text-slate-700">
                              resta {maskValue(formatBRL(remaining))}
                            </span>
                          )
                        ) : (
                          <span>{maskValue(formatBRL(bucket.spent))}</span>
                        )}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isOver
                            ? 'bg-gradient-to-r from-[#E11D48] to-[#f43f5e]'
                            : bucket.barGradient
                        }`}
                        style={{ width: `${Math.min(bucket.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-3 text-[10px] text-slate-400 font-medium leading-relaxed text-center sm:text-left">
              Necessidades: moradia e mercado · Estilo: lazer e refeições · Futuro: reserva e metas
            </p>
          </div>
        </div>

        {/* 3. NOVO CARD: GRÁFICO DE BARRAS POR CATEGORIA (R58 Tarefa 4) */}
        <div
          data-testid="category-expenses-card"
          className="bg-white/95 backdrop-blur-sm rounded-3xl p-5 sm:p-7 border border-[rgba(20,33,61,0.06)] shadow-elevation-1 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-[#14213D] flex items-center justify-center shrink-0 border border-[rgba(20,33,61,0.04)]">
                <BarChart3 className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-[#14213D] leading-tight">
                  Gastos por Categoria
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Principais despesas realizadas no mês
                </p>
              </div>
            </div>

            {categoryExpenses.totalExpensesInMonth > 0 && (
              <span className="text-xs font-semibold text-slate-700 tabular-nums">
                Total: {maskValue(formatBRL(categoryExpenses.totalExpensesInMonth))}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3 pt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : categoryExpenses.list.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <BarChart3 className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="text-xs font-semibold text-slate-700">
                Nenhum gasto registrado neste mês
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Suas despesas aparecerão organizadas por categorias aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {categoryExpenses.list.map((item) => {
                const percentOfTotal =
                  categoryExpenses.totalExpensesInMonth > 0
                    ? Math.round((item.amountCents / categoryExpenses.totalExpensesInMonth) * 100)
                    : 0
                const barWidth =
                  categoryExpenses.maxAmount > 0
                    ? Math.round((item.amountCents / categoryExpenses.maxAmount) * 100)
                    : 0

                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#14213D] truncate max-w-[200px] sm:max-w-none">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 tabular-nums">
                        <span className="font-semibold text-slate-700">
                          {maskValue(formatBRL(item.amountCents))}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          ({percentOfTotal}%)
                        </span>
                      </div>
                    </div>

                    {/* Barra de progresso CDS: azul-marinho #14213D com cantos suaves */}
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#14213D] h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${barWidth}%` }}
                        role="progressbar"
                        aria-label={`Gastos na categoria ${item.name}`}
                        aria-valuenow={barWidth}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 4. SEÇÃO ÚLTIMAS TRANSAÇÕES */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl border border-[rgba(20,33,61,0.06)] p-5 sm:p-7 shadow-elevation-1">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-base text-[#14213D] break-words">
                Últimas Transações
              </h3>
              <p className="text-xs text-muted-foreground break-words mt-0.5">
                Histórico recente de receitas e despesas
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/carteira')}
              className="text-xs font-semibold text-[#14213D] hover:text-[#14213D] hover:bg-slate-100 rounded-xl px-2.5 py-1.5 shrink-0 h-auto"
            >
              <span>Ver todas</span>
              <ChevronRight className="w-4 h-4 ml-1 text-[#FCA311]" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : recentItems.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <WalletCards className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">Nenhuma transação ainda</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mb-4">
                Comece adicionando receitas ou despesas compartilhadas pela família.
              </p>
              <Button
                onClick={() => openNewTransaction('expense')}
                className="bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-semibold text-xs rounded-xl shadow-curiango"
              >
                <Plus className="w-4 h-4 mr-1.5 stroke-[1.5]" />
                Adicionar primeira transação
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {recentItems.map((item) => {
                const tx = item.representativeTx
                const isIncome = tx.type === 'income'
                const displayTitle = item.isGroup
                  ? item.baseDescription
                  : formatTransactionTitle(tx)

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedTx(tx)
                      setIsDetailOpen(true)
                    }}
                    className="flex items-start sm:items-center justify-between gap-3 py-3 px-2 sm:px-2.5 hover:bg-slate-50/90 rounded-2xl cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <CategoryIconBox
                        icon={tx.category?.icon}
                        color={tx.category?.color}
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 sm:mt-0"
                        iconClassName="w-4 h-4"
                        strokeWidth={1.5}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <p
                            className="font-medium text-xs sm:text-sm text-[#14213D] group-hover:text-[#14213D] transition-colors break-words leading-tight"
                            title={displayTitle}
                          >
                            {displayTitle}
                          </p>
                          {item.isGroup ? (
                            <span
                              className="inline-flex items-center text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200/70 px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap"
                              title={`Compra parcelada: parcela ${item.currentInstallment} de ${item.totalInstallments}`}
                            >
                              Parcelado • {item.currentInstallment}/{item.totalInstallments}
                            </span>
                          ) : null}
                          {tx.is_recurring ? (
                            <span className="inline-flex items-center text-[9px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300/60 px-1.5 py-0.2 rounded-md shrink-0">
                              Fixa
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 min-w-0 text-xs text-muted-foreground">
                          <span
                            className="inline-flex items-center gap-1 font-normal text-muted-foreground bg-slate-100/80 px-1.5 py-0.5 rounded-md shrink-0 text-xs capitalize"
                            title={`Data: ${item.transactionDate}`}
                          >
                            <Calendar
                              className="w-3 h-3 text-muted-foreground shrink-0"
                              strokeWidth={1.5}
                            />
                            <span>{formatRelativeDate(item.transactionDate)}</span>
                          </span>

                          <span className="text-slate-300 shrink-0 hidden xs:inline">•</span>

                          <span className="inline-flex items-center gap-1 font-normal text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#14213D] text-white flex items-center justify-center text-[7px] font-bold shrink-0">
                              {tx.member?.name?.charAt(0).toUpperCase() || 'M'}
                            </span>
                            <span className="break-words">{tx.member?.name || 'Membro'}</span>
                          </span>

                          <span className="text-slate-300 shrink-0 hidden xs:inline">•</span>

                          {tx.category ? (
                            <span className="font-normal text-muted-foreground text-xs break-words">
                              <span>{tx.category.name}</span>
                              {tx.subcategory && (
                                <span className="text-[#14213D] font-medium ml-1">
                                  · {tx.subcategory.name}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded shrink-0">
                              Pendente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-1 pt-0.5 sm:pt-0">
                      <span
                        className={`font-semibold tracking-tight text-xs sm:text-sm md:text-base tabular-nums whitespace-nowrap ${
                          isIncome ? 'text-[#059669]' : 'text-[#E11D48]'
                        }`}
                      >
                        {hideValues
                          ? 'R$ ••••••'
                          : `${isIncome ? '+' : '−'} ${formatBRL(item.amountCents)}`}
                      </span>
                      {item.isGroup && (
                        <span className="block text-[9px] text-muted-foreground tabular-nums">
                          /parcela
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* DIÁLOGO DETALHE DA TRANSAÇÃO */}
      <TransactionDetailDialog
        transaction={selectedTx}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={(tx) => {
          setEditingTx(tx)
          setIsEditOpen(true)
        }}
        onDelete={handleDelete}
      />

      {/* DIÁLOGO EDIÇÃO */}
      <NewTransactionDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        editingTransaction={editingTx}
      />
    </div>
  )
}
