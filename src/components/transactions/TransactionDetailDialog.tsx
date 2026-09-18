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
import type { Transaction } from '@/types/finance'
import { ArrowDownRight, ArrowUpRight, Calendar, User, Edit3, Trash2 } from 'lucide-react'

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
      <DialogContent className="max-w-md w-[95vw] rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm"
              style={{
                backgroundColor: transaction.category?.color || (isIncome ? '#10B981' : '#EF4444'),
              }}
            >
              <CategoryIcon name={transaction.category?.icon} className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 leading-tight">
                {transaction.description || 'Transação'}
              </DialogTitle>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-600">
                  {transaction.category?.name || 'Sem categoria'}
                </span>
                {transaction.subcategory && (
                  <>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                      {transaction.subcategory.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Valor em destaque */}
        <div className="my-4 p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1 text-slate-500">
            {isIncome ? (
              <>
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Receita</span>
              </>
            ) : (
              <>
                <ArrowDownRight className="w-4 h-4 text-red-600" />
                <span className="text-red-700">Despesa</span>
              </>
            )}
          </div>
          <span
            className={`text-3xl font-extrabold tabular-nums ${
              isIncome ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {isIncome ? '+' : '−'} {formatBRL(transaction.amount_cents)}
          </span>
        </div>

        {/* Informações detalhadas */}
        <div className="space-y-3 py-1 text-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              Responsável
            </span>
            <span className="font-semibold text-slate-800">
              {transaction.member?.name || 'Membro da família'}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              Data
            </span>
            <span className="font-semibold text-slate-800">
              {formatRelativeDate(transaction.transaction_date)} ({transaction.transaction_date})
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
            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onEdit(transaction)
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
