import React, { useState, useMemo } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Calendar, Layers } from 'lucide-react'
import { formatNumberBRL, parseBRLToCents } from '@/lib/formatters'
import { useIsMobile } from '@/hooks/use-mobile'
import type { TransactionSubcategory } from '@/types/finance'
import { useFamily } from '@/hooks/use-family'

export interface SubcategorySaveData {
  name: string
  defaultLimitCents?: number
  monthLimitCents?: number
  isEditingOnlyThisMonth?: boolean
}

interface SubcategoryEditorPopoverProps {
  subcategory?: TransactionSubcategory | null
  parentCategoryName?: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSave: (data: SubcategorySaveData) => Promise<void>
  title?: string
  /** Id da categoria pai — habilita a trava de duplicata (catálogo v3) */
  parentCategoryId?: string
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
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSave,
  title,
  parentCategoryId,
  initialDefaultLimitCents = 0,
  initialMonthLimitCents = 0,
  hasMonthOverride = false,
  currentMonthLabel,
  showBudgetFields = false,
}) => {
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
  const isEditing = Boolean(subcategory)
  const isMobile = useIsMobile()
  const { categories: allCategories } = useFamily()
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

  // Trava de duplicata (catálogo v3 — aconselha, nunca bloqueia): comparação local
  // normalizada contra as subcategorias da MESMA categoria pai (0ms).
  const existingSimilar = useMemo(() => {
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
    const t = norm(name)
    if (t.length < 3 || !allCategories || !parentCategoryId) return null
    const parent = allCategories.find((c) => c.id === parentCategoryId)
    return (
      parent?.subcategories?.find((s) => s.id !== subcategory?.id && norm(s.name) === t) || null
    )
  }, [name, allCategories, parentCategoryId, subcategory?.id])

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

  const renderFormContent = (isInSheet = false) => (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {!isInSheet && (
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
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">Nome da Subcategoria</Label>
        <Input
          type="text"
          placeholder="Ex.: Mercado, Farmácia..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 text-xs rounded-xl"
          autoFocus
          required
        />
        {/* Trava de duplicata (catálogo v3): aconselha, nunca bloqueia */}
        {existingSimilar ? (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 leading-snug">
            Já existe <strong>{existingSimilar.name}</strong> em{' '}
            {parentCategoryName || 'esta categoria'}. Duplicar separa o mesmo gasto em duas gavetas
            — prefira a existente. (Pode criar mesmo assim.)
          </p>
        ) : null}
      </div>

      {showBudgetFields ? (
        <div className="space-y-2.5 pt-1 border-t border-slate-100">
          {/* Seletor de escopo do teto */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Teto Orçamentário</span>
            {currentMonthLabel ? (
              <span className="text-[11px] text-slate-400 font-medium">{currentMonthLabel}</span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setIsEditingOnlyThisMonth(false)}
              className={`flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                !isEditingOnlyThisMonth
                  ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
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
              className={`flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                isEditingOnlyThisMonth
                  ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
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

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={() => setOpen(false)}
          className="h-8 text-xs rounded-xl px-3"
        >
          <span>Cancelar</span>
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={saving || !name.trim()}
          className="h-8 text-xs rounded-xl bg-action hover:opacity-90 text-white font-bold px-3.5 border-0"
        >
          <span className="flex items-center gap-1.5">
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : !isEditing ? (
              <Plus className="w-3.5 h-3.5" />
            ) : null}
            <span>{isEditing ? 'Salvar' : 'Adicionar'}</span>
          </span>
        </Button>
      </div>
    </form>
  )

  if (isMobile) {
    return (
      <>
        {trigger ? (
          <span
            onClick={(e) => {
              e.stopPropagation()
              handleOpenChange(true)
            }}
            className="inline-flex cursor-pointer"
          >
            {trigger}
          </span>
        ) : null}
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl border-t border-slate-200/90 bg-white p-5 pb-7 max-h-[90vh] overflow-y-auto text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra superior de arraste suave para mobile */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 -mt-1" />

            <SheetHeader className="text-left space-y-1 mb-4">
              <SheetTitle className="text-base font-bold text-slate-900 tracking-tight">
                {title || (isEditing ? 'Editar Subcategoria' : 'Nova Subcategoria')}
              </SheetTitle>
              {parentCategoryName ? (
                <SheetDescription className="text-xs text-slate-500">
                  <span>em {parentCategoryName}</span>
                </SheetDescription>
              ) : null}
            </SheetHeader>

            {renderFormContent(true)}
          </SheetContent>
        </Sheet>
      </>
    )
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
        collisionPadding={12}
        className={
          showBudgetFields
            ? 'w-[calc(100vw-2rem)] max-w-80 p-4 rounded-2xl shadow-xl border border-slate-200 bg-white z-50 text-slate-800'
            : 'w-[calc(100vw-2rem)] max-w-72 p-3.5 rounded-2xl shadow-xl border border-slate-200 bg-white z-50 text-slate-800'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {renderFormContent(false)}
      </PopoverContent>
    </Popover>
  )
}
