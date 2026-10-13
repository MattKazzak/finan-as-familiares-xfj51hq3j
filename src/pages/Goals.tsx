import { useState, useEffect, useMemo, useCallback } from 'react'
import { useFamily } from '@/hooks/use-family'
import { fetchGoals, createGoal, updateGoal, deleteGoal } from '@/services/goals-investments'
import { fetchTransactions } from '@/services/transactions'
import { formatBRL, formatDeadline, parseBRLToCents, formatNumberBRL } from '@/lib/formatters'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { useToast } from '@/hooks/use-toast'
import type { Goal } from '@/types/finance'
import { Plus, Target, Calendar, Sparkles, Trash2, Edit3, Loader2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { differenceInMonths, parseISO, isAfter } from 'date-fns'

export default function GoalsPage() {
  const { family, categories, refreshTrigger, triggerRefresh } = useFamily()
  const { toast } = useToast()

  const [goals, setGoals] = useState<Goal[]>([])
  const [goalSavedMap, setGoalSavedMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Diálogo criar/editar
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [goalName, setGoalName] = useState('')
  const [goalCategoryId, setGoalCategoryId] = useState('none')
  const [goalTargetStr, setGoalTargetStr] = useState('')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Confirmação exclusão
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null)

  const loadData = useCallback(async () => {
    if (!family) return
    try {
      setLoading(true)
      const [allGoals, allTxs] = await Promise.all([
        fetchGoals(family.id),
        fetchTransactions({ familyId: family.id }),
      ])

      // Soma de valores guardados vinculados à categoria da meta
      const savedMap: Record<string, number> = {}
      allGoals.forEach((goal) => {
        if (!goal.category_id) {
          savedMap[goal.id] = 0
          return
        }
        // Soma das receitas vinculadas a essa categoria (ou saldo líquido)
        let sum = 0
        allTxs.forEach((tx) => {
          if (tx.category_id === goal.category_id) {
            if (tx.type === 'income') sum += tx.amount_cents
          }
        })
        savedMap[goal.id] = sum
      })

      setGoals(allGoals)
      setGoalSavedMap(savedMap)
    } catch (err: any) {
      console.error('Erro ao carregar metas:', err)
      toast({
        title: 'Não foi possível carregar as metas',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [family, toast])

  useEffect(() => {
    loadData()
  }, [loadData, refreshTrigger])

  const openCreateDialog = () => {
    setEditingGoal(null)
    setGoalName('')
    setGoalCategoryId('none')
    setGoalTargetStr('')
    // Default prazo daqui a 6 meses
    const defaultDate = new Date()
    defaultDate.setMonth(defaultDate.getMonth() + 6)
    setGoalDeadline(defaultDate.toISOString().slice(0, 10))
    setValidationError(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (goal: Goal) => {
    setEditingGoal(goal)
    setGoalName(goal.name)
    setGoalCategoryId(goal.category_id || 'none')
    setGoalTargetStr(formatNumberBRL(goal.target_amount_cents))
    setGoalDeadline(goal.deadline)
    setValidationError(null)
    setIsDialogOpen(true)
  }

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family) return
    setValidationError(null)

    if (!goalName.trim()) {
      setValidationError('Informe o nome da meta.')
      return
    }

    const targetCents = parseBRLToCents(goalTargetStr)
    if (targetCents <= 0) {
      setValidationError('Informe um valor válido maior que zero.')
      return
    }

    if (!goalDeadline) {
      setValidationError('Informe o prazo da meta.')
      return
    }

    const deadlineDate = parseISO(goalDeadline)
    if (!isAfter(deadlineDate, new Date())) {
      setValidationError('Prazo deve ser no futuro.')
      return
    }

    try {
      setSaving(true)
      if (editingGoal) {
        await updateGoal(editingGoal.id, {
          name: goalName.trim(),
          category_id: goalCategoryId === 'none' ? null : goalCategoryId,
          target_amount_cents: targetCents,
          deadline: goalDeadline,
        })
        toast({ title: 'Sucesso', description: 'Meta atualizada!' })
      } else {
        await createGoal({
          family_id: family.id,
          name: goalName.trim(),
          category_id: goalCategoryId === 'none' ? null : goalCategoryId,
          target_amount_cents: targetCents,
          deadline: goalDeadline,
        })
        toast({ title: 'Sucesso', description: 'Meta criada com sucesso!' })
      }

      setIsDialogOpen(false)
      loadData()
      triggerRefresh()
    } catch {
      setValidationError('Erro ao salvar meta. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGoal = async () => {
    if (!goalToDelete) return
    try {
      await deleteGoal(goalToDelete.id)
      setGoals((prev) => prev.filter((g) => g.id !== goalToDelete.id))
      toast({ title: 'Meta excluída', description: 'O planejamento foi atualizado.' })
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao excluir meta',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setGoalToDelete(null)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto min-w-0">
      {/* Header com respiro */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Metas Financeiras
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Planejamento familiar para objetivos de curto, médio e longo prazo
          </p>
        </div>

        {goals.length > 0 && (
          <Button
            onClick={openCreateDialog}
            className="bg-brand-amber hover:bg-[#e08e08] text-brand font-bold text-xs rounded-xl shadow-elevation-1 gap-1.5 border-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova meta</span>
          </Button>
        )}
      </div>

      {/* Lista de Metas */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Carregando metas...</div>
      ) : goals.length === 0 ? (
        /* Empty State */
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-12 text-center border border-[rgba(20,33,61,0.06)] shadow-elevation-1">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-[#14213D] flex items-center justify-center mx-auto mb-3 shadow-2xs border border-[rgba(20,33,61,0.04)]">
            <Target className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Nenhuma meta definida</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto mb-5">
            Defina sonhos como viagem de férias, troca de carro ou reserva de emergência.
          </p>
          <Button
            onClick={openCreateDialog}
            className="bg-brand-amber hover:bg-[#e08e08] text-brand text-xs font-bold rounded-xl border-0 shadow-elevation-1"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Criar primeira meta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {goals.map((goal) => {
            const savedCents = goalSavedMap[goal.id] || 0
            const percent = Math.min(Math.round((savedCents / goal.target_amount_cents) * 100), 100)

            // Cálculo da sugestão mensal
            let monthsLeft = 1
            try {
              monthsLeft = Math.max(differenceInMonths(parseISO(goal.deadline), new Date()), 1)
            } catch {
              monthsLeft = 1
            }
            const remainingCents = Math.max(goal.target_amount_cents - savedCents, 0)
            const suggestionCents = Math.round(remainingCents / monthsLeft)

            return (
              <div
                key={goal.id}
                className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 sm:p-6 border border-[rgba(20,33,61,0.06)] shadow-elevation-1 hover:shadow-elevation-2 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
                        <CategoryIcon
                          name={goal.category?.icon || 'Target'}
                          className="w-4 h-4 text-[#10B981]"
                          strokeWidth={1.5}
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm sm:text-base text-[#14213D] leading-tight">
                          {goal.name}
                        </h4>
                        {goal.deadline && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Calendar className="w-3 h-3 text-muted-foreground" strokeWidth={1.5} />
                            <span>Até {formatDeadline(goal.deadline)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditDialog(goal)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setGoalToDelete(goal)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Informações Financeiras da Meta */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-slate-500 font-medium">Meta Total:</span>
                      <span className="font-semibold tracking-tight text-[#14213D] tabular-nums">
                        {formatBRL(goal.target_amount_cents)}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-slate-500 font-medium">Valor Guardado:</span>
                      <span className="font-bold text-emerald-700 tabular-nums">
                        {formatBRL(savedCents)} ({percent}%)
                      </span>
                    </div>
                  </div>

                  {/* Anel / Barra de Progresso CDS com gradiente orgânico */}
                  <div className="w-full bg-slate-100/90 h-2.5 rounded-full overflow-hidden mb-4 shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-[#10B981] to-[#34d399]"
                      style={{
                        width: `${percent}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Prazo e Sugestão de Contribuição Mensal */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Prazo:
                    </span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {formatDeadline(goal.deadline)}
                    </span>
                  </div>

                  {percent < 100 && (
                    <div className="flex items-center gap-2 p-2.5 bg-emerald-50/60 rounded-xl text-xs text-emerald-900">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-medium">
                        Guarde{' '}
                        <strong className="font-bold">{formatBRL(suggestionCents)}/mês</strong> para
                        alcançar.
                      </span>
                    </div>
                  )}

                  {percent >= 100 && (
                    <div className="flex items-center gap-2 p-2.5 bg-emerald-100 rounded-xl text-xs text-emerald-900 font-bold">
                      <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Parabéns! Meta 100% atingida 🎉</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* DIÁLOGO CRIAR / EDITAR META */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingGoal ? 'Editar Meta Financeira' : 'Nova Meta Financeira'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveGoal} className="space-y-4">
            {validationError && (
              <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl">
                {validationError}
              </div>
            )}

            {/* Nome */}
            <div>
              <Label htmlFor="goal-name" className="text-xs font-semibold text-slate-700">
                Nome da Meta
              </Label>
              <Input
                id="goal-name"
                type="text"
                placeholder="Ex.: Viagem de férias, Troca de carro"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            {/* Categoria */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Categoria Vinculada</Label>
              <Select value={goalCategoryId} onValueChange={setGoalCategoryId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma categoria vinculada</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.type === 'income' ? 'Receita' : 'Despesa'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor da Meta */}
            <div>
              <Label htmlFor="goal-amount" className="text-xs font-semibold text-slate-700">
                Valor da Meta (R$)
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                  R$
                </span>
                <Input
                  id="goal-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={goalTargetStr}
                  onChange={(e) => setGoalTargetStr(e.target.value)}
                  className="pl-10 text-base font-bold tabular-nums"
                  required
                />
              </div>
            </div>

            {/* Prazo */}
            <div>
              <Label htmlFor="goal-deadline" className="text-xs font-semibold text-slate-700">
                Prazo Estimado
              </Label>
              <Input
                id="goal-deadline"
                type="date"
                value={goalDeadline}
                onChange={(e) => setGoalDeadline(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-brand-amber hover:bg-[#e08e08] text-brand font-bold border-0"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingGoal ? 'Salvar Alterações' : 'Criar Meta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE META */}
      <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Excluir meta financeira?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              O objetivo será excluído permanentemente do painel da família.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGoal}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              Excluir Meta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
