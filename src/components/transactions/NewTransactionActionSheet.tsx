import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ArrowDownRight, ArrowUpRight, Mic, Sparkles, ChevronRight } from 'lucide-react'

interface NewTransactionActionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectExpense: () => void
  onSelectIncome: () => void
  onSelectVoiceAI: () => void
  onSelectRecurringIncomes?: () => void
  onSelectImportStatement?: () => void
}

export const NewTransactionActionSheet: React.FC<NewTransactionActionSheetProps> = ({
  open,
  onOpenChange,
  onSelectExpense,
  onSelectIncome,
  onSelectVoiceAI,
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
            Adicione uma despesa ou receita rapidamente no dia a dia da família.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3.5">
          {/* ================= CARD DE DESTAQUE (HERÓI DO MENU) ================= */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onSelectVoiceAI()
            }}
            className="w-full relative group overflow-hidden rounded-2xl bg-[#064E3B] hover:bg-[#053d2e] text-white p-4 sm:p-5 text-left shadow-lg shadow-emerald-950/20 border border-emerald-800 transition-all active:scale-[0.98]"
          >
            {/* Efeito de iluminação suave de fundo */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-white/15 text-white flex items-center justify-center shrink-0 border border-white/20 shadow-sm group-hover:scale-105 transition-transform">
                  <Mic className="w-6 h-6 text-emerald-300 stroke-[2.2]" />
                </div>

                <div className="min-w-0">
                  <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Falar Lançamento com IA
                  </span>
                  <p className="text-xs text-emerald-100/90 mt-1 line-clamp-2 leading-relaxed">
                    Fale naturalmente: &ldquo;Almoço, 45 reais, no débito&rdquo; ou &ldquo;Cerveja
                    na mercearia, 60 reais&rdquo;.
                  </p>
                </div>
              </div>

              <div className="shrink-0 pl-1 text-emerald-300 group-hover:translate-x-1 transition-transform">
                <ChevronRight className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>

            {/* Dica interativa no rodapé do herói */}
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-emerald-200/80">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                Interpretação inteligente
              </span>
              <span className="font-semibold text-emerald-300 underline">Toque para falar →</span>
            </div>
          </button>

          {/* ================= AÇÕES MANUAIS (LADO A LADO, COMPACTAS) ================= */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* CARD 1: NOVA DESPESA */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onSelectExpense()
              }}
              className="group relative flex flex-col items-start p-3.5 rounded-2xl bg-gradient-to-br from-red-50 to-rose-50/60 border border-red-200/80 hover:border-red-300 text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-sm"
            >
              <div className="w-10 h-10 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/25 mb-2.5 group-hover:scale-105 transition-transform">
                <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                🔴 Nova Despesa
              </span>
              <span className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                Gasto manual avulso
              </span>
            </button>

            {/* CARD 2: NOVA RECEITA */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onSelectIncome()
              }}
              className="group relative flex flex-col items-start p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200/80 hover:border-emerald-300 text-left transition-all active:scale-[0.98] shadow-2xs hover:shadow-sm"
            >
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25 mb-2.5 group-hover:scale-105 transition-transform">
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                🟢 Nova Receita
              </span>
              <span className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                Entrada manual avulsa
              </span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
