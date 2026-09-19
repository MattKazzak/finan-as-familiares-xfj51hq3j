import React, { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Calendar, Layers } from 'lucide-react'
import { formatNumberBRL, parseBRLToCents } from '@/lib/formatters'
import type { TransactionSubcategory } from '@/types/finance'

export interface SubcategorySaveData {
  name: string
  defaultLimitCents?: number
  monthLimitCents?: number
  isEditingOnlyThisMonth?: boolean
}

interface SubcategoryEditorPopoverProps {
  subcategory?: TransactionSubcategory | null
  parentCategoryName?: string
  trigger: React.ReactNode
  onSave: (data: SubcategorySaveData) => Promise<void>
  title?: string
  // Valores atuais de orçamento (quando disponíveis na visualização da carteira)
  initialDefaultLimitCents?: number
  initialMonthLimitCents?: number
  hasMonthOverride?: boolean
  currentMonthLabel?: string
  showBudgetFields?: boolean
}

export const SubcategoryEditorPopover: React.FC<SubcategoryEditorPopoverProps> = ({
  subcategory,
  parentCategoryName,
  trigger,
  onSave,
  title,
  initialDefaultLimitCents = 0,
  initialMonthLimitCents = 0,
  hasMonthOverride = false,
  currentMonthLabel,
  showBudgetFields = false,
}) => {
  const [open, setOpen] = useState(false)
  const isEditing = Boolean(subcategory)
  const [name, setName] = useState('')
  const [defaultAmountStr, setDefaultAmountStr] = useState('')
  const [monthAmountStr, setMonthAmountStr] = useState('')
  const [isEditingOnlyThisMonth, setIsEditingOnlyThisMonth] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setName(subcategory?.name || '')
      setDefaultAmountStr(
        initialDefaultLimitCents > 0 ? formatNumberBRL(initialDefaultLimitCents) : '',
      )
      setMonthAmountStr(initialMonthLimitCents > 0 ? formatNumberBRL(initialMonthLimitCents) : '')
      setIsEditingOnlyThisMonth(Boolean(hasMonthOverride))
    }
    setOpen(nextOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const trimmed = name.trim()
    if (!trimmed) return

    const defaultCents = parseBRLToCents(defaultAmountStr)
    const monthCents = parseBRLToCents(monthAmountStr)

    try {
      setSaving(true)
      await onSave({
        name: trimmed,
        defaultLimitCents: defaultCents,
        monthLimitCents: monthCents,
        isEditingOnlyThisMonth,
      })
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className={
          showBudgetFields
            ? 'w-80 p-4 rounded-2xl shadow-xl border border-slate-200 bg-white z-50 text-slate-800'
            : 'w-72 p-3.5 rounded-2xl shadow-xl border border-slate-200 bg-white z-50 text-slate-800'
        }
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col pb-1 border-b border-slate-100">
            <span className="font-bold text-xs text-slate-900">
              {title || (isEditing ? 'Editar Subcategoria' : 'Nova Subcategoria')}
            </span>
            {parentCategoryName ? (
              <span className="text-[11px] text-slate-400 truncate">
                <span>em {parentCategoryName}</span>
              </span>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-slate-600">Nome da Subcategoria</Label>
            <Input
              type="text"
              placeholder="Ex.: Mercado, Farmácia..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs rounded-xl"
              autoFocus
              required
            />
          </div>

          {showBudgetFields ? (
            <div className="space-y-2.5 pt-1 border-t border-slate-100">
              {/* Seletor de escopo do teto */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">Teto Orçamentário</span>
                {currentMonthLabel ? (
                  <span className="text-[10px] text-slate-400 font-medium">
                    {currentMonthLabel}
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsEditingOnlyThisMonth(false)}
                  className={`flex items-center justify-center gap-1 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    !isEditingOnlyThisMonth
                      ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Recorrente</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingOnlyThisMonth(true)
                    if (!monthAmountStr && defaultAmountStr) {
                      setMonthAmountStr(defaultAmountStr)
                    }
                  }}
                  className={`flex items-center justify-center gap-1 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    isEditingOnlyThisMonth
                      ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>Só este mês</span>
                </button>
              </div>

              {!isEditingOnlyThisMonth ? (
                <div className="space-y-1 bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-xl">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="sub-bg-default"
                      className="text-[10px] font-bold text-slate-700 uppercase tracking-wider"
                    >
                      Teto Padrão Recorrente
                    </Label>
                    <span className="text-[10px] text-emerald-700 font-medium">Todos os meses</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                      R$
                    </span>
                    <Input
                      id="sub-bg-default"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00 (sem teto)"
                      value={defaultAmountStr}
                      onChange={(e) => setDefaultAmountStr(e.target.value)}
                      className="h-8 pl-8 text-xs font-bold tabular-nums bg-white rounded-lg"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Soma-se ao teto da categoria pai em todos os meses.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 bg-amber-50/50 border border-amber-100 p-2.5 rounded-xl">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="sub-bg-month"
                      className="text-[10px] font-bold text-slate-700 uppercase tracking-wider"
                    >
                      Ajuste para este mês
                    </Label>
                    <span className="text-[10px] text-amber-800 font-semibold bg-amber-100 px-1.5 py-0.2 rounded-full">
                      Exclusivo
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                      R$
                    </span>
                    <Input
                      id="sub-bg-month"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={monthAmountStr}
                      onChange={(e) => setMonthAmountStr(e.target.value)}
                      className="h-8 pl-8 text-xs font-bold tabular-nums bg-white rounded-lg"
                    />
                  </div>
                  {defaultAmountStr ? (
                    <p className="text-[10px] text-slate-500 leading-tight">
                      <span>Padrão atual: </span>
                      <strong className="text-slate-700">R$ {defaultAmountStr}</strong>
                      <span>. Volta ao normal nos próximos meses.</span>
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

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
              disabled={saving || !name.trim()}
              className="h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3"
            >
              <span className="flex items-center gap-1.5">
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : !isEditing ? (
                  <Plus className="w-3 h-3" />
                ) : null}
                <span>{isEditing ? 'Salvar' : 'Adicionar'}</span>
              </span>
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
