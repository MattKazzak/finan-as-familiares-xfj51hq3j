import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ArrowDownRight, ArrowUpRight, Repeat, ChevronRight } from 'lucide-react'

interface NewTransactionActionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectExpense: () => void
  onSelectIncome: () => void
  onSelectRecurringIncomes: () => void
  onSelectVoiceAI?: () => void
}

export const NewTransactionActionSheet: React.FC<NewTransactionActionSheetProps> = ({
  open,
  onOpenChange,
  onSelectExpense,
  onSelectIncome,
  onSelectRecurringIncomes,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t border-slate-200/90 bg-white p-5 pb-7 sm:max-w-lg sm:mx-auto max-h-[85vh] overflow-y-auto overflow-x-hidden min-w-0"
      >
        {/* Barra superior de arraste suave para mobile */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 -mt-1 sm:hidden" />

        <SheetHeader className="text-left space-y-1 mb-4">
          <SheetTitle className="text-lg font-bold text-slate-900 tracking-tight">
            O que você deseja registrar?
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-500">
            Adicione uma despesa, receita ou gerencie seus lançamentos fixos recorrentes.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          {/* ================= AÇÕES PRINCIPAIS (DESPESA E RECEITA) ================= */}
          <div className="grid grid-cols-2 gap-3">
            {/* CARD 1: NOVA DESPESA */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onSelectExpense()
              }}
              className="group relative flex flex-col items-start p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-red-50 to-rose-50/70 border border-red-200/90 hover:border-red-300 text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-sm cursor-pointer touch-manipulation"
            >
              <div className="w-10 h-10 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/25 mb-2.5 group-hover:scale-105 transition-transform shrink-0">
                <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Nova Despesa
              </span>
              <span className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                Gasto avulso ou parcelado
              </span>
            </button>

            {/* CARD 2: NOVA RECEITA */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onSelectIncome()
              }}
              className="group relative flex flex-col items-start p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-200/90 hover:border-emerald-300 text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-sm cursor-pointer touch-manipulation"
            >
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25 mb-2.5 group-hover:scale-105 transition-transform shrink-0">
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Nova Receita
              </span>
              <span className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                Entrada avulsa ou extra
              </span>
            </button>
          </div>

          {/* DIVISOR SUTIL */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200/80" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              <span className="bg-white px-2.5">Recorrentes</span>
            </div>
          </div>

          {/* ================= LANÇAMENTOS FIXOS / RECORRENTES ================= */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onSelectRecurringIncomes()
            }}
            className="w-full group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90 text-left transition-all active:scale-[0.99] shadow-2xs cursor-pointer touch-manipulation"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/70 group-hover:scale-105 transition-transform">
                <Repeat className="w-5 h-5 stroke-[2.3]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm sm:text-base font-bold text-slate-900 block leading-tight">
                  Lançamentos Fixos / Recorrentes 🔁
                </span>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  Gerenciar salários, aluguel, condomínio e assinaturas do mês
                </p>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
export default NewTransactionActionSheet
