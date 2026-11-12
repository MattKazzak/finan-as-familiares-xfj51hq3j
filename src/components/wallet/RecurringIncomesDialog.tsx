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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatBRL, parseBRLToCents, formatNumberBRL, formatMonthYear } from '@/lib/formatters'
import {
  updateRecurringIncome,
  deleteRecurringIncome,
  upsertRecurringIncomeOverride,
  resetRecurringIncomeToDefault,
} from '@/services/recurring-incomes'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import type { RecurringIncome, RecurringIncomeOverride, TransactionType } from '@/types/finance'
import {
  Sparkles,
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
  Play,
  Pause,
  MoreVertical,
} from 'lucide-react'

export interface RecurringIncomesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentMonthDate: Date
  recurringIncomes: RecurringIncome[]
  recurringOverrides: RecurringIncomeOverride[]
  onSuccess: () => void
  /**
   * Callback opcional caso o chamador queira abrir o NewTransactionDialog diretamente.
   * Se não for fornecido, o RecurringIncomesDialog abre internamente o NewTransactionDialog
   * em modo de edição da regra.
   */
  onEditRecurringRule?: (rule: RecurringIncome) => void
}

export const RecurringIncomesDialog: React.FC<RecurringIncomesDialogProps> = ({
  open,
  onOpenChange,
  currentMonthDate,
  recurringIncomes,
  recurringOverrides,
  onSuccess,
  onEditRecurringRule,
}) => {
  const isMobile = useIsMobile()
  const { family } = useFamily()
  const { toast } = useToast()

  const currentMonthStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`

  // Mapeamento de overrides deste mês
  const overrideMap = new Map<string, RecurringIncomeOverride>()
  recurringOverrides.forEach((o) => overrideMap.set(o.recurring_income_id, o))

  // Aba ativa: 'all' (Todas), 'income' (Receitas), 'expense' (Despesas)
  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'income'>('all')

  // Estado para regra sendo editada no modal unificado interno (se não fornecido callback externo)
  const [editingRule, setEditingRule] = useState<RecurringIncome | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Estado para Exceção Pontual do Mês Selecionado
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false)
  const [selectedForOverride, setSelectedForOverride] = useState<RecurringIncome | null>(null)
  const [overrideAmountStr, setOverrideAmountStr] = useState('')
  const [savingOverride, setSavingOverride] = useState(false)

  // Estado para Confirmação de Exclusão
  const [itemToDelete, setItemToDelete] = useState<RecurringIncome | null>(null)
  const [deleteCascadeTransactions, setDeleteCascadeTransactions] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Estado de loading para toggle ativo/pausado
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Itens separados por type
  const incomeItems = recurringIncomes.filter((item) => (item.type || 'income') === 'income')
  const expenseItems = recurringIncomes.filter((item) => item.type === 'expense')

  const handleOpenEdit = (rule: RecurringIncome) => {
    if (onEditRecurringRule) {
      onEditRecurringRule(rule)
    } else {
      setEditingRule(rule)
      setIsEditDialogOpen(true)
    }
  }

  const handleToggleActive = async (rule: RecurringIncome) => {
    const newStatus = !rule.active
    try {
      setTogglingId(rule.id)
      await updateRecurringIncome(rule.id, { active: newStatus })
      toast({
        title: newStatus ? 'Regra reativada 🔁' : 'Regra pausada ⏸️',
        description: newStatus
          ? `"${rule.name}" voltará a gerar lançamentos automáticos todo mês.`
          : `"${rule.name}" foi pausada e não gerará lançamentos automáticos até ser reativada.`,
      })
      onSuccess()
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao alterar status',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setTogglingId(null)
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
  const renderItemList = (items: RecurringIncome[]) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-10 px-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
          <Sparkles className="w-9 h-9 text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-slate-800 text-sm">Nenhuma regra recorrente ainda</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Use o botão + e ative &quot;Repetir todo mês&quot; para cadastrar salários, assinaturas
            ou contas fixas da família.
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-2.5">
        {items.map((item) => {
          const isIncome = (item.type || 'income') === 'income'
          const isPaused = item.active === false
          const isTogglingThis = togglingId === item.id
          const override = overrideMap.get(item.id)
          const hasOverride = Boolean(override)
          const effectiveAmount = hasOverride ? override!.amount_cents : item.amount_cents

          return (
            <div
              key={item.id}
              className={`rounded-2xl border bg-white p-3 sm:p-3.5 space-y-2 shadow-2xs transition-colors ${
                isPaused
                  ? 'border-slate-200/60 bg-slate-50/50 opacity-75'
                  : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              {/* Linha principal: Ícone, dados da regra, valor e menu de ações */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs mt-0.5 ${
                      isPaused
                        ? 'bg-slate-100 text-slate-400 border-slate-200'
                        : isIncome
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-rose-50 text-rose-700 border-rose-100'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`font-bold text-sm truncate ${
                          isPaused ? 'text-slate-600 line-through' : 'text-slate-900'
                        }`}
                        title={item.name}
                      >
                        {item.name}
                      </span>

                      {/* Tag Ativa / Pausada */}
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                          isPaused
                            ? 'bg-slate-100 text-slate-600 border-slate-300/80'
                            : 'bg-emerald-100/80 text-emerald-800 border-emerald-200/80'
                        }`}
                      >
                        {isPaused ? 'Pausada' : 'Ativa'}
                      </span>

                      {/* Tag Dia do Mês */}
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100/90 border border-slate-200 px-2 py-0.5 rounded-full shrink-0">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>Dia {item.day_of_month}</span>
                      </span>

                      {/* Tag Tipo */}
                      <span
                        className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
                          isIncome
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                        }`}
                      >
                        {isIncome ? 'Receita fixa' : 'Despesa fixa'}
                      </span>

                      {hasOverride ? (
                        <span className="text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                          ajustado em {formatMonthYear(currentMonthDate)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-medium text-slate-600">
                        <User className="w-3 h-3 text-slate-500" />
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

                <div className="text-right shrink-0 pl-1">
                  <span
                    className={`font-bold text-sm sm:text-base tabular-nums block ${
                      isPaused ? 'text-slate-400' : isIncome ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    <span>
                      {isIncome ? '+' : '−'} {formatBRL(effectiveAmount)}
                    </span>
                  </span>
                  {hasOverride ? (
                    <span className="text-[10px] text-slate-400 line-through tabular-nums block">
                      padrão {formatBRL(item.amount_cents)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 block">recorrente mensal</span>
                  )}
                </div>
              </div>

              {/* Barra inferior de Ações: Ajuste Pontual à esquerda e Ações à direita */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                {/* Botão de Ajuste pontual deste mês */}
                <button
                  type="button"
                  onClick={() => openOverrideDialog(item)}
                  className={`font-semibold px-2 py-1 rounded-lg transition-colors flex items-center gap-1 text-[11px] sm:text-xs ${
                    isIncome
                      ? 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50'
                      : 'text-rose-700 hover:text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{hasOverride ? 'Editar ajuste deste mês' : 'Ajustar só neste mês'}</span>
                </button>

                {/* Ações: Desktop (ícones diretos) + Mobile (botões diretos E menu de 3 pontinhos com paridade total) */}
                <div className="flex items-center gap-1">
                  {/* Botão Pausar/Reativar */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    disabled={isTogglingThis}
                    className={`p-1.5 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 ${
                      isPaused
                        ? 'text-emerald-700 hover:bg-emerald-50'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                    title={isPaused ? 'Reativar regra recorrente' : 'Pausar regra recorrente'}
                    aria-label={isPaused ? 'Reativar regra' : 'Pausar regra'}
                  >
                    {isTogglingThis ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isPaused ? (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span className="hidden sm:inline">Reativar</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Pausar</span>
                      </>
                    )}
                  </button>

                  {/* Botão Editar (Abre o modal unificado) */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1"
                    title={`Editar ${isIncome ? 'receita fixa' : 'despesa fixa'}`}
                    aria-label="Editar regra"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-xs font-semibold">Editar</span>
                  </button>

                  {/* Botão Excluir */}
                  <button
                    type="button"
                    onClick={() => {
                      setItemToDelete(item)
                      setDeleteCascadeTransactions(false)
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title={`Excluir ${isIncome ? 'receita fixa' : 'despesa fixa'}`}
                    aria-label="Excluir regra"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Menu Três Pontinhos (Paridade Mobile/Desktop — acesso rápido a todas as ações) */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                        title="Mais opções da regra"
                        aria-label="Mais opções"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
                      <DropdownMenuItem
                        onClick={() => handleOpenEdit(item)}
                        className="text-xs font-semibold gap-2 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Editar regra</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleActive(item)}
                        className="text-xs font-semibold gap-2 cursor-pointer"
                      >
                        {isPaused ? (
                          <>
                            <Play className="w-3.5 h-3.5 text-emerald-600 fill-current" />
                            <span>Reativar regra</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pausar regra</span>
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openOverrideDialog(item)}
                        className="text-xs font-semibold gap-2 cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Ajustar só neste mês</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setItemToDelete(item)
                          setDeleteCascadeTransactions(false)
                        }}
                        className="text-xs font-semibold gap-2 text-red-600 focus:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        <span>Excluir regra</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderContentBody = () => (
    <div className="space-y-3.5">
      {/* Abas: Todas, Despesas, Receitas */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'all' | 'expense' | 'income')}
        className="w-full flex flex-col"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <TabsList className="grid grid-cols-3 p-1 bg-slate-100/90 rounded-2xl h-9 w-full sm:w-80">
            <TabsTrigger
              value="all"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
            >
              <span>Todas ({recurringIncomes.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="expense"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-rose-700 data-[state=active]:shadow-xs flex items-center justify-center gap-1"
            >
              <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />
              <span>Despesas ({expenseItems.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="income"
              className="rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-xs flex items-center justify-center gap-1"
            >
              <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
              <span>Receitas ({incomeItems.length})</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-xl self-end sm:self-auto">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px]">
              Mês: <strong>{formatMonthYear(currentMonthDate)}</strong>
            </span>
          </div>
        </div>

        {/* Mensagem educativa discreta */}
        <p className="text-[11px] text-slate-500 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/60 mt-2">
          🔁 <strong>Gestão de Recorrentes:</strong> Salários, aluguel, condomínio e assinaturas são
          gerados automaticamente no dia configurado. Para criar uma nova, toque no botão{' '}
          <strong>+</strong> e ative <em>&quot;Repetir todo mês&quot;</em>.
        </p>

        <div className="mt-3">
          <TabsContent value="all" className="mt-0">
            {renderItemList(recurringIncomes)}
          </TabsContent>

          <TabsContent value="expense" className="mt-0">
            {renderItemList(expenseItems)}
          </TabsContent>

          <TabsContent value="income" className="mt-0">
            {renderItemList(incomeItems)}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )

  return (
    <>
      {/* MOBILE: BOTTOM SHEET | DESKTOP: DIALOG CENTRALIZADO */}
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl border-t border-slate-200/90 bg-white p-5 pb-8 max-h-[92vh] overflow-y-auto overflow-x-hidden min-w-0"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 -mt-1" />
            <SheetHeader className="text-left space-y-1 mb-3">
              <SheetTitle className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <span>Regras Recorrentes</span>
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500">
                Gerencie salários, aluguel e despesas fixas que se repetem todo mês na família.
              </SheetDescription>
            </SheetHeader>

            {renderContentBody()}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-2xl w-[95vw] rounded-3xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <span>Regras Recorrentes</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Salários, aluguel e contas fixas mensais são lançados automaticamente todo mês no
                dia definido, gerando projeções no calendário orçamentário.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-1 py-1">{renderContentBody()}</div>

            <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end">
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
      )}

      {/* DIÁLOGO MODAL UNIFICADO PARA EDIÇÃO DA REGRA (QUANDO ACIONADO INTERNAMENTE) */}
      <NewTransactionDialog
        open={isEditDialogOpen}
        onOpenChange={(openState) => {
          setIsEditDialogOpen(openState)
          if (!openState) setEditingRule(null)
        }}
        editingRecurringRule={editingRule}
        onSuccess={() => {
          onSuccess()
          setIsEditDialogOpen(false)
          setEditingRule(null)
        }}
      />

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
                    className="bg-brand-amber hover:bg-brand-press text-brand-ink text-xs h-8 rounded-xl font-bold border-0"
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
