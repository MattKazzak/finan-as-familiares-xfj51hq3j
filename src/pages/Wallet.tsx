import { useState, useEffect, useMemo, useCallback } from 'react'
import { useFamily } from '@/hooks/use-family'
import {
  fetchTransactions,
  fetchDefaultBudgets,
  fetchMonthBudgetOverrides,
  upsertDefaultBudget,
  upsertMonthBudgetOverride,
  resetMonthBudgetToDefault,
  deleteTransaction,
} from '@/services/transactions'
import {
  formatBRL,
  formatDayGroupHeader,
  formatMonthYear,
  parseBRLToCents,
  formatNumberBRL,
} from '@/lib/formatters'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { TransactionDetailDialog } from '@/components/transactions/TransactionDetailDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import { useToast } from '@/hooks/use-toast'
import type {
  Transaction,
  Budget,
  DefaultBudget,
  TransactionCategory,
  TransactionSubcategory,
} from '@/types/finance'
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
  UploadCloud,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Calendar,
  Layers,
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
    openImportStatement,
  } = useFamily()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'transacoes' | 'orcamentos'>('transacoes')

  // Mês selecionado no formato Date
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const monthKey = useMemo(() => {
    return currentDate.toISOString().slice(0, 7) // YYYY-MM
  }, [currentDate])

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [defaultBudgets, setDefaultBudgets] = useState<DefaultBudget[]>([])
  const [monthOverrides, setMonthOverrides] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  // Categorias expandidas na aba de Orçamentos para visualização das subcategorias
  const [expandedBudgetCategories, setExpandedBudgetCategories] = useState<Record<string, boolean>>(
    {},
  )

  // Filtros de transação
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [filterMemberIds, setFilterMemberIds] = useState<string[]>([])
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([])
  const [filterSubcategoryIds, setFilterSubcategoryIds] = useState<string[]>([])
  const [filterType, setFilterType] = useState<'income' | 'expense' | null>(null)

  // Ações de transação
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [isEditTxOpen, setIsEditTxOpen] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)

  // Ações de orçamento
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false)
  const [editingBudgetCatId, setEditingBudgetCatId] = useState<string>('')
  const [editingBudgetSubcatId, setEditingBudgetSubcatId] = useState<string | null>(null)
  const [defaultAmountStr, setDefaultAmountStr] = useState('')
  const [monthAmountStr, setMonthAmountStr] = useState('')
  const [isEditingOnlyThisMonth, setIsEditingOnlyThisMonth] = useState(false)
  const [hasMonthOverride, setHasMonthOverride] = useState(false)
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
      const [txs, defBgs, overrides] = await Promise.all([
        fetchTransactions({
          familyId: family.id,
          month: monthKey,
        }),
        fetchDefaultBudgets(family.id),
        fetchMonthBudgetOverrides(family.id, monthKey),
      ])
      setTransactions(txs)
      setDefaultBudgets(defBgs)
      setMonthOverrides(overrides)
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
    if (filterSubcategoryIds.length > 0) count += 1
    if (filterType !== null) count += 1
    return count
  }, [filterMemberIds, filterCategoryIds, filterSubcategoryIds, filterType])

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
      if (
        filterSubcategoryIds.length > 0 &&
        (!tx.subcategory_id || !filterSubcategoryIds.includes(tx.subcategory_id))
      ) {
        return false
      }
      if (filterType && tx.type !== filterType) {
        return false
      }
      return true
    })
  }, [transactions, filterMemberIds, filterCategoryIds, filterSubcategoryIds, filterType])

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

  // Cálculos de orçamentos por categoria e subcategoria com modelo recorrente + overrides
  const categoryBudgetData = useMemo(() => {
    const expenseCategories = categories.filter((c) => c.type === 'expense')

    // 1. Gastos por categoria e por subcategoria
    const catSpentMap: Record<string, number> = {}
    const subSpentMap: Record<string, number> = {}

    transactions.forEach((tx) => {
      if (tx.type === 'expense' && tx.category_id) {
        catSpentMap[tx.category_id] = (catSpentMap[tx.category_id] || 0) + tx.amount_cents
        if (tx.subcategory_id) {
          subSpentMap[tx.subcategory_id] = (subSpentMap[tx.subcategory_id] || 0) + tx.amount_cents
        }
      }
    })

    // 2. Mapas de orçamentos padrão e overrides
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

    let totalBudget = 0
    let totalSpent = 0

    // 3. Montar estrutura hierárquica
    const list = expenseCategories.map((cat) => {
      // Subcategorias da categoria
      const subcats = cat.subcategories || []
      const subcategoryItems = subcats.map((sub) => {
        const subSpent = subSpentMap[sub.id] || 0
        const subOverride = overrideSubBudgetMap[sub.id]
        const subDefault = defSubBudgetMap[sub.id]

        const hasOverride = !!subOverride
        const limitCents = subOverride
          ? subOverride.amount_cents
          : subDefault
            ? subDefault.amount_cents
            : 0
        const defaultLimitCents = subDefault ? subDefault.amount_cents : 0

        const percent = limitCents > 0 ? Math.round((subSpent / limitCents) * 100) : 0
        const isOver = subSpent > limitCents && limitCents > 0

        return {
          subcategory: sub,
          limitCents,
          defaultLimitCents,
          spentCents: subSpent,
          percent,
          isOver,
          hasOverride,
          overrideBudget: subOverride,
          defaultBudget: subDefault,
        }
      })

      // Soma de tetos definidos nas subcategorias
      const subcatsLimitSum = subcategoryItems.reduce((acc, s) => acc + s.limitCents, 0)

      // Orçamento direto da categoria pai
      const catOverride = overrideCatBudgetMap[cat.id]
      const catDefault = defCatBudgetMap[cat.id]
      const hasOverride = !!catOverride

      // Se a categoria pai tiver teto explícito, usa ele; se não tiver, mas as subcategorias tiverem, usa a soma das subcategorias
      let explicitLimitCents = catOverride
        ? catOverride.amount_cents
        : catDefault
          ? catDefault.amount_cents
          : 0
      const defaultLimitCents = catDefault ? catDefault.amount_cents : 0

      // Teto efetivo da categoria pai
      const limitCents = explicitLimitCents > 0 ? explicitLimitCents : subcatsLimitSum

      const spentCents = catSpentMap[cat.id] || 0
      if (limitCents > 0) {
        totalBudget += limitCents
        totalSpent += spentCents
      }

      const percent = limitCents > 0 ? Math.round((spentCents / limitCents) * 100) : 0
      const isOver = spentCents > limitCents && limitCents > 0

      // Verificar se alguma subcategoria tem override
      const hasAnySubOverride = subcategoryItems.some((s) => s.hasOverride)

      return {
        category: cat,
        limitCents,
        explicitLimitCents,
        defaultLimitCents,
        subcatsLimitSum,
        spentCents,
        percent,
        isOver,
        hasOverride,
        hasAnySubOverride,
        overrideBudget: catOverride,
        defaultBudget: catDefault,
        subcategories: subcategoryItems,
      }
    })

    // Ordenar: categorias com orçamento definido ou estouradas primeiro
    list.sort((a, b) => {
      if (a.isOver && !b.isOver) return -1
      if (!a.isOver && b.isOver) return 1
      if (a.limitCents > 0 && b.limitCents === 0) return -1
      if (a.limitCents === 0 && b.limitCents > 0) return 1
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
  }, [categories, transactions, defaultBudgets, monthOverrides])

  // Abrir modal de edição de orçamento (para categoria pai ou subcategoria)
  const openBudgetEditor = (
    catId: string,
    subcatId: string | null = null,
    currentDefault?: number,
    currentMonthVal?: number,
    isOverridden: boolean = false,
  ) => {
    setEditingBudgetCatId(catId)
    setEditingBudgetSubcatId(subcatId)
    setDefaultAmountStr(currentDefault && currentDefault > 0 ? formatNumberBRL(currentDefault) : '')
    setMonthAmountStr(
      currentMonthVal && currentMonthVal > 0 ? formatNumberBRL(currentMonthVal) : '',
    )
    setIsEditingOnlyThisMonth(isOverridden)
    setHasMonthOverride(isOverridden)
    setIsBudgetDialogOpen(true)
  }

  // Toggle expansão da categoria na lista de orçamentos
  const toggleCatBudgetExpand = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedBudgetCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }))
  }

  // Salvar Orçamento (Padrão recorrente ou Ajuste pontual deste mês)
  const handleSaveBudgetForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family || !editingBudgetCatId) return

    try {
      setSavingBudget(true)

      if (isEditingOnlyThisMonth) {
        // Ajuste pontual para o mês selecionado
        const monthCents = parseBRLToCents(monthAmountStr)
        await upsertMonthBudgetOverride(
          family.id,
          editingBudgetCatId,
          monthKey,
          monthCents,
          editingBudgetSubcatId,
        )
        toast({
          title: 'Ajuste pontual salvo',
          description: `Orçamento exclusivo para ${formatMonthYear(currentDate)} atualizado.`,
        })
      } else {
        // Orçamento padrão recorrente (todos os meses)
        const defCents = parseBRLToCents(defaultAmountStr)
        await upsertDefaultBudget(family.id, editingBudgetCatId, defCents, editingBudgetSubcatId)

        // Se o usuário estiver alterando o padrão e existia um override, opcionalmente remove o override para alinhar
        if (hasMonthOverride) {
          await resetMonthBudgetToDefault(
            family.id,
            editingBudgetCatId,
            monthKey,
            editingBudgetSubcatId,
          )
        }

        toast({
          title: 'Orçamento padrão atualizado',
          description: 'Este valor recorrente é aplicado automaticamente a todos os meses.',
        })
      }

      setIsBudgetDialogOpen(false)
      loadMonthData()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar orçamento',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingBudget(false)
    }
  }

  // Reverter ajuste deste mês e voltar ao padrão
  const handleResetToDefault = async () => {
    if (!family || !editingBudgetCatId) return
    try {
      setSavingBudget(true)
      await resetMonthBudgetToDefault(
        family.id,
        editingBudgetCatId,
        monthKey,
        editingBudgetSubcatId,
      )
      toast({
        title: 'Voltou ao padrão',
        description: `O orçamento deste mês agora segue o valor padrão recorrente.`,
      })
      setIsBudgetDialogOpen(false)
      loadMonthData()
    } catch {
      toast({
        title: 'Erro ao resetar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingBudget(false)
    }
  }

  // Tornar o valor deste mês como novo padrão do ano todo
  const handleMakeThisMonthDefault = async () => {
    if (!family || !editingBudgetCatId) return
    const monthCents = parseBRLToCents(monthAmountStr)
    if (monthCents <= 0) return

    try {
      setSavingBudget(true)
      await upsertDefaultBudget(family.id, editingBudgetCatId, monthCents, editingBudgetSubcatId)
      // Remove o override pois agora é o próprio padrão
      await resetMonthBudgetToDefault(
        family.id,
        editingBudgetCatId,
        monthKey,
        editingBudgetSubcatId,
      )
      toast({
        title: 'Definido como padrão',
        description: 'Este valor agora é o teto padrão para todos os meses.',
      })
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
      {/* ABAS SEGMENTADAS NO TOPO (Botões nativos para evitar conflito Radix Tabs / React 19) */}
      <div className="w-full">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="bg-slate-100 p-1 rounded-2xl w-full sm:w-72 grid grid-cols-2">
            <button
              type="button"
              onClick={() => setActiveTab('transacoes')}
              className={`rounded-xl font-semibold text-xs py-2 transition-all ${
                activeTab === 'transacoes'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Transações
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('orcamentos')}
              className={`rounded-xl font-semibold text-xs py-2 transition-all ${
                activeTab === 'orcamentos'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Orçamentos
            </button>
          </div>

          {/* Seletor de Mês Compartilhado & Botão de Importação Proeminente */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <Button
              onClick={openImportStatement}
              variant="outline"
              size="sm"
              className="rounded-2xl border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-600 font-bold text-xs gap-1.5 shadow-sm transition-all"
            >
              <UploadCloud className="w-4 h-4 text-emerald-700" />
              <span>Importar extrato</span>
            </Button>

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
        </div>

        {/* ================= TAB 1: TRANSAÇÕES ================= */}
        {activeTab === 'transacoes' && (
          <div className="space-y-5 mt-0 animate-in fade-in-50 duration-200">
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
              <div className="py-12 text-center text-slate-400 text-xs">
                Carregando transações...
              </div>
            ) : groupedTransactions.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center text-slate-400 mb-2">
                  🏷️
                </div>
                <p className="font-bold text-slate-800 text-sm">Nenhuma transação encontrada</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  {activeFiltersCount > 0
                    ? 'Tente remover os filtros selecionados.'
                    : 'Nenhum lançamento registrado neste mês. Você pode lançar manualmente ou importar seu extrato bancário.'}
                </p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Button
                    onClick={openImportStatement}
                    variant="outline"
                    className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xs rounded-xl"
                  >
                    <UploadCloud className="w-4 h-4 mr-1.5 text-emerald-600" />
                    Importar Extrato (CSV, OFX, PDF)
                  </Button>
                  <Button
                    onClick={() => openNewTransaction('expense')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nova transação
                  </Button>
                </div>
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
                      <span className="font-bold text-xs text-slate-700">
                        {formatDayGroupHeader(dateKey)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        <span>{dayTxs.length}</span>{' '}
                        <span>{dayTxs.length === 1 ? 'item' : 'itens'}</span>
                      </span>
                    </div>

                    {/* Lista de itens do dia */}
                    <div className="divide-y divide-slate-100">
                      {dayTxs.map((tx) => {
                        const isIncome = tx.type === 'income'
                        return (
                          <div
                            key={tx.id}
                            onClick={() => {
                              setSelectedTx(tx)
                              setIsDetailOpen(true)
                            }}
                            className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors group cursor-pointer"
                          >
                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
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
                                    <span className="text-[11px] text-slate-500 font-medium">
                                      <span>{tx.category.name}</span>
                                      {tx.subcategory && (
                                        <span className="text-emerald-700 font-semibold ml-1">
                                          · {tx.subcategory.name}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                              <span
                                className={`font-bold text-sm sm:text-base tabular-nums ${
                                  isIncome ? 'text-emerald-600' : 'text-red-600'
                                }`}
                              >
                                <span>{isIncome ? '+' : '−'}</span>{' '}
                                <span>{formatBRL(tx.amount_cents)}</span>
                              </span>

                              {/* Botões de Ação Rápida (visíveis no hover apenas em telas sm+) */}
                              <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingTx(tx)
                                    setIsEditTxOpen(true)
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setTxToDelete(tx)
                                  }}
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
          </div>
        )}

        {/* ================= TAB 2: ORÇAMENTOS ================= */}
        {activeTab === 'orcamentos' && (
          <div className="space-y-5 mt-0 animate-in fade-in-50 duration-200">
            {/* Card Geral de Orçamento Recorrente */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
                    <span>Teto Orçamentário de</span> <span>{formatMonthYear(currentDate)}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">· Padrão mensal</span>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full self-start sm:self-auto ${
                    categoryBudgetData.isTotalOver
                      ? 'bg-red-100 text-red-700'
                      : categoryBudgetData.totalPercent >= 75
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <span>
                    {categoryBudgetData.isTotalOver
                      ? `Excedeu ${formatBRL(Math.abs(categoryBudgetData.totalRemaining))}`
                      : `Disponível ${formatBRL(categoryBudgetData.totalRemaining)}`}
                  </span>
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-3">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  <span>{formatBRL(categoryBudgetData.totalSpent)}</span>{' '}
                  <span className="text-sm font-medium text-slate-400">
                    / {formatBRL(categoryBudgetData.totalBudget)}
                  </span>
                </span>
                <span className="text-sm font-bold text-slate-600 tabular-nums">
                  <span>{categoryBudgetData.totalPercent}%</span>
                </span>
              </div>

              {/* Barra de Progresso com Limites: <75% Verde, 75-100% Âmbar, >100% Vermelho */}
              <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    categoryBudgetData.isTotalOver
                      ? 'bg-red-500'
                      : categoryBudgetData.totalPercent >= 75
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(categoryBudgetData.totalPercent, 100)}%` }}
                />
              </div>

              <div className="text-[11px] text-slate-400 mt-2 text-right">
                <span>Tetos recorrentes mensais</span>
              </div>
            </div>

            {/* Lista de Orçamentos com Hierarquia Categoria Pai -> Subcategorias */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900">Categorias e Subcategorias</h3>
                  <p className="text-xs text-slate-500">
                    Defina tetos por categoria ou detalhe por subcategoria. Valores ajustados
                    exclusivamente neste mês recebem destaque.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {categoryBudgetData.list.map((item) => {
                  const isExpanded =
                    expandedBudgetCategories[item.category.id] ??
                    (item.limitCents > 0 || item.spentCents > 0)
                  const hasSubcats = item.subcategories.length > 0

                  return (
                    <div
                      key={item.category.id}
                      className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs transition-all"
                    >
                      {/* Bloco da Categoria Pai */}
                      <div
                        onClick={() =>
                          openBudgetEditor(
                            item.category.id,
                            null,
                            item.defaultLimitCents,
                            item.limitCents,
                            item.hasOverride,
                          )
                        }
                        className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors group gap-2"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0"
                            style={{ backgroundColor: item.category.color || '#64748B' }}
                          >
                            <CategoryIcon name={item.category.icon} className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                {item.category.name}
                              </span>
                            </div>

                            <p className="text-xs text-slate-500 tabular-nums mt-0.5 flex items-center gap-1 truncate">
                              <span>{formatBRL(item.spentCents)}</span>
                              <span>de</span>
                              <span className="font-medium text-slate-700">
                                {item.limitCents > 0 ? formatBRL(item.limitCents) : 'Sem teto'}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Progresso / Barra de Cor da Categoria Pai */}
                        <div className="flex items-center gap-2 text-right shrink-0">
                          {item.limitCents > 0 ? (
                            <div className="w-16 sm:w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  item.isOver
                                    ? 'bg-red-500'
                                    : item.percent >= 75
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-600'
                                }`}
                                style={{ width: `${Math.min(item.percent, 100)}%` }}
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-700 group-hover:underline">
                              + Definir teto
                            </span>
                          )}

                          {hasSubcats && (
                            <button
                              type="button"
                              onClick={(e) => toggleCatBudgetExpand(item.category.id, e)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg ml-0.5 transition-colors"
                              title={
                                isExpanded ? 'Recolher subcategorias' : 'Expandir subcategorias'
                              }
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Linhas Aninhadas: Subcategorias com Recuo e Visual Suave */}
                      {hasSubcats && isExpanded && (
                        <div
                          key={`budget-subcats-${item.category.id}`}
                          className="bg-slate-50/60 border-t border-slate-100 divide-y divide-slate-100/80 pl-4 sm:pl-7 pr-3 py-1"
                        >
                          {item.subcategories.map((subItem) => (
                            <div
                              key={`budget-sub-${subItem.subcategory.id}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                openBudgetEditor(
                                  item.category.id,
                                  subItem.subcategory.id,
                                  subItem.defaultLimitCents,
                                  subItem.limitCents,
                                  subItem.hasOverride,
                                )
                              }}
                              className="py-2.5 flex items-center justify-between hover:bg-white rounded-xl px-2 cursor-pointer transition-colors group/sub"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/sub:bg-emerald-500 transition-colors" />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-slate-700 group-hover/sub:text-emerald-700 transition-colors">
                                      {subItem.subcategory.name}
                                    </span>
                                    {subItem.hasOverride && (
                                      <span className="text-[11px] font-semibold bg-amber-100/80 text-amber-900 border border-amber-200/80 px-2 py-0.5 rounded-full leading-tight">
                                        ajustado
                                      </span>
                                    )}
                                    {subItem.isOver && (
                                      <AlertTriangle className="w-3 h-3 text-red-500" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 tabular-nums flex items-center gap-1">
                                    <span>{formatBRL(subItem.spentCents)}</span>
                                    <span>de</span>
                                    <span>
                                      {subItem.limitCents > 0
                                        ? formatBRL(subItem.limitCents)
                                        : 'Não definido'}
                                    </span>
                                  </p>
                                </div>
                              </div>

                              {/* Progresso Subcategoria */}
                              <div className="flex items-center gap-2">
                                {subItem.limitCents > 0 ? (
                                  <div className="text-right">
                                    <span
                                      className={`text-[11px] font-bold tabular-nums ${
                                        subItem.isOver
                                          ? 'text-red-600'
                                          : subItem.percent >= 75
                                            ? 'text-amber-600'
                                            : 'text-emerald-600'
                                      }`}
                                    >
                                      {subItem.percent}%
                                    </span>
                                    <div className="w-14 bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-0.5">
                                      <div
                                        className={`h-full rounded-full ${
                                          subItem.isOver
                                            ? 'bg-red-500'
                                            : subItem.percent >= 75
                                              ? 'bg-amber-500'
                                              : 'bg-emerald-600'
                                        }`}
                                        style={{ width: `${Math.min(subItem.percent, 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[11px] font-medium text-emerald-700 opacity-80 group-hover/sub:opacity-100 group-hover/sub:underline">
                                    + Definir
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

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

            {/* Categorias e Subcategorias */}
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

            {/* Subcategorias disponíveis (se categorias estiverem selecionadas) */}
            {filterCategoryIds.length > 0 && (
              <div>
                <Label className="text-xs font-semibold text-slate-700">Subcategorias</Label>
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-32 overflow-y-auto">
                  {categories
                    .filter((c) => filterCategoryIds.includes(c.id))
                    .flatMap((c) => c.subcategories || [])
                    .map((s) => {
                      const selected = filterSubcategoryIds.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            if (selected) {
                              setFilterSubcategoryIds((prev) => prev.filter((id) => id !== s.id))
                            } else {
                              setFilterSubcategoryIds((prev) => [...prev, s.id])
                            }
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                            selected
                              ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {s.name}
                        </button>
                      )
                    })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setFilterMemberIds([])
                setFilterCategoryIds([])
                setFilterSubcategoryIds([])
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

      {/* DIÁLOGO PROFISSIONAL DE ORÇAMENTO RECORRENTE & AJUSTE PONTUAL */}
      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Orçamento Recorrente e Ajustes
            </DialogTitle>
          </DialogHeader>

          {(() => {
            const currentCat = categories.find((c) => c.id === editingBudgetCatId)
            const currentSub = currentCat?.subcategories?.find(
              (s) => s.id === editingBudgetSubcatId,
            )

            return (
              <form onSubmit={handleSaveBudgetForm} className="space-y-4">
                {/* Identificação Categoria/Subcategoria */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: currentCat?.color || '#64748B' }}
                  >
                    <CategoryIcon name={currentCat?.icon} className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      {currentSub ? 'Subcategoria' : 'Categoria Principal'}
                    </span>
                    <p className="font-bold text-slate-900 text-sm truncate">
                      {currentCat?.name}
                      {currentSub && (
                        <span className="text-emerald-700 font-semibold ml-1">
                          ▸ {currentSub.name}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Alternador de Escopo: Padrão Recorrente vs Ajuste Deste Mês */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setIsEditingOnlyThisMonth(false)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                      !isEditingOnlyThisMonth
                        ? 'bg-white text-emerald-800 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Padrão Recorrente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingOnlyThisMonth(true)
                      if (!monthAmountStr && defaultAmountStr) {
                        setMonthAmountStr(defaultAmountStr)
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                      isEditingOnlyThisMonth
                        ? 'bg-white text-emerald-800 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Só {formatMonthYear(currentDate)}
                  </button>
                </div>

                {/* 1. Modo: Padrão Recorrente */}
                {!isEditingOnlyThisMonth && (
                  <div className="space-y-2 bg-emerald-50/50 border border-emerald-200/60 p-4 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="bg-default-amount"
                        className="text-xs font-bold text-slate-800"
                      >
                        Teto Padrão Mensal (R$)
                      </Label>
                      <span className="text-[10px] text-emerald-700 font-medium">
                        Repete em todos os meses
                      </span>
                    </div>

                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                        R$
                      </span>
                      <Input
                        id="bg-default-amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={defaultAmountStr}
                        onChange={(e) => setDefaultAmountStr(e.target.value)}
                        className="pl-10 text-lg font-bold tabular-nums bg-white"
                        autoFocus
                        required
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Este teto serve como base automática para todos os meses futuros sem
                      necessidade de recriar.
                    </p>
                  </div>
                )}

                {/* 2. Modo: Ajuste pontual deste mês */}
                {isEditingOnlyThisMonth && (
                  <div className="space-y-3 bg-amber-50/40 border border-amber-200/70 p-4 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bg-month-amount" className="text-xs font-bold text-slate-800">
                        Teto Específico para {formatMonthYear(currentDate)} (R$)
                      </Label>
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                        Apenas este mês
                      </span>
                    </div>

                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                        R$
                      </span>
                      <Input
                        id="bg-month-amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={monthAmountStr}
                        onChange={(e) => setMonthAmountStr(e.target.value)}
                        className="pl-10 text-lg font-bold tabular-nums bg-white"
                        autoFocus
                        required
                      />
                    </div>

                    {defaultAmountStr && (
                      <p className="text-[11px] text-slate-500">
                        Valor padrão configurado:{' '}
                        <strong className="text-slate-700">R$ {defaultAmountStr}</strong>. Os demais
                        meses continuam com o teto padrão.
                      </p>
                    )}

                    {/* Botão de Ação: Voltar ao padrão ou Replicar para o ano todo */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {hasMonthOverride && (
                        <button
                          type="button"
                          onClick={handleResetToDefault}
                          disabled={savingBudget}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs hover:bg-slate-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Voltar ao padrão
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleMakeThisMonthDefault}
                        disabled={savingBudget || !monthAmountStr}
                        className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-100/70 hover:bg-emerald-100 border border-emerald-300/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Tornar padrão de todos os meses
                      </button>
                    </div>
                  </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsBudgetDialogOpen(false)}
                    disabled={savingBudget}
                    className="rounded-xl text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingBudget}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-sm"
                  >
                    {savingBudget && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isEditingOnlyThisMonth ? 'Salvar Ajuste do Mês' : 'Salvar Orçamento Padrão'}
                  </Button>
                </DialogFooter>
              </form>
            )
          })()}
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
      {isEditTxOpen && (
        <NewTransactionDialog
          open={isEditTxOpen}
          onOpenChange={(open) => {
            setIsEditTxOpen(open)
            if (!open) setEditingTx(null)
          }}
          editingTransaction={editingTx}
          onSuccess={() => loadMonthData()}
        />
      )}

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
