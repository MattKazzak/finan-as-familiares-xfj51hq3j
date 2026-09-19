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
import { CategoryIcon, AVAILABLE_ICONS } from '@/components/common/CategoryIcon'
import { RecurringIncomesDialog } from '@/components/wallet/RecurringIncomesDialog'
import {
  fetchRecurringIncomes,
  fetchRecurringIncomeOverrides,
  processAutoRecurringIncomes,
} from '@/services/recurring-incomes'
import {
  CategoryEditorPopover,
  CATEGORY_COLORS,
} from '@/components/categories/CategoryEditorPopover'
import { SubcategoryEditorPopover } from '@/components/categories/SubcategoryEditorPopover'
import {
  DeleteCategoryConfirmDialog,
  DeleteSubcategoryConfirmDialog,
} from '@/components/categories/DeleteCategoryConfirmDialog'
import type { RecurringIncome, RecurringIncomeOverride } from '@/types/finance'
import { TransactionDetailDialog } from '@/components/transactions/TransactionDetailDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import { useToast } from '@/hooks/use-toast'
import type {
  Transaction,
  Budget,
  DefaultBudget,
  TransactionCategory,
  TransactionSubcategory,
  BudgetBucket,
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
  Tag,
  Briefcase,
  MoreVertical,
  Menu,
  GripVertical,
} from 'lucide-react'
import { SortableList } from '@/components/common/SortableList'
import { ApplyBudgetModelDialog } from '@/components/wallet/ApplyBudgetModelDialog'
import { BudgetOverviewCard } from '@/components/wallet/BudgetOverviewCard'
import { BUCKET_METADATA } from '@/types/budget-presets'
import { updateCategoryBudgetPercent, updateCategoryBudgetAmount } from '@/services/budget-model'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
    addNewCategory,
    editCategory,
    removeCategory,
    checkCategoryUsage,
    addNewSubcategory,
    editSubcategory,
    removeSubcategory,
    checkSubcategoryUsage,
    reorderCategoriesList,
    reorderSubcategoriesList,
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
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([])
  const [recurringOverrides, setRecurringOverrides] = useState<RecurringIncomeOverride[]>([])
  const [loading, setLoading] = useState(true)

  // Diálogo de Receitas Fixas
  const [isRecurringIncomesOpen, setIsRecurringIncomesOpen] = useState(false)

  // Estados para disparar ações a partir de itens do menu dropdown mobile
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false)
  const [categoryToEdit, setCategoryToEdit] = useState<TransactionCategory | null>(null)
  const [categoryEditorName, setCategoryEditorName] = useState('')
  const [categoryEditorType, setCategoryEditorType] = useState<'income' | 'expense'>('expense')
  const [categoryEditorColor, setCategoryEditorColor] = useState('#3B82F6')
  const [categoryEditorIcon, setCategoryEditorIcon] = useState('Tag')
  const [categoryEditorBucket, setCategoryEditorBucket] = useState<BudgetBucket>('essentials')
  const [savingCategoryEditor, setSavingCategoryEditor] = useState(false)

  const [isNewSubcatDialogOpen, setIsNewSubcatDialogOpen] = useState(false)
  const [categoryForNewSubcat, setCategoryForNewSubcat] = useState<TransactionCategory | null>(null)
  const [newSubcatName, setNewSubcatName] = useState('')
  const [savingNewSubcat, setSavingNewSubcat] = useState(false)

  // Estados de confirmação para exclusão inline com verificação de uso no banco
  const [categoryToDelete, setCategoryToDelete] = useState<TransactionCategory | null>(null)
  const [categoryUsageCount, setCategoryUsageCount] = useState<number>(0)
  const [loadingCatUsage, setLoadingCatUsage] = useState<boolean>(false)

  const [subcategoryToDelete, setSubcategoryToDelete] = useState<TransactionSubcategory | null>(
    null,
  )
  const [subcatParentCategoryName, setSubcatParentCategoryName] = useState<string>('')
  const [subcategoryUsageCount, setSubcategoryUsageCount] = useState<number>(0)
  const [loadingSubUsage, setLoadingSubUsage] = useState<boolean>(false)

  // Iniciar exclusão de categoria com contagem
  const handleInitiateDeleteCategory = async (cat: TransactionCategory, e: React.MouseEvent) => {
    e.stopPropagation()
    setCategoryToDelete(cat)
    setCategoryUsageCount(0)
    setLoadingCatUsage(true)
    try {
      const count = await checkCategoryUsage(cat.id)
      setCategoryUsageCount(count)
    } catch (err) {
      console.error('Erro ao verificar uso da categoria:', err)
      setCategoryUsageCount(0)
    } finally {
      setLoadingCatUsage(false)
    }
  }

  // Confirmar exclusão de categoria
  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return
    try {
      await removeCategory(categoryToDelete.id)
      triggerRefresh()
      await loadMonthData()
    } catch {
      toast({
        title: 'Erro ao excluir categoria',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  // Iniciar exclusão de subcategoria com contagem
  const handleInitiateDeleteSubcategory = async (
    sub: TransactionSubcategory,
    parentName: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    setSubcategoryToDelete(sub)
    setSubcatParentCategoryName(parentName)
    setSubcategoryUsageCount(0)
    setLoadingSubUsage(true)
    try {
      const count = await checkSubcategoryUsage(sub.id)
      setSubcategoryUsageCount(count)
    } catch (err) {
      console.error('Erro ao verificar uso da subcategoria:', err)
      setSubcategoryUsageCount(0)
    } finally {
      setLoadingSubUsage(false)
    }
  }

  // Confirmar exclusão de subcategoria
  const handleConfirmDeleteSubcategory = async () => {
    if (!subcategoryToDelete) return
    try {
      await removeSubcategory(subcategoryToDelete.id)
      triggerRefresh()
      await loadMonthData()
    } catch {
      toast({
        title: 'Erro ao excluir subcategoria',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

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
  const [editingPercentStr, setEditingPercentStr] = useState('')
  const [isEditingOnlyThisMonth, setIsEditingOnlyThisMonth] = useState(false)
  const [hasMonthOverride, setHasMonthOverride] = useState(false)
  const [savingBudget, setSavingBudget] = useState(false)
  const [isApplyModelOpen, setIsApplyModelOpen] = useState(false)

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

      // Auto-lançamento de receitas fixas idempotente para o mês selecionado
      try {
        await processAutoRecurringIncomes({
          familyId: family.id,
          targetMonthStr: monthKey,
        })
      } catch (autoErr) {
        console.warn('Erro ao processar auto-lançamento:', autoErr)
      }

      const [txs, defBgs, overrides, recIncomes, recOverrides] = await Promise.all([
        fetchTransactions({
          familyId: family.id,
          month: monthKey,
        }),
        fetchDefaultBudgets(family.id),
        fetchMonthBudgetOverrides(family.id, monthKey),
        fetchRecurringIncomes(family.id),
        fetchRecurringIncomeOverrides(family.id, monthKey),
      ])
      setTransactions(txs)
      setDefaultBudgets(defBgs)
      setMonthOverrides(overrides)
      setRecurringIncomes(recIncomes)
      setRecurringOverrides(recOverrides)
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

  // Previsão do Mês: Receitas Fixas Recorrentes vs Tetos de Despesa Orçados
  const forecastData = useMemo(() => {
    const overrideMap = new Map<string, number>()
    recurringOverrides.forEach((o) => overrideMap.set(o.recurring_income_id, o.amount_cents))

    // Soma das receitas fixas ativas (usando override deste mês se houver)
    let totalPlannedIncomeCents = 0
    recurringIncomes.forEach((rec) => {
      if (rec.active) {
        const amt = overrideMap.has(rec.id) ? overrideMap.get(rec.id)! : rec.amount_cents
        totalPlannedIncomeCents += amt
      }
    })

    return {
      totalPlannedIncomeCents,
      totalRecurringCount: recurringIncomes.filter((r) => r.active).length,
    }
  }, [recurringIncomes, recurringOverrides])

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

      const explicitLimitCents = catOverride
        ? catOverride.amount_cents
        : catDefault
          ? catDefault.amount_cents
          : 0
      const defaultLimitCents = catDefault ? catDefault.amount_cents : 0

      // Regra de agregação padrão de mercado:
      // Quando a categoria possui tetos definidos nas subcategorias, o teto exibido da categoria pai
      // é a soma das subcategorias. Caso não haja tetos em subcategorias, usa o teto definido no próprio pai.
      const hasSubcatLimits = subcatsLimitSum > 0
      const limitCents = hasSubcatLimits ? subcatsLimitSum : explicitLimitCents

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
        hasSubcatLimits,
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

    // A ordem respeita prioritariamente a ordem customizada definida pelo usuário (sort_order da categoria)
    // Se o sort_order for igual, desempata pelo nome
    list.sort((a, b) => {
      const orderA = a.category.sort_order ?? 0
      const orderB = b.category.sort_order ?? 0
      if (orderA !== orderB) return orderA - orderB
      return a.category.name.localeCompare(b.category.name)
    })

    // Agrupamento por Baldes do modelo 3 Baldes (Essenciais, Estilo de Vida, Futuro & Metas)
    // 100% das categorias de despesas pertencem a um dos 3 baldes.
    const netIncomeCents = family?.monthly_net_income_cents || 0
    const bucketsSummary = {
      essentials: { budgetCents: 0, spentCents: 0, percentIncome: 0 },
      lifestyle: { budgetCents: 0, spentCents: 0, percentIncome: 0 },
      future: { budgetCents: 0, spentCents: 0, percentIncome: 0 },
      other: { budgetCents: 0, spentCents: 0, percentIncome: 0 },
    }

    list.forEach((item) => {
      // Caso haja alguma anomalia legada sem balde, direciona preventivamente pelo nome ou estilo de vida
      const rawBucket = item.category.budget_bucket
      let bucket: 'essentials' | 'lifestyle' | 'future' = 'lifestyle'
      if (rawBucket === 'essentials' || rawBucket === 'lifestyle' || rawBucket === 'future') {
        bucket = rawBucket
      } else {
        const catNameLower = (item.category.name || '').toLowerCase()
        if (
          catNameLower.includes('moradia') ||
          catNameLower.includes('alimenta') ||
          catNameLower.includes('saúde') ||
          catNameLower.includes('saude') ||
          catNameLower.includes('transporte') ||
          catNameLower.includes('serviço') ||
          catNameLower.includes('servico')
        ) {
          bucket = 'essentials'
        } else if (
          catNameLower.includes('reserva') ||
          catNameLower.includes('invest') ||
          catNameLower.includes('meta')
        ) {
          bucket = 'future'
        } else {
          bucket = 'lifestyle'
        }
      }

      bucketsSummary[bucket].budgetCents += item.limitCents
      bucketsSummary[bucket].spentCents += item.spentCents
    })

    if (netIncomeCents > 0) {
      bucketsSummary.essentials.percentIncome = Math.round(
        (bucketsSummary.essentials.budgetCents / netIncomeCents) * 100,
      )
      bucketsSummary.lifestyle.percentIncome = Math.round(
        (bucketsSummary.lifestyle.budgetCents / netIncomeCents) * 100,
      )
      bucketsSummary.future.percentIncome = Math.round(
        (bucketsSummary.future.budgetCents / netIncomeCents) * 100,
      )
      bucketsSummary.other.percentIncome = 0
    }

    const totalBudgetPercentOfIncome =
      netIncomeCents > 0 ? Math.round((totalBudget / netIncomeCents) * 100) : 0

    return {
      list,
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      totalPercent:
        totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0,
      isTotalOver: totalSpent > totalBudget && totalBudget > 0,
      bucketsSummary,
      totalBudgetPercentOfIncome,
    }
  }, [categories, transactions, defaultBudgets, monthOverrides, family])

  // Abrir modal de edição de orçamento (para categoria pai ou subcategoria)
  const openBudgetEditor = (
    catId: string,
    subcatId: string | null = null,
    currentDefault?: number,
    currentMonthVal?: number,
    isOverridden: boolean = false,
    currentPercent?: number | null,
  ) => {
    setEditingBudgetCatId(catId)
    setEditingBudgetSubcatId(subcatId)
    setDefaultAmountStr(currentDefault && currentDefault > 0 ? formatNumberBRL(currentDefault) : '')
    setMonthAmountStr(
      currentMonthVal && currentMonthVal > 0 ? formatNumberBRL(currentMonthVal) : '',
    )
    setEditingPercentStr(
      currentPercent !== undefined && currentPercent !== null ? String(currentPercent) : '',
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
    e.stopPropagation()
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

        // Se estiver editando a categoria pai e houver percentual ou renda familiar
        if (!editingBudgetSubcatId) {
          const netIncome = family.monthly_net_income_cents || 0
          if (editingPercentStr.trim() !== '') {
            const pVal = parseFloat(editingPercentStr.replace(',', '.'))
            if (!isNaN(pVal)) {
              await updateCategoryBudgetPercent({
                familyId: family.id,
                categoryId: editingBudgetCatId,
                monthlyNetIncomeCents: netIncome,
                newPercent: pVal,
              })
            }
          } else if (netIncome > 0 && defCents > 0) {
            await updateCategoryBudgetAmount({
              familyId: family.id,
              categoryId: editingBudgetCatId,
              monthlyNetIncomeCents: netIncome,
              newAmountCents: defCents,
            })
          }
        }

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
      triggerRefresh()
      await loadMonthData()
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
      triggerRefresh()
      await loadMonthData()
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
      triggerRefresh()
      await loadMonthData()
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

          {/* Seletor de Mês Compartilhado */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
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
        {activeTab === 'transacoes' ? (
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

            {/* Barra de Filtro, Atalho de Receitas Fixas, Importar Extrato e Contagem */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={openImportStatement}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-600 font-bold text-xs gap-1.5 shadow-sm transition-all"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-700" />
                  <span>Importar extrato</span>
                </Button>

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
                  <span>Filtrar</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRecurringIncomesOpen(true)}
                  className="rounded-xl text-xs font-semibold gap-1.5 border-emerald-600/30 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100/70"
                >
                  <Briefcase className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Receitas fixas</span>
                  {forecastData.totalRecurringCount > 0 ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-700 text-white text-[10px] flex items-center justify-center font-bold">
                      {forecastData.totalRecurringCount}
                    </span>
                  ) : null}
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
                {`${filteredTransactions.length} ${filteredTransactions.length === 1 ? 'transação' : 'transações'}`}
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
                        <span>
                          {dayTxs.length} {dayTxs.length === 1 ? 'item' : 'itens'}
                        </span>
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
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <p className="font-semibold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                    {tx.description || tx.category?.name || 'Sem descrição'}
                                  </p>
                                  {tx.is_recurring ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/70 px-1.5 py-0.2 rounded-md shrink-0">
                                      <Sparkles className="w-2.5 h-2.5" />
                                      <span>Fixa</span>
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {tx.member?.name || 'Família'}
                                  </span>
                                  {tx.category && (
                                    <span className="text-[11px] text-slate-500 font-medium truncate">
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
                                <span>
                                  {isIncome ? '+' : '−'} {formatBRL(tx.amount_cents)}
                                </span>
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
        ) : null}

        {/* ================= TAB 2: ORÇAMENTOS ================= */}
        {activeTab === 'orcamentos' ? (
          <div className="space-y-5 mt-0 animate-in fade-in-50 duration-200">
            {/* Cabeçalho da Aba Orçamentos: Ações Rápidas (Receitas Fixas & Modelo Sugerido) */}
            <div className="flex items-center justify-between gap-2 flex-wrap bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  🎯
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-tight">
                    Planejamento & Orçamentos
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tetos baseados em percentuais da renda líquida familiar com liberdade total
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsApplyModelOpen(true)}
                  className="rounded-xl text-xs font-bold gap-1.5 border-emerald-600/30 text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 h-8 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Aplicar modelo sugerido</span>
                </Button>
              </div>
            </div>

            {/* CARD DE ONBOARDING LEVE (QUANDO A RENDA LÍQUIDA AINDA NÃO FOI DEFINIDA) */}
            {(!family?.monthly_net_income_cents || family.monthly_net_income_cents <= 0) && (
              <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white rounded-3xl p-5 shadow-sm border border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in-50 duration-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-white">
                      Defina a renda líquida mensal da família
                    </h4>
                    <p className="text-xs text-emerald-100/80 mt-1 max-w-xl leading-relaxed">
                      O app calcula os tetos ideais automaticamente com base na metodologia de
                      consultores financeiros (Essenciais 57%, Estilo de Vida 21%, Futuro 22%),
                      convertendo em reais e oferecendo total flexibilidade de personalização.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => setIsApplyModelOpen(true)}
                  className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-xs rounded-xl shadow-md self-start sm:self-center shrink-0 gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Configurar em 3 passos</span>
                </Button>
              </div>
            )}

            {/* PAINEL FLUÍDO E ORGÂNICO DOS 3 BALDES, RENDA LÍQUIDA E FAROL PREVENTIVO */}
            {family?.monthly_net_income_cents && family.monthly_net_income_cents > 0 ? (
              <BudgetOverviewCard
                family={family}
                bucketsSummary={categoryBudgetData.bucketsSummary}
                totalBudget={categoryBudgetData.totalBudget}
                totalBudgetPercentOfIncome={categoryBudgetData.totalBudgetPercentOfIncome}
                totalSpent={categoryBudgetData.totalSpent}
                currentDate={currentDate}
                monthKey={monthKey}
                categoryList={categoryBudgetData.list}
                onOpenModelDialog={() => setIsApplyModelOpen(true)}
              />
            ) : null}

            {/* CARD DE PREVISÃO DE CUSTO DE VIDA (RECEITAS FIXAS VS TETOS COMPROMETIDOS) */}
            {forecastData.totalPlannedIncomeCents > 0 || categoryBudgetData.totalBudget > 0 ? (
              <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-300">
                      Previsão de Custo de Vida · {formatMonthYear(currentDate)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRecurringIncomesOpen(true)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline self-start sm:self-auto transition-colors"
                  >
                    Editar receitas fixas ({forecastData.totalRecurringCount})
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                    <span className="text-[11px] uppercase tracking-wider text-emerald-300 font-bold block">
                      Receita Fixa Prevista
                    </span>
                    <span className="text-lg sm:text-xl font-bold tabular-nums text-white mt-0.5 block">
                      {formatBRL(forecastData.totalPlannedIncomeCents)}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {forecastData.totalRecurringCount} receita(s) recorrente(s)
                    </span>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                    <span className="text-[11px] uppercase tracking-wider text-amber-300 font-bold block">
                      Despesas Comprometidas
                    </span>
                    <span className="text-lg sm:text-xl font-bold tabular-nums text-white mt-0.5 block">
                      {formatBRL(categoryBudgetData.totalBudget)}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Soma dos tetos de gastos
                    </span>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                    <span className="text-[11px] uppercase tracking-wider text-slate-300 font-bold block">
                      Previsão do que Sobra
                    </span>
                    {(() => {
                      const netForecast =
                        forecastData.totalPlannedIncomeCents - categoryBudgetData.totalBudget
                      const isPositive = netForecast >= 0
                      return (
                        <>
                          <span
                            className={`text-lg sm:text-xl font-extrabold tabular-nums mt-0.5 block ${
                              isPositive ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isPositive ? '+' : '−'} {formatBRL(Math.abs(netForecast))}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            {isPositive ? 'Margem livre projetada' : 'Orçamento excede receitas'}
                          </span>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            ) : null}

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
                  <span>
                    {formatBRL(categoryBudgetData.totalSpent)}{' '}
                    <span className="text-sm font-medium text-slate-400">
                      / {formatBRL(categoryBudgetData.totalBudget)}
                    </span>
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

            {/* Lista de Orçamentos com Hierarquia Categoria Pai -> Subcategorias e Gestão Inline com Ícones */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-slate-900">Categorias e Subcategorias</h3>
                  <p className="text-xs text-slate-500">
                    Clique na linha para definir teto. Use o lápis para editar, o + para criar
                    subcategoria e a lixeira para excluir.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <CategoryEditorPopover
                    title="Nova Categoria"
                    defaultType="expense"
                    trigger={
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1.5 rounded-xl border border-emerald-600/20 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Nova categoria</span>
                      </button>
                    }
                    onSave={async (data) => {
                      try {
                        await addNewCategory(
                          data.name,
                          data.type,
                          data.color,
                          data.icon,
                          data.budget_bucket,
                        )
                        triggerRefresh()
                        await loadMonthData()
                      } catch (err: any) {
                        console.error('Erro ao criar categoria:', err)
                        toast({
                          title: 'Erro ao criar categoria',
                          description: err?.message || 'Tente novamente.',
                          variant: 'destructive',
                        })
                      }
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {categoryBudgetData.list.length === 0 ? (
                  <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <p className="text-sm font-semibold text-slate-600">
                      Nenhuma categoria de despesa cadastrada
                    </p>
                    <p className="text-xs text-slate-400 mt-1 mb-3">
                      Crie sua primeira categoria para organizar seu orçamento familiar.
                    </p>
                    <CategoryEditorPopover
                      title="Criar Primeira Categoria"
                      defaultType="expense"
                      trigger={
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Criar categoria</span>
                        </Button>
                      }
                      onSave={async (data) => {
                        try {
                          await addNewCategory(
                            data.name,
                            data.type,
                            data.color,
                            data.icon,
                            data.budget_bucket,
                          )
                          triggerRefresh()
                          await loadMonthData()
                        } catch (err: any) {
                          console.error('Erro ao criar categoria:', err)
                          toast({
                            title: 'Erro ao criar categoria',
                            description: err?.message || 'Tente novamente.',
                            variant: 'destructive',
                          })
                        }
                      }}
                    />
                  </div>
                ) : null}

                <SortableList
                  items={categoryBudgetData.list}
                  keyExtractor={(item) => item.category.id}
                  onReorder={async (newOrder) => {
                    const orderedIds = newOrder.map((it) => it.category.id)
                    await reorderCategoriesList(orderedIds)
                  }}
                  renderItem={(item, _idx, dragHandleProps, isDragging) => {
                    const isExpanded =
                      expandedBudgetCategories[item.category.id] ??
                      (item.limitCents > 0 || item.spentCents > 0)
                    const hasSubcats = item.subcategories.length > 0

                    return (
                      <div
                        className={`border rounded-2xl overflow-hidden bg-white transition-all ${
                          isDragging
                            ? 'border-emerald-500 shadow-xl'
                            : 'border-slate-200/80 shadow-2xs hover:border-slate-300'
                        }`}
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
                              item.category.percent_default,
                            )
                          }
                          className="p-3 sm:p-3.5 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors group gap-2.5 sm:gap-4 touch-manipulation"
                        >
                          {/* Coluna Esquerda: Drag handle + Ícone + Bloco textual em 2 linhas limpas */}
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                            {/* Ícone de arrasto ≡ para mobile e desktop */}
                            <button
                              type="button"
                              {...dragHandleProps}
                              onClick={(e) => e.stopPropagation()}
                              className="w-6 h-8 sm:w-7 sm:h-9 flex items-center justify-center text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0 touch-none rounded-lg hover:bg-slate-100 transition-colors"
                              title="Segure e arraste para reordenar"
                              aria-label={`Arrastar para reordenar categoria ${item.category.name}`}
                            >
                              <Menu className="w-4 h-4" />
                            </button>

                            <div
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0"
                              style={{ backgroundColor: item.category.color || '#64748B' }}
                            >
                              <CategoryIcon
                                name={item.category.icon}
                                className="w-4 h-4 sm:w-5 sm:h-5"
                              />
                            </div>

                            {/* Hierarquia de texto: Linha 1 = Nome + Badges | Linha 2 = Valores "R$ X de R$ Y" | Linha 3 = Ritmo */}
                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                              {/* Linha 1: Nome da categoria com badges compactos e truncamento limpo */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate"
                                  title={item.category.name}
                                >
                                  {item.category.name}
                                </span>

                                {/* Tag de Balde se houver */}
                                {item.category.budget_bucket && (
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 leading-none whitespace-nowrap ${
                                      BUCKET_METADATA[item.category.budget_bucket]?.bgLight ||
                                      'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {BUCKET_METADATA[item.category.budget_bucket]?.shortLabel}
                                  </span>
                                )}

                                {/* Percentual da renda se definido */}
                                {item.category.percent_default ? (
                                  <span className="hidden xs:inline-flex text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 rounded-md tabular-nums shrink-0 leading-none whitespace-nowrap">
                                    {item.category.percent_default}% da renda
                                  </span>
                                ) : null}

                                {/* Tag de ajuste manual se houver override */}
                                {item.hasOverride ? (
                                  <span className="text-[9px] font-semibold bg-amber-100/90 text-amber-900 border border-amber-200/80 px-1.5 py-0.5 rounded-md leading-none shrink-0 whitespace-nowrap">
                                    ajustado
                                  </span>
                                ) : null}
                              </div>

                              {/* Linha 2: Valores "R$ X de R$ Y" com tabular-nums e sem quebra feia */}
                              <div className="text-xs text-slate-500 tabular-nums mt-0.5 flex items-baseline gap-1 truncate">
                                <span className="font-semibold text-slate-800 shrink-0">
                                  {formatBRL(item.spentCents)}
                                </span>
                                <span className="text-slate-400 text-[11px] shrink-0">de</span>
                                <span className="text-slate-600 shrink-0">
                                  {item.limitCents > 0 ? formatBRL(item.limitCents) : 'Sem teto'}
                                </span>
                                {item.category.percent_default ? (
                                  <span className="xs:hidden text-[10px] text-emerald-700 font-medium ml-1 shrink-0">
                                    ({item.category.percent_default}%)
                                  </span>
                                ) : null}
                              </div>

                              {/* Linha 3: Farol preventivo discreto alinhado sob os valores */}
                              {(() => {
                                if (item.limitCents <= 0) return null

                                const isInvestmentCategory =
                                  item.category.name.toLowerCase().includes('reserva') ||
                                  item.category.name.toLowerCase().includes('invest') ||
                                  item.category.budget_bucket === 'future'

                                const now = new Date()
                                const isCurrentViewingMonth =
                                  now.toISOString().slice(0, 7) === monthKey

                                const daysInMonth = new Date(
                                  currentDate.getFullYear(),
                                  currentDate.getMonth() + 1,
                                  0,
                                ).getDate()
                                const currentDay = isCurrentViewingMonth ? now.getDate() : 1
                                const daysRemaining = Math.max(0, daysInMonth - currentDay)

                                // Lógica para Reserva & Investimentos: alerta quando aporte ficar ABAIXO do mínimo
                                if (isInvestmentCategory) {
                                  if (item.percent < 70) {
                                    return (
                                      <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1 truncate">
                                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                        <span className="truncate">
                                          Aporte em {item.percent}% do teto ideal. Priorize sua
                                          reserva.
                                        </span>
                                      </p>
                                    )
                                  }
                                  return (
                                    <p className="text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-1 truncate">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                      <span className="truncate">
                                        Meta de aportes saudável ({item.percent}% alcançado).
                                      </span>
                                    </p>
                                  )
                                }

                                // Regra preventiva padrão:
                                // 🔴 Acima de 90% ou 100%+
                                if (item.percent > 90) {
                                  return (
                                    <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1 truncate">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                                      <span className="truncate">
                                        {item.isOver
                                          ? `Estourou o teto em ${formatBRL(item.spentCents - item.limitCents)}!`
                                          : `Atenção: ${item.percent}% consumido do teto.`}
                                      </span>
                                    </p>
                                  )
                                }

                                // 🟡 71% a 90%: Alerta preventivo com dias restantes
                                if (item.percent >= 71) {
                                  return (
                                    <p className="text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1 truncate">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                      <span className="truncate">
                                        Já consumiu {item.percent}% do orçamento
                                        {daysRemaining > 0 && isCurrentViewingMonth
                                          ? ` (${daysRemaining} dias restantes).`
                                          : '.'}
                                      </span>
                                    </p>
                                  )
                                }

                                // 🟢 Até 70%: Verde ritmo saudável
                                return (
                                  <p className="text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-1 truncate">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className="truncate">
                                      Ritmo saudável ({item.percent}% consumido).
                                    </span>
                                  </p>
                                )
                              })()}
                            </div>
                          </div>

                          {/* Coluna Direita Fixa: Percentual + Barra de Progresso + Ações + Chevron (alinhados ao centro vertical) */}
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-center">
                            {/* Progresso / Barra com largura fixa padronizada para alinhamento entre todas as categorias */}
                            <div className="w-[42px] xs:w-[110px] sm:w-[130px] flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
                              {item.limitCents > 0 ? (
                                <>
                                  <span
                                    className={`text-xs font-bold tabular-nums min-w-[34px] sm:min-w-[38px] text-right shrink-0 leading-none ${
                                      item.isOver || item.percent > 90
                                        ? 'text-red-600'
                                        : item.percent >= 71
                                          ? 'text-amber-600'
                                          : 'text-emerald-600'
                                    }`}
                                  >
                                    {item.percent}%
                                  </span>
                                  <div className="hidden xs:block flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        item.isOver || item.percent > 90
                                          ? 'bg-red-500'
                                          : item.percent >= 71
                                            ? 'bg-amber-500'
                                            : 'bg-emerald-600'
                                      }`}
                                      style={{ width: `${Math.min(item.percent, 100)}%` }}
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="text-xs font-medium text-slate-400 tabular-nums min-w-[34px] sm:min-w-[38px] text-right shrink-0 leading-none">
                                    —
                                  </span>
                                  <div className="hidden xs:block flex-1 bg-slate-100/60 h-2 rounded-full" />
                                </>
                              )}
                            </div>

                            {/* AÇÕES DE GESTÃO: Desktop (barra com 3 botões em cápsula limpa) */}
                            <div
                              className="hidden md:flex items-center gap-0.5 bg-slate-100/70 p-0.5 rounded-xl border border-slate-200/60 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Lápis: Editar categoria */}
                              <CategoryEditorPopover
                                category={item.category}
                                trigger={
                                  <button
                                    type="button"
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-all"
                                    title="Editar categoria (nome, cor, ícone)"
                                    aria-label={`Editar categoria ${item.category.name}`}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                }
                                onSave={async (data) => {
                                  try {
                                    await editCategory(item.category.id, data)
                                    triggerRefresh()
                                    await loadMonthData()
                                  } catch (err: any) {
                                    console.error('Erro ao editar categoria:', err)
                                    toast({
                                      title: 'Erro ao editar categoria',
                                      description: err?.message || 'Tente novamente.',
                                      variant: 'destructive',
                                    })
                                  }
                                }}
                              />

                              {/* + : Criar subcategoria */}
                              <SubcategoryEditorPopover
                                parentCategoryName={item.category.name}
                                trigger={
                                  <button
                                    type="button"
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-700 hover:bg-white transition-all"
                                    title="Adicionar subcategoria"
                                    aria-label={`Adicionar subcategoria em ${item.category.name}`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                }
                                onSave={async (data) => {
                                  try {
                                    await addNewSubcategory(item.category.id, data.name)
                                    setExpandedBudgetCategories((prev) => ({
                                      ...prev,
                                      [item.category.id]: true,
                                    }))
                                    triggerRefresh()
                                    await loadMonthData()
                                  } catch (err: any) {
                                    console.error('Erro ao criar subcategoria:', err)
                                    toast({
                                      title: 'Erro ao criar subcategoria',
                                      description: err?.message || 'Tente novamente.',
                                      variant: 'destructive',
                                    })
                                  }
                                }}
                              />

                              {/* Lixeira: Excluir categoria */}
                              <button
                                type="button"
                                onClick={(e) => handleInitiateDeleteCategory(item.category, e)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white transition-all"
                                title="Excluir categoria"
                                aria-label={`Excluir categoria ${item.category.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* AÇÕES DE GESTÃO: Mobile / Tablet (< md) via Menu "Mais Opções" (⋯) */}
                            <div
                              className="flex md:hidden items-center shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                    title="Mais opções da categoria"
                                    aria-label={`Opções da categoria ${item.category.name}`}
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-48 rounded-2xl shadow-xl p-1.5 text-xs"
                                >
                                  <DropdownMenuItem
                                    onSelect={(e) => {
                                      e.preventDefault()
                                      const cat = item.category
                                      setCategoryToEdit(cat)
                                      setCategoryEditorName(cat.name || '')
                                      setCategoryEditorType(cat.type || 'expense')
                                      setCategoryEditorColor(cat.color || '#3B82F6')
                                      setCategoryEditorIcon(cat.icon || 'Tag')
                                      setCategoryEditorBucket(cat.budget_bucket || 'essentials')
                                      setTimeout(() => {
                                        setIsCategoryEditorOpen(true)
                                      }, 0)
                                    }}
                                    className="gap-2 py-2 rounded-xl cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Editar categoria</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={(e) => {
                                      e.preventDefault()
                                      const cat = item.category
                                      setCategoryForNewSubcat(cat)
                                      setNewSubcatName('')
                                      setTimeout(() => {
                                        setIsNewSubcatDialogOpen(true)
                                      }, 0)
                                    }}
                                    className="gap-2 py-2 rounded-xl cursor-pointer text-emerald-700 focus:text-emerald-800"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Nova subcategoria</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={(e) => {
                                      e.preventDefault()
                                      setTimeout(() => {
                                        handleInitiateDeleteCategory(item.category, e as any)
                                      }, 0)
                                    }}
                                    className="gap-2 py-2 rounded-xl cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    <span>Excluir categoria</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* Chevron de Expandir / Recolher Subcategorias */}
                            <div className="flex items-center shrink-0">
                              <button
                                type="button"
                                onClick={(e) => toggleCatBudgetExpand(item.category.id, e)}
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                title={
                                  isExpanded ? 'Recolher subcategorias' : 'Expandir subcategorias'
                                }
                                aria-label={
                                  isExpanded ? 'Recolher subcategorias' : 'Expandir subcategorias'
                                }
                              >
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform duration-200 ${
                                    isExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Linhas Aninhadas: Subcategorias com Recuo e Visual Suave OU Mensagem Vazia */}
                        {isExpanded ? (
                          <div
                            key={`budget-subcats-${item.category.id}`}
                            className="bg-slate-50/70 border-t border-slate-100 divide-y divide-slate-100/80 pl-3 sm:pl-6 pr-3 py-1.5"
                          >
                            {hasSubcats ? (
                              <SortableList
                                items={item.subcategories}
                                keyExtractor={(sub) => sub.subcategory.id}
                                className="space-y-1 divide-y-0"
                                onReorder={async (newSubOrder) => {
                                  const orderedSubIds = newSubOrder.map((s) => s.subcategory.id)
                                  await reorderSubcategoriesList(item.category.id, orderedSubIds)
                                }}
                                renderItem={(subItem, _sIdx, subDragHandleProps, isSubDragging) => (
                                  <div
                                    key={`budget-sub-${subItem.subcategory.id}`}
                                    onClick={() =>
                                      openBudgetEditor(
                                        item.category.id,
                                        subItem.subcategory.id,
                                        subItem.defaultLimitCents,
                                        subItem.limitCents,
                                        subItem.hasOverride,
                                      )
                                    }
                                    className={`py-2 px-2 sm:px-2.5 flex items-center justify-between rounded-xl cursor-pointer transition-colors group/sub gap-2.5 sm:gap-4 touch-manipulation ${
                                      isSubDragging ? 'bg-white shadow-md' : 'hover:bg-white'
                                    }`}
                                  >
                                    {/* Identificação da Subcategoria + Alça de arrasto da subcategoria */}
                                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                                      <button
                                        type="button"
                                        {...subDragHandleProps}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-5 h-6 flex items-center justify-center text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0 touch-none rounded hover:bg-slate-100 transition-colors"
                                        title="Arraste para reordenar subcategoria"
                                        aria-label={`Arrastar subcategoria ${subItem.subcategory.name}`}
                                      >
                                        <GripVertical className="w-3.5 h-3.5" />
                                      </button>
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/sub:bg-emerald-500 transition-colors shrink-0" />
                                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span
                                            className="text-xs font-semibold text-slate-700 group-hover/sub:text-emerald-700 transition-colors truncate leading-snug"
                                            title={subItem.subcategory.name}
                                          >
                                            {subItem.subcategory.name}
                                          </span>
                                          {subItem.hasOverride ? (
                                            <span className="text-[9px] font-semibold bg-amber-100/90 text-amber-900 border border-amber-200/80 px-1.5 py-0.2 rounded-md leading-none shrink-0 whitespace-nowrap">
                                              ajustado
                                            </span>
                                          ) : null}
                                          {subItem.isOver ? (
                                            <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                                          ) : null}
                                        </div>
                                        <div className="text-[11px] text-slate-500 tabular-nums mt-0.5 flex items-baseline gap-1 truncate">
                                          <span className="font-medium text-slate-700 shrink-0">
                                            {formatBRL(subItem.spentCents)}
                                          </span>
                                          <span className="text-slate-400 text-[10px] shrink-0">
                                            de
                                          </span>
                                          <span className="text-slate-500 shrink-0">
                                            {subItem.limitCents > 0
                                              ? formatBRL(subItem.limitCents)
                                              : 'Sem teto'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Lado Direito da Subcategoria: Coluna com largura e alinhamento idênticos ao card pai */}
                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-center">
                                      {/* Progresso / Percentual da Subcategoria (alinhado exatamente com a categoria pai) */}
                                      <div className="w-[42px] xs:w-[110px] sm:w-[130px] flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
                                        {subItem.limitCents > 0 ? (
                                          <>
                                            <span
                                              className={`text-xs font-bold tabular-nums min-w-[34px] sm:min-w-[38px] text-right shrink-0 leading-none ${
                                                subItem.isOver
                                                  ? 'text-red-600'
                                                  : subItem.percent >= 75
                                                    ? 'text-amber-600'
                                                    : 'text-emerald-600'
                                              }`}
                                            >
                                              {subItem.percent}%
                                            </span>
                                            <div className="hidden xs:block flex-1 bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full rounded-full transition-all ${
                                                  subItem.isOver
                                                    ? 'bg-red-500'
                                                    : subItem.percent >= 75
                                                      ? 'bg-amber-500'
                                                      : 'bg-emerald-600'
                                                }`}
                                                style={{
                                                  width: `${Math.min(subItem.percent, 100)}%`,
                                                }}
                                              />
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-xs font-medium text-slate-400 tabular-nums min-w-[34px] sm:min-w-[38px] text-right shrink-0 leading-none">
                                              —
                                            </span>
                                            <div className="hidden xs:block flex-1 bg-slate-200/40 h-1.5 rounded-full" />
                                          </>
                                        )}
                                      </div>

                                      {/* ÍCONES DE GESTÃO INLINE NA SUBCATEGORIA */}
                                      <div
                                        className="flex items-center gap-0.5 shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {/* Lápis: Renomear subcategoria E definir/editar teto orçamentário */}
                                        <SubcategoryEditorPopover
                                          subcategory={subItem.subcategory}
                                          parentCategoryName={item.category.name}
                                          showBudgetFields={true}
                                          initialDefaultLimitCents={subItem.defaultLimitCents}
                                          initialMonthLimitCents={subItem.limitCents}
                                          hasMonthOverride={subItem.hasOverride}
                                          currentMonthLabel={formatMonthYear(currentDate)}
                                          trigger={
                                            <button
                                              type="button"
                                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 transition-all"
                                              title="Editar subcategoria e teto"
                                              aria-label={`Editar subcategoria ${subItem.subcategory.name} e teto`}
                                            >
                                              <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                          }
                                          onSave={async (data) => {
                                            try {
                                              // 1. Atualiza nome se alterado
                                              if (
                                                data.name &&
                                                data.name !== subItem.subcategory.name
                                              ) {
                                                await editSubcategory(subItem.subcategory.id, {
                                                  name: data.name,
                                                })
                                              }

                                              // 2. Atualiza teto se fornecido
                                              if (family) {
                                                if (data.isEditingOnlyThisMonth) {
                                                  const monthCents = data.monthLimitCents || 0
                                                  await upsertMonthBudgetOverride(
                                                    family.id,
                                                    item.category.id,
                                                    monthKey,
                                                    monthCents,
                                                    subItem.subcategory.id,
                                                  )
                                                } else {
                                                  const defCents = data.defaultLimitCents || 0
                                                  await upsertDefaultBudget(
                                                    family.id,
                                                    item.category.id,
                                                    defCents,
                                                    subItem.subcategory.id,
                                                  )
                                                  // Se havia override pontual e salvou novo padrão, alinha o mês corrente
                                                  if (subItem.hasOverride) {
                                                    await resetMonthBudgetToDefault(
                                                      family.id,
                                                      item.category.id,
                                                      monthKey,
                                                      subItem.subcategory.id,
                                                    )
                                                  }
                                                }
                                              }

                                              triggerRefresh()
                                              await loadMonthData()
                                            } catch (err: any) {
                                              console.error(
                                                'Erro ao atualizar subcategoria ou teto:',
                                                err,
                                              )
                                              toast({
                                                title: 'Erro ao salvar',
                                                description: err?.message || 'Tente novamente.',
                                                variant: 'destructive',
                                              })
                                            }
                                          }}
                                        />

                                        {/* Lixeira: Excluir subcategoria com confirmação e contagem */}
                                        <button
                                          type="button"
                                          onClick={(e) =>
                                            handleInitiateDeleteSubcategory(
                                              subItem.subcategory,
                                              item.category.name,
                                              e,
                                            )
                                          }
                                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-slate-200/70 transition-all"
                                          title="Excluir subcategoria"
                                          aria-label={`Excluir subcategoria ${subItem.subcategory.name}`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {/* Espaçador idêntico ao chevron da categoria pai (w-7 shrink-0) para alinhamento estrito */}
                                      <div
                                        className="w-7 shrink-0 pointer-events-none"
                                        aria-hidden="true"
                                      />
                                    </div>
                                  </div>
                                )}
                              />
                            ) : (
                              /* Empty state amigável quando não houver subcategorias cadastradas */
                              <div className="py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                                <span className="italic text-slate-400">
                                  <span>Nenhuma subcategoria cadastrada</span>
                                </span>
                                <SubcategoryEditorPopover
                                  parentCategoryName={item.category.name}
                                  trigger={
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors self-start sm:self-auto"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Criar subcategoria</span>
                                    </button>
                                  }
                                  onSave={async (data) => {
                                    try {
                                      await addNewSubcategory(item.category.id, data.name)
                                      setExpandedBudgetCategories((prev) => ({
                                        ...prev,
                                        [item.category.id]: true,
                                      }))
                                      triggerRefresh()
                                      await loadMonthData()
                                    } catch (err: any) {
                                      console.error('Erro ao criar subcategoria:', err)
                                      toast({
                                        title: 'Erro ao criar subcategoria',
                                        description: err?.message || 'Tente novamente.',
                                        variant: 'destructive',
                                      })
                                    }
                                  }}
                                />
                              </div>
                            )}

                            {/* Botão rápido para adicionar subcategoria no fim do bloco expandido (quando já tem subcategorias) */}
                            {hasSubcats ? (
                              <div className="py-2 px-2.5">
                                <SubcategoryEditorPopover
                                  parentCategoryName={item.category.name}
                                  trigger={
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Adicionar subcategoria</span>
                                    </button>
                                  }
                                  onSave={async (data) => {
                                    try {
                                      await addNewSubcategory(item.category.id, data.name)
                                      triggerRefresh()
                                      await loadMonthData()
                                    } catch (err: any) {
                                      console.error('Erro ao criar subcategoria:', err)
                                      toast({
                                        title: 'Erro ao criar subcategoria',
                                        description: err?.message || 'Tente novamente.',
                                        variant: 'destructive',
                                      })
                                    }
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  }}
                />

                {/* Linha discreta no fim da lista: "+ Nova categoria" */}
                <div className="pt-2">
                  <CategoryEditorPopover
                    title="Nova Categoria"
                    defaultType="expense"
                    trigger={
                      <button
                        type="button"
                        className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-emerald-500/50 hover:bg-emerald-50/30 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-all"
                      >
                        <Plus className="w-4 h-4 text-emerald-600" />
                        <span>Nova categoria</span>
                      </button>
                    }
                    onSave={async (data) => {
                      try {
                        await addNewCategory(data.name, data.type, data.color, data.icon)
                        triggerRefresh()
                        await loadMonthData()
                      } catch (err: any) {
                        console.error('Erro ao criar categoria:', err)
                        toast({
                          title: 'Erro ao criar categoria',
                          description: err?.message || 'Tente novamente.',
                          variant: 'destructive',
                        })
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
            {filterCategoryIds.length > 0 ? (
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
                          <span>{s.name}</span>
                        </button>
                      )
                    })}
                </div>
              </div>
            ) : null}
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
                      {currentSub ? (
                        <span className="text-emerald-700 font-semibold ml-1">
                          <span>▸ </span>
                          <span>{currentSub.name}</span>
                        </span>
                      ) : null}
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
                    <span>Padrão Recorrente</span>
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
                    <span>Só {formatMonthYear(currentDate)}</span>
                  </button>
                </div>

                {/* 1. Modo: Padrão Recorrente */}
                {!isEditingOnlyThisMonth ? (
                  <div className="space-y-3 bg-emerald-50/50 border border-emerald-200/60 p-4 rounded-2xl">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                            R$
                          </span>
                          <Input
                            id="bg-default-amount"
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={defaultAmountStr}
                            onChange={(e) => {
                              const val = e.target.value
                              setDefaultAmountStr(val)
                              // Se houver renda da família, recalcula o % na hora
                              const netIncome = family?.monthly_net_income_cents || 0
                              const cents = parseBRLToCents(val)
                              if (netIncome > 0 && cents > 0) {
                                const p = Math.round((cents / netIncome) * 1000) / 10
                                setEditingPercentStr(String(p))
                              }
                            }}
                            className="pl-9 text-base font-bold tabular-nums bg-white h-10 rounded-xl"
                            autoFocus
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Valor em reais
                        </span>
                      </div>

                      {!editingBudgetSubcatId && (
                        <div>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              placeholder="Ex: 15"
                              value={editingPercentStr}
                              onChange={(e) => {
                                const pStr = e.target.value
                                setEditingPercentStr(pStr)
                                // Se houver renda da família, recalcula o valor em reais na hora
                                const netIncome = family?.monthly_net_income_cents || 0
                                const pVal = parseFloat(pStr.replace(',', '.'))
                                if (netIncome > 0 && !isNaN(pVal) && pVal >= 0) {
                                  const c = Math.round((netIncome * pVal) / 100)
                                  setDefaultAmountStr(formatNumberBRL(c))
                                }
                              }}
                              className="pr-8 text-base font-bold tabular-nums bg-white h-10 rounded-xl"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                              %
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            % da renda líquida
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Alterar o valor em reais ou a porcentagem atualiza automaticamente o outro
                      campo com base na renda líquida familiar (
                      {formatBRL(family?.monthly_net_income_cents || 0)}).
                    </p>
                  </div>
                ) : null}

                {/* 2. Modo: Ajuste pontual deste mês */}
                {isEditingOnlyThisMonth ? (
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
                      />
                    </div>

                    {defaultAmountStr ? (
                      <p className="text-[11px] text-slate-500">
                        <span>Valor padrão configurado: </span>
                        <strong className="text-slate-700">R$ {defaultAmountStr}</strong>
                        <span>. Os demais meses continuam com o teto padrão.</span>
                      </p>
                    ) : null}

                    {/* Botão de Ação: Voltar ao padrão ou Replicar para o ano todo */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {hasMonthOverride ? (
                        <button
                          type="button"
                          onClick={handleResetToDefault}
                          disabled={savingBudget}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs hover:bg-slate-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Voltar ao padrão</span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={handleMakeThisMonthDefault}
                        disabled={savingBudget || !monthAmountStr}
                        className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-100/70 hover:bg-emerald-100 border border-emerald-300/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Tornar padrão de todos os meses</span>
                      </button>
                    </div>
                  </div>
                ) : null}

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
                    <span className="flex items-center gap-2">
                      {savingBudget ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      <span>Salvar Alterações</span>
                    </span>
                  </Button>
                </DialogFooter>
              </form>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* MODAIS CONTROLADOS DE EDIÇÃO E CRIAÇÃO ACIONADOS VIA MENU DROPDOWN MOBILE */}
      <Dialog
        open={isCategoryEditorOpen}
        onOpenChange={(open) => {
          setIsCategoryEditorOpen(open)
          if (!open) setCategoryToEdit(null)
        }}
      >
        <DialogContent
          className="max-w-md w-[95vw] rounded-2xl p-5 text-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <DialogTitle className="text-base font-bold text-slate-900">
                <span>Editar Categoria</span>
              </DialogTitle>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: categoryEditorColor }}
                />
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  {categoryEditorType === 'income' ? 'Receita' : 'Despesa'}
                </span>
              </div>
            </div>
            <DialogDescription className="sr-only">
              <span>Edite o nome, tipo, cor e ícone da categoria selecionada.</span>
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              const trimmed = categoryEditorName.trim()
              const currentCat =
                categoryToEdit || categories.find((c) => c.name === categoryEditorName)
              if (!trimmed) {
                toast({
                  title: 'Nome obrigatório',
                  description: 'Informe o nome da categoria.',
                  variant: 'destructive',
                })
                return
              }
              if (!currentCat) {
                toast({
                  title: 'Categoria não encontrada',
                  description: 'Não foi possível identificar a categoria para edição.',
                  variant: 'destructive',
                })
                return
              }
              if (categoryEditorType === 'expense' && !categoryEditorBucket) {
                toast({
                  title: 'Balde obrigatório',
                  description: 'Selecione um balde orçamentário para a categoria.',
                  variant: 'destructive',
                })
                return
              }
              try {
                setSavingCategoryEditor(true)
                await editCategory(currentCat.id, {
                  name: trimmed,
                  type: categoryEditorType,
                  color: categoryEditorColor,
                  icon: categoryEditorIcon,
                  budget_bucket: categoryEditorType === 'expense' ? categoryEditorBucket : null,
                })
                toast({
                  title: 'Categoria atualizada',
                  description: 'As alterações foram salvas com sucesso.',
                })
                setIsCategoryEditorOpen(false)
                setCategoryToEdit(null)
                triggerRefresh()
                await loadMonthData()
              } catch (err: any) {
                console.error('Erro ao salvar categoria:', err)
                toast({
                  title: 'Erro ao salvar categoria',
                  description: err?.message || 'Tente novamente.',
                  variant: 'destructive',
                })
              } finally {
                setSavingCategoryEditor(false)
              }
            }}
            className="space-y-3.5 pt-1"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nome da categoria</Label>
              <Input
                type="text"
                placeholder="Ex.: Moradia, Transporte..."
                value={categoryEditorName}
                onChange={(e) => setCategoryEditorName(e.target.value)}
                className="h-9 text-xs rounded-xl"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600">Tipo</Label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCategoryEditorType('expense')}
                    className={`text-[11px] font-semibold py-1 rounded-md transition-all ${
                      categoryEditorType === 'expense'
                        ? 'bg-white text-red-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Despesa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryEditorType('income')}
                    className={`text-[11px] font-semibold py-1 rounded-md transition-all ${
                      categoryEditorType === 'income'
                        ? 'bg-white text-emerald-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Receita</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-600">Ícone Atual</Label>
                <div className="flex items-center gap-2 h-8 px-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: categoryEditorColor }}
                  >
                    <CategoryIcon name={categoryEditorIcon} className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 truncate">
                    {categoryEditorIcon}
                  </span>
                </div>
              </div>
            </div>

            {/* Balde Orçamentário (Obrigatório para Despesas) */}
            {categoryEditorType === 'expense' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-700">
                    Balde Orçamentário <span className="text-rose-500">*</span>
                  </Label>
                  <span className="text-[10px] text-slate-500 font-medium">Obrigatório</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    {
                      id: 'essentials' as const,
                      label: 'Essenciais',
                      desc: 'necessidades básicas, moradia, saúde, subsistência',
                      borderActive:
                        'border-sky-500 bg-sky-50/70 text-sky-950 ring-1 ring-sky-500/30',
                    },
                    {
                      id: 'lifestyle' as const,
                      label: 'Estilo de Vida',
                      desc: 'conforto, lazer, compras, desejos, pets',
                      borderActive:
                        'border-amber-500 bg-amber-50/70 text-amber-950 ring-1 ring-amber-500/30',
                    },
                    {
                      id: 'future' as const,
                      label: 'Futuro & Metas',
                      desc: 'investimentos, reserva de emergência, projetos',
                      borderActive:
                        'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-500/30',
                    },
                  ].map((bucketOpt) => {
                    const isSelected = categoryEditorBucket === bucketOpt.id
                    return (
                      <button
                        key={bucketOpt.id}
                        type="button"
                        onClick={() => setCategoryEditorBucket(bucketOpt.id)}
                        className={`w-full text-left p-2 rounded-xl border transition-all flex items-start gap-2 ${
                          isSelected
                            ? bucketOpt.borderActive
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white text-slate-600'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-xs font-semibold ${
                                isSelected ? 'text-slate-900' : 'text-slate-700'
                              }`}
                            >
                              {bucketOpt.label}
                            </span>
                            {isSelected && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                Ativo
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                            {bucketOpt.desc}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Paleta de Cores */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600">Cor</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setCategoryEditorColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      categoryEditorColor === c
                        ? 'ring-2 ring-slate-900 ring-offset-2 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Galeria de Ícones Disponíveis */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600">Escolher Ícone</Label>
              <div className="grid grid-cols-7 gap-1.5 p-1.5 bg-slate-50 border border-slate-100 rounded-xl max-h-28 overflow-y-auto">
                {AVAILABLE_ICONS.map((iName) => {
                  const isSelected = categoryEditorIcon === iName
                  return (
                    <button
                      type="button"
                      key={iName}
                      onClick={() => setCategoryEditorIcon(iName)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                      title={iName}
                    >
                      <CategoryIcon name={iName} className="w-4 h-4" />
                    </button>
                  )
                })}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingCategoryEditor}
                onClick={() => {
                  setIsCategoryEditorOpen(false)
                  setCategoryToEdit(null)
                }}
                className="text-xs rounded-xl"
              >
                <span>Cancelar</span>
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  savingCategoryEditor ||
                  !categoryEditorName.trim() ||
                  (categoryEditorType === 'expense' && !categoryEditorBucket)
                }
                className="text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <span className="flex items-center gap-1.5">
                  {savingCategoryEditor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Salvar Alterações</span>
                </span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isNewSubcatDialogOpen}
        onOpenChange={(open) => {
          setIsNewSubcatDialogOpen(open)
          if (!open) {
            setCategoryForNewSubcat(null)
            setNewSubcatName('')
          }
        }}
      >
        <DialogContent
          className="max-w-md w-[95vw] rounded-2xl p-5 text-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              <span>Nova Subcategoria</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {categoryForNewSubcat ? (
                <span>
                  Criar uma nova subcategoria em <strong>{categoryForNewSubcat.name}</strong>
                </span>
              ) : (
                <span>Informe o nome da nova subcategoria.</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              const trimmed = newSubcatName.trim()
              if (!trimmed) {
                toast({
                  title: 'Nome obrigatório',
                  description: 'Informe o nome da nova subcategoria.',
                  variant: 'destructive',
                })
                return
              }
              if (!categoryForNewSubcat) {
                toast({
                  title: 'Categoria não encontrada',
                  description: 'Não foi possível identificar a categoria pai.',
                  variant: 'destructive',
                })
                return
              }
              try {
                setSavingNewSubcat(true)
                await addNewSubcategory(categoryForNewSubcat.id, trimmed)
                toast({
                  title: 'Subcategoria adicionada',
                  description: `Subcategoria "${trimmed}" criada com sucesso.`,
                })
                setExpandedBudgetCategories((prev) => ({
                  ...prev,
                  [categoryForNewSubcat.id]: true,
                }))
                setIsNewSubcatDialogOpen(false)
                setCategoryForNewSubcat(null)
                setNewSubcatName('')
                triggerRefresh()
                await loadMonthData()
              } catch (err: any) {
                console.error('Erro ao adicionar subcategoria:', err)
                toast({
                  title: 'Erro ao adicionar subcategoria',
                  description: err?.message || 'Tente novamente.',
                  variant: 'destructive',
                })
              } finally {
                setSavingNewSubcat(false)
              }
            }}
            className="space-y-4 pt-1"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nome da subcategoria</Label>
              <Input
                type="text"
                placeholder="Ex.: Mercado, Restaurante, Farmácia..."
                value={newSubcatName}
                onChange={(e) => setNewSubcatName(e.target.value)}
                className="h-9 text-xs rounded-xl"
                autoFocus
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingNewSubcat}
                onClick={() => {
                  setIsNewSubcatDialogOpen(false)
                  setCategoryForNewSubcat(null)
                  setNewSubcatName('')
                }}
                className="text-xs rounded-xl"
              >
                <span>Cancelar</span>
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingNewSubcat || !newSubcatName.trim()}
                className="text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <span className="flex items-center gap-1.5">
                  {savingNewSubcat ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Adicionar Subcategoria</span>
                </span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGOS DE CONFIRMAÇÃO DE EXCLUSÃO (CATEGORIA E SUBCATEGORIA COM AUDITORIA DE LANÇAMENTOS) */}
      <DeleteCategoryConfirmDialog
        category={categoryToDelete}
        usageCount={categoryUsageCount}
        loadingUsage={loadingCatUsage}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleConfirmDeleteCategory}
      />

      <DeleteSubcategoryConfirmDialog
        subcategory={subcategoryToDelete}
        parentCategoryName={subcatParentCategoryName}
        usageCount={subcategoryUsageCount}
        loadingUsage={loadingSubUsage}
        onClose={() => setSubcategoryToDelete(null)}
        onConfirm={handleConfirmDeleteSubcategory}
      />

      {/* MODAL DE APLICAÇÃO DO MODELO ORÇAMENTÁRIO */}
      <ApplyBudgetModelDialog
        open={isApplyModelOpen}
        onOpenChange={setIsApplyModelOpen}
        family={family}
        categories={categories}
        onSuccess={async () => {
          triggerRefresh()
          await loadMonthData()
        }}
      />

      {/* DIÁLOGO DE RECEITAS FIXAS RECORRENTES */}
      <RecurringIncomesDialog
        open={isRecurringIncomesOpen}
        onOpenChange={setIsRecurringIncomesOpen}
        currentMonthDate={currentDate}
        recurringIncomes={recurringIncomes}
        recurringOverrides={recurringOverrides}
        onSuccess={() => loadMonthData()}
      />

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
        onOpenChange={(open) => {
          setIsEditTxOpen(open)
          if (!open) setEditingTx(null)
        }}
        editingTransaction={editingTx}
        onSuccess={() => loadMonthData()}
      />

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE TRANSAÇÃO */}
      <AlertDialog open={Boolean(txToDelete)} onOpenChange={(open) => !open && setTxToDelete(null)}>
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
