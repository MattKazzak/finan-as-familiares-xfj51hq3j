import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import type {
  Family,
  FamilyMember,
  RecurringIncome,
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
  FamilyCompletenessStatus,
  checkFamilyHasTransactions,
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
    budget_model?: string | null
  }) => Promise<Family>
  uploadFamilyAvatar: (file: File) => Promise<string>
  addMember: (name: string) => Promise<FamilyMember>
  editMember: (id: string, name: string) => Promise<FamilyMember>
  removeMember: (id: string) => Promise<void>
  leaveFamily: () => Promise<void>
  joinFamilyWithCode: (code: string) => Promise<void>
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
  newTransactionPrefill?: {
    initialType?: 'income' | 'expense'
    initialCategoryId?: string
    initialSubcategoryId?: string
    initialAmountCents?: number
    initialDescription?: string
    initialMemberId?: string
  } | null
  editingRecurringRule?: RecurringIncome | null
  setEditingRecurringRule?: (rule: RecurringIncome | null) => void
  openNewTransaction: (
    typeOrPrefill?:
      | 'income'
      | 'expense'
      | {
          initialType?: 'income' | 'expense'
          type?: 'income' | 'expense'
          initialCategoryId?: string
          categoryId?: string
          initialSubcategoryId?: string
          subcategoryId?: string
          initialAmountCents?: number
          amountCents?: number
          initialDescription?: string
          description?: string
          initialMemberId?: string
          memberId?: string
          editingRecurringRule?: RecurringIncome | null
        },
  ) => void
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
  isVoiceDialogOpen: boolean
  setIsVoiceDialogOpen: (open: boolean) => void
  openVoiceDialog: () => void
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
  completeness: FamilyCompletenessStatus | null
  hasAnyTransactions: boolean
  refreshTrigger: number
  triggerRefresh: () => void
  /** Marca passo do tour: atualização OTIMISTA no contexto + RPC fire-and-forget.
      FIX 20/10 (Matheus): o fim do tour disparava 7 fetches concorrentes da
      família (1 por passo) e o último a RESPONDER vencia — um fetch velho
      sobrescrevia tour_steps_done e o tour renascia ao voltar pra Home. */
  markTourStepOptimistic: (stepId: string) => void
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
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false)
  // P2 (auditoria 16/10): 80%+ dos lançamentos do dia a dia são DESPESAS — o formulário
  // abre em Despesa por padrão; Receita continua acessível com 1 toque.
  const [newTransactionDefaultType, setNewTransactionDefaultType] = useState<'income' | 'expense'>(
    'expense',
  )
  const [newTransactionPrefill, setNewTransactionPrefill] = useState<{
    initialType?: 'income' | 'expense'
    initialCategoryId?: string
    initialSubcategoryId?: string
    initialAmountCents?: number
    initialDescription?: string
    initialMemberId?: string
  } | null>(null)
  const [editingRecurringRule, setEditingRecurringRule] = useState<RecurringIncome | null>(null)
  const [lastImportSummary, setLastImportSummary] = useState<{
    total: number
    categorized: number
    pending: number
    importedAt: Date
  } | null>(null)
  const [completeness, setCompleteness] = useState<FamilyCompletenessStatus | null>(null)
  const [hasAnyTransactions, setHasAnyTransactions] = useState<boolean>(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Membro ativo salvo localmente por dispositivo
  const [activeMemberId, setActiveMemberIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('financas_familiares_active_member_id')
    } catch {
      return null
    }
  })

  // AFINAÇÃO 16/10: sem identidade por localStorage — o login define quem está
  // usando. Mantido como no-op por retrocompatibilidade (joinFamilyWithCode etc.).
  const setActiveMemberId = useCallback((_id: string) => {
    try {
      localStorage.removeItem('financas_familiares_active_member_id')
    } catch {
      // Ignora
    }
  }, [])

  // AFINAÇÃO 16/10: o diálogo "Quem está usando?" foi aposentado — a identidade
  // é o login (family_members.user_id === auth.uid). Mantido como no-op por
  // retrocompatibilidade de interface (nenhum chamador deve restar).
  const openWhoIsUsing = useCallback(() => {
    setIsWhoIsUsingOpen(false)
  }, [])

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
    // BUG TOUR RENASCENDO (19/10, Matheus): o tour termina → RPC grava o passo
    // no banco → mas o objeto `family` no contexto ficava VELHO (triggerRefresh
    // só recarregava transações). Voltar pra Home re-montava o walkthrough com
    // tour_steps_done antigo = tour reiniciava sozinho a cada navegação.
    //
    // APP LENTO (20/10, Matheus): a v1 deste fix chamava fetchFamilyData()
    // (família + membros + categorias + completeness — 4+ queries) em CADA
    // refresh de transação. Agora: 1 query leve, só a linha da família, para
    // atualizar tour_steps_done e campos do contexto sem peso.
    ;(async () => {
      if (!user || !family?.id) return
      try {
        const { data } = await (supabase as any)
          .from('families')
          .select('*')
          .eq('id', family.id)
          .single()
        if (data) setFamily(data)
      } catch {
        // Silencioso: o refresh de transações é o caminho principal
      }
    })()
  }, [user, family?.id])

  /** FIX TOUR RENASCENDO (20/10, Matheus): atualização otimista — marca o passo
      no contexto NA HORA (o tour fecha no mesmo instante) e persiste via RPC em
      background. Elimina a corrida: antes, o fim do tour disparava 1 fetch da
      família POR PASSO (7 concorrentes) e o último a responder vencia — um
      fetch velho sobrescrevia tour_steps_done e o tour renascia na Home. */
  const markTourStepOptimistic = useCallback((stepId: string) => {
    setFamily((prev) => {
      if (!prev) return prev
      const done = Array.isArray(prev.tour_steps_done) ? prev.tour_steps_done : []
      if (done.includes(stepId)) return prev
      return { ...prev, tour_steps_done: [...done, stepId] }
    })
    ;(supabase as any)
      .rpc('mark_tour_step', { p_step: stepId })
      .then(() => setRefreshTrigger((p) => p + 1))
      .catch(() => {})
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
      const txCount =
        (data as any)?.completeness?.transactionCount ?? (data as any)?.transactionCount ?? 0
      const hasTxs = Boolean((data as any)?.hasAnyTransactions || txCount > 0)
      setHasAnyTransactions(hasTxs)
      setCompleteness(data.completeness || null)
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

  // AFINAÇÃO MEMBROS (16/10, decisão com o Matheus): quem está usando o app É quem
  // está LOGADO — o login define a identidade, não uma pergunta no aparelho.
  // O antigo diálogo "Quem está usando?" (era single-login de família) foi removido
  // do fluxo: cada membro tem login próprio e family_members.user_id vincula
  // membro ↔ conta. O FILTRO de chips na Home (Todos/Matheus/Karine) continua —
  // ver os dados de cada um é feature de app familiar, não identidade.
  useEffect(() => {
    if (loading || members.length === 0) return
    // Limpa o legado do single-login: o localStorage não define mais identidade.
    try {
      localStorage.removeItem('financas_familiares_active_member_id')
    } catch {
      // Ignora
    }
    setIsWhoIsUsingOpen(false)
  }, [loading, members])

  // Iniciar automaticamente o fluxo de Onboarding (OnboardingWizardDialog)
  // BLINDAGEM DE ROTEAMENTO (R50):
  // Família em uso real NUNCA vê onboarding, em nenhuma hipótese (nem por renda zero, nem por catálogo).
  // Se a família tem qualquer transação, o onboarding JAMAIS abre automaticamente.
  // Onboarding só abre para família NOVA: sem transações E (renda zero OU catálogo vazio / sem regras).
  useEffect(() => {
    if (!loading && family) {
      // Guarda absoluta: se já sabemos pelo contexto que possui transações, não abre nunca
      if (hasAnyTransactions || (completeness?.transactionCount ?? 0) > 0) {
        return
      }

      const hasNoIncome = !family.monthly_net_income_cents || family.monthly_net_income_cents <= 0
      const isIncomplete = completeness?.isIncomplete ?? (!categories || categories.length === 0)

      if (!hasNoIncome && !isIncomplete) {
        return
      }

      // Verificação assíncrona adicional e barata para blindagem completa antes de abrir o wizard
      let isSubscribed = true
      checkFamilyHasTransactions(family.id).then((inDbHasTxs) => {
        if (!isSubscribed) return
        if (inDbHasTxs) {
          setHasAnyTransactions(true)
          return
        }
        setIsOnboardingOpen(true)
      })

      return () => {
        isSubscribed = false
      }
    }
  }, [loading, family, categories, completeness, hasAnyTransactions])

  const updateFamily = async (updates: {
    name?: string
    avatar_url?: string | null
    monthly_net_income_cents?: number | null
    budget_model?: string | null
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
    toast({ title: 'Sucesso', description: 'Membro removido da família.' })
  }

  const leaveFamily = async () => {
    if (!family) throw new Error('Família não carregada')
    const { leaveFamilyWorkspace } = await import('@/services/family')
    await leaveFamilyWorkspace(family.id)
    toast({ title: 'Você saiu da família', description: 'Acesso à família encerrado.' })
    localStorage.removeItem('financas_familiares_active_member_id')
    await reloadFamily()
  }

  const joinFamilyWithCode = async (code: string) => {
    const { acceptFamilyInvite } = await import('@/services/family')
    const res = await acceptFamilyInvite(code)
    if (res?.member_id) {
      setActiveMemberId(res.member_id)
    }
    toast({ title: 'Bem-vindo(a)!', description: 'Você agora faz parte da família.' })
    await reloadFamily()
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

  const openNewTransaction = (
    typeOrPrefill?:
      | 'income'
      | 'expense'
      | {
          initialType?: 'income' | 'expense'
          type?: 'income' | 'expense'
          initialCategoryId?: string
          categoryId?: string
          initialSubcategoryId?: string
          subcategoryId?: string
          initialAmountCents?: number
          amountCents?: number
          initialDescription?: string
          description?: string
          initialMemberId?: string
          memberId?: string
          editingRecurringRule?: RecurringIncome | null
        },
  ) => {
    setIsActionSheetOpen(false)
    if (typeof typeOrPrefill === 'object' && typeOrPrefill !== null) {
      const targetType: 'income' | 'expense' =
        typeOrPrefill.initialType || typeOrPrefill.type || 'income'
      setNewTransactionDefaultType(targetType)
      setNewTransactionPrefill({
        initialType: targetType,
        initialCategoryId: typeOrPrefill.initialCategoryId || typeOrPrefill.categoryId,
        initialSubcategoryId: typeOrPrefill.initialSubcategoryId || typeOrPrefill.subcategoryId,
        initialAmountCents: typeOrPrefill.initialAmountCents ?? typeOrPrefill.amountCents,
        initialDescription: typeOrPrefill.initialDescription || typeOrPrefill.description,
        initialMemberId: typeOrPrefill.initialMemberId || typeOrPrefill.memberId,
      })
      if ('editingRecurringRule' in typeOrPrefill) {
        setEditingRecurringRule(typeOrPrefill.editingRecurringRule || null)
      } else {
        setEditingRecurringRule(null)
      }
    } else {
      // P2 (auditoria 16/10): padrão de criação é 'expense' (Despesa) — 80%+ dos
      // lançamentos do dia a dia são despesas; Receita fica a 1 toque de distância.
      const targetType: 'income' | 'expense' = typeOrPrefill === 'income' ? 'income' : 'expense'
      setNewTransactionDefaultType(targetType)
      setNewTransactionPrefill(null)
      setEditingRecurringRule(null)
    }
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

  const openVoiceDialog = useCallback(() => {
    setIsVoiceDialogOpen(true)
  }, [])

  // AFINAÇÃO MEMBROS (16/10): o currentMember É o usuário LOGADO (member.user_id
  // === auth user.id). Fallback para admin/members[0] cobre membros antigos sem
  // login vinculado (legado). O localStorage não define mais identidade.
  const currentMember =
    (user?.id ? members.find((m) => (m as any).user_id === user.id) : null) ||
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
        leaveFamily,
        joinFamilyWithCode,
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
        newTransactionPrefill,
        editingRecurringRule,
        setEditingRecurringRule,
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
        isVoiceDialogOpen,
        setIsVoiceDialogOpen,
        openVoiceDialog,
        lastImportSummary,
        setLastImportSummary,
        completeness,
        hasAnyTransactions,
        refreshTrigger,
        triggerRefresh,
        markTourStepOptimistic,
      }}
    >
      {children}
    </FamilyContext.Provider>
  )
}
