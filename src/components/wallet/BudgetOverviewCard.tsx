import { useState } from 'react'
import { Sparkles, CheckCircle2, Shield, Palmtree, Target, Info } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu'
import { formatBRL } from '@/lib/formatters'
import { getBudgetModelTargets } from '@/services/budget-model'
import type { Family } from '@/types/finance'

export interface BucketStat {
  budgetCents: number
  spentCents: number
  percentIncome: number
}

export interface BucketsSummaryData {
  essentials: BucketStat
  lifestyle: BucketStat
  future: BucketStat
  other: BucketStat
}

export interface BudgetOverviewCardProps {
  /** Receita já recebida no mês ativo (alimenta o anel de previsto vs realizado) */
  monthIncomeCents?: number
  family: Family | null
  bucketsSummary: BucketsSummaryData
  totalBudget: number
  totalBudgetPercentOfIncome: number
  totalSpent: number
  currentDate: Date
  monthKey: string
  categoryList: Array<{
    category: {
      id: string
      name: string
      budget_bucket?: string | null
    }
    limitCents: number
    spentCents: number
    percent: number
    isOver: boolean
  }>
  onOpenModelDialog: () => void
}

interface BucketMetaInfo {
  key: 'essentials' | 'lifestyle' | 'future'
  label: string
  sublabel: string
  colorName: string
  barColor: string
  barHoverColor: string
  bgLight: string
  borderLight: string
  textDark: string
  badgeBg: string
  accentDot: string
  icon: typeof Shield
}

const BUCKETS_CONFIG: BucketMetaInfo[] = [
  {
    key: 'essentials',
    label: 'Gastos Essenciais',
    sublabel: 'Moradia, Alimentação, Transporte, Saúde, Educação',
    colorName: 'slate',
    barColor: 'bg-[#14213D]',
    barHoverColor: 'hover:bg-[#1a2b50]',
    bgLight: 'bg-slate-50/90',
    borderLight: 'border-slate-200',
    textDark: 'text-slate-900',
    badgeBg: 'bg-slate-200/80 text-slate-800',
    accentDot: 'bg-[#14213D]',
    icon: Shield,
  },
  {
    key: 'lifestyle',
    label: 'Estilo de Vida',
    sublabel: 'Lazer, Compras, Assinaturas, Cuidados & Bem-estar',
    colorName: 'amber',
    barColor: 'bg-[#FCA311]',
    barHoverColor: 'hover:bg-[#e5940f]',
    bgLight: 'bg-amber-50/50',
    borderLight: 'border-amber-200/60',
    textDark: 'text-amber-950',
    badgeBg: 'bg-amber-100/80 text-amber-900',
    accentDot: 'bg-[#FCA311]',
    icon: Palmtree,
  },
  {
    key: 'future',
    label: 'Futuro & Metas',
    sublabel: 'Reserva de Emergência, Aportes, Investimentos & Sonhos',
    colorName: 'emerald',
    barColor: 'bg-[#10B981]',
    barHoverColor: 'hover:bg-[#059669]',
    bgLight: 'bg-emerald-50/50',
    borderLight: 'border-emerald-200/60',
    textDark: 'text-emerald-950',
    badgeBg: 'bg-emerald-100/80 text-emerald-900',
    accentDot: 'bg-[#10B981]',
    icon: Target,
  },
]

export type AlertSeverity = 'red' | 'amber' | 'green'

export interface SummaryAlert {
  id: string
  severity: AlertSeverity
  categoryName: string
  bucketKey?: string
  title: string
  detail: string
  metric?: string
  priority: number // quanto menor, mais urgente
}

export function BudgetOverviewCard({
  family,
  bucketsSummary,
  totalBudget,
  totalBudgetPercentOfIncome,
  totalSpent,
  currentDate,
  monthKey,
  categoryList: _categoryList,
  onOpenModelDialog,
  monthIncomeCents = 0,
}: BudgetOverviewCardProps) {
  const [selectedBucket, setSelectedBucket] = useState<
    'all' | 'essentials' | 'lifestyle' | 'future'
  >('all')

  const netIncomeCents = family?.monthly_net_income_cents || 0

  // Anel de Receitas Previstas (migrado da Home em 16/10 — aqui tem contexto de renda):
  // % da renda líquida já recebida no mês ativo.
  const incomeProgressPercent =
    netIncomeCents > 0
      ? Math.min(100, Math.max(0, Math.round((monthIncomeCents / netIncomeCents) * 100)))
      : 0
  const incomeRingOffset = 251.32 - (251.32 * incomeProgressPercent) / 100

  // Cálculo proporcional para a barra única segmentada
  const sumBudgets =
    bucketsSummary.essentials.budgetCents +
    bucketsSummary.lifestyle.budgetCents +
    bucketsSummary.future.budgetCents

  // Se houver tetos nos baldes, distribuímos pela proporção real dos baldes.
  // Caso contrário, se tiver renda e percentIncome, usamos percentIncome.
  // Caso todos sejam zero, usamos uma proporção de placeholder elegante (50/30/20) mas desbotada
  const hasBudgetData = sumBudgets > 0
  const essentialsWidth = hasBudgetData
    ? (bucketsSummary.essentials.budgetCents / sumBudgets) * 100
    : 50
  const lifestyleWidth = hasBudgetData
    ? (bucketsSummary.lifestyle.budgetCents / sumBudgets) * 100
    : 30
  const futureWidth = hasBudgetData ? (bucketsSummary.future.budgetCents / sumBudgets) * 100 : 20

  const isOverIncome = totalBudgetPercentOfIncome > 100

  return (
    <section className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 sm:p-8 border border-[rgba(20,33,61,0.06)] shadow-elevation-1 relative overflow-hidden transition-all">
      {/* Sutil detalhe superior fluido com a paleta oficial */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#14213D] via-[#FCA311] to-[#10B981]" />

      {/* CABEÇALHO DO PAINEL FLUÍDO: Renda Líquida + anel de previsto (migrado da Home 16/10) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-4 min-w-0">
          {/* Anel: % da renda líquida já recebida no mês (Receitas Previstas) */}
          {netIncomeCents > 0 && (
            <div
              className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0"
              aria-label={`Recebido ${incomeProgressPercent}% da renda prevista`}
              role="progressbar"
              aria-valuenow={incomeProgressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="text-slate-100 stroke-current"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="text-emerald-500 stroke-current transition-all duration-700 ease-out"
                  strokeWidth="10"
                  strokeDasharray="251.32"
                  strokeDashoffset={incomeRingOffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm sm:text-base font-bold text-[#14213D] dark:text-white tabular-nums leading-none">
                  {incomeProgressPercent}%
                </span>
                <span className="text-[8px] text-slate-400 font-medium mt-0.5">da renda</span>
              </div>
            </div>
          )}

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Receitas Previstas
              </span>
              {isOverIncome ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-[#E11D48] border border-rose-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] animate-pulse" />
                  Tetos acima da renda
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-[#059669] border border-emerald-200/60">
                  <CheckCircle2 className="w-3 h-3 text-[#059669]" />
                  Tetos saudáveis
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2 flex-wrap pt-0.5">
              <span className="text-xs text-muted-foreground font-medium">Recebido:</span>
              <span className="text-xl sm:text-2xl font-semibold text-[#14213D] dark:text-white tracking-tight tabular-nums">
                {formatBRL(monthIncomeCents)}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                de {formatBRL(netIncomeCents)} previstos
              </span>
            </div>
          </div>
        </div>
        {/* Botão de ajuste de perfil / renda + metodologia (ℹ️ movido do cabeçalho
            superior removido — 18/10, decisão do Matheus: 1 fonte de verdade) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md transition-colors"
                aria-label="Sobre a metodologia de orçamento"
                title="Sobre a metodologia"
              >
                <Info className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-w-xs p-3 text-xs leading-relaxed">
              Tetos baseados em percentuais da renda líquida familiar. Os modelos seguem
              metodologias consagradas como a 50/30/20 (Elizabeth Warren) e variações para perfis de
              família — com liberdade total de personalização.
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={onOpenModelDialog}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14213D] bg-slate-100 hover:bg-slate-200/70 border border-border/60 px-3 py-1.5 rounded-xl transition-all shadow-2xs hover:shadow-xs active:scale-95"
            title="Ajustar renda líquida familiar ou trocar modelo de distribuição"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FCA311]" />
            <span>Ajustar modelo / Renda</span>
          </button>
        </div>
      </div>

      {/* SEÇÃO DA BARRA SEGMENTADA CONTÍNUA & PROPORCIONAL */}
      <div className="pt-6 space-y-3.5">
        <div className="flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Distribuição Proporcional dos Baldes
            </span>
            <span className="text-[11px] text-muted-foreground hidden xs:inline">
              (toque no balde para filtrar alertas)
            </span>
          </div>
        </div>

        {/* A BARRA ÚNICA MULTI-SEGMENTADA COM GRADIENTES SUTIS */}
        <div className="relative">
          <div className="h-5 sm:h-6 w-full rounded-2xl p-1 bg-slate-100/90 flex items-center gap-1 overflow-hidden shadow-inner border border-[rgba(20,33,61,0.04)]">
            {/* Segmento Essenciais */}
            <button
              type="button"
              onClick={() =>
                setSelectedBucket((prev) => (prev === 'essentials' ? 'all' : 'essentials'))
              }
              style={{ width: `${Math.max(essentialsWidth, 6)}%` }}
              title={`Essenciais: ${bucketsSummary.essentials.percentIncome}% da renda (${formatBRL(bucketsSummary.essentials.budgetCents)})`}
              className={`h-full rounded-xl transition-all relative group flex items-center justify-center overflow-hidden cursor-pointer bg-gradient-to-r from-[#14213D] to-[#1f3159] hover:brightness-110 ${
                selectedBucket === 'essentials' ? 'ring-2 ring-slate-800 ring-offset-1 z-10' : ''
              } ${selectedBucket !== 'all' && selectedBucket !== 'essentials' ? 'opacity-40' : 'opacity-100'}`}
            >
              <span className="text-[10px] font-bold text-white truncate px-1 drop-shadow-2xs select-none">
                {bucketsSummary.essentials.percentIncome}%
              </span>
            </button>

            {/* Segmento Estilo de Vida */}
            <button
              type="button"
              onClick={() =>
                setSelectedBucket((prev) => (prev === 'lifestyle' ? 'all' : 'lifestyle'))
              }
              style={{ width: `${Math.max(lifestyleWidth, 6)}%` }}
              title={`Estilo de Vida: ${bucketsSummary.lifestyle.percentIncome}% da renda (${formatBRL(bucketsSummary.lifestyle.budgetCents)})`}
              className={`h-full rounded-xl transition-all relative group flex items-center justify-center overflow-hidden cursor-pointer bg-gradient-to-r from-[#FCA311] to-[#fdb744] hover:brightness-110 ${
                selectedBucket === 'lifestyle' ? 'ring-2 ring-amber-500 ring-offset-1 z-10' : ''
              } ${selectedBucket !== 'all' && selectedBucket !== 'lifestyle' ? 'opacity-40' : 'opacity-100'}`}
            >
              <span className="text-[10px] font-bold text-slate-900 truncate px-1 drop-shadow-2xs select-none">
                {bucketsSummary.lifestyle.percentIncome}%
              </span>
            </button>

            {/* Segmento Futuro & Metas */}
            <button
              type="button"
              onClick={() => setSelectedBucket((prev) => (prev === 'future' ? 'all' : 'future'))}
              style={{ width: `${Math.max(futureWidth, 6)}%` }}
              title={`Futuro & Metas: ${bucketsSummary.future.percentIncome}% da renda (${formatBRL(bucketsSummary.future.budgetCents)})`}
              className={`h-full rounded-xl transition-all relative group flex items-center justify-center overflow-hidden cursor-pointer bg-gradient-to-r from-[#10B981] to-[#34d399] hover:brightness-110 ${
                selectedBucket === 'future' ? 'ring-2 ring-[#10B981] ring-offset-1 z-10' : ''
              } ${selectedBucket !== 'all' && selectedBucket !== 'future' ? 'opacity-40' : 'opacity-100'}`}
            >
              <span className="text-[10px] font-bold text-white truncate px-1 drop-shadow-2xs select-none">
                {bucketsSummary.future.percentIncome}%
              </span>
            </button>
          </div>
        </div>

        {/* LINHA CONTÍNUA FLUIDA COM OS DETALHES DOS 3 BALDES (NÃO SÃO CARDS RÍGIDOS SEPARADOS) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 pt-1">
          {BUCKETS_CONFIG.map((cfg) => {
            const data = bucketsSummary[cfg.key]
            const isSelected = selectedBucket === cfg.key
            const Icon = cfg.icon

            return (
              <div
                key={cfg.key}
                onClick={() => setSelectedBucket((prev) => (prev === cfg.key ? 'all' : cfg.key))}
                className={`p-3.5 rounded-2xl transition-all cursor-pointer border relative select-none ${
                  cfg.bgLight
                } ${
                  isSelected
                    ? `${cfg.borderLight} ring-2 ring-[#14213D]/20 shadow-xs`
                    : `${cfg.borderLight} hover:border-slate-300`
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon
                      className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                      strokeWidth={1.5}
                    />
                    <span className={`text-xs font-semibold truncate ${cfg.textDark}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums shrink-0 ${cfg.badgeBg}`}
                  >
                    {data.percentIncome}% da renda
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                  <div className="tabular-nums">
                    <span className="text-sm sm:text-base font-bold text-slate-900">
                      {formatBRL(data.spentCents)}
                    </span>
                    <span className="text-xs font-normal text-slate-500 ml-1">
                      / {formatBRL(data.budgetCents)}
                    </span>
                  </div>
                  {data.budgetCents > 0 && (
                    <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                      {Math.round((data.spentCents / data.budgetCents) * 100)}% consumido
                    </span>
                  )}
                </div>

                {/* Badge informativa de alocação de cota vs meta da renda */}
                {(() => {
                  if (netIncomeCents <= 0) return null
                  const targets = getBudgetModelTargets(family?.budget_model)
                  const targetPercent = targets[cfg.key]
                  const metaCents = Math.round(netIncomeCents * (targetPercent / 100))

                  const diff = metaCents - data.budgetCents

                  if (diff > 0) {
                    return (
                      <div className="mt-1.5 flex items-center">
                        <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 leading-tight break-words">
                          <span>✨ + {formatBRL(diff)} livres para alocar</span>
                        </span>
                      </div>
                    )
                  }

                  if (diff === 0) {
                    return (
                      <div className="mt-1.5 flex items-center">
                        <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 leading-tight">
                          <span>✓ Cota 100% alocada</span>
                        </span>
                      </div>
                    )
                  }

                  return (
                    <div className="mt-1.5 flex items-center">
                      <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 leading-tight break-words">
                        <span>⚠️ {formatBRL(Math.abs(diff))} acima da meta sugerida</span>
                      </span>
                    </div>
                  )
                })()}

                {/* Subtítulo informativo leve sobre as categorias que compõem o balde */}
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-1 leading-normal">
                  {cfg.sublabel}
                </p>
              </div>
            )
          })}
        </div>

        {/* Resumo do Total Comprometido em formato discreto e fluido */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-500 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Total cadastrado em tetos:{' '}
              <strong className="text-slate-800 tabular-nums">{formatBRL(totalBudget)}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              Total já gasto no mês:{' '}
              <strong className="text-slate-700 tabular-nums">{formatBRL(totalSpent)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedBucket !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedBucket('all')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
              >
                Limpar filtro do balde
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
