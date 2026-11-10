import React, { useState, useMemo, useEffect } from 'react'
import type {
  Transaction,
  TransactionCategory,
  TransactionSubcategory,
  BudgetBucket,
  FamilyMember,
  TransactionType,
} from '@/types/finance'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { ContextualSubcategorySelector } from '@/components/categories/ContextualSubcategorySelector'
import { formatBRL } from '@/lib/formatters'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Check,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
} from 'lucide-react'

export interface SaveInlineCategoryData {
  transactionId: string
  categoryId: string
  subcategoryId: string | null
  rememberRule: boolean
  description: string
  type?: TransactionType
  memberId?: string
  date?: string
}

export interface SaveBatchSameNameData {
  pattern: string
  transactionIds: string[]
  categoryId: string
  subcategoryId: string | null
  rememberRule: boolean
  type?: TransactionType
  description: string
}

interface TransactionInlineRowProps {
  transaction: Transaction
  categories: TransactionCategory[]
  members?: FamilyMember[]
  isExpanded?: boolean
  onToggleExpand?: () => void
  onSave: (data: SaveInlineCategoryData) => Promise<void>
  onSaveBatchSameName?: (data: SaveBatchSameNameData) => Promise<void>
  matchingCount?: number
  matchingTransactionIds?: string[]
  disabled?: boolean
  aiSuggestion?: {
    categoryId: string
    subcategoryId?: string | null
    confidence?: number
    reasoning?: string
    alternativeCategoryId?: string | null
  } | null
}

// Baldes com ordem visual padrão e títulos claros
const BUCKET_GROUPS: {
  bucket: BudgetBucket
  label: string
}[] = [
  { bucket: 'essentials', label: 'Essenciais' },
  { bucket: 'lifestyle', label: 'Estilo de Vida' },
  { bucket: 'future', label: 'Futuro & Metas' },
]

export const TransactionInlineRow: React.FC<TransactionInlineRowProps> = ({
  transaction,
  categories,
  members = [],
  isExpanded = false,
  onToggleExpand,
  onSave,
  onSaveBatchSameName,
  matchingCount = 0,
  matchingTransactionIds = [],
  disabled = false,
  aiSuggestion = null,
}) => {
  // Estado local para os campos editáveis quando expandido
  const [description, setDescription] = useState<string>(transaction.description || '')
  const [txType, setTxType] = useState<TransactionType>(transaction.type || 'expense')
  const [txDate, setTxDate] = useState<string>(transaction.transaction_date || '')
  const [memberId, setMemberId] = useState<string>(transaction.member_id || '')
  const [selectedCatId, setSelectedCatId] = useState<string>(transaction.category_id || '')
  const [selectedSubcatId, setSelectedSubcatId] = useState<string>(
    transaction.subcategory_id || 'none',
  )
  const [rememberRule, setRememberRule] = useState<boolean>(true) // Marcado por padrão
  const [saving, setSaving] = useState(false)
  const [savingBatch, setSavingBatch] = useState(false)
  const [justResolved, setJustResolved] = useState(false)

  // Sincronizar estado caso a transação mude externamente
  useEffect(() => {
    setDescription(transaction.description || '')
    setTxType(transaction.type || 'expense')
    setTxDate(transaction.transaction_date || '')
    setMemberId(transaction.member_id || '')
    const catId = transaction.category_id || aiSuggestion?.categoryId || ''
    const subId = transaction.subcategory_id || aiSuggestion?.subcategoryId || 'none'
    setSelectedCatId(catId)
    setSelectedSubcatId(subId)
  }, [
    transaction.id,
    transaction.description,
    transaction.type,
    transaction.transaction_date,
    transaction.member_id,
    transaction.category_id,
    transaction.subcategory_id,
    aiSuggestion?.categoryId,
    aiSuggestion?.subcategoryId,
  ])

  // Filtrar categorias aplicáveis pelo tipo da transação
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === txType)
  }, [categories, txType])

  // Categoria atualmente selecionada
  const activeCategory = useMemo(() => {
    return filteredCategories.find((c) => c.id === selectedCatId) || null
  }, [filteredCategories, selectedCatId])

  // Subcategorias da categoria selecionada
  const availableSubcategories = useMemo(() => {
    return activeCategory?.subcategories || []
  }, [activeCategory])

  // Top-2 chutes da IA (padrão Copilot Money): quando há sugestão IA e a categoria
  // selecionada é a sugerida, a alternativa da IA sobe pro topo da lista —
  // corrigir um erro da IA vira 1 toque em vez de scroll na lista.
  const aiAlternativeCategory = useMemo(() => {
    if (!aiSuggestion?.alternativeCategoryId) return null
    if (selectedCatId !== aiSuggestion.categoryId) return null
    return filteredCategories.find((c) => c.id === aiSuggestion.alternativeCategoryId) || null
  }, [aiSuggestion, selectedCatId, filteredCategories])

  // Agrupamento das categorias de despesas por Balde
  const categorizedByBucket = useMemo(() => {
    if (txType !== 'expense') {
      return null
    }

    const groups: Record<BudgetBucket, TransactionCategory[]> = {
      essentials: [],
      lifestyle: [],
      future: [],
    }

    filteredCategories.forEach((cat) => {
      const b = (cat.budget_bucket as BudgetBucket) || 'lifestyle'
      if (groups[b]) {
        groups[b].push(cat)
      } else {
        groups.lifestyle.push(cat)
      }
    })

    return groups
  }, [filteredCategories, txType])

  // Troca de tipo (receita / despesa) reseta categoria se ela não for do novo tipo
  const handleToggleType = (newType: TransactionType) => {
    setTxType(newType)
    const existsInNewType = categories.some((c) => c.id === selectedCatId && c.type === newType)
    if (!existsInNewType) {
      setSelectedCatId('')
      setSelectedSubcatId('none')
    }
  }

  // Troca de categoria
  const handleCategoryChange = (newCatId: string) => {
    if (newCatId === 'none') {
      setSelectedCatId('')
      setSelectedSubcatId('none')
      return
    }
    setSelectedCatId(newCatId)
    setSelectedSubcatId('none')
  }

  // Salvar a transação atual
  const handleSave = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!selectedCatId || selectedCatId === 'none') return

    try {
      setSaving(true)
      await onSave({
        transactionId: transaction.id,
        categoryId: selectedCatId,
        subcategoryId: selectedSubcatId === 'none' ? null : selectedSubcatId,
        rememberRule,
        description: description.trim() || transaction.description || 'Transação',
        type: txType,
        memberId: memberId || undefined,
        date: txDate || undefined,
      })
      setJustResolved(true)
    } catch (err) {
      console.error('Erro ao salvar categoria inline:', err)
    } finally {
      setSaving(false)
    }
  }

  // Salvar em lote para pendentes com o mesmo nome
  const handleSaveBatch = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!selectedCatId || selectedCatId === 'none' || !onSaveBatchSameName) return

    try {
      setSavingBatch(true)
      // Inclui o ID atual junto com os outros
      const allTargetIds = Array.from(new Set([transaction.id, ...matchingTransactionIds]))
      await onSaveBatchSameName({
        pattern: description.trim() || transaction.description || '',
        transactionIds: allTargetIds,
        categoryId: selectedCatId,
        subcategoryId: selectedSubcatId === 'none' ? null : selectedSubcatId,
        rememberRule,
        type: txType,
        description: description.trim() || transaction.description || 'Transação',
      })
      setJustResolved(true)
    } catch (err) {
      console.error('Erro ao aplicar categoria em lote:', err)
    } finally {
      setSavingBatch(false)
    }
  }

  const isIncome = txType === 'income'
  const isOriginalIncome = transaction.type === 'income'

  if (justResolved) {
    return (
      <div className="p-3 sm:p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-2xl flex items-center justify-between text-xs transition-all animate-in fade-in-50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <Check className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-emerald-950 block truncate text-xs sm:text-sm">
              {description || transaction.description || 'Transação'}
            </span>
            <span className="text-[11px] text-emerald-800 flex items-center gap-1 truncate">
              Categorizada como <strong>{activeCategory?.name || 'Categoria'}</strong>
              {rememberRule ? ' • Regra salva' : ''}
            </span>
          </div>
        </div>
        <span className="font-semibold text-emerald-700 tabular-nums shrink-0 ml-2">
          {formatBRL(transaction.amount_cents)}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isExpanded
          ? 'bg-amber-950/30 border-amber-500/60 shadow-md ring-2 ring-amber-500/30'
          : 'bg-surface hover:bg-surface-2 border-line shadow-2xs'
      } ${saving || savingBatch ? 'opacity-70 pointer-events-none' : ''}`}
    >
      {/* ================= 1. LINHA RECOLHIDA (TAP-TO-EXPAND HEADER) ================= */}
      <button
        type="button"
        role="button"
        aria-expanded={isExpanded}
        onClick={onToggleExpand}
        disabled={disabled || saving || savingBatch}
        className="w-full text-left p-3 sm:p-3.5 flex items-center justify-between gap-2.5 min-h-[44px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-income rounded-2xl transition-colors select-none"
      >
        {/* Lado esquerdo: Ícone + Descrição + Tag Pendente */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Ícone de categoria ou etiqueta pendente */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform shadow-2xs"
            style={{
              backgroundColor: activeCategory?.color || '#F59E0B',
              color: '#FFFFFF',
            }}
          >
            {activeCategory?.icon ? (
              <CategoryIcon name={activeCategory.icon} className="w-4 h-4" />
            ) : (
              <Tag className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
              <p
                className="font-bold text-xs sm:text-sm text-white truncate leading-tight"
                title={transaction.description || 'Transação sem descrição'}
              >
                {transaction.description || 'Transação sem descrição'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-body2 mt-0.5 min-w-0 flex-wrap">
              <span className="font-semibold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono shrink-0">
                Pendente
              </span>
              {aiSuggestion && activeCategory && (
                <span
                  title={
                    aiSuggestion.reasoning
                      ? `IA: ${aiSuggestion.reasoning}`
                      : 'Classificação sugerida pela IA'
                  }
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.2 rounded-full shrink-0"
                >
                  <span>✨ Sugestão IA ({activeCategory.name})</span>
                </span>
              )}
              {transaction.is_installment && (
                <span className="font-bold text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded shrink-0">
                  {transaction.installment_number || 1}/{transaction.installment_total || 1}
                </span>
              )}
              {transaction.status === 'projected' && (
                <span className="font-semibold text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.2 rounded shrink-0">
                  Previsto
                </span>
              )}
              {transaction.member?.name && (
                <span className="truncate text-body2 text-[10px]">• {transaction.member.name}</span>
              )}
            </div>
          </div>
        </div>

        {/* Lado direito: Valor alinhado + Chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`font-semibold tracking-tight text-xs sm:text-sm tabular-nums whitespace-nowrap ${
              isOriginalIncome ? 'text-income' : 'text-expense'
            }`}
          >
            {isOriginalIncome ? '+' : '−'} {formatBRL(transaction.amount_cents)}
          </span>
          <div className="w-6 h-6 rounded-lg bg-surface-2 text-body flex items-center justify-center shrink-0">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 transition-transform duration-200" />
            ) : (
              <ChevronDown className="w-4 h-4 transition-transform duration-200" />
            )}
          </div>
        </div>
      </button>

      {/* ================= 2. PAINEL EXPANDIDO (TRANSIÇÃO SUAVE GRID-ROWS) ================= */}
      <div
        className={`grid transition-all duration-200 ease-out ${
          isExpanded
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        }`}
      >
        <div className="overflow-hidden">
          <form
            onSubmit={handleSave}
            className="p-3 sm:p-4 pt-1 sm:pt-1 border-t border-amber-200/80 space-y-3 bg-gradient-to-b from-amber-50/40 to-white/90"
          >
            {/* Fileira 1: Descrição editável, Data, Toggle Receita/Despesa e Membro */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
              {/* Descrição */}
              <div className="sm:col-span-5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-body2 block mb-1">
                  Descrição
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nome da transação"
                  disabled={saving || savingBatch}
                  className="h-8 text-xs font-semibold bg-surface border-line focus:border-emerald-600 rounded-xl"
                />
              </div>

              {/* Data */}
              <div className="sm:col-span-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-body2 block mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  disabled={saving || savingBatch}
                  className="h-8 w-full text-xs text-ink bg-surface border border-line rounded-xl px-2.5 font-medium focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Toggle Receita / Despesa */}
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-body2 block mb-1">
                  Tipo
                </label>
                <button
                  type="button"
                  onClick={() => handleToggleType(isIncome ? 'expense' : 'income')}
                  disabled={saving || savingBatch}
                  className={`h-8 w-full text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors border ${
                    isIncome
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  {isIncome ? (
                    <>
                      <ArrowUpRight className="w-3.5 h-3.5" /> Receita
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="w-3.5 h-3.5" /> Despesa
                    </>
                  )}
                </button>
              </div>

              {/* Membro */}
              {members.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-body2 block mb-1">
                    Membro
                  </label>
                  <Select
                    value={memberId}
                    onValueChange={setMemberId}
                    disabled={saving || savingBatch}
                  >
                    <SelectTrigger className="h-8 text-xs bg-surface border-line rounded-xl">
                      <SelectValue placeholder="Membro" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Fileira 2: Select de Categoria (3 Baldes) e Subcategoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
              {/* Select de Categoria */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-body block mb-1 flex items-center gap-1">
                  <span>Categoria *</span>
                  {!selectedCatId && (
                    <span className="text-amber-700 font-normal normal-case">
                      (escolha para habilitar o salvamento)
                    </span>
                  )}
                </label>
                <Select
                  value={selectedCatId || 'placeholder'}
                  onValueChange={handleCategoryChange}
                  disabled={disabled || saving || savingBatch}
                >
                  <SelectTrigger
                    className={`h-9 text-xs bg-surface rounded-xl shadow-2xs font-medium border-2 ${
                      !selectedCatId
                        ? 'text-amber-900 border-amber-400 bg-amber-50/40 animate-pulse'
                        : 'text-ink border-line'
                    }`}
                  >
                    <SelectValue placeholder="Escolher categoria..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {/* Top-2 chutes da IA no topo (padrão Copilot Money, P1): a 2ª hipótese
                        da IA aparece em destaque quando a 1ª está selecionada — corrigir
                        erro da IA vira 1 toque. */}
                    {aiAlternativeCategory && (
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase font-bold text-violet-600 tracking-wider flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 rounded-md my-0.5">
                          <Sparkles className="w-3 h-3" />
                          <span>Outra hipótese da IA</span>
                        </SelectLabel>
                        <SelectItem value={aiAlternativeCategory.id} className="text-xs py-1.5">
                          <span className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor: aiAlternativeCategory.color || '#10B981',
                                color: '#FFFFFF',
                              }}
                            >
                              <CategoryIcon
                                name={aiAlternativeCategory.icon}
                                className="w-2.5 h-2.5"
                              />
                            </div>
                            <span className="font-semibold text-ink">
                              {aiAlternativeCategory.name}
                            </span>
                          </span>
                        </SelectItem>
                      </SelectGroup>
                    )}
                    {categorizedByBucket
                      ? BUCKET_GROUPS.map(({ bucket, label }) => {
                          const list = categorizedByBucket[bucket] || []
                          if (list.length === 0) return null
                          return (
                            <SelectGroup key={bucket}>
                              <SelectLabel className="text-[10px] uppercase font-bold text-body2 tracking-wider flex items-center gap-1 px-2.5 py-1.5 bg-surface-2 rounded-md my-0.5">
                                <span>{label}</span>
                              </SelectLabel>
                              {list.map((c) => (
                                <SelectItem key={c.id} value={c.id} className="text-xs py-1.5">
                                  <span className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                                      style={{
                                        backgroundColor: c.color || '#10B981',
                                        color: '#FFFFFF',
                                      }}
                                    >
                                      <CategoryIcon name={c.icon} className="w-2.5 h-2.5" />
                                    </div>
                                    <span className="font-semibold text-ink">{c.name}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )
                        })
                      : filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs py-1.5">
                            <span className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                                style={{
                                  backgroundColor: c.color || '#10B981',
                                  color: '#FFFFFF',
                                }}
                              >
                                <CategoryIcon name={c.icon} className="w-2.5 h-2.5" />
                              </div>
                              <span className="font-semibold text-ink">{c.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select de Subcategoria */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-body block mb-1">
                  Subcategoria
                </label>
                <ContextualSubcategorySelector
                  subcategories={availableSubcategories.map((s) => ({
                    id: s.id,
                    name: s.name,
                    category_id: s.category_id,
                  }))}
                  selectedSubcategoryId={selectedSubcatId === 'none' ? null : selectedSubcatId}
                  onSelect={(newSubId, newCatId) => {
                    if (newCatId && newCatId !== selectedCatId) {
                      setSelectedCatId(newCatId)
                    }
                    setSelectedSubcatId(newSubId || 'none')
                  }}
                  allCategories={categories}
                  currentCategoryId={selectedCatId}
                  disabled={disabled || saving || savingBatch || !selectedCatId}
                  placeholder="Subcategoria opcional..."
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Checkbox "Lembrar para compras futuras com este nome" (Marcado por padrão) */}
            <div className="pt-1 space-y-1">
              <label className="flex items-center gap-2 text-xs text-body font-medium cursor-pointer select-none">
                <Checkbox
                  checked={rememberRule}
                  onCheckedChange={(checked) => setRememberRule(!!checked)}
                  disabled={disabled || saving || savingBatch}
                  className="data-[state=checked]:bg-income data-[state=checked]:border-income rounded-md"
                />
                <span className="flex items-center gap-1.5 leading-tight">
                  <Sparkles className="w-3.5 h-3.5 text-income shrink-0" />
                  <span>Lembrar para compras futuras com este nome</span>
                </span>
              </label>
              {aiSuggestion?.reasoning && (
                <p className="text-[10px] text-violet-700 italic pl-5 flex items-center gap-1">
                  <span>✨ Motivo IA:</span>
                  <span>{aiSuggestion.reasoning}</span>
                </p>
              )}
            </div>

            {/* Fileira de Ações: Botão em Lote "Aplicar aos N pendentes com o mesmo nome" + Salvar Primário */}
            <div className="pt-2 border-t border-amber-200/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              {/* Botão em lote destacado quando houver outras com mesmo nome */}
              {matchingCount > 0 && onSaveBatchSameName ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveBatch}
                  disabled={!selectedCatId || saving || savingBatch}
                  className="rounded-xl text-xs font-bold gap-1.5 border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 shadow-2xs h-9 order-2 sm:order-1"
                >
                  {savingBatch ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Aplicando em lote...</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>Aplicar aos {matchingCount + 1} pendentes com o mesmo nome</span>
                    </>
                  )}
                </Button>
              ) : (
                <div className="order-2 sm:order-1" />
              )}

              {/* Botão Salvar Primário */}
              <div className="flex items-center gap-2 justify-end order-1 sm:order-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onToggleExpand}
                  disabled={saving || savingBatch}
                  className="rounded-xl text-xs text-body hover:text-ink h-9 px-3"
                >
                  Recolher
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={!selectedCatId || saving || savingBatch}
                  className="rounded-xl text-xs font-bold gap-1.5 bg-action hover:bg-action/90 text-white shadow-sm h-9 px-4 min-w-[100px] border-0"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Salvar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
