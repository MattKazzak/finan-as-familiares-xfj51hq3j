import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import type { Family, FamilyMember, TransactionCategory } from '@/types/finance'
import {
  fetchFamilyData,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  addCategory,
  deleteCategory,
} from '@/services/family'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

interface FamilyContextType {
  family: Family | null
  members: FamilyMember[]
  categories: TransactionCategory[]
  selectedMemberId: string | null // null = 'Todos'
  setSelectedMemberId: (id: string | null) => void
  currentMember: FamilyMember | null
  loading: boolean
  reloadFamily: () => Promise<void>
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
  const [newTransactionDefaultType, setNewTransactionDefaultType] = useState<'income' | 'expense'>(
    'expense',
  )
  const [refreshTrigger, setRefreshTrigger] = useState(0)

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

  const openNewTransaction = (type: 'income' | 'expense' = 'expense') => {
    setNewTransactionDefaultType(type)
    setIsNewTransactionOpen(true)
  }

  const openImportStatement = () => {
    setIsNewTransactionOpen(false)
    setIsImportStatementOpen(true)
  }

  const currentMember = members.find((m) => m.is_admin) || members[0] || null

  return (
    <FamilyContext.Provider
      value={{
        family,
        members,
        categories,
        selectedMemberId,
        setSelectedMemberId,
        currentMember,
        loading,
        reloadFamily,
        addMember,
        editMember,
        removeMember,
        addNewCategory,
        removeCategory,
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
