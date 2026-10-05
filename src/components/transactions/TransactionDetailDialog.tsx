import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatBRL, formatRelativeDate } from '@/lib/formatters'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { formatTransactionTitle } from '@/services/installments'
import type { Transaction } from '@/types/finance'
import { ArrowDownRight, ArrowUpRight, Calendar, User, Edit3, Trash2, Sparkles } from 'lucide-react'

interface TransactionDetailDialogProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}

export const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = ({
  transaction,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}) => {
  if (!transaction) return null

  const isIncome = transaction.type === 'income'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] rounded-3xl p-6 bg-card/95 backdrop-blur-sm border border-border/40 shadow-curiango">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
              <CategoryIcon
                name={transaction.category?.icon}
                className="w-4 h-4"
                strokeWidth={1.5}
              />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-semibold text-[#14213D] dark:text-white leading-tight">
                  <span>{formatTransactionTitle(transaction)}</span>
                </DialogTitle>
                {transaction.is_recurring ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-[#059669] border border-emerald-300/70 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3" />
                    <span>Fixa</span>
                  </span>
                ) : null}
                {transaction.status === 'projected' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300/70 px-2 py-0.5 rounded-full">
                    <span>Previsto</span>
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground">
                  {transaction.category ? (
                    <span>{transaction.category.name}</span>
                  ) : (
                    <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                      Pendente de categoria
                    </span>
                  )}
                </span>
                {transaction.subcategory && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs font-medium text-[#14213D] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-border/40">
                      {transaction.subcategory.name}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Bloco de Valor em Destaque CDS */}
        <div className="my-4 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-border/40 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1 text-muted-foreground">
            {isIncome ? (
              <span className="inline-flex items-center gap-1.5 text-[#059669]">
                <ArrowUpRight className="w-4 h-4 text-[#059669]" strokeWidth={1.5} />
                <span>Receita</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[#E11D48]">
                <ArrowDownRight className="w-4 h-4 text-[#E11D48]" strokeWidth={1.5} />
                <span>Despesa</span>
              </span>
            )}
          </div>
          <span
            className={`text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums ${
              isIncome ? 'text-[#059669]' : 'text-[#E11D48]'
            }`}
          >
            <span>
              {isIncome ? '+' : '−'} {formatBRL(transaction.amount_cents)}
            </span>
          </span>
        </div>

        {/* Detalhes do Lançamento */}
        <div className="space-y-3 py-1 text-sm">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <span className="text-muted-foreground flex items-center gap-2 text-xs">
              <User className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              <span>Responsável</span>
            </span>
            <span className="font-medium text-xs sm:text-sm text-[#14213D] dark:text-white">
              {transaction.member?.name || 'Família'}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <span className="text-muted-foreground flex items-center gap-2 text-xs">
              <Calendar className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              <span>Data da transação</span>
            </span>
            <span className="font-medium text-xs sm:text-sm text-[#14213D] dark:text-white">
              {formatRelativeDate(transaction.transaction_date)}
            </span>
          </div>
        </div>

        <DialogFooter className="mt-4 flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              onDelete(transaction)
            }}
            className="flex-1 text-[#E11D48] hover:text-[#be123c] hover:bg-rose-50 border-rose-200/60 rounded-xl text-xs"
          >
            <span className="flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" />
              <span>Excluir</span>
            </span>
          </Button>

          <Button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onEdit(transaction)
            }}
            className="flex-1 bg-[#14213D] hover:bg-[#1f2f54] text-white font-semibold rounded-xl text-xs border-0"
          >
            <span className="flex items-center justify-center gap-2">
              <Edit3 className="w-4 h-4" />
              <span>Editar</span>
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
