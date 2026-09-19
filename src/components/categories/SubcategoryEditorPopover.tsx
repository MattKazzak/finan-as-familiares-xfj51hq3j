import React, { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus } from 'lucide-react'
import type { TransactionSubcategory } from '@/types/finance'

interface SubcategoryEditorPopoverProps {
  subcategory?: TransactionSubcategory | null
  parentCategoryName?: string
  trigger: React.ReactNode
  onSave: (data: { name: string }) => Promise<void>
  title?: string
}

export const SubcategoryEditorPopover: React.FC<SubcategoryEditorPopoverProps> = ({
  subcategory,
  parentCategoryName,
  trigger,
  onSave,
  title,
}) => {
  const [open, setOpen] = useState(false)
  const isEditing = Boolean(subcategory)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setName(subcategory?.name || '')
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
      await onSave({ name: trimmed })
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
        className="w-72 p-3.5 rounded-2xl shadow-xl border border-slate-200 bg-white z-50 text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col pb-1 border-b border-slate-100">
            <span className="font-bold text-xs text-slate-900">
              {title || (isEditing ? 'Renomear Subcategoria' : 'Nova Subcategoria')}
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
