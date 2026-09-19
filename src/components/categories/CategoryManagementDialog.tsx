import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategoryIcon, AVAILABLE_ICONS } from '@/components/common/CategoryIcon'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import type { TransactionCategory, TransactionSubcategory } from '@/types/finance'
import { Plus, Trash2, Loader2, AlertTriangle, Layers, Tag } from 'lucide-react'

const CATEGORY_COLORS = [
  '#F59E0B',
  '#3B82F6',
  '#6366F1',
  '#EC4899',
  '#EF4444',
  '#8B5CF6',
  '#14B8A6',
  '#10B981',
  '#059669',
  '#64748B',
]

interface CategoryManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const CategoryManagementDialog: React.FC<CategoryManagementDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const {
    family,
    categories,
    addNewCategory,
    removeCategory,
    checkCategoryUsage,
    addNewSubcategory,
    removeSubcategory,
    checkSubcategoryUsage,
    triggerRefresh,
  } = useFamily()
  const { toast } = useToast()

  // Filtro de visualização (todas, despesas, receitas)
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all')

  // Formulário Nova Categoria
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense')
  const [newCatColor, setNewCatColor] = useState('#3B82F6')
  const [newCatIcon, setNewCatIcon] = useState('Tag')
  const [savingCat, setSavingCat] = useState(false)

  // Subcategorias
  const [expandedCatForSub, setExpandedCatForSub] = useState<string | null>(null)
  const [newSubName, setNewSubName] = useState('')
  const [savingSub, setSavingSub] = useState(false)

  // Diálogo de confirmação de exclusão de categoria
  const [catToDelete, setCatToDelete] = useState<TransactionCategory | null>(null)
  const [catUsageCount, setCatUsageCount] = useState<number>(0)
  const [checkingCatUsage, setCheckingCatUsage] = useState(false)

  // Diálogo de confirmação de exclusão de subcategoria
  const [subToDelete, setSubToDelete] = useState<TransactionSubcategory | null>(null)
  const [subUsageCount, setSubUsageCount] = useState<number>(0)
  const [checkingSubUsage, setCheckingSubUsage] = useState(false)

  const filteredCategories = categories.filter((c) => {
    if (filterType === 'all') return true
    return c.type === filterType
  })

  // Iniciar exclusão de Categoria com contagem de lançamentos
  const handleInitiateDeleteCategory = async (cat: TransactionCategory) => {
    try {
      setCheckingCatUsage(true)
      const count = await checkCategoryUsage(cat.id)
      setCatUsageCount(count)
      setCatToDelete(cat)
    } catch (err) {
      console.error(err)
      setCatUsageCount(0)
      setCatToDelete(cat)
    } finally {
      setCheckingCatUsage(false)
    }
  }

  // Confirmar exclusão de Categoria
  const handleConfirmDeleteCategory = async () => {
    if (!catToDelete) return
    try {
      await removeCategory(catToDelete.id)
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao excluir categoria',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCatToDelete(null)
    }
  }

  // Iniciar exclusão de Subcategoria com contagem de lançamentos
  const handleInitiateDeleteSubcategory = async (sub: TransactionSubcategory) => {
    try {
      setCheckingSubUsage(true)
      const count = await checkSubcategoryUsage(sub.id)
      setSubUsageCount(count)
      setSubToDelete(sub)
    } catch (err) {
      console.error(err)
      setSubUsageCount(0)
      setSubToDelete(sub)
    } finally {
      setCheckingSubUsage(false)
    }
  }

  // Confirmar exclusão de Subcategoria
  const handleConfirmDeleteSubcategory = async () => {
    if (!subToDelete) return
    try {
      await removeSubcategory(subToDelete.id)
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao excluir subcategoria',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubToDelete(null)
    }
  }

  // Criar categoria
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    try {
      setSavingCat(true)
      await addNewCategory(newCatName.trim(), newCatType, newCatColor, newCatIcon)
      setNewCatName('')
      setIsAddingCategory(false)
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao criar categoria',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingCat(false)
    }
  }

  // Criar subcategoria
  const handleAddSubcategory = async (e: React.FormEvent, categoryId: string) => {
    e.preventDefault()
    if (!newSubName.trim()) return
    try {
      setSavingSub(true)
      await addNewSubcategory(categoryId, newSubName.trim())
      setNewSubName('')
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao criar subcategoria',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingSub(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-3xl p-5 sm:p-7 max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-emerald-700" />
                  <span>Gerenciar Categorias</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Crie e organize categorias e subcategorias. Os orçamentos vinculados refletirão
                  esta estrutura.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Filtros rápidos & Botão Nova Categoria */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterType === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Todas</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('expense')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterType === 'expense'
                    ? 'bg-white text-red-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Despesas</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('income')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterType === 'income'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Receitas</span>
              </button>
            </div>

            <Button
              type="button"
              onClick={() => setIsAddingCategory((prev) => !prev)}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl gap-1.5 h-8 font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingCategory ? 'Cancelar cadastro' : 'Nova Categoria'}</span>
            </Button>
          </div>

          {/* Formulário Retrátil para Nova Categoria */}
          {isAddingCategory ? (
            <form
              onSubmit={handleAddCategory}
              className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 space-y-3 animate-in fade-in-50"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">Nova Categoria</span>
                <span className="text-[10px] text-emerald-800 font-semibold uppercase">
                  Personalizada
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  type="text"
                  placeholder="Nome da categoria"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="bg-white text-xs h-9"
                  autoFocus
                  required
                />

                <Select
                  value={newCatType}
                  onValueChange={(v) => setNewCatType(v as 'income' | 'expense')}
                >
                  <SelectTrigger className="bg-white text-xs h-9">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">
                      <span>Despesa</span>
                    </SelectItem>
                    <SelectItem value="income">
                      <span>Receita</span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={newCatIcon} onValueChange={setNewCatIcon}>
                  <SelectTrigger className="bg-white text-xs h-9">
                    <SelectValue placeholder="Ícone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {AVAILABLE_ICONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        <span>{icon}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seletor de Cores */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Cor:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setNewCatColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        newCatColor === c ? 'ring-2 ring-slate-900 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingCategory(false)}
                  className="text-xs h-8 rounded-xl"
                >
                  <span>Cancelar</span>
                </Button>
                <Button
                  type="submit"
                  disabled={savingCat || !newCatName.trim()}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 rounded-xl"
                >
                  <span className="flex items-center gap-1.5">
                    {savingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Salvar Categoria</span>
                  </span>
                </Button>
              </div>
            </form>
          ) : null}

          {/* Lista de Categorias com Rolagem Suave */}
          <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-2.5">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                <span>Nenhuma categoria encontrada para este filtro.</span>
              </div>
            ) : null}

            {filteredCategories.map((cat) => {
              const isSubExpanded = expandedCatForSub === cat.id
              const subCount = cat.subcategories?.length || 0

              return (
                <div
                  key={cat.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-3 space-y-2 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: cat.color || '#64748B' }}
                      >
                        <CategoryIcon name={cat.icon} className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800 truncate">
                            {cat.name}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                              cat.type === 'income'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <span>{cat.type === 'income' ? 'Receita' : 'Despesa'}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400">
                            <span>
                              {subCount} {subCount === 1 ? 'subcategoria' : 'subcategorias'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedCatForSub(isSubExpanded ? null : cat.id)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-xl transition-all ${
                          isSubExpanded
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        <span>{isSubExpanded ? 'Fechar' : '+ Subcategorias'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInitiateDeleteCategory(cat)}
                        disabled={checkingCatUsage}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Excluir categoria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Área aninhada de subcategorias */}
                  {isSubExpanded ? (
                    <div className="mt-2 pl-3 border-l-2 border-emerald-500/40 space-y-2 pt-1 animate-in fade-in-50">
                      <div className="flex flex-wrap gap-1.5">
                        {(!cat.subcategories || cat.subcategories.length === 0) && (
                          <p className="text-[11px] text-slate-400 py-1">
                            Nenhuma subcategoria cadastrada ainda.
                          </p>
                        )}
                        {cat.subcategories?.map((sub) => (
                          <div
                            key={sub.id}
                            className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl text-xs text-slate-700 shadow-2xs"
                          >
                            <span>{sub.name}</span>
                            <button
                              type="button"
                              onClick={() => handleInitiateDeleteSubcategory(sub)}
                              className="text-slate-400 hover:text-red-600 transition-colors ml-0.5 p-0.5 rounded"
                              title="Remover subcategoria"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Input de criação rápida de subcategoria */}
                      <form
                        onSubmit={(e) => handleAddSubcategory(e, cat.id)}
                        className="flex items-center gap-2 pt-1"
                      >
                        <Input
                          type="text"
                          placeholder={`Nova subcategoria em ${cat.name}...`}
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          className="h-8 text-xs bg-slate-50/50 rounded-xl"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={savingSub || !newSubName.trim()}
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl px-3 shrink-0"
                        >
                          <span className="flex items-center gap-1">
                            {savingSub ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            <span>Adicionar</span>
                          </span>
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl w-full sm:w-auto"
            >
              <span>Fechar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE CATEGORIA COM CONTAGEM DE LANÇAMENTOS */}
      <AlertDialog
        open={Boolean(catToDelete)}
        onOpenChange={(openState) => !openState && setCatToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <AlertDialogTitle className="text-base font-bold text-slate-900">
                <span>Excluir categoria?</span>
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
              <p>
                <span>Tem certeza que deseja excluir a categoria </span>
                <strong className="text-slate-900">{catToDelete?.name}</strong>?
              </p>
              {catUsageCount > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                  <span>
                    Atenção: existem <strong>{catUsageCount} lançamentos</strong> vinculados a esta
                    categoria. Eles continuarão registrados no extrato, mas ficarão desassociados
                    (sem categoria).
                  </span>
                </div>
              ) : (
                <p className="text-slate-400 text-[11px]">
                  Nenhum lançamento está utilizando esta categoria atualmente.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="text-xs rounded-xl">
              <span>Cancelar</span>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteCategory}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl"
            >
              <span>Excluir categoria</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE SUBCATEGORIA COM CONTAGEM DE LANÇAMENTOS */}
      <AlertDialog
        open={Boolean(subToDelete)}
        onOpenChange={(openState) => !openState && setSubToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <AlertDialogTitle className="text-base font-bold text-slate-900">
                <span>Excluir subcategoria?</span>
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
              <p>
                <span>Tem certeza que deseja excluir a subcategoria </span>
                <strong className="text-slate-900">{subToDelete?.name}</strong>?
              </p>
              {subUsageCount > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                  <span>
                    Atenção: existem <strong>{subUsageCount} lançamentos</strong> vinculados a esta
                    subcategoria. Eles permanecerão na categoria principal, mas com a subcategoria
                    desassociada.
                  </span>
                </div>
              ) : (
                <p className="text-slate-400 text-[11px]">
                  Nenhum lançamento está utilizando esta subcategoria atualmente.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="text-xs rounded-xl">
              <span>Cancelar</span>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteSubcategory}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl"
            >
              <span>Excluir subcategoria</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
