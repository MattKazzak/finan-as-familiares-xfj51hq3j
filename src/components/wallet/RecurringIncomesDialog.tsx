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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { formatBRL, parseBRLToCents, formatNumberBRL, formatMonthYear } from '@/lib/formatters'
import {
  createRecurringIncome,
  updateRecurringIncome,
  deleteRecurringIncome,
  upsertRecurringIncomeOverride,
  resetRecurringIncomeToDefault,
} from '@/services/recurring-incomes'
import type { RecurringIncome, RecurringIncomeOverride, TransactionType } from '@/types/finance'
import {
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  RotateCcw,
  Loader2,
  User,
  Clock,
  Briefcase,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  Layers,
} from 'lucide-react'

interface RecurringIncomesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentMonthDate: Date
  recurringIncomes: RecurringIncome[]
  recurringOverrides: RecurringIncomeOverride[]
  onSuccess: () => void
}

export const RecurringIncomesDialog: React.FC<RecurringIncomesDialogProps> = ({
  open,
  onOpenChange,
  currentMonthDate,
  recurringIncomes,
  recurringOverrides,
  onSuccess,
}) => {
  const { family, members, categories } = useFamily()
  const { toast } = useToast()

  const currentMonthStr = currentMonthDate.toISOString().slice(0, 7)

  // Mapeamento de overrides deste mês
  const overrideMap = new Map<string, RecurringIncomeOverride>()
  recurringOverrides.forEach((o) => overrideMap.set(o.recurring_income_id, o))

  // Aba ativa: 'income' (Receitas Fixas) ou 'expense' (Despesas Fixas)
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income')

  // Estado para Criar/Editar Recorrência Fixa
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<RecurringIncome | null>(null)
  const [formType, setFormType] = useState<TransactionType>('income')
  const [name, setName] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [memberId, setMemberId] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [subcategoryId, setSubcategoryId] = useState<string>('none')
  const [dayOfMonth, setDayOfMonth] = useState<number>(5)
  const [saving, setSaving] = useState(false)

  // Estado para Exceção Pontual do Mês Selecionado
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false)
  const [selectedForOverride, setSelectedForOverride] = useState<RecurringIncome | null>(null)
  const [overrideAmountStr, setOverrideAmountStr] = useState('')
  const [savingOverride, setSavingOverride] = useState(false)

  // Estado para Confirmação de Exclusão
  const [itemToDelete, setItemToDelete] = useState<RecurringIncome | null>(null)
  const [deleteCascadeTransactions, setDeleteCascadeTransactions] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Categorias disponíveis de acordo com o formType
  const relevantCategories = categories.filter((c) => c.type === formType)
  const selectedCatObj = categories.find((c) => c.id === categoryId)
  const availableSubcategories = selectedCatObj?.subcategories || []

  // Itens separados por type ('income' ou 'expense'; legado sem type assume 'income')
  const incomeItems = recurringIncomes.filter((item) => (item.type || 'income') === 'income')
  const expenseItems = recurringIncomes.filter((item) => item.type === 'expense')

  const openCreateForm = (targetType: TransactionType = activeTab) => {
    setEditingItem(null)
    setFormType(targetType)
    setName('')
    setAmountStr('')
    setMemberId(members[0]?.id || '')

    const typeCats = categories.filter((c) => c.type === targetType)
    if (targetType === 'income') {
      const defaultIncomeCat = typeCats.find((c) => c.name.toLowerCase().includes('salário'))
      setCategoryId(defaultIncomeCat ? defaultIncomeCat.id : typeCats[0]?.id || 'none')
    } else {
      const defaultExpenseCat = typeCats.find(
        (c) =>
          c.name.toLowerCase().includes('moradia') ||
          c.name.toLowerCase().includes('casa') ||
          c.name.toLowerCase().includes('contas'),
      )
      setCategoryId(defaultExpenseCat ? defaultExpenseCat.id : typeCats[0]?.id || 'none')
    }

    setSubcategoryId('none')
    setDayOfMonth(5)
    setIsFormOpen(true)
  }

  const openEditForm = (item: RecurringIncome) => {
    setEditingItem(item)
    const itemType = (item.type || 'income') as TransactionType
    setFormType(itemType)
    setName(item.name)
    setAmountStr(formatNumberBRL(item.amount_cents))
    setMemberId(item.member_id)
    setCategoryId(item.category_id || 'none')
    setSubcategoryId(item.subcategory_id || 'none')
    setDayOfMonth(item.day_of_month)
    setIsFormOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family) return
    const cents = parseBRLToCents(amountStr)
    if (cents <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor maior que zero.',
        variant: 'destructive',
      })
      return
    }
    if (!name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: `Informe uma descrição para a ${formType === 'income' ? 'receita' : 'despesa'}.`,
        variant: 'destructive',
      })
      return
    }
    if (!memberId) {
      toast({
        title: 'Selecione o membro',
        description: 'Informe a qual familiar este lançamento pertence.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      if (editingItem) {
        await updateRecurringIncome(editingItem.id, {
          name: name.trim(),
          type: formType,
          amount_cents: cents,
          member_id: memberId,
          category_id: categoryId === 'none' ? null : categoryId,
          subcategory_id: subcategoryId === 'none' ? null : subcategoryId,
          day_of_month: dayOfMonth,
        })
        toast({
          title: formType === 'income' ? 'Receita fixa atualizada' : 'Despesa fixa atualizada',
          description: 'As alterações foram salvas com sucesso.',
        })
      } else {
        await createRecurringIncome({
          family_id: family.id,
          name: name.trim(),
          type: formType,
          amount_cents: cents,
          member_id: memberId,
          category_id: categoryId === 'none' ? null : categoryId,
          subcategory_id: subcategoryId === 'none' ? null : subcategoryId,
          day_of_month: dayOfMonth,
        })
        toast({
          title: formType === 'income' ? 'Receita fixa criada' : 'Despesa fixa criada',
          description: 'Será gerada automaticamente todo mês no dia configurado.',
        })
      }
      setIsFormOpen(false)
      onSuccess()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Abrir diálogo de ajuste pontual deste mês
  const openOverrideDialog = (item: RecurringIncome) => {
    setSelectedForOverride(item)
    const existing = overrideMap.get(item.id)
    if (existing) {
      setOverrideAmountStr(formatNumberBRL(existing.amount_cents))
    } else {
      setOverrideAmountStr(formatNumberBRL(item.amount_cents))
    }
    setIsOverrideDialogOpen(true)
  }

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family || !selectedForOverride) return
    const cents = parseBRLToCents(overrideAmountStr)

    try {
      setSavingOverride(true)
      await upsertRecurringIncomeOverride(family.id, selectedForOverride.id, currentMonthStr, cents)
      toast({
        title: 'Ajuste pontual salvo',
        description: `Valor de ${formatMonthYear(currentMonthDate)} ajustado com sucesso.`,
      })
      setIsOverrideDialogOpen(false)
      onSuccess()
    } catch {
      toast({
        title: 'Erro ao salvar ajuste',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingOverride(false)
    }
  }

  const handleResetOverride = async () => {
    if (!selectedForOverride) return
    try {
      setSavingOverride(true)
      await resetRecurringIncomeToDefault(selectedForOverride.id, currentMonthStr)
      toast({
        title: 'Voltou ao padrão',
        description: 'O valor deste mês voltou a seguir o padrão recorrente.',
      })
      setIsOverrideDialogOpen(false)
      onSuccess()
    } catch {
      toast({
        title: 'Erro ao reverter',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingOverride(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return
    const isIncome = (itemToDelete.type || 'income') === 'income'
    try {
      setDeleting(true)
      await deleteRecurringIncome(itemToDelete.id, deleteCascadeTransactions)
      toast({
        title: isIncome ? 'Receita fixa removida' : 'Despesa fixa removida',
        description: deleteCascadeTransactions
          ? 'Item fixo e todos os lançamentos gerados foram excluídos.'
          : 'Item fixo removido. Os lançamentos anteriores foram mantidos no extrato.',
      })
      setItemToDelete(null)
      onSuccess()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Renderizador da lista de itens
  const renderItemList = (items: RecurringIncome[], type: TransactionType) => {
    const isIncome = type === 'income'

    if (items.length === 0) {
      return (
        <div className="text-center py-10 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          {isIncome ? (
            <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          ) : (
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          )}
          <p className="font-bold text-slate-800 text-sm">
            {isIncome ? 'Nenhuma receita fixa cadastrada' : 'Nenhuma despesa fixa cadastrada'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-3">
            {isIncome
              ? 'Cadastre salários, pró-labore ou rendas mensais da família. Serão lançadas automaticamente e comporão a previsão orçamentária.'
              : 'Cadastre aluguel, condomínio, internet ou assinaturas mensais. Serão lançadas automaticamente no dia definido com selo "Previsto".'}
          </p>
          <Button
            type="button"
            onClick={() => openCreateForm(type)}
            size="sm"
            className={`${
              isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            } text-white text-xs rounded-xl shadow-xs`}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>
              {isIncome ? 'Cadastrar primeira receita fixa' : 'Cadastrar primeira despesa fixa'}
            </span>
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-2.5">
        {items.map((item) => {
          const override = overrideMap.get(item.id)
          const hasOverride = Boolean(override)
          const effectiveAmount = hasOverride ? override!.amount_cents : item.amount_cents

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-3.5 space-y-2 shadow-2xs hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs ${
                      isIncome
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-rose-50 text-rose-700 border-rose-100'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
                    )}
                  </div>

                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 truncate">{item.name}</span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold border px-2 py-0.2 rounded-full ${
                          isIncome
                            ? 'bg-emerald-100/80 text-emerald-800 border-emerald-200/80'
                            : 'bg-rose-100/80 text-rose-800 border-rose-200/80'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>Dia {item.day_of_month}</span>
                      </span>
                      {hasOverride ? (
                        <span className="text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.2 rounded-full">
                          <span>ajustado em {formatMonthYear(currentMonthDate)}</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-medium text-slate-600">
                        <User className="w-3 h-3" />
                        <span>{item.member?.name || 'Membro'}</span>
                      </span>
                      {item.category ? (
                        <span className="text-[11px] text-slate-400">
                          <span>· {item.category.name}</span>
                          {item.subcategory ? (
                            <span
                              className={`font-medium ml-1 ${
                                isIncome ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              ({item.subcategory.name})
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`font-bold text-base tabular-nums block ${
                      isIncome ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    <span>
                      {isIncome ? '+' : '−'} {formatBRL(effectiveAmount)}
                    </span>
                  </span>
                  {hasOverride ? (
                    <span className="text-[10px] text-slate-400 line-through tabular-nums">
                      <span>padrão {formatBRL(item.amount_cents)}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">recorrente mensal</span>
                  )}
                </div>
              </div>

              {/* Botões de Ação na Linha: Ajuste Pontual, Editar Padrão, Excluir */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => openOverrideDialog(item)}
                  className={`font-semibold px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                    isIncome
                      ? 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50'
                      : 'text-rose-700 hover:text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{hasOverride ? 'Editar ajuste deste mês' : 'Ajustar só neste mês'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditForm(item)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title={`Editar ${isIncome ? 'receita fixa' : 'despesa fixa'}`}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItemToDelete(item)
                      setDeleteCascadeTransactions(false)
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title={`Excluir ${isIncome ? 'receita fixa' : 'despesa fixa'}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-3xl p-5 sm:p-7 max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <span>Contas & Rendas Recorrentes</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Salários, aluguel e contas fixas mensais são lançados automaticamente todo mês no
                  dia definido, gerando projeções no calendário orçamentário.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Abas: Receitas Fixas e Despesas Fixas */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val as 'income' | 'expense')
              if (isFormOpen) {
                setFormType(val as TransactionType)
                // Atualizar categoria padrão se for relevante
                const typeCats = categories.filter((c) => c.type === val)
                setCategoryId(typeCats[0]?.id || 'none')
                setSubcategoryId('none')
              }
            }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Barra de Ações: Abas + Mês de referência + Botão Novo */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-b border-slate-100 pb-3">
              <TabsList className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl h-10 w-full sm:w-72">
                <TabsTrigger
                  value="income"
                  className="rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-xs flex items-center gap-1.5"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Receitas Fixas ({incomeItems.length})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="expense"
                  className="rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-rose-700 data-[state=active]:shadow-xs flex items-center gap-1.5"
                >
                  <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Despesas Fixas ({expenseItems.length})</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center justify-between sm:justify-end gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-50 border border-slate-200/60 px-2.5 py-1.5 rounded-xl">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px]">
                    <strong>{formatMonthYear(currentMonthDate)}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Formulário Retrátil: Adicionar / Editar */}
            {isFormOpen ? (
              <form
                onSubmit={handleSave}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 animate-in fade-in-50 my-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    {formType === 'income' ? (
                      <ArrowUpRight className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-rose-600 stroke-[2.5]" />
                    )}
                    <span>
                      {editingItem
                        ? `Editar ${formType === 'income' ? 'Receita Fixa' : 'Despesa Fixa'}`
                        : `Cadastrar ${formType === 'income' ? 'Receita Fixa' : 'Despesa Fixa'}`}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase ${
                      formType === 'income' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    Lançamento Automático
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <Label htmlFor="rf-name" className="text-xs font-semibold text-slate-700">
                      Descrição / Nome
                    </Label>
                    <Input
                      id="rf-name"
                      type="text"
                      placeholder={
                        formType === 'income'
                          ? 'Ex.: Salário Empresa, Pró-labore, Aluguel Recebido'
                          : 'Ex.: Aluguel, Condomínio, Internet, Academia'
                      }
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-white text-xs h-9 mt-1"
                      autoFocus
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="rf-amount" className="text-xs font-semibold text-slate-700">
                      Valor Mensal (R$)
                    </Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                        R$
                      </span>
                      <Input
                        id="rf-amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        className="pl-9 bg-white text-sm font-bold tabular-nums h-9"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Membro da Família
                    </Label>
                    <Select value={memberId} onValueChange={setMemberId}>
                      <SelectTrigger className="bg-white text-xs h-9 mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <span>{m.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Categoria ({formType === 'income' ? 'Receita' : 'Despesa'})
                    </Label>
                    <Select
                      value={categoryId}
                      onValueChange={(v) => {
                        setCategoryId(v)
                        setSubcategoryId('none')
                      }}
                    >
                      <SelectTrigger className="bg-white text-xs h-9 mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span>Sem categoria</span>
                        </SelectItem>
                        {relevantCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span>{c.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="rf-day" className="text-xs font-semibold text-slate-700">
                      Dia do Lançamento
                    </Label>
                    <Input
                      id="rf-day"
                      type="number"
                      min={1}
                      max={31}
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10) || 1)}
                      className="bg-white text-xs h-9 mt-1"
                      required
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Dia 1 a 31 (ou último dia do mês)
                    </span>
                  </div>
                </div>

                {/* Subcategoria se houver */}
                {categoryId !== 'none' && availableSubcategories.length > 0 ? (
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Subcategoria (Opcional)
                    </Label>
                    <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                      <SelectTrigger className="bg-white text-xs h-9 mt-1">
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span>Nenhuma</span>
                        </SelectItem>
                        {availableSubcategories.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span>{s.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFormOpen(false)}
                    className="text-xs h-8 rounded-xl"
                  >
                    <span>Cancelar</span>
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving || !name.trim()}
                    size="sm"
                    className={`${
                      formType === 'income'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    } text-white text-xs h-8 rounded-xl font-semibold`}
                  >
                    <span className="flex items-center gap-1.5">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>
                        {editingItem
                          ? 'Salvar Alterações'
                          : formType === 'income'
                            ? 'Criar Receita Fixa'
                            : 'Criar Despesa Fixa'}
                      </span>
                    </span>
                  </Button>
                </div>
              </form>
            ) : null}

            {/* Conteúdo das Abas com rolagem */}
            <TabsContent value="income" className="flex-1 overflow-y-auto pr-1 py-2 mt-0">
              {renderItemList(incomeItems, 'income')}
            </TabsContent>

            <TabsContent value="expense" className="flex-1 overflow-y-auto pr-1 py-2 mt-0">
              {renderItemList(expenseItems, 'expense')}
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl w-full sm:w-auto"
            >
              <span>Fechar</span>
            </Button>
            <Button
              type="button"
              onClick={() => openCreateForm(activeTab)}
              size="sm"
              className={`${
                activeTab === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              } text-white text-xs rounded-xl gap-1.5 h-9 sm:h-8 font-semibold shadow-xs w-full sm:w-auto`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{activeTab === 'income' ? 'Nova Receita Fixa' : 'Nova Despesa Fixa'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO AJUSTE PONTUAL DESTE MÊS (EXCEÇÃO) */}
      <Dialog open={isOverrideDialogOpen} onOpenChange={setIsOverrideDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Ajuste Exclusivo de {formatMonthYear(currentMonthDate)}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Altere o valor deste item somente neste mês (ex.: bônus, 13º salário, férias ou fatura
              extraordinária). Os demais meses permanecem com o valor recorrente padrão.
            </DialogDescription>
          </DialogHeader>

          {selectedForOverride ? (
            <form onSubmit={handleSaveOverride} className="space-y-4 pt-2">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {(selectedForOverride.type || 'income') === 'income'
                    ? 'Receita Fixa'
                    : 'Despesa Fixa'}
                </span>
                <p className="font-bold text-slate-800 text-sm">{selectedForOverride.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span>Valor padrão contínuo: </span>
                  <strong className="text-slate-700">
                    {formatBRL(selectedForOverride.amount_cents)}
                  </strong>
                </p>
              </div>

              <div>
                <Label htmlFor="rf-override-amt" className="text-xs font-semibold text-slate-700">
                  Valor Específico para {formatMonthYear(currentMonthDate)} (R$)
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    R$
                  </span>
                  <Input
                    id="rf-override-amt"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={overrideAmountStr}
                    onChange={(e) => setOverrideAmountStr(e.target.value)}
                    className="pl-9 bg-white text-base font-bold tabular-nums"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                {overrideMap.has(selectedForOverride.id) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetOverride}
                    disabled={savingOverride}
                    className="text-xs text-slate-600 hover:text-slate-900 gap-1.5 h-8 rounded-xl"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Voltar ao padrão</span>
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOverrideDialogOpen(false)}
                    disabled={savingOverride}
                    className="text-xs h-8 rounded-xl"
                  >
                    <span>Cancelar</span>
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingOverride}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 rounded-xl font-semibold"
                  >
                    <span className="flex items-center gap-1.5">
                      {savingOverride ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>Salvar Ajuste</span>
                    </span>
                  </Button>
                </div>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog
        open={Boolean(itemToDelete)}
        onOpenChange={(openState) => !openState && setItemToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              <span>
                Excluir{' '}
                {(itemToDelete?.type || 'income') === 'income' ? 'receita fixa' : 'despesa fixa'}?
              </span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-3">
              <p>
                <span>Deseja remover o agendamento recorrente de </span>
                <strong className="text-slate-900">{itemToDelete?.name}</strong>?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={deleteCascadeTransactions}
                    onChange={(e) => setDeleteCascadeTransactions(e.target.checked)}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500 mt-0.5"
                  />
                  <span>
                    Excluir também todos os lançamentos automáticos já gerados no histórico por este
                    item fixo
                  </span>
                </label>
                <p className="text-[11px] text-slate-400 pl-5">
                  Se desmarcado, as transações passadas continuarão salvas no extrato como
                  transações normais.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="text-xs rounded-xl" disabled={deleting}>
              <span>Cancelar</span>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl"
            >
              <span>{deleting ? 'Excluindo...' : 'Confirmar exclusão'}</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
