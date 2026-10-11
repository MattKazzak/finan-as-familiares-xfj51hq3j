import React from 'react'
import { ChevronLeft, ChevronRight, Flower2, Sun, Leaf, Snowflake } from 'lucide-react'
import { formatMonthYear } from '@/lib/formatters'
import { useActiveMonth, getSouthernHemisphereSeason } from '@/contexts/ActiveMonthContext'

export interface MonthSelectorProps {
  className?: string
  /**
   * 'chip': Variante compacta para cabeçalho integrado (Home) — formato "Mês Ano ▾" ou setas discretas
   * 'default': Variante padrão com botões laterais (Carteira/Orçamentos)
   */
  variant?: 'default' | 'chip' | 'compact'
  /**
   * Elemento adicional opcional à direita ou abaixo (ex.: botão de importação na Carteira)
   */
  children?: React.ReactNode
}

/**
 * Retorna as propriedades visuais da estação no Hemisfério Sul:
 * - Ícone temático (Lucide)
 * - Nome amigável
 * - Classes de cores suaves em tom pastel (CDS v1.0: nunca saturado)
 */
export function getSeasonVisuals(season: string) {
  switch (season) {
    case 'Primavera':
      return {
        Icon: Flower2,
        name: 'Primavera',
        textColor: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200/60',
        iconColor: 'text-emerald-500',
      }
    case 'Verão':
      return {
        Icon: Sun,
        name: 'Verão',
        textColor: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200/60',
        iconColor: 'text-amber-500',
      }
    case 'Outono':
      return {
        Icon: Leaf,
        name: 'Outono',
        textColor: 'text-orange-700',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200/60',
        iconColor: 'text-orange-500',
      }
    case 'Inverno':
    default:
      return {
        Icon: Snowflake,
        name: 'Inverno',
        textColor: 'text-sky-700',
        bgColor: 'bg-sky-50',
        borderColor: 'border-sky-200/60',
        iconColor: 'text-sky-500',
      }
  }
}

/**
 * MonthSelector: Seletor único e reutilizável de mês no topo de Home, Transações e Orçamentos.
 *
 * Características:
 * - Lê e escreve no `activeMonth` global (ActiveMonthContext).
 * - Sincronizado nas 3 abas sem perder estado.
 * - Variante 'chip': chip compacto integrado ao cabeçalho da Home com setas discretas + estação com ícone pastel.
 * - Limite: botão de próximo mês fica desabilitado quando activeMonth >= mês atual do sistema.
 * - Paleta CDS v1.0: texto #14213D, secundário #64748B, detalhes discretos, sem overflow horizontal.
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
  const seasonInfo = getSeasonVisuals(season)
  const formattedMonth = formatMonthYear(activeDate)
  const SeasonIcon = seasonInfo.Icon

  if (variant === 'chip') {
    return (
      <div className={`inline-flex items-center gap-1.5 max-w-full ${className}`}>
        <div
          className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-2xl border border-slate-200/80 shadow-2xs touch-manipulation max-w-full"
          role="group"
          aria-label="Seletor de mês"
        >
          {/* Botão Mês Anterior Discreto */}
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 hover:bg-slate-100 active:scale-95 rounded-xl text-slate-500 hover:text-[#14213D] transition-all cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
            title="Mês anterior"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Mês em texto compacto */}
          <span className="font-semibold text-xs sm:text-sm text-[#14213D] tracking-tight px-1 select-none whitespace-nowrap">
            {formattedMonth}
          </span>

          {/* Botão Próximo Mês Discreto */}
          <button
            type="button"
            onClick={nextMonth}
            disabled={isNextMonthDisabled}
            className={`p-1 rounded-xl transition-all touch-manipulation ${
              isNextMonthDisabled
                ? 'text-slate-300 cursor-not-allowed opacity-40'
                : 'text-slate-500 hover:text-[#14213D] hover:bg-slate-100 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]'
            }`}
            title={isNextMonthDisabled ? 'Limite atingido (mês atual)' : 'Próximo mês'}
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Estação com Ícone e Tom Pastel Suave (Personalidade elegante, sem competir) */}
        <div
          className={`hidden xs:inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border select-none ${seasonInfo.bgColor} ${seasonInfo.textColor} ${seasonInfo.borderColor}`}
          title={`Estação no Hemisfério Sul: ${seasonInfo.name}`}
          aria-label={`Estação: ${seasonInfo.name}`}
        >
          <SeasonIcon className={`w-3 h-3 ${seasonInfo.iconColor}`} strokeWidth={1.5} />
          <span>{seasonInfo.name}</span>
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

        {/* Mês em destaque + Estação com ícone pastel abaixo */}
        <div className="flex flex-col items-center justify-center px-1 sm:px-2 min-w-[130px] sm:min-w-[145px] text-center select-none">
          <span className="font-bold text-xs sm:text-sm text-[#14213D] tracking-tight leading-tight">
            {formattedMonth}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <SeasonIcon className={`w-2.5 h-2.5 ${seasonInfo.iconColor}`} strokeWidth={1.5} />
            <span className={`text-[10px] font-medium leading-none ${seasonInfo.textColor}`}>
              {season}
            </span>
          </div>
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
