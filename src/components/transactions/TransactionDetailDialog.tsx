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
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg font-bold text-slate-900 leading-tight">
                  <span>{transaction.description || 'Transação'}</span>
                </DialogTitle>
                {transaction.is_recurring ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/70 px-2 py-0.5 rounded-full">
                    <span>Lançamento fixo mensal</span>
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-600">
                  {transaction.category ? (
                    <span>{transaction.category.name}</span>
                  ) : (
                    <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px] font-bold">
                      Pendente de categoria
                    </span>
                  )}
                </span>
                {transaction.subcategory ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                      <span>{transaction.subcategory.name}</span>
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Valor em destaque */}
        <div className="my-4 p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1 text-slate-500">
            {isIncome ? (
              <span className="inline-flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Receita</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4 text-red-600" />
                <span className="text-red-700">Despesa</span>
              </span>
            )}
          </div>
          <span
            className={`text-3xl font-extrabold tabular-nums ${
              isIncome ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            <span>{isIncome ? '+' : '−'} </span>
            <span>{formatBRL(transaction.amount_cents)}</span>
          </span>
        </div>

        {/* Informações detalhadas */}
        <div className="space-y-3 py-1 text-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span>Responsável</span>
            </span>
            <span className="font-semibold text-slate-800">
              <span>{transaction.member?.name || 'Membro da família'}</span>
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-500 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Data</span>
            </span>
            <span className="font-semibold text-slate-800">
              <span>
                {formatRelativeDate(transaction.transaction_date)} ({transaction.transaction_date})
              </span>
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
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
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
