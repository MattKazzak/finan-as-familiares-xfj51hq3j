import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  UploadCloud,
  Mic,
  ChevronRight,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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
  const { toast } = useToast()

  const handleVoiceTextClick = () => {
    toast({
      title: 'Em breve!',
      description:
        'O lançamento por voz e inteligência de texto estará disponível em uma próxima atualização.',
    })
  }

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
            Adicione uma transação rápida, configure contas e rendas fixas ou importe extratos.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* DESTAQUE SUPERIOR, LADO A LADO */}
          <div className="grid grid-cols-2 gap-3">
            {/* CARD 1: NOVA DESPESA */}
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
                Gastos avulsos do dia a dia, compras ou contas pagas.
              </span>
            </button>

            {/* CARD 2: NOVA RECEITA */}
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
                Entradas avulsas, rendas extras ou reembolsos.
              </span>
            </button>
          </div>

          {/* SEÇÃO 2: RECORRÊNCIAS E AUTOMAÇÕES */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Recorrências e Automações
              </span>
              <div className="h-px bg-slate-100 flex-1" />
            </div>

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
                  <RefreshCw className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">
                      Contas & Rendas Recorrentes
                    </span>
                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full border border-emerald-200/70">
                      Mensal
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    Gerencie salários, aluguel e contas fixas mensais da família.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* SEÇÃO 3: IMPORTAÇÃO E INTELIGÊNCIA */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Importação e Inteligência
              </span>
              <div className="h-px bg-slate-100 flex-1" />
            </div>

            <div className="space-y-2">
              {/* ITEM 1: IMPORTAR EXTRATO */}
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
                        Importar Extrato
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      OFX, CSV ou PDF com conciliação automática.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
              </button>

              {/* ITEM 2: LANÇAMENTO POR VOZ / TEXTO COM BADGE 'EM BREVE / PREMIUM' */}
              <button
                type="button"
                onClick={handleVoiceTextClick}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/60 bg-slate-50/70 hover:bg-slate-100/80 transition-all text-left group active:scale-[0.99] shadow-2xs cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200/60 group-hover:scale-105 transition-transform">
                    <Mic className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                        Lançamento por Voz / Texto
                      </span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.2 rounded-full whitespace-nowrap">
                        Em Breve / Premium
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      Fale ou digite naturalmente: &ldquo;Gastei 50 no mercado hoje&rdquo;
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
