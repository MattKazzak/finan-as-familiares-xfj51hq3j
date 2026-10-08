import React, { createContext, useContext } from 'react'
import type {
  Transaction,
  Budget,
  DefaultBudget,
  TransactionCategory,
  TransactionSubcategory,
  RecurringIncome,
  RecurringIncomeOverride,
  Family,
  FamilyMember,
} from '@/types/finance'
import type { AiCategorizationSuggestion } from '@/services/ai-categorizer'
import type {
  SaveInlineCategoryData,
  SaveBatchSameNameData,
} from '@/components/transactions/TransactionInlineRow'
import type { BucketsSummaryData } from '@/components/wallet/BudgetOverviewCard'

export interface CategoryBudgetItem {
  category: TransactionCategory
  limitCents: number
  explicitLimitCents: number
  defaultLimitCents: number
  subcatsLimitSum: number
  hasSubcatLimits: boolean
  spentCents: number
  directSpentCents: number
  percent: number
  percentOfIncome: number
  isOver: boolean
  hasOverride: boolean
  hasAnySubOverride: boolean
  overrideBudget?: Budget
  defaultBudget?: DefaultBudget
  subcategories: Array<{
    subcategory: TransactionSubcategory
    limitCents: number
    defaultLimitCents: number
    spentCents: number
    percent: number
    isOver: boolean
    hasOverride: boolean
    overrideBudget?: Budget
    defaultBudget?: DefaultBudget
  }>
}

export interface CategoryBudgetData {
  list: CategoryBudgetItem[]
  totalBudget: number
  totalSpent: number
  totalRemaining: number
  totalPercent: number
  isTotalOver: boolean
  bucketsSummary: BucketsSummaryData
  totalBudgetPercentOfIncome: number
}

export interface WalletContextType {
  // Rota e Abas
  activeTab: 'transacoes' | 'orcamentos'
  setActiveTab: (tab: 'transacoes' | 'orcamentos') => void

  // Data / Mês
  currentDate: Date
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>
  monthKey: string
  handlePrevMonth: () => void
  handleNextMonth: () => void

  // Dados carregados
  family: Family | null
  members: FamilyMember[]
  categories: TransactionCategory[]
  transactions: Transaction[]
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  defaultBudgets: DefaultBudget[]
  setDefaultBudgets: React.Dispatch<React.SetStateAction<DefaultBudget[]>>
  monthOverrides: Budget[]
  setMonthOverrides: React.Dispatch<React.SetStateAction<Budget[]>>
  recurringIncomes: RecurringIncome[]
  recurringOverrides: RecurringIncomeOverride[]
  loading: boolean
  loadMonthData: () => Promise<void>
  triggerRefresh: () => void

  // Importação e atalhos useFamily
  openNewTransaction: (type?: 'income' | 'expense') => void
  openImportStatement: () => void
  lastImportSummary: { total: number; categorized: number; pending: number } | null
  setLastImportSummary: (
    summary: { total: number; categorized: number; pending: number } | null,
  ) => void

  // Transações & Filtros
  filteredTransactions: Transaction[]
  groupedTransactions: [string, Transaction[]][]
  pendingTransactionsCount: number
  pendingTransactionsList: Transaction[]
  pendingByPatternMap: Map<string, string[]>
  hasMoreTransactions: boolean
  loadingMore: boolean
  loadMoreTransactions: () => Promise<void>
  monthIncomeCents: number
  monthExpenseCents: number
  monthNetCents: number

  isFilterSheetOpen: boolean
  setIsFilterSheetOpen: React.Dispatch<React.SetStateAction<boolean>>
  filterMemberIds: string[]
  setFilterMemberIds: React.Dispatch<React.SetStateAction<string[]>>
  filterCategoryIds: string[]
  setFilterCategoryIds: React.Dispatch<React.SetStateAction<string[]>>
  filterSubcategoryIds: string[]
  setFilterSubcategoryIds: React.Dispatch<React.SetStateAction<string[]>>
  filterType: 'income' | 'expense' | null
  setFilterType: React.Dispatch<React.SetStateAction<'income' | 'expense' | null>>
  filterOnlyPending: boolean
  setFilterOnlyPending: React.Dispatch<React.SetStateAction<boolean>>
  activeFiltersCount: number

  // IA e Edição Inline de Pendentes
  expandedPendingTxId: string | null
  setExpandedPendingTxId: React.Dispatch<React.SetStateAction<string | null>>
  aiPendingSuggestions: Record<string, AiCategorizationSuggestion>
  isCategorizingPendingWithAi: boolean
  handleCategorizePendingWithAi: () => Promise<void>
  handleSaveInlineCategory: (data: SaveInlineCategoryData) => Promise<void>
  handleSaveBatchSameName: (data: SaveBatchSameNameData) => Promise<void>

  // Ações de Transação (detalhe, edição, exclusão)
  selectedTx: Transaction | null
  setSelectedTx: React.Dispatch<React.SetStateAction<Transaction | null>>
  isDetailOpen: boolean
  setIsDetailOpen: React.Dispatch<React.SetStateAction<boolean>>
  editingTx: Transaction | null
  setEditingTx: React.Dispatch<React.SetStateAction<Transaction | null>>
  editingRecurringRule: RecurringIncome | null
  setEditingRecurringRule: React.Dispatch<React.SetStateAction<RecurringIncome | null>>
  isEditTxOpen: boolean
  setIsEditTxOpen: React.Dispatch<React.SetStateAction<boolean>>
  txToDelete: Transaction | null
  setTxToDelete: React.Dispatch<React.SetStateAction<Transaction | null>>
  handleConfirmDeleteTx: () => Promise<void>

  // Orçamentos
  categoryBudgetData: CategoryBudgetData
  expandedBudgetCategories: Record<string, boolean>
  setExpandedBudgetCategories: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  toggleCatBudgetExpand: (catId: string, e: React.MouseEvent) => void
  isMethodologyExpanded: boolean
  setIsMethodologyExpanded: React.Dispatch<React.SetStateAction<boolean>>

  // Drawer de Transações por Categoria/Subcategoria
  budgetDrawerOpen: boolean
  setBudgetDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>
  budgetDrawerCategory: TransactionCategory | null
  budgetDrawerSubcategory: TransactionSubcategory | null
  budgetDrawerFilterType: 'category' | 'direct' | 'subcategory'
  openCategoryTransactionsDrawer: (
    category: TransactionCategory,
    subcategory?: TransactionSubcategory | null,
    filterType?: 'category' | 'direct' | 'subcategory',
    e?: React.MouseEvent,
  ) => void

  // Operações de Categoria / Subcategoria (useFamily)
  addNewCategory: (
    name: string,
    type: 'income' | 'expense',
    color: string,
    icon: string,
    budget_bucket?: any,
  ) => Promise<TransactionCategory | null>
  editCategory: (
    id: string,
    payload: {
      name?: string
      type?: 'income' | 'expense'
      color?: string
      icon?: string
      budget_bucket?: any
    },
  ) => Promise<TransactionCategory | null>
  removeCategory: (id: string) => Promise<boolean>
  checkCategoryUsage: (id: string) => Promise<number>
  addNewSubcategory: (categoryId: string, name: string) => Promise<TransactionSubcategory | null>
  editSubcategory: (id: string, payload: { name: string }) => Promise<TransactionSubcategory | null>
  removeSubcategory: (id: string) => Promise<boolean>
  checkSubcategoryUsage: (id: string) => Promise<number>
  reorderCategoriesList: (orderedIds: string[]) => Promise<void>
  reorderSubcategoriesList: (categoryId: string, orderedIds: string[]) => Promise<void>

  // Exclusão de categoria / subcategoria com modal
  categoryToDelete: TransactionCategory | null
  setCategoryToDelete: React.Dispatch<React.SetStateAction<TransactionCategory | null>>
  categoryUsageCount: number
  loadingCatUsage: boolean
  handleInitiateDeleteCategory: (cat: TransactionCategory, e: React.MouseEvent) => Promise<void>
  handleConfirmDeleteCategory: () => Promise<void>

  subcategoryToDelete: TransactionSubcategory | null
  setSubcategoryToDelete: React.Dispatch<React.SetStateAction<TransactionSubcategory | null>>
  subcatParentCategoryName: string
  subcategoryUsageCount: number
  loadingSubUsage: boolean
  handleInitiateDeleteSubcategory: (
    sub: TransactionSubcategory,
    parentName: string,
    e: React.MouseEvent,
  ) => Promise<void>
  handleConfirmDeleteSubcategory: () => Promise<void>

  // Editores disparados via Farol e Menu Mobile
  activeAlertEditCategory: TransactionCategory | null
  setActiveAlertEditCategory: React.Dispatch<React.SetStateAction<TransactionCategory | null>>
  mountedAlertEditCategory: TransactionCategory | null
  setMountedAlertEditCategory: React.Dispatch<React.SetStateAction<TransactionCategory | null>>
  isAlertEditorOpen: boolean
  setIsAlertEditorOpen: React.Dispatch<React.SetStateAction<boolean>>

  editingCategoryFromMenu: TransactionCategory | null
  setEditingCategoryFromMenu: React.Dispatch<React.SetStateAction<TransactionCategory | null>>
  mountedCategoryFromMenu: TransactionCategory | null
  setMountedCategoryFromMenu: React.Dispatch<React.SetStateAction<TransactionCategory | null>>
  isMenuCategoryEditorOpen: boolean
  setIsMenuCategoryEditorOpen: React.Dispatch<React.SetStateAction<boolean>>

  addingSubcatForCategory: TransactionCategory | null
  setAddingSubcatForCategory: React.Dispatch<React.SetStateAction<TransactionCategory | null>>
  mountedAddingSubcatCategory: TransactionCategory | null
  setMountedAddingSubcatCategory: React.Dispatch<React.SetStateAction<TransactionCategory | null>>
  isMenuSubcatEditorOpen: boolean
  setIsMenuSubcatEditorOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Modal de edição de orçamento (isBudgetDialogOpen)
  isBudgetDialogOpen: boolean
  setIsBudgetDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  editingBudgetCatId: string
  editingBudgetSubcatId: string | null
  defaultAmountStr: string
  setDefaultAmountStr: React.Dispatch<React.SetStateAction<string>>
  monthAmountStr: string
  setMonthAmountStr: React.Dispatch<React.SetStateAction<string>>
  isEditingOnlyThisMonth: boolean
  setIsEditingOnlyThisMonth: React.Dispatch<React.SetStateAction<boolean>>
  hasMonthOverride: boolean
  savingBudget: boolean
  openBudgetEditor: (
    catId: string,
    subcatId?: string | null,
    currentDefault?: number,
    currentMonthVal?: number,
    isOverridden?: boolean,
    currentPercent?: number | null,
  ) => void
  handleSaveBudgetForm: (e: React.FormEvent) => Promise<void>
  handleResetToDefault: () => Promise<void>
  handleMakeThisMonthDefault: () => Promise<void>

  // Modais de modelos e recorrentes
  isApplyModelOpen: boolean
  setIsApplyModelOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Modal legado de categoria e subcategoria
  isCategoryEditorOpen: boolean
  setIsCategoryEditorOpen: React.Dispatch<React.SetStateAction<boolean>>
  categoryToEdit: TransactionCategory | null
  setCategoryToEdit: React.Dispatch<React.SetStateAction<TransactionCategory | null>>
  categoryEditorName: string
  setCategoryEditorName: React.Dispatch<React.SetStateAction<string>>
  categoryEditorType: 'income' | 'expense'
  setCategoryEditorType: React.Dispatch<React.SetStateAction<'income' | 'expense'>>
  categoryEditorColor: string
  setCategoryEditorColor: React.Dispatch<React.SetStateAction<string>>
  categoryEditorIcon: string
  setCategoryEditorIcon: React.Dispatch<React.SetStateAction<string>>
  categoryEditorBucket: any
  setCategoryEditorBucket: React.Dispatch<React.SetStateAction<any>>
  savingCategoryEditor: boolean
  setSavingCategoryEditor: React.Dispatch<React.SetStateAction<boolean>>

  isNewSubcatDialogOpen: boolean
  setIsNewSubcatDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  categoryForNewSubcat: TransactionCategory | null
  setCategoryForNewSubcat: React.Dispatch<React.SetStateAction<TransactionCategory | null>>
  newSubcatName: string
  setNewSubcatName: React.Dispatch<React.SetStateAction<string>>
  savingNewSubcat: boolean
  setSavingNewSubcat: React.Dispatch<React.SetStateAction<boolean>>
}

const WalletContext = createContext<WalletContextType | null>(null)

export function WalletProvider({
  value,
  children,
}: {
  value: WalletContextType
  children: React.ReactNode
}) {
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet deve ser usado dentro de um WalletProvider')
  }
  return context
}
