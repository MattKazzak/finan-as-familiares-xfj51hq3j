import React from 'react'
import { Check, Loader2, ArrowUpRight, ArrowDownRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/formatters'

interface ImportConfirmationFooterProps {
  totalCount: number
  selectedCount: number
  incomeSumCents: number
  expenseSumCents: number
  saving: boolean
  onConfirm: () => void
  declaredTotalCents?: number | null
  grossExpenseCents?: number
}

export const ImportConfirmationFooter: React.FC<ImportConfirmationFooterProps> = ({
  totalCount,
  selectedCount,
  incomeSumCents,
  expenseSumCents,
  saving,
  onConfirm,
  declaredTotalCents,
  grossExpenseCents,
}) => {
  const showGrossVsNet =
    typeof grossExpenseCents === 'number' &&
    grossExpenseCents > 0 &&
    grossExpenseCents !== expenseSumCents

  return (
    <footer className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-3 sm:px-6 py-2.5 sm:py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4">
        {/* Metadados e Totais (Entradas, Saídas e Seleção) */}
        <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-4 min-w-0 flex-wrap">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 block truncate">
              {selectedCount} de {totalCount}{' '}
              {totalCount === 1 ? 'lançamento selecionado' : 'lançamentos selecionados'}
            </span>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
              {declaredTotalCents ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/70">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Fatura: {formatBRL(declaredTotalCents)}
                </span>
              ) : (
                <span>Pronto para gravação no extrato</span>
              )}

              {showGrossVsNet ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                  Bruto: {formatBRL(grossExpenseCents)} • Líquido: {formatBRL(expenseSumCents)}
                </span>
              ) : null}
            </div>
          </div>

          {/* Somatórios em chips compactos perfeitamente legíveis em mobile */}
          <div className="flex items-center gap-1.5 shrink-0">
            {incomeSumCents > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                <ArrowUpRight className="w-3 h-3" />+{formatBRL(incomeSumCents)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
              <ArrowDownRight className="w-3 h-3" />−{formatBRL(expenseSumCents)}
            </span>
          </div>
        </div>

        {/* Botão de Confirmação da Importação */}
        <div className="shrink-0 flex items-center gap-2">
          <Button
            type="button"
            onClick={onConfirm}
            disabled={saving || selectedCount === 0}
            className="w-full sm:w-auto h-11 sm:h-10 px-5 text-xs sm:text-sm font-bold bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] rounded-xl shadow-md shadow-black/10 gap-2 transition-transform active:scale-[0.98] border-0"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>
                  Importar {selectedCount} {selectedCount === 1 ? 'lançamento' : 'lançamentos'}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </footer>
  )
}
