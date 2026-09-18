import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '@/hooks/use-family'
import { fetchTransactions, fetchBudgets } from '@/services/transactions'
import { formatBRL, formatFullDate, formatRelativeDate } from '@/lib/formatters'
import { CountUp } from '@/components/common/CountUp'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { TransactionDetailDialog } from '@/components/transactions/TransactionDetailDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
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
  const [budgets, setBudgets] = useState<Budget[]>([])

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
      const [allTx, monthBudgets] = await Promise.all([
        fetchTransactions({
          familyId: family.id,
          memberId: selectedMemberId,
        }),
        fetchBudgets(family.id, currentMonthStr),
      ])
      setTransactions(allTx)
      setBudgets(monthBudgets)
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
    // Total de despesas deste mês das categorias orçadas
    const budgetedCatIds = new Set(budgets.map((b) => b.category_id))
    let spent = 0
    transactions.forEach((tx) => {
      if (
        tx.type === 'expense' &&
        tx.transaction_date.slice(0, 7) === currentMonthStr &&
        tx.category_id &&
        budgetedCatIds.has(tx.category_id)
      ) {
        spent += tx.amount_cents
      }
    })

    const limit = budgets.reduce((acc, b) => acc + b.amount_cents, 0)
    const pct = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0

    return {
      totalBudgetSpentCents: spent,
      totalBudgetLimitCents: limit,
      budgetPercent: pct,
    }
  }, [budgets, transactions, currentMonthStr])

  // Últimas 5-7 transações para a seção recente
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 7)
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
        ) : recentTransactions.length === 0 ? (
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
            {recentTransactions.map((tx) => {
              const isIncome = tx.type === 'income'
              return (
                <div
                  key={tx.id}
                  onClick={() => {
                    setSelectedTx(tx)
                    setIsDetailOpen(true)
                  }}
                  className="flex items-center justify-between py-3.5 px-2 hover:bg-slate-50/80 rounded-2xl cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    {/* Ícone de Categoria */}
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                      style={{
                        backgroundColor: tx.category?.color || (isIncome ? '#10B981' : '#64748B'),
                      }}
                    >
                      <CategoryIcon name={tx.category?.icon} className="w-5 h-5" />
                    </div>

                    <div className="overflow-hidden">
                      <p className="font-semibold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                        {tx.description || tx.category?.name || 'Sem descrição'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {/* Avatar do membro */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[7px] font-bold">
                            {tx.member?.name?.charAt(0).toUpperCase() || 'M'}
                          </span>
                          {tx.member?.name || 'Membro'}
                        </span>
                        <span className="text-[11px] text-slate-400">•</span>
                        <span className="text-[11px] text-slate-400 capitalize">
                          {formatRelativeDate(tx.transaction_date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Valor */}
                  <div className="text-right">
                    <span
                      className={`font-bold text-sm sm:text-base tabular-nums ${
                        isIncome ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {isIncome ? '+' : '−'} {formatBRL(tx.amount_cents)}
                    </span>
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
