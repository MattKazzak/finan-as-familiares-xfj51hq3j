import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonthYear } from '@/lib/formatters'
import { useActiveMonth } from '@/contexts/ActiveMonthContext'

export interface MonthSelectorProps {
  className?: string
  /**
   * 'chip': Variante compacta para cabeçalho integrado (Home) — formato "Mês Ano" com setas discretas
   * 'default': Variante padrão com botões laterais (Carteira/Orçamentos)
   */
  variant?: 'default' | 'chip' | 'compact'
  /**
   * 'dark': estilo com fundo translúcido escuro e texto claro (para herói marinho sangrado)
   * 'light': estilo claro padrão
   */
  theme?: 'light' | 'dark'
  /**
   * Elemento adicional opcional à direita ou abaixo (ex.: botão de importação na Carteira)
   */
  children?: React.ReactNode
}

/**
 * MonthSelector: Seletor único e reutilizável de mês no topo de Home, Transações e Orçamentos.
 *
 * Características:
 * - Lê e escreve no `activeMonth` global (ActiveMonthContext).
 * - Sincronizado nas 3 abas sem perder estado.
 * - Variante 'chip': chip compacto integrado ao cabeçalho da Home com setas discretas.
 * - Limite: botão de próximo mês fica desabilitado quando activeMonth >= mês atual do sistema.
 * - Paleta CDS v1.0: texto #14213D, secundário #64748B, detalhes discretos, sem overflow horizontal.
 */
export function MonthSelector({
  className = '',
  variant = 'default',
  theme = 'light',
  children,
}: MonthSelectorProps) {
  const { activeDate, prevMonth, nextMonth, isNextMonthDisabled } = useActiveMonth()

  const formattedMonth = formatMonthYear(activeDate)
  const isDark = theme === 'dark'

  if (variant === 'chip') {
    return (
      <div className={`inline-flex items-center gap-1.5 max-w-full ${className}`}>
        <div
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-2xl touch-manipulation max-w-full transition-colors ${
            isDark
              ? 'bg-white/10 border border-white/15 text-white shadow-sm'
              : 'bg-white border border-slate-200/80 text-[#14213D] shadow-2xs'
          }`}
          role="group"
          aria-label="Seletor de mês"
        >
          {/* Botão Mês Anterior Discreto */}
          <button
            type="button"
            onClick={prevMonth}
            className={`p-1 active:scale-95 rounded-xl transition-all cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311] ${
              isDark
                ? 'text-white/80 hover:text-white hover:bg-white/15'
                : 'text-slate-500 hover:text-[#14213D] hover:bg-slate-100'
            }`}
            title="Mês anterior"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Mês em texto compacto */}
          <span
            className={`font-semibold text-xs sm:text-sm tracking-tight px-1 select-none whitespace-nowrap ${
              isDark ? 'text-white' : 'text-[#14213D]'
            }`}
          >
            {formattedMonth}
          </span>

          {/* Botão Próximo Mês Discreto */}
          <button
            type="button"
            onClick={nextMonth}
            disabled={isNextMonthDisabled}
            className={`p-1 rounded-xl transition-all touch-manipulation ${
              isNextMonthDisabled
                ? isDark
                  ? 'text-white/20 cursor-not-allowed opacity-40'
                  : 'text-slate-300 cursor-not-allowed opacity-40'
                : isDark
                  ? 'text-white/80 hover:text-white hover:bg-white/15 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]'
                  : 'text-slate-500 hover:text-[#14213D] hover:bg-slate-100 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]'
            }`}
            title={isNextMonthDisabled ? 'Limite atingido (mês atual)' : 'Próximo mês'}
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {children}
      </div>
    )
  }

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

        {/* Mês em destaque */}
        <div className="flex flex-col items-center justify-center px-1 sm:px-2 min-w-[120px] sm:min-w-[130px] text-center select-none">
          <span className="font-bold text-xs sm:text-sm text-[#14213D] tracking-tight leading-tight">
            {formattedMonth}
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
