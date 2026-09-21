import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ArrowDownRight, ArrowUpRight, Briefcase, UploadCloud, ChevronRight } from 'lucide-react'

interface NewTransactionActionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectExpense: () => void
  onSelectIncome: () => void
  onSelectRecurringIncomes: () => void
  onSelectImportStatement: () => void
}

export const NewTransactionActionSheet: React.FC<NewTransactionActionSheetProps> = ({
  open,
  onOpenChange,
  onSelectExpense,
  onSelectIncome,
  onSelectRecurringIncomes,
  onSelectImportStatement,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t border-slate-200/80 bg-white p-5 pb-7 sm:max-w-lg sm:mx-auto max-h-[90vh] overflow-y-auto"
      >
        {/* Barra superior de arraste suave para mobile */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 -mt-1 sm:hidden" />

        <SheetHeader className="text-left space-y-1 mb-4">
          <SheetTitle className="text-lg font-bold text-slate-900 tracking-tight">
            O que você deseja registrar?
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-500">
            Adicione uma transação rápida ou gerencie suas rendas fixas familiares.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* LANÇAMENTOS AVULSOS RÁPIDOS (DESTAQUE PRINCIPAL) */}
          <div className="grid grid-cols-2 gap-3">
            {/* CARD 1: DESPESA */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onSelectExpense()
              }}
              className="group relative flex flex-col items-start p-4 rounded-2xl bg-gradient-to-br from-red-50 to-rose-50/60 border border-red-200/80 hover:border-red-300 text-left transition-all active:scale-[0.98] shadow-xs hover:shadow-sm"
            >
              <div className="w-11 h-11 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/25 mb-3 group-hover:scale-105 transition-transform">
                <ArrowDownRight className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="text-base font-bold text-slate-900 leading-tight">Nova Despesa</span>
              <span className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                Gastos do dia a dia, compras ou contas pagas
              </span>
            </button>

            {/* CARD 2: RECEITA */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onSelectIncome()
              }}
              className="group relative flex flex-col items-start p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200/80 hover:border-emerald-300 text-left transition-all active:scale-[0.98] shadow-xs hover:shadow-sm"
            >
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25 mb-3 group-hover:scale-105 transition-transform">
                <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="text-base font-bold text-slate-900 leading-tight">Nova Receita</span>
              <span className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                Entradas avulsas, rendas extras ou reembolsos
              </span>
            </button>
          </div>

          {/* DIVISOR SUTIL COM TEXTO */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
              <span className="bg-white px-2">Outras opções</span>
            </div>
          </div>

          {/* ITENS SECUNDÁRIOS / RECORRENTES */}
          <div className="space-y-2">
            {/* ITEM 1: RECEITAS FIXAS (briefcase, emerald) */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onSelectRecurringIncomes()
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:bg-emerald-50/50 hover:border-emerald-300/80 transition-all text-left group active:scale-[0.99] shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/60 group-hover:scale-105 transition-transform">
                  <Briefcase className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">
                      Receitas fixas
                    </span>
                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full border border-emerald-200/70">
                      Recorrente
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    Salários, pró-labore e rendas mensais automáticas
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* ITEM 2: IMPORTAR EXTRATO */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onSelectImportStatement()
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-left group active:scale-[0.99] shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/70 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-slate-950 transition-colors">
                      Importar extrato
                    </span>
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full border border-slate-200">
                      OFX / CSV / PDF
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    Conciliação bancária automática em lote
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
