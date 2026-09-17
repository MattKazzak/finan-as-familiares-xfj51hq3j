import { useState, useEffect, useMemo, useCallback } from 'react'
import { useFamily } from '@/hooks/use-family'
import {
  fetchTransactions,
  fetchBudgets,
  upsertBudget,
  deleteBudget,
  deleteTransaction,
} from '@/services/transactions'
import {
  formatBRL,
  formatRelativeDate,
  formatMonthYear,
  parseBRLToCents,
  formatNumberBRL,
} from '@/lib/formatters'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { TransactionDetailDialog } from '@/components/transactions/TransactionDetailDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import { useToast } from '@/hooks/use-toast'
import type { Transaction, Budget } from '@/types/finance'
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function WalletPage() {
  const {
    family,
    members,
    categories,
    selectedMemberId,
    setSelectedMemberId,
    refreshTrigger,
    triggerRefresh,
    openNewTransaction,
  } = useFamily()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'transacoes' | 'orcamentos'>('transacoes')

  // Mês selecionado no formato Date
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const monthKey = useMemo(() => {
    return currentDate.toISOString().slice(0, 7) // YYYY-MM
  }, [currentDate])

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros de transação
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [filterMemberIds, setFilterMemberIds] = useState<string[]>([])
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([])
  const [filterType, setFilterType] = useState<'income' | 'expense' | null>(null)

  // Ações de transação
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [isEditTxOpen, setIsEditTxOpen] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)

  // Ações de orçamento
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false)
  const [selectedBudgetCategory, setSelectedBudgetCategory] = useState<string>('')
  const [budgetAmountStr, setBudgetAmountStr] = useState('')
  const [budgetMode, setBudgetMode] = useState<'month' | 'year'>('month')
  const [savingBudget, setSavingBudget] = useState(false)

  // Navegação de mês
  const handlePrevMonth = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() - 1)
      return d
    })
  }

  const handleNextMonth = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + 1)
      return d
    })
  }

  const loadMonthData = useCallback(async () => {
    if (!family) return
    try {
      setLoading(true)
      const [txs, bgs] = await Promise.all([
        fetchTransactions({
          familyId: family.id,
          month: monthKey,
        }),
        fetchBudgets(family.id, monthKey),
      ])
      setTransactions(txs)
      setBudgets(bgs)
    } catch (err: any) {
      console.error('Erro ao carregar dados da carteira:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [family, monthKey, toast])

  useEffect(() => {
    loadMonthData()
  }, [loadMonthData, refreshTrigger])

  // Contagem de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filterMemberIds.length > 0) count += 1
    if (filterCategoryIds.length > 0) count += 1
    if (filterType !== null) count += 1
    return count
  }, [filterMemberIds, filterCategoryIds, filterType])

  // Transações filtradas
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterMemberIds.length > 0 && !filterMemberIds.includes(tx.member_id)) {
        return false
      }
      if (
        filterCategoryIds.length > 0 &&
        (!tx.category_id || !filterCategoryIds.includes(tx.category_id))
      ) {
        return false
      }
      if (filterType && tx.type !== filterType) {
        return false
      }
      return true
    })
  }, [transactions, filterMemberIds, filterCategoryIds, filterType])

  // Resumo do mês (Receitas, Despesas, Saldo)
  const { monthIncomeCents, monthExpenseCents, monthNetCents } = useMemo(() => {
    let income = 0
    let expense = 0
    filteredTransactions.forEach((tx) => {
      if (tx.type === 'income') income += tx.amount_cents
      else expense += tx.amount_cents
    })
    return {
      monthIncomeCents: income,
      monthExpenseCents: expense,
      monthNetCents: income - expense,
    }
  }, [filteredTransactions])

  // Agrupamento por dia ("Hoje", "Ontem", "17 de março")
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {}
    filteredTransactions.forEach((tx) => {
      const dateKey = tx.transaction_date
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(tx)
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredTransactions])

  // Confirmação de exclusão de transação
  const handleConfirmDelete = async () => {
    if (!txToDelete) return
    try {
      await deleteTransaction(txToDelete.id)
      setTransactions((prev) => prev.filter((t) => t.id !== txToDelete.id))
      toast({ title: 'Sucesso', description: 'Transação excluída.' })
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setTxToDelete(null)
    }
  }

  // Cálculos de orçamentos por categoria
  const categoryBudgetData = useMemo(() => {
    const expenseCategories = categories.filter((c) => c.type === 'expense')
    // Mapa de gastos por categoria no mês
    const spentMap: Record<string, number> = {}
    transactions.forEach((tx) => {
      if (tx.type === 'expense' && tx.category_id) {
        spentMap[tx.category_id] = (spentMap[tx.category_id] || 0) + tx.amount_cents
      }
    })

    // Mapa de orçamentos existentes
    const budgetMap: Record<string, Budget> = {}
    budgets.forEach((b) => {
      budgetMap[b.category_id] = b
    })

    let totalBudget = 0
    let totalSpent = 0

    const list = expenseCategories.map((cat) => {
      const budget = budgetMap[cat.id]
      const limitCents = budget ? budget.amount_cents : 0
      const spentCents = spentMap[cat.id] || 0
      if (limitCents > 0) {
        totalBudget += limitCents
        totalSpent += spentCents
      }
      const percent = limitCents > 0 ? Math.round((spentCents / limitCents) * 100) : 0
      const isOver = spentCents > limitCents && limitCents > 0
      return {
        category: cat,
        budget,
        limitCents,
        spentCents,
        percent,
        isOver,
      }
    })

    // Ordenar: primeiro com orçamento, depois estourados
    list.sort((a, b) => {
      if (a.isOver && !b.isOver) return -1
      if (!a.isOver && b.isOver) return 1
      return b.limitCents - a.limitCents
    })

    return {
      list,
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      totalPercent:
        totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0,
      isTotalOver: totalSpent > totalBudget && totalBudget > 0,
    }
  }, [categories, transactions, budgets])

  const openBudgetEditor = (catId: string, currentBudgetAmount?: number) => {
    setSelectedBudgetCategory(catId)
    setBudgetAmountStr(currentBudgetAmount ? formatNumberBRL(currentBudgetAmount) : '')
    setBudgetMode('month')
    setIsBudgetDialogOpen(true)
  }

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family || !selectedBudgetCategory) return
    const cents = parseBRLToCents(budgetAmountStr)

    try {
      setSavingBudget(true)
      const adjustedCents = budgetMode === 'year' ? Math.round(cents / 12) : cents
      await upsertBudget(family.id, selectedBudgetCategory, monthKey, adjustedCents)
      toast({ title: 'Sucesso', description: 'Orçamento atualizado!' })
      setIsBudgetDialogOpen(false)
      loadMonthData()
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingBudget(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* TABS SEGMENTADAS NO TOPO */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'transacoes' | 'orcamentos')}
        className="w-full"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <TabsList className="bg-slate-100 p-1 rounded-2xl w-full sm:w-72 grid grid-cols-2">
            <TabsTrigger
              value="transacoes"
              className="rounded-xl font-semibold text-xs py-2 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm"
            >
              Transações
            </TabsTrigger>
            <TabsTrigger
              value="orcamentos"
              className="rounded-xl font-semibold text-xs py-2 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm"
            >
              Orçamentos
            </TabsTrigger>
          </TabsList>

          {/* Seletor de Mês Compartilhado */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs sm:text-sm text-slate-800 px-2 min-w-[120px] text-center">
              {formatMonthYear(currentDate)}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= TAB 1: TRANSAÇÕES ================= */}
        <TabsContent value="transacoes" className="space-y-5 mt-0">
          {/* Summary Strip (3 Mini Cards) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold uppercase tracking-wider">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Receitas</span>
              </div>
              <span className="text-sm sm:text-lg font-bold text-slate-900 tabular-nums mt-1 truncate">
                {formatBRL(monthIncomeCents)}
              </span>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-red-600 text-[11px] font-bold uppercase tracking-wider">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Despesas</span>
              </div>
              <span className="text-sm sm:text-lg font-bold text-slate-900 tabular-nums mt-1 truncate">
                {formatBRL(monthExpenseCents)}
              </span>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <Scale className="w-3.5 h-3.5" />
                <span>Saldo Mês</span>
              </div>
              <span
                className={`text-sm sm:text-lg font-bold tabular-nums mt-1 truncate ${
                  monthNetCents >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {formatBRL(monthNetCents)}
              </span>
            </div>
          </div>

          {/* Barra de Filtro e Contagem */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterSheetOpen(true)}
                className={`rounded-xl text-xs font-semibold gap-1.5 ${
                  activeFiltersCount > 0
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'text-slate-600'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filtrar
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>

              {activeFiltersCount > 0 && (
                <button
                  onClick={() => {
                    setFilterMemberIds([])
                    setFilterCategoryIds([])
                    setFilterType(null)
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline transition-colors"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <span className="text-xs text-slate-400 font-medium">
              {filteredTransactions.length}{' '}
              {filteredTransactions.length === 1 ? 'transação' : 'transações'}
            </span>
          </div>

          {/* Lista Agrupada por Dia com Ações de Swipe/Botões de Edição e Exclusão */}
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Carregando transações...</div>
          ) : groupedTransactions.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center text-slate-400 mb-2">
                🏷️
              </div>
              <p className="font-bold text-slate-800 text-sm">Nenhuma transação encontrada</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                {activeFiltersCount > 0
                  ? 'Tente remover os filtros selecionados.'
                  : 'Nenhum lançamento registrado neste mês.'}
              </p>
              <Button
                onClick={() => openNewTransaction('expense')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nova transação
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedTransactions.map(([dateKey, dayTxs]) => (
                <div
                  key={dateKey}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden"
                >
                  {/* Cabeçalho do dia */}
                  <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-700 capitalize">
                      {formatRelativeDate(dateKey)} ({dateKey})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {dayTxs.length} {dayTxs.length === 1 ? 'item' : 'itens'}
                    </span>
                  </div>

                  {/* Lista de itens do dia */}
                  <div className="divide-y divide-slate-100">
                    {dayTxs.map((tx) => {
                      const isIncome = tx.type === 'income'
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors group"
                        >
                          <div
                            onClick={() => {
                              setSelectedTx(tx)
                              setIsDetailOpen(true)
                            }}
                            className="flex items-center gap-3 cursor-pointer flex-1 overflow-hidden"
                          >
                            <div
                              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                              style={{
                                backgroundColor:
                                  tx.category?.color || (isIncome ? '#10B981' : '#64748B'),
                              }}
                            >
                              <CategoryIcon name={tx.category?.icon} className="w-5 h-5" />
                            </div>

                            <div className="overflow-hidden pr-2">
                              <p className="font-semibold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                {tx.description || tx.category?.name || 'Sem descrição'}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {tx.member?.name || 'Família'}
                                </span>
                                {tx.category && (
                                  <span className="text-[11px] text-slate-400">
                                    {tx.category.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`font-bold text-sm sm:text-base tabular-nums ${
                                isIncome ? 'text-emerald-600' : 'text-red-600'
                              }`}
                            >
                              {isIncome ? '+' : '−'} {formatBRL(tx.amount_cents)}
                            </span>

                            {/* Botões de Ação Rápida (Editar e Excluir) */}
                            <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingTx(tx)
                                  setIsEditTxOpen(true)
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setTxToDelete(tx)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ================= TAB 2: ORÇAMENTOS ================= */}
        <TabsContent value="orcamentos" className="space-y-5 mt-0">
          {/* Card Geral de Orçamento */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
                Orçamento Total do Mês
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  categoryBudgetData.isTotalOver
                    ? 'bg-red-100 text-red-700'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {categoryBudgetData.isTotalOver
                  ? `Excedeu ${formatBRL(Math.abs(categoryBudgetData.totalRemaining))}`
                  : `Resta ${formatBRL(categoryBudgetData.totalRemaining)}`}
              </span>
            </div>

            <div className="flex items-baseline justify-between mb-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                {formatBRL(categoryBudgetData.totalSpent)}{' '}
                <span className="text-sm font-medium text-slate-400">
                  / {formatBRL(categoryBudgetData.totalBudget)}
                </span>
              </span>
              <span className="text-sm font-bold text-slate-600 tabular-nums">
                {categoryBudgetData.totalPercent}%
              </span>
            </div>

            {/* Barra de Progresso com Transição de Cores */}
            <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  categoryBudgetData.isTotalOver
                    ? 'bg-red-500'
                    : categoryBudgetData.totalPercent > 80
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.min(categoryBudgetData.totalPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* Lista de Orçamentos por Categoria */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Categorias</h3>
                <p className="text-xs text-slate-500">
                  Clique para definir o teto mensal ou anual de cada categoria
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {categoryBudgetData.list.map((item) => (
                <div
                  key={item.category.id}
                  onClick={() => openBudgetEditor(item.category.id, item.limitCents)}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 rounded-2xl px-2 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                      style={{ backgroundColor: item.category.color || '#64748B' }}
                    >
                      <CategoryIcon name={item.category.icon} className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {item.category.name}
                        </span>
                        {item.isOver && (
                          <span title="Orçamento excedido!">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                        {formatBRL(item.spentCents)} de{' '}
                        {item.limitCents > 0 ? formatBRL(item.limitCents) : 'Não definido'}
                      </p>
                    </div>
                  </div>

                  {/* Progresso / Porcentagem */}
                  <div className="flex items-center gap-3 text-right">
                    {item.limitCents > 0 ? (
                      <div>
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            item.isOver
                              ? 'text-red-600'
                              : item.percent > 80
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                          }`}
                        >
                          {item.percent}%
                        </span>
                        <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              item.isOver ? 'bg-red-500' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(item.percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-700 group-hover:underline">
                        + Definir
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO DE FILTRO DE TRANSAÇÕES */}
      <Dialog open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Filtros de Transação
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tipo */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Tipo</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setFilterType(null)}
                  className={`py-1.5 rounded-xl text-xs font-semibold border ${
                    filterType === null
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('expense')}
                  className={`py-1.5 rounded-xl text-xs font-semibold border ${
                    filterType === 'expense'
                      ? 'bg-red-500 text-white border-red-500'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Despesas
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('income')}
                  className={`py-1.5 rounded-xl text-xs font-semibold border ${
                    filterType === 'income'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Receitas
                </button>
              </div>
            </div>

            {/* Membros */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Membros da Família</Label>
              <div className="space-y-2 mt-2 max-h-36 overflow-y-auto pr-1">
                {members.map((m) => {
                  const checked = filterMemberIds.includes(m.id)
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilterMemberIds((prev) => [...prev, m.id])
                          } else {
                            setFilterMemberIds((prev) => prev.filter((id) => id !== m.id))
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{m.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Categorias (Chips) */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Categorias</Label>
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-36 overflow-y-auto">
                {categories.map((c) => {
                  const selected = filterCategoryIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          setFilterCategoryIds((prev) => prev.filter((id) => id !== c.id))
                        } else {
                          setFilterCategoryIds((prev) => [...prev, c.id])
                        }
                      }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        selected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setFilterMemberIds([])
                setFilterCategoryIds([])
                setFilterType(null)
                setIsFilterSheetOpen(false)
              }}
              className="text-xs"
            >
              Limpar Todos
            </Button>
            <Button
              onClick={() => setIsFilterSheetOpen(false)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              Aplicar Filtros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE EDIÇÃO DE ORÇAMENTO */}
      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Definir Orçamento
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveBudget} className="space-y-4">
            {/* Toggle Mês vs Ano */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setBudgetMode('month')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  budgetMode === 'month' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'
                }`}
              >
                Orçamento do Mês
              </button>
              <button
                type="button"
                onClick={() => setBudgetMode('year')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  budgetMode === 'year' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'
                }`}
              >
                Meta do Ano (÷12)
              </button>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
              <div className="p-3 bg-slate-50 rounded-xl mt-1 text-sm font-semibold text-slate-800">
                {categories.find((c) => c.id === selectedBudgetCategory)?.name || 'Categoria'}
              </div>
            </div>

            <div>
              <Label htmlFor="bg-amount" className="text-xs font-semibold text-slate-700">
                {budgetMode === 'month' ? 'Teto Mensal (R$)' : 'Teto Anual Total (R$)'}
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                  R$
                </span>
                <Input
                  id="bg-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={budgetAmountStr}
                  onChange={(e) => setBudgetAmountStr(e.target.value)}
                  className="pl-10 text-base font-bold tabular-nums"
                  required
                />
              </div>
              {budgetMode === 'year' && (
                <p className="text-[11px] text-slate-400 mt-1">
                  O valor anual será dividido igualmente por 12 meses.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBudgetDialogOpen(false)}
                disabled={savingBudget}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingBudget}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {savingBudget && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Orçamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE DETALHE DA TRANSAÇÃO */}
      <TransactionDetailDialog
        transaction={selectedTx}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={(tx) => {
          setEditingTx(tx)
          setIsEditTxOpen(true)
        }}
        onDelete={(tx) => setTxToDelete(tx)}
      />

      {/* DIÁLOGO DE EDIÇÃO DE TRANSAÇÃO */}
      <NewTransactionDialog
        open={isEditTxOpen}
        onOpenChange={setIsEditTxOpen}
        editingTransaction={editingTx}
      />

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE TRANSAÇÃO */}
      <AlertDialog open={!!txToDelete} onOpenChange={(open) => !open && setTxToDelete(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Excluir transação?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              Esta ação removerá o registro financeiro e recalculará o saldo da família.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
