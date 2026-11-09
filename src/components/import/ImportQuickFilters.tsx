import React from 'react'
import {
  Filter,
  Sparkles,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  CheckSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export type QuickFilterType =
  | 'all'
  | 'pending_category'
  | 'low_confidence'
  | 'expenses'
  | 'incomes'
  | 'duplicates'

interface ImportQuickFiltersProps {
  currentFilter: QuickFilterType
  onSelectFilter: (filter: QuickFilterType) => void
  sortByConfidence: boolean
  onToggleSortByConfidence: () => void
  counts: {
    total: number
    pendingCategory: number
    lowConfidence: number
    expenses: number
    incomes: number
    duplicates: number
  }
}

export const ImportQuickFilters: React.FC<ImportQuickFiltersProps> = ({
  currentFilter,
  onSelectFilter,
  sortByConfidence,
  onToggleSortByConfidence,
  counts,
}) => {
  const filters: Array<{
    id: QuickFilterType
    label: string
    count: number
    icon?: React.ReactNode
    badgeVariant?: 'default' | 'amber'
  }> = [
    {
      id: 'all',
      label: 'Todos',
      count: counts.total,
    },
    {
      id: 'pending_category',
      label: 'Sem Categoria',
      count: counts.pendingCategory,
      badgeVariant: 'amber',
    },
    {
      id: 'low_confidence',
      label: 'IA Incerta',
      count: counts.lowConfidence,
      icon: <Sparkles className="w-3 h-3 text-action" strokeWidth={1.5} />,
      badgeVariant: 'default',
    },
    {
      id: 'expenses',
      label: 'Saídas',
      count: counts.expenses,
      icon: <ArrowDownRight className="w-3 h-3 text-expense" strokeWidth={1.5} />,
    },
    {
      id: 'incomes',
      label: 'Entradas',
      count: counts.incomes,
      icon: <ArrowUpRight className="w-3 h-3 text-income" strokeWidth={1.5} />,
    },
    ...(counts.duplicates > 0
      ? [
          {
            id: 'duplicates' as QuickFilterType,
            label: 'Duplicadas',
            count: counts.duplicates,
            icon: <AlertCircle className="w-3 h-3 text-action" strokeWidth={1.5} />,
            badgeVariant: 'amber' as const,
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-line">
      {/* Scroll horizontal de chips de filtros rápidos (mobile-first sem scrollbar feia) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
        {filters.map((f) => {
          const isActive = currentFilter === f.id
          return (
            <button
              type="button"
              key={f.id}
              onClick={() => onSelectFilter(f.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-ink text-white shadow-xs'
                  : 'bg-surface text-body hover:bg-surface-2 border border-line'
              }`}
            >
              {f.icon}
              <span>{f.label}</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-white/25 text-white'
                    : f.badgeVariant === 'amber'
                      ? 'bg-amber-50 text-amber-900 border border-action/30'
                      : 'bg-muted/70 text-body2 border border-border/30'
                }`}
              >
                {f.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Ordenação por confiança da IA */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleSortByConfidence}
          className={`h-7 px-2.5 rounded-xl text-xs font-semibold gap-1.5 ${
            sortByConfidence ? 'bg-muted/80 text-ink border-line' : 'text-body border-line'
          }`}
          title="Itens com menor certeza ou sem categoria aparecem primeiro"
        >
          <Sparkles className="w-3 h-3 text-action" strokeWidth={1.5} />
          <span>{sortByConfidence ? 'Ordenado por incerteza' : 'Priorizar incertos'}</span>
        </Button>
      </div>
    </div>
  )
}
