import { useState, useMemo } from 'react'
import { ChevronDown, AlertTriangle, AlertCircle, Sparkles, Edit3, ShieldAlert } from 'lucide-react'
import { formatBRL } from '@/lib/formatters'
import { getBudgetModelTargets } from '@/services/budget-model'
import type { Family, TransactionCategory } from '@/types/finance'
import type { BucketsSummaryData } from '@/components/wallet/BudgetOverviewCard'

export type AlertSeverityLevel = 'critical' | 'warning' | 'info'

export interface SmartAlertItem {
  id: string
  severity: AlertSeverityLevel
  type: 'category' | 'bucket' | 'income'
  category?: TransactionCategory
  categoryId?: string
  categoryName: string
  title: string
  detail: string
  metric?: string
  priority: number // menor número = maior severidade/prioridade
}

export interface BudgetAlertsFarolProps {
  family: Family | null
  bucketsSummary: BucketsSummaryData
  totalBudget: number
  totalBudgetPercentOfIncome: number
  categoryList: Array<{
    category: TransactionCategory
    limitCents: number
    spentCents: number
    percent: number
    isOver: boolean
  }>
  currentDate: Date
  monthKey: string
  onOpenCategoryEditor: (category: TransactionCategory) => void
  onOpenModelDialog?: () => void
}

export function BudgetAlertsFarol({
  family,
  bucketsSummary,
  totalBudget,
  totalBudgetPercentOfIncome,
  categoryList,
  currentDate,
  monthKey,
  onOpenCategoryEditor,
  onOpenModelDialog,
}: BudgetAlertsFarolProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const netIncomeCents = family?.monthly_net_income_cents || 0

  const { regularAlerts, criticalAlerts, summaryText, bucketLimitAlertCount, categoryOverCount } =
    useMemo(() => {
      const now = new Date()
      const currentSystemMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const isCurrentViewingMonth = currentSystemMonthKey === monthKey
      const daysInMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
      ).getDate()
      const currentDay = isCurrentViewingMonth ? now.getDate() : 1
      const daysRemaining = Math.max(0, daysInMonth - currentDay)
      const daysRemainingSuffix =
        daysRemaining > 0 && isCurrentViewingMonth ? ` (${daysRemaining}d restantes)` : ''
      const regular: SmartAlertItem[] = []
      const critical: SmartAlertItem[] = []
      let overCount = 0
      let bucketAtLimitCount = 0

      // 1. REGRA DE EXCEÇÃO INTELIGENTE: estouro da renda líquida familiar é CRÍTICO
      // Alertas críticos aparecem SEMPRE VISÍVEIS destacados fora do accordion
      if (netIncomeCents > 0 && totalBudgetPercentOfIncome > 100) {
        critical.push({
          id: 'critical-income-overflow',
          severity: 'critical',
          type: 'income',
          categoryName: 'Orçamento Familiar',
          title: 'Estouro da Renda Líquida',
          detail: `Tetos somados equivalem a ${totalBudgetPercentOfIncome}% da renda líquida (${formatBRL(totalBudget)} orçados de ${formatBRL(netIncomeCents)}). Ajuste para manter o equilíbrio.`,
          metric: `${totalBudgetPercentOfIncome}% da renda`,
          priority: 1,
        })
      }

      // 2. Baldes no limite ou acima da meta recomendada (derivada do modelo orçamentário da família)
      if (netIncomeCents > 0) {
        const modelTargets = getBudgetModelTargets(family?.budget_model)
        const bucketChecks: Array<{
          key: 'essentials' | 'lifestyle' | 'future'
          label: string
          targetPercent: number
        }> = [
          { key: 'essentials', label: 'Balde Essenciais', targetPercent: modelTargets.essentials },
          {
            key: 'lifestyle',
            label: 'Balde Estilo de Vida',
            targetPercent: modelTargets.lifestyle,
          },
          { key: 'future', label: 'Balde Futuro & Metas', targetPercent: modelTargets.future },
        ]

        bucketChecks.forEach((b) => {
          const stat = bucketsSummary[b.key]
          const metaCents = Math.round(netIncomeCents * (b.targetPercent / 100))
          if (stat.budgetCents > metaCents) {
            const diff = stat.budgetCents - metaCents
            bucketAtLimitCount++
            regular.push({
              id: `bucket-over-${b.key}`,
              severity: 'warning',
              type: 'bucket',
              categoryName: b.label,
              title: `${b.label} acima da meta (${stat.percentIncome}%)`,
              detail: `Alocado ${formatBRL(stat.budgetCents)} (teto sugerido de ${b.targetPercent}%: ${formatBRL(metaCents)}). Diferença: +${formatBRL(diff)}.`,
              metric: `${stat.percentIncome}%`,
              priority: 30,
            })
          }
        })
      }

      // 3. Alertas por Categoria (farol preventivo)
      categoryList.forEach((item) => {
        if (item.limitCents <= 0) return

        // Categorias do balde Futuro & Metas (investimentos/reserva) não geram alertas de despesa ou aporte
        const isFutureBucket =
          item.category.budget_bucket === 'future' ||
          item.category.name.toLowerCase().includes('reserva') ||
          item.category.name.toLowerCase().includes('invest')

        if (isFutureBucket) {
          return
        }

        // Categorias de despesa normais:
        // Crítico: estourou o teto (>100% ou isOver)
        if (item.percent > 100 || item.isOver) {
          overCount++
          const diff = Math.max(0, item.spentCents - item.limitCents)
          regular.push({
            id: `cat-over-${item.category.id}`,
            severity: 'critical',
            type: 'category',
            category: item.category,
            categoryId: item.category.id,
            categoryName: item.category.name,
            title: item.category.name,
            detail: `Estourou o teto em ${formatBRL(diff)} (${item.percent}% consumido)`,
            metric: `${item.percent}%`,
            priority: 10,
          })
        } else if (item.percent > 90) {
          // Crítico de limite imediato
          overCount++
          const remaining = Math.max(0, item.limitCents - item.spentCents)
          regular.push({
            id: `cat-danger-${item.category.id}`,
            severity: 'critical',
            type: 'category',
            category: item.category,
            categoryId: item.category.id,
            categoryName: item.category.name,
            title: item.category.name,
            detail: `90%+ consumido · restam ${formatBRL(remaining)}${daysRemainingSuffix}`,
            metric: `${item.percent}%`,
            priority: 15,
          })
        } else if (item.percent >= 71) {
          // Alerta preventivo
          regular.push({
            id: `cat-warning-${item.category.id}`,
            severity: 'warning',
            type: 'category',
            category: item.category,
            categoryId: item.category.id,
            categoryName: item.category.name,
            title: item.category.name,
            detail: `Atenção preventiva: ${item.percent}% do teto consumido${daysRemainingSuffix}`,
            metric: `${item.percent}%`,
            priority: 20,
          })
        }
      })

      // Ordenar por SEVERIDADE (crítico → alerta/warning → info/ok), não por ordem de cadastro
      regular.sort((a, b) => a.priority - b.priority)

      // Montar resumo dinâmico em uma linha
      // ex.: "2 categorias acima da meta · 1 balde no limite"
      const parts: string[] = []
      if (overCount > 0) {
        parts.push(
          `${overCount} ${overCount === 1 ? 'categoria acima da meta' : 'categorias acima da meta'}`,
        )
      }
      if (bucketAtLimitCount > 0) {
        parts.push(
          `${bucketAtLimitCount} ${bucketAtLimitCount === 1 ? 'balde no limite' : 'baldes no limite'}`,
        )
      }
      const warningCount = regular.filter(
        (r) => r.severity === 'warning' && r.type === 'category',
      ).length
      if (warningCount > 0 && overCount === 0) {
        parts.push(
          `${warningCount} ${warningCount === 1 ? 'categoria em atenção' : 'categorias em atenção'}`,
        )
      }

      let summary = ''
      if (parts.length > 0) {
        summary = parts.join(' · ')
      } else if (regular.length > 0) {
        summary = `${regular.length} ${regular.length === 1 ? 'alerta ativo' : 'alertas ativos'}`
      } else {
        summary = 'Tudo dentro das metas este mês'
      }

      return {
        regularAlerts: regular,
        criticalAlerts: critical,
        summaryText: summary,
        bucketLimitAlertCount: bucketAtLimitCount,
        categoryOverCount: overCount,
      }
    }, [
      netIncomeCents,
      family?.budget_model,
      totalBudgetPercentOfIncome,
      totalBudget,
      bucketsSummary,
      categoryList,
      currentDate,
      monthKey,
    ])

  const totalRegularCount = regularAlerts.length
  const hasRegularAlerts = totalRegularCount > 0

  return (
    <div className="space-y-2">
      {/* ============================================================== */}
      {/* REGRA DE EXCEÇÃO INTELIGENTE: Alertas CRÍTICOS sempre visíveis */}
      {/* (Ex.: estouro da renda líquida) fora do accordion               */}
      {/* ============================================================== */}
      {criticalAlerts.map((crit) => (
        <div
          key={crit.id}
          className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-3.5 sm:p-4 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in-50 duration-200"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-expense text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200">
                  Aviso Crítico
                </span>
                <span className="font-bold text-xs sm:text-sm text-white">{crit.title}</span>
              </div>
              <p className="text-xs text-white/80 mt-1 leading-relaxed">{crit.detail}</p>
            </div>
          </div>

          {onOpenModelDialog ? (
            <button
              type="button"
              onClick={onOpenModelDialog}
              className="self-start sm:self-center shrink-0 px-3 py-1.5 rounded-xl bg-expense hover:opacity-90 active:scale-95 text-white text-xs font-semibold transition-all shadow-xs"
            >
              Ajustar Orçamento
            </button>
          ) : null}
        </div>
      ))}

      {/* ============================================================== */}
      {/* FAROL & ALERTAS PREVENTIVOS RECOLHIDO POR PADRÃO               */}
      {/* ============================================================== */}
      {!hasRegularAlerts ? (
        /* Estado calmo quando NÃO houver nenhum alerta: linha discreta de ~32px */
        <div className="h-8 sm:h-9 px-3.5 rounded-xl bg-surface-2/60 border border-line flex items-center justify-center gap-2 text-income select-none">
          <span className="text-xs">✨</span>
          <span className="text-xs font-medium text-white truncate">
            Tudo dentro das metas este mês
          </span>
        </div>
      ) : (
        /* Barra de resumo fina com accordion suave */
        <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-2xs transition-all">
          {/* BARRA RECOLHIDA / BOTÃO TOGGLE DO ACCORDION */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            className="w-full h-11 sm:h-12 px-3.5 sm:px-4 flex items-center justify-between gap-2.5 text-left hover:bg-surface-2/70 active:bg-surface-2 transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-income/50"
          >
            {/* Esquerda: Ícone de farol dinâmico */}
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                  categoryOverCount > 0
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-amber-500/15 text-amber-300'
                }`}
                aria-hidden="true"
              >
                ⚠️
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-body3 hidden xs:inline">
                Farol
              </span>
            </div>

            {/* Centro: Resumo inteligente em UMA linha, truncado com ellipsis */}
            <div className="min-w-0 flex-1 px-1">
              <span
                className="block text-xs sm:text-sm font-semibold text-white truncate leading-none"
                title={summaryText}
              >
                {summaryText}
              </span>
            </div>

            {/* Direita: Chevron + Badge numérico */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center justify-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 tabular-nums">
                {totalRegularCount}
              </span>
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-body2 hover:text-white transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              >
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </button>

          {/* ITENS EXPANDIDOS (DENTRO DO CARD, NÃO SOLTOS NA PÁGINA) */}
          {isExpanded ? (
            <div className="border-t border-line divide-y divide-line/60 bg-surface p-2 sm:p-2.5 space-y-1 animate-in fade-in-50 duration-200">
              {regularAlerts.map((alert) => {
                const isCrit = alert.severity === 'critical'
                const hasCategoryAction = alert.type === 'category' && alert.category

                return (
                  <div
                    key={alert.id}
                    onClick={() => {
                      if (hasCategoryAction && alert.category) {
                        onOpenCategoryEditor(alert.category)
                      } else if (alert.type === 'bucket' && onOpenModelDialog) {
                        onOpenModelDialog()
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        if (hasCategoryAction && alert.category) {
                          onOpenCategoryEditor(alert.category)
                        } else if (alert.type === 'bucket' && onOpenModelDialog) {
                          onOpenModelDialog()
                        }
                      }
                    }}
                    className={`w-full group text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2.5 hover:bg-surface-2/90 border-l-[3px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-line ${
                      isCrit
                        ? 'border-l-rose-500 bg-rose-950/20'
                        : 'border-l-amber-500 bg-amber-950/20'
                    }`}
                    title={
                      hasCategoryAction
                        ? `Clique para editar o teto de ${alert.categoryName}`
                        : alert.title
                    }
                  >
                    {/* Lado esquerdo: Ícone de severidade + Nome + O que aconteceu em uma linha */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="shrink-0">
                        {isCrit ? (
                          <AlertCircle className="w-4 h-4 text-expense" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-warning" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-2 leading-tight">
                        <span className="text-xs sm:text-sm font-bold text-white group-hover:text-income transition-colors shrink-0">
                          {alert.categoryName}
                        </span>
                        <span className="text-[11px] sm:text-xs text-body2 truncate">
                          <span>{alert.detail}</span>
                        </span>
                      </div>
                    </div>

                    {/* Lado direito: Métrica e ação do lápis */}
                    <div className="flex items-center gap-2 shrink-0">
                      {alert.metric && (
                        <span
                          className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-md ${
                            isCrit
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {alert.metric}
                        </span>
                      )}
                      {hasCategoryAction ? (
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-body2 group-hover:text-white group-hover:bg-surface-2 transition-colors shrink-0"
                          aria-label={`Editar ${alert.categoryName}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
