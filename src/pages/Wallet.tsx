import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { useActiveMonth } from '@/contexts/ActiveMonthContext'
import type {
  Transaction,
  Budget,
  DefaultBudget,
  TransactionCategory,
  TransactionSubcategory,
  RecurringIncome,
  RecurringIncomeOverride,
} from '@/types/finance'
import {
  fetchTransactions,
  fetchMonthAggregates,
  type MonthAggregates,
  fetchDefaultBudgets,
  fetchMonthBudgetOverrides,
  upsertMonthBudgetOverride,
  upsertDefaultBudget,
  resetMonthBudgetToDefault,
  deleteTransaction,
  updateTransaction,
  createTransactionsBatch,
} from '@/services/transactions'
import {
  fetchRecurringIncomes,
  fetchRecurringIncomeOverrides,
  processAutoRecurringIncomes,
} from '@/services/recurring-incomes'
import {
  categorizeBatchWithAI,
  extractAiErrorMessage,
  type AiCategorizationSuggestion,
} from '@/services/ai-categorizer'
import { extractPatternFromDescription, normalizeText } from '@/services/import/categorization'
import { upsertCategorizationRule } from '@/services/categorization-rules'
import { formatMonthYear, parseBRLToCents, formatNumberBRL } from '@/lib/formatters'
import { groupInstallmentTransactions } from '@/services/installments'
import type {
  SaveInlineCategoryData,
  SaveBatchSameNameData,
} from '@/components/transactions/TransactionInlineRow'
import type { BucketsSummaryData } from '@/components/wallet/BudgetOverviewCard'

import {
  WalletProvider,
  type WalletContextType,
  type CategoryBudgetData,
} from './wallet/WalletContext'
import { WalletHeader } from './wallet/WalletHeader'
import { WalletTransactionsTab } from './wallet/WalletTransactionsTab'
import { WalletBudgetsTab } from './wallet/WalletBudgetsTab'
import { WalletModals } from './wallet/WalletModals'

export function WalletPage() {
  const location = useLocation()
  const {
    family,
    members,
    categories,
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

  // Sincronização da aba com base na URL: /orcamentos ativa "orcamentos", /carteira ativa "transacoes"
  const [activeTab, setActiveTab] = useState<'transacoes' | 'orcamentos'>(() => {
    return location.pathname.includes('/orcamentos') ? 'orcamentos' : 'transacoes'
  })

  // Sincronizar se a rota mudar externamente
  useEffect(() => {
    if (location.pathname.includes('/orcamentos')) {
      setActiveTab('orcamentos')
    } else if (location.pathname.includes('/carteira')) {
      setActiveTab('transacoes')
    }
  }, [location.pathname])

  // Estado do Mês Selecionado — Consolidado no activeMonth GLOBAL
  const {
    activeMonth,
    activeDate: currentDate,
    prevMonth: handlePrevMonth,
    nextMonth: handleNextMonth,
  } = useActiveMonth()
  const monthKey = activeMonth

  // Dados carregados do backend
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [hasMoreTransactions, setHasMoreTransactions] = useState<boolean>(false)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)
  const [monthAggregates, setMonthAggregates] = useState<MonthAggregates>({
    incomeCents: 0,
    expenseCents: 0,
    netCents: 0,
    spentByCat: {},
    spentBySubcat: {},
    directSpentByCat: {},
  })
  const [defaultBudgets, setDefaultBudgets] = useState<DefaultBudget[]>([])
  const [monthOverrides, setMonthOverrides] = useState<Budget[]>([])
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([])
  const [recurringOverrides, setRecurringOverrides] = useState<RecurringIncomeOverride[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Resumo de importação recente (se recebido via location.state)
  const [lastImportSummary, setLastImportSummary] = useState<{
    total: number
    categorized: number
    pending: number
  } | null>(() => {
    const state = location.state as any
    if (state?.importSummary) {
      return state.importSummary
    }
    return null
  })

  // Filtros da aba de transações
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [filterMemberIds, setFilterMemberIds] = useState<string[]>([])
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([])
  const [filterSubcategoryIds, setFilterSubcategoryIds] = useState<string[]>([])
  const [filterType, setFilterType] = useState<'income' | 'expense' | null>(null)
  const [filterOnlyPending, setFilterOnlyPending] = useState<boolean>(() => {
    const state = location.state as any
    return Boolean(state?.filterOnlyPending)
  })

  // Transação selecionada para detalhes / edição
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [editingRecurringRule, setEditingRecurringRule] = useState<RecurringIncome | null>(null)
  const [isEditTxOpen, setIsEditTxOpen] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)

  // Categorização em massa via IA para pendentes
  const [isCategorizingPendingWithAi, setIsCategorizingPendingWithAi] = useState<boolean>(false)
  const [aiPendingSuggestions, setAiPendingSuggestions] = useState<
    Record<string, AiCategorizationSuggestion>
  >({})
  const [expandedPendingTxId, setExpandedPendingTxId] = useState<string | null>(null)

  // Modal de edição de orçamento (teto)
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false)
  const [editingBudgetCatId, setEditingBudgetCatId] = useState<string>('')
  const [editingBudgetSubcatId, setEditingBudgetSubcatId] = useState<string | null>(null)
  const [defaultAmountStr, setDefaultAmountStr] = useState<string>('')
  const [monthAmountStr, setMonthAmountStr] = useState<string>('')
  const [isEditingOnlyThisMonth, setIsEditingOnlyThisMonth] = useState<boolean>(false)
  const [hasMonthOverride, setHasMonthOverride] = useState<boolean>(false)
  const [savingBudget, setSavingBudget] = useState(false)

  // Drawer de Transações Filtradas por Categoria / Subcategoria
  const [budgetDrawerOpen, setBudgetDrawerOpen] = useState<boolean>(false)
  const [budgetDrawerCategory, setBudgetDrawerCategory] = useState<TransactionCategory | null>(null)
  const [budgetDrawerSubcategory, setBudgetDrawerSubcategory] =
    useState<TransactionSubcategory | null>(null)
  const [budgetDrawerFilterType, setBudgetDrawerFilterType] = useState<
    'category' | 'direct' | 'subcategory'
  >('category')

  // Modais de exclusão com verificação de vínculo
  const [categoryToDelete, setCategoryToDelete] = useState<TransactionCategory | null>(null)
  const [categoryUsageCount, setCategoryUsageCount] = useState<number>(0)
  const [loadingCatUsage, setLoadingCatUsage] = useState<boolean>(false)

  const [subcategoryToDelete, setSubcategoryToDelete] = useState<TransactionSubcategory | null>(
    null,
  )
  const [subcatParentCategoryName, setSubcatParentCategoryName] = useState<string>('')
  const [subcategoryUsageCount, setSubcategoryUsageCount] = useState<number>(0)
  const [loadingSubUsage, setLoadingSubUsage] = useState<boolean>(false)

  // Modais adicionais
  const [isApplyModelOpen, setIsApplyModelOpen] = useState(false)

  // Expandir / recolher subcategorias na listagem de orçamentos
  const [expandedBudgetCategories, setExpandedBudgetCategories] = useState<Record<string, boolean>>(
    {},
  )

  // Estado para expandir/recolher a nota explicativa da POF/IBGE
  const [isMethodologyExpanded, setIsMethodologyExpanded] = useState<boolean>(false)

  // Estados legados do CategoryEditor/SubcategoryEditor
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false)
  const [categoryToEdit, setCategoryToEdit] = useState<TransactionCategory | null>(null)
  const [categoryEditorName, setCategoryEditorName] = useState('')
  const [categoryEditorType, setCategoryEditorType] = useState<'income' | 'expense'>('expense')
  const [categoryEditorColor, setCategoryEditorColor] = useState('#10B981')
  const [categoryEditorIcon, setCategoryEditorIcon] = useState('tag')
  const [categoryEditorBucket, setCategoryEditorBucket] = useState<any>('essentials')
  const [savingCategoryEditor, setSavingCategoryEditor] = useState(false)

  const [isNewSubcatDialogOpen, setIsNewSubcatDialogOpen] = useState(false)
  const [categoryForNewSubcat, setCategoryForNewSubcat] = useState<TransactionCategory | null>(null)
  const [newSubcatName, setNewSubcatName] = useState('')
  const [savingNewSubcat, setSavingNewSubcat] = useState(false)

  // Editores disparados via Farol e Menu Mobile
  const [activeAlertEditCategory, setActiveAlertEditCategory] =
    useState<TransactionCategory | null>(null)
  const [mountedAlertEditCategory, setMountedAlertEditCategory] =
    useState<TransactionCategory | null>(null)
  const [isAlertEditorOpen, setIsAlertEditorOpen] = useState<boolean>(false)

  useEffect(() => {
    if (activeAlertEditCategory) {
      setMountedAlertEditCategory(activeAlertEditCategory)
      setIsAlertEditorOpen(true)
    }
  }, [activeAlertEditCategory])

  const [editingCategoryFromMenu, setEditingCategoryFromMenu] =
    useState<TransactionCategory | null>(null)
  const [mountedCategoryFromMenu, setMountedCategoryFromMenu] =
    useState<TransactionCategory | null>(null)
  const [isMenuCategoryEditorOpen, setIsMenuCategoryEditorOpen] = useState<boolean>(false)

  useEffect(() => {
    if (editingCategoryFromMenu) {
      setMountedCategoryFromMenu(editingCategoryFromMenu)
      setIsMenuCategoryEditorOpen(true)
    }
  }, [editingCategoryFromMenu])

  const [addingSubcatForCategory, setAddingSubcatForCategory] =
    useState<TransactionCategory | null>(null)
  const [mountedAddingSubcatCategory, setMountedAddingSubcatCategory] =
    useState<TransactionCategory | null>(null)
  const [isMenuSubcatEditorOpen, setIsMenuSubcatEditorOpen] = useState<boolean>(false)

  useEffect(() => {
    if (addingSubcatForCategory) {
      setMountedAddingSubcatCategory(addingSubcatForCategory)
      setIsMenuSubcatEditorOpen(true)
    }
  }, [addingSubcatForCategory])

  // Função central de carregamento de dados do mês
  const loadMonthData = useCallback(async () => {
    if (!family) return
    setLoading(true)
    try {
      try {
        await processAutoRecurringIncomes({
          familyId: family.id,
          targetMonthStr: monthKey,
        })
      } catch (procErr) {
        console.warn('Erro ao processar recorrentes automáticas:', procErr)
      }

      const [txs, aggs, defaults, overrides, recIncomes, recOverrides] = await Promise.all([
        fetchTransactions({ familyId: family.id, month: monthKey, limit: 50, offset: 0 }),
        fetchMonthAggregates(family.id, monthKey),
        fetchDefaultBudgets(family.id),
        fetchMonthBudgetOverrides(family.id, monthKey),
        fetchRecurringIncomes(family.id),
        fetchRecurringIncomeOverrides(family.id, monthKey),
      ])

      setTransactions(txs)
      setHasMoreTransactions(txs.length === 50)
      setMonthAggregates(aggs)
      setDefaultBudgets(defaults)
      setMonthOverrides(overrides)
      setRecurringIncomes(recIncomes)
      setRecurringOverrides(recOverrides)
    } catch (err: any) {
      console.error('Erro ao carregar dados do mês:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [family, monthKey, currentDate, toast])

  useEffect(() => {
    loadMonthData()
  }, [loadMonthData])

  const loadMoreTransactions = useCallback(async () => {
    if (!family || loadingMore || !hasMoreTransactions) return
    setLoadingMore(true)
    try {
      const nextBatch = await fetchTransactions({
        familyId: family.id,
        month: monthKey,
        limit: 50,
        offset: transactions.length,
      })
      if (nextBatch.length < 50) {
        setHasMoreTransactions(false)
      }
      setTransactions((prev) => [...prev, ...nextBatch])
    } catch (err: any) {
      console.error('Erro ao carregar mais transações:', err)
      toast({
        title: 'Erro ao paginar extrato',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoadingMore(false)
    }
  }, [family, loadingMore, hasMoreTransactions, monthKey, transactions.length, toast])

  // Filtragem de Transações
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterOnlyPending && tx.category_id) return false
      if (
        filterMemberIds.length > 0 &&
        (!tx.member_id || !filterMemberIds.includes(tx.member_id))
      ) {
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
      if (filterType && tx.type !== filterType) return false
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

  // Agrupamento de parcelas e por dia
  const groupedTransactions = useMemo(() => {
    const groupedList = groupInstallmentTransactions(filteredTransactions, {
      referenceDate: `${monthKey}-31`,
    })

    const byDate: Record<string, Transaction[]> = {}
    groupedList.forEach((item) => {
      const tx = item.representativeTx as Transaction
      const dateKey = item.transactionDate || tx.transaction_date
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push(tx)
    })

    const sortedDates = Object.keys(byDate).sort((a, b) => {
      const timeA = new Date(a).getTime()
      const timeB = new Date(b).getTime()
      if (timeA !== timeB) return timeB - timeA
      return 0
    })

    return sortedDates.map((dateKey) => [dateKey, byDate[dateKey]] as [string, Transaction[]])
  }, [filteredTransactions, monthKey])

  // Lançamentos pendentes e agrupamento por padrão
  const pendingTransactionsList = useMemo(() => {
    return transactions.filter((tx) => !tx.category_id)
  }, [transactions])

  const pendingTransactionsCount = pendingTransactionsList.length

  const pendingByPatternMap = useMemo(() => {
    const map = new Map<string, string[]>()
    pendingTransactionsList.forEach((tx) => {
      const pattern = (
        extractPatternFromDescription(tx.description || '') || normalizeText(tx.description || '')
      ).toUpperCase()
      if (!pattern) return
      const existing = map.get(pattern) || []
      existing.push(tx.id)
      map.set(pattern, existing)
    })
    return map
  }, [pendingTransactionsList])

  // Totais do Mês — preservados do mês inteiro via agregação leve
  const monthIncomeCents = monthAggregates.incomeCents
  const monthExpenseCents = monthAggregates.expenseCents
  const monthNetCents = monthAggregates.netCents

  const activeFiltersCount =
    (filterOnlyPending ? 1 : 0) +
    filterMemberIds.length +
    filterCategoryIds.length +
    filterSubcategoryIds.length +
    (filterType ? 1 : 0)

  // Categorização com IA para pendentes
  const handleCategorizePendingWithAi = async () => {
    if (pendingTransactionsList.length === 0) {
      toast({
        title: 'Nenhuma transação pendente',
        description: 'Todas as transações deste mês já possuem categoria.',
      })
      return
    }

    setIsCategorizingPendingWithAi(true)
    try {
      const inputs = pendingTransactionsList.map((tx) => ({
        tempId: tx.id,
        description: tx.description,
        amountCents: tx.amount_cents,
        date: tx.transaction_date,
      }))

      const validCategoryIds = new Set(categories.map((c) => c.id))
      const aiSuggestions = await categorizeBatchWithAI(inputs, family?.id, {
        validCategoryIds,
      })
      const suggestionsMap: Record<string, AiCategorizationSuggestion> = {}
      aiSuggestions.forEach((s) => {
        suggestionsMap[s.tempId] = s
      })
      setAiPendingSuggestions(suggestionsMap)

      const highConfidence = aiSuggestions.filter(
        (s) => s.categoryId && validCategoryIds.has(s.categoryId) && (s.confidence ?? 0) >= 0.7,
      )

      if (highConfidence.length > 0) {
        let appliedCount = 0
        for (const item of highConfidence) {
          try {
            await updateTransaction(item.tempId, {
              category_id: item.categoryId,
              subcategory_id: item.subcategoryId || null,
            })
            appliedCount++
          } catch (updateErr) {
            console.warn('Erro ao auto-aplicar sugestão:', updateErr)
          }
        }

        if (appliedCount > 0) {
          toast({
            title: `✨ IA categorizou ${appliedCount} ${appliedCount === 1 ? 'transação' : 'transações'}!`,
            description: `${aiSuggestions.length - appliedCount} sugestões restantes prontas para conferência rápida.`,
          })
          triggerRefresh()
          await loadMonthData()
        }
      } else {
        toast({
          title: 'Sugestões da IA carregadas',
          description: 'Clique nas transações pendentes para conferir e aprovar as sugestões.',
        })
      }
    } catch (err: any) {
      console.error('Erro ao categorizar com IA:', err)
      const errInfo = await extractAiErrorMessage(err)
      toast({
        title: 'Erro ao conectar à IA',
        description: errInfo.message,
        variant: 'destructive',
      })
    } finally {
      setIsCategorizingPendingWithAi(false)
    }
  }

  // Salvamento rápido em linha
  const handleSaveInlineCategory = async (data: SaveInlineCategoryData) => {
    try {
      await updateTransaction(data.transactionId, {
        category_id: data.categoryId,
        subcategory_id: data.subcategoryId || null,
        description: data.description,
        type: data.type,
        member_id: data.memberId,
        transaction_date: data.date,
      })

      if (data.rememberRule && family) {
        try {
          const pattern =
            extractPatternFromDescription(data.description) || normalizeText(data.description)
          if (pattern) {
            await upsertCategorizationRule({
              family_id: family.id,
              pattern,
              category_id: data.categoryId,
              subcategory_id: data.subcategoryId || null,
            })
          }
        } catch (ruleErr) {
          console.warn('Erro ao salvar regra automática:', ruleErr)
        }
      }

      setExpandedPendingTxId(null)
      toast({
        title: 'Transação categorizada!',
        description: data.rememberRule
          ? 'Regra salva. Lançamentos futuros semelhantes serão automáticos.'
          : undefined,
      })
      triggerRefresh()
      await loadMonthData()
    } catch (err: any) {
      console.error('Erro ao categorizar transação:', err)
      toast({
        title: 'Erro ao categorizar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  // Salvamento em lote para lançamentos de mesmo nome
  const handleSaveBatchSameName = async (data: SaveBatchSameNameData) => {
    try {
      const allIds = data.transactionIds
      let count = 0
      for (const id of allIds) {
        try {
          await updateTransaction(id, {
            category_id: data.categoryId,
            subcategory_id: data.subcategoryId || null,
            type: data.type,
          })
          count++
        } catch (updateErr) {
          console.warn(`Erro ao atualizar transação ${id}:`, updateErr)
        }
      }

      if (data.rememberRule && family) {
        try {
          const pattern =
            data.pattern ||
            extractPatternFromDescription(data.description) ||
            normalizeText(data.description)
          if (pattern) {
            await upsertCategorizationRule({
              family_id: family.id,
              pattern,
              category_id: data.categoryId,
              subcategory_id: data.subcategoryId || null,
            })
          }
        } catch (ruleErr) {
          console.warn('Erro ao salvar regra automática:', ruleErr)
        }
      }

      setExpandedPendingTxId(null)
      toast({
        title: `✨ ${count} ${count === 1 ? 'transação categorizada' : 'transações categorizadas'}!`,
        description: data.rememberRule ? 'Regra permanente criada no seu assistente.' : undefined,
      })
      triggerRefresh()
      await loadMonthData()
    } catch (err: any) {
      console.error('Erro no lote de categorização:', err)
      toast({
        title: 'Erro ao categorizar em lote',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  // Exclusão de transação
  const handleConfirmDeleteTx = async () => {
    if (!txToDelete) return
    try {
      await deleteTransaction(txToDelete.id)
      toast({
        title: 'Transação excluída',
        description: 'Lançamento removido com sucesso.',
      })
      setTxToDelete(null)
      triggerRefresh()
      await loadMonthData()
    } catch (err: any) {
      console.error('Erro ao excluir transação:', err)
      toast({
        title: 'Erro ao excluir transação',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  // Cálculo de Orçamentos das Categorias
  const categoryBudgetData = useMemo<CategoryBudgetData>(() => {
    const expenseCategories = categories.filter((c) => c.type === 'expense')

    // Usar agregações calculadas sobre o mês inteiro
    const spentByCat = monthAggregates.spentByCat
    const spentBySubcat = monthAggregates.spentBySubcat
    const directSpentByCat = monthAggregates.directSpentByCat

    const defaultBudgetMap = new Map<string, DefaultBudget>()
    defaultBudgets.forEach((b) => {
      const key = b.subcategory_id ? `sub_${b.subcategory_id}` : `cat_${b.category_id}`
      defaultBudgetMap.set(key, b)
    })

    const overrideMap = new Map<string, Budget>()
    monthOverrides.forEach((b) => {
      const key = b.subcategory_id ? `sub_${b.subcategory_id}` : `cat_${b.category_id}`
      overrideMap.set(key, b)
    })

    const list = expenseCategories.map((cat) => {
      const catOverride = overrideMap.get(`cat_${cat.id}`)
      const catDefault = defaultBudgetMap.get(`cat_${cat.id}`)
      const hasCatOverride = Boolean(catOverride)

      const explicitLimitCents = catOverride
        ? catOverride.amount_cents
        : catDefault
          ? catDefault.amount_cents
          : 0

      const defaultLimitCents = catDefault ? catDefault.amount_cents : 0
      const spentCents = spentByCat[cat.id] || 0
      const directSpentCents = directSpentByCat[cat.id] || 0

      let subcatsLimitSum = 0
      let hasAnySubOverride = false

      const subcategories = (cat.subcategories || []).map((sub) => {
        const subOverride = overrideMap.get(`sub_${sub.id}`)
        const subDefault = defaultBudgetMap.get(`sub_${sub.id}`)
        const hasSubOverride = Boolean(subOverride)
        if (hasSubOverride) hasAnySubOverride = true

        const subLimitCents = subOverride
          ? subOverride.amount_cents
          : subDefault
            ? subDefault.amount_cents
            : 0

        const subDefaultLimitCents = subDefault ? subDefault.amount_cents : 0
        const subSpentCents = spentBySubcat[sub.id] || 0
        subcatsLimitSum += subLimitCents

        const subPercent = subLimitCents > 0 ? Math.round((subSpentCents / subLimitCents) * 100) : 0
        const isSubOver = subLimitCents > 0 && subSpentCents > subLimitCents

        return {
          subcategory: sub,
          limitCents: subLimitCents,
          defaultLimitCents: subDefaultLimitCents,
          spentCents: subSpentCents,
          percent: subPercent,
          isOver: isSubOver,
          hasOverride: hasSubOverride,
          overrideBudget: subOverride,
          defaultBudget: subDefault,
        }
      })

      const hasSubcatLimits = subcatsLimitSum > 0
      const effectiveLimitCents = hasSubcatLimits ? subcatsLimitSum : explicitLimitCents

      const percent =
        effectiveLimitCents > 0 ? Math.round((spentCents / effectiveLimitCents) * 100) : 0
      const isOver = effectiveLimitCents > 0 && spentCents > effectiveLimitCents

      const percentOfIncome =
        family?.monthly_net_income_cents && family.monthly_net_income_cents > 0
          ? Math.round((effectiveLimitCents / family.monthly_net_income_cents) * 1000) / 10
          : 0

      return {
        category: cat,
        limitCents: effectiveLimitCents,
        explicitLimitCents,
        defaultLimitCents,
        subcatsLimitSum,
        hasSubcatLimits,
        spentCents,
        directSpentCents,
        percent,
        percentOfIncome,
        isOver,
        hasOverride: hasCatOverride,
        hasAnySubOverride,
        overrideBudget: catOverride,
        defaultBudget: catDefault,
        subcategories,
      }
    })

    const totalBudget = list.reduce((sum, item) => sum + item.limitCents, 0)
    const totalSpent = list.reduce((sum, item) => sum + item.spentCents, 0)
    const totalRemaining = totalBudget - totalSpent
    const totalPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
    const isTotalOver = totalBudget > 0 && totalSpent > totalBudget

    const totalBudgetPercentOfIncome =
      family?.monthly_net_income_cents && family.monthly_net_income_cents > 0
        ? Math.round((totalBudget / family.monthly_net_income_cents) * 1000) / 10
        : 0

    const bucketsSummary: BucketsSummaryData = {
      essentials: {
        budgetCents: 0,
        spentCents: 0,
        percentIncome: 0,
      },
      lifestyle: {
        budgetCents: 0,
        spentCents: 0,
        percentIncome: 0,
      },
      future: {
        budgetCents: 0,
        spentCents: 0,
        percentIncome: 0,
      },
      other: {
        budgetCents: 0,
        spentCents: 0,
        percentIncome: 0,
      },
    }

    list.forEach((item) => {
      const bucket = (item.category.budget_bucket as keyof BucketsSummaryData) || 'other'
      if (bucketsSummary[bucket]) {
        bucketsSummary[bucket].budgetCents += item.limitCents
        bucketsSummary[bucket].spentCents += item.spentCents
      } else {
        bucketsSummary.other.budgetCents += item.limitCents
        bucketsSummary.other.spentCents += item.spentCents
      }
    })

    if (family?.monthly_net_income_cents && family.monthly_net_income_cents > 0) {
      const net = family.monthly_net_income_cents
      bucketsSummary.essentials.percentIncome =
        Math.round((bucketsSummary.essentials.budgetCents / net) * 1000) / 10
      bucketsSummary.lifestyle.percentIncome =
        Math.round((bucketsSummary.lifestyle.budgetCents / net) * 1000) / 10
      bucketsSummary.future.percentIncome =
        Math.round((bucketsSummary.future.budgetCents / net) * 1000) / 10
      bucketsSummary.other.percentIncome =
        Math.round((bucketsSummary.other.budgetCents / net) * 1000) / 10
    }

    return {
      list,
      totalBudget,
      totalSpent,
      totalRemaining,
      totalPercent,
      isTotalOver,
      bucketsSummary,
      totalBudgetPercentOfIncome,
    }
  }, [categories, defaultBudgets, monthOverrides, monthAggregates, family])

  // Abertura do editor de orçamento de categoria/subcategoria
  const openBudgetEditor = (
    catId: string,
    subcatId: string | null = null,
    currentDefault?: number,
    currentMonthVal?: number,
    isOverridden?: boolean,
    currentPercent?: number | null,
  ) => {
    setEditingBudgetCatId(catId)
    setEditingBudgetSubcatId(subcatId)

    const defCents = currentDefault || 0
    const mCents = isOverridden && currentMonthVal !== undefined ? currentMonthVal : defCents

    setDefaultAmountStr(formatNumberBRL(defCents))
    setMonthAmountStr(formatNumberBRL(mCents))
    setHasMonthOverride(Boolean(isOverridden))
    setIsEditingOnlyThisMonth(Boolean(isOverridden))
    setIsBudgetDialogOpen(true)
  }

  // Submissão do formulário de orçamento
  const handleSaveBudgetForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family || !editingBudgetCatId) return

    setSavingBudget(true)
    try {
      if (isEditingOnlyThisMonth) {
        const monthCents = parseBRLToCents(monthAmountStr)
        await upsertMonthBudgetOverride(
          family.id,
          editingBudgetCatId,
          monthKey,
          monthCents,
          editingBudgetSubcatId,
        )
        toast({
          title: 'Orçamento atualizado!',
          description: `Ajuste exclusivo para ${formatMonthYear(currentDate)} salvo.`,
        })
      } else {
        const defaultCents = parseBRLToCents(defaultAmountStr)
        await upsertDefaultBudget(
          family.id,
          editingBudgetCatId,
          defaultCents,
          editingBudgetSubcatId,
        )
        if (hasMonthOverride) {
          await resetMonthBudgetToDefault(
            family.id,
            editingBudgetCatId,
            monthKey,
            editingBudgetSubcatId,
          )
        }
        toast({
          title: 'Orçamento padrão atualizado!',
          description: 'Valor aplicado para todos os meses.',
        })
      }

      setIsBudgetDialogOpen(false)
      triggerRefresh()
      await loadMonthData()
    } catch (err: any) {
      console.error('Erro ao salvar orçamento:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingBudget(false)
    }
  }

  // Restaurar ajuste mensal para o valor padrão
  const handleResetToDefault = async () => {
    if (!family || !editingBudgetCatId) return
    setSavingBudget(true)
    try {
      await resetMonthBudgetToDefault(
        family.id,
        editingBudgetCatId,
        monthKey,
        editingBudgetSubcatId,
      )
      toast({
        title: 'Ajuste removido',
        description: 'Este mês voltou a usar o valor padrão fixo.',
      })
      setIsBudgetDialogOpen(false)
      triggerRefresh()
      await loadMonthData()
    } catch (err: any) {
      console.error('Erro ao restaurar padrão:', err)
      toast({
        title: 'Erro ao restaurar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingBudget(false)
    }
  }

  // Promover o ajuste deste mês como o novo padrão
  const handleMakeThisMonthDefault = async () => {
    if (!family || !editingBudgetCatId) return
    setSavingBudget(true)
    try {
      const monthCents = parseBRLToCents(monthAmountStr)
      await upsertDefaultBudget(family.id, editingBudgetCatId, monthCents, editingBudgetSubcatId)
      await resetMonthBudgetToDefault(
        family.id,
        editingBudgetCatId,
        monthKey,
        editingBudgetSubcatId,
      )
      toast({
        title: 'Novo padrão definitivo!',
        description: 'Esse valor agora é a meta fixa de todos os meses.',
      })
      setIsBudgetDialogOpen(false)
      triggerRefresh()
      await loadMonthData()
    } catch (err: any) {
      console.error('Erro ao promover para padrão:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingBudget(false)
    }
  }

  // Toggle de expansão de subcategorias no orçamento
  const toggleCatBudgetExpand = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedBudgetCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }))
  }

  // Abertura do Drawer de Transações por Categoria/Subcategoria
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

  // Iniciar exclusão de categoria com contagem de uso
  const handleInitiateDeleteCategory = async (cat: TransactionCategory, e: React.MouseEvent) => {
    e.stopPropagation()
    setCategoryToDelete(cat)
    setLoadingCatUsage(true)
    try {
      const count = await checkCategoryUsage(cat.id)
      setCategoryUsageCount(count)
    } catch (err) {
      console.error('Erro ao checar uso da categoria:', err)
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
      setCategoryToDelete(null)
      triggerRefresh()
      await loadMonthData()
    } catch (err: any) {
      console.error('Erro ao excluir categoria:', err)
    }
  }

  // Iniciar exclusão de subcategoria com contagem de uso
  const handleInitiateDeleteSubcategory = async (
    sub: TransactionSubcategory,
    parentName: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    setSubcategoryToDelete(sub)
    setSubcatParentCategoryName(parentName)
    setLoadingSubUsage(true)
    try {
      const count = await checkSubcategoryUsage(sub.id)
      setSubcategoryUsageCount(count)
    } catch (err) {
      console.error('Erro ao checar uso da subcategoria:', err)
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
      setSubcategoryToDelete(null)
      triggerRefresh()
      await loadMonthData()
    } catch (err: any) {
      console.error('Erro ao excluir subcategoria:', err)
    }
  }

  // Empacotamento de tudo no contexto da Carteira
  const walletContextValue: WalletContextType = {
    activeTab,
    setActiveTab,
    currentDate,
    setCurrentDate: () => {},
    monthKey,
    handlePrevMonth,
    handleNextMonth,
    family,
    members,
    categories,
    transactions,
    setTransactions,
    defaultBudgets,
    setDefaultBudgets,
    monthOverrides,
    setMonthOverrides,
    recurringIncomes,
    recurringOverrides,
    loading,
    loadMonthData,
    triggerRefresh,
    openNewTransaction,
    openImportStatement,
    lastImportSummary,
    setLastImportSummary,
    filteredTransactions,
    groupedTransactions,
    pendingTransactionsCount,
    pendingTransactionsList,
    pendingByPatternMap,
    hasMoreTransactions,
    loadingMore,
    loadMoreTransactions,
    monthIncomeCents,
    monthExpenseCents,
    monthNetCents,
    isFilterSheetOpen,
    setIsFilterSheetOpen,
    filterMemberIds,
    setFilterMemberIds,
    filterCategoryIds,
    setFilterCategoryIds,
    filterSubcategoryIds,
    setFilterSubcategoryIds,
    filterType,
    setFilterType,
    filterOnlyPending,
    setFilterOnlyPending,
    activeFiltersCount,
    expandedPendingTxId,
    setExpandedPendingTxId,
    aiPendingSuggestions,
    isCategorizingPendingWithAi,
    handleCategorizePendingWithAi,
    handleSaveInlineCategory,
    handleSaveBatchSameName,
    selectedTx,
    setSelectedTx,
    isDetailOpen,
    setIsDetailOpen,
    editingTx,
    setEditingTx,
    editingRecurringRule,
    setEditingRecurringRule,
    isEditTxOpen,
    setIsEditTxOpen,
    txToDelete,
    setTxToDelete,
    handleConfirmDeleteTx,
    categoryBudgetData,
    expandedBudgetCategories,
    setExpandedBudgetCategories,
    toggleCatBudgetExpand,
    isMethodologyExpanded,
    setIsMethodologyExpanded,
    budgetDrawerOpen,
    setBudgetDrawerOpen,
    budgetDrawerCategory,
    budgetDrawerSubcategory,
    budgetDrawerFilterType,
    openCategoryTransactionsDrawer,
    addNewCategory,
    editCategory,
    removeCategory: async (id: string) => {
      await removeCategory(id)
      return true
    },
    checkCategoryUsage,
    addNewSubcategory,
    editSubcategory,
    removeSubcategory: async (id: string) => {
      await removeSubcategory(id)
      return true
    },
    checkSubcategoryUsage,
    reorderCategoriesList,
    reorderSubcategoriesList,
    categoryToDelete,
    setCategoryToDelete,
    categoryUsageCount,
    loadingCatUsage,
    handleInitiateDeleteCategory,
    handleConfirmDeleteCategory,
    subcategoryToDelete,
    setSubcategoryToDelete,
    subcatParentCategoryName,
    subcategoryUsageCount,
    loadingSubUsage,
    handleInitiateDeleteSubcategory,
    handleConfirmDeleteSubcategory,
    activeAlertEditCategory,
    setActiveAlertEditCategory,
    mountedAlertEditCategory,
    setMountedAlertEditCategory,
    isAlertEditorOpen,
    setIsAlertEditorOpen,
    editingCategoryFromMenu,
    setEditingCategoryFromMenu,
    mountedCategoryFromMenu,
    setMountedCategoryFromMenu,
    isMenuCategoryEditorOpen,
    setIsMenuCategoryEditorOpen,
    addingSubcatForCategory,
    setAddingSubcatForCategory,
    mountedAddingSubcatCategory,
    setMountedAddingSubcatCategory,
    isMenuSubcatEditorOpen,
    setIsMenuSubcatEditorOpen,
    isBudgetDialogOpen,
    setIsBudgetDialogOpen,
    editingBudgetCatId,
    editingBudgetSubcatId,
    defaultAmountStr,
    setDefaultAmountStr,
    monthAmountStr,
    setMonthAmountStr,
    isEditingOnlyThisMonth,
    setIsEditingOnlyThisMonth,
    hasMonthOverride,
    savingBudget,
    openBudgetEditor,
    handleSaveBudgetForm,
    handleResetToDefault,
    handleMakeThisMonthDefault,
    isApplyModelOpen,
    setIsApplyModelOpen,
    isCategoryEditorOpen,
    setIsCategoryEditorOpen,
    categoryToEdit,
    setCategoryToEdit,
    categoryEditorName,
    setCategoryEditorName,
    categoryEditorType,
    setCategoryEditorType,
    categoryEditorColor,
    setCategoryEditorColor,
    categoryEditorIcon,
    setCategoryEditorIcon,
    categoryEditorBucket,
    setCategoryEditorBucket,
    savingCategoryEditor,
    setSavingCategoryEditor,
    isNewSubcatDialogOpen,
    setIsNewSubcatDialogOpen,
    categoryForNewSubcat,
    setCategoryForNewSubcat,
    newSubcatName,
    setNewSubcatName,
    savingNewSubcat,
    setSavingNewSubcat,
  }

  return (
    <WalletProvider value={walletContextValue}>
      <div className="space-y-4 pb-24 max-w-5xl mx-auto">
        {/* Cabeçalho de Navegação de Mês, Tabs e Atalhos */}
        <WalletHeader />

        {/* Conteúdo da Aba Ativa */}
        {activeTab === 'transacoes' ? <WalletTransactionsTab /> : <WalletBudgetsTab />}

        {/* Modais, Sheets, Dialogs e Drawers */}
        <WalletModals />
      </div>
    </WalletProvider>
  )
}
export default WalletPage
