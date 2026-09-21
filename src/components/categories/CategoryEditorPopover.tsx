import React, { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CategoryIcon, AVAILABLE_ICONS } from '@/components/common/CategoryIcon'
import { Loader2, Plus, Home, Coffee, TrendingUp } from 'lucide-react'
import type { BudgetBucket, TransactionCategory } from '@/types/finance'
import { useFamily } from '@/hooks/use-family'
import { parseBRLToCents, formatNumberBRL, formatBRL } from '@/lib/formatters'

export const CATEGORY_COLORS = [
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

export const BUCKET_OPTIONS: Array<{
  id: BudgetBucket
  label: string
  description: string
  icon: typeof Home
  badgeClass: string
  activeBorderClass: string
}> = [
  {
    id: 'essentials',
    label: 'Essenciais',
    description: 'necessidades básicas, moradia, saúde, subsistência',
    icon: Home,
    badgeClass: 'text-sky-700 bg-sky-50 border-sky-200',
    activeBorderClass: 'border-sky-500 bg-sky-50/70 text-sky-950 ring-1 ring-sky-500/30',
  },
  {
    id: 'lifestyle',
    label: 'Estilo de Vida',
    description: 'conforto, lazer, compras, desejos, pets',
    icon: Coffee,
    badgeClass: 'text-amber-700 bg-amber-50 border-amber-200',
    activeBorderClass: 'border-amber-500 bg-amber-50/70 text-amber-950 ring-1 ring-amber-500/30',
  },
  {
    id: 'future',
    label: 'Futuro & Metas',
    description: 'investimentos, reserva de emergência, projetos',
    icon: TrendingUp,
    badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    activeBorderClass:
      'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-500/30',
  },
]

interface CategoryEditorPopoverProps {
  category?: TransactionCategory | null
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSave: (data: {
    name: string
    type: 'income' | 'expense'
    color: string
    icon: string
    budget_bucket?: BudgetBucket | null
    budget_amount_cents?: number
  }) => Promise<void>
  title?: string
  defaultType?: 'income' | 'expense'
  initialLimitCents?: number
}

export const CategoryEditorPopover: React.FC<CategoryEditorPopoverProps> = ({
  category,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSave,
  title,
  defaultType = 'expense',
  initialLimitCents,
}) => {
  const { family } = useFamily()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (isControlled) {
      setControlledOpen?.(next)
    } else {
      setUncontrolledOpen(next)
    }
  }
  const isEditing = Boolean(category)

  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [color, setColor] = useState('#3B82F6')
  const [icon, setIcon] = useState('Tag')
  const [budgetBucket, setBudgetBucket] = useState<BudgetBucket>('essentials')
  const [budgetAmountStr, setBudgetAmountStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [bucketError, setBucketError] = useState<string | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setBucketError(null)
      if (category) {
        setName(category.name || '')
        setType(category.type || 'expense')
        setColor(category.color || '#3B82F6')
        setIcon(category.icon || 'Tag')
        setBudgetBucket(category.budget_bucket || 'essentials')
        setBudgetAmountStr(
          initialLimitCents && initialLimitCents > 0 ? formatNumberBRL(initialLimitCents) : '',
        )
      } else {
        setName('')
        setType(defaultType)
        setColor(defaultType === 'income' ? '#10B981' : '#3B82F6')
        setIcon('Tag')
        setBudgetBucket('essentials')
        setBudgetAmountStr(
          initialLimitCents && initialLimitCents > 0 ? formatNumberBRL(initialLimitCents) : '',
        )
      }
    }
    setOpen(nextOpen)
  }

  const parsedBudgetCents = parseBRLToCents(budgetAmountStr)
  const netIncome = family?.monthly_net_income_cents || 0
  const calculatedPercent =
    netIncome > 0 && parsedBudgetCents > 0
      ? Math.round((parsedBudgetCents / netIncome) * 1000) / 10
      : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const trimmed = name.trim()
    if (!trimmed) return

    // Validação obrigatória do balde orçamentário para despesas
    if (type === 'expense' && !budgetBucket) {
      setBucketError('Selecione um dos 3 baldes orçamentários.')
      return
    }

    setBucketError(null)

    try {
      setSaving(true)
      await onSave({
        name: trimmed,
        type,
        color,
        icon,
        budget_bucket: type === 'expense' ? budgetBucket : null,
        budget_amount_cents: type === 'expense' ? parsedBudgetCents : 0,
      })
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
          {trigger}
        </PopoverTrigger>
      ) : null}
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="w-80 p-4 rounded-2xl shadow-xl border border-slate-200 bg-white z-50 text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="font-bold text-xs text-slate-900">
              {title || (isEditing ? 'Editar Categoria' : 'Nova Categoria')}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] uppercase font-bold text-slate-400">
                {type === 'income' ? 'Receita' : 'Despesa'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-slate-600">Nome</Label>
            <Input
              type="text"
              placeholder="Ex.: Alimentação, Moradia..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs rounded-xl"
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600">Tipo</Label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`text-[11px] font-semibold py-1 rounded-md transition-all ${
                    type === 'expense'
                      ? 'bg-white text-red-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Despesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`text-[11px] font-semibold py-1 rounded-md transition-all ${
                    type === 'income'
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Receita</span>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600">Ícone Selecionado</Label>
              <div className="flex items-center gap-2 h-8 px-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  <CategoryIcon name={icon} className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-medium text-slate-700 truncate">{icon}</span>
              </div>
            </div>
          </div>

          {/* Balde Orçamentário (Obrigatório para categorias de Despesa) */}
          {type === 'expense' && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700">
                  Balde Orçamentário <span className="text-rose-500">*</span>
                </Label>
                <span className="text-[10px] text-slate-500 font-medium">Obrigatório</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {BUCKET_OPTIONS.map((opt) => {
                  const isSelected = budgetBucket === opt.id
                  const IconComp = opt.icon
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setBudgetBucket(opt.id)
                        setBucketError(null)
                      }}
                      className={`w-full text-left p-2 rounded-xl border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? opt.activeBorderClass
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white text-slate-600'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-white shadow-2xs text-slate-900'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-xs font-semibold ${
                              isSelected ? 'text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {opt.label}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Ativo
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
              {bucketError && (
                <p className="text-[10px] text-rose-500 font-medium mt-0.5">{bucketError}</p>
              )}
            </div>
          )}

          {/* Teto Orçamentário Mensal (R$) - Opcional para categorias de Despesa */}
          {type === 'expense' && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="category-budget-limit"
                  className="text-[11px] font-semibold text-slate-700"
                >
                  Teto orçamentário mensal (R$)
                </Label>
                <span className="text-[10px] text-slate-400 font-medium">Opcional</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[11px]">
                    R$
                  </span>
                  <Input
                    id="category-budget-limit"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={budgetAmountStr}
                    onChange={(e) => setBudgetAmountStr(e.target.value)}
                    className="pl-8 text-xs font-bold tabular-nums h-8 rounded-xl"
                  />
                </div>
                <div className="h-8 px-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-semibold tabular-nums text-slate-700">
                  <span className="text-slate-400 text-[10px] font-normal">% renda:</span>
                  <span className="text-[11px] text-emerald-800">
                    {netIncome > 0 && parsedBudgetCents > 0 ? `${calculatedPercent}%` : '—'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {parsedBudgetCents > 0
                  ? `Teto individual fixado em ${formatBRL(parsedBudgetCents)}.`
                  : 'Consumo livre do saldo do balde (sem teto individual). Esta categoria consumirá o saldo livre do balde orçamentário sem limite individual.'}
              </p>
            </div>
          )}

          {/* Paleta de Cores */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600">Cor</Label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {CATEGORY_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    color === c
                      ? 'ring-2 ring-slate-900 ring-offset-1 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Galeria de Ícones Disponíveis */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600">Escolher Ícone</Label>
            <div className="grid grid-cols-7 gap-1 p-1 bg-slate-50 border border-slate-100 rounded-xl max-h-24 overflow-y-auto">
              {AVAILABLE_ICONS.map((iName) => {
                const isSelected = icon === iName
                return (
                  <button
                    type="button"
                    key={iName}
                    onClick={() => setIcon(iName)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                    title={iName}
                  >
                    <CategoryIcon name={iName} className="w-3.5 h-3.5" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setOpen(false)}
              className="h-7 text-xs rounded-lg px-2.5"
            >
              <span>Cancelar</span>
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !name.trim() || (type === 'expense' && !budgetBucket)}
              className="h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3"
            >
              <span className="flex items-center gap-1.5">
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : !isEditing ? (
                  <Plus className="w-3 h-3" />
                ) : null}
                <span>{isEditing ? 'Salvar' : 'Criar'}</span>
              </span>
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
