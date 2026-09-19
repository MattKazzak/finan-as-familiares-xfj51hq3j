import React, { useState, useMemo } from 'react'
import type {
  Transaction,
  TransactionCategory,
  TransactionSubcategory,
  BudgetBucket,
} from '@/types/finance'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { formatBRL } from '@/lib/formatters'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, Loader2, Sparkles, AlertCircle } from 'lucide-react'

export interface SaveInlineCategoryData {
  transactionId: string
  categoryId: string
  subcategoryId: string | null
  rememberRule: boolean
  description: string
}

interface TransactionInlineRowProps {
  transaction: Transaction
  categories: TransactionCategory[]
  onSave: (data: SaveInlineCategoryData) => Promise<void>
  disabled?: boolean
}

// Baldes com ordem visual padrão e títulos claros
const BUCKET_GROUPS: {
  bucket: BudgetBucket
  label: string
  badgeColor: string
}[] = [
  { bucket: 'essentials', label: 'Essenciais', badgeColor: 'bg-sky-100 text-sky-800' },
  { bucket: 'lifestyle', label: 'Estilo de Vida', badgeColor: 'bg-amber-100 text-amber-800' },
  { bucket: 'future', label: 'Futuro & Metas', badgeColor: 'bg-emerald-100 text-emerald-800' },
]

export const TransactionInlineRow: React.FC<TransactionInlineRowProps> = ({
  transaction,
  categories,
  onSave,
  disabled = false,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>('')
  const [selectedSubcatId, setSelectedSubcatId] = useState<string>('none')
  const [rememberRule, setRememberRule] = useState<boolean>(true) // MARCADO POR PADRÃO para acelerar
  const [saving, setSaving] = useState(false)
  const [justResolved, setJustResolved] = useState(false)

  // Filtrar categorias aplicáveis pelo tipo da transação (despesas na sua maioria)
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === transaction.type)
  }, [categories, transaction.type])

  // Categoria atualmente selecionada
  const activeCategory = useMemo(() => {
    return filteredCategories.find((c) => c.id === selectedCatId) || null
  }, [filteredCategories, selectedCatId])

  // Subcategorias da categoria selecionada
  const availableSubcategories = useMemo(() => {
    return activeCategory?.subcategories || []
  }, [activeCategory])

  // Agrupamento das categorias de despesas por Balde
  const categorizedByBucket = useMemo(() => {
    if (transaction.type !== 'expense') {
      return null
    }

    const groups: Record<BudgetBucket, TransactionCategory[]> = {
      essentials: [],
      lifestyle: [],
      future: [],
    }

    filteredCategories.forEach((cat) => {
      const b = (cat.budget_bucket as BudgetBucket) || 'lifestyle'
      if (groups[b]) {
        groups[b].push(cat)
      } else {
        groups.lifestyle.push(cat)
      }
    })

    return groups
  }, [filteredCategories, transaction.type])

  // Quando o usuário escolhe a categoria:
  // Se a categoria NÃO tem subcategorias, já salva diretamente.
  // Se tem subcategorias, redefine a subcategoria e permite selecionar opcionalmente.
  const handleCategoryChange = async (newCatId: string) => {
    if (!newCatId || newCatId === 'none') return
    setSelectedCatId(newCatId)
    setSelectedSubcatId('none')

    const chosenCat = filteredCategories.find((c) => c.id === newCatId)
    const hasSubs = chosenCat && chosenCat.subcategories && chosenCat.subcategories.length > 0

    // Se NÃO tiver subcategorias, já dispara o salvamento imediatamente
    if (!hasSubs) {
      await executeSave(newCatId, null)
    }
  }

  // Quando o usuário escolhe a subcategoria
  const handleSubcategoryChange = async (newSubId: string) => {
    const subVal = newSubId === 'none' ? null : newSubId
    setSelectedSubcatId(newSubId)
    if (selectedCatId) {
      await executeSave(selectedCatId, subVal)
    }
  }

  const executeSave = async (catId: string, subId: string | null) => {
    try {
      setSaving(true)
      await onSave({
        transactionId: transaction.id,
        categoryId: catId,
        subcategoryId: subId,
        rememberRule,
        description: transaction.description || '',
      })
      setJustResolved(true)
    } catch (err) {
      console.error('Erro ao salvar categoria inline:', err)
    } finally {
      setSaving(false)
    }
  }

  const isIncome = transaction.type === 'income'

  if (justResolved) {
    return (
      <div className="p-3.5 bg-emerald-50/70 border-l-4 border-emerald-500 rounded-2xl flex items-center justify-between text-xs transition-all animate-in fade-in-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <div>
            <span className="font-bold text-emerald-900 block truncate">
              {transaction.description || 'Transação'}
            </span>
            <span className="text-[11px] text-emerald-700">
              Categorizada como <strong>{activeCategory?.name}</strong>
              {rememberRule ? ' • Regra salva para próximas compras' : ''}
            </span>
          </div>
        </div>
        <span className="font-bold text-emerald-700 tabular-nums shrink-0">
          {formatBRL(transaction.amount_cents)}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`p-3 sm:p-3.5 rounded-2xl border transition-all bg-amber-50/30 border-amber-200/90 hover:border-amber-300 hover:bg-amber-50/50 shadow-2xs ${
        saving ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      {/* Linha superior: Descrição original do banco + Valor */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse"
            title="Pendente de categoria"
          />
          <div className="min-w-0">
            <p
              className="font-bold text-xs sm:text-sm text-slate-900 truncate"
              title={transaction.description}
            >
              {transaction.description || 'Transação sem descrição'}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
              <span className="font-medium bg-amber-100/80 text-amber-900 px-1.5 py-0.2 rounded font-mono">
                Pendente
              </span>
              {transaction.member?.name && <span>• {transaction.member.name}</span>}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span
            className={`font-extrabold text-xs sm:text-sm tabular-nums ${
              isIncome ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {isIncome ? '+' : '−'} {formatBRL(transaction.amount_cents)}
          </span>
        </div>
      </div>

      {/* Linha inferior: Dropdown de Categoria (agrupado por balde) + Subcategoria + Checkbox Lembrar */}
      <div className="mt-2.5 pt-2.5 border-t border-amber-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* Select de Categoria */}
          <div className="w-full sm:w-auto min-w-[190px] flex-1">
            <Select
              value={selectedCatId || 'placeholder'}
              onValueChange={handleCategoryChange}
              disabled={disabled || saving}
            >
              <SelectTrigger
                className={`h-8 text-xs bg-white rounded-xl border-amber-300 shadow-2xs font-medium ${
                  !selectedCatId ? 'text-amber-900 border-amber-300' : 'text-slate-800'
                }`}
              >
                <SelectValue placeholder="Escolher categoria..." />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {categorizedByBucket
                  ? BUCKET_GROUPS.map(({ bucket, label, badgeColor }) => {
                      const list = categorizedByBucket[bucket] || []
                      if (list.length === 0) return null
                      return (
                        <SelectGroup key={bucket}>
                          <SelectLabel className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 px-2 py-1 bg-slate-50">
                            <span>{label}</span>
                          </SelectLabel>
                          {list.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              <span className="flex items-center gap-2">
                                <CategoryIcon name={c.icon} className="w-3.5 h-3.5" />
                                <span className="font-medium text-slate-800">{c.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    })
                  : filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        <span className="flex items-center gap-2">
                          <CategoryIcon name={c.icon} className="w-3.5 h-3.5" />
                          <span className="font-medium text-slate-800">{c.name}</span>
                        </span>
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          {/* Select de Subcategoria (aparece se houver subcategorias) */}
          {availableSubcategories.length > 0 && (
            <div className="w-full sm:w-auto min-w-[150px]">
              <Select
                value={selectedSubcatId}
                onValueChange={handleSubcategoryChange}
                disabled={disabled || saving}
              >
                <SelectTrigger className="h-8 text-xs bg-white rounded-xl border-slate-200 shadow-2xs">
                  <SelectValue placeholder="Subcategoria..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none" className="text-xs text-slate-500">
                    Sem subcategoria
                  </SelectItem>
                  {availableSubcategories.map((sub: TransactionSubcategory) => (
                    <SelectItem key={sub.id} value={sub.id} className="text-xs">
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {saving && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Salvando...</span>
            </div>
          )}
        </div>

        {/* Checkbox "Lembrar para compras futuras com este nome" (Marcado por padrão) */}
        <div className="flex items-center gap-2 pt-1 sm:pt-0 shrink-0">
          <label className="flex items-center gap-2 text-[11px] text-slate-700 font-medium cursor-pointer select-none">
            <Checkbox
              checked={rememberRule}
              onCheckedChange={(checked) => setRememberRule(!!checked)}
              disabled={disabled || saving}
              className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
            />
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>Lembrar para compras futuras com este nome</span>
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
