import React, { useState } from 'react'
import {
  X,
  Trash2,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  CopyCheck,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { formatBRL } from '@/lib/formatters'
import type { ReviewItem } from '@/components/transactions/ImportStatementDialog'
import type { TransactionCategory, FamilyMember } from '@/types/finance'
import { findSimilarReviewItems, getMerchantSignature } from '@/services/import/similar-matcher'

interface ImportItemEditorProps {
  item: ReviewItem
  allItems: ReviewItem[]
  categories: TransactionCategory[]
  members: FamilyMember[]
  onUpdateField: (id: string, field: keyof ReviewItem, value: any) => void
  onRemoveItem: (id: string) => void
  onOpenQuickCategory: (itemId: string) => void
  onClose?: () => void
  onApplyToSimilar: (
    baseItem: ReviewItem,
    targetCategoryId: string | null,
    targetSubcategoryId: string | null,
  ) => void
}

export const ImportItemEditor: React.FC<ImportItemEditorProps> = ({
  item,
  allItems,
  categories,
  members,
  onUpdateField,
  onRemoveItem,
  onOpenQuickCategory,
  onClose,
  onApplyToSimilar,
}) => {
  const [showAppliedToast, setShowAppliedToast] = useState(false)
  const isIncome = item.type === 'income'
  const currentCategory = categories.find((c) => c.id === item.category_id)
  const filteredCategories = categories.filter((c) => c.type === item.type)
  const availableSubcategories = currentCategory?.subcategories || []

  // Itens semelhantes na mesma revisão
  const similarItems = findSimilarReviewItems(item, allItems)
  const eligibleSimilarCount = similarItems.filter(
    (sim) => sim.category_id !== item.category_id || sim.subcategory_id !== item.subcategory_id,
  ).length

  const merchantSig = getMerchantSignature(item.description)

  const handleApplySimilarClick = () => {
    if (!item.category_id) return
    onApplyToSimilar(item, item.category_id, item.subcategory_id || null)
    setShowAppliedToast(true)
    setTimeout(() => setShowAppliedToast(false), 3000)
  }

  return (
    <div className="flex flex-col h-full bg-white sm:rounded-2xl border-slate-200/80 sm:border shadow-sm p-4 sm:p-5 overflow-y-auto">
      {/* Header do editor */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isIncome
                  ? 'bg-emerald-50 text-[#059669] border border-emerald-200/70'
                  : 'bg-rose-50/70 text-[#E11D48] border border-rose-200/60'
              }`}
            >
              {isIncome ? (
                <ArrowUpRight className="w-3 h-3" strokeWidth={1.5} />
              ) : (
                <ArrowDownRight className="w-3 h-3" strokeWidth={1.5} />
              )}
              {isIncome ? 'Receita' : 'Despesa'}
            </span>
            {item.source === 'ai_suggestion' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-muted/60 border border-border/40 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-[#FCA311]" strokeWidth={1.5} />
                Sugestão da IA
                {item.aiConfidence ? ` (${Math.round(item.aiConfidence * 100)}%)` : ''}
              </span>
            )}
          </div>
          <p className="text-base sm:text-lg font-semibold text-slate-900 mt-1 truncate">
            {formatBRL(item.amount_cents)}
          </p>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            FITID: {item.fitid || 'Sem código'}
          </p>
        </div>

        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-slate-700 sm:hidden"
            aria-label="Fechar painel de edição"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Formulário de edição */}
      <div className="space-y-4 pt-4 flex-1">
        {/* Descrição */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Descrição do lançamento
          </Label>
          <Input
            value={item.description}
            onChange={(e) => onUpdateField(item.id, 'description', e.target.value)}
            className="h-9 text-xs sm:text-sm font-semibold bg-white border-slate-300 focus:border-emerald-600 rounded-xl"
            placeholder="Ex.: iFood Restaurante"
          />
        </div>

        {/* Data e Tipo */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Data
            </Label>
            <input
              type="date"
              value={item.date}
              onChange={(e) => onUpdateField(item.id, 'date', e.target.value)}
              className="h-9 w-full text-xs sm:text-sm text-slate-800 bg-white border border-slate-300 rounded-xl px-2.5 font-medium focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tipo
            </Label>
            <button
              type="button"
              onClick={() => onUpdateField(item.id, 'type', isIncome ? 'expense' : 'income')}
              className={`h-9 w-full text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors border ${
                isIncome
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
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
        </div>

        {/* Membro responsável */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Membro responsável
          </Label>
          <Select
            value={item.member_id}
            onValueChange={(val) => onUpdateField(item.id, 'member_id', val)}
          >
            <SelectTrigger className="h-9 text-xs sm:text-sm bg-white border-slate-300 rounded-xl font-medium">
              <SelectValue placeholder="Selecione o membro" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs sm:text-sm">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Categoria */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Categoria
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenQuickCategory(item.id)}
              className="h-6 text-[11px] text-emerald-700 hover:text-emerald-800 p-0 font-semibold flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> Nova Categoria
            </Button>
          </div>

          <Select
            value={item.category_id || 'none'}
            onValueChange={(val) => {
              if (val === 'CREATE_NEW') {
                onOpenQuickCategory(item.id)
              } else {
                onUpdateField(item.id, 'category_id', val === 'none' ? null : val)
              }
            }}
          >
            <SelectTrigger
              className={`h-10 text-xs sm:text-sm bg-white rounded-xl shadow-2xs font-medium border-2 ${
                !item.category_id
                  ? 'text-amber-900 border-amber-400 bg-amber-50/40'
                  : 'text-slate-900 border-slate-300'
              }`}
            >
              <SelectValue placeholder="Sem categoria">
                {currentCategory ? (
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: currentCategory.color || '#10B981',
                        color: '#FFF',
                      }}
                    >
                      <CategoryIcon name={currentCategory.icon} className="w-3 h-3" />
                    </span>
                    <span className="truncate">{currentCategory.name}</span>
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Pendente de categoria
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="none" className="text-xs text-slate-500">
                Sem categoria (pendente)
              </SelectItem>
              {filteredCategories.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs sm:text-sm py-1.5">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: c.color || '#10B981', color: '#FFF' }}
                    >
                      <CategoryIcon name={c.icon} className="w-2.5 h-2.5" />
                    </span>
                    {c.name}
                  </span>
                </SelectItem>
              ))}
              <SelectItem
                value="CREATE_NEW"
                className="text-xs font-semibold text-emerald-700 border-t mt-1"
              >
                + Criar nova categoria
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Subcategoria */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Subcategoria
          </Label>
          <Select
            value={item.subcategory_id || 'none'}
            onValueChange={(val) =>
              onUpdateField(item.id, 'subcategory_id', val === 'none' ? null : val)
            }
            disabled={availableSubcategories.length === 0}
          >
            <SelectTrigger className="h-9 text-xs sm:text-sm w-full rounded-xl bg-white border-slate-300 font-medium">
              <SelectValue
                placeholder={
                  availableSubcategories.length === 0
                    ? 'Sem subcategorias nesta categoria'
                    : 'Subcategoria opcional...'
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              <SelectItem value="none" className="text-xs text-slate-500">
                Sem subcategoria
              </SelectItem>
              {availableSubcategories.map((sub) => (
                <SelectItem key={sub.id} value={sub.id} className="text-xs sm:text-sm">
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ITEM 3 DO PLANO: "APLICAR A SEMELHANTES" NA MESMA REVISÃO */}
        {item.category_id && eligibleSimilarCount > 0 && (
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70 space-y-2">
            <div className="flex items-start gap-2">
              <CopyCheck className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900">
                  {eligibleSimilarCount}{' '}
                  {eligibleSimilarCount === 1
                    ? 'outro lançamento semelhante'
                    : 'outros lançamentos semelhantes'}{' '}
                  nesta fatura
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                  Identificamos lançamentos de{' '}
                  <strong className="text-slate-800">
                    {merchantSig || 'mesmo estabelecimento'}
                  </strong>{' '}
                  ainda sem esta categoria.
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleApplySimilarClick}
              className="w-full h-8 text-xs font-bold bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] rounded-xl shadow-xs gap-1.5 border-0"
            >
              <CopyCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Aplicar a todos os {eligibleSimilarCount} semelhantes</span>
            </Button>
            {showAppliedToast && (
              <p className="text-[11px] font-semibold text-[#059669] text-center animate-fade-in">
                ✓ Categoria aplicada aos lançamentos semelhantes!
              </p>
            )}
          </div>
        )}

        {/* Lembrar regra futura */}
        {item.category_id && (
          <label className="flex items-start gap-2 cursor-pointer text-xs select-none pt-1">
            <input
              type="checkbox"
              checked={item.rememberRule ?? true}
              onChange={(e) => onUpdateField(item.id, 'rememberRule', e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <span className="text-slate-700 font-medium text-[11px] leading-snug">
              <strong className="font-semibold text-slate-900 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#FCA311] inline" strokeWidth={1.5} />
                Lembrar para compras futuras
              </strong>
              Salvar como regra automática para próximas importações com este nome.
            </span>
          </label>
        )}

        {/* Motivo da IA (se houver) */}
        {item.source === 'ai_suggestion' && item.aiReasoning && (
          <div className="p-2.5 rounded-xl bg-muted/60 border border-border/40 text-[11px] text-slate-700">
            <span className="font-semibold block text-slate-900">Análise da Inteligência:</span>
            <span className="italic mt-0.5 block">{item.aiReasoning}</span>
          </div>
        )}

        {/* Se for parcela ou conciliação manual */}
        {item.isInstallment && (
          <div className="p-2.5 rounded-xl bg-muted/60 border border-border/40 text-[11px] text-slate-700 space-y-1">
            <span className="font-semibold text-slate-900">
              Despesa Parcelada ({item.installmentCurrent}/{item.installmentTotal})
            </span>
            {item.installmentCurrent === 1 && (item.installmentTotal || 1) > 1 && (
              <label className="flex items-center gap-1.5 cursor-pointer mt-1 font-medium">
                <input
                  type="checkbox"
                  checked={item.generateFutureInstallments ?? true}
                  onChange={(e) =>
                    onUpdateField(item.id, 'generateFutureInstallments', e.target.checked)
                  }
                  className="rounded border-slate-300 text-slate-700 focus:ring-slate-500 w-3.5 h-3.5"
                />
                <span>Gerar parcelas futuras automáticas</span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Ação destrutiva: Remover da revisão */}
      <div className="pt-4 mt-auto border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemoveItem(item.id)}
          className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl h-8 gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Remover da revisão</span>
        </Button>

        {onClose && (
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-8 px-4"
          >
            Concluir
          </Button>
        )}
      </div>
    </div>
  )
}
