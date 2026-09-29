import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useFamily } from '@/hooks/use-family'
import {
  fetchTransactions,
  fetchDefaultBudgets,
  fetchMonthBudgetOverrides,
  upsertDefaultBudget,
  upsertMonthBudgetOverride,
  resetMonthBudgetToDefault,
  deleteTransaction,
  updateTransaction,
} from '@/services/transactions'
import { upsertCategorizationRule } from '@/services/categorization-rules'
import { normalizeText, extractPatternFromDescription } from '@/services/import/categorization'
import {
  TransactionInlineRow,
  SaveInlineCategoryData,
  SaveBatchSameNameData,
} from '@/components/transactions/TransactionInlineRow'
import {
  formatBRL,
  formatDayGroupHeader,
  formatMonthYear,
  parseBRLToCents,
  formatNumberBRL,
} from '@/lib/formatters'
import { formatTransactionTitle } from '@/services/installments'
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
import { BudgetAlertsFarol } from '@/components/wallet/BudgetAlertsFarol'
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
  GripVertical,
  GraduationCap,
  Repeat,
  Info,
  Lightbulb,
} from 'lucide-react'
import { SortableList } from '@/components/common/SortableList'
import { ApplyBudgetModelDialog } from '@/components/wallet/ApplyBudgetModelDialog'
import { BudgetOverviewCard } from '@/components/wallet/BudgetOverviewCard'
import { CategoryTransactionsDrawer } from '@/components/wallet/CategoryTransactionsDrawer'
import { BUCKET_METADATA } from '@/types/budget-presets'

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
    lastImportSummary,
    setLastImportSummary,
  } = useFamily()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const isOrcamentosRoute = location.pathname === '/orcamentos'
  const [activeTab, setActiveTab] = useState<'transacoes' | 'orcamentos'>(() =>
    isOrcamentosRoute ? 'orcamentos' : 'transacoes',
  )

  useEffect(() => {
    if (location.pathname === '/orcamentos') {
      setActiveTab('orcamentos')
    } else if (location.pathname === '/carteira') {
      setActiveTab('transacoes')
    }
  }, [location.pathname])

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

  // Drawer de transações ao clicar nas linhas de orçamento
  const [budgetDrawerOpen, setBudgetDrawerOpen] = useState(false)
  const [budgetDrawerCategory, setBudgetDrawerCategory] = useState<TransactionCategory | null>(null)
  const [budgetDrawerSubcategory, setBudgetDrawerSubcategory] =
    useState<TransactionSubcategory | null>(null)
  const [budgetDrawerFilterType, setBudgetDrawerFilterType] = useState<
    'category' | 'direct' | 'subcategory'
  >('category')

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

  // Nota de metodologia recolhida por padrão
  const [isMethodologyExpanded, setIsMethodologyExpanded] = useState(false)

  // ID da transação pendente atualmente aberta no accordion (apenas 1 por vez)
  const [expandedPendingTxId, setExpandedPendingTxId] = useState<string | null>(null)

  // Filtros de transação
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [filterMemberIds, setFilterMemberIds] = useState<string[]>([])
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([])
  const [filterSubcategoryIds, setFilterSubcategoryIds] = useState<string[]>([])
  const [filterType, setFilterType] = useState<'income' | 'expense' | null>(null)
  const [filterOnlyPending, setFilterOnlyPending] = useState<boolean>(false)

  // Ações de transação
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [isEditTxOpen, setIsEditTxOpen] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)

  // Diálogo legado controlado de edição de categoria e subcategoria
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false)
  const [categoryToEdit, setCategoryToEdit] = useState<TransactionCategory | null>(null)
  const [categoryEditorName, setCategoryEditorName] = useState('')
  const [categoryEditorType, setCategoryEditorType] = useState<'income' | 'expense'>('expense')
  const [categoryEditorColor, setCategoryEditorColor] = useState('#3B82F6')
  const [categoryEditorIcon, setCategoryEditorIcon] = useState('Tag')
  const [categoryEditorBucket, setCategoryEditorBucket] = useState<BudgetBucket | null>(
    'essentials',
  )
  const [savingCategoryEditor, setSavingCategoryEditor] = useState(false)

  // Estado para abrir editor de categoria diretamente de um alerta do Farol
  const [activeAlertEditCategory, setActiveAlertEditCategory] =
    useState<TransactionCategory | null>(null)

  const [isNewSubcatDialogOpen, setIsNewSubcatDialogOpen] = useState(false)
  const [categoryForNewSubcat, setCategoryForNewSubcat] = useState<TransactionCategory | null>(null)
  const [newSubcatName, setNewSubcatName] = useState('')
  const [savingNewSubcat, setSavingNewSubcat] = useState(false)

  // Ações de orçamento
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false)
  const [editingBudgetCatId, setEditingBudgetCatId] = useState<string>('')
  const [editingBudgetSubcatId, setEditingBudgetSubcatId] = useState<string | null>(null)
  const [defaultAmountStr, setDefaultAmountStr] = useState('')
  const [monthAmountStr, setMonthAmountStr] = useState('')
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
    if (filterOnlyPending) count += 1
    if (filterMemberIds.length > 0) count += 1
    if (filterCategoryIds.length > 0) count += 1
    if (filterSubcategoryIds.length > 0) count += 1
    if (filterType !== null) count += 1
    return count
  }, [filterOnlyPending, filterMemberIds, filterCategoryIds, filterSubcategoryIds, filterType])

  // Contagem de pendentes no mês atual
  const pendingTransactionsCount = useMemo(() => {
    return transactions.filter((t) => !t.category_id).length
  }, [transactions])

  // Transações filtradas
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterOnlyPending && tx.category_id) {
        return false
      }
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
  }, [
    transactions,
    filterOnlyPending,
    filterMemberIds,
    filterCategoryIds,
    filterSubcategoryIds,
    filterType,
  ])

  // Resumo do mês (Receitas, Despesas, Saldo) - inclui projeções futuras
  const { monthIncomeCents, monthExpenseCents, monthNetCents } = useMemo(() => {
    let income = 0
    let expense = 0

    filteredTransactions.forEach((tx) => {
      if (tx.type === 'income') {
        income += tx.amount_cents
      } else {
        expense += tx.amount_cents
      }
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

  // Lista ordenada das transações pendentes para cálculo de avanços e lotes
  const pendingTransactionsList = useMemo(() => {
    return transactions.filter((t) => !t.category_id)
  }, [transactions])

  // Handler para salvar categorização inline de transação pendente com atualização otimista dos 3 Baldes
  // e avanço automático suave para a próxima pendente (série de revisão)
  const handleSaveInlineCategory = async (data: SaveInlineCategoryData) => {
    if (!family) return

    const {
      transactionId,
      categoryId,
      subcategoryId,
      rememberRule,
      description,
      type,
      memberId,
      date,
    } = data

    // Próxima pendente na fila para avançar o foco
    const remainingPendings = pendingTransactionsList.filter((t) => t.id !== transactionId)
    const nextPending = remainingPendings[0] || null

    // Categoria e subcategoria escolhidas para atualização otimista
    const chosenCat = categories.find((c) => c.id === categoryId)
    const chosenSub = chosenCat?.subcategories?.find((s) => s.id === subcategoryId) || null
    const chosenMember = memberId ? members.find((m) => m.id === memberId) : undefined

    // Atualização otimista imediata das transações (sai de pendente e reflete no estado local)
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== transactionId) return t
        return {
          ...t,
          category_id: categoryId,
          subcategory_id: subcategoryId,
          category: chosenCat || t.category,
          subcategory: chosenSub || null,
          description: description || t.description,
          type: type || t.type,
          member_id: memberId || t.member_id,
          member: chosenMember || t.member,
          transaction_date: date || t.transaction_date,
        }
      }),
    )

    // Avança o accordion para a próxima transação pendente (se houver) ou fecha
    setExpandedPendingTxId(nextPending ? nextPending.id : null)

    // Atualiza contagem do banner se houver
    if (lastImportSummary && lastImportSummary.pending > 0) {
      setLastImportSummary({
        ...lastImportSummary,
        pending: Math.max(0, lastImportSummary.pending - 1),
        categorized: lastImportSummary.categorized + 1,
      })
    }

    try {
      // 1. Atualizar a transação no banco de dados com todos os dados editados
      const payload: any = {
        category_id: categoryId,
        subcategory_id: subcategoryId,
        description: description || undefined,
      }
      if (type) payload.type = type
      if (memberId) payload.member_id = memberId
      if (date) payload.transaction_date = date

      await updateTransaction(transactionId, payload)

      // 2. Se o checkbox 'Lembrar' estiver marcado, salvar regra em categorization_rules
      // Usa a mesma normalização do parser (uppercase + sem acentos + trim)
      if (rememberRule && description && description.trim()) {
        try {
          const derivedPattern =
            extractPatternFromDescription(description) || normalizeText(description)
          const patternToSave = (derivedPattern || description.trim()).toUpperCase()

          await upsertCategorizationRule({
            family_id: family.id,
            user_id: null,
            pattern: patternToSave,
            category_id: categoryId,
            subcategory_id: subcategoryId || null,
          })
        } catch (ruleErr) {
          console.warn('Erro ao salvar regra automática:', ruleErr)
        }
      }

      toast({
        title: 'Transação categorizada!',
        description: rememberRule
          ? `"${description.trim()}" vinculada a ${chosenCat?.name}. Lembraremos para compras futuras.`
          : `Transação atualizada para ${chosenCat?.name}.`,
      })

      // Dispara refresh suave para sincronizar os dados gerais da família
      triggerRefresh()
    } catch (err: any) {
      console.error('Erro ao categorizar transação inline:', err)
      toast({
        title: 'Erro ao salvar categoria',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
      // Em caso de falha, recarrega o mês do banco para desfazer estado otimista
      await loadMonthData()
    }
  }

  // Mapa de agrupamento das transações pendentes por padrão/descrição normalizada
  const pendingByPatternMap = useMemo(() => {
    const map = new Map<string, string[]>()
    pendingTransactionsList.forEach((t) => {
      const key = (
        extractPatternFromDescription(t.description || '') || normalizeText(t.description || '')
      ).toUpperCase()
      if (!key) return
      const list = map.get(key) || []
      list.push(t.id)
      map.set(key, list)
    })
    return map
  }, [pendingTransactionsList])

  // Handler para salvar em lote todas as pendentes com o mesmo nome normalizado
  const handleSaveBatchSameName = async (data: SaveBatchSameNameData) => {
    if (!family) return
    const { transactionIds, categoryId, subcategoryId, rememberRule, description, type } = data

    const chosenCat = categories.find((c) => c.id === categoryId)
    const chosenSub = chosenCat?.subcategories?.find((s) => s.id === subcategoryId) || null
    const targetSet = new Set(transactionIds)

    // Atualização otimista local
    setTransactions((prev) =>
      prev.map((t) => {
        if (!targetSet.has(t.id)) return t
        return {
          ...t,
          category_id: categoryId,
          subcategory_id: subcategoryId,
          category: chosenCat || t.category,
          subcategory: chosenSub || null,
          type: type || t.type,
        }
      }),
    )

    // Próxima pendente fora do lote para focar no accordion
    const nextPending = transactions.find((t) => !t.category_id && !targetSet.has(t.id)) || null
    setExpandedPendingTxId(nextPending ? nextPending.id : null)

    // Atualiza resumo do banner se houver
    if (lastImportSummary && lastImportSummary.pending > 0) {
      setLastImportSummary({
        ...lastImportSummary,
        pending: Math.max(0, lastImportSummary.pending - transactionIds.length),
        categorized: lastImportSummary.categorized + transactionIds.length,
      })
    }

    try {
      // 1. Atualizar todas as transações em paralelo no Supabase
      const updatePayload: any = {
        category_id: categoryId,
        subcategory_id: subcategoryId,
      }
      if (type) updatePayload.type = type

      await Promise.all(transactionIds.map((id) => updateTransaction(id, updatePayload)))

      // 2. Se lembrar regra estiver marcado, cria a regra de categorização
      if (rememberRule && description && description.trim()) {
        try {
          const derivedPattern =
            extractPatternFromDescription(description) || normalizeText(description)
          const patternToSave = (derivedPattern || description.trim()).toUpperCase()

          await upsertCategorizationRule({
            family_id: family.id,
            user_id: null,
            pattern: patternToSave,
            category_id: categoryId,
            subcategory_id: subcategoryId || null,
          })
        } catch (ruleErr) {
          console.warn('Erro ao salvar regra automática em lote:', ruleErr)
        }
      }

      toast({
        title: `${transactionIds.length} transações categorizadas! 🎉`,
        description: `Todas as pendentes "${description.trim()}" foram vinculadas a ${chosenCat?.name}.`,
      })

      triggerRefresh()
    } catch (err: any) {
      console.error('Erro ao categorizar transações em lote:', err)
      toast({
        title: 'Erro ao aplicar em lote',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
      await loadMonthData()
    }
  }

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

    // 1. Gastos por categoria, por subcategoria e direto na categoria (sem subcategoria)
    const catSpentMap: Record<string, number> = {}
    const subSpentMap: Record<string, number> = {}
    const catDirectSpentMap: Record<string, number> = {}

    transactions.forEach((tx) => {
      if (tx.type === 'expense' && tx.category_id) {
        catSpentMap[tx.category_id] = (catSpentMap[tx.category_id] || 0) + tx.amount_cents
        if (tx.subcategory_id) {
          subSpentMap[tx.subcategory_id] = (subSpentMap[tx.subcategory_id] || 0) + tx.amount_cents
        } else {
          catDirectSpentMap[tx.category_id] =
            (catDirectSpentMap[tx.category_id] || 0) + tx.amount_cents
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

      const directSpentCents = catDirectSpentMap[cat.id] || 0

      return {
        category: cat,
        limitCents,
        explicitLimitCents,
        defaultLimitCents,
        subcatsLimitSum,
        hasSubcatLimits,
        spentCents,
        directSpentCents,
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

    // Cálculo dinâmico para cada categoria: percentual da renda líquida = teto / renda líquida * 100
    const listWithIncomePercent = list.map((item) => {
      const percentOfIncome =
        netIncomeCents > 0 ? Math.round((item.limitCents / netIncomeCents) * 1000) / 10 : 0
      return {
        ...item,
        percentOfIncome,
      }
    })

    return {
      list: listWithIncomePercent,
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
    setIsEditingOnlyThisMonth(isOverridden)
    setHasMonthOverride(isOverridden)
    setIsBudgetDialogOpen(true)
  }

  // Abrir drawer de transações ao clicar nas linhas de orçamento
  const openCategoryTransactionsDrawer = (
    category: TransactionCategory,
    subcategory: TransactionSubcategory | null = null,
    filterType: 'category' | 'direct' | 'subcategory' = 'category',
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation()
    setBudgetDrawerCategory(category)
    setBudgetDrawerSubcategory(subcategory)
    setBudgetDrawerFilterType(filterType)
    setBudgetDrawerOpen(true)
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
        // Regra de Arquitetura: apenas default_budgets é atualizado; percent_default não é gravado na categoria.
        const defCents = parseBRLToCents(defaultAmountStr)
        // Sincronização IMEDIATA no estado local defaultBudgets
        setDefaultBudgets((prev) => {
          const exists = prev.some(
            (b) =>
              b.category_id === editingBudgetCatId &&
              (editingBudgetSubcatId
                ? b.subcategory_id === editingBudgetSubcatId
                : !b.subcategory_id),
          )
          if (exists) {
            return prev.map((b) =>
              b.category_id === editingBudgetCatId &&
              (editingBudgetSubcatId
                ? b.subcategory_id === editingBudgetSubcatId
                : !b.subcategory_id)
                ? { ...b, amount_cents: defCents }
                : b,
            )
          }
          return [
            ...prev,
            {
              id: `temp-${Date.now()}`,
              family_id: family.id,
              category_id: editingBudgetCatId,
              subcategory_id: editingBudgetSubcatId,
              amount_cents: defCents,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any,
          ]
        })

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
        <div className="flex flex-col sm:grid sm:grid-cols-3 items-center gap-4 mb-4">
          {/* Lado esquerdo no desktop: Abas segmentadas */}
          <div className="w-full sm:w-auto flex justify-center sm:justify-start">
            <div className="bg-slate-100 p-1 rounded-2xl w-full sm:w-72 grid grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('transacoes')
                  navigate('/carteira', { replace: true })
                }}
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
                onClick={() => {
                  setActiveTab('orcamentos')
                  navigate('/orcamentos', { replace: true })
                }}
                className={`rounded-xl font-semibold text-xs py-2 transition-all ${
                  activeTab === 'orcamentos'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Orçamentos
              </button>
            </div>
          </div>

          {/* Coluna Central: Seletor de Mês & Botão de Importação sempre centralizados */}
          <div className="flex flex-col items-center gap-1.5 w-full justify-center">
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

            {/* Botão de importação sempre visível logo abaixo da pílula de mês */}
            <button
              type="button"
              onClick={openImportStatement}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-3 py-1 rounded-xl transition-colors border border-emerald-200/60 bg-white/80 shadow-2xs active:scale-95 touch-manipulation"
              title="Importar extrato bancário (OFX ou PDF)"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Importar OFX ou PDF</span>
            </button>
          </div>

          {/* Lado direito (espaçador para equilibrar no desktop em 3 colunas) */}
          <div className="hidden sm:block" aria-hidden="true" />
        </div>

        {/* ================= TAB 1: TRANSAÇÕES ================= */}
        {activeTab === 'transacoes' ? (
          <div className="space-y-5 mt-0 animate-in fade-in-50 duration-200">
            {/* 1. VISÃO DE RESUMO PÓS-IMPORTAÇÃO & SEÇÃO DE REVISÃO DE PENDENTES (Com Barra de Progresso) */}
            {lastImportSummary ? (
              <div className="rounded-3xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 p-4 sm:p-5 shadow-sm space-y-3 animate-in fade-in-50 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
                      {lastImportSummary.pending === 0 ? '🎉' : '📥'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                        {lastImportSummary.pending === 0 ? (
                          'Tudo categorizado! 🎉'
                        ) : (
                          <>
                            📥 Extrato importado: {lastImportSummary.categorized} de{' '}
                            {lastImportSummary.total} transações categorizadas
                          </>
                        )}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1">
                        {lastImportSummary.pending === 0
                          ? 'Todas as transações do extrato estão devidamente classificadas nos 3 Baldes.'
                          : `${lastImportSummary.pending} transações pendentes de revisão. Toque em qualquer linha para abrir e categorizar.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
                    {lastImportSummary.pending > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setFilterOnlyPending((prev) => !prev)}
                        className={`text-xs font-bold rounded-xl shadow-xs transition-all gap-1.5 ${
                          filterOnlyPending
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {filterOnlyPending
                            ? 'Ver todas as transações'
                            : `Revisar pendentes (${lastImportSummary.pending})`}
                        </span>
                      </Button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-xl">
                        100% revisado
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setLastImportSummary(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Fechar aviso de importação"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Barra de Progresso da Revisão */}
                {lastImportSummary.total > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span>Progresso da categorização</span>
                      <span className="tabular-nums text-emerald-800">
                        {lastImportSummary.categorized} de {lastImportSummary.total} revisadas (
                        {Math.round(
                          (lastImportSummary.categorized / lastImportSummary.total) * 100,
                        )}
                        %)
                      </span>
                    </div>
                    <div className="w-full bg-emerald-200/70 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (lastImportSummary.categorized / lastImportSummary.total) * 100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : pendingTransactionsCount > 0 ? (
              /* Banner complementar quando há pendentes sem o lastImportSummary ativo */
              <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <span className="font-bold text-xs sm:text-sm text-slate-900 block">
                      Você tem {pendingTransactionsCount}{' '}
                      {pendingTransactionsCount === 1
                        ? 'transação pendente'
                        : 'transações pendentes'}{' '}
                      de categorização neste mês
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Toque na linha desejada para expandir confortavelmente e categorizar.
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterOnlyPending((prev) => !prev)}
                  className={`text-xs font-bold rounded-xl shrink-0 ${
                    filterOnlyPending
                      ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                      : 'border-amber-300 text-amber-900 hover:bg-amber-100/70 bg-white'
                  }`}
                >
                  {filterOnlyPending
                    ? 'Ver todas as transações'
                    : `Ver apenas pendentes (${pendingTransactionsCount})`}
                </Button>
              </div>
            ) : filterOnlyPending && pendingTransactionsCount === 0 ? (
              /* Estado de Sucesso quando o usuário estava filtrando pendentes e terminou todas */
              <div className="rounded-3xl border border-emerald-300 bg-emerald-50/80 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                    🎉
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-emerald-950">
                      Tudo categorizado! Parabéns!
                    </h4>
                    <p className="text-xs text-emerald-800">
                      Não há mais nenhuma transação pendente neste mês.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setFilterOnlyPending(false)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded-xl font-bold"
                >
                  Ver todas as transações
                </Button>
              </div>
            ) : null}

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

            {/* Barra de Filtro, Atalho de Receitas Fixas e Contagem */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
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

                {activeFiltersCount > 0 && (
                  <button
                    onClick={() => {
                      setFilterOnlyPending(false)
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
                    Importar Extrato (OFX)
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
                        const isPending = !tx.category_id

                        // Requisito 2: Se a transação estiver pendente de categoria, exibir EDIÇÃO RÁPIDA EM LINHA
                        if (isPending) {
                          const patternKey = (
                            extractPatternFromDescription(tx.description || '') ||
                            normalizeText(tx.description || '')
                          ).toUpperCase()
                          const matchingIds = (pendingByPatternMap.get(patternKey) || []).filter(
                            (id) => id !== tx.id,
                          )

                          return (
                            <div key={tx.id} className="p-2 sm:p-2.5">
                              <TransactionInlineRow
                                transaction={tx}
                                categories={categories}
                                members={members}
                                isExpanded={expandedPendingTxId === tx.id}
                                onToggleExpand={() =>
                                  setExpandedPendingTxId((prev) => (prev === tx.id ? null : tx.id))
                                }
                                onSave={handleSaveInlineCategory}
                                onSaveBatchSameName={handleSaveBatchSameName}
                                matchingCount={matchingIds.length}
                                matchingTransactionIds={matchingIds}
                              />
                            </div>
                          )
                        }

                        const isIncome = tx.type === 'income'
                        const isProjected = tx.status === 'projected'

                        return (
                          <div
                            key={tx.id}
                            onClick={() => {
                              setSelectedTx(tx)
                              setIsDetailOpen(true)
                            }}
                            className={`flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors group cursor-pointer ${
                              isProjected
                                ? 'bg-slate-50/50 border-l-4 border-l-amber-400 opacity-90'
                                : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                              <div
                                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                                style={{
                                  backgroundColor:
                                    tx.category?.color ||
                                    (isIncome ? '#10B981' : isProjected ? '#F59E0B' : '#64748B'),
                                }}
                              >
                                <CategoryIcon name={tx.category?.icon} className="w-5 h-5" />
                              </div>

                              <div className="overflow-hidden pr-2">
                                <div className="flex items-center gap-1.5 overflow-hidden flex-wrap">
                                  <p
                                    className={`font-semibold text-sm group-hover:text-emerald-700 transition-colors truncate ${
                                      isProjected ? 'text-slate-700' : 'text-slate-900'
                                    }`}
                                    title={formatTransactionTitle(tx)}
                                  >
                                    {formatTransactionTitle(tx)}
                                  </p>
                                  {isProjected && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-dashed border-amber-400 px-1.5 py-0.2 rounded-md shrink-0">
                                      <span>Previsto</span>
                                    </span>
                                  )}
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
                                  {tx.category ? (
                                    <span className="text-[11px] text-slate-500 font-medium truncate">
                                      <span>{tx.category.name}</span>
                                      {tx.subcategory && (
                                        <span className="text-emerald-700 font-semibold ml-1">
                                          · {tx.subcategory.name}
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded shrink-0">
                                      <span>Pendente de categoria</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                              <span
                                className={`font-bold text-sm sm:text-base tabular-nums ${
                                  isIncome
                                    ? 'text-emerald-600'
                                    : isProjected
                                      ? 'text-amber-800 border-b border-dashed border-amber-400'
                                      : 'text-red-600'
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
                  <p className="text-[10px] text-slate-400 italic flex items-center gap-1 mt-0.5">
                    <GraduationCap className="w-3 h-3 text-slate-400 shrink-0 not-italic" />
                    <span>
                      Modelos baseados em metodologias consagradas: 50/30/20 (Elizabeth Warren) e
                      variações para perfis de família.
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRecurringIncomesOpen(true)}
                  className="rounded-xl text-xs font-semibold gap-1.5 border-slate-200 text-slate-700 bg-white hover:bg-slate-50 h-8 shadow-xs"
                >
                  <Repeat className="w-3.5 h-3.5 text-slate-500" />
                  <span>Contas & rendas fixas</span>
                </Button>
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

            {/* Card Geral de Orçamento Recorrente / Projeção */}
            {(() => {
              const now = new Date()
              const isFutureMonth =
                currentDate.getFullYear() > now.getFullYear() ||
                (currentDate.getFullYear() === now.getFullYear() &&
                  currentDate.getMonth() > now.getMonth())

              const cardTitle = isFutureMonth
                ? `Projeção de ${formatMonthYear(currentDate)}`
                : `Orçamento de ${formatMonthYear(currentDate)}`

              const badgeText = categoryBudgetData.isTotalOver
                ? `Excedeu ${formatBRL(Math.abs(categoryBudgetData.totalRemaining))}`
                : isFutureMonth
                  ? `Livre ${formatBRL(categoryBudgetData.totalRemaining)}`
                  : `Restam ${formatBRL(categoryBudgetData.totalRemaining)}`

              const consumedPrefix = isFutureMonth ? 'Comprometido ' : 'Gasto '

              return (
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
                        {cardTitle}
                      </span>
                      {isFutureMonth ? (
                        <span className="text-[11px] text-slate-400 font-medium">
                          · Teto mensal: {formatBRL(categoryBudgetData.totalBudget)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                          · Padrão mensal
                        </span>
                      )}
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
                      <span>{badgeText}</span>
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                      <span className="text-base sm:text-lg font-semibold text-slate-500 mr-1.5">
                        {consumedPrefix}
                      </span>
                      <span>
                        {formatBRL(categoryBudgetData.totalSpent)}{' '}
                        <span className="text-sm font-medium text-slate-400">
                          de {formatBRL(categoryBudgetData.totalBudget)}
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
              )
            })()}

            {/* FAROL & ALERTAS PREVENTIVOS — Posicionado logo abaixo do card de orçamento e acima da lista de categorias */}
            <BudgetAlertsFarol
              family={family}
              bucketsSummary={categoryBudgetData.bucketsSummary}
              totalBudget={categoryBudgetData.totalBudget}
              totalBudgetPercentOfIncome={categoryBudgetData.totalBudgetPercentOfIncome}
              categoryList={categoryBudgetData.list}
              currentDate={currentDate}
              monthKey={monthKey}
              onOpenCategoryEditor={(cat) => setActiveAlertEditCategory(cat)}
              onOpenModelDialog={() => setIsApplyModelOpen(true)}
            />

            {/* Lista de Orçamentos com Hierarquia Categoria Pai -> Subcategorias e Gestão Inline com Ícones */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-slate-900">Categorias e Subcategorias</h3>
                  <p className="text-xs text-slate-500">
                    Clique na linha para definir teto. Use o lápis para editar, o + para criar
                    subcategoria e a lixeira para excluir.
                  </p>
                  <div className="mt-1.5 max-w-full">
                    <button
                      type="button"
                      onClick={() => setIsMethodologyExpanded((prev) => !prev)}
                      aria-expanded={isMethodologyExpanded}
                      aria-label={
                        isMethodologyExpanded
                          ? 'Recolher nota de metodologia'
                          : 'Expandir nota de metodologia'
                      }
                      title={
                        isMethodologyExpanded
                          ? 'Clique para recolher nota de metodologia'
                          : 'Clique para expandir nota de metodologia completa'
                      }
                      className="group flex items-start gap-1.5 text-left text-[11px] leading-relaxed cursor-pointer select-none max-w-full w-full rounded-md p-0.5 -m-0.5 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300 transition-colors"
                    >
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-200/60 shrink-0 mt-0.5 transition-colors"
                        aria-hidden="true"
                        title={
                          isMethodologyExpanded
                            ? 'Clique para recolher nota de metodologia'
                            : 'Clique para ver metodologia completa'
                        }
                      >
                        <Info className="w-3.5 h-3.5" />
                      </span>
                      <span
                        className={`min-w-0 flex-1 transition-all duration-200 text-slate-500/90 group-hover:text-slate-700 ${
                          isMethodologyExpanded ? 'break-words whitespace-normal' : 'truncate block'
                        }`}
                      >
                        Essa taxonomia de categorias foi desenhada respeitando a Pesquisa de
                        Orçamentos Familiares (POF) do IBGE e o comportamento real de consumo do
                        Brasil moderno.
                      </span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <CategoryEditorPopover
                    title="Nova Categoria"
                    defaultType="expense"
                    bucketsSummary={categoryBudgetData.bucketsSummary}
                    family={family}
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
                        const newCat = await addNewCategory(
                          data.name,
                          data.type,
                          data.color,
                          data.icon,
                          data.budget_bucket,
                        )
                        if (
                          family &&
                          newCat &&
                          data.type === 'expense' &&
                          data.budget_amount_cents !== undefined
                        ) {
                          await upsertDefaultBudget(
                            family.id,
                            newCat.id,
                            data.budget_amount_cents,
                            null,
                          )
                        }
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
                      bucketsSummary={categoryBudgetData.bucketsSummary}
                      family={family}
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
                          const newCat = await addNewCategory(
                            data.name,
                            data.type,
                            data.color,
                            data.icon,
                            data.budget_bucket,
                          )
                          if (
                            family &&
                            newCat &&
                            data.type === 'expense' &&
                            data.budget_amount_cents !== undefined
                          ) {
                            await upsertDefaultBudget(
                              family.id,
                              newCat.id,
                              data.budget_amount_cents,
                              null,
                            )
                          }
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
                    const isExpanded = Boolean(expandedBudgetCategories[item.category.id])
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
                            openCategoryTransactionsDrawer(item.category, null, 'category')
                          }
                          className="p-3 sm:p-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors group select-none touch-manipulation"
                        >
                          {/* Top Row: Identificação + Ações */}
                          <div className="flex items-start justify-between gap-2 sm:gap-3">
                            {/* Ícone da Categoria + Nome completo e badges */}
                            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                              {/* Ícone da categoria */}
                              <div
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0 mt-0.5"
                                style={{ backgroundColor: item.category.color || '#64748B' }}
                              >
                                <CategoryIcon
                                  name={item.category.icon}
                                  className="w-4 h-4 sm:w-5 sm:h-5"
                                />
                              </div>

                              {/* Informações textuais da categoria */}
                              <div className="min-w-0 flex-1">
                                {/* Nome da categoria completo - quebra em 2 linhas se necessário, nunca truncado */}
                                <div className="flex flex-col">
                                  <span
                                    className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-emerald-700 transition-colors break-words leading-snug"
                                    title={item.category.name}
                                  >
                                    {item.category.name}
                                  </span>

                                  {/* Badges em linha flexível abaixo do nome */}
                                  <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
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

                                    {(() => {
                                      const dynamicPercent =
                                        family?.monthly_net_income_cents && item.limitCents > 0
                                          ? Math.round(
                                              (item.limitCents / family.monthly_net_income_cents) *
                                                1000,
                                            ) / 10
                                          : null

                                      if (item.limitCents > 0) {
                                        return (
                                          <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 rounded-md tabular-nums shrink-0 leading-none whitespace-nowrap">
                                            {family?.monthly_net_income_cents
                                              ? `${dynamicPercent}% da renda`
                                              : '—'}
                                          </span>
                                        )
                                      }

                                      return (
                                        <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-md shrink-0 leading-none whitespace-nowrap">
                                          Sem teto próprio · Cota livre no balde
                                        </span>
                                      )
                                    })()}

                                    {item.hasOverride ? (
                                      <span className="text-[9px] font-semibold bg-amber-100/90 text-amber-900 border border-amber-200/80 px-1.5 py-0.5 rounded-md leading-none shrink-0 whitespace-nowrap">
                                        ajustado
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Coluna de Ações + Chevron (alinhamento no topo, nunca sobrepondo texto) */}
                            <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-start mt-0.5">
                              {/* AÇÕES DE GESTÃO: Desktop (barra com 3 botões em cápsula limpa) */}
                              <div
                                className="hidden md:flex items-center gap-0.5 bg-slate-100/70 p-0.5 rounded-xl border border-slate-200/60 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Lápis: Editar categoria */}
                                <CategoryEditorPopover
                                  category={item.category}
                                  initialLimitCents={item.defaultLimitCents || item.limitCents}
                                  bucketsSummary={categoryBudgetData.bucketsSummary}
                                  family={family}
                                  trigger={
                                    <button
                                      type="button"
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-all"
                                      title="Editar categoria (nome, cor, ícone, teto)"
                                      aria-label={`Editar categoria ${item.category.name}`}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  }
                                  onSave={async (data) => {
                                    try {
                                      await editCategory(item.category.id, {
                                        name: data.name,
                                        type: data.type,
                                        color: data.color,
                                        icon: data.icon,
                                        budget_bucket: data.budget_bucket,
                                      })
                                      if (
                                        data.type === 'expense' &&
                                        typeof data.budget_amount_cents === 'number'
                                      ) {
                                        const newLimit = Math.max(0, data.budget_amount_cents)
                                        // Sincronização IMEDIATA no estado local defaultBudgets e monthOverrides
                                        // Recalcula na mesma hora percentual da categoria, do balde e Farol global
                                        setDefaultBudgets((prev) => {
                                          const exists = prev.some(
                                            (b) =>
                                              b.category_id === item.category.id &&
                                              !b.subcategory_id,
                                          )
                                          if (exists) {
                                            return prev.map((b) =>
                                              b.category_id === item.category.id &&
                                              !b.subcategory_id
                                                ? { ...b, amount_cents: newLimit }
                                                : b,
                                            )
                                          }
                                          return [
                                            ...prev,
                                            {
                                              id: `temp-${Date.now()}`,
                                              family_id: family.id,
                                              category_id: item.category.id,
                                              subcategory_id: null,
                                              amount_cents: newLimit,
                                              created_at: new Date().toISOString(),
                                              updated_at: new Date().toISOString(),
                                            } as any,
                                          ]
                                        })
                                        if (item.hasOverride) {
                                          setMonthOverrides((prev) =>
                                            prev.filter(
                                              (b) =>
                                                !(
                                                  b.category_id === item.category.id &&
                                                  !b.subcategory_id
                                                ),
                                            ),
                                          )
                                        }
                                        await upsertDefaultBudget(
                                          family.id,
                                          item.category.id,
                                          newLimit,
                                          null,
                                        )
                                        if (item.hasOverride) {
                                          await resetMonthBudgetToDefault(
                                            family.id,
                                            item.category.id,
                                            monthKey,
                                            null,
                                          )
                                        }
                                      }
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
                                    className="w-52 max-w-[calc(100vw-2rem)] rounded-2xl shadow-xl p-1.5 text-xs"
                                  >
                                    <CategoryEditorPopover
                                      category={item.category}
                                      initialLimitCents={item.defaultLimitCents || item.limitCents}
                                      bucketsSummary={categoryBudgetData.bucketsSummary}
                                      family={family}
                                      trigger={
                                        <button
                                          type="button"
                                          className="w-full flex items-center gap-2 py-2 px-2.5 rounded-xl cursor-pointer text-slate-700 hover:bg-slate-100 transition-colors text-xs text-left min-h-[40px] touch-manipulation"
                                        >
                                          <Edit3 className="w-4 h-4 text-slate-500 shrink-0" />
                                          <span className="font-medium">Editar categoria</span>
                                        </button>
                                      }
                                      onSave={async (data) => {
                                        try {
                                          await editCategory(item.category.id, {
                                            name: data.name,
                                            type: data.type,
                                            color: data.color,
                                            icon: data.icon,
                                            budget_bucket: data.budget_bucket,
                                          })
                                          if (
                                            data.type === 'expense' &&
                                            typeof data.budget_amount_cents === 'number'
                                          ) {
                                            const newLimit = Math.max(0, data.budget_amount_cents)
                                            // Sincronização IMEDIATA no estado local defaultBudgets e monthOverrides
                                            // Recalcula na mesma hora percentual da categoria, do balde e Farol global
                                            setDefaultBudgets((prev) => {
                                              const exists = prev.some(
                                                (b) =>
                                                  b.category_id === item.category.id &&
                                                  !b.subcategory_id,
                                              )
                                              if (exists) {
                                                return prev.map((b) =>
                                                  b.category_id === item.category.id &&
                                                  !b.subcategory_id
                                                    ? { ...b, amount_cents: newLimit }
                                                    : b,
                                                )
                                              }
                                              return [
                                                ...prev,
                                                {
                                                  id: `temp-${Date.now()}`,
                                                  family_id: family.id,
                                                  category_id: item.category.id,
                                                  subcategory_id: null,
                                                  amount_cents: newLimit,
                                                  created_at: new Date().toISOString(),
                                                  updated_at: new Date().toISOString(),
                                                } as any,
                                              ]
                                            })
                                            if (item.hasOverride) {
                                              setMonthOverrides((prev) =>
                                                prev.filter(
                                                  (b) =>
                                                    !(
                                                      b.category_id === item.category.id &&
                                                      !b.subcategory_id
                                                    ),
                                                ),
                                              )
                                            }
                                            await upsertDefaultBudget(
                                              family.id,
                                              item.category.id,
                                              newLimit,
                                              null,
                                            )
                                            if (item.hasOverride) {
                                              await resetMonthBudgetToDefault(
                                                family.id,
                                                item.category.id,
                                                monthKey,
                                                null,
                                              )
                                            }
                                          }
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

                                    {/* Nova Subcategoria no menu mobile */}
                                    <SubcategoryEditorPopover
                                      parentCategoryName={item.category.name}
                                      trigger={
                                        <button
                                          type="button"
                                          className="w-full flex items-center gap-2 py-2 px-2.5 rounded-xl cursor-pointer text-slate-700 hover:bg-slate-100 transition-colors text-xs text-left min-h-[40px] touch-manipulation"
                                        >
                                          <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                                          <span className="font-medium">Nova subcategoria</span>
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

                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault()
                                        setTimeout(() => {
                                          handleInitiateDeleteCategory(item.category, e as any)
                                        }, 0)
                                      }}
                                      className="gap-2 py-2 px-2.5 rounded-xl cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 min-h-[40px]"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                                      <span className="font-medium">Excluir categoria</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Chevron de Expandir / Recolher Subcategorias */}
                              <button
                                type="button"
                                onClick={(e) => toggleCatBudgetExpand(item.category.id, e)}
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
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

                          {/* Seção Inferior: Valores + Barra de Progresso (apenas na categoria pai) + Farol */}
                          <div className="mt-2.5 sm:mt-2">
                            {/* Linha de Valores: Gasto vs Teto */}
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="text-xs sm:text-sm text-slate-500 tabular-nums flex items-baseline gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-800 text-sm sm:text-base">
                                  {formatBRL(item.spentCents)}
                                </span>
                                <span className="text-slate-400 text-xs">de</span>
                                {item.limitCents > 0 ? (
                                  <span className="text-slate-600 font-medium">
                                    {formatBRL(item.limitCents)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-baseline gap-1 flex-wrap">
                                    <span className="text-slate-600 font-medium">R$ 0,00</span>
                                    <span className="text-[11px] text-slate-400 font-normal">
                                      (Sem teto alocado)
                                    </span>
                                  </span>
                                )}
                              </div>

                              {/* Percentual ou Marcador */}
                              <div className="text-right shrink-0">
                                {item.limitCents > 0 ? (
                                  <span
                                    className={`text-xs sm:text-sm font-bold tabular-nums ${
                                      item.isOver || item.percent > 90
                                        ? 'text-red-600'
                                        : item.percent >= 71
                                          ? 'text-amber-600'
                                          : 'text-emerald-700'
                                    }`}
                                  >
                                    {item.percent}%
                                  </span>
                                ) : (
                                  <span className="text-xs font-medium text-slate-400 tabular-nums">
                                    —
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Barra de Progresso em Largura Total (APENAS na categoria pai) */}
                            {item.limitCents > 0 ? (
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    item.isOver || item.percent > 90
                                      ? 'bg-red-500'
                                      : item.percent >= 71
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-600'
                                  }`}
                                  style={{ width: `${Math.min(item.percent, 100)}%` }}
                                />
                              </div>
                            ) : null}

                            {/* Farol / Ritmo do orçamento */}
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
                                    <p className="text-[10px] sm:text-[11px] text-amber-600 font-semibold mt-1.5 flex items-center gap-1 truncate">
                                      <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                      <span className="truncate">
                                        Aporte em {item.percent}% do teto ideal. Priorize sua
                                        reserva.
                                      </span>
                                    </p>
                                  )
                                }
                                return (
                                  <p className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-1.5 flex items-center gap-1 truncate">
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
                                  <p className="text-[10px] sm:text-[11px] text-red-600 font-semibold mt-1.5 flex items-center gap-1 truncate">
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
                                  <p className="text-[10px] sm:text-[11px] text-amber-700 font-medium mt-1.5 flex items-center gap-1 truncate">
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
                                <p className="text-[10px] sm:text-[11px] text-emerald-600 font-medium mt-1.5 flex items-center gap-1 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="truncate">
                                    Ritmo saudável ({item.percent}% consumido).
                                  </span>
                                </p>
                              )
                            })()}
                          </div>
                        </div>

                        {/* Linhas Aninhadas: Subcategorias com Recuo e Visual Suave OU Mensagem Vazia */}
                        {isExpanded ? (
                          <div
                            key={`budget-subcats-${item.category.id}`}
                            className="bg-slate-50/70 border-t border-slate-100 divide-y divide-slate-100/80 pl-2.5 sm:pl-6 pr-2.5 sm:pr-4 py-1.5"
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
                                      openCategoryTransactionsDrawer(
                                        item.category,
                                        subItem.subcategory,
                                        'subcategory',
                                      )
                                    }
                                    className={`py-2 px-2 sm:px-2.5 flex flex-col sm:flex-row sm:items-center justify-between rounded-xl cursor-pointer transition-colors group/sub gap-1.5 sm:gap-3 touch-manipulation ${
                                      isSubDragging ? 'bg-white shadow-md' : 'hover:bg-white'
                                    }`}
                                  >
                                    {/* Linha superior no mobile / lado esquerdo no desktop: Alça de arrasto + Nome + Badges + Ações no mobile */}
                                    <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 min-w-0 w-full sm:flex-1 sm:w-auto">
                                      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
                                        <button
                                          type="button"
                                          {...subDragHandleProps}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            e.preventDefault()
                                          }}
                                          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 active:text-emerald-600 cursor-grab active:cursor-grabbing shrink-0 touch-none rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
                                          title="Arraste para reordenar subcategoria"
                                          aria-label={`Arrastar subcategoria ${subItem.subcategory.name}`}
                                        >
                                          <GripVertical className="w-4 h-4" />
                                        </button>
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/sub:bg-emerald-500 transition-colors shrink-0" />
                                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                            <span
                                              className="text-xs sm:text-sm font-semibold text-slate-700 group-hover/sub:text-emerald-700 transition-colors break-words leading-snug"
                                              title={subItem.subcategory.name}
                                            >
                                              {subItem.subcategory.name}
                                            </span>
                                            {subItem.hasOverride ? (
                                              <span className="text-[9px] font-semibold bg-amber-100/90 text-amber-900 border border-amber-200/80 px-1.5 py-0.5 rounded-md leading-none shrink-0 whitespace-nowrap">
                                                ajustado
                                              </span>
                                            ) : null}
                                            {subItem.isOver ? (
                                              <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Ações inline no mobile (ao lado do nome para fácil acesso por toque) */}
                                      <div
                                        className="flex sm:hidden items-center gap-1 shrink-0"
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
                                              if (
                                                data.name &&
                                                data.name !== subItem.subcategory.name
                                              ) {
                                                await editSubcategory(subItem.subcategory.id, {
                                                  name: data.name,
                                                })
                                              }

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
                                    </div>

                                    {/* Linha de valores: no mobile recuada com a mesma margem do texto (pl-8), no desktop alinhada à direita com ações e espaçador */}
                                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto shrink-0 pl-8 sm:pl-0">
                                      {/* Gasto vs Teto OU marcador "—" para sem teto */}
                                      <div className="text-left sm:text-right text-xs tabular-nums text-slate-500 min-w-0">
                                        {subItem.limitCents > 0 ? (
                                          <div className="flex items-baseline gap-1 flex-wrap sm:justify-end">
                                            <span className="font-semibold text-slate-800">
                                              {formatBRL(subItem.spentCents)}
                                            </span>
                                            <span className="text-slate-400 text-[10px]">de</span>
                                            <span className="text-slate-500">
                                              {formatBRL(subItem.limitCents)}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-baseline gap-1 sm:justify-end">
                                            {subItem.spentCents > 0 ? (
                                              <span className="font-semibold text-slate-800">
                                                {formatBRL(subItem.spentCents)}
                                              </span>
                                            ) : null}
                                            <span className="text-slate-400 font-medium">—</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* ÍCONES DE GESTÃO NO DESKTOP + Espaçador */}
                                      <div
                                        className="hidden sm:flex items-center gap-1 shrink-0"
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
                                        className="hidden sm:block w-7 shrink-0 pointer-events-none"
                                        aria-hidden="true"
                                      />
                                    </div>
                                  </div>
                                )}
                              />
                            ) : null}

                            {/* Linha extra: Direto na categoria / Sem subcategoria (quando houver gastos diretos) */}
                            {item.directSpentCents > 0 && (
                              <div
                                onClick={() =>
                                  openCategoryTransactionsDrawer(item.category, null, 'direct')
                                }
                                className="py-2 px-2 sm:px-2.5 flex flex-col sm:flex-row sm:items-center justify-between rounded-xl cursor-pointer transition-colors hover:bg-white group/direct gap-1.5 sm:gap-3 touch-manipulation border-t border-slate-100"
                              >
                                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
                                  <div className="w-5 h-6 flex items-center justify-center shrink-0">
                                    <Tag className="w-3.5 h-3.5 text-amber-500" />
                                  </div>
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs sm:text-sm font-medium text-slate-700 group-hover/direct:text-amber-700 transition-colors break-words leading-snug">
                                      Direto na categoria / Sem subcategoria
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto shrink-0 pl-8 sm:pl-0">
                                  <div className="text-left sm:text-right text-xs tabular-nums text-slate-500 min-w-0">
                                    <span className="font-semibold text-slate-800">
                                      {formatBRL(item.directSpentCents)}
                                    </span>
                                  </div>
                                  <div
                                    className="hidden sm:block w-7 shrink-0 pointer-events-none"
                                    aria-hidden="true"
                                  />
                                </div>
                              </div>
                            )}

                            {!hasSubcats && item.directSpentCents === 0 ? (
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
                            ) : null}

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
                    bucketsSummary={categoryBudgetData.bucketsSummary}
                    family={family}
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
                        const newCat = await addNewCategory(
                          data.name,
                          data.type,
                          data.color,
                          data.icon,
                          data.budget_bucket,
                        )
                        if (
                          family &&
                          newCat &&
                          data.type === 'expense' &&
                          data.budget_amount_cents !== undefined
                        ) {
                          await upsertDefaultBudget(
                            family.id,
                            newCat.id,
                            data.budget_amount_cents,
                            null,
                          )
                        }
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

            {/* Editor de categoria controlado aberto via clique em item de alerta do Farol */}
            {activeAlertEditCategory &&
              (() => {
                const item = categoryBudgetData.list.find(
                  (it) => it.category.id === activeAlertEditCategory.id,
                )
                const initialLimit = item?.defaultLimitCents || item?.limitCents || 0

                return (
                  <CategoryEditorPopover
                    key={`alert-edit-${activeAlertEditCategory.id}`}
                    category={activeAlertEditCategory}
                    open={true}
                    onOpenChange={(isOpen) => {
                      if (!isOpen) setActiveAlertEditCategory(null)
                    }}
                    initialLimitCents={initialLimit}
                    bucketsSummary={categoryBudgetData.bucketsSummary}
                    family={family}
                    onSave={async (data) => {
                      try {
                        await editCategory(activeAlertEditCategory.id, {
                          name: data.name,
                          type: data.type,
                          color: data.color,
                          icon: data.icon,
                          budget_bucket: data.budget_bucket,
                        })
                        if (
                          data.type === 'expense' &&
                          typeof data.budget_amount_cents === 'number'
                        ) {
                          const newLimit = Math.max(0, data.budget_amount_cents)
                          setDefaultBudgets((prev) => {
                            const exists = prev.some(
                              (b) =>
                                b.category_id === activeAlertEditCategory.id && !b.subcategory_id,
                            )
                            if (exists) {
                              return prev.map((b) =>
                                b.category_id === activeAlertEditCategory.id && !b.subcategory_id
                                  ? { ...b, amount_cents: newLimit }
                                  : b,
                              )
                            }
                            return [
                              ...prev,
                              {
                                id: `temp-${Date.now()}`,
                                family_id: family!.id,
                                category_id: activeAlertEditCategory.id,
                                subcategory_id: null,
                                amount_cents: newLimit,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                              } as any,
                            ]
                          })
                          if (item?.hasOverride) {
                            setMonthOverrides((prev) =>
                              prev.filter(
                                (b) =>
                                  !(
                                    b.category_id === activeAlertEditCategory.id &&
                                    !b.subcategory_id
                                  ),
                              ),
                            )
                          }
                          await upsertDefaultBudget(
                            family!.id,
                            activeAlertEditCategory.id,
                            newLimit,
                            null,
                          )
                          if (item?.hasOverride) {
                            await resetMonthBudgetToDefault(
                              family!.id,
                              activeAlertEditCategory.id,
                              monthKey,
                              null,
                            )
                          }
                        }
                        setActiveAlertEditCategory(null)
                        triggerRefresh()
                        await loadMonthData()
                      } catch (err: any) {
                        console.error('Erro ao editar categoria via alerta:', err)
                        toast({
                          title: 'Erro ao editar categoria',
                          description: err?.message || 'Tente novamente.',
                          variant: 'destructive',
                        })
                      }
                    }}
                  />
                )
              })()}
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
            {/* Status de Categorização (Filtro Rápido de Pendentes) */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Status de Categoria</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setFilterOnlyPending(false)}
                  className={`py-1.5 rounded-xl text-xs font-semibold border ${
                    !filterOnlyPending
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Todas as transações
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOnlyPending(true)}
                  className={`py-1.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1 ${
                    filterOnlyPending
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <span>Apenas pendentes</span>
                  {pendingTransactionsCount > 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                      {pendingTransactionsCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

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
                setFilterOnlyPending(false)
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

            // Identificação do balde orçamentário da categoria para inteligência de cotas
            const rawBucket = currentCat?.budget_bucket
            let bucketKey: 'essentials' | 'lifestyle' | 'future' = 'lifestyle'
            if (rawBucket === 'essentials' || rawBucket === 'lifestyle' || rawBucket === 'future') {
              bucketKey = rawBucket
            } else if (currentCat?.name) {
              const catNameLower = currentCat.name.toLowerCase()
              if (
                catNameLower.includes('moradia') ||
                catNameLower.includes('alimenta') ||
                catNameLower.includes('saúde') ||
                catNameLower.includes('saude') ||
                catNameLower.includes('transporte') ||
                catNameLower.includes('serviço') ||
                catNameLower.includes('servico')
              ) {
                bucketKey = 'essentials'
              } else if (
                catNameLower.includes('reserva') ||
                catNameLower.includes('invest') ||
                catNameLower.includes('meta')
              ) {
                bucketKey = 'future'
              }
            }

            const netIncomeCents = family?.monthly_net_income_cents || 0
            const targetRatio =
              bucketKey === 'essentials' ? 0.5 : bucketKey === 'lifestyle' ? 0.3 : 0.2
            const bucketMetaCents = Math.round(netIncomeCents * targetRatio)
            const currentBucketBudgetCents =
              categoryBudgetData.bucketsSummary[bucketKey]?.budgetCents || 0
            const freeInBudgetCents = Math.max(0, bucketMetaCents - currentBucketBudgetCents)

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
                          <div className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-semibold tabular-nums text-slate-700">
                            <span className="text-slate-400 text-[11px] font-normal">
                              Calculado:
                            </span>
                            <span>
                              {(() => {
                                const netIncome = family?.monthly_net_income_cents || 0
                                const cents = parseBRLToCents(defaultAmountStr)
                                if (!netIncome || cents <= 0) return '—'
                                const p = Math.round((cents / netIncome) * 1000) / 10
                                return `${p}% da renda`
                              })()}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            Indicador dinâmico informativo
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Faixa de folga no balde (apenas quando freeInBudgetCents > 0) */}
                    {freeInBudgetCents > 0 && (
                      <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-emerald-900">
                        <div className="text-xs">
                          <span className="font-bold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{formatBRL(freeInBudgetCents)} livres no balde</span>
                          </span>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            Você pode somar essa folga ao teto desta categoria.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const currentCents = parseBRLToCents(defaultAmountStr) || 0
                            const newTotalCents = currentCents + freeInBudgetCents
                            setDefaultAmountStr(formatNumberBRL(newTotalCents))
                          }}
                          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer active:scale-95 self-start sm:self-auto touch-manipulation"
                        >
                          + Somar ao teto
                        </button>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500">
                      O percentual é calculado dinamicamente com base na renda líquida familiar (
                      {formatBRL(family?.monthly_net_income_cents || 0)}).
                    </p>

                    {/* Dica existente de Cota Liberada quando o valor é zero ou vazio */}
                    {(() => {
                      const cents = parseBRLToCents(defaultAmountStr)
                      const isZeroOrEmpty = !defaultAmountStr.trim() || cents === 0

                      if (isZeroOrEmpty) {
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-700 flex items-start gap-2">
                            <Lightbulb className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-slate-700 leading-relaxed">
                              <strong className="font-semibold">💡 Cota Liberada:</strong> Ao zerar
                              esta categoria, o valor fica disponível no balde para reforçar outras
                              despesas ou acelerar suas Metas.
                            </p>
                          </div>
                        )
                      }

                      return null
                    })()}
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

                    {/* Faixa de folga no balde (apenas quando freeInBudgetCents > 0) */}
                    {freeInBudgetCents > 0 && (
                      <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-emerald-900">
                        <div className="text-xs">
                          <span className="font-bold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{formatBRL(freeInBudgetCents)} livres no balde</span>
                          </span>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            Você pode somar essa folga ao teto desta categoria.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const currentCents = parseBRLToCents(monthAmountStr) || 0
                            const newTotalCents = currentCents + freeInBudgetCents
                            setMonthAmountStr(formatNumberBRL(newTotalCents))
                          }}
                          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer active:scale-95 self-start sm:self-auto touch-manipulation"
                        >
                          + Somar ao teto
                        </button>
                      </div>
                    )}

                    {/* Dica existente de Cota Liberada quando o valor é zero ou vazio */}
                    {(() => {
                      const cents = parseBRLToCents(monthAmountStr)
                      const isZeroOrEmpty = !monthAmountStr.trim() || cents === 0

                      if (isZeroOrEmpty) {
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-700 flex items-start gap-2">
                            <Lightbulb className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-slate-700 leading-relaxed">
                              <strong className="font-semibold">💡 Cota Liberada:</strong> Ao zerar
                              esta categoria, o valor fica disponível no balde para reforçar outras
                              despesas ou acelerar suas Metas.
                            </p>
                          </div>
                        )
                      }

                      return null
                    })()}
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

      {/* DRAWER DE TRANSAÇÕES COMPONENTES DO ORÇAMENTO (CATEGORIA / SEM SUBCATEGORIA / SUBCATEGORIA) */}
      <CategoryTransactionsDrawer
        open={budgetDrawerOpen}
        onOpenChange={setBudgetDrawerOpen}
        category={budgetDrawerCategory}
        subcategory={budgetDrawerSubcategory}
        filterType={budgetDrawerFilterType}
        transactions={transactions}
        onTransactionUpdated={(updatedTx) => {
          setTransactions((prev) =>
            prev.map((t) => (t.id === updatedTx.id ? { ...t, ...updatedTx } : t)),
          )
          triggerRefresh()
        }}
      />
    </div>
  )
}
