import React, { useState, useMemo } from 'react'
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
import { CategoryIcon, CategoryIconBox, AVAILABLE_ICONS } from '@/components/common/CategoryIcon'
import { CATEGORY_COLORS, BUCKET_OPTIONS } from './CategoryEditorPopover'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { updateCategory } from '@/services/family'
import type { BudgetBucket, TransactionCategory, TransactionSubcategory } from '@/types/finance'
import {
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  Layers,
  Tag,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import { parseBRLToCents, formatBRL } from '@/lib/formatters'
import { upsertDefaultBudget } from '@/services/transactions'
import { restoreMissingCatalog, resetCatalogToDefault } from '@/services/catalog-restore'

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

  // ===== Categorias ocultas (catálogo v3 — onboarding inteligente) =====
  // O app inteiro filtra is_hidden=false; aqui elas voltam a ser visíveis
  // para reativação com 1 toque (RotateCcw).
  const hiddenCategories = useMemo(
    () => categories.filter((c) => c.is_hidden === true),
    [categories],
  )

  const reactivateCategory = async (catId: string, catName: string) => {
    try {
      await updateCategory(catId, { is_hidden: false })
      toast({
        title: `✓ ${catName} reativada`,
        description: 'A categoria voltou para os pickers e orçamentos do app.',
      })
      triggerRefresh()
    } catch (e: any) {
      console.warn('Erro ao reativar categoria:', e?.message)
      toast({
        title: 'Não foi possível reativar',
        description: e?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    }
  }

  // Filtro de visualização (todas, despesas, receitas)
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all')
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)

  // Formulário Nova Categoria
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense')
  const [newCatColor, setNewCatColor] = useState('#3B82F6')
  const [newCatIcon, setNewCatIcon] = useState('Tag')
  const [newCatBucket, setNewCatBucket] = useState<BudgetBucket>('essentials')
  const [newCatLimitStr, setNewCatLimitStr] = useState('')
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

  // Estado dos diálogos de Restauração de Catálogo Padrão
  const [showRestoreMenu, setShowRestoreMenu] = useState(false)
  const [showAddMissingConfirm, setShowAddMissingConfirm] = useState(false)
  const [showResetWarningStep1, setShowResetWarningStep1] = useState(false)
  const [showResetConfirmStep2, setShowResetConfirmStep2] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreSummary, setRestoreSummary] = useState<{
    mode: 'missing' | 'reset'
    categoriesAdded: number
    subcategoriesAdded: number
    reassignedCount?: number
  } | null>(null)

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
    if (newCatType === 'expense' && !newCatBucket) {
      toast({
        title: 'Balde obrigatório',
        description: 'Selecione um dos 3 baldes orçamentários.',
        variant: 'destructive',
      })
      return
    }
    try {
      setSavingCat(true)
      const createdCat = await addNewCategory(
        newCatName.trim(),
        newCatType,
        newCatColor,
        newCatIcon,
        newCatType === 'expense' ? newCatBucket : null,
      )

      if (family && createdCat && newCatType === 'expense') {
        const cents = parseBRLToCents(newCatLimitStr)
        if (cents > 0) {
          await upsertDefaultBudget(family.id, createdCat.id, cents, null)
        }
      }

      setNewCatName('')
      setNewCatBucket('essentials')
      setNewCatLimitStr('')
      setIsAddingCategory(false)
      triggerRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar categoria',
        description: err?.message || 'Tente novamente.',
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

          {/* Filtros rápidos, Ações & Botão Nova Categoria */}
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

            <div className="flex items-center gap-2">
              {/* Botão Restaurar Catálogo Padrão */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRestoreMenu(true)}
                className="text-xs rounded-xl gap-1.5 h-8 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>Restaurar padrão</span>
              </Button>

              <Button
                type="button"
                onClick={() => setIsAddingCategory((prev) => !prev)}
                size="sm"
                className="bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] text-xs rounded-xl gap-1.5 h-8 font-bold shadow-xs border-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingCategory ? 'Cancelar cadastro' : 'Nova Categoria'}</span>
              </Button>
            </div>
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

              {/* Balde Orçamentário (Obrigatório para categorias de Despesa) */}
              {newCatType === 'expense' && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Balde Orçamentário <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Obrigatório</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {BUCKET_OPTIONS.map((opt) => {
                      const isSelected = newCatBucket === opt.id
                      const IconComp = opt.icon
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setNewCatBucket(opt.id)}
                          className={`p-2 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                            isSelected
                              ? opt.activeBorderClass
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <IconComp className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-xs font-bold truncate">{opt.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            {opt.description}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Teto Orçamentário Mensal (R$) - Opcional */}
              {newCatType === 'expense' && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Teto orçamentário mensal (R$)
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Opcional</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                        R$
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={newCatLimitStr}
                        onChange={(e) => setNewCatLimitStr(e.target.value)}
                        className="bg-white pl-8 text-xs font-bold tabular-nums h-9 rounded-xl"
                      />
                    </div>
                    <div className="h-9 px-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs font-semibold tabular-nums text-slate-700">
                      <span className="text-slate-400 text-[11px] font-normal">% renda:</span>
                      <span className="text-xs text-emerald-800">
                        {(() => {
                          const netIncome = family?.monthly_net_income_cents || 0
                          const cents = parseBRLToCents(newCatLimitStr)
                          if (!netIncome || cents <= 0) return '—'
                          const p = Math.round((cents / netIncome) * 1000) / 10
                          return `${p}% da renda`
                        })()}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {parseBRLToCents(newCatLimitStr) > 0
                      ? `Teto individual fixado em ${formatBRL(parseBRLToCents(newCatLimitStr))}.`
                      : 'Consumo livre do saldo do balde (sem teto individual). Esta categoria consumirá o saldo livre do balde orçamentário sem limite individual.'}
                  </p>
                </div>
              )}

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
                  className="bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] text-xs h-8 rounded-xl font-bold border-0"
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
                      <CategoryIconBox
                        icon={cat.icon}
                        color={cat.color}
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                        iconClassName="w-4 h-4"
                        strokeWidth={1.5}
                      />
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
                          {cat.type === 'expense' && cat.budget_bucket ? (
                            <span
                              className={`text-[9px] font-semibold px-2 py-0.5 rounded-md ${
                                cat.budget_bucket === 'essentials'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : cat.budget_bucket === 'lifestyle'
                                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              }`}
                            >
                              {cat.budget_bucket === 'essentials'
                                ? 'Essenciais'
                                : cat.budget_bucket === 'lifestyle'
                                  ? 'Estilo de Vida'
                                  : 'Futuro & Metas'}
                            </span>
                          ) : null}
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
                          className="h-8 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] text-xs rounded-xl px-3 shrink-0 font-bold border-0"
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

            {/* Categorias ocultas (catálogo v3 — onboarding inteligente): reativação
                com 1 toque. O app inteiro as esconde; só aqui elas aparecem. */}
            {hiddenCategories.length > 0 ? (
              <div className="pt-2">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider px-1 py-1">
                  Ocultas ({hiddenCategories.length})
                </p>
                <div className="space-y-1.5">
                  {hiddenCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 opacity-50"
                          style={{ backgroundColor: cat.color || '#64748B', color: '#fff' }}
                        >
                          <Tag className="w-3 h-3" />
                        </span>
                        <span className="text-xs font-semibold text-slate-500 truncate">
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">oculta</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={reactivatingId === cat.id}
                        onClick={async () => {
                          setReactivatingId(cat.id)
                          await reactivateCategory(cat.id, cat.name)
                          setReactivatingId(null)
                        }}
                        className="h-7 text-[11px] rounded-lg px-2 gap-1 shrink-0"
                      >
                        {reactivatingId === cat.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        <span>Reativar</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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

      {/* DIÁLOGO SELETOR DE MODO DE RESTAURAÇÃO */}
      <Dialog open={showRestoreMenu} onOpenChange={setShowRestoreMenu}>
        <DialogContent className="max-w-md rounded-3xl p-6 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-500" />
              <span>Restaurar Catálogo Padrão</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Escolha como deseja sincronizar o catálogo com as 19 categorias e 117 subcategorias
              oficiais do Curiangoo:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Opção 1: Restaurar o que falta (Aditivo) */}
            <div
              onClick={() => {
                setShowRestoreMenu(false)
                setShowAddMissingConfirm(true)
              }}
              className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-500/80 hover:bg-emerald-50/30 cursor-pointer transition-all space-y-1 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">
                  Modo 1: Restaurar o que falta
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Recomendado
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Adiciona apenas as categorias e subcategorias canônicas que a família não possui.
                Suas personalizações e transações continuam 100% intactas.
              </p>
            </div>

            {/* Opção 2: Redefinir tudo (Destrutivo / Confirmação Dupla) */}
            <div
              onClick={() => {
                setShowRestoreMenu(false)
                setShowResetWarningStep1(true)
              }}
              className="p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 hover:bg-rose-50/50 cursor-pointer transition-all space-y-1 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-rose-950">
                  Modo 2: Redefinir tudo ao padrão
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  Destrutivo
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Volta o catálogo 100% ao padrão canônico. Remove categorias customizadas remanejando
                antes as transações para não deixar nenhuma transação órfã.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRestoreMenu(false)}
              className="text-xs rounded-xl w-full"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODO 1: DIÁLOGO DE CONFIRMAÇÃO ADITIVA (1 CLIQUE) */}
      <AlertDialog open={showAddMissingConfirm} onOpenChange={setShowAddMissingConfirm}>
        <AlertDialogContent className="rounded-3xl max-w-md p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
              <span>Restaurar categorias que faltam?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed">
              O sistema irá comparar seu catálogo com o padrão canônico (19 categorias e 117
              subcategorias) e inserir apenas as gavetas que ainda não existem. Nada existente será
              alterado ou excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel disabled={isRestoring} className="text-xs rounded-xl">
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRestoring || !family?.id}
              onClick={async (e) => {
                e.preventDefault()
                if (!family?.id) return
                try {
                  setIsRestoring(true)
                  const res = await restoreMissingCatalog(
                    family.id,
                    categories,
                    categories.flatMap((c) => c.subcategories || []),
                  )
                  setShowAddMissingConfirm(false)
                  setRestoreSummary({
                    mode: 'missing',
                    categoriesAdded: res.categoriesAdded,
                    subcategoriesAdded: res.subcategoriesAdded,
                  })
                  triggerRefresh()
                } catch (err: any) {
                  toast({
                    title: 'Erro na restauração',
                    description: err?.message || 'Falha ao restaurar catálogo.',
                    variant: 'destructive',
                  })
                } finally {
                  setIsRestoring(false)
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
            >
              {isRestoring ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Restaurando...</span>
                </span>
              ) : (
                'Confirmar restauração'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODO 2 — PASSO 1: EXPLICAÇÃO DO QUE SERÁ PERDIDO */}
      <AlertDialog open={showResetWarningStep1} onOpenChange={setShowResetWarningStep1}>
        <AlertDialogContent className="rounded-3xl max-w-md p-6 border-rose-300">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-rose-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Passo 1/2: Redefinição Completa</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed space-y-2">
              <p>
                Esta ação é <strong>destrutiva</strong> para categorias e subcategorias customizadas
                criadas por você.
              </p>
              <p className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                🛡️ <strong>Proteção Zero Órfãos:</strong> Suas transações <strong>NUNCA</strong>{' '}
                serão apagadas. Antes de remover qualquer categoria customizada, as transações serão
                remanejadas com segurança para a categoria padrão equivalente mais próxima.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel className="text-xs rounded-xl">Cancelar</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                setShowResetWarningStep1(false)
                setShowResetConfirmStep2(true)
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl"
            >
              Prosseguir para confirmação final
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODO 2 — PASSO 2: CONFIRMAÇÃO EXPLÍCITA */}
      <AlertDialog open={showResetConfirmStep2} onOpenChange={setShowResetConfirmStep2}>
        <AlertDialogContent className="rounded-3xl max-w-md p-6 border-rose-500">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-rose-950 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Passo 2/2: Confirmar redefinição total?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-700 leading-relaxed">
              Você tem certeza absoluta de que deseja redefinir todo o catálogo para o padrão
              canônico oficial (19 categorias / 117 subcategorias)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel disabled={isRestoring} className="text-xs rounded-xl">
              Não, cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRestoring || !family?.id}
              onClick={async (e) => {
                e.preventDefault()
                if (!family?.id) return
                try {
                  setIsRestoring(true)
                  const res = await resetCatalogToDefault(
                    family.id,
                    categories,
                    categories.flatMap((c) => c.subcategories || []),
                  )
                  setShowResetConfirmStep2(false)
                  setRestoreSummary({
                    mode: 'reset',
                    categoriesAdded: res.categoriesAdded,
                    subcategoriesAdded: res.subcategoriesAdded,
                    reassignedCount: res.reassignedTransactionsCount || 0,
                  })
                  triggerRefresh()
                } catch (err: any) {
                  toast({
                    title: 'Erro na redefinição',
                    description: err?.message || 'Falha ao redefinir catálogo.',
                    variant: 'destructive',
                  })
                } finally {
                  setIsRestoring(false)
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl"
            >
              {isRestoring ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processando...</span>
                </span>
              ) : (
                'Sim, redefinir catálogo agora'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* RESUMO PÓS-OPERAÇÃO */}
      <Dialog open={Boolean(restoreSummary)} onOpenChange={() => setRestoreSummary(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-6 text-foreground">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-slate-900">
              {restoreSummary?.mode === 'missing'
                ? 'Catálogo Sincronizado!'
                : 'Catálogo Redefinido com Sucesso!'}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-600 pt-1">
              A estrutura canônica de categorias e subcategorias foi aplicada à sua família.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Categorias adicionadas:</span>
              <span className="font-bold text-slate-900">
                {restoreSummary?.categoriesAdded || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Subcategorias adicionadas:</span>
              <span className="font-bold text-slate-900">
                {restoreSummary?.subcategoriesAdded || 0}
              </span>
            </div>
            {restoreSummary?.mode === 'reset' && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-600">Transações remanejadas:</span>
                <span className="font-bold text-emerald-800">
                  {restoreSummary?.reassignedCount || 0} (zero órfãos)
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => setRestoreSummary(null)}
              className="w-full text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white"
            >
              Concluir
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
