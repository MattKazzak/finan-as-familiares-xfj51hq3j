import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '@/hooks/use-family'
import {
  fetchTransactions,
  fetchDefaultBudgets,
  fetchMonthBudgetOverrides,
} from '@/services/transactions'
import {
  fetchRecurringIncomes,
  fetchRecurringIncomeOverrides,
  processAutoRecurringIncomes,
} from '@/services/recurring-incomes'
import type { RecurringIncome, RecurringIncomeOverride } from '@/types/finance'
import { formatBRL, formatFullDate, formatRelativeDate } from '@/lib/formatters'
import { CountUp } from '@/components/common/CountUp'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { TransactionDetailDialog } from '@/components/transactions/TransactionDetailDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import { formatTransactionTitle, groupInstallmentTransactions } from '@/services/installments'
import { deleteTransaction } from '@/services/transactions'
import { useToast } from '@/hooks/use-toast'
import type { Transaction, Budget } from '@/types/finance'
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw,
  WalletCards,
  ChevronRight,
  AlertCircle,
  Users,
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
    refreshTrigger,
    triggerRefresh,
  } = useFamily()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalBudgetLimit, setTotalBudgetLimit] = useState<number>(0)
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([])
  const [recurringOverrides, setRecurringOverrides] = useState<RecurringIncomeOverride[]>([])

  // Diálogo de detalhe e edição
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  // Mês atual formato YYYY-MM
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), [])

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

      const [allTx, defBgs, overrides, recIncomes, recOverrides] = await Promise.all([
        fetchTransactions({
          familyId: family.id,
          memberId: selectedMemberId,
        }),
        fetchDefaultBudgets(family.id),
        fetchMonthBudgetOverrides(family.id, currentMonthStr),
        fetchRecurringIncomes(family.id),
        fetchRecurringIncomeOverrides(family.id, currentMonthStr),
      ])
      setTransactions(allTx)
      setRecurringIncomes(recIncomes)
      setRecurringOverrides(recOverrides)

      // Calcular o teto orçamentário efetivo respeitando a agregação por categoria/subcategorias
      // 1. Mapear overrides e padrões tanto de categoria quanto de subcategoria
      const overrideCatMap = new Map<string, number>()
      const overrideSubMap = new Map<string, number>()
      overrides.forEach((o) => {
        if (o.subcategory_id) {
          overrideSubMap.set(o.subcategory_id, o.amount_cents)
        } else {
          overrideCatMap.set(o.category_id, o.amount_cents)
        }
      })

      const defCatMap = new Map<string, number>()
      const defSubMap = new Map<string, number>()
      defBgs.forEach((d) => {
        if (d.subcategory_id) {
          defSubMap.set(d.subcategory_id, d.amount_cents)
        } else {
          defCatMap.set(d.category_id, d.amount_cents)
        }
      })

      // 2. Para cada categoria de despesa, se houver tetos em subcategorias usa a soma delas; senão usa o teto do pai
      let sumLimits = 0
      const expenseCats = categories.filter((c) => c.type === 'expense')
      expenseCats.forEach((cat) => {
        let subcatsLimitSum = 0
        const subcats = cat.subcategories || []
        subcats.forEach((sub) => {
          if (overrideSubMap.has(sub.id)) {
            subcatsLimitSum += overrideSubMap.get(sub.id)!
          } else if (defSubMap.has(sub.id)) {
            subcatsLimitSum += defSubMap.get(sub.id)!
          }
        })

        const explicitLimitCents = overrideCatMap.has(cat.id)
          ? overrideCatMap.get(cat.id)!
          : defCatMap.get(cat.id) || 0

        const catLimit = subcatsLimitSum > 0 ? subcatsLimitSum : explicitLimitCents
        sumLimits += catLimit
      })
      setTotalBudgetLimit(sumLimits)
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

  // Cálculos de saldo total acumulado e métricas do mês
  const { totalBalanceCents, monthIncomeCents, monthExpenseCents, trendPercentage } =
    useMemo(() => {
      let incomeTotal = 0
      let expenseTotal = 0
      let mIncome = 0
      let mExpense = 0
      let prevMIncome = 0
      let prevMExpense = 0

      const prevMonth = new Date()
      prevMonth.setMonth(prevMonth.getMonth() - 1)
      const prevMonthStr = prevMonth.toISOString().slice(0, 7)

      transactions.forEach((tx) => {
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

  // Cálculo do orçamento total do mês
  const { totalBudgetSpentCents, totalBudgetLimitCents, budgetPercent } = useMemo(() => {
    let spent = 0
    transactions.forEach((tx) => {
      if (tx.type === 'expense' && tx.transaction_date.slice(0, 7) === currentMonthStr) {
        spent += tx.amount_cents
      }
    })

    const limit = totalBudgetLimit
    const pct = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0

    return {
      totalBudgetSpentCents: spent,
      totalBudgetLimitCents: limit,
      budgetPercent: pct,
    }
  }, [totalBudgetLimit, transactions, currentMonthStr])

  // Previsão de Custo de Vida (Receitas Fixas Recorrentes vs Tetos de Gastos)
  const homeForecast = useMemo(() => {
    const overrideMap = new Map<string, number>()
    recurringOverrides.forEach((o) => overrideMap.set(o.recurring_income_id, o.amount_cents))

    let totalPlannedIncomeCents = 0
    recurringIncomes.forEach((rec) => {
      if (rec.active && (rec.type || 'income') === 'income') {
        const amt = overrideMap.has(rec.id) ? overrideMap.get(rec.id)! : rec.amount_cents
        totalPlannedIncomeCents += amt
      }
    })

    const netForecast = totalPlannedIncomeCents - totalBudgetLimitCents
    return {
      totalPlannedIncomeCents,
      netForecast,
      count: recurringIncomes.filter((r) => r.active && (r.type || 'income') === 'income').length,
    }
  }, [recurringIncomes, recurringOverrides, totalBudgetLimitCents])

  // Transações recentes agrupadas estilo banco (compras parceladas agrupadas em linha única)
  const recentItems = useMemo(() => {
    // Agrupa todas as transações da família/filtro mantendo a ordenação por data recente
    const grouped = groupInstallmentTransactions(transactions)
    // Mostra as primeiras 7 linhas consolidadas na Home
    return grouped.slice(0, 7)
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Header Saudação + Pull-to-refresh */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Olá, {currentMember?.name || 'Família'}! 👋
            </h1>
            <button
              type="button"
              onClick={openWhoIsUsing}
              className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 border border-emerald-200/60"
              title="Trocar quem está usando"
            >
              <span>Trocar</span>
              <span className="text-[9px]">▾</span>
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 capitalize mt-0.5">
            {formatFullDate(new Date())} •{' '}
            <span className="font-semibold text-emerald-800">
              Família {family?.name || 'Silva'}
            </span>
          </p>
        </div>

        <button
          onClick={handlePullToRefresh}
          disabled={refreshing}
          className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all active:scale-95"
          title="Atualizar dados"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* 2. Filtro Horizontal de Membros (Chips) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedMemberId(null)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            selectedMemberId === null
              ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/30'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Todos
        </button>
        {members.map((m) => {
          const isSelected = selectedMemberId === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMemberId(m.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/30'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold">
                {m.name.charAt(0).toUpperCase()}
              </span>
              {m.name}
            </button>
          )
        })}
      </div>

      {/* PREVISÃO DE CUSTO DE VIDA (RECEITA FIXA VS TETOS COMPROMETIDOS) */}
      {homeForecast.totalPlannedIncomeCents > 0 || totalBudgetLimitCents > 0 ? (
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs uppercase font-bold tracking-wider text-slate-300">
                Previsão Mensal da Família · Custo de Vida
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/carteira')}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline self-start sm:self-auto transition-colors"
            >
              Ver na Carteira →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 block">
                Receita Fixa Prevista
              </span>
              <span className="text-base sm:text-lg font-bold text-white tabular-nums mt-0.5 block">
                {formatBRL(homeForecast.totalPlannedIncomeCents)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {homeForecast.count} receita(s) fixa(s)
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 block">
                Tetos Comprometidos
              </span>
              <span className="text-base sm:text-lg font-bold text-white tabular-nums mt-0.5 block">
                {formatBRL(totalBudgetLimitCents)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Orçamento de despesas</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">
                O Que Sobra (Previsão)
              </span>
              {(() => {
                const isPositive = homeForecast.netForecast >= 0
                return (
                  <>
                    <span
                      className={`text-base sm:text-lg font-extrabold tabular-nums mt-0.5 block ${
                        isPositive ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isPositive ? '+' : '−'} {formatBRL(Math.abs(homeForecast.netForecast))}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {isPositive ? 'Margem livre do mês' : 'Tetos acima da receita'}
                    </span>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {/* 3. Grid Principal (Card Hero de Saldo + Card Orçamento) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* CARD HERO SALDO TOTAL (Desktop 8 col) */}
        <div className="md:col-span-8 bg-gradient-to-br from-[#059669] to-[#0F766E] rounded-3xl p-6 sm:p-7 text-white shadow-xl shadow-emerald-950/15 relative overflow-hidden transition-all hover:shadow-2xl">
          {/* Efeito de luz decorativo */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-100">
              Saldo Total da Família
            </span>
            {trendPercentage !== 0 && (
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                  trendPercentage > 0
                    ? 'bg-emerald-400/20 text-emerald-100'
                    : 'bg-red-400/20 text-red-200'
                }`}
              >
                {trendPercentage > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
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
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums my-2">
              <CountUp end={totalBalanceCents} formatter={(v) => formatBRL(v)} />
            </div>
          )}

          <p className="text-xs text-emerald-100/90 mb-5">
            {selectedMemberId
              ? `Filtrado por: ${members.find((m) => m.id === selectedMemberId)?.name}`
              : 'Consolidado de todos os membros'}
          </p>

          {/* Chips Receitas e Despesas do Mês */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/15">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-400/20 flex items-center justify-center text-emerald-200">
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-100/90 block">
                  Receitas do Mês
                </span>
                <span className="text-sm sm:text-base font-bold text-white tabular-nums truncate block">
                  {formatBRL(monthIncomeCents)}
                </span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-400/20 flex items-center justify-center text-rose-200">
                <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-100/90 block">
                  Despesas do Mês
                </span>
                <span className="text-sm sm:text-base font-bold text-white tabular-nums truncate block">
                  {formatBRL(monthExpenseCents)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD ORÇAMENTO DO MÊS (Desktop 4 col) */}
        <div className="md:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  🎯
                </div>
                <h3 className="font-bold text-sm text-slate-800">Orçamento do Mês</h3>
              </div>
              <span className="text-xs font-bold text-slate-500 tabular-nums">
                {budgetPercent}%
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Gasto de {formatBRL(totalBudgetSpentCents)} do limite de{' '}
              {formatBRL(totalBudgetLimitCents)}.
            </p>

            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  budgetPercent > 90
                    ? 'bg-red-500'
                    : budgetPercent > 70
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                }`}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>

            {totalBudgetSpentCents > totalBudgetLimitCents && totalBudgetLimitCents > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-xl mb-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Orçamento estourado este mês!</span>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            onClick={() => navigate('/carteira')}
            className="w-full mt-4 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl flex items-center justify-between"
          >
            <span>Ver detalhes de orçamentos</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 4. Seção Últimas Transações */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Últimas Transações</h3>
            <p className="text-xs text-slate-500">Histórico recente de receitas e despesas</p>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate('/carteira')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl p-2"
          >
            Ver todas
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-2xl" />
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
            <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <WalletCards className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">Nenhuma transação ainda</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mb-4">
              Comece adicionando receitas ou despesas compartilhadas pela família.
            </p>
            <Button
              onClick={() => openNewTransaction('expense')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar primeira transação
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
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
                  className="flex items-center justify-between gap-3 py-3 px-2 sm:px-2.5 hover:bg-slate-50/90 rounded-2xl cursor-pointer transition-colors group"
                >
                  {/* Bloco Esquerda: Ícone + Textos */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Ícone de Categoria */}
                    <div
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                      style={{
                        backgroundColor: tx.category?.color || (isIncome ? '#10B981' : '#64748B'),
                      }}
                    >
                      <CategoryIcon name={tx.category?.icon} className="w-5 h-5" />
                    </div>

                    {/* Bloco de Textos (Título + Metadados) */}
                    <div className="min-w-0 flex-1">
                      {/* Linha 1: Título completo + Badges de status/tipo (Parcelado estilo banco / Fixa) */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p
                          className="font-semibold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate leading-tight"
                          title={displayTitle}
                        >
                          {displayTitle}
                        </p>
                        {item.isGroup ? (
                          <span
                            className="inline-flex items-center text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap"
                            title={`Compra parcelada: parcela ${item.currentInstallment} de ${item.totalInstallments}`}
                          >
                            Parcelado • {item.currentInstallment}/{item.totalInstallments}
                          </span>
                        ) : null}
                        {tx.is_recurring ? (
                          <span className="inline-flex items-center text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/60 px-1.5 py-0.2 rounded-md shrink-0">
                            Fixa
                          </span>
                        ) : null}
                      </div>

                      {/* Linha 2: Metadados alinhados em uma linha única (membro, categoria, data) */}
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1 min-w-0 text-[11px] text-slate-500 overflow-hidden">
                        {/* Chip do membro */}
                        <span className="inline-flex items-center gap-1 font-medium bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0 text-[10px] sm:text-[11px]">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[7px] font-bold shrink-0">
                            {tx.member?.name?.charAt(0).toUpperCase() || 'M'}
                          </span>
                          <span className="max-w-[70px] sm:max-w-[100px] truncate">
                            {tx.member?.name || 'Membro'}
                          </span>
                        </span>

                        <span className="text-slate-300 shrink-0">•</span>

                        {/* Categoria / Subcategoria ou Pendente */}
                        {tx.category ? (
                          <span className="truncate min-w-0 font-medium text-slate-500 text-[11px]">
                            <span>{tx.category.name}</span>
                            {tx.subcategory && (
                              <span className="text-emerald-700 font-semibold ml-1">
                                · {tx.subcategory.name}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded shrink-0">
                            Pendente
                          </span>
                        )}

                        <span className="text-slate-300 shrink-0">•</span>

                        {/* Data relativa da parcela mais recente */}
                        <span className="text-[10px] sm:text-[11px] text-slate-400 capitalize shrink-0 whitespace-nowrap">
                          {formatRelativeDate(item.transactionDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco Direita: Valor alinhado e estável */}
                  <div className="text-right shrink-0 pl-1">
                    <span
                      className={`font-bold text-xs sm:text-sm md:text-base tabular-nums whitespace-nowrap ${
                        isIncome ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {isIncome ? '+' : '−'} {formatBRL(item.amountCents)}
                    </span>
                    {item.isGroup && (
                      <span className="block text-[9px] text-slate-400 tabular-nums">/parcela</span>
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
