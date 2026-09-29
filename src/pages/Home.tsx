import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '@/hooks/use-family'
import { fetchTransactions } from '@/services/transactions'
import { processAutoRecurringIncomes } from '@/services/recurring-incomes'
import {
  formatBRL,
  formatFamilyDisplayName,
  formatFullDate,
  formatRelativeDate,
} from '@/lib/formatters'
import { CountUp } from '@/components/common/CountUp'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { TransactionDetailDialog } from '@/components/transactions/TransactionDetailDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import { formatTransactionTitle, groupInstallmentTransactions } from '@/services/installments'
import { deleteTransaction } from '@/services/transactions'
import { useToast } from '@/hooks/use-toast'
import type { Transaction } from '@/types/finance'
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw,
  WalletCards,
  ChevronRight,
  Users,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function Home() {
  const {
    family,
    members,
    categories,
    currentMember,
    openWhoIsUsing,
    selectedMemberId,
    setSelectedMemberId,
    openNewTransaction,
    refreshTrigger,
    triggerRefresh,
  } = useFamily()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Diálogo de detalhe e edição
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  // Mês atual formato YYYY-MM
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), [])

  const loadData = useCallback(async () => {
    if (!family) return
    try {
      setLoading(true)

      // Auto-lançamento de receitas fixas do mês corrente ao abrir o app
      try {
        await processAutoRecurringIncomes({
          familyId: family.id,
          targetMonthStr: currentMonthStr,
        })
      } catch (autoErr) {
        console.warn('Erro ao auto-lançar receitas fixas no Início:', autoErr)
      }

      const allTx = await fetchTransactions({
        familyId: family.id,
        memberId: selectedMemberId,
      })
      setTransactions(allTx)
    } catch (err: any) {
      console.error('Erro ao carregar dados do início:', err)
      toast({
        title: 'Não foi possível carregar os dados',
        description: 'Verifique sua conexão ou tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [family, selectedMemberId, currentMonthStr, toast])

  useEffect(() => {
    loadData()
  }, [loadData, refreshTrigger])

  const handlePullToRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  // Renda líquida prevista da família
  const plannedIncomeCents = family?.monthly_net_income_cents || 0

  // Cálculos de saldo total acumulado e métricas do mês
  const { totalBalanceCents, monthIncomeCents, monthExpenseCents, trendPercentage } =
    useMemo(() => {
      let incomeTotal = 0
      let expenseTotal = 0
      let mIncome = 0
      let mExpense = 0
      let prevMIncome = 0
      let prevMExpense = 0

      const prevMonth = new Date()
      prevMonth.setMonth(prevMonth.getMonth() - 1)
      const prevMonthStr = prevMonth.toISOString().slice(0, 7)

      transactions.forEach((tx) => {
        const txMonth = tx.transaction_date.slice(0, 7)
        if (tx.type === 'income') {
          incomeTotal += tx.amount_cents
          if (txMonth === currentMonthStr) mIncome += tx.amount_cents
          if (txMonth === prevMonthStr) prevMIncome += tx.amount_cents
        } else {
          expenseTotal += tx.amount_cents
          if (txMonth === currentMonthStr) mExpense += tx.amount_cents
          if (txMonth === prevMonthStr) prevMExpense += tx.amount_cents
        }
      })

      const totalBalance = incomeTotal - expenseTotal
      const currentNet = mIncome - mExpense
      const prevNet = prevMIncome - prevMExpense

      let trend = 0
      if (prevNet !== 0) {
        trend = Math.round(((currentNet - prevNet) / Math.abs(prevNet)) * 100)
      }

      return {
        totalBalanceCents: totalBalance,
        monthIncomeCents: mIncome,
        monthExpenseCents: mExpense,
        trendPercentage: trend,
      }
    }, [transactions, currentMonthStr])

  // Mapa de baldes para as categorias (respeita budget_bucket da categoria com fallback por palavras-chave)
  const categoryBucketMap = useMemo(() => {
    const map = new Map<string, 'essentials' | 'lifestyle' | 'future'>()
    categories.forEach((cat) => {
      const rawBucket = cat.budget_bucket
      if (rawBucket === 'essentials' || rawBucket === 'lifestyle' || rawBucket === 'future') {
        map.set(cat.id, rawBucket)
      } else {
        const catNameLower = (cat.name || '').toLowerCase()
        if (
          catNameLower.includes('moradia') ||
          catNameLower.includes('alimenta') ||
          catNameLower.includes('saúde') ||
          catNameLower.includes('saude') ||
          catNameLower.includes('transporte') ||
          catNameLower.includes('serviço') ||
          catNameLower.includes('servico') ||
          catNameLower.includes('educa')
        ) {
          map.set(cat.id, 'essentials')
        } else if (
          catNameLower.includes('reserva') ||
          catNameLower.includes('invest') ||
          catNameLower.includes('meta') ||
          catNameLower.includes('projeto') ||
          catNameLower.includes('futuro')
        ) {
          map.set(cat.id, 'future')
        } else {
          map.set(cat.id, 'lifestyle')
        }
      }
    })
    return map
  }, [categories])

  // Agregação dos 3 Baldes (Necessidades 50%, Estilo de Vida 30%, Futuro 20%)
  const bucketsData = useMemo(() => {
    const netIncomeCents = family?.monthly_net_income_cents || 0

    // Tetos sugeridos do modelo padrão 50/30/20 sobre a renda líquida
    // Se renda não estiver configurada, degrada com elegância para 0
    const suggestedLimits = {
      essentials: Math.round((netIncomeCents * 50) / 100),
      lifestyle: Math.round((netIncomeCents * 30) / 100),
      future: Math.round((netIncomeCents * 20) / 100),
    }

    // Soma dos gastos do mês corrente agregados por cada bucket a partir das transações ativas de despesa
    let spentEssentials = 0
    let spentLifestyle = 0
    let spentFuture = 0

    transactions.forEach((tx) => {
      if (tx.type === 'expense' && tx.transaction_date.slice(0, 7) === currentMonthStr) {
        const bucket = tx.category_id
          ? categoryBucketMap.get(tx.category_id) || 'lifestyle'
          : 'lifestyle'
        if (bucket === 'essentials') {
          spentEssentials += tx.amount_cents
        } else if (bucket === 'future') {
          spentFuture += tx.amount_cents
        } else {
          spentLifestyle += tx.amount_cents
        }
      }
    })

    // Percentuais de consumo (ou 0 se teto for 0)
    const essentialsPercent =
      suggestedLimits.essentials > 0
        ? Math.round((spentEssentials / suggestedLimits.essentials) * 100)
        : 0
    const lifestylePercent =
      suggestedLimits.lifestyle > 0
        ? Math.round((spentLifestyle / suggestedLimits.lifestyle) * 100)
        : 0
    const futurePercent =
      suggestedLimits.future > 0 ? Math.round((spentFuture / suggestedLimits.future) * 100) : 0

    // Saldo livre imediato em Estilo de Vida: teto sugerido menos o que já foi gasto
    const lifestyleAvailableCents = suggestedLimits.lifestyle - spentLifestyle

    return {
      netIncomeCents,
      hasIncomeConfigured: netIncomeCents > 0,
      essentials: {
        spentCents: spentEssentials,
        limitCents: suggestedLimits.essentials,
        percent: essentialsPercent,
        isOver: spentEssentials > suggestedLimits.essentials && suggestedLimits.essentials > 0,
      },
      lifestyle: {
        spentCents: spentLifestyle,
        limitCents: suggestedLimits.lifestyle,
        percent: lifestylePercent,
        isOver: spentLifestyle > suggestedLimits.lifestyle && suggestedLimits.lifestyle > 0,
        availableCents: lifestyleAvailableCents,
      },
      future: {
        spentCents: spentFuture,
        limitCents: suggestedLimits.future,
        percent: futurePercent,
        isOver: spentFuture > suggestedLimits.future && suggestedLimits.future > 0,
      },
    }
  }, [family?.monthly_net_income_cents, transactions, currentMonthStr, categoryBucketMap])

  // Transações recentes agrupadas estilo banco (compras parceladas agrupadas em linha única)
  const recentItems = useMemo(() => {
    // Para a lista de "Últimos lançamentos", passamos todas as transações (incluindo grupos de parcelamento)
    // para groupInstallmentTransactions com a data de referência hoje. A função consolida o grupo todo
    // (inclusive sabendo o total de parcelas 10/10) e seleciona como representante a parcela
    // já atingida/confirmada mais recente (ex: 1/10 em 01/09/2026), sem que parcelas futuras de 2027
    // empurrem o parcelamento para o topo.
    const todayStr = new Date().toISOString().slice(0, 10)
    const grouped = groupInstallmentTransactions(transactions, { referenceDate: todayStr })

    // Filtra para garantir que apenas itens com data <= todayStr ou confirmados apareçam na Home
    const reachedItems = grouped.filter(
      (item) => item.representativeTx?.status !== 'projected' || item.transactionDate <= todayStr,
    )

    // Mostra as primeiras 7 linhas consolidadas na Home ordenadas por data decrescente (com desempate por created_at)
    return reachedItems
      .slice()
      .sort((a, b) => {
        const dateCmp = b.transactionDate.localeCompare(a.transactionDate)
        if (dateCmp !== 0) return dateCmp
        const createdA = a.createdAt || a.representativeTx?.created_at || ''
        const createdB = b.createdAt || b.representativeTx?.created_at || ''
        return createdB.localeCompare(createdA)
      })
      .slice(0, 7)
  }, [transactions])

  const handleDelete = async (tx: Transaction) => {
    try {
      await deleteTransaction(tx.id)
      toast({ title: 'Transação excluída', description: 'O saldo foi recalculado.' })
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full min-w-0 overflow-x-hidden">
      {/* 1. Header Saudação + Pull-to-refresh */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight break-words">
              Olá, {currentMember?.name || 'Família'}! 👋
            </h1>
            <button
              type="button"
              onClick={openWhoIsUsing}
              className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 border border-emerald-200/60 shrink-0 cursor-pointer active:scale-95"
              title="Trocar quem está usando"
            >
              <span>Trocar</span>
              <span className="text-[9px]">▾</span>
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 capitalize mt-1 break-words leading-tight">
            {formatFullDate(new Date())} •{' '}
            <span className="font-semibold text-emerald-800">
              {formatFamilyDisplayName(family?.name, 'Silva')}
            </span>
          </p>
        </div>

        <button
          onClick={handlePullToRefresh}
          disabled={refreshing}
          className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all active:scale-95 shrink-0"
          title="Atualizar dados"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* 2. Filtro Horizontal de Membros (Chips) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-full">
        <button
          type="button"
          onClick={() => setSelectedMemberId(null)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
            selectedMemberId === null
              ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/30'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          Todos
        </button>
        {members.map((m) => {
          const isSelected = selectedMemberId === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMemberId(m.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/30'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                {m.name.charAt(0).toUpperCase()}
              </span>
              {m.name}
            </button>
          )
        })}
      </div>

      {/* 3. Grid Principal (Card Hero de Saldo + Card Orçamento) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* CARD HERO SALDO TOTAL (Desktop 8 col) */}
        <div className="md:col-span-8 bg-gradient-to-br from-[#059669] to-[#0F766E] rounded-3xl p-5 sm:p-7 text-white shadow-xl shadow-emerald-950/15 relative overflow-hidden transition-all hover:shadow-2xl">
          {/* Efeito de luz decorativo */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-100">
              Saldo Total da Família
            </span>
            {trendPercentage !== 0 && (
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                  trendPercentage > 0
                    ? 'bg-emerald-400/20 text-emerald-100'
                    : 'bg-red-400/20 text-red-200'
                }`}
              >
                {trendPercentage > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>
                  {trendPercentage > 0 ? `+${trendPercentage}%` : `${trendPercentage}%`} vs mês ant.
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <Skeleton className="h-10 w-48 bg-white/20 rounded-lg my-2" />
          ) : (
            <div className="text-2xl sm:text-4xl font-extrabold tracking-tight tabular-nums my-2 break-words">
              <CountUp end={totalBalanceCents} formatter={(v) => formatBRL(v)} />
            </div>
          )}

          <p className="text-xs text-emerald-100/90 mb-4 sm:mb-5">
            {selectedMemberId
              ? `Filtrado por: ${members.find((m) => m.id === selectedMemberId)?.name}`
              : 'Consolidado de todos os membros'}
          </p>

          {/* Chips Receitas e Despesas do Mês: empilhados no mobile (< sm), 2 colunas a partir de sm: */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/15">
            {/* Bloco Receitas do Mês */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between gap-2 min-w-0">
              <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-400/20 flex items-center justify-center text-emerald-200 shrink-0 mt-0.5">
                  <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-emerald-100/90 block truncate">
                    Receitas do Mês
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="text-base sm:text-lg font-bold text-white tabular-nums break-words">
                      {formatBRL(monthIncomeCents)}
                    </span>
                    {/* Cenário (a): zero e previsto > 0 -> badge/texto sutil (Previsto: ...) */}
                    {monthIncomeCents === 0 && plannedIncomeCents > 0 && (
                      <span className="text-xs sm:text-[11px] font-medium text-emerald-100/90 break-words">
                        (Previsto: {formatBRL(plannedIncomeCents)})
                      </span>
                    )}
                    {/* Cenário (b.1): parcial (realizado < previsto) -> de {previsto} */}
                    {monthIncomeCents > 0 &&
                      plannedIncomeCents > 0 &&
                      monthIncomeCents < plannedIncomeCents && (
                        <span className="text-xs sm:text-[11px] font-medium text-emerald-100/90 break-words">
                          de {formatBRL(plannedIncomeCents)}
                        </span>
                      )}
                    {/* Cenário (b.2): atingido ou superado -> ✓ Previsto atingido */}
                    {monthIncomeCents > 0 &&
                      plannedIncomeCents > 0 &&
                      monthIncomeCents >= plannedIncomeCents && (
                        <span className="text-xs sm:text-[11px] font-bold text-emerald-200 break-words">
                          ✓ Previsto atingido
                        </span>
                      )}
                  </div>
                </div>
              </div>

              {/* Linha de apoio acolhedora quando zero entradas e há previsão cadastrada */}
              {monthIncomeCents === 0 && plannedIncomeCents > 0 && (
                <div className="pt-1.5 border-t border-white/10 text-xs sm:text-[11px] text-emerald-100/95 flex flex-wrap items-center gap-1.5 leading-snug">
                  <span>Aguardando entradas do mês</span>
                  <span className="opacity-60 hidden xs:inline">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      const salaryCategory = categories.find((c) => {
                        const nameLower = (c.name || '').toLowerCase()
                        return (
                          c.type === 'income' &&
                          (nameLower.includes('salário') ||
                            nameLower.includes('salario') ||
                            nameLower.includes('remunera') ||
                            nameLower.includes('renda'))
                        )
                      })
                      openNewTransaction({
                        initialType: 'income',
                        initialCategoryId: salaryCategory?.id,
                        initialAmountCents: plannedIncomeCents,
                        initialDescription: 'Salário mensal',
                      })
                    }}
                    className="font-bold underline underline-offset-4 hover:text-white transition-colors cursor-pointer text-emerald-50 active:scale-95 py-0.5"
                  >
                    [Registrar salário]
                  </button>
                </div>
              )}
            </div>

            {/* Bloco Despesas do Mês */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 sm:p-3.5 flex items-start gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-rose-400/20 flex items-center justify-center text-rose-200 shrink-0 mt-0.5">
                <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-emerald-100/90 block truncate">
                  Despesas do Mês
                </span>
                <span className="text-base sm:text-lg font-bold text-white tabular-nums truncate block mt-0.5">
                  {formatBRL(monthExpenseCents)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD ORÇAMENTO EM 3 BALDES (Desktop 4 col) */}
        <div className="md:col-span-4 bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header do Card */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-base shadow-2xs shrink-0">
                  ⚖️
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 leading-tight truncate">
                    Orçamento em 3 Baldes
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Modelo 50 / 30 / 20
                  </span>
                </div>
              </div>
              {bucketsData.hasIncomeConfigured && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums shrink-0">
                  {formatBRL(bucketsData.netIncomeCents)}/mês
                </span>
              )}
            </div>

            {/* Destaque no topo: Saldo livre imediato em Estilo de Vida */}
            <div
              className={`p-3 rounded-2xl mb-4 border transition-all ${
                !bucketsData.hasIncomeConfigured
                  ? 'bg-slate-50 border-slate-200/80 text-slate-600'
                  : bucketsData.lifestyle.availableCents >= 0
                    ? 'bg-amber-50/80 border-amber-200/80 text-amber-950'
                    : 'bg-rose-50/80 border-rose-200/80 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 flex items-center gap-1">
                  <span>🏖️</span>
                  <span>Disponível em Estilo de Vida</span>
                </span>
                {bucketsData.hasIncomeConfigured && bucketsData.lifestyle.isOver && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-200/80 text-rose-800">
                    Estourado
                  </span>
                )}
              </div>

              {bucketsData.hasIncomeConfigured ? (
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 mt-1">
                  <span
                    className={`text-lg sm:text-xl font-black tracking-tight tabular-nums break-words ${
                      bucketsData.lifestyle.availableCents >= 0 ? 'text-amber-900' : 'text-rose-600'
                    }`}
                  >
                    {bucketsData.lifestyle.availableCents < 0 ? '− ' : ''}
                    {formatBRL(Math.abs(bucketsData.lifestyle.availableCents))}
                  </span>
                  <span className="text-[10px] opacity-75 font-medium tabular-nums">
                    {bucketsData.lifestyle.availableCents >= 0
                      ? 'saldo livre p/ o mês'
                      : 'acima do sugerido'}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-1">
                  Defina a renda na Carteira para calcular o saldo livre.
                </p>
              )}
            </div>

            {/* As 3 Barras de Progresso Proporcionais dos Baldes */}
            <div className="space-y-3.5">
              {/* Balde 1: 🛡️ Necessidades (50%) - Cor Azul / Índigo */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                    <span>🛡️</span>
                    <span className="font-bold text-slate-800">Necessidades</span>
                    <span className="text-[10px] text-slate-400 font-medium">(50%)</span>
                  </span>
                  <span className="font-bold text-slate-700 tabular-nums text-[11px] break-words">
                    {formatBRL(bucketsData.essentials.spentCents)}
                    <span className="text-slate-400 font-normal">
                      {' '}
                      / {formatBRL(bucketsData.essentials.limitCents)}
                    </span>
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-indigo-600"
                    style={{
                      width: `${Math.min(bucketsData.essentials.percent, 100)}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span className="truncate mr-1">Moradia, mercado, saúde, contas</span>
                  <span
                    className={`font-semibold tabular-nums shrink-0 ${
                      bucketsData.essentials.isOver ? 'text-rose-600 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {bucketsData.essentials.percent}%
                  </span>
                </div>
              </div>

              {/* Balde 2: 🏖️ Estilo de Vida (30%) - Cor Âmbar / Violeta */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                    <span>🏖️</span>
                    <span className="font-bold text-slate-800">Estilo de Vida</span>
                    <span className="text-[10px] text-slate-400 font-medium">(30%)</span>
                  </span>
                  <span className="font-bold text-slate-700 tabular-nums text-[11px] break-words">
                    {formatBRL(bucketsData.lifestyle.spentCents)}
                    <span className="text-slate-400 font-normal">
                      {' '}
                      / {formatBRL(bucketsData.lifestyle.limitCents)}
                    </span>
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-amber-500"
                    style={{
                      width: `${Math.min(bucketsData.lifestyle.percent, 100)}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span className="truncate mr-1">Lazer, refeições fora, compras</span>
                  <span
                    className={`font-semibold tabular-nums shrink-0 ${
                      bucketsData.lifestyle.isOver ? 'text-rose-600 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {bucketsData.lifestyle.percent}%
                  </span>
                </div>
              </div>

              {/* Balde 3: 🎯 Futuro & Metas (20%) - Cor Esmeralda */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                    <span>🎯</span>
                    <span className="font-bold text-slate-800">Futuro & Metas</span>
                    <span className="text-[10px] text-slate-400 font-medium">(20%)</span>
                  </span>
                  <span className="font-bold text-slate-700 tabular-nums text-[11px] break-words">
                    {formatBRL(bucketsData.future.spentCents)}
                    <span className="text-slate-400 font-normal">
                      {' '}
                      / {formatBRL(bucketsData.future.limitCents)}
                    </span>
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-emerald-600"
                    style={{
                      width: `${Math.min(bucketsData.future.percent, 100)}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span className="truncate mr-1">Reserva, metas, investimentos</span>
                  <span className="font-semibold text-slate-500 tabular-nums shrink-0">
                    {bucketsData.future.percent}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Link sutil para Carteira */}
          <button
            type="button"
            onClick={() => navigate('/carteira')}
            className="w-full mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50/60 py-2 px-2.5 rounded-xl transition-colors flex items-center justify-between cursor-pointer group"
          >
            <span className="group-hover:underline">Ver detalhes na Carteira →</span>
            <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* 4. Seção Últimas Transações */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-base text-slate-900 truncate">Últimas Transações</h3>
            <p className="text-xs text-slate-500 truncate">
              Histórico recente de receitas e despesas
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate('/carteira')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl px-2.5 py-1.5 shrink-0 h-auto"
          >
            <span>Ver todas</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-2xl" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        ) : recentItems.length === 0 ? (
          /* Empty State com ilustração line-art */
          <div className="py-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <WalletCards className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">Nenhuma transação ainda</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mb-4">
              Comece adicionando receitas ou despesas compartilhadas pela família.
            </p>
            <Button
              onClick={() => openNewTransaction('expense')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar primeira transação
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentItems.map((item) => {
              const tx = item.representativeTx
              const isIncome = tx.type === 'income'
              // Se for grupo de parcelamento, exibe a descrição base completa sem abreviar
              // Se for transação normal, usa formatTransactionTitle
              const displayTitle = item.isGroup ? item.baseDescription : formatTransactionTitle(tx)

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedTx(tx)
                    setIsDetailOpen(true)
                  }}
                  className="flex items-start sm:items-center justify-between gap-3 py-3 px-2 sm:px-2.5 hover:bg-slate-50/90 rounded-2xl cursor-pointer transition-colors group"
                >
                  {/* Bloco Esquerda: Ícone + Textos */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    {/* Ícone de Categoria */}
                    <div
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0 mt-0.5 sm:mt-0"
                      style={{
                        backgroundColor: tx.category?.color || (isIncome ? '#10B981' : '#64748B'),
                      }}
                    >
                      <CategoryIcon name={tx.category?.icon} className="w-5 h-5" />
                    </div>

                    {/* Bloco de Textos (Título + Metadados) */}
                    <div className="min-w-0 flex-1">
                      {/* Linha 1: Título completo + Badges de status/tipo (Parcelado estilo banco / Fixa) */}
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <p
                          className="font-semibold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors break-words leading-tight"
                          title={displayTitle}
                        >
                          {displayTitle}
                        </p>
                        {item.isGroup ? (
                          <span
                            className="inline-flex items-center text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap"
                            title={`Compra parcelada: parcela ${item.currentInstallment} de ${item.totalInstallments}`}
                          >
                            Parcelado • {item.currentInstallment}/{item.totalInstallments}
                          </span>
                        ) : null}
                        {tx.is_recurring ? (
                          <span className="inline-flex items-center text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/60 px-1.5 py-0.2 rounded-md shrink-0">
                            Fixa
                          </span>
                        ) : null}
                      </div>

                      {/* Linha 2: Metadados responsivos (Wrap amigável no mobile para não esmagar nada) */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 min-w-0 text-[11px] sm:text-xs">
                        {/* DATA com ícone de calendário explícito - sempre legível e identificável */}
                        <span
                          className="inline-flex items-center gap-1 font-medium text-slate-600 bg-slate-100/80 px-1.5 py-0.5 rounded-md shrink-0 text-[11px] capitalize"
                          title={`Data: ${item.transactionDate}`}
                        >
                          <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{formatRelativeDate(item.transactionDate)}</span>
                        </span>

                        <span className="text-slate-300 shrink-0 hidden xs:inline">•</span>

                        {/* Chip do membro */}
                        <span className="inline-flex items-center gap-1 font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0 text-[11px]">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[7px] font-bold shrink-0">
                            {tx.member?.name?.charAt(0).toUpperCase() || 'M'}
                          </span>
                          <span className="max-w-[120px] sm:max-w-[150px] truncate">
                            {tx.member?.name || 'Membro'}
                          </span>
                        </span>

                        <span className="text-slate-300 shrink-0 hidden xs:inline">•</span>

                        {/* Categoria / Subcategoria ou Pendente */}
                        {tx.category ? (
                          <span className="font-medium text-slate-500 text-[11px] break-words">
                            <span>{tx.category.name}</span>
                            {tx.subcategory && (
                              <span className="text-emerald-700 font-semibold ml-1">
                                · {tx.subcategory.name}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded shrink-0">
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bloco Direita: Valor alinhado e estável */}
                  <div className="text-right shrink-0 pl-1 pt-0.5 sm:pt-0">
                    <span
                      className={`font-bold text-xs sm:text-sm md:text-base tabular-nums whitespace-nowrap ${
                        isIncome ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {isIncome ? '+' : '−'} {formatBRL(item.amountCents)}
                    </span>
                    {item.isGroup && (
                      <span className="block text-[9px] text-slate-400 tabular-nums">/parcela</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* DIÁLOGO DETALHE DA TRANSAÇÃO */}
      <TransactionDetailDialog
        transaction={selectedTx}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={(tx) => {
          setEditingTx(tx)
          setIsEditOpen(true)
        }}
        onDelete={handleDelete}
      />

      {/* DIÁLOGO EDIÇÃO */}
      <NewTransactionDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        editingTransaction={editingTx}
      />
    </div>
  )
}
