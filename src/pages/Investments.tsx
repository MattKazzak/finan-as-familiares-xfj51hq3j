import { useState, useEffect, useMemo, useCallback } from 'react'
import { useFamily } from '@/hooks/use-family'
import {
  fetchInvestments,
  createInvestment,
  updateInvestment,
  updateInvestmentPrice,
  deleteInvestment,
} from '@/services/goals-investments'
import { formatBRL, parseBRLToCents, formatNumberBRL } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import type { Investment, AssetType } from '@/types/finance'
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Edit3,
  Trash2,
  RefreshCw,
  Loader2,
  PieChart,
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

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: 'Ação',
  fii: 'FII',
  fixed_income: 'Renda Fixa',
  crypto: 'Cripto',
  treasury: 'Tesouro Direto',
  other: 'Outros',
}

const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  stock: '#3B82F6',
  fii: '#8B5CF6',
  fixed_income: '#10B981',
  crypto: '#F59E0B',
  treasury: '#06B6D4',
  other: '#64748B',
}

export default function InvestmentsPage() {
  const { family, refreshTrigger } = useFamily()
  const { toast } = useToast()

  const [investments, setInvestments] = useState<Investment[]>([])
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

  const loadInvestments = useCallback(async () => {
    if (!family) return
    try {
      setLoading(true)
      const data = await fetchInvestments(family.id)
      setInvestments(data)
    } catch (err: any) {
      console.error('Erro ao carregar investimentos:', err)
      toast({
        title: 'Não foi possível carregar os investimentos',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [family, toast])

  useEffect(() => {
    loadInvestments()
  }, [loadInvestments, refreshTrigger])

  // Resumo Geral do Topo
  const { totalCurrentValueCents, totalCostCents, totalProfitCents, totalProfitPercent } =
    useMemo(() => {
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
        totalCurrentValueCents: currentTotal,
        totalCostCents: costTotal,
        totalProfitCents: profit,
        totalProfitPercent: percent,
      }
    }, [investments])

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
      loadInvestments()
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
      loadInvestments()
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Header com Ação "+ Adicionar Ativo" */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Carteira de Investimentos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Acompanhe o patrimônio da família, custo de aquisição e rentabilidade
          </p>
        </div>

        <Button
          onClick={openCreateDialog}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>+ Adicionar Ativo</span>
        </Button>
      </div>

      {/* 2. Resumo da Carteira no Topo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Valor Total da Carteira */}
        <div className="bg-gradient-to-br from-[#059669] to-[#0F766E] rounded-3xl p-6 text-white shadow-lg shadow-emerald-950/10">
          <span className="text-xs uppercase font-bold tracking-wider text-emerald-100">
            Valor Total da Carteira
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold tabular-nums mt-1.5">
            {formatBRL(totalCurrentValueCents)}
          </div>
          <p className="text-xs text-emerald-100/80 mt-1">Soma de todos os ativos atuais</p>
        </div>

        {/* Custo de Aquisição */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Custo de Aquisição
            </span>
            <div className="text-xl sm:text-2xl font-bold text-slate-800 tabular-nums mt-1.5">
              {formatBRL(totalCostCents)}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Total investido originalmente</p>
        </div>

        {/* Lucro / Prejuízo Total */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Lucro / Prejuízo
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  totalProfitCents >= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {Number(totalProfitPercent) >= 0 ? '+' : ''}
                {totalProfitPercent}%
              </span>
            </div>
            <div
              className={`text-xl sm:text-2xl font-extrabold tabular-nums mt-1.5 flex items-center gap-1.5 ${
                totalProfitCents >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {totalProfitCents >= 0 ? (
                <TrendingUp className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <TrendingDown className="w-5 h-5 stroke-[2.5]" />
              )}
              <span>
                {totalProfitCents >= 0 ? '+' : ''}
                {formatBRL(totalProfitCents)}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Rentabilidade acumulada da carteira</p>
        </div>
      </div>

      {/* 3. Lista de Ativos */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Ativos da Família</h3>
            <p className="text-xs text-slate-500">
              Ações, Fundos Imobiliários, Renda Fixa e Criptoativos
            </p>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {investments.length} {investments.length === 1 ? 'ativo' : 'ativos'}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Carregando investimentos...
          </div>
        ) : investments.length === 0 ? (
          /* Empty State */
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <PieChart className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h4 className="font-bold text-slate-800 text-base">Nenhum investimento cadastrado</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto mb-5">
              Comece a registrar os ativos de renda fixa, ações e fundos da família.
            </p>
            <Button
              onClick={openCreateDialog}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar primeiro ativo
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
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
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 rounded-2xl px-2 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5 shadow-sm"
                      style={{
                        backgroundColor: ASSET_TYPE_COLORS[asset.asset_type] || '#64748B',
                      }}
                    >
                      {asset.ticker ? asset.ticker.slice(0, 3) : 'ATV'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {asset.name}
                        </span>
                        {asset.ticker && (
                          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {asset.ticker}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-slate-500 border border-slate-200 px-1.5 py-0.2 rounded-full">
                          {ASSET_TYPE_LABELS[asset.asset_type]}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                        <span>
                          Qtd: <strong className="text-slate-800">{asset.quantity}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          PM:{' '}
                          <strong className="text-slate-800">
                            {formatBRL(asset.avg_price_cents)}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Atual:{' '}
                          <strong className="text-slate-800">
                            {formatBRL(asset.current_price_cents)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Valor Total do Ativo e Rentabilidade */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-13 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <div className="text-sm sm:text-base font-extrabold text-slate-900 tabular-nums">
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
                        onClick={() => openPriceDialog(asset)}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Atualizar preço atual"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditDialog(asset)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar ativo"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setAssetToDelete(asset)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* DIÁLOGO CRIAR / EDITAR ATIVO COMPLETO */}
      <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingAsset ? 'Editar Ativo' : 'Adicionar Ativo à Carteira'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveAsset} className="space-y-3.5">
            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl">
                {errorMsg}
              </div>
            )}

            <div>
              <Label htmlFor="asset-name" className="text-xs font-semibold text-slate-700">
                Nome do Ativo
              </Label>
              <Input
                id="asset-name"
                type="text"
                placeholder="Ex.: Itaú Unibanco PN, Tesouro Selic 2029"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="asset-ticker" className="text-xs font-semibold text-slate-700">
                  Ticker (opcional)
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
                <Label className="text-xs font-semibold text-slate-700">Tipo de Ativo</Label>
                <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock">Ação</SelectItem>
                    <SelectItem value="fii">FII</SelectItem>
                    <SelectItem value="fixed_income">Renda Fixa</SelectItem>
                    <SelectItem value="treasury">Tesouro Direto</SelectItem>
                    <SelectItem value="crypto">Cripto</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="asset-qty" className="text-xs font-semibold text-slate-700">
                Quantidade
              </Label>
              <Input
                id="asset-qty"
                type="text"
                inputMode="decimal"
                placeholder="100 ou 2.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="asset-pm" className="text-xs font-semibold text-slate-700">
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
                <Label htmlFor="asset-price" className="text-xs font-semibold text-slate-700">
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {savingAsset && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingAsset ? 'Salvar Alterações' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO ATUALIZAR PREÇO RÁPIDO */}
      <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
        <DialogContent className="max-w-xs w-[90vw] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Atualizar Preço Atual
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePrice} className="space-y-4">
            <p className="text-xs text-slate-500">
              Atualize a cotação de <strong>{priceAsset?.name}</strong> para recalcular os ganhos.
            </p>

            <div>
              <Label htmlFor="quick-price" className="text-xs font-semibold text-slate-700">
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              Remover ativo da carteira?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500">
              {assetToDelete?.name} será removido do portfólio da família.
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
