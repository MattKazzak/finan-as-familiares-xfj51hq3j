import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export interface CategoryDonutItem {
  id: string
  name: string
  amountCents: number
}

interface CategoryExpensesDonutProps {
  items: CategoryDonutItem[]
  totalCents: number
  loading?: boolean
  formatValue: (cents: number) => string
}

// Cores de dados do sistema (tokens CDS), na ordem da legenda
const DATA_STROKES = [
  'var(--data-1)',
  'var(--data-2)',
  'var(--data-3)',
  'var(--data-4)',
  'var(--data-5)',
  'var(--data-6)',
]
const DATA_DOTS = ['bg-data-1', 'bg-data-2', 'bg-data-3', 'bg-data-4', 'bg-data-5', 'bg-data-6']

const VIEW = 120
const RADIUS = 50
const STROKE = 12
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 1.5 // folga entre fatias (em unidades do viewBox)
const TRACK_CLASS = 'stroke-surface-2'

const ARC_TRANSITION =
  'stroke-dasharray 600ms ease-out, stroke-dashoffset 600ms ease-out, stroke-width 200ms ease-out, opacity 200ms ease-out'

export function CategoryExpensesDonut({
  items,
  totalCents,
  loading = false,
  formatValue,
}: CategoryExpensesDonutProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex items-center gap-4 pt-3 border-t border-line/60">
        <Skeleton className="w-[132px] h-[132px] rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const isEmpty = items.length === 0 || totalCents <= 0

  // Fatias: cada categoria ocupa sua fração do total; o restante (fora do top) fica neutro
  let cursor = 0
  const arcs = items.map((item, index) => {
    const fraction = totalCents > 0 ? item.amountCents / totalCents : 0
    const span = fraction * CIRCUMFERENCE
    const gap = items.length > 1 ? GAP : 0
    const arc = {
      id: item.id,
      stroke: DATA_STROKES[index % DATA_STROKES.length],
      length: Math.max(span - gap, 0),
      start: cursor + gap / 2,
    }
    cursor += span
    return arc
  })
  const listedCents = items.reduce((sum, item) => sum + item.amountCents, 0)
  const restCents = Math.max(totalCents - listedCents, 0)
  const restLength = totalCents > 0 ? (restCents / totalCents) * CIRCUMFERENCE : 0

  const hasSelection = selectedId !== null

  const toggle = (id: string) => setSelectedId((current) => (current === id ? null : id))

  return (
    <div className="space-y-4 pt-3 border-t border-line/60">
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative w-[132px] h-[132px] shrink-0">
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="w-full h-full -rotate-90"
            role="img"
            aria-label="Gráfico de rosca dos gastos por categoria"
          >
            <circle
              cx={VIEW / 2}
              cy={VIEW / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className={TRACK_CLASS}
              style={{ transition: ARC_TRANSITION }}
            />
            {!isEmpty &&
              arcs.map((arc) => {
                const selected = selectedId === arc.id
                const dimmed = hasSelection && !selected
                return (
                  <circle
                    key={arc.id}
                    cx={VIEW / 2}
                    cy={VIEW / 2}
                    r={RADIUS}
                    fill="none"
                    strokeWidth={selected ? STROKE + 4 : STROKE}
                    strokeDasharray={`${arc.length} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-arc.start}
                    opacity={dimmed ? 0.3 : 1}
                    className="cursor-pointer"
                    style={{ stroke: arc.stroke, transition: ARC_TRANSITION }}
                    onClick={() => toggle(arc.id)}
                  />
                )
              })}
            {!isEmpty && restLength > 0 && (
              <circle
                cx={VIEW / 2}
                cy={VIEW / 2}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                className={TRACK_CLASS}
                strokeDasharray={`${restLength} ${CIRCUMFERENCE}`}
                strokeDashoffset={-(CIRCUMFERENCE - restLength)}
                style={{ transition: ARC_TRANSITION }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center pointer-events-none">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-body3 leading-none">
              Total do mês
            </span>
            <span className="mt-1 max-w-full truncate text-[11px] sm:text-xs font-bold text-ink tabular-nums leading-tight">
              {formatValue(totalCents)}
            </span>
          </div>
        </div>

        {isEmpty ? (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-body">Nenhum gasto registrado neste mês</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Suas despesas aparecerão organizadas por categorias aqui.
            </p>
          </div>
        ) : (
          <ul className="flex-1 min-w-0 space-y-1">
            {items.map((item, index) => {
              const selected = selectedId === item.id
              const percent = totalCents > 0 ? Math.round((item.amountCents / totalCents) * 100) : 0
              return (
                <li key={item.id} className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(item.id)}
                    className={cn(
                      'w-full min-w-0 text-left rounded-xl px-2 py-1.5 transition-colors',
                      'hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30',
                      selected && 'bg-surface-2',
                      hasSelection && !selected && 'opacity-60',
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          'w-2.5 h-2.5 rounded-[4px] shrink-0',
                          DATA_DOTS[index % DATA_DOTS.length],
                        )}
                      />
                      <span className="flex-1 min-w-0 truncate text-xs font-semibold text-ink">
                        {item.name}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2 pl-[16px] mt-0.5 text-[11px] tabular-nums">
                      <span className="min-w-0 truncate text-ink">
                        {formatValue(item.amountCents)}
                      </span>
                      <span className="shrink-0 font-medium text-body3">{percent}%</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
