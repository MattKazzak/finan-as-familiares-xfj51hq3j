import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '@/hooks/use-family'
import {
  fetchInvestments,
  createInvestment,
  updateInvestment,
  updateInvestmentPrice,
  deleteInvestment,
  fetchGoals,
} from '@/services/goals-investments'
import { fetchTransactions } from '@/services/transactions'
import { formatBRL, parseBRLToCents, formatNumberBRL, formatDeadline } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import type { Investment, AssetType, Goal } from '@/types/finance'
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Loader2,
  PieChart,
  ShieldAlert,
  Target,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  Building2,
  Landmark,
  Scale,
  Calendar,
  Layers,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { CountUp } from '@/components/common/CountUp'

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: 'Ações',
  fii: 'FIIs',
  fixed_income: 'Renda Fixa',
  treasury: 'Tesouro Direto',
  crypto: 'Cripto',
  other: 'Outros',
}

const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  fixed_income: '#10B981', // Verde esmeralda
  treasury: '#059669', // Verde floresta
  fii: '#8B5CF6', // Roxo
  stock: '#3B82F6', // Azul
  crypto: '#F59E0B', // Âmbar
  other: '#64748B', // Ardósia
}

export default function PatrimonyPage() {
  const { family, refreshTrigger, triggerRefresh } = useFamily()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [investments, setInvestments] = useState<Investment[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalsSavedMap, setGoalsSavedMap] = useState<Record<string, number>>({})
  const [cashBalanceCents, setCashBalanceCents] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  // Diálogo Criar / Editar Ativo Completo
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Investment | null>(null)
  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('stock')
  const [quantity, setQuantity] = useState('1')
  const [avgPriceStr, setAvgPriceStr] = useState('')
  const [currentPriceStr, setCurrentPriceStr] = useState('')
  const [savingAsset, setSavingAsset] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Diálogo Atualização Rápida de Preço Atual
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false)
  const [priceAsset, setPriceAsset] = useState<Investment | null>(null)
  const [newPriceStr, setNewPriceStr] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)

  // Confirmação de exclusão
  const [assetToDelete, setAssetToDelete] = useState<Investment | null>(null)

  // Dívidas (Placeholder expansível / explicativo)
  const [showDebtExplainer, setShowDebtExplainer] = useState(false)

  const loadPatrimonyData = useCallback(async () => {
    if (!family) return
    try {
      setLoading(true)
      const [invData, goalsData, txs] = await Promise.all([
        fetchInvestments(family.id),
        fetchGoals(family.id),
        fetchTransactions({ familyId: family.id }),
      ])

      setInvestments(invData)
      setGoals(goalsData)

      // Calcula saldo líquido das transações em conta corrente / caixa
      let cashBalance = 0
      const savedMap: Record<string, number> = {}

      txs.forEach((tx) => {
        if (tx.type === 'income') {
          cashBalance += tx.amount_cents
        } else if (tx.type === 'expense') {
          cashBalance -= tx.amount_cents
        }

        // Metas vinculadas
        if (tx.category_id && tx.type === 'income') {
          goalsData.forEach((g) => {
            if (g.category_id === tx.category_id) {
              savedMap[g.id] = (savedMap[g.id] || 0) + tx.amount_cents
            }
          })
        }
      })

      setCashBalanceCents(cashBalance)
      setGoalsSavedMap(savedMap)
    } catch (err: any) {
      console.error('Erro ao carregar dados do patrimônio:', err)
      toast({
        title: 'Não foi possível carregar o patrimônio',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [family, toast])

  useEffect(() => {
    loadPatrimonyData()
  }, [loadPatrimonyData, refreshTrigger])

  // Cálculos da Carteira de Investimentos
  const {
    totalInvestmentsCurrentCents,
    totalInvestmentsCostCents,
    totalProfitCents,
    totalProfitPercent,
  } = useMemo(() => {
    let currentTotal = 0
    let costTotal = 0

    investments.forEach((inv) => {
      const qty = Number(inv.quantity) || 0
      currentTotal += Math.round(qty * inv.current_price_cents)
      costTotal += Math.round(qty * inv.avg_price_cents)
    })

    const profit = currentTotal - costTotal
    const percent = costTotal > 0 ? ((profit / costTotal) * 100).toFixed(2) : '0.00'

    return {
      totalInvestmentsCurrentCents: currentTotal,
      totalInvestmentsCostCents: costTotal,
      totalProfitCents: profit,
      totalProfitPercent: percent,
    }
  }, [investments])

  // Total guardado em Metas
  const totalGoalsSavedCents = useMemo(() => {
    return Object.values(goalsSavedMap).reduce((acc, val) => acc + val, 0)
  }, [goalsSavedMap])

  // Total do Passivo / Dívidas (seção estruturada)
  const totalLiabilitiesCents = 0 // Preparado para quando módulo de dívidas for persistido

  // Patrimônio Líquido Consolidado = Ativos (Investimentos + Saldo em Conta positivo) - Passivos
  const netWorthCents = useMemo(() => {
    const positiveCash = Math.max(0, cashBalanceCents)
    const grossAssets = totalInvestmentsCurrentCents + positiveCash
    return grossAssets - totalLiabilitiesCents
  }, [totalInvestmentsCurrentCents, cashBalanceCents, totalLiabilitiesCents])

  // Distribuição por classe de ativo
  const assetClassBreakdown = useMemo(() => {
    const breakdown: Record<AssetType, number> = {
      fixed_income: 0,
      treasury: 0,
      fii: 0,
      stock: 0,
      crypto: 0,
      other: 0,
    }

    investments.forEach((inv) => {
      const qty = Number(inv.quantity) || 0
      const val = Math.round(qty * inv.current_price_cents)
      if (breakdown[inv.asset_type] !== undefined) {
        breakdown[inv.asset_type] += val
      } else {
        breakdown.other += val
      }
    })

    const total = totalInvestmentsCurrentCents > 0 ? totalInvestmentsCurrentCents : 1
    return Object.entries(breakdown)
      .map(([type, amountCents]) => ({
        type: type as AssetType,
        label: ASSET_TYPE_LABELS[type as AssetType] || type,
        amountCents,
        percent: ((amountCents / total) * 100).toFixed(1),
        color: ASSET_TYPE_COLORS[type as AssetType] || '#64748B',
      }))
      .filter((item) => item.amountCents > 0)
  }, [investments, totalInvestmentsCurrentCents])

  // Alocação Ideal Sugerida (CDS Finance - Padrão 3 Baldes / Investimentos Familiares)
  const targetAllocation = [
    { label: 'Renda Fixa & Reserva', targetPct: 50, color: '#10B981' },
    { label: 'FIIs / Imóveis', targetPct: 25, color: '#8B5CF6' },
    { label: 'Ações Globais/Brasil', targetPct: 20, color: '#3B82F6' },
    { label: 'Oportunidades / Cripto', targetPct: 5, color: '#F59E0B' },
  ]

  const openCreateDialog = () => {
    setEditingAsset(null)
    setName('')
    setTicker('')
    setAssetType('stock')
    setQuantity('1')
    setAvgPriceStr('')
    setCurrentPriceStr('')
    setErrorMsg(null)
    setIsAssetDialogOpen(true)
  }

  const openEditDialog = (asset: Investment) => {
    setEditingAsset(asset)
    setName(asset.name)
    setTicker(asset.ticker || '')
    setAssetType(asset.asset_type)
    setQuantity(String(asset.quantity))
    setAvgPriceStr(formatNumberBRL(asset.avg_price_cents))
    setCurrentPriceStr(formatNumberBRL(asset.current_price_cents))
    setErrorMsg(null)
    setIsAssetDialogOpen(true)
  }

  const openPriceDialog = (asset: Investment) => {
    setPriceAsset(asset)
    setNewPriceStr(formatNumberBRL(asset.current_price_cents))
    setIsPriceDialogOpen(true)
  }

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family) return
    setErrorMsg(null)

    if (!name.trim()) {
      setErrorMsg('Informe o nome do ativo.')
      return
    }

    const qtyNum = parseFloat(quantity.replace(',', '.'))
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setErrorMsg('Informe uma quantidade válida.')
      return
    }

    const avgCents = parseBRLToCents(avgPriceStr)
    const currentCents = parseBRLToCents(currentPriceStr || avgPriceStr)

    if (avgCents <= 0) {
      setErrorMsg('Informe o preço médio de compra.')
      return
    }

    try {
      setSavingAsset(true)
      if (editingAsset) {
        await updateInvestment(editingAsset.id, {
          name: name.trim(),
          ticker: ticker.trim().toUpperCase() || null,
          asset_type: assetType,
          quantity: qtyNum,
          avg_price_cents: avgCents,
          current_price_cents: currentCents,
        })
        toast({ title: 'Sucesso', description: 'Ativo atualizado!' })
      } else {
        await createInvestment({
          family_id: family.id,
          name: name.trim(),
          ticker: ticker.trim().toUpperCase() || null,
          asset_type: assetType,
          quantity: qtyNum,
          avg_price_cents: avgCents,
          current_price_cents: currentCents,
        })
        toast({ title: 'Sucesso', description: 'Ativo adicionado à carteira!' })
      }

      setIsAssetDialogOpen(false)
      loadPatrimonyData()
      triggerRefresh()
    } catch {
      setErrorMsg('Erro ao salvar ativo. Tente novamente.')
    } finally {
      setSavingAsset(false)
    }
  }

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!priceAsset) return
    const cents = parseBRLToCents(newPriceStr)

    try {
      setSavingPrice(true)
      await updateInvestmentPrice(priceAsset.id, cents)
      toast({ title: 'Preço atualizado', description: 'Rentabilidade recalculada.' })
      setIsPriceDialogOpen(false)
      loadPatrimonyData()
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao atualizar preço',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingPrice(false)
    }
  }

  const handleDeleteAsset = async () => {
    if (!assetToDelete) return
    try {
      await deleteInvestment(assetToDelete.id)
      setInvestments((prev) => prev.filter((a) => a.id !== assetToDelete.id))
      toast({ title: 'Ativo removido da carteira.' })
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao excluir ativo',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setAssetToDelete(null)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto w-full min-w-0 pb-12">
      {/* 1. HERO — VISÃO CONSOLIDADA DO PATRIMÔNIO LÍQUIDO */}
      <div className="bg-gradient-to-br from-ink via-[#1a2b4e] to-[#0f192e] text-white rounded-3xl p-6 sm:p-8 shadow-elevation-2 border border-white/10 relative overflow-hidden">
        {/* Luzes decorativas de fundo CDS */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-action/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs uppercase font-semibold tracking-wider text-white/70">
                  Gestão Consolidada de Patrimônio
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                Patrimônio Líquido da Família
              </h1>
              <p className="text-xs sm:text-sm text-white/70 mt-0.5">
                O que vocês têm somado, menos o que devem (ativos reais - passivos)
              </p>
            </div>

            <Button
              onClick={openCreateDialog}
              className="bg-action hover:bg-action-hover text-white font-bold text-xs rounded-xl shadow-md gap-1.5 border-0 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Adicionar Ativo</span>
            </Button>
          </div>

          {/* Valor Principal em Destaque */}
          <div className="pt-2">
            <span className="text-xs text-white/60 font-medium block">Total Líquido Estimado</span>
            {loading ? (
              <div className="h-12 w-48 bg-white/10 rounded-xl animate-pulse my-2" />
            ) : (
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight tabular-nums text-white my-1">
                <CountUp end={netWorthCents} formatter={(v) => formatBRL(v)} />
              </div>
            )}
            <p className="text-xs text-white/70">
              {investments.length}{' '}
              {investments.length === 1 ? 'ativo registrado' : 'ativos registrados'} na carteira
            </p>
          </div>

          {/* Grid de Balanço: O que Tem vs O que Deve */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/10">
            {/* 1. Ativos Investidos */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-xs">
              <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Investimentos
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    totalProfitCents >= 0
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {Number(totalProfitPercent) >= 0 ? '+' : ''}
                  {totalProfitPercent}%
                </span>
              </div>
              <div className="text-lg font-bold text-white tabular-nums">
                {formatBRL(totalInvestmentsCurrentCents)}
              </div>
              <span className="text-[11px] text-white/60 mt-0.5 block">
                Custo: {formatBRL(totalInvestmentsCostCents)}
              </span>
            </div>

            {/* 2. Saldo Líquido de Caixa */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-xs">
              <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Landmark className="w-4 h-4 text-action" />
                  Caixa & Contas
                </span>
                <span className="text-[10px] font-semibold text-white/60">Liquidez</span>
              </div>
              <div className="text-lg font-bold text-white tabular-nums">
                {formatBRL(cashBalanceCents)}
              </div>
              <span className="text-[11px] text-white/60 mt-0.5 block">Disponível nas contas</span>
            </div>

            {/* 3. Dívidas & Financiamentos (Passivo) */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-xs">
              <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Building2 className="w-4 h-4 text-rose-400" />
                  Dívidas & Passivo
                </span>
                <span className="text-[10px] font-semibold text-emerald-400">Zero registrado</span>
              </div>
              <div className="text-lg font-bold text-white tabular-nums">
                {formatBRL(totalLiabilitiesCents)}
              </div>
              <span className="text-[11px] text-white/60 mt-0.5 block">
                Sem dívidas cadastradas
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DISTRIBUIÇÃO POR CLASSE DE ATIVO */}
      {assetClassBreakdown.length > 0 && (
        <div className="bg-surface/95 rounded-3xl p-5 sm:p-6 border border-line shadow-elevation-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                Distribuição da Carteira por Classe
              </h3>
              <p className="text-xs text-body2">Divisão real dos seus investimentos cadastrados</p>
            </div>
            <span className="text-xs font-semibold text-body2 tabular-nums">
              {formatBRL(totalInvestmentsCurrentCents)}
            </span>
          </div>

          {/* Barra de Distribuição Segmentada CDS */}
          <div className="w-full h-3 rounded-full bg-surface-2 flex overflow-hidden shadow-inner my-3">
            {assetClassBreakdown.map((item) => (
              <div
                key={item.type}
                style={{
                  width: `${item.percent}%`,
                  backgroundColor: item.color,
                }}
                title={`${item.label}: ${item.percent}% (${formatBRL(item.amountCents)})`}
                className="h-full transition-all duration-500 hover:opacity-85"
              />
            ))}
          </div>

          {/* Legenda com percentuais */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-2">
            {assetClassBreakdown.map((item) => (
              <div
                key={item.type}
                className="p-2.5 rounded-2xl bg-surface-2 border border-line flex flex-col justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-medium text-white truncate">{item.label}</span>
                </div>
                <div className="mt-1">
                  <span className="text-sm font-bold text-white block tabular-nums">
                    {item.percent}%
                  </span>
                  <span className="text-[10px] text-body2 tabular-nums">
                    {formatBRL(item.amountCents)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. SEÇÃO PRINCIPAL — CARTEIRA DE INVESTIMENTOS (DADOS REAIS FUNCIONAIS) */}
      <div className="bg-surface/95 rounded-3xl border border-line p-5 sm:p-6 shadow-elevation-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-action" />
              Carteira de Ativos
            </h3>
            <p className="text-xs text-body2">
              Ações, Fundos Imobiliários, Renda Fixa e Cripto da família
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={openCreateDialog}
              size="sm"
              className="bg-action hover:bg-action-hover text-white font-bold text-xs rounded-xl shadow-xs gap-1 border-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Novo Ativo</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-body3">
            Carregando ativos da carteira...
          </div>
        ) : investments.length === 0 ? (
          /* Empty State Amigável CDS */
          <div className="py-12 text-center bg-surface-2/50 rounded-2xl border border-dashed border-line p-6">
            <div className="w-14 h-14 rounded-2xl bg-surface-2 text-white flex items-center justify-center mx-auto mb-3 border border-line">
              <PieChart className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h4 className="font-bold text-white text-sm">Nenhum investimento registrado</h4>
            <p className="text-xs text-body2 mt-1 max-w-xs mx-auto mb-4">
              Cadastre suas aplicações de renda fixa, Tesouro, fundos ou ações para acompanhar o
              patrimônio líquido consolidado.
            </p>
            <Button
              onClick={openCreateDialog}
              className="bg-action hover:bg-action-hover text-white text-xs font-bold rounded-xl shadow-xs border-0"
            >
              <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
              Adicionar primeiro ativo
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {investments.map((asset) => {
              const qty = Number(asset.quantity) || 0
              const totalValCents = Math.round(qty * asset.current_price_cents)
              const costValCents = Math.round(qty * asset.avg_price_cents)
              const profitCents = totalValCents - costValCents
              const profitPct =
                costValCents > 0 ? ((profitCents / costValCents) * 100).toFixed(2) : '0.00'
              const isPositive = profitCents >= 0

              return (
                <div
                  key={asset.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/70 rounded-2xl px-2 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5 shadow-sm"
                      style={{
                        backgroundColor: ASSET_TYPE_COLORS[asset.asset_type] || '#64748B',
                      }}
                    >
                      {asset.ticker ? asset.ticker.slice(0, 4) : 'ATV'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white group-hover:text-income transition-colors">
                          {asset.name}
                        </span>{' '}
                        {asset.ticker && (
                          <span className="text-[11px] font-semibold text-body2 bg-surface-2 px-1.5 py-0.5 rounded">
                            {asset.ticker}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-body2 border border-line px-1.5 py-0.2 rounded-full">
                          {ASSET_TYPE_LABELS[asset.asset_type]}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-body2 mt-1">
                        <span>
                          Qtd: <strong className="text-white">{asset.quantity}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          PM:{' '}
                          <strong className="text-white">{formatBRL(asset.avg_price_cents)}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Atual:{' '}
                          <strong className="text-white">
                            {formatBRL(asset.current_price_cents)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Valor Total do Ativo e Rentabilidade */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-13 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <div className="text-sm sm:text-base font-semibold text-white tabular-nums">
                        {formatBRL(totalValCents)}
                      </div>
                      <div
                        className={`text-xs font-bold tabular-nums flex items-center sm:justify-end gap-1 ${
                          isPositive ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {formatBRL(profitCents)} ({isPositive ? '+' : ''}
                        {profitPct}%)
                      </div>
                    </div>

                    {/* Ações (Atualizar Preço, Editar, Excluir) */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openPriceDialog(asset)}
                        className="p-1.5 text-body3 hover:text-income hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
                        title="Atualizar cotação"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDialog(asset)}
                        className="p-1.5 text-body3 hover:text-white hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
                        title="Editar ativo"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssetToDelete(asset)}
                        className="p-1.5 text-body3 hover:text-rose-400 hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
                        title="Excluir ativo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. SEÇÃO METAS CONECTADAS AOS BALDES (ESTRUTURADA COM DADOS REAIS EXISTENTES) */}
      <div className="bg-surface/95 rounded-3xl border border-line p-5 sm:p-6 shadow-elevation-1">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              Metas Financeiras (Balde do Futuro)
            </h3>
            <p className="text-xs text-body2">
              Objetivos da família alinhados à reserva de emergência e planos futuros
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/metas')}
            className="text-xs font-semibold text-white hover:text-action hover:bg-surface-2 gap-1 rounded-xl"
          >
            <span>Ver todas as metas</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {goals.length === 0 ? (
          <div className="p-4 rounded-2xl bg-surface-2 border border-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Planeje os sonhos da família</p>
                <p className="text-[11px] text-body2">
                  Crie metas de curto e longo prazo (reserva, viagem, estudos) para acompanhar o
                  progresso.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/metas')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shrink-0 border-0"
            >
              Criar Meta
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {goals.slice(0, 3).map((goal) => {
              const savedCents = goalsSavedMap[goal.id] || 0
              const pct = Math.min(Math.round((savedCents / goal.target_amount_cents) * 100), 100)
              return (
                <div
                  key={goal.id}
                  onClick={() => navigate('/metas')}
                  className="p-4 rounded-2xl bg-surface-2/70 border border-line hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-white truncate">{goal.name}</span>
                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden my-2">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-body2">
                    <span>{formatBRL(savedCents)}</span>
                    <span>de {formatBRL(goal.target_amount_cents)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 5. SEÇÃO DÍVIDAS E FINANCIAMENTOS (LADO PASSIVO — PREPARADA PARA EVOLUIR) */}
      <div className="bg-surface/95 rounded-3xl border border-line p-5 sm:p-6 shadow-elevation-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-rose-400" />
            <h3 className="font-bold text-base text-white">Dívidas & Financiamentos (Passivo)</h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-2 text-body2">
            Em evolução
          </span>
        </div>
        <p className="text-xs text-body2 mb-4">
          Acompanhe empréstimos, financiamento imobiliário ou veicular para abater do patrimônio
          bruto.
        </p>

        <div className="p-4 rounded-2xl bg-surface-2 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-body3 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-white">
                Lado Passivo do Balanço Patrimonial
              </p>
              <p className="text-[11px] text-body2 leading-relaxed mt-0.5">
                Hoje sua família não possui pendências registradas. Nas próximas rodadas você poderá
                cadastrar contratos, taxas de juros e amortizações SAC/Price.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebtExplainer(!showDebtExplainer)}
            className="text-xs font-semibold text-white border-line rounded-xl shrink-0 self-start sm:self-auto bg-surface-2 hover:bg-surface"
          >
            {showDebtExplainer ? 'Ocultar detalhes' : 'Como vai funcionar?'}
          </Button>
        </div>

        {showDebtExplainer && (
          <div className="mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed animate-in fade-in duration-200">
            <p className="font-semibold mb-1 flex items-center gap-1.5 text-amber-300">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              Gestão Ativa de Dívidas Curiangoo:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-200/90">
              <li>Cálculo automático de saldo devedor e impacto no patrimônio líquido</li>
              <li>Estratégias de quitação inteligente (Bola de Neve vs Avalanche)</li>
              <li>Simulador de amortização antecipada com economia real de juros</li>
            </ul>
          </div>
        )}
      </div>

      {/* 6. ALOCAÇÃO IDEAL VS REAL (PREPARADA PARA EVOLUIR) */}
      <div className="bg-surface/95 rounded-3xl border border-line p-5 sm:p-6 shadow-elevation-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-action" />
            <h3 className="font-bold text-base text-white">Alocação Ideal vs. Alocação Real</h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-2 text-action border border-line">
            Rebalanceamento
          </span>
        </div>
        <p className="text-xs text-body2 mb-4">
          Compare a distribuição recomendada para seu perfil familiar com a posição atual da
          carteira.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {targetAllocation.map((item) => (
            <div
              key={item.label}
              className="p-3.5 rounded-2xl bg-surface-2 border border-line flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-semibold text-white truncate">{item.label}</span>
                </div>
                <div className="text-xs text-body2 mt-2">
                  Meta Ideal: <strong className="text-white font-bold">{item.targetPct}%</strong>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-line flex items-center justify-between text-[10px] text-body3">
                <span>Status</span>
                <span className="font-semibold text-body2">Alinhado</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DIÁLOGO CRIAR / EDITAR ATIVO COMPLETO */}
      <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">
              {editingAsset ? 'Editar Ativo' : 'Adicionar Ativo ao Patrimônio'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveAsset} className="space-y-3.5">
            {errorMsg && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl">
                {errorMsg}
              </div>
            )}

            <div>
              <Label htmlFor="asset-name" className="text-xs font-semibold text-white">
                Nome do Ativo
              </Label>
              <Input
                id="asset-name"
                type="text"
                placeholder="Ex.: Tesouro Selic 2029, Itaú PN, MXRF11"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="asset-ticker" className="text-xs font-semibold text-white">
                  Ticker / Código
                </Label>
                <Input
                  id="asset-ticker"
                  type="text"
                  placeholder="ITUB4, MXRF11"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="mt-1 uppercase"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-white">Classe de Ativo</Label>
                <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed_income">Renda Fixa</SelectItem>
                    <SelectItem value="treasury">Tesouro Direto</SelectItem>
                    <SelectItem value="fii">FII</SelectItem>
                    <SelectItem value="stock">Ação</SelectItem>
                    <SelectItem value="crypto">Cripto</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="asset-qty" className="text-xs font-semibold text-white">
                Quantidade
              </Label>
              <Input
                id="asset-qty"
                type="text"
                inputMode="decimal"
                placeholder="100 ou 1.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="asset-pm" className="text-xs font-semibold text-white">
                  Preço Médio (R$)
                </Label>
                <Input
                  id="asset-pm"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={avgPriceStr}
                  onChange={(e) => setAvgPriceStr(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="asset-price" className="text-xs font-semibold text-white">
                  Preço Atual (R$)
                </Label>
                <Input
                  id="asset-price"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={currentPriceStr}
                  onChange={(e) => setCurrentPriceStr(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssetDialogOpen(false)}
                disabled={savingAsset}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingAsset}
                className="bg-action hover:bg-action-hover text-white font-bold"
              >
                {savingAsset && <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />}
                {editingAsset ? 'Salvar Alterações' : 'Adicionar ao Patrimônio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO ATUALIZAR PREÇO RÁPIDO */}
      <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
        <DialogContent className="max-w-xs w-[90vw] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">
              Atualizar Cotação Atual
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePrice} className="space-y-4">
            <p className="text-xs text-body2">
              Atualize o valor de mercado de{' '}
              <strong className="text-white">{priceAsset?.name}</strong> para recalcular o
              patrimônio da família.
            </p>

            <div>
              <Label htmlFor="quick-price" className="text-xs font-semibold text-white">
                Novo Preço Unitário (R$)
              </Label>
              <Input
                id="quick-price"
                type="text"
                inputMode="decimal"
                value={newPriceStr}
                onChange={(e) => setNewPriceStr(e.target.value)}
                className="mt-1 text-base font-bold tabular-nums"
                autoFocus
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPriceDialogOpen(false)}
                disabled={savingPrice}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingPrice}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {savingPrice && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                Atualizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO DE ATIVO */}
      <AlertDialog open={!!assetToDelete} onOpenChange={(open) => !open && setAssetToDelete(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-white">
              Remover ativo da carteira?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-body2">
              {assetToDelete?.name} será removido do cálculo de patrimônio da família.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAsset}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
