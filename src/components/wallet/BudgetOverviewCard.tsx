import { useState } from 'react'
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Home,
  Coffee,
  HelpCircle,
  ChevronRight,
  ShieldAlert,
  Info,
} from 'lucide-react'
import { formatBRL } from '@/lib/formatters'
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
  icon: typeof Home
}

const BUCKETS_CONFIG: BucketMetaInfo[] = [
  {
    key: 'essentials',
    label: 'Gastos Essenciais',
    sublabel: 'Moradia, Alimentação, Transporte, Saúde, Educação',
    colorName: 'sky',
    barColor: 'bg-sky-500',
    barHoverColor: 'hover:bg-sky-600',
    bgLight: 'bg-sky-50/70',
    borderLight: 'border-sky-200/70',
    textDark: 'text-sky-900',
    badgeBg: 'bg-sky-100/90 text-sky-800',
    accentDot: 'bg-sky-500',
    icon: Home,
  },
  {
    key: 'lifestyle',
    label: 'Estilo de Vida',
    sublabel: 'Lazer, Compras, Assinaturas, Cuidados & Bem-estar',
    colorName: 'amber',
    barColor: 'bg-amber-500',
    barHoverColor: 'hover:bg-amber-600',
    bgLight: 'bg-amber-50/70',
    borderLight: 'border-amber-200/70',
    textDark: 'text-amber-900',
    badgeBg: 'bg-amber-100/90 text-amber-900',
    accentDot: 'bg-amber-500',
    icon: Coffee,
  },
  {
    key: 'future',
    label: 'Futuro & Metas',
    sublabel: 'Reserva de Emergência, Aportes, Investimentos & Sonhos',
    colorName: 'emerald',
    barColor: 'bg-emerald-500',
    barHoverColor: 'hover:bg-emerald-600',
    bgLight: 'bg-emerald-50/70',
    borderLight: 'border-emerald-200/70',
    textDark: 'text-emerald-900',
    badgeBg: 'bg-emerald-100/90 text-emerald-800',
    accentDot: 'bg-emerald-500',
    icon: TrendingUp,
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
  categoryList,
  onOpenModelDialog,
}: BudgetOverviewCardProps) {
  const [selectedBucket, setSelectedBucket] = useState<
    'all' | 'essentials' | 'lifestyle' | 'future'
  >('all')
  const [showAllAlerts, setShowAllAlerts] = useState(false)

  const netIncomeCents = family?.monthly_net_income_cents || 0

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

  // Coleta inteligente e ordenada dos alertas dos tetos e baldes
  const now = new Date()
  const isCurrentViewingMonth = now.toISOString().slice(0, 7) === monthKey
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const currentDay = isCurrentViewingMonth ? now.getDate() : 1
  const daysRemaining = Math.max(0, daysInMonth - currentDay)

  const alerts: SummaryAlert[] = []

  // 1. Alerta de comprometimento total da renda líquida
  if (totalBudgetPercentOfIncome > 100) {
    alerts.push({
      id: 'total-income-overflow',
      severity: 'red',
      categoryName: 'Orçamento Global',
      title: 'Tetos somados ultrapassam 100% da renda líquida',
      detail: `O valor orçado (${formatBRL(totalBudget)}) equivale a ${totalBudgetPercentOfIncome}% da sua renda mensal. Ajuste os tetos para manter equilíbrio financeiro.`,
      metric: `${totalBudgetPercentOfIncome}% da renda`,
      priority: 1,
    })
  }

  // 2. Alertas por categoria (farol preventivo)
  categoryList.forEach((item) => {
    if (item.limitCents <= 0) return

    const isInvestment =
      item.category.name.toLowerCase().includes('reserva') ||
      item.category.name.toLowerCase().includes('invest') ||
      item.category.budget_bucket === 'future'

    // Reserva & Investimentos: alerta quando aporte ficar abaixo do ideal
    if (isInvestment) {
      if (item.percent < 70) {
        alerts.push({
          id: `inv-${item.category.id}`,
          severity: 'amber',
          categoryName: item.category.name,
          bucketKey: item.category.budget_bucket || 'future',
          title: `Aporte abaixo do mínimo recomendado (${item.percent}%)`,
          detail: `Priorize a reserva de segurança familiar. Aportado ${formatBRL(item.spentCents)} de ${formatBRL(item.limitCents)} previstos.`,
          metric: `${item.percent}% atingido`,
          priority: 25,
        })
      }
      return
    }

    // Regra preventiva padrão para despesas
    if (item.percent > 100 || item.isOver) {
      alerts.push({
        id: `over-${item.category.id}`,
        severity: 'red',
        categoryName: item.category.name,
        bucketKey: item.category.budget_bucket || undefined,
        title: `Estourou o teto em ${formatBRL(Math.max(0, item.spentCents - item.limitCents))}`,
        detail: `Consumiu ${item.percent}% do limite mensal (${formatBRL(item.spentCents)} de ${formatBRL(item.limitCents)}).`,
        metric: `${item.percent}%`,
        priority: 10,
      })
    } else if (item.percent > 90) {
      alerts.push({
        id: `danger-${item.category.id}`,
        severity: 'red',
        categoryName: item.category.name,
        bucketKey: item.category.budget_bucket || undefined,
        title: `Consumo crítico do teto (${item.percent}%)`,
        detail: `Restam apenas ${formatBRL(item.limitCents - item.spentCents)} para ${daysRemaining > 0 && isCurrentViewingMonth ? `${daysRemaining} dias restantes no mês.` : 'o mês.'}`,
        metric: `${item.percent}%`,
        priority: 15,
      })
    } else if (item.percent >= 71) {
      alerts.push({
        id: `warning-${item.category.id}`,
        severity: 'amber',
        categoryName: item.category.name,
        bucketKey: item.category.budget_bucket || undefined,
        title: `Teto em atenção preventiva (${item.percent}%)`,
        detail: `Já consumiu ${item.percent}% do teto planejado${daysRemaining > 0 && isCurrentViewingMonth ? ` e ainda faltam ${daysRemaining} dias para fechar o mês.` : '.'}`,
        metric: `${item.percent}%`,
        priority: 30,
      })
    }
  })

  // Ordenação prioritária dos alertas:
  // Vermelhos mais críticos primeiro, depois âmbar, depois pelo maior consumo
  alerts.sort((a, b) => a.priority - b.priority)

  // Filtra por balde se o usuário selecionou um balde específico
  const filteredAlerts =
    selectedBucket === 'all' ? alerts : alerts.filter((al) => al.bucketKey === selectedBucket)

  const displayedAlerts = showAllAlerts ? filteredAlerts : filteredAlerts.slice(0, 3)
  const remainingAlertsCount = filteredAlerts.length - displayedAlerts.length

  const redAlertsCount = alerts.filter((a) => a.severity === 'red').length
  const amberAlertsCount = alerts.filter((a) => a.severity === 'amber').length

  return (
    <section className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs relative overflow-hidden transition-all">
      {/* Sutil detalhe de gradiente superior fluido */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-sky-400 via-amber-400 to-emerald-400" />

      {/* CABEÇALHO DO PAINEL FLUÍDO: Renda Líquida no topo com hierarquia clara e chamada de ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Matriz Orçamentária
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] font-semibold text-slate-500">3 Baldes Financeiros</span>
            {redAlertsCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {redAlertsCount} {redAlertsCount === 1 ? 'alerta crítico' : 'alertas críticos'}
              </span>
            ) : amberAlertsCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {amberAlertsCount} em atenção
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Tetos saudáveis
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 flex-wrap pt-0.5">
            <span className="text-xs text-slate-500 font-medium">Renda Líquida Familiar:</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight tabular-nums">
              {formatBRL(netIncomeCents)}
            </span>
            <span className="text-xs text-slate-400 font-normal">/ mês</span>
          </div>
        </div>

        {/* Botão de ajuste de perfil / renda */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenModelDialog}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100/90 border border-emerald-200/60 px-3 py-1.5 rounded-xl transition-all shadow-2xs hover:shadow-xs active:scale-95"
            title="Ajustar renda líquida familiar ou trocar modelo de distribuição"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ajustar modelo / Renda</span>
          </button>
        </div>
      </div>

      {/* SEÇÃO DA BARRA SEGMENTADA CONTÍNUA & PROPORCIONAL */}
      <div className="pt-5 space-y-3">
        <div className="flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Distribuição Proporcional dos Baldes</span>
            <span className="text-[11px] text-slate-400 hidden xs:inline">
              (toque no balde para filtrar alertas)
            </span>
          </div>
          <span className="text-xs font-bold text-slate-600 tabular-nums">
            Comprometido:{' '}
            <strong
              className={
                totalBudgetPercentOfIncome > 100
                  ? 'text-red-600 font-extrabold'
                  : 'text-slate-900 font-bold'
              }
            >
              {totalBudgetPercentOfIncome}%
            </strong>{' '}
            da renda
          </span>
        </div>

        {/* A BARRA ÚNICA MULTI-SEGMENTADA */}
        <div className="relative">
          <div className="h-5 sm:h-6 w-full rounded-2xl p-1 bg-slate-100 flex items-center gap-1 overflow-hidden shadow-inner">
            {/* Segmento Essenciais */}
            <button
              type="button"
              onClick={() =>
                setSelectedBucket((prev) => (prev === 'essentials' ? 'all' : 'essentials'))
              }
              style={{ width: `${Math.max(essentialsWidth, 6)}%` }}
              title={`Essenciais: ${bucketsSummary.essentials.percentIncome}% da renda (${formatBRL(bucketsSummary.essentials.budgetCents)})`}
              className={`h-full rounded-xl transition-all relative group flex items-center justify-center overflow-hidden cursor-pointer ${
                BUCKETS_CONFIG[0].barColor
              } ${BUCKETS_CONFIG[0].barHoverColor} ${
                selectedBucket === 'essentials' ? 'ring-2 ring-sky-600 ring-offset-1 z-10' : ''
              } ${selectedBucket !== 'all' && selectedBucket !== 'essentials' ? 'opacity-40' : 'opacity-100'}`}
            >
              <span className="text-[10px] font-extrabold text-white truncate px-1 drop-shadow-2xs select-none">
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
              className={`h-full rounded-xl transition-all relative group flex items-center justify-center overflow-hidden cursor-pointer ${
                BUCKETS_CONFIG[1].barColor
              } ${BUCKETS_CONFIG[1].barHoverColor} ${
                selectedBucket === 'lifestyle' ? 'ring-2 ring-amber-600 ring-offset-1 z-10' : ''
              } ${selectedBucket !== 'all' && selectedBucket !== 'lifestyle' ? 'opacity-40' : 'opacity-100'}`}
            >
              <span className="text-[10px] font-extrabold text-white truncate px-1 drop-shadow-2xs select-none">
                {bucketsSummary.lifestyle.percentIncome}%
              </span>
            </button>

            {/* Segmento Futuro & Metas */}
            <button
              type="button"
              onClick={() => setSelectedBucket((prev) => (prev === 'future' ? 'all' : 'future'))}
              style={{ width: `${Math.max(futureWidth, 6)}%` }}
              title={`Futuro & Metas: ${bucketsSummary.future.percentIncome}% da renda (${formatBRL(bucketsSummary.future.budgetCents)})`}
              className={`h-full rounded-xl transition-all relative group flex items-center justify-center overflow-hidden cursor-pointer ${
                BUCKETS_CONFIG[2].barColor
              } ${BUCKETS_CONFIG[2].barHoverColor} ${
                selectedBucket === 'future' ? 'ring-2 ring-emerald-600 ring-offset-1 z-10' : ''
              } ${selectedBucket !== 'all' && selectedBucket !== 'future' ? 'opacity-40' : 'opacity-100'}`}
            >
              <span className="text-[10px] font-extrabold text-white truncate px-1 drop-shadow-2xs select-none">
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
                    ? `${cfg.borderLight} ring-2 ring-emerald-600/30 shadow-xs`
                    : `${cfg.borderLight} hover:border-slate-300`
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${cfg.accentDot} shrink-0`} />
                    <span className={`text-xs font-bold truncate ${cfg.textDark}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full tabular-nums shrink-0 ${cfg.badgeBg}`}
                  >
                    {data.percentIncome}% da renda
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                  <div className="tabular-nums">
                    <span className="text-sm sm:text-base font-extrabold text-slate-900">
                      {formatBRL(data.spentCents)}
                    </span>
                    <span className="text-xs font-medium text-slate-400 ml-1">
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
                  const targetPercent =
                    cfg.key === 'essentials' ? 50 : cfg.key === 'lifestyle' ? 30 : 20
                  const metaCents = Math.round(netIncomeCents * (targetPercent / 100))

                  if (data.budgetCents < metaCents) {
                    const diff = metaCents - data.budgetCents
                    return (
                      <div className="mt-1.5 flex items-center">
                        <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 leading-tight break-words">
                          ✨ + {formatBRL(diff)} livres para alocar
                        </span>
                      </div>
                    )
                  }

                  if (data.budgetCents === metaCents) {
                    return (
                      <div className="mt-1.5 flex items-center">
                        <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 leading-tight">
                          ✓ Cota 100% alocada
                        </span>
                      </div>
                    )
                  }

                  const diff = data.budgetCents - metaCents
                  return (
                    <div className="mt-1.5 flex items-center">
                      <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 leading-tight break-words">
                        ⚠️ {formatBRL(diff)} acima da meta de {targetPercent}%
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

      {/* SEÇÃO DE ALERTAS PREVENTIVOS & FAROL (INTEGRADOS EM LISTA LEVE E FLUIDA, NÃO COMO CARDS EMPILHADOS) */}
      <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>Farol & Alertas Preventivos</span>
              {filteredAlerts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                  {filteredAlerts.length}
                </span>
              )}
            </span>
            {selectedBucket !== 'all' && (
              <span className="text-[11px] text-slate-400">
                (filtrado por {BUCKETS_CONFIG.find((b) => b.key === selectedBucket)?.label})
              </span>
            )}
          </div>

          {filteredAlerts.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllAlerts((prev) => !prev)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              {showAllAlerts ? 'Ver menos' : `Ver todos (${filteredAlerts.length})`}
            </button>
          )}
        </div>

        {/* Lista fluida de alertas */}
        {filteredAlerts.length === 0 ? (
          <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <p className="font-bold text-emerald-900 leading-snug">
                Nenhum alerta para o período
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Todos os tetos acompanhados estão dentro do ritmo planejado e com aportes adequados.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {displayedAlerts.map((alert) => {
              const isRed = alert.severity === 'red'
              const isAmber = alert.severity === 'amber'

              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                    isRed
                      ? 'bg-red-50/60 border-red-200/80 text-red-950'
                      : isAmber
                        ? 'bg-amber-50/60 border-amber-200/80 text-amber-950'
                        : 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isRed
                          ? 'bg-red-100 text-red-700'
                          : isAmber
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isRed ? (
                        <AlertCircle className="w-3.5 h-3.5" />
                      ) : isAmber ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold leading-tight">{alert.title}</span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                            isRed
                              ? 'bg-red-200/70 text-red-800'
                              : isAmber
                                ? 'bg-amber-200/70 text-amber-900'
                                : 'bg-emerald-200/70 text-emerald-800'
                          }`}
                        >
                          {alert.categoryName}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] mt-0.5 leading-relaxed ${
                          isRed
                            ? 'text-red-900/80'
                            : isAmber
                              ? 'text-amber-900/80'
                              : 'text-emerald-900/80'
                        }`}
                      >
                        {alert.detail}
                      </p>
                    </div>
                  </div>

                  {alert.metric && (
                    <span
                      className={`text-xs font-extrabold tabular-nums shrink-0 px-2 py-0.5 rounded-lg ${
                        isRed
                          ? 'bg-white/80 text-red-700 border border-red-200/60'
                          : 'bg-white/80 text-amber-800 border border-amber-200/60'
                      }`}
                    >
                      {alert.metric}
                    </span>
                  )}
                </div>
              )
            })}

            {!showAllAlerts && remainingAlertsCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllAlerts(true)}
                className="w-full text-center py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200/60"
              >
                Mostrar mais {remainingAlertsCount}{' '}
                {remainingAlertsCount === 1 ? 'alerta' : 'alertas'}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
