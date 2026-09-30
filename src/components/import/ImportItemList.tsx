import React, { useMemo } from 'react'
import {
  Tag,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Sparkles,
  Link2,
} from 'lucide-react'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { formatBRL } from '@/lib/formatters'
import type { ReviewItem } from '@/components/transactions/ImportStatementDialog'
import type { TransactionCategory, FamilyMember } from '@/types/finance'

interface ImportItemListProps {
  items: ReviewItem[]
  selectedItemId: string | null
  categories: TransactionCategory[]
  members: FamilyMember[]
  onSelectItem: (id: string) => void
  onToggleItem: (id: string) => void
}

export const ImportItemList: React.FC<ImportItemListProps> = ({
  items,
  selectedItemId,
  categories,
  members,
  onSelectItem,
  onToggleItem,
}) => {
  const categoryMap = useMemo(() => {
    const map = new Map<string, TransactionCategory>()
    categories.forEach((c) => map.set(c.id, c))
    return map
  }, [categories])

  const memberMap = useMemo(() => {
    const map = new Map<string, FamilyMember>()
    members.forEach((m) => map.set(m.id, m))
    return map
  }, [members])

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <p className="text-sm font-semibold text-slate-700">Nenhum lançamento encontrado</p>
        <p className="text-xs text-slate-500 mt-1">
          Nenhum lançamento corresponde ao filtro selecionado. Tente mudar os filtros rápidos no
          topo.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 pb-2">
      {items.map((item) => {
        const isSelected = selectedItemId === item.id
        const isIncome = item.type === 'income'
        const cat = item.category_id ? categoryMap.get(item.category_id) : null
        const member = item.member_id ? memberMap.get(item.member_id) : null
        const subcategory =
          cat && item.subcategory_id
            ? cat.subcategories?.find((s) => s.id === item.subcategory_id)
            : null

        return (
          <div
            key={item.id}
            onClick={() => onSelectItem(item.id)}
            className={`w-full text-left rounded-2xl border transition-all duration-150 p-3 sm:p-3.5 flex items-center gap-3 cursor-pointer select-none relative ${
              isSelected
                ? 'bg-emerald-50/70 border-emerald-500/80 shadow-md ring-2 ring-emerald-500/20'
                : item.selected
                  ? 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300 hover:bg-slate-50/60'
                  : 'bg-slate-100/60 border-slate-200/70 opacity-60'
            }`}
          >
            {/* Checkbox de inclusão na importação */}
            <div
              className="shrink-0 flex items-center pr-1"
              onClick={(e) => {
                e.stopPropagation()
                onToggleItem(item.id)
              }}
            >
              <input
                type="checkbox"
                checked={item.selected}
                onChange={() => onToggleItem(item.id)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                title={item.selected ? 'Desmarcar da importação' : 'Marcar para importação'}
                aria-label={`Incluir ${item.description}`}
              />
            </div>

            {/* Ícone de Categoria / Círculo */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
              style={{
                backgroundColor: cat?.color || '#CBD5E1',
                color: '#FFFFFF',
              }}
            >
              {cat?.icon ? (
                <CategoryIcon name={cat.icon} className="w-4 h-4" />
              ) : (
                <Tag className="w-4 h-4 text-slate-600" />
              )}
            </div>

            {/* Dados Centrais */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-slate-900 truncate max-w-[200px] sm:max-w-[320px]">
                  {item.description || 'Lançamento sem descrição'}
                </span>
                {item.isInstallment && (
                  <span className="text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 px-1.5 py-0.2 rounded-md shrink-0">
                    {item.installmentCurrent}/{item.installmentTotal}
                  </span>
                )}
                {item.isDuplicate && (
                  <span
                    title={item.duplicateReason}
                    className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5"
                  >
                    <AlertTriangle className="w-2.5 h-2.5" /> Duplicada
                  </span>
                )}
                {item.isNonExpense && (
                  <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-md shrink-0">
                    Não é despesa
                  </span>
                )}
                {item.isReconciledManual && (
                  <span className="text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5">
                    <Link2 className="w-2.5 h-2.5" /> Manual
                  </span>
                )}
              </div>

              {/* Linha de Metadados: Categoria, Subcategoria, Membro, Confiança da IA */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                <span className="font-mono text-slate-600">{item.date}</span>

                {cat ? (
                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                    <span>• {cat.name}</span>
                    {subcategory && (
                      <span className="text-slate-400 font-normal">/ {subcategory.name}</span>
                    )}
                  </span>
                ) : (
                  <span className="font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded">
                    Pendente
                  </span>
                )}

                {item.source === 'ai_suggestion' && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.2 rounded-full"
                    title={item.aiReasoning || 'Sugerido pela IA'}
                  >
                    <Sparkles className="w-2.5 h-2.5" /> IA
                    {typeof item.aiConfidence === 'number' && (
                      <span className="ml-0.5 font-normal">
                        {Math.round(item.aiConfidence * 100)}%
                      </span>
                    )}
                  </span>
                )}

                {member && (
                  <span className="text-slate-400 text-[10px] hidden sm:inline">
                    ({member.name})
                  </span>
                )}
              </div>
            </div>

            {/* Lado Direito: Valor */}
            <div className="text-right shrink-0">
              <span
                className={`font-black text-xs sm:text-sm tabular-nums whitespace-nowrap block ${
                  isIncome ? 'text-emerald-700' : 'text-slate-900'
                }`}
              >
                {isIncome ? '+' : '−'} {formatBRL(item.amount_cents)}
              </span>
              {isSelected && (
                <span className="text-[10px] font-bold text-emerald-700 flex items-center justify-end gap-0.5 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Editando
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
