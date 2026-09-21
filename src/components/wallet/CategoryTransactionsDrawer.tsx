import { useState, useMemo } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tag, Check, AlertCircle, Calendar, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Transaction, TransactionCategory, TransactionSubcategory } from '@/types/finance'
import { formatBRL, formatRelativeDate } from '@/lib/formatters'
import { updateTransaction } from '@/services/transactions'
import { toast } from '@/hooks/use-toast'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { formatTransactionTitle } from '@/services/installments'

export interface CategoryTransactionsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: TransactionCategory | null
  subcategory?: TransactionSubcategory | null
  /**
   * 'category': all transactions in this category
   * 'direct': only transactions with category_id === category.id and no subcategory_id
   * 'subcategory': only transactions with subcategory_id === subcategory.id
   */
  filterType: 'category' | 'direct' | 'subcategory'
  transactions: Transaction[]
  onTransactionUpdated?: (updated: Transaction) => void
}

export function CategoryTransactionsDrawer({
  open,
  onOpenChange,
  category,
  subcategory,
  filterType,
  transactions,
  onTransactionUpdated,
}: CategoryTransactionsDrawerProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Available subcategories for the parent category
  const availableSubcategories: TransactionSubcategory[] = useMemo(() => {
    if (!category || !category.subcategories) return []
    return category.subcategories
  }, [category])

  // Filter transactions according to selected mode
  const filteredTransactions = useMemo(() => {
    if (!category) return []

    return transactions
      .filter((tx) => {
        // Must match category
        if (tx.category_id !== category.id) return false

        // Filter by subcategory state
        if (filterType === 'direct') {
          return !tx.subcategory_id
        }
        if (filterType === 'subcategory' && subcategory) {
          return tx.subcategory_id === subcategory.id
        }
        // 'category' shows all transactions in the category
        return true
      })
      .sort(
        (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime(),
      )
  }, [transactions, category, subcategory, filterType])

  const totalCents = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      if (tx.type === 'expense') return acc + tx.amount_cents
      return acc
    }, 0)
  }, [filteredTransactions])

  const handleSubcategoryChange = async (tx: Transaction, subcatId: string | null) => {
    const newSubcatId = tx.subcategory_id === subcatId ? null : subcatId
    setUpdatingId(tx.id)

    try {
      const updated = await updateTransaction(tx.id, {
        subcategory_id: newSubcatId,
      })

      toast({
        title: newSubcatId ? 'Subcategoria atribuída' : 'Subcategoria removida',
        description: `Transação "${tx.description || 'Sem descrição'}" atualizada com sucesso.`,
      })

      if (onTransactionUpdated) {
        onTransactionUpdated(updated)
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: err?.message || 'Não foi possível alterar a subcategoria.',
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const getTitle = () => {
    if (!category) return 'Transações'
    if (filterType === 'direct') {
      return `${category.name} • Sem subcategoria`
    }
    if (filterType === 'subcategory' && subcategory) {
      return `${category.name} › ${subcategory.name}`
    }
    return category.name
  }

  const getDescription = () => {
    const count = filteredTransactions.length
    const countLabel = count === 1 ? '1 transação' : `${count} transações`
    return `${countLabel} • Total: ${formatBRL(totalCents)}`
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh] flex flex-col">
        <DrawerHeader className="text-left border-b border-border pb-3">
          <div className="flex items-center gap-3">
            {category && (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                style={{ backgroundColor: category.color || '#6366f1' }}
              >
                <CategoryIcon name={category.icon} className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <DrawerTitle className="text-base sm:text-lg font-semibold truncate flex items-center gap-2">
                <span>{getTitle()}</span>
                {filterType === 'direct' && (
                  <Badge
                    variant="outline"
                    className="text-xs font-normal text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                  >
                    Direto
                  </Badge>
                )}
              </DrawerTitle>
              <DrawerDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {getDescription()}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-border">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Nenhuma transação encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                Não há despesas registradas para este filtro no mês selecionado.
              </p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const currentSubcat = availableSubcategories.find((s) => s.id === tx.subcategory_id)
              const isUpdating = updatingId === tx.id

              return (
                <div key={tx.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-foreground break-words leading-snug">
                          {formatTransactionTitle(tx)}
                        </p>
                      </div>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 shrink-0">
                          <Calendar className="w-3 h-3" />
                          {formatRelativeDate(tx.transaction_date)}
                        </span>
                        {tx.member && <span className="shrink-0">• {tx.member.name}</span>}
                        {currentSubcat && (
                          <span className="inline-flex items-center gap-1 text-primary font-medium shrink-0">
                            <Tag className="w-3 h-3" />
                            {currentSubcat.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-semibold flex items-center justify-end gap-0.5 ${
                          tx.type === 'expense'
                            ? 'text-foreground'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {tx.type === 'expense' ? (
                          <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 inline" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 inline" />
                        )}
                        {formatBRL(tx.amount_cents)}
                      </span>
                    </div>
                  </div>

                  {/* Subcategory selection chips */}
                  {availableSubcategories.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1 font-medium">
                        <Tag className="w-3 h-3" /> Atribuir subcategoria:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {availableSubcategories.map((subcat) => {
                          const isSelected = tx.subcategory_id === subcat.id
                          return (
                            <button
                              key={subcat.id}
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleSubcategoryChange(tx, subcat.id)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary font-medium shadow-xs'
                                  : 'bg-muted/50 hover:bg-muted text-muted-foreground border-border hover:border-foreground/20'
                              } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                              <span>{subcat.name}</span>
                            </button>
                          )
                        })}
                        {tx.subcategory_id && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleSubcategoryChange(tx, null)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <DrawerFooter className="border-t border-border pt-2 pb-4">
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              Fechar
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
