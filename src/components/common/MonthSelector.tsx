import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonthYear } from '@/lib/formatters'
import { useActiveMonth, getSouthernHemisphereSeason } from '@/contexts/ActiveMonthContext'

export interface MonthSelectorProps {
  className?: string
  /**
   * Se true, oculta ou ajusta para variantes compactas caso necessário
   */
  variant?: 'default' | 'compact'
  /**
   * Elemento adicional opcional à direita (ex.: botão de importação na Carteira)
   */
  children?: React.ReactNode
}

/**
 * MonthSelector: Seletor único e reutilizável de mês no topo de Home, Transações e Orçamentos.
 *
 * Características:
 * - Lê e escreve no `activeMonth` global (ActiveMonthContext).
 * - Mês em destaque (ex.: "Outubro 2026").
 * - Abaixo, em texto pequeno, a estação do hemisfério sul (ex.: "Primavera").
 *   "O mês manda; a estação é detalhe."
 * - Limite: botão de próximo mês fica desabilitado quando activeMonth >= mês atual do sistema.
 * - Paleta CDS v1.0: texto #14213D, detalhes em âmbar #FCA311 no estado ativo, sem overflow horizontal.
 */
export function MonthSelector({
  className = '',
  variant = 'default',
  children,
}: MonthSelectorProps) {
  const { activeDate, prevMonth, nextMonth, isNextMonthDisabled } = useActiveMonth()

  // Estação do Hemisfério Sul baseada no mês atual (1 a 12)
  const monthNum = activeDate.getMonth() + 1
  const season = getSouthernHemisphereSeason(monthNum)
  const formattedMonth = formatMonthYear(activeDate)

  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 ${className}`}>
      <div
        className="inline-flex items-center gap-1 sm:gap-2 bg-white px-2 sm:px-3 py-1.5 rounded-2xl border border-slate-200/80 shadow-2xs touch-manipulation max-w-full"
        role="group"
        aria-label="Seletor de mês"
      >
        {/* Botão Mês Anterior */}
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 hover:bg-slate-100 active:scale-95 rounded-xl text-slate-600 hover:text-[#14213D] transition-all cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
          title="Mês anterior"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Mês em destaque + Estação abaixo */}
        <div className="flex flex-col items-center justify-center px-1 sm:px-2 min-w-[130px] sm:min-w-[145px] text-center select-none">
          <span className="font-bold text-xs sm:text-sm text-[#14213D] tracking-tight leading-tight">
            {formattedMonth}
          </span>
          <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
            {season}
          </span>
        </div>

        {/* Botão Próximo Mês (com limite de mês futuro além do mês atual) */}
        <button
          type="button"
          onClick={nextMonth}
          disabled={isNextMonthDisabled}
          className={`p-1.5 rounded-xl transition-all touch-manipulation ${
            isNextMonthDisabled
              ? 'text-slate-300 cursor-not-allowed opacity-40'
              : 'text-slate-600 hover:text-[#14213D] hover:bg-slate-100 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]'
          }`}
          title={isNextMonthDisabled ? 'Limite atingido (mês atual)' : 'Próximo mês'}
          aria-label="Próximo mês"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Conteúdo adicional opcional (ex.: botão de importação OFX/PDF) */}
      {children}
    </div>
  )
}
