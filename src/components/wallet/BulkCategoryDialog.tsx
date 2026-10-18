// Bulk edit por seleção (P1 — padrão Monarch/Actual):
// diálogo de categorização em lote para as transações marcadas no modo seleção.
// Escolhe categoria (agrupada por 3 Baldes) + subcategoria opcional + opção de
// salvar regra ("sempre X → Y" para o padrão mais comum do lote).
import { useMemo, useState } from 'react'
import { Loader2, Layers, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { useWallet } from '@/pages/wallet/WalletContext'
import type { BudgetBucket } from '@/types/finance'

const BUCKET_GROUPS: { bucket: BudgetBucket; label: string }[] = [
  { bucket: 'essentials', label: 'Essenciais' },
  { bucket: 'lifestyle', label: 'Estilo de Vida' },
  { bucket: 'future', label: 'Futuro & Metas' },
]

export function BulkCategoryDialog() {
  const {
    bulkCategoryDialogOpen,
    setBulkCategoryDialogOpen,
    handleBulkApplyCategory,
    bulkApplying,
    selectedTxIds,
    transactions,
    categories,
  } = useWallet()

  const [selectedCatId, setSelectedCatId] = useState('')
  const [selectedSubcatId, setSelectedSubcatId] = useState('none')
  const [saveRule, setSaveRule] = useState(true)

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === selectedCatId) || null,
    [categories, selectedCatId],
  )
  const availableSubcategories = activeCategory?.subcategories || []

  // Despesas e receitas no lote: só oferece categorias do tipo predominante
  const predominantType = useMemo(() => {
    let expense = 0
    let income = 0
    for (const tx of transactions) {
      if (selectedTxIds.has(tx.id)) {
        if (tx.type === 'income') income++
        else expense++
      }
    }
    return income > expense ? 'income' : 'expense'
  }, [transactions, selectedTxIds])

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === predominantType),
    [categories, predominantType],
  )

  const categorizedByBucket = useMemo(() => {
    if (predominantType !== 'expense') return null
    const groups: Record<BudgetBucket, typeof filteredCategories> = {
      essentials: [],
      lifestyle: [],
      future: [],
    }
    filteredCategories.forEach((cat) => {
      const b = (cat.budget_bucket as BudgetBucket) || 'lifestyle'
      if (groups[b]) groups[b].push(cat)
      else groups.lifestyle.push(cat)
    })
    return groups
  }, [filteredCategories, predominantType])

  const handleClose = () => {
    setBulkCategoryDialogOpen(false)
    setSelectedCatId('')
    setSelectedSubcatId('none')
    setSaveRule(true)
  }

  const handleSave = async () => {
    if (!selectedCatId) return
    await handleBulkApplyCategory(
      selectedCatId,
      selectedSubcatId === 'none' ? null : selectedSubcatId,
      saveRule,
    )
    setSelectedCatId('')
    setSelectedSubcatId('none')
    setSaveRule(true)
  }

  return (
    <Dialog open={bulkCategoryDialogOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md w-[95vw] rounded-3xl p-5 bg-card/95 backdrop-blur-sm border border-border/40 shadow-curiango">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Layers className="w-4 h-4 text-violet-600" />
            <span>Categorizar {selectedTxIds.size} transações</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Categoria ({predominantType === 'income' ? 'receitas' : 'despesas'})
            </Label>
            <Select
              value={selectedCatId || 'placeholder'}
              onValueChange={(v) => {
                setSelectedCatId(v)
                setSelectedSubcatId('none')
              }}
              disabled={bulkApplying}
            >
              <SelectTrigger className="h-9 text-xs bg-white rounded-xl font-medium border-2 border-slate-300">
                <SelectValue placeholder="Escolher categoria..." />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {categorizedByBucket
                  ? BUCKET_GROUPS.map(({ bucket, label }) => {
                      const list = categorizedByBucket[bucket] || []
                      if (list.length === 0) return null
                      return (
                        <SelectGroup key={bucket}>
                          <SelectLabel className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1 px-2.5 py-1.5 bg-slate-100/90 rounded-md my-0.5">
                            <span>{label}</span>
                          </SelectLabel>
                          {list.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs py-1.5">
                              <span className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                                  style={{
                                    backgroundColor: c.color || '#10B981',
                                    color: '#FFFFFF',
                                  }}
                                >
                                  <CategoryIcon name={c.icon} className="w-2.5 h-2.5" />
                                </div>
                                <span className="font-semibold text-slate-800">{c.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    })
                  : filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs py-1.5">
                        <span className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: c.color || '#10B981', color: '#FFFFFF' }}
                          >
                            <CategoryIcon name={c.icon} className="w-2.5 h-2.5" />
                          </div>
                          <span className="font-semibold text-slate-800">{c.name}</span>
                        </span>
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          {activeCategory && availableSubcategories.length > 0 ? (
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Subcategoria
              </Label>
              <Select
                value={selectedSubcatId}
                onValueChange={setSelectedSubcatId}
                disabled={bulkApplying}
              >
                <SelectTrigger className="h-9 text-xs bg-white rounded-xl font-medium border border-slate-300">
                  <SelectValue placeholder="Opcional..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">
                    Sem subcategoria
                  </SelectItem>
                  {availableSubcategories.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none">
            <Checkbox
              checked={saveRule}
              onCheckedChange={(checked) => setSaveRule(!!checked)}
              disabled={bulkApplying}
              className="data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600 rounded-md"
            />
            <span className="flex items-center gap-1.5 leading-tight">
              <Sparkles className="w-3.5 h-3.5 text-violet-600 shrink-0" />
              <span>Criar regra automática para nomes semelhantes</span>
            </span>
          </label>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={bulkApplying}
            className="rounded-xl text-xs text-slate-600 hover:text-slate-900 flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!selectedCatId || bulkApplying}
            className="rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white flex-1 gap-1.5 border-0"
          >
            {bulkApplying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Aplicando...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Aplicar a {selectedTxIds.size}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
