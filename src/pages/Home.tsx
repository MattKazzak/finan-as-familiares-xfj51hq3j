import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '@/hooks/use-family'
import {
  fetchTransactions,
  fetchDefaultBudgets,
  fetchMonthBudgetOverrides,
} from '@/services/transactions'
import { processAutoRecurringIncomes } from '@/services/recurring-incomes'
import {
  formatBRL,
  formatFamilyDisplayName,
  formatFullDate,
  formatMonthYear,
  formatRelativeDate,
} from '@/lib/formatters'
import { CountUp } from '@/components/common/CountUp'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { TransactionDetailDialog } from '@/components/transactions/TransactionDetailDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import { formatTransactionTitle, groupInstallmentTransactions } from '@/services/installments'
import { deleteTransaction } from '@/services/transactions'
import { useToast } from '@/hooks/use-toast'
import { useValuePrivacy, getTimeGreeting } from '@/hooks/use-value-privacy'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Transaction, DefaultBudget, Budget } from '@/types/finance'
import { BUDGET_PRESET_ITEMS } from '@/types/budget-presets'
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw,
  WalletCards,
  ChevronRight,
  Users,
  Calendar,
  Mic,
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function Home() {
  const {
    family,
    members,
    categories,
    currentMember,
    openWhoIsUsing,
    selectedMemberId,
    setSelectedMemberId,
    openNewTransaction,
    openVoiceDialog,
    refreshTrigger,
    triggerRefresh,
  } = useFamily()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { hideValues, toggleHideValues, maskValue } = useValuePrivacy()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [defaultBudgets, setDefaultBudgets] = useState<DefaultBudget[]>([])
  const [monthOverrides, setMonthOverrides] = useState<Budget[]>([])

  // Diálogo de detalhe e edição
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  // Saudação personalizada dinâmica baseada no horário LOCAL do usuário
  const timeGreeting = useMemo(() => {
    const greetingData = getTimeGreeting(new Date())
    const memberFirstName = currentMember?.name ? currentMember.name.split(' ')[0] : null
    return {
      text: greetingData.fullGreeting(memberFirstName || 'Família'),
      rawGreeting: greetingData.greeting,
      period: greetingData.period,
      memberName: memberFirstName || 'Família',
    }
  }, [currentMember?.name])

  // Mês atual formato YYYY-MM (baseado no horário local)
  const currentMonthStr = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const loadData = useCallback(async () => {
    if (!family) return
    try {
      setLoading(true)

      // Auto-lançamento de receitas fixas do mês corrente ao abrir o app
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
      setRefreshing(false)
    }
  }, [family, selectedMemberId, currentMonthStr, toast])

  useEffect(() => {
    loadData()
  }, [loadData, refreshTrigger])

  const handlePullToRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  // Renda líquida prevista da família
  const plannedIncomeCents = family?.monthly_net_income_cents || 0

  // Cálculos de saldo total acumulado e métricas do mês
  const { totalBalanceCents, monthIncomeCents, monthExpenseCents, trendPercentage } =
    useMemo(() => {
      let incomeTotal = 0
      let expenseTotal = 0
      let mIncome = 0
      let mExpense = 0
      let prevMIncome = 0
      let prevMExpense = 0

      const now = new Date()
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`

      // Apenas transações confirmadas/efetivadas (não projetadas) contam para saldo e totais do mês
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

      const totalBalance = incomeTotal - expenseTotal
      const currentNet = mIncome - mExpense
      const prevNet = prevMIncome - prevMExpense

      let trend = 0
      if (prevNet !== 0) {
        trend = Math.round(((currentNet - prevNet) / Math.abs(prevNet)) * 100)
      }

      return {
        totalBalanceCents: totalBalance,
        monthIncomeCents: mIncome,
        monthExpenseCents: mExpense,
        trendPercentage: trend,
      }
    }, [transactions, currentMonthStr])

  // Mapa de baldes para as categorias (respeita budget_bucket da categoria com fallback por palavras-chave)
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

  // Rótulo amigável do modelo de orçamento (lido de family.budget_model com fallback)
  const budgetModelLabel = useMemo(() => {
    const modelId = family?.budget_model
    if (modelId) {
      const found = BUDGET_PRESET_ITEMS.find((item) => item.id === modelId)
      if (found) {
        return found.name
      }
      // Variações conhecidas adicionais (ex.: 60_25_15)
      if (modelId === '60_25_15') {
        return 'Modelo 60 / 25 / 15'
      }
    }
    return 'Modelo 50 / 30 / 20'
  }, [family?.budget_model])

  // Agregação dos 3 Baldes com TETOS REAIS (mesma fonte e cálculo da aba Orçamentos / Wallet.tsx)
  const bucketsData = useMemo(() => {
    const netIncomeCents = family?.monthly_net_income_cents || 0

    // 1. Mapeamento de orçamentos padrão e overrides por categoria e subcategoria
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

    // 2. Gastos por categoria das despesas no mês corrente (apenas não projetadas)
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

    // 3. Totais por balde (budgetCents e spentCents)
    const bucketsSummary = {
      essentials: { budgetCents: 0, spentCents: 0 },
      lifestyle: { budgetCents: 0, spentCents: 0 },
      future: { budgetCents: 0, spentCents: 0 },
    }

    const expenseCategories = categories.filter((c) => c.type === 'expense')

    expenseCategories.forEach((cat) => {
      // Subcategorias
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

      // Quando a categoria possui tetos definidos nas subcategorias, usa a soma delas; senão, o pai
      const limitCents = subcatsLimitSum > 0 ? subcatsLimitSum : explicitLimitCents
      const spentCents = catSpentMap[cat.id] || 0

      const bucket = categoryBucketMap.get(cat.id) || 'lifestyle'
      bucketsSummary[bucket].budgetCents += limitCents
      bucketsSummary[bucket].spentCents += spentCents
    })

    // Também inclui despesas sem categoria no balde lifestyle (apenas não projetadas)
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

    // Percentuais DINÂMICOS sobre a renda líquida: Math.round((tetoDoBalde / rendaLiquidaTotal) * 100)
    // Se renda líquida for 0/ausente, percentModel fica null ou omitido graciosamente (sem NaN/Infinity)
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

    // Percentuais de consumo (spent / limit)
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

  // Transações recentes agrupadas estilo banco (compras parceladas agrupadas em linha única)
  const recentItems = useMemo(() => {
    // Para a lista de "Últimos lançamentos", passamos todas as transações (incluindo grupos de parcelamento)
    // para groupInstallmentTransactions com a data de referência hoje. A função consolida o grupo todo
    // (inclusive sabendo o total de parcelas 10/10) e seleciona como representante a parcela
    // já atingida/confirmada mais recente (ex: 1/10 em 01/09/2026), sem que parcelas futuras de 2027
    // empurrem o parcelamento para o topo.
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const grouped = groupInstallmentTransactions(transactions, { referenceDate: todayStr })

    // Filtra para garantir que apenas itens com data <= todayStr ou confirmados apareçam na Home
    const reachedItems = grouped.filter(
      (item) => item.representativeTx?.status !== 'projected' || item.transactionDate <= todayStr,
    )

    // Mostra as primeiras 7 linhas consolidadas na Home ordenadas por data decrescente (com desempate por created_at)
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full min-w-0 overflow-x-hidden">
      {/* 1. NOVO HEADER FINTECH MODERNO (PADRÃO NUBANK / COPILOT MONEY + PÁSSARO CURIANGOO) */}
      <header className="pt-1 pb-1">
        <div className="flex items-center justify-between gap-3 min-w-0">
          {/* Lado Esquerdo: Avatar arredondado do membro ativo + Saudação por horário + Subtítulo Curiangoo Família */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={openWhoIsUsing}
              className="relative shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311] rounded-2xl active:scale-95 transition-transform cursor-pointer"
              aria-label="Trocar membro ativo ou abrir perfil"
              title={members.length > 1 ? 'Trocar perfil / membro' : 'Perfil do membro'}
            >
              <Avatar className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border-2 border-[#14213D] shadow-sm transition-all group-hover:border-[#FCA311]">
                <AvatarFallback className="bg-gradient-to-tr from-[#14213D] to-[#1f3159] text-white font-extrabold text-sm sm:text-base rounded-2xl">
                  {memberInitial}
                </AvatarFallback>
              </Avatar>
              {members.length > 1 && (
                <span
                  className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#FCA311] text-[#14213D] text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-2xs"
                  title="Mais membros disponíveis"
                >
                  ▾
                </span>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1
                  className="text-base sm:text-lg md:text-xl font-bold text-[#14213D] tracking-tight leading-snug break-words flex items-center gap-1.5"
                  title={timeGreeting.text}
                >
                  <span>{timeGreeting.text}</span>
                  {timeGreeting.period === 'morning' ? (
                    <Coffee className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                  ) : timeGreeting.period === 'afternoon' ? (
                    <SunMedium
                      className="w-4 h-4 text-muted-foreground shrink-0"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Moon className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                  )}
                </h1>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-none">
                  Curiangoo Família
                </p>
                <span className="text-[10px] text-slate-300 select-none">·</span>
                <span className="text-[11px] sm:text-xs font-semibold text-[#14213D] leading-none break-words">
                  {formatFamilyDisplayName(family?.name, 'Silva')}
                </span>
              </div>
            </div>
          </div>

          {/* Lado Direito: Pássaro Curiangoo discreto + 2 Ícones Lineares Minimalistas (Privacidade de Valores + Notificações) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Marca oficial do pássaro em traço contínuo minimalista */}
            <div
              className="hidden xs:flex items-center justify-center w-9 h-9 rounded-2xl bg-[#E5E5E5]/40 border border-[#E5E5E5] text-[#14213D] transition-transform hover:scale-105 select-none"
              title="Curiangoo"
              aria-label="Curiangoo"
            >
              <CuriangoLogo size={20} color="#FCA311" />
            </div>

            {/* 1. Botão de Privacidade: Alternar visibilidade de valores */}
            <button
              type="button"
              onClick={toggleHideValues}
              className="p-2 sm:p-2.5 rounded-2xl text-slate-600 hover:text-[#14213D] hover:bg-[#E5E5E5]/60 border border-transparent hover:border-[#E5E5E5] transition-all active:scale-95 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
              aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
              title={
                hideValues
                  ? 'Mostrar valores monetários'
                  : 'Ocultar valores monetários (modo privacidade)'
              }
            >
              {hideValues ? (
                <EyeOff className="w-5 h-5 stroke-[2] text-[#FCA311]" />
              ) : (
                <Eye className="w-5 h-5 stroke-[2]" />
              )}
            </button>

            {/* 2. Sininho de Notificações Discreto */}
            <button
              type="button"
              onClick={() => {
                toast({
                  title: 'Notificações do Curiangoo',
                  description: 'Você está em dia com todas as finanças e alertas da família!',
                })
              }}
              className="relative p-2 sm:p-2.5 rounded-2xl text-slate-600 hover:text-[#14213D] hover:bg-[#E5E5E5]/60 border border-transparent hover:border-[#E5E5E5] transition-all active:scale-95 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
              aria-label="Notificações"
              title="Notificações da família"
            >
              <Bell className="w-5 h-5 stroke-[2]" />
              {/* Ponto indicador sutil */}
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FCA311] ring-2 ring-white" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Filtro Horizontal de Membros (Chips) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-full">
        <button
          type="button"
          onClick={() => setSelectedMemberId(null)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
            selectedMemberId === null
              ? 'bg-[#14213D] text-white shadow-sm ring-2 ring-[#14213D]/25'
              : 'bg-white text-slate-600 border border-[#E5E5E5] hover:bg-[#E5E5E5]/40'
          }`}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>Todos</span>
        </button>
        {members.map((m) => {
          const isSelected = selectedMemberId === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMemberId(m.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/30'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              title={m.name}
            >
              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                {m.name.charAt(0).toUpperCase()}
              </span>
              <span>{m.name}</span>
            </button>
          )
        })}
      </div>

      {/* 3. Grid Principal (Card Hero de Saldo + Card Orçamento) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* CARD HERO SALDO TOTAL (Desktop 8 col) - Identidade Azul-Marinho #14213D com destaque #FCA311 */}
        <div className="md:col-span-8 bg-gradient-to-br from-[#14213D] via-[#192a4f] to-[#0e172a] rounded-3xl p-5 sm:p-7 text-white shadow-xl shadow-[#14213D]/25 relative overflow-hidden transition-all hover:shadow-2xl border border-[#14213D]">
          {/* Efeito de luz decorativo âmbar sutil */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#FCA311]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-[#FCA311]">
              Saldo Total da Família
            </span>
            {trendPercentage !== 0 && (
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                  trendPercentage > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {trendPercentage > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
                <span>
                  {trendPercentage > 0 ? `+${trendPercentage}%` : `${trendPercentage}%`} vs mês ant.
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <Skeleton className="h-10 w-48 bg-white/20 rounded-lg my-2" />
          ) : (
            <div className="text-2xl sm:text-4xl font-extrabold tracking-tight tabular-nums my-2 break-words text-white">
              {hideValues ? (
                <span>R$ ••••••</span>
              ) : (
                <CountUp end={totalBalanceCents} formatter={(v) => formatBRL(v)} />
              )}
            </div>
          )}

          <p className="text-xs text-white/70 mb-4 sm:mb-5">
            {selectedMemberId
              ? `Filtrado por: ${members.find((m) => m.id === selectedMemberId)?.name}`
              : 'Consolidado de todos os membros'}
          </p>

          {/* Chips Receitas e Despesas do Mês: empilhados no mobile (< sm), 2 colunas a partir de sm: */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/10">
            {/* Bloco Receitas do Mês (Semântica financeira verde harmonizado #059669) */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between gap-2 min-w-0 border border-white/10">
              <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
                  <ArrowUpRight className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-emerald-200/90 block break-words">
                    Receitas do Mês
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="text-base sm:text-lg font-bold text-white tabular-nums break-words">
                      {maskValue(formatBRL(monthIncomeCents))}
                    </span>
                    {/* Cenário (a): zero e previsto > 0 -> badge/texto sutil (Previsto: ...) */}
                    {monthIncomeCents === 0 && plannedIncomeCents > 0 && (
                      <span className="text-xs sm:text-[11px] font-medium text-white/70 break-words">
                        (Previsto: {maskValue(formatBRL(plannedIncomeCents))})
                      </span>
                    )}
                    {/* Cenário (b.1): parcial (realizado < previsto) -> de {previsto} */}
                    {monthIncomeCents > 0 &&
                      plannedIncomeCents > 0 &&
                      monthIncomeCents < plannedIncomeCents && (
                        <span className="text-xs sm:text-[11px] font-medium text-white/70 break-words">
                          de {maskValue(formatBRL(plannedIncomeCents))}
                        </span>
                      )}
                    {/* Cenário (b.2): atingido ou superado -> ✓ Previsto atingido */}
                    {monthIncomeCents > 0 &&
                      plannedIncomeCents > 0 &&
                      monthIncomeCents >= plannedIncomeCents && (
                        <span className="text-xs sm:text-[11px] font-bold text-emerald-300 break-words">
                          ✓ Previsto atingido
                        </span>
                      )}
                  </div>
                </div>
              </div>

              {/* Linha de apoio acolhedora quando zero entradas e há previsão cadastrada */}
              {monthIncomeCents === 0 && plannedIncomeCents > 0 && (
                <div className="pt-1.5 border-t border-white/10 text-xs sm:text-[11px] text-white/80 flex flex-wrap items-center gap-1.5 leading-snug">
                  <span>Aguardando entradas do mês</span>
                  <span className="opacity-60 hidden xs:inline">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      const salaryCategory = categories.find((c) => {
                        const nameLower = (c.name || '').toLowerCase()
                        return (
                          c.type === 'income' &&
                          (nameLower.includes('salário') ||
                            nameLower.includes('salario') ||
                            nameLower.includes('remunera') ||
                            nameLower.includes('renda'))
                        )
                      })
                      openNewTransaction({
                        initialType: 'income',
                        initialCategoryId: salaryCategory?.id,
                        initialAmountCents: plannedIncomeCents,
                        initialDescription: 'Salário mensal',
                      })
                    }}
                    className="font-bold underline underline-offset-4 hover:text-[#FCA311] transition-colors cursor-pointer text-[#FCA311] active:scale-95 py-0.5"
                  >
                    [Registrar salário]
                  </button>
                </div>
              )}
            </div>

            {/* Bloco Despesas do Mês (Semântica financeira bordeaux CDS v1.0 #E11D48) */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 sm:p-3.5 flex items-start gap-2.5 sm:gap-3 min-w-0 border border-white/10">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-300 shrink-0 mt-0.5">
                <ArrowDownRight className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-rose-200/90 block break-words">
                  Despesas do Mês
                </span>
                <span className="text-base sm:text-lg font-bold text-white tabular-nums break-words block mt-0.5">
                  {maskValue(formatBRL(monthExpenseCents))}
                </span>
              </div>
            </div>
          </div>

          {/* ATALHO CURIANGOO COPILOT: Card/pílula de comando estilo input integrado ao topo abaixo do saldo */}
          <div className="mt-4 pt-3.5 border-t border-white/10">
            <button
              type="button"
              onClick={openVoiceDialog}
              aria-label="Falar com o Curiango"
              className="w-full group bg-white/95 hover:bg-white text-slate-800 rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-md hover:shadow-lg transition-all duration-200 border border-[#E5E5E5] flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FCA311] via-[#fba825] to-[#ffb845] text-[#14213D] flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <Mic className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs sm:text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors block leading-tight break-words">
                    Falar com o Curiangoo...
                  </span>
                  <span className="text-[10px] text-slate-400 block leading-tight break-words sm:hidden">
                    Toque para lançar por voz ou chat
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="hidden sm:inline-flex items-center text-[10px] font-semibold text-[#14213D] bg-[#FCA311]/20 border border-[#FCA311]/40 px-2 py-0.5 rounded-full">
                  IA Copilot
                </span>
                <Sparkles className="w-4 h-4 text-[#FCA311] fill-[#FCA311]/30 shrink-0 group-hover:rotate-12 transition-transform" />
              </div>
            </button>
          </div>
        </div>

        {/* CARD ORÇAMENTO EM 3 BALDES (Desktop 4 col) */}
        <div className="md:col-span-4 bg-card/90 backdrop-blur-sm rounded-3xl p-4 sm:p-6 border border-border/40 shadow-curiango flex flex-col justify-between">
          <div>
            {/* Header do Card (ícone Scale neutro + título + subtítulo com mês de referência discreto) */}
            <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                  <Scale className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm text-[#14213D] dark:text-white leading-tight break-words">
                    Orçamento em 3 Baldes
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {budgetModelLabel}
                    </span>
                    <span className="text-[10px] text-slate-300 font-normal select-none">·</span>
                    <span className="text-[10px] text-[#14213D] font-semibold break-words">
                      {formatMonthYear(new Date())}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* As 3 Barras de Balde Simplificadas */}
            <div className="space-y-3">
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
                  barBg: 'bg-[#14213D]',
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
                  barBg: 'bg-[#FCA311]',
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
                  barBg: 'bg-[#10B981]',
                },
              ].map((bucket) => {
                const remaining = bucket.limit - bucket.spent
                const hasSpent = bucket.spent > 0
                const isOver = bucket.isOver
                const BucketIcon = bucket.Icon

                return (
                  <div key={bucket.key} className="space-y-1.5">
                    {/* Linha topo do balde: Nome completo + % dinâmico do modelo à esquerda | Valor restante à direita */}
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

                      {/* Figura única de saldo restante / estourado / intacto */}
                      <span className="text-right shrink-0 tabular-nums">
                        {bucket.limit > 0 ? (
                          isOver ? (
                            <span className="text-[11px] font-bold text-rose-600 break-words">
                              estourou {maskValue(formatBRL(Math.abs(remaining)))}
                            </span>
                          ) : !hasSpent ? (
                            <span className="text-[11px] font-semibold text-slate-700 break-words">
                              resta {maskValue(formatBRL(remaining))}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">
                                (intacto)
                              </span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-700 break-words">
                              resta {maskValue(formatBRL(remaining))}
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {maskValue(formatBRL(bucket.spent))}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Barra de progresso simplificada e limpa */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isOver ? 'bg-[#E11D48]' : bucket.barBg
                        }`}
                        style={{
                          width: `${Math.min(bucket.percent, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Linha discreta de rodapé unificada com os exemplos das categorias */}
            <p className="mt-3.5 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-medium break-words leading-relaxed text-center sm:text-left">
              Necessidades: moradia e mercado · Estilo: lazer e refeições · Futuro: reserva e metas
            </p>
          </div>

          {/* Link sutil para Carteira */}
          <button
            type="button"
            onClick={() => navigate('/orcamentos')}
            className="w-full mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-[#14213D] hover:text-[#14213D] hover:bg-[#E5E5E5]/50 py-2 px-2.5 rounded-xl transition-colors flex items-center justify-between cursor-pointer group"
          >
            <span className="group-hover:underline">Ver detalhes na Carteira →</span>
            <ChevronRight className="w-4 h-4 text-[#FCA311] group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* 4. Seção Últimas Transações */}
      <div className="bg-card/90 backdrop-blur-sm rounded-3xl border border-border/40 p-4 sm:p-6 shadow-curiango">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-base text-[#14213D] dark:text-white break-words">
              Últimas Transações
            </h3>
            <p className="text-xs text-muted-foreground break-words">
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
          /* Empty State com ilustração line-art */
          <div className="py-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <WalletCards className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Nenhuma transação ainda
            </h4>
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
              // Se for grupo de parcelamento, exibe a descrição base completa sem abreviar
              // Se for transação normal, usa formatTransactionTitle
              const displayTitle = item.isGroup ? item.baseDescription : formatTransactionTitle(tx)

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedTx(tx)
                    setIsDetailOpen(true)
                  }}
                  className="flex items-start sm:items-center justify-between gap-3 py-3 px-2 sm:px-2.5 hover:bg-slate-50/90 dark:hover:bg-slate-800/50 rounded-2xl cursor-pointer transition-colors group"
                >
                  {/* Bloco Esquerda: Ícone + Textos */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    {/* Ícone de Categoria - Container neutro sofisticado CDS v1.0 */}
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      <CategoryIcon
                        name={tx.category?.icon}
                        className="w-4 h-4"
                        strokeWidth={1.5}
                      />
                    </div>

                    {/* Bloco de Textos (Título + Metadados) */}
                    <div className="min-w-0 flex-1">
                      {/* Linha 1: Título completo + Badges de status/tipo (Parcelado estilo banco / Fixa) */}
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <p
                          className="font-medium text-xs sm:text-sm text-[#14213D] dark:text-white group-hover:text-[#14213D] transition-colors break-words leading-tight"
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

                      {/* Linha 2: Metadados responsivos (Wrap amigável no mobile para não esmagar nada) */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 min-w-0 text-xs text-muted-foreground">
                        {/* DATA com ícone de calendário explícito */}
                        <span
                          className="inline-flex items-center gap-1 font-normal text-muted-foreground bg-slate-100/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-md shrink-0 text-xs capitalize"
                          title={`Data: ${item.transactionDate}`}
                        >
                          <Calendar
                            className="w-3 h-3 text-muted-foreground shrink-0"
                            strokeWidth={1.5}
                          />
                          <span>{formatRelativeDate(item.transactionDate)}</span>
                        </span>

                        <span className="text-slate-300 shrink-0 hidden xs:inline">•</span>

                        {/* Chip do membro */}
                        <span className="inline-flex items-center gap-1 font-normal text-muted-foreground bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md shrink-0 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#14213D] text-white flex items-center justify-center text-[7px] font-bold shrink-0">
                            {tx.member?.name?.charAt(0).toUpperCase() || 'M'}
                          </span>
                          <span className="break-words">{tx.member?.name || 'Membro'}</span>
                        </span>

                        <span className="text-slate-300 shrink-0 hidden xs:inline">•</span>

                        {/* Categoria / Subcategoria ou Pendente */}
                        {tx.category ? (
                          <span className="font-normal text-muted-foreground text-xs break-words">
                            <span>{tx.category.name}</span>
                            {tx.subcategory && (
                              <span className="text-[#14213D] dark:text-slate-200 font-medium ml-1">
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

                  {/* Bloco Direita: Valor alinhado e estável */}
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
