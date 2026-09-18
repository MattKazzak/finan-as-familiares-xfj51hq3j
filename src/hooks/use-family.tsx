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
  deleteCategory,
  addSubcategory,
  deleteSubcategory,
  updateFamilyDetails,
  uploadFamilyAvatarFile,
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
  updateFamily: (updates: { name?: string; avatar_url?: string | null }) => Promise<Family>
  uploadFamilyAvatar: (file: File) => Promise<string>
  addMember: (name: string) => Promise<FamilyMember>
  editMember: (id: string, name: string) => Promise<FamilyMember>
  removeMember: (id: string) => Promise<void>
  addNewCategory: (
    name: string,
    type: 'income' | 'expense',
    color?: string,
    icon?: string,
  ) => Promise<TransactionCategory>
  removeCategory: (id: string) => Promise<void>
  addNewSubcategory: (
    categoryId: string,
    name: string,
    icon?: string,
    color?: string,
  ) => Promise<TransactionSubcategory>
  removeSubcategory: (id: string) => Promise<void>
  isNewTransactionOpen: boolean
  setIsNewTransactionOpen: (open: boolean) => void
  newTransactionDefaultType: 'income' | 'expense'
  openNewTransaction: (type?: 'income' | 'expense') => void
  isImportStatementOpen: boolean
  setIsImportStatementOpen: (open: boolean) => void
  openImportStatement: () => void
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
  const [isImportStatementOpen, setIsImportStatementOpen] = useState(false)
  const [isWhoIsUsingOpen, setIsWhoIsUsingOpen] = useState(false)
  const [newTransactionDefaultType, setNewTransactionDefaultType] = useState<'income' | 'expense'>(
    'expense',
  )
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
        setIsWhoIsUsingOpen(true)
      }
    }
  }, [loading, members])

  const updateFamily = async (updates: { name?: string; avatar_url?: string | null }) => {
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
  ) => {
    if (!family) throw new Error('Família não carregada')
    const created = await addCategory(family.id, name, type, color, icon)
    setCategories((prev) => [...prev, created])
    toast({ title: 'Sucesso', description: `Categoria "${name}" criada.` })
    return created
  }

  const removeCategory = async (id: string) => {
    await deleteCategory(id)
    setCategories((prev) => prev.filter((c) => c.id !== id))
    toast({ title: 'Sucesso', description: 'Categoria removida.' })
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
    setNewTransactionDefaultType(type)
    setIsNewTransactionOpen(true)
  }

  const openImportStatement = () => {
    setIsNewTransactionOpen(false)
    setIsImportStatementOpen(true)
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
        removeCategory,
        addNewSubcategory,
        removeSubcategory,
        isNewTransactionOpen,
        setIsNewTransactionOpen,
        newTransactionDefaultType,
        openNewTransaction,
        isImportStatementOpen,
        setIsImportStatementOpen,
        openImportStatement,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </FamilyContext.Provider>
  )
}
