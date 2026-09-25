import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import type {
  Family,
  FamilyMember,
  TransactionCategory,
  TransactionSubcategory,
} from '@/types/finance'
import {
  fetchFamilyData,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  addCategory,
  updateCategory,
  deleteCategory,
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
  getCategoryUsageCount,
  getSubcategoryUsageCount,
  updateFamilyDetails,
  uploadFamilyAvatarFile,
  reorderCategories,
  reorderSubcategories,
} from '@/services/family'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

interface FamilyContextType {
  family: Family | null
  members: FamilyMember[]
  categories: TransactionCategory[]
  selectedMemberId: string | null // null = 'Todos'
  setSelectedMemberId: (id: string | null) => void
  activeMemberId: string | null
  setActiveMemberId: (id: string) => void
  currentMember: FamilyMember | null
  isWhoIsUsingOpen: boolean
  setIsWhoIsUsingOpen: (open: boolean) => void
  openWhoIsUsing: () => void
  loading: boolean
  reloadFamily: () => Promise<void>
  updateFamily: (updates: {
    name?: string
    avatar_url?: string | null
    monthly_net_income_cents?: number | null
  }) => Promise<Family>
  uploadFamilyAvatar: (file: File) => Promise<string>
  addMember: (name: string) => Promise<FamilyMember>
  editMember: (id: string, name: string) => Promise<FamilyMember>
  removeMember: (id: string) => Promise<void>
  addNewCategory: (
    name: string,
    type: 'income' | 'expense',
    color?: string,
    icon?: string,
    budget_bucket?: 'essentials' | 'lifestyle' | 'future' | null,
  ) => Promise<TransactionCategory>
  editCategory: (
    id: string,
    updates: {
      name?: string
      color?: string
      icon?: string
      type?: 'income' | 'expense'
      percent_default?: number | null
      percent_alert?: number | null
      budget_bucket?: 'essentials' | 'lifestyle' | 'future' | null
    },
  ) => Promise<TransactionCategory>
  removeCategory: (id: string) => Promise<void>
  checkCategoryUsage: (id: string) => Promise<number>
  addNewSubcategory: (
    categoryId: string,
    name: string,
    icon?: string,
    color?: string,
  ) => Promise<TransactionSubcategory>
  editSubcategory: (
    id: string,
    updates: { name?: string; icon?: string | null; color?: string | null },
  ) => Promise<TransactionSubcategory>
  removeSubcategory: (id: string) => Promise<void>
  checkSubcategoryUsage: (id: string) => Promise<number>
  reorderCategoriesList: (orderedIds: string[]) => Promise<void>
  reorderSubcategoriesList: (categoryId: string, orderedIds: string[]) => Promise<void>
  isNewTransactionOpen: boolean
  setIsNewTransactionOpen: (open: boolean) => void
  newTransactionDefaultType: 'income' | 'expense'
  openNewTransaction: (type?: 'income' | 'expense') => void
  voiceTransactionData?: {
    type: 'expense' | 'income'
    amountCents: number
    description: string
    categoryId?: string
    memberId?: string
  } | null
  setVoiceTransactionData?: (data: any) => void
  isActionSheetOpen: boolean
  setIsActionSheetOpen: (open: boolean) => void
  openActionSheet: () => void
  isRecurringIncomesOpen: boolean
  setIsRecurringIncomesOpen: (open: boolean) => void
  openRecurringIncomes: () => void
  isImportStatementOpen: boolean
  setIsImportStatementOpen: (open: boolean) => void
  openImportStatement: () => void
  isOnboardingOpen: boolean
  setIsOnboardingOpen: (open: boolean) => void
  openOnboarding: () => void
  lastImportSummary: {
    total: number
    categorized: number
    pending: number
    importedAt: Date
  } | null
  setLastImportSummary: (
    summary: {
      total: number
      categorized: number
      pending: number
      importedAt: Date
    } | null,
  ) => void
  refreshTrigger: number
  triggerRefresh: () => void
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined)

export const useFamily = () => {
  const context = useContext(FamilyContext)
  if (!context) throw new Error('useFamily must be used within a FamilyProvider')
  return context
}

export const FamilyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [categories, setCategories] = useState<TransactionCategory[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null) // null = 'Todos'
  const [loading, setLoading] = useState<boolean>(true)
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false)
  const [voiceTransactionData, setVoiceTransactionData] = useState<any>(null)
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false)
  const [isRecurringIncomesOpen, setIsRecurringIncomesOpen] = useState(false)
  const [isImportStatementOpen, setIsImportStatementOpen] = useState(false)
  const [isWhoIsUsingOpen, setIsWhoIsUsingOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [newTransactionDefaultType, setNewTransactionDefaultType] = useState<'income' | 'expense'>(
    'expense',
  )
  const [lastImportSummary, setLastImportSummary] = useState<{
    total: number
    categorized: number
    pending: number
    importedAt: Date
  } | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Membro ativo salvo localmente por dispositivo
  const [activeMemberId, setActiveMemberIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('financas_familiares_active_member_id')
    } catch {
      return null
    }
  })

  const setActiveMemberId = useCallback((id: string) => {
    setActiveMemberIdState(id)
    try {
      localStorage.setItem('financas_familiares_active_member_id', id)
    } catch {
      // Ignora erro de local storage desativado
    }
  }, [])

  const openWhoIsUsing = useCallback(() => {
    setIsWhoIsUsingOpen(true)
  }, [])

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  const reloadFamily = useCallback(async () => {
    if (!user) {
      setFamily(null)
      setMembers([])
      setCategories([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await fetchFamilyData()
      setFamily(data.family)
      setMembers(data.members)
      setCategories(data.categories)
    } catch (err: any) {
      console.error('Erro ao carregar dados da família:', err)
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível carregar os dados da família.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  useEffect(() => {
    reloadFamily()
  }, [reloadFamily])

  // Se houver membros carregados e nenhum membro ativo estiver configurado no localStorage,
  // abre o modal "Quem está usando?" na primeira utilização do dispositivo.
  useEffect(() => {
    if (!loading && members.length > 0) {
      const stored = localStorage.getItem('financas_familiares_active_member_id')
      if (!stored || !members.some((m) => m.id === stored)) {
        // Se a família tem renda cadastrada, pode sugerir quem está usando; senão o onboarding terá prioridade
        if (family?.monthly_net_income_cents && family.monthly_net_income_cents > 0) {
          setIsWhoIsUsingOpen(true)
        }
      }
    }
  }, [loading, members, family?.monthly_net_income_cents])

  // Iniciar automaticamente o fluxo de Onboarding (OnboardingWizardDialog)
  // Gatilho: Se family.monthly_net_income_cents for nulo/zero OU a família não possuir categorias cadastradas
  useEffect(() => {
    if (!loading && family) {
      const hasNoIncome = !family.monthly_net_income_cents || family.monthly_net_income_cents <= 0
      const hasNoCategories = !categories || categories.length === 0

      if (hasNoIncome || hasNoCategories) {
        const onboardingDismissed = sessionStorage.getItem(`onboarding_dismissed_${family.id}`)
        if (!onboardingDismissed) {
          setIsOnboardingOpen(true)
        }
      }
    }
  }, [loading, family, categories])

  const updateFamily = async (updates: {
    name?: string
    avatar_url?: string | null
    monthly_net_income_cents?: number | null
  }) => {
    if (!family) throw new Error('Família não carregada')
    const updated = await updateFamilyDetails(family.id, updates)
    setFamily(updated)
    toast({ title: 'Sucesso', description: 'Informações da família atualizadas.' })
    return updated
  }

  const uploadFamilyAvatar = async (file: File) => {
    if (!family) throw new Error('Família não carregada')
    const url = await uploadFamilyAvatarFile(family.id, file)
    const updated = await updateFamilyDetails(family.id, { avatar_url: url })
    setFamily(updated)
    toast({ title: 'Foto atualizada', description: 'O avatar da família foi salvo com sucesso.' })
    return url
  }

  const addMember = async (name: string) => {
    if (!family) throw new Error('Família não carregada')
    const created = await addFamilyMember(family.id, name)
    setMembers((prev) => [...prev, created])
    toast({ title: 'Sucesso', description: `Membro ${name} adicionado com sucesso.` })
    return created
  }

  const editMember = async (id: string, name: string) => {
    const updated = await updateFamilyMember(id, name)
    setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)))
    toast({ title: 'Sucesso', description: 'Nome atualizado com sucesso.' })
    return updated
  }

  const removeMember = async (id: string) => {
    await deleteFamilyMember(id)
    setMembers((prev) => prev.filter((m) => m.id !== id))
    if (selectedMemberId === id) setSelectedMemberId(null)
    toast({ title: 'Sucesso', description: 'Membro removido.' })
  }

  const addNewCategory = async (
    name: string,
    type: 'income' | 'expense',
    color?: string,
    icon?: string,
    budget_bucket?: 'essentials' | 'lifestyle' | 'future' | null,
  ) => {
    if (!family) throw new Error('Família não carregada')
    const created = await addCategory(family.id, name, type, color, icon, budget_bucket)
    setCategories((prev) => [...prev, created])
    toast({ title: 'Sucesso', description: `Categoria "${name}" criada.` })
    return created
  }

  const editCategory = async (
    id: string,
    updates: {
      name?: string
      color?: string
      icon?: string
      type?: 'income' | 'expense'
      percent_default?: number | null
      percent_alert?: number | null
      budget_bucket?: 'essentials' | 'lifestyle' | 'future' | null
    },
  ) => {
    const updated = await updateCategory(id, updates)
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updated, subcategories: c.subcategories } : c)),
    )
    toast({ title: 'Sucesso', description: 'Categoria atualizada.' })
    return updated
  }

  const removeCategory = async (id: string) => {
    await deleteCategory(id)
    setCategories((prev) => prev.filter((c) => c.id !== id))
    toast({ title: 'Sucesso', description: 'Categoria removida e lançamentos desassociados.' })
  }

  const checkCategoryUsage = async (id: string) => {
    return await getCategoryUsageCount(id)
  }

  const checkSubcategoryUsage = async (id: string) => {
    return await getSubcategoryUsageCount(id)
  }

  const reorderCategoriesList = async (orderedIds: string[]) => {
    // Atualização otimista imediata no estado local
    setCategories((prev) => {
      const catMap = new Map(prev.map((c) => [c.id, c]))
      const sorted: TransactionCategory[] = []
      orderedIds.forEach((id, idx) => {
        const cat = catMap.get(id)
        if (cat) {
          sorted.push({ ...cat, sort_order: idx + 1 })
          catMap.delete(id)
        }
      })
      // Qualquer categoria não inclusa na lista mantém sua posição relativa ao final
      for (const remaining of catMap.values()) {
        sorted.push(remaining)
      }
      return sorted
    })

    try {
      await reorderCategories(orderedIds)
    } catch (err) {
      console.error('Erro ao salvar nova ordem das categorias:', err)
      toast({
        title: 'Erro ao salvar ordem',
        description: 'Não foi possível salvar a nova ordem das categorias.',
        variant: 'destructive',
      })
      // Recarrega do banco para desfazer
      await reloadFamily()
    }
  }

  const reorderSubcategoriesList = async (categoryId: string, orderedIds: string[]) => {
    // Atualização otimista imediata no estado local
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== categoryId || !cat.subcategories) return cat
        const subMap = new Map(cat.subcategories.map((s) => [s.id, s]))
        const sorted: TransactionSubcategory[] = []
        orderedIds.forEach((id, idx) => {
          const sub = subMap.get(id)
          if (sub) {
            sorted.push({ ...sub, sort_order: idx + 1 })
            subMap.delete(id)
          }
        })
        for (const remaining of subMap.values()) {
          sorted.push(remaining)
        }
        return {
          ...cat,
          subcategories: sorted,
        }
      }),
    )

    try {
      await reorderSubcategories(orderedIds)
    } catch (err) {
      console.error('Erro ao salvar nova ordem das subcategorias:', err)
      toast({
        title: 'Erro ao salvar ordem',
        description: 'Não foi possível salvar a nova ordem das subcategorias.',
        variant: 'destructive',
      })
      await reloadFamily()
    }
  }

  const addNewSubcategory = async (
    categoryId: string,
    name: string,
    icon?: string,
    color?: string,
  ) => {
    if (!family) throw new Error('Família não carregada')
    const created = await addSubcategory(categoryId, family.id, name, icon, color)
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === categoryId) {
          return {
            ...c,
            subcategories: [...(c.subcategories || []), created],
          }
        }
        return c
      }),
    )
    toast({ title: 'Sucesso', description: `Subcategoria "${name}" criada.` })
    return created
  }

  const editSubcategory = async (
    id: string,
    updates: { name?: string; icon?: string | null; color?: string | null },
  ) => {
    const updated = await updateSubcategory(id, updates)
    setCategories((prev) =>
      prev.map((c) => ({
        ...c,
        subcategories: (c.subcategories || []).map((s) => (s.id === id ? { ...s, ...updated } : s)),
      })),
    )
    toast({ title: 'Sucesso', description: 'Subcategoria atualizada.' })
    return updated as TransactionSubcategory
  }

  const removeSubcategory = async (id: string) => {
    await deleteSubcategory(id)
    setCategories((prev) =>
      prev.map((c) => ({
        ...c,
        subcategories: (c.subcategories || []).filter((s) => s.id !== id),
      })),
    )
    toast({ title: 'Sucesso', description: 'Subcategoria removida.' })
  }

  const openNewTransaction = (type: 'income' | 'expense' = 'expense') => {
    setIsActionSheetOpen(false)
    setNewTransactionDefaultType(type)
    setIsNewTransactionOpen(true)
  }

  const openActionSheet = () => {
    setIsActionSheetOpen(true)
  }

  const openRecurringIncomes = () => {
    setIsActionSheetOpen(false)
    setIsRecurringIncomesOpen(true)
  }

  const openImportStatement = () => {
    setIsActionSheetOpen(false)
    setIsNewTransactionOpen(false)
    setIsImportStatementOpen(true)
  }

  const openOnboarding = () => {
    setIsOnboardingOpen(true)
  }

  // Se o activeMemberId apontar para um membro existente, ele é o currentMember do dispositivo;
  // senão faz fallback para o admin ou primeiro membro
  const currentMember =
    (activeMemberId ? members.find((m) => m.id === activeMemberId) : null) ||
    members.find((m) => m.is_admin) ||
    members[0] ||
    null

  return (
    <FamilyContext.Provider
      value={{
        family,
        members,
        categories,
        selectedMemberId,
        setSelectedMemberId,
        activeMemberId,
        setActiveMemberId,
        currentMember,
        isWhoIsUsingOpen,
        setIsWhoIsUsingOpen,
        openWhoIsUsing,
        loading,
        reloadFamily,
        updateFamily,
        uploadFamilyAvatar,
        addMember,
        editMember,
        removeMember,
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
        isNewTransactionOpen,
        setIsNewTransactionOpen,
        newTransactionDefaultType,
        openNewTransaction,
        voiceTransactionData,
        setVoiceTransactionData,
        isActionSheetOpen,
        setIsActionSheetOpen,
        openActionSheet,
        isRecurringIncomesOpen,
        setIsRecurringIncomesOpen,
        openRecurringIncomes,
        isImportStatementOpen,
        setIsImportStatementOpen,
        openImportStatement,
        isOnboardingOpen,
        setIsOnboardingOpen,
        openOnboarding,
        lastImportSummary,
        setLastImportSummary,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </FamilyContext.Provider>
  )
}
