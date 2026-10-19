import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '@/hooks/use-family'
import { useActiveMonth } from '@/contexts/ActiveMonthContext'
import { MonthSelector } from '@/components/common/MonthSelector'
import { supabase } from '@/lib/supabase/client'
import {
  fetchTransactions,
  fetchDefaultBudgets,
  fetchMonthBudgetOverrides,
} from '@/services/transactions'
import { processAutoRecurringIncomes } from '@/services/recurring-incomes'
import { formatBRL, formatFamilyDisplayName, formatRelativeDate } from '@/lib/formatters'
import { CountUp } from '@/components/common/CountUp'
import { CategoryIconBox } from '@/components/common/CategoryIcon'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import { PremiumGate } from '@/components/billing/PremiumGate'
import { FirstWalkthrough } from '@/components/onboarding/FirstWalkthrough'
import { useAccessStatus } from '@/services/access-status'
import { TransactionDetailDialog } from '@/components/transactions/TransactionDetailDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import { formatTransactionTitle, groupInstallmentTransactions } from '@/services/installments'
import { deleteTransaction } from '@/services/transactions'
import { useToast } from '@/hooks/use-toast'
import { useValuePrivacy, getTimeGreeting } from '@/hooks/use-value-privacy'
import NotificationsPanel from '@/components/notifications/NotificationsPanel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Transaction, DefaultBudget, Budget } from '@/types/finance'
import { BUDGET_PRESET_ITEMS } from '@/types/budget-presets'
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  WalletCards,
  ChevronRight,
  Users,
  Calendar,
  Sparkles,
  Eye,
  EyeOff,
  Bell,
  SunMedium,
  Coffee,
  Moon,
  Scale,
  Shield,
  Palmtree,
  Target,
  BarChart3,
  Receipt,
  PiggyBank,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function Home() {
  const {
    family,
    members,
    categories,
    completeness,
    currentMember,
    selectedMemberId,
    setSelectedMemberId,
    openNewTransaction,
    openOnboarding,
    refreshTrigger,
    triggerRefresh,
  } = useFamily()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { hideValues, toggleHideValues, maskValue } = useValuePrivacy()
  // Acesso (modelo C2): premium/trial vs free — controla paywall do Copilot e gráfico
  const access = useAccessStatus()

  const [loading, setLoading] = useState(true)
  // BLINDAGEM R50 (alinhada ao use-family): a Home NÃO REABRE o onboarding sozinha
  // (o auto-open é responsabilidade exclusiva do use-family, que checa transações no
  // banco antes de abrir). Aqui, isFamilyIncomplete só controla a TELA DE FALLBACK
  // local: critério alinhado ao use-family (catálogo vazio OU sem regras de IA), SEM
  // contagens hardcoded — o antigo "categorias !== 19" marcava famílias com subcategorias
  // custom como incompletas e reabria o wizard concluído (bug do modal fantasma 16/10).
  const isFamilyIncomplete = useMemo(() => {
    if (!family) return false
    return completeness?.isIncomplete ?? false
  }, [family, completeness])

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalsFromRpc, setTotalsFromRpc] = useState<{
    total_income_cents: number
    total_expense_cents: number
  } | null>(null)
  const [loadError, setLoadError] = useState(false)
  // Insights do Copilot (determinísticos via RPC get_family_insights — estilo Pierre:
  // "o que merece sua atenção" no topo da Home, sem custo IA)
  const [insights, setInsights] = useState<
    Array<{ severity: 'danger' | 'warning' | 'success' | 'info'; title: string; detail: string }>
  >([])
  // CONVITE ao Copilot (19/10, Matheus 21h): família nova (passo 'copilot'
  // pendente no tour) → o card do Copilot É o convite ao chat ("Bem-vindo!
  // Fale comigo — toque em mim, eu te ajudo"), não a frase de insight. O
  // 1º toque marca o passo e a fala normal volta.
  const isNewToCopilot = useMemo(
    () =>
      Boolean(
        family &&
        (!Array.isArray(family.tour_steps_done) || !family.tour_steps_done.includes('copilot')),
      ),
    [family],
  ) // Evolução do saldo (gap 1 da auditoria 16/10): série diária dos últimos 30 dias
  // via RPC get_family_balance_series (agregação no servidor, ~1 query). Falha
  // silenciosa: gráfico é enhancement, nunca bloqueia a Home.
  const [balanceSeries, setBalanceSeries] = useState<Array<{ day: string; balance_cents: number }>>(
    [],
  )
  // BUG "valores fantasmas" (17/10): ao navegar pra um mês passado, o card do saldo
  // mostrava o saldo GLOBAL de hoje (constante em qualquer mês). Agora: saldo
  // acumulado ATÉ O FIM do mês ativo (RPC get_family_balance_until). Null = mês
  // atual (usa a RPC global normal).
  const [historicalTotals, setHistoricalTotals] = useState<{
    total_income_cents: number
    total_expense_cents: number
  } | null>(null)
  const [defaultBudgets, setDefaultBudgets] = useState<DefaultBudget[]>([])
  const [monthOverrides, setMonthOverrides] = useState<Budget[]>([])
  // Diálogo de detalhe e edição
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  // Carregamento prolongado (> ~2s): substitui o skeleton por mensagem amigável
  const [isLongLoading, setIsLongLoading] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const isFamilyResolved = Boolean(family?.id)
  const isInitialDataLoading = loading || !isFamilyResolved

  useEffect(() => {
    if (!isInitialDataLoading) {
      setIsLongLoading(false)
      return
    }
    const timer = setTimeout(() => {
      setIsLongLoading(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [isInitialDataLoading])

  // Saudação personalizada dinâmica baseada no horário LOCAL do usuário
  const timeGreeting = useMemo(() => {
    const greetingData = getTimeGreeting(new Date())
    const memberFirstName = currentMember?.name ? currentMember.name.trim().split(/\s+/)[0] : null
    return {
      fullGreetingWithName: memberFirstName ? greetingData.fullGreeting(memberFirstName) : null,
      rawGreeting: greetingData.greeting,
      period: greetingData.period,
      memberName: memberFirstName,
    }
  }, [currentMember?.name])

  // Mês ativo global
  const { activeMonth, activeDate } = useActiveMonth()

  const currentMonthStr = activeMonth

  // BUG "valores fantasmas" (17/10): mês do SISTEMA (hoje) e último dia do mês ATIVO.
  // Quando o mês ativo é passado, o saldo vem da RPC get_family_balance_until (acumulado
  // até o fim daquele mês) em vez do saldo global de hoje.
  const now = new Date()
  const systemMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const endOfMonthStr = `${activeMonth}-${new Date(
    activeDate.getFullYear(),
    activeDate.getMonth() + 1,
    0,
  ).getDate()}`

  const loadData = useCallback(async () => {
    if (!family) return
    try {
      setLoading(true)
      try {
        await processAutoRecurringIncomes({
          familyId: family.id,
          targetMonthStr: currentMonthStr,
        })
      } catch (autoErr) {
        console.warn('Erro ao auto-lançar receitas fixas no Início:', autoErr)
      }

      // PERFORMANCE: totais globais (saldo, receita, despesa desde o início) são
      // agregados no servidor via RPC — sem baixar todas as transações da família.
      // Com filtro de membro ativo, mantém o fetch completo (dataset do membro é pequeno).
      const [totalsPromise, monthTxRes, defBgs, overrides, insightsRes, seriesRes, historicalRes] =
        await Promise.all([
          selectedMemberId
            ? fetchTransactions({ familyId: family.id, memberId: selectedMemberId })
            : (supabase as any).rpc('get_family_totals', { p_family_id: family.id }),
          // Transações do mês ativo: alimenta Receitas/Despesas do mês e o anel de progresso
          // (o RPC get_family_totals só retorna totais GLOBAIS — sem isso, o card do mês
          // ficava eternamente em R$ 0,00 quando sem filtro de membro)
          fetchTransactions({ familyId: family.id, month: currentMonthStr }),
          fetchDefaultBudgets(family.id),
          fetchMonthBudgetOverrides(family.id, currentMonthStr),
          // Insights do Copilot (determinísticos, ~10ms, RLS nativo). Falha silenciosa:
          // insights são enhancement, nunca bloqueiam a Home.
          (supabase as any)
            .rpc('get_family_insights', {
              p_family_id: family.id,
              p_month: `${currentMonthStr}-01`,
            })
            .then((r: any) => r.data)
            .catch(() => []),
          // Série de saldo dos últimos 30 dias (gráfico de evolução). Sem filtro de
          // membro (a série é da família consolidada).
          selectedMemberId
            ? Promise.resolve([])
            : (supabase as any)
                .rpc('get_family_balance_series', { p_family_id: family.id, p_days: 30 })
                .then((r: any) => r.data || [])
                .catch(() => []),
          // BUG "valores fantasmas" (17/10): mês passado → saldo acumulado até o fim
          // desse mês (RPC nova). Mês atual → null (usa a RPC global normal).
          currentMonthStr === systemMonthStr
            ? Promise.resolve(null)
            : (supabase as any)
                .rpc('get_family_balance_until', {
                  p_family_id: family.id,
                  p_until_date: endOfMonthStr,
                })
                .then((r: any) => r.data)
                .catch(() => null),
        ])
      if (selectedMemberId) {
        // FIX (16/10, saldo igual pra todos os membros): ao filtrar por um membro,
        // os totais GLOBAIS da família (RPC) precisam ser DESCARTADOS — se ficarem
        // no estado, o useMemo do saldo continua usando o total da família e o
        // saldo "do membro" saía igual ao da família. O saldo do membro é calculado
        // localmente sobre as transações dele (dataset pequeno, correto).
        setTotalsFromRpc(null)
        setHistoricalTotals(null)
        setTransactions(totalsPromise as Transaction[])
      } else {
        // supabase.rpc() retorna {data, error} — extrair o data (bug do saldo eterno R$ 0,00:
        // o objeto inteiro era setado e total_income_cents ficava undefined → || 0)
        const { data: rpcData, error: rpcError } =
          (totalsPromise as {
            data: { total_income_cents: number; total_expense_cents: number } | null
            error: any
          }) || {}
        if (rpcError) throw rpcError
        setTotalsFromRpc(rpcData)
        // Mês passado: saldo histórico (até o fim do mês ativo) substitui o global.
        // RPC RETURNS TABLE retorna ARRAY no supabase-js — pegar a 1ª linha.
        const histRow = Array.isArray(historicalRes) ? historicalRes[0] : historicalRes
        setHistoricalTotals(
          histRow && typeof histRow === 'object'
            ? {
                total_income_cents: Number(histRow.total_income_cents) || 0,
                total_expense_cents: Number(histRow.total_expense_cents) || 0,
              }
            : null,
        )
        setTransactions((monthTxRes as Transaction[]) || [])
        setInsights(Array.isArray(insightsRes) ? insightsRes : [])
        setBalanceSeries(Array.isArray(seriesRes) ? seriesRes : [])
      }
      setDefaultBudgets(defBgs)
      setMonthOverrides(overrides)
      setLoadError(false)
    } catch (err: any) {
      console.error('Erro ao carregar dados do início:', err)
      setLoadError(true)
      toast({
        title: 'Não foi possível carregar os dados',
        description: 'Verifique sua conexão. Toque em Tentar novamente para recarregar.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [family, selectedMemberId, currentMonthStr, toast])

  useEffect(() => {
    loadData()
  }, [loadData, refreshTrigger])

  // Renda líquida prevista da família
  const plannedIncomeCents = family?.monthly_net_income_cents || 0

  // Totais de saldo e mês
  const { totalBalanceCents, monthIncomeCents, monthExpenseCents } = useMemo(() => {
    let incomeTotal = 0
    let expenseTotal = 0
    let mIncome = 0
    let mExpense = 0

    // BUG 17/10 (saldo do membro não mudava com o mês): com chip de membro ativo,
    // o saldo era SEMPRE global (todas as transações do membro) — navegar de mês
    // não mudava nada. Agora o saldo do membro também é ACUMULADO ATÉ O FIM do
    // mês ativo (só transações até a última data do mês ativo).
    const endOfMonthDay = new Date(activeDate.getFullYear(), activeDate.getMonth() + 1, 0).getDate()
    const endOfMonthDate = `${currentMonthStr}-${String(endOfMonthDay).padStart(2, '0')}`

    // Sem filtro de membro: totais globais vêm da RPC (agregação no servidor).
    // Mês passado (bug dos "valores fantasmas"): usa o saldo ACUMULADO até o fim
    // do mês ativo (historicalTotals) em vez do global de hoje.
    // Com filtro: calcula localmente sobre as transações do membro.
    const rpcSource = historicalTotals ?? totalsFromRpc
    if (rpcSource) {
      incomeTotal = Number(rpcSource.total_income_cents) || 0
      expenseTotal = Number(rpcSource.total_expense_cents) || 0
    }
    // Com RPC: transactions contém SÓ o mês ativo (fetch dedicado no loadData) — alimenta
    // Receitas/Despesas do mês e anel de progresso. Sem RPC (filtro de membro): transações
    // completas do membro, e o mês é filtrado pelas datas abaixo.
    // IMPORTANTE: quando o RPC alimenta o saldo global, o forEach NÃO pode somar em
    // incomeTotal/expenseTotal de novo (o mês já está incluído nos totais globais) —
    // somar 2x dobrava o saldo exibido (bug do -R$ 1.120,00).
    const effectiveTransactions = transactions.filter((tx) => tx.status !== 'projected')

    effectiveTransactions.forEach((tx) => {
      const txMonth = tx.transaction_date.slice(0, 7)
      const isGlobalFromRpc = !!totalsFromRpc
      // Saldo acumulado até o fim do mês ativo: transações futuras ao mês ativo
      // não entram no saldo (mesmo no fetch completo do membro).
      const countsTowardBalance = tx.transaction_date <= endOfMonthDate
      if (tx.type === 'income') {
        if (!isGlobalFromRpc && countsTowardBalance) incomeTotal += tx.amount_cents
        if (txMonth === currentMonthStr) mIncome += tx.amount_cents
      } else {
        if (!isGlobalFromRpc && countsTowardBalance) expenseTotal += tx.amount_cents
        if (txMonth === currentMonthStr) mExpense += tx.amount_cents
      }
    })

    return {
      totalBalanceCents: incomeTotal - expenseTotal,
      monthIncomeCents: mIncome,
      monthExpenseCents: mExpense,
    }
  }, [transactions, totalsFromRpc, historicalTotals, currentMonthStr, activeDate])
  // Mapa de baldes para categorias
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

  const budgetModelLabel = useMemo(() => {
    const modelId = family?.budget_model
    if (modelId) {
      const found = BUDGET_PRESET_ITEMS.find((item) => item.id === modelId)
      if (found) {
        return found.name
      }
      if (modelId === '60_25_15') {
        return 'Modelo 60 / 25 / 15'
      }
    }
    return 'Modelo 50 / 30 / 20'
  }, [family?.budget_model])

  // Agregação dos 3 Baldes
  const bucketsData = useMemo(() => {
    const netIncomeCents = family?.monthly_net_income_cents || 0

    const defCatBudgetMap: Record<string, DefaultBudget> = {}
    const defSubBudgetMap: Record<string, DefaultBudget> = {}
    defaultBudgets.forEach((b) => {
      if (b.subcategory_id) {
        defSubBudgetMap[b.subcategory_id] = b
      } else {
        defCatBudgetMap[b.category_id] = b
      }
    })

    const overrideCatBudgetMap: Record<string, Budget> = {}
    const overrideSubBudgetMap: Record<string, Budget> = {}
    monthOverrides.forEach((b) => {
      if (b.subcategory_id) {
        overrideSubBudgetMap[b.subcategory_id] = b
      } else {
        overrideCatBudgetMap[b.category_id] = b
      }
    })

    const catSpentMap: Record<string, number> = {}
    transactions.forEach((tx) => {
      if (
        tx.type === 'expense' &&
        tx.status !== 'projected' &&
        tx.transaction_date.slice(0, 7) === currentMonthStr
      ) {
        if (tx.category_id) {
          catSpentMap[tx.category_id] = (catSpentMap[tx.category_id] || 0) + tx.amount_cents
        }
      }
    })

    const bucketsSummary = {
      essentials: { budgetCents: 0, spentCents: 0 },
      lifestyle: { budgetCents: 0, spentCents: 0 },
      future: { budgetCents: 0, spentCents: 0 },
    }

    const expenseCategories = categories.filter((c) => c.type === 'expense')

    expenseCategories.forEach((cat) => {
      const subcats = cat.subcategories || []
      const subcatsLimitSum = subcats.reduce((acc, sub) => {
        const subOverride = overrideSubBudgetMap[sub.id]
        const subDefault = defSubBudgetMap[sub.id]
        const limit = subOverride
          ? subOverride.amount_cents
          : subDefault
            ? subDefault.amount_cents
            : 0
        return acc + limit
      }, 0)

      const catOverride = overrideCatBudgetMap[cat.id]
      const catDefault = defCatBudgetMap[cat.id]
      const explicitLimitCents = catOverride
        ? catOverride.amount_cents
        : catDefault
          ? catDefault.amount_cents
          : 0

      const limitCents = subcatsLimitSum > 0 ? subcatsLimitSum : explicitLimitCents
      const spentCents = catSpentMap[cat.id] || 0

      const bucket = categoryBucketMap.get(cat.id) || 'lifestyle'
      bucketsSummary[bucket].budgetCents += limitCents
      bucketsSummary[bucket].spentCents += spentCents
    })

    transactions.forEach((tx) => {
      if (
        tx.type === 'expense' &&
        tx.status !== 'projected' &&
        tx.transaction_date.slice(0, 7) === currentMonthStr &&
        !tx.category_id
      ) {
        bucketsSummary.lifestyle.spentCents += tx.amount_cents
      }
    })

    const essentialsIncomePct =
      netIncomeCents > 0
        ? Math.round((bucketsSummary.essentials.budgetCents / netIncomeCents) * 100)
        : null
    const lifestyleIncomePct =
      netIncomeCents > 0
        ? Math.round((bucketsSummary.lifestyle.budgetCents / netIncomeCents) * 100)
        : null
    const futureIncomePct =
      netIncomeCents > 0
        ? Math.round((bucketsSummary.future.budgetCents / netIncomeCents) * 100)
        : null

    const essentialsConsumptionPct =
      bucketsSummary.essentials.budgetCents > 0
        ? Math.round(
            (bucketsSummary.essentials.spentCents / bucketsSummary.essentials.budgetCents) * 100,
          )
        : 0
    const lifestyleConsumptionPct =
      bucketsSummary.lifestyle.budgetCents > 0
        ? Math.round(
            (bucketsSummary.lifestyle.spentCents / bucketsSummary.lifestyle.budgetCents) * 100,
          )
        : 0
    const futureConsumptionPct =
      bucketsSummary.future.budgetCents > 0
        ? Math.round((bucketsSummary.future.spentCents / bucketsSummary.future.budgetCents) * 100)
        : 0

    return {
      netIncomeCents,
      hasIncomeConfigured: netIncomeCents > 0,
      essentials: {
        spentCents: bucketsSummary.essentials.spentCents,
        limitCents: bucketsSummary.essentials.budgetCents,
        percent: essentialsConsumptionPct,
        percentIncome: essentialsIncomePct,
        isOver:
          bucketsSummary.essentials.spentCents > bucketsSummary.essentials.budgetCents &&
          bucketsSummary.essentials.budgetCents > 0,
      },
      lifestyle: {
        spentCents: bucketsSummary.lifestyle.spentCents,
        limitCents: bucketsSummary.lifestyle.budgetCents,
        percent: lifestyleConsumptionPct,
        percentIncome: lifestyleIncomePct,
        isOver:
          bucketsSummary.lifestyle.spentCents > bucketsSummary.lifestyle.budgetCents &&
          bucketsSummary.lifestyle.budgetCents > 0,
      },
      future: {
        spentCents: bucketsSummary.future.spentCents,
        limitCents: bucketsSummary.future.budgetCents,
        percent: futureConsumptionPct,
        percentIncome: futureIncomePct,
        isOver:
          bucketsSummary.future.spentCents > bucketsSummary.future.budgetCents &&
          bucketsSummary.future.budgetCents > 0,
      },
    }
  }, [
    family?.monthly_net_income_cents,
    transactions,
    currentMonthStr,
    categoryBucketMap,
    categories,
    defaultBudgets,
    monthOverrides,
  ])

  // R58 Tarefa 4: Gastos por Categoria no mês ativo (top 5-6 categorias, decrescente)
  const categoryExpenses = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; amountCents: number; icon?: string | null; color?: string | null }
    >()
    let totalExpensesInMonth = 0

    transactions.forEach((tx) => {
      if (
        tx.type === 'expense' &&
        tx.status !== 'projected' &&
        tx.transaction_date.slice(0, 7) === currentMonthStr
      ) {
        totalExpensesInMonth += tx.amount_cents
        const catId = tx.category_id || 'sem-categoria'
        const catName = tx.category?.name || 'Outros'
        const current = map.get(catId)
        if (current) {
          current.amountCents += tx.amount_cents
        } else {
          map.set(catId, {
            id: catId,
            name: catName,
            amountCents: tx.amount_cents,
            icon: tx.category?.icon || null,
            color: tx.category?.color || null,
          })
        }
      }
    })

    const list = Array.from(map.values())
      .filter((item) => item.amountCents > 0)
      .sort((a, b) => b.amountCents - a.amountCents)
      .slice(0, 6)

    const maxAmount = list.length > 0 ? list[0].amountCents : 0

    return {
      list,
      totalExpensesInMonth,
      maxAmount,
    }
  }, [transactions, currentMonthStr])

  // Transações recentes
  const recentItems = useMemo(() => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const grouped = groupInstallmentTransactions(transactions, { referenceDate: todayStr })

    const reachedItems = grouped.filter(
      (item) => item.representativeTx?.status !== 'projected' || item.transactionDate <= todayStr,
    )

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

  const memberInitial = currentMember?.name?.charAt(0).toUpperCase() || 'F'

  if (isFamilyIncomplete) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-[#14213D] text-[#FCA311] flex items-center justify-center shadow-lg shadow-[#14213D]/20 mb-4 animate-pulse">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#14213D] tracking-tight">
          Configuração da Família Pendente
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
          O espaço da sua família precisa de alguns passos rápidos para ativar o orçamento
          inteligente e o catálogo de categorias.
        </p>
        <Button
          onClick={openOnboarding}
          className="mt-6 bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold text-sm rounded-2xl px-6 h-12 shadow-md shadow-[#FCA311]/25 border-0"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Retomar Configuração da Família
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-[#F8F9FB]">
      {/* 1. FUNDO MARINHO SANGRADO NO TOPO (#14213D) */}
      <div
        data-testid="hero-bleeding-top"
        className="w-full bg-[#14213D] text-white pt-5 sm:pt-7 pb-10 sm:pb-12 px-4 sm:px-6 relative overflow-hidden"
      >
        {/* Efeitos de luz sutis */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#FCA311]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto space-y-5">
          {/* Linha 1 do cabeçalho (Saudação + Membro + Ações 👁 e 🔔) */}
          <div
            data-testid="header-greeting-row"
            className="flex items-center justify-between gap-2 sm:gap-3 min-w-0"
          >
            {/* Lado Esquerdo: Avatar + Saudação + Família (AFINAÇÃO 16/10: o avatar
                navega pro Perfil — a identidade vem do login, não de uma pergunta.
                O filtro de membros vive nos chips logo abaixo.) */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => navigate('/perfil')}
                className="relative shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311] rounded-2xl active:scale-95 transition-transform cursor-pointer"
                aria-label="Abrir meu perfil"
                title="Meu perfil"
              >
                <Avatar className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border-2 border-white/20 shadow-sm transition-all group-hover:border-[#FCA311] overflow-hidden">
                  {family?.avatar_url && (
                    <AvatarImage
                      src={family.avatar_url}
                      alt={family.name ? `Foto da Família ${family.name}` : 'Foto da Família'}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <AvatarFallback className="bg-gradient-to-tr from-white/10 to-white/20 text-white font-semibold text-xs sm:text-sm rounded-2xl">
                    {memberInitial}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1
                    className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight truncate flex items-center gap-1.5"
                    title={timeGreeting.fullGreetingWithName || `${timeGreeting.rawGreeting}!`}
                  >
                    {timeGreeting.fullGreetingWithName ? (
                      <span className="truncate">{timeGreeting.fullGreetingWithName}</span>
                    ) : isLongLoading ? (
                      <span className="text-sm font-medium text-slate-300 animate-pulse">
                        Carregando seus dados...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 truncate">
                        <span>{timeGreeting.rawGreeting}!</span>
                        <span className="inline-block h-5 w-24 bg-white/20 rounded-md animate-pulse align-middle shrink-0" />
                      </span>
                    )}
                    {timeGreeting.period === 'morning' ? (
                      <Coffee className="w-4 h-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                    ) : timeGreeting.period === 'afternoon' ? (
                      <SunMedium className="w-4 h-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                    ) : (
                      <Moon className="w-4 h-4 text-slate-300 shrink-0" strokeWidth={1.5} />
                    )}
                  </h1>
                </div>
                {family?.name?.trim() ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-[11px] sm:text-xs text-slate-300/80 font-medium leading-none truncate">
                      {formatFamilyDisplayName(family.name)}
                    </p>
                  </div>
                ) : isLongLoading ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-slate-400 italic leading-none truncate">
                      Carregando seus dados...
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Lado Direito: Ações (👁 e 🔔 adaptadas ao fundo marinho) */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={toggleHideValues}
                className="p-1.5 sm:p-2 rounded-2xl text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all active:scale-95 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
                aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
                title={
                  hideValues
                    ? 'Mostrar valores monetários'
                    : 'Ocultar valores monetários (modo privacidade)'
                }
              >
                {hideValues ? (
                  <EyeOff className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2] text-[#FCA311]" />
                ) : (
                  <Eye className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowNotifications(true)}
                className="relative p-1.5 sm:p-2 rounded-2xl text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all active:scale-95 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311]"
                aria-label="Notificações"
                title="Notificações da família"
              >
                <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2]" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FCA311] ring-2 ring-[#14213D]" />
              </button>
            </div>
          </div>

          {/* Linha 2 do cabeçalho: Seletor de mês com tema escuro */}
          <div data-testid="header-month-row" className="flex items-center justify-start min-w-0">
            <MonthSelector variant="chip" theme="dark" />
          </div>

          {/* Filtro horizontal de membros adaptado ao fundo escuro */}
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full"
            role="group"
            aria-label="Filtro de membros"
          >
            <button
              type="button"
              onClick={() => setSelectedMemberId(null)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border touch-manipulation ${
                selectedMemberId === null
                  ? 'bg-[#FCA311] text-[#14213D] border-[#FCA311] shadow-sm'
                  : 'bg-white/10 text-white/80 border-white/10 hover:bg-white/15 hover:text-white'
              }`}
            >
              <Users
                className={`w-3.5 h-3.5 shrink-0 ${
                  selectedMemberId === null ? 'text-[#14213D]' : 'text-slate-300'
                }`}
              />
              <span>Todos</span>
            </button>
            {members.map((m) => {
              const isSelected = selectedMemberId === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMemberId(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border touch-manipulation ${
                    isSelected
                      ? 'bg-[#FCA311] text-[#14213D] border-[#FCA311] shadow-sm'
                      : 'bg-white/10 text-white/80 border-white/10 hover:bg-white/15 hover:text-white'
                  }`}
                  title={m.name}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                      isSelected ? 'bg-[#14213D] text-white' : 'bg-white/20 text-white'
                    }`}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span>{m.name}</span>
                </button>
              )
            })}
          </div>

          {/* UX: erro de carregamento com retry — nunca deixa a tela morta sem explicação */}
          {loadError && !loading && (
            <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    Falha ao atualizar os dados
                  </p>
                  <p className="text-xs text-amber-700">Verifique sua conexão e tente de novo.</p>
                </div>
              </div>
              <button
                onClick={() => loadData()}
                className="shrink-0 rounded-xl bg-[#14213D] px-3.5 py-2 text-xs font-semibold text-white active:scale-95 transition-transform"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* O HERÓI: Saldo mora dentro do bloco sangrado marinho. AFINAÇÃO 16/10:
              label acompanha o filtro (Todos = da Família; membro = nome dele) e o
              expandível 'Ver detalhes' foi REMOVIDO — receitas/despesas do mês já
              estão no próprio herói, progressos vivem em Orçamentos e a tendência
              virou o gráfico 'Evolução do saldo'. Menos informação, mais clareza. */}
          <div
            role="region"
            aria-label="Card de Saldo"
            data-testid="balance-block"
            className="pt-2 sm:pt-4"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs uppercase font-medium tracking-wider text-slate-300">
                {selectedMemberId
                  ? `Saldo de ${members.find((m) => m.id === selectedMemberId)?.name || 'membro'}`
                  : 'Saldo Total da Família'}
              </span>
            </div>

            {loading ? (
              <Skeleton className="h-12 w-52 bg-white/20 rounded-lg my-2" />
            ) : (
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight tabular-nums my-1 sm:my-2 break-words text-white leading-tight">
                {hideValues ? (
                  <span>R$ ••••••</span>
                ) : (
                  <CountUp end={totalBalanceCents} formatter={(v) => formatBRL(v)} />
                )}
              </div>
            )}

            <p className="text-[11px] sm:text-xs text-slate-300/80 mb-5">
              {selectedMemberId
                ? `Filtrado por: ${members.find((m) => m.id === selectedMemberId)?.name}`
                : 'Consolidado de todos os membros'}
            </p>

            {/* Linha de Receitas e Despesas do Mês */}
            <div className="pt-3 border-t border-white/15 flex items-center justify-between gap-3 sm:gap-6">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">
                  <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-slate-300 font-normal block leading-tight">
                    Receitas
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-white tabular-nums block leading-tight mt-0.5 truncate">
                    {maskValue(formatBRL(monthIncomeCents))}
                  </span>
                </div>
              </div>

              <div className="w-px h-8 bg-white/15 shrink-0" aria-hidden="true" />

              <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end sm:justify-start">
                <div className="w-7 h-7 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-300 shrink-0">
                  <ArrowDownRight className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1 text-right sm:text-left">
                  <span className="text-[11px] text-slate-300 font-normal block leading-tight">
                    Despesas
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-white tabular-nums block leading-tight mt-0.5 truncate">
                    {maskValue(formatBRL(monthExpenseCents))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Atalhos Rápidos no Fundo Marinho (Chips consistentes) */}
        </div>
      </div>

      {/* 2. ÁREA CLARA (#F8F9FB) COM CARDS FLUTUANTES SOBREPONDO O FUNDO MARINHO */}
      <div className="relative -mt-6 sm:-mt-8 px-4 sm:px-6 pb-12 max-w-5xl mx-auto space-y-6">
        {/* WALKTHROUGH v3 (19/10): coach-marks na primeira visita (passo 'tour'
            pendente). O convite ao Copilot NÃO é mais um card separado — o
            PRÓPRIO card do Copilot (copilot-card) é a porta de entrada (Matheus
            19/10 21h: "é ela que leva pro chat, ela é o copilot do usuário;
            quando novo deve ser um convite, não essa frase de insight"). */}
        {family &&
          Array.isArray(family.tour_steps_done) &&
          !family.tour_steps_done.includes('tour') && (
            <FirstWalkthrough
              stepsDone={Array.isArray(family.tour_steps_done) ? family.tour_steps_done : []}
              onCompleteStep={(id) =>
                (supabase as any).rpc('mark_tour_step', { p_step: id }).then(() => triggerRefresh())
              }
              onSkip={() =>
                (supabase as any)
                  .rpc('mark_tour_step', { p_step: 'tour' })
                  .then(() => triggerRefresh())
              }
            />
          )}
        {/* COPILOT NA HOME (16/10, v2 — fala do Curiango): card SEMPRE presente.
            Padrão-ouro de personagem conversando (Copilot Money/Monzo chat): o
            pássaro É o remetente (avatar à esquerda, como foto de perfil) e fala
            em 1 frase natural — sem título/subtítulo de notificação. Severidade
            vira hairline colorido discreto à esquerda do balão, não um ponto.
            CONVITE (19/10, Matheus 21h): usuário NOVO (passo 'copilot' pendente
            no tour) → o card É o convite ao chat ("Bem-vindo! Fale comigo —
            toque em mim, eu te ajudo"), não uma frase de insight. Depois do
            1º toque (ou tour concluído) volta à fala normal de insights.
            PAYWALL (17/10): em trial/premium a fala navega pro Copilot; em free
            o card vira teaser do Premium (mesma estética, CTA Assinar). */}
        {access.isPremium ? (
          <button
            type="button"
            data-testid="copilot-card"
            onClick={() => {
              navigate('/copilot')
              if (isNewToCopilot) {
                ;(supabase as any)
                  .rpc('mark_tour_step', { p_step: 'copilot' })
                  .then(() => triggerRefresh())
                  .catch(() => {})
              }
            }}
            className={`w-full text-left flex items-start gap-3 rounded-2xl border border-[rgba(20,33,61,0.08)] bg-white/95 px-4 py-3.5 shadow-sm transition-all active:scale-[0.98] border-l-[3px] ${
              isNewToCopilot
                ? 'border-l-[#FCA311]'
                : insights.length > 0
                  ? {
                      danger: 'border-l-rose-400',
                      warning: 'border-l-amber-400',
                      success: 'border-l-emerald-400',
                      info: 'border-l-slate-300',
                    }[insights[0].severity]
                  : 'border-l-emerald-400'
            }`}
          >
            {/* Avatar do remetente: o próprio Curiango */}
            <span className="shrink-0 relative mt-0.5" aria-hidden="true">
              <CuriangoLogo
                size={40}
                color="#FCA311"
                eyeColor="#14213D"
                eyeRadius={3.4}
                eyeHighlight
                className="animate-copilot-bird"
              />
              <span className="absolute -top-1 -right-1 w-2 h-2 animate-copilot-sparkle" />
            </span>
            <span key={isNewToCopilot ? 'convite' : 'fala'} className="min-w-0 flex-1">
              {isNewToCopilot ? (
                // CONVITE (copy que o Matheus amou, 19/10 21h): 2 linhas com a pena.
                // Quando o tour acaba / 1º toque, o card SE TRANSFORMA na fala de
                // insights (key força remount → animate-in toca na troca).
                <>
                  <span className="block text-[13px] font-semibold leading-tight text-[#14213D] animate-in fade-in duration-300">
                    Bem-vindo! Fale comigo 🪶
                  </span>
                  <span className="block text-[11px] text-slate-500 leading-snug mt-0.5 animate-in fade-in duration-300">
                    Toque em mim — eu lanço, categorizo e organizo pra você.
                  </span>
                </>
              ) : (
                <span className="block text-[13px] leading-snug text-[#14213D] animate-in fade-in duration-300">
                  {insights.length > 0
                    ? insights[0].detail
                    : 'Tudo em ordem por aqui! Toque pra conversar comigo.'}
                </span>
              )}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 self-center" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/perfil')}
            className="w-full text-left flex items-start gap-3 rounded-2xl border border-[rgba(20,33,61,0.08)] bg-white/95 px-4 py-3.5 shadow-sm transition-all active:scale-[0.98] border-l-[3px] border-l-[#FCA311]"
          >
            <span className="shrink-0 relative mt-0.5" aria-hidden="true">
              <CuriangoLogo
                size={40}
                color="#FCA311"
                eyeColor="#14213D"
                eyeRadius={3.4}
                eyeHighlight
                className="animate-copilot-bird"
              />
              <span className="absolute -top-1 -right-1 w-2 h-2 animate-copilot-sparkle" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-snug text-[#14213D]">
                O Curiango analisa suas finanças e fala com você
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Desbloqueie o Copilot com o Premium — toque pra ver os planos
              </span>
            </span>
            <span className="shrink-0 self-center text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#FCA311] text-[#14213D]">
              Premium
            </span>
          </button>
        )}{' '}
        {/* GRÁFICO DE EVOLUÇÃO DO SALDO (gap 1 da auditoria 16/10 — todos os líderes
            têm linha do saldo no tempo: Maybe, Actual, Copilot, Nubank, Monzo).
            Sparkline SVG pura (sem lib), 30 dias, sóbria. Falha silenciosa.
            PAYWALL (17/10): feature Premium — free vê teaser no lugar do gráfico. */}
        {balanceSeries.length > 1 && (
          <PremiumGate
            title="Evolução do saldo"
            description="Veja a linha do tempo do seu saldo dos últimos 30 dias — Premium."
          >
            <BalanceTrendCard series={balanceSeries} hideValues={hideValues} />
          </PremiumGate>
        )}
        {/* PRIMEIRO CARD CLARO: Sobrepõe o marinho com rounded-3xl generoso e sombra R56 */}
        <div
          data-testid="first-floating-card"
          className="bg-white/95 backdrop-blur-sm rounded-3xl p-5 sm:p-7 border border-[rgba(20,33,61,0.06)] shadow-elevation-2 space-y-6"
        >
          {/* Seção A removida (auditoria 16/10): anel de Receitas Previstas migrou para a aba Orçamentos (BudgetOverviewCard), onde tem contexto de renda/previsto. A Home agora abre direto nos Baldes — hierarquia: saldo → mês → baldes. */}

          {/* Seção B: Orçamento em 3 Baldes */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-[#14213D] flex items-center justify-center shrink-0 border border-[rgba(20,33,61,0.04)]">
                  <Scale className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm text-[#14213D] leading-tight">
                    Orçamento em 3 Baldes
                  </h3>
                  {budgetModelLabel && (
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {budgetModelLabel}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/orcamentos')}
                className="text-xs font-semibold text-[#14213D] hover:text-[#14213D] flex items-center gap-1 cursor-pointer"
              >
                <span>Ajustar</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#FCA311]" />
              </button>
            </div>

            {/* As 3 Barras */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  key: 'essentials',
                  name: 'Necessidades',
                  Icon: Shield,
                  percentIncome: bucketsData.essentials.percentIncome,
                  spent: bucketsData.essentials.spentCents,
                  limit: bucketsData.essentials.limitCents,
                  percent: bucketsData.essentials.percent,
                  isOver: bucketsData.essentials.isOver,
                  barGradient: 'bg-gradient-to-r from-[#14213D] to-[#1f3159]',
                },
                {
                  key: 'lifestyle',
                  name: 'Estilo de Vida',
                  Icon: Palmtree,
                  percentIncome: bucketsData.lifestyle.percentIncome,
                  spent: bucketsData.lifestyle.spentCents,
                  limit: bucketsData.lifestyle.limitCents,
                  percent: bucketsData.lifestyle.percent,
                  isOver: bucketsData.lifestyle.isOver,
                  barGradient: 'bg-gradient-to-r from-[#FCA311] to-[#fdb744]',
                },
                {
                  key: 'future',
                  name: 'Futuro & Metas',
                  Icon: Target,
                  percentIncome: bucketsData.future.percentIncome,
                  spent: bucketsData.future.spentCents,
                  limit: bucketsData.future.limitCents,
                  percent: bucketsData.future.percent,
                  isOver: bucketsData.future.isOver,
                  barGradient: 'bg-gradient-to-r from-[#10B981] to-[#34d399]',
                },
              ].map((bucket) => {
                const remaining = bucket.limit - bucket.spent
                const hasSpent = bucket.spent > 0
                const isOver = bucket.isOver
                const BucketIcon = bucket.Icon

                return (
                  <div
                    key={bucket.key}
                    className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1.5"
                  >
                    <div className="flex items-baseline justify-between gap-2 min-w-0">
                      <span className="font-semibold text-slate-800 text-xs flex items-center gap-1.5 min-w-0">
                        <BucketIcon
                          className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                          strokeWidth={1.5}
                        />
                        <span className="font-semibold break-words">{bucket.name}</span>
                        {bucket.percentIncome !== null && (
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">
                            ({bucket.percentIncome}%)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-right tabular-nums">
                      <span className="text-[11px] text-slate-500">
                        {bucket.limit > 0 ? (
                          isOver ? (
                            <span className="font-bold text-rose-600">
                              estourou {maskValue(formatBRL(Math.abs(remaining)))}
                            </span>
                          ) : !hasSpent ? (
                            <span className="font-semibold text-slate-700">
                              resta {maskValue(formatBRL(remaining))}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">
                                (intacto)
                              </span>
                            </span>
                          ) : (
                            <span className="font-bold text-slate-700">
                              resta {maskValue(formatBRL(remaining))}
                            </span>
                          )
                        ) : (
                          <span>{maskValue(formatBRL(bucket.spent))}</span>
                        )}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isOver
                            ? 'bg-gradient-to-r from-[#E11D48] to-[#f43f5e]'
                            : bucket.barGradient
                        }`}
                        style={{ width: `${Math.min(bucket.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-3 text-[10px] text-slate-400 font-medium leading-relaxed text-center sm:text-left">
              Necessidades: moradia e mercado · Estilo: lazer e refeições · Futuro: reserva e metas
            </p>
          </div>
        </div>
        {/* 3. NOVO CARD: GRÁFICO DE BARRAS POR CATEGORIA (R58 Tarefa 4) */}
        <div
          data-testid="category-expenses-card"
          className="bg-white/95 backdrop-blur-sm rounded-3xl p-5 sm:p-7 border border-[rgba(20,33,61,0.06)] shadow-elevation-1 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-[#14213D] flex items-center justify-center shrink-0 border border-[rgba(20,33,61,0.04)]">
                <BarChart3 className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-[#14213D] leading-tight">
                  Gastos por Categoria
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Principais despesas realizadas no mês
                </p>
              </div>
            </div>

            {categoryExpenses.totalExpensesInMonth > 0 && (
              <span className="text-xs font-semibold text-slate-700 tabular-nums">
                Total: {maskValue(formatBRL(categoryExpenses.totalExpensesInMonth))}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3 pt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : categoryExpenses.list.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <BarChart3 className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="text-xs font-semibold text-slate-700">
                Nenhum gasto registrado neste mês
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Suas despesas aparecerão organizadas por categorias aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {categoryExpenses.list.map((item) => {
                const percentOfTotal =
                  categoryExpenses.totalExpensesInMonth > 0
                    ? Math.round((item.amountCents / categoryExpenses.totalExpensesInMonth) * 100)
                    : 0
                const barWidth =
                  categoryExpenses.maxAmount > 0
                    ? Math.round((item.amountCents / categoryExpenses.maxAmount) * 100)
                    : 0

                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#14213D] truncate max-w-[200px] sm:max-w-none">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 tabular-nums">
                        <span className="font-semibold text-slate-700">
                          {maskValue(formatBRL(item.amountCents))}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          ({percentOfTotal}%)
                        </span>
                      </div>
                    </div>

                    {/* Barra de progresso CDS: azul-marinho #14213D com cantos suaves */}
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#14213D] h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${barWidth}%` }}
                        role="progressbar"
                        aria-label={`Gastos na categoria ${item.name}`}
                        aria-valuenow={barWidth}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {/* 4. SEÇÃO ÚLTIMAS TRANSAÇÕES */}
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl border border-[rgba(20,33,61,0.06)] p-5 sm:p-7 shadow-elevation-1">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-base text-[#14213D] break-words">
                Últimas Transações
              </h3>
              <p className="text-xs text-muted-foreground break-words mt-0.5">
                Histórico recente de receitas e despesas
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/carteira')}
              className="text-xs font-semibold text-[#14213D] hover:text-[#14213D] hover:bg-slate-100 rounded-xl px-2.5 py-1.5 shrink-0 h-auto"
            >
              <span>Ver todas</span>
              <ChevronRight className="w-4 h-4 ml-1 text-[#FCA311]" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
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
            <div className="py-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <WalletCards className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">Nenhuma transação ainda</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mb-4">
                Comece adicionando receitas ou despesas compartilhadas pela família.
              </p>
              <Button
                onClick={() => openNewTransaction()}
                className="bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-semibold text-xs rounded-xl shadow-curiango"
              >
                <Plus className="w-4 h-4 mr-1.5 stroke-[1.5]" />
                Adicionar primeira transação
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {recentItems.map((item) => {
                const tx = item.representativeTx
                const isIncome = tx.type === 'income'
                const displayTitle = item.isGroup
                  ? item.baseDescription
                  : formatTransactionTitle(tx)

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedTx(tx)
                      setIsDetailOpen(true)
                    }}
                    className="flex items-start sm:items-center justify-between gap-3 py-3 px-2 sm:px-2.5 hover:bg-slate-50/90 rounded-2xl cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <CategoryIconBox
                        icon={tx.category?.icon}
                        color={tx.category?.color}
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 sm:mt-0"
                        iconClassName="w-4 h-4"
                        strokeWidth={1.5}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <p
                            className="font-medium text-xs sm:text-sm text-[#14213D] group-hover:text-[#14213D] transition-colors break-words leading-tight"
                            title={displayTitle}
                          >
                            {displayTitle}
                          </p>
                          {item.isGroup ? (
                            <span
                              className="inline-flex items-center text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200/70 px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap"
                              title={`Compra parcelada: parcela ${item.currentInstallment} de ${item.totalInstallments}`}
                            >
                              Parcelado • {item.currentInstallment}/{item.totalInstallments}
                            </span>
                          ) : null}
                          {tx.is_recurring ? (
                            <span className="inline-flex items-center text-[9px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300/60 px-1.5 py-0.2 rounded-md shrink-0">
                              Fixa
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 min-w-0 text-xs text-muted-foreground">
                          <span
                            className="inline-flex items-center gap-1 font-normal text-muted-foreground bg-slate-100/80 px-1.5 py-0.5 rounded-md shrink-0 text-xs capitalize"
                            title={`Data: ${item.transactionDate}`}
                          >
                            <Calendar
                              className="w-3 h-3 text-muted-foreground shrink-0"
                              strokeWidth={1.5}
                            />
                            <span>{formatRelativeDate(item.transactionDate)}</span>
                          </span>

                          <span className="text-slate-300 shrink-0 hidden xs:inline">•</span>

                          <span className="inline-flex items-center gap-1 font-normal text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#14213D] text-white flex items-center justify-center text-[7px] font-bold shrink-0">
                              {tx.member?.name?.charAt(0).toUpperCase() || 'M'}
                            </span>
                            <span className="break-words">{tx.member?.name || 'Membro'}</span>
                          </span>

                          <span className="text-slate-300 shrink-0 hidden xs:inline">•</span>

                          {tx.category ? (
                            <span className="font-normal text-muted-foreground text-xs break-words">
                              <span>{tx.category.name}</span>
                              {tx.subcategory && (
                                <span className="text-[#14213D] font-medium ml-1">
                                  · {tx.subcategory.name}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded shrink-0">
                              Pendente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-1 pt-0.5 sm:pt-0">
                      <span
                        className={`font-semibold tracking-tight text-xs sm:text-sm md:text-base tabular-nums whitespace-nowrap ${
                          isIncome ? 'text-[#059669]' : 'text-[#E11D48]'
                        }`}
                      >
                        {hideValues
                          ? 'R$ ••••••'
                          : `${isIncome ? '+' : '−'} ${formatBRL(item.amountCents)}`}
                      </span>
                      {item.isGroup && (
                        <span className="block text-[9px] text-muted-foreground tabular-nums">
                          /parcela
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
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

      {/* PAINEL NOTIFICAÇÕES */}
      {showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)} />}
    </div>
  )
}

/* ============================================================
   GRÁFICO DE EVOLUÇÃO DO SALDO (auditoria 16/10, gap 1)
   Sparkline SVG pura — sem dependência. Card branco sóbrio,
   coerente com o resto da área clara. Mostra valor atual,
   variação no período e a linha dos últimos 30 dias.
   ============================================================ */
function BalanceTrendCard({
  series,
  hideValues,
}: {
  series: Array<{ day: string; balance_cents: number }>
  hideValues: boolean
}) {
  const W = 320
  const H = 64
  const PAD = 4

  const values = series.map((p) => p.balance_cents)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const first = values[0]
  const last = values[values.length - 1]
  const delta = last - first
  const isUp = delta >= 0

  // Pontos da linha (x: 0..W, y: invertido — maior valor no topo)
  const points = values.map((v, i) => {
    const x = series.length > 1 ? (i / (series.length - 1)) * (W - PAD * 2) + PAD : W / 2
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const linePath = `M ${points.join(' L ')}`
  const areaPath = `${linePath} L ${(W - PAD).toFixed(1)},${H} L ${PAD},${H} Z`

  // Cor: verde quando subiu, vermelho quando caiu, cinza quando flat
  const stroke = delta === 0 ? '#94a3b8' : isUp ? '#059669' : '#e11d48'

  // Label do primeiro dia (ex.: "16 set")
  const firstDay = new Date(series[0].day + 'T12:00:00')
  const firstLabel = firstDay.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-5 border border-[rgba(20,33,61,0.06)] shadow-elevation-2">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-[#14213D] leading-tight">Evolução do saldo</h3>
          <p className="text-[10px] text-slate-400 font-medium">
            Últimos 30 dias · desde {firstLabel}
          </p>
        </div>
        <span
          className={`text-xs font-bold tabular-nums px-2 py-1 rounded-full ${
            delta === 0
              ? 'bg-slate-100 text-slate-500'
              : isUp
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
          }`}
        >
          {hideValues
            ? isUp
              ? '↑'
              : delta === 0
                ? '→'
                : '↓'
            : `${isUp ? '+' : delta === 0 ? '' : '−'}${formatBRL(Math.abs(delta))}`}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-16"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={areaPath} fill={stroke} opacity="0.08" />
        <path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Ponto final */}
        <circle
          cx={W - PAD}
          cy={H - PAD - ((last - min) / range) * (H - PAD * 2)}
          r="3"
          fill={stroke}
        />
      </svg>
    </div>
  )
}
