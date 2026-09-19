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
import type { RecurringIncome, RecurringIncomeOverride } from '@/types/finance'
import {
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  Layers,
  RotateCcw,
  Loader2,
  User,
  CheckCircle2,
  Clock,
  Briefcase,
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

  // Estado para Criar/Editar Receita Fixa
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState<RecurringIncome | null>(null)
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
  const [incomeToDelete, setIncomeToDelete] = useState<RecurringIncome | null>(null)
  const [deleteCascadeTransactions, setDeleteCascadeTransactions] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Categorias de receita disponíveis
  const incomeCategories = categories.filter((c) => c.type === 'income')
  const selectedCatObj = categories.find((c) => c.id === categoryId)
  const availableSubcategories = selectedCatObj?.subcategories || []

  const openCreateForm = () => {
    setEditingIncome(null)
    setName('')
    setAmountStr('')
    setMemberId(members[0]?.id || '')
    const defaultIncomeCat = incomeCategories.find((c) => c.name.toLowerCase().includes('salário'))
    setCategoryId(defaultIncomeCat ? defaultIncomeCat.id : incomeCategories[0]?.id || 'none')
    setSubcategoryId('none')
    setDayOfMonth(5)
    setIsFormOpen(true)
  }

  const openEditForm = (item: RecurringIncome) => {
    setEditingIncome(item)
    setName(item.name)
    setAmountStr(formatNumberBRL(item.amount_cents))
    setMemberId(item.member_id)
    setCategoryId(item.category_id || 'none')
    setSubcategoryId(item.subcategory_id || 'none')
    setDayOfMonth(item.day_of_month)
    setIsFormOpen(true)
  }

  const handleSaveIncome = async (e: React.FormEvent) => {
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
        description: 'Informe uma descrição para a receita.',
        variant: 'destructive',
      })
      return
    }
    if (!memberId) {
      toast({
        title: 'Selecione o membro',
        description: 'Informe a qual familiar esta receita pertence.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      if (editingIncome) {
        await updateRecurringIncome(editingIncome.id, {
          name: name.trim(),
          amount_cents: cents,
          member_id: memberId,
          category_id: categoryId === 'none' ? null : categoryId,
          subcategory_id: subcategoryId === 'none' ? null : subcategoryId,
          day_of_month: dayOfMonth,
        })
        toast({
          title: 'Receita fixa atualizada',
          description: 'As alterações foram salvas com sucesso.',
        })
      } else {
        await createRecurringIncome({
          family_id: family.id,
          name: name.trim(),
          amount_cents: cents,
          member_id: memberId,
          category_id: categoryId === 'none' ? null : categoryId,
          subcategory_id: subcategoryId === 'none' ? null : subcategoryId,
          day_of_month: dayOfMonth,
        })
        toast({
          title: 'Receita fixa criada',
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
  const openOverrideDialog = (income: RecurringIncome) => {
    setSelectedForOverride(income)
    const existing = overrideMap.get(income.id)
    if (existing) {
      setOverrideAmountStr(formatNumberBRL(existing.amount_cents))
    } else {
      setOverrideAmountStr(formatNumberBRL(income.amount_cents))
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
        description: 'A receita deste mês segue o valor padrão recorrente.',
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
    if (!incomeToDelete) return
    try {
      setDeleting(true)
      await deleteRecurringIncome(incomeToDelete.id, deleteCascadeTransactions)
      toast({
        title: 'Receita fixa removida',
        description: deleteCascadeTransactions
          ? 'Receita fixa e todos os lançamentos gerados foram excluídos.'
          : 'Receita fixa removida. Os lançamentos anteriores foram mantidos no extrato.',
      })
      setIncomeToDelete(null)
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-3xl p-5 sm:p-7 max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <span>Receitas Fixas Recorrentes</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Salários e rendas fixas mensais são lançados automaticamente todo mês no dia
                  definido, garantindo previsibilidade orçamentária.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Barra de Ações: Mês atual em destaque e botão de criação */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium bg-emerald-50/70 border border-emerald-200/60 px-3 py-1.5 rounded-xl self-start">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>
                Mês de referência: <strong>{formatMonthYear(currentMonthDate)}</strong>
              </span>
            </div>

            <Button
              type="button"
              onClick={openCreateForm}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl gap-1.5 h-8 font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Receita Fixa</span>
            </Button>
          </div>

          {/* Formulário Retrátil: Adicionar / Editar Receita Fixa */}
          {isFormOpen ? (
            <form
              onSubmit={handleSaveIncome}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 animate-in fade-in-50"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  <span>{editingIncome ? 'Editar Receita Fixa' : 'Cadastrar Receita Fixa'}</span>
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold uppercase">
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
                    placeholder="Ex.: Salário Empresa, Pró-labore, Aluguel Recebido"
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
                  <Label className="text-xs font-semibold text-slate-700">Membro da Família</Label>
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
                  <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
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
                      {incomeCategories.map((c) => (
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 rounded-xl font-semibold"
                >
                  <span className="flex items-center gap-1.5">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{editingIncome ? 'Salvar Alterações' : 'Criar Receita Fixa'}</span>
                  </span>
                </Button>
              </div>
            </form>
          ) : null}

          {/* Lista de Receitas Fixas Cadastradas */}
          <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-2.5">
            {recurringIncomes.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-800 text-sm">
                  <span>Nenhuma receita fixa cadastrada</span>
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-3">
                  <span>
                    Cadastre os salários ou receitas recorrentes de cada membro da família. Elas
                    serão lançadas automaticamente e comporão a previsão financeira mensal.
                  </span>
                </p>
                <Button
                  type="button"
                  onClick={openCreateForm}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Cadastrar primeira receita fixa</span>
                </Button>
              </div>
            ) : null}

            {recurringIncomes.map((income) => {
              const override = overrideMap.get(income.id)
              const hasOverride = Boolean(override)
              const effectiveAmount = hasOverride ? override!.amount_cents : income.amount_cents

              return (
                <div
                  key={income.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-3.5 space-y-2 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
                        <Briefcase className="w-5 h-5" />
                      </div>

                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 truncate">
                            {income.name}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100/80 text-emerald-800 border border-emerald-200/80 px-2 py-0.2 rounded-full">
                            <Clock className="w-3 h-3" />
                            <span>Dia {income.day_of_month}</span>
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
                            <span>{income.member?.name || 'Membro'}</span>
                          </span>
                          {income.category ? (
                            <span className="text-[11px] text-slate-400">
                              <span>· {income.category.name}</span>
                              {income.subcategory ? (
                                <span className="text-emerald-700 font-medium ml-1">
                                  ({income.subcategory.name})
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-base text-emerald-700 tabular-nums block">
                        <span>{formatBRL(effectiveAmount)}</span>
                      </span>
                      {hasOverride ? (
                        <span className="text-[10px] text-slate-400 line-through tabular-nums">
                          <span>padrão {formatBRL(income.amount_cents)}</span>
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
                      onClick={() => openOverrideDialog(income)}
                      className="font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {hasOverride ? 'Editar ajuste deste mês' : 'Ajustar só neste mês'}
                      </span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(income)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar cadastro da receita fixa"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIncomeToDelete(income)
                          setDeleteCascadeTransactions(false)
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir receita fixa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
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

      {/* DIÁLOGO AJUSTE PONTUAL DESTE MÊS (EXCEÇÃO) */}
      <Dialog open={isOverrideDialogOpen} onOpenChange={setIsOverrideDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Ajuste Exclusivo de {formatMonthYear(currentMonthDate)}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Altere o valor desta receita somente neste mês (ex.: bônus, 13º salário ou férias). Os
              demais meses permanecem com o valor recorrente padrão.
            </DialogDescription>
          </DialogHeader>

          {selectedForOverride ? (
            <form onSubmit={handleSaveOverride} className="space-y-4 pt-2">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Receita Fixa
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

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE RECEITA FIXA */}
      <AlertDialog
        open={Boolean(incomeToDelete)}
        onOpenChange={(openState) => !openState && setIncomeToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              <span>Excluir receita fixa?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-3">
              <p>
                <span>Deseja remover o agendamento recorrente de </span>
                <strong className="text-slate-900">{incomeToDelete?.name}</strong>?
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
                    Excluir também todos os lançamentos automáticos já gerados no histórico por esta
                    receita fixa
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
