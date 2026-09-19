import React, { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CategoryIcon, AVAILABLE_ICONS } from '@/components/common/CategoryIcon'
import { Loader2, Plus } from 'lucide-react'
import type { TransactionCategory } from '@/types/finance'

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
  }) => Promise<void>
  title?: string
  defaultType?: 'income' | 'expense'
}

export const CategoryEditorPopover: React.FC<CategoryEditorPopoverProps> = ({
  category,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSave,
  title,
  defaultType = 'expense',
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
  const isEditing = Boolean(category)

  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [color, setColor] = useState('#3B82F6')
  const [icon, setIcon] = useState('Tag')
  const [saving, setSaving] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      if (category) {
        setName(category.name || '')
        setType(category.type || 'expense')
        setColor(category.color || '#3B82F6')
        setIcon(category.icon || 'Tag')
      } else {
        setName('')
        setType(defaultType)
        setColor(defaultType === 'income' ? '#10B981' : '#3B82F6')
        setIcon('Tag')
      }
    }
    setOpen(nextOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const trimmed = name.trim()
    if (!trimmed) return

    try {
      setSaving(true)
      await onSave({
        name: trimmed,
        type,
        color,
        icon,
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
              disabled={saving || !name.trim()}
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
