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
import { CategoryIcon, CategoryIconBox } from '@/components/common/CategoryIcon'
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
  onUpdateUserNote?: (id: string, note: string) => void
}

export const ImportItemList: React.FC<ImportItemListProps> = ({
  items,
  selectedItemId,
  categories,
  members,
  onSelectItem,
  onUpdateUserNote,
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
      <div className="p-8 text-center text-body2 bg-surface rounded-2xl border border-line shadow-xs">
        <p className="text-sm font-semibold text-ink">Nenhum lançamento encontrado</p>
        <p className="text-xs text-body2 mt-1">
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
                  ? 'bg-surface border-line shadow-2xs hover:border-line-strong hover:bg-surface-2'
                  : 'bg-surface-2 border-line opacity-60'
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
                className="w-4 h-4 rounded border-line text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                title={item.selected ? 'Desmarcar da importação' : 'Marcar para importação'}
                aria-label={`Incluir ${item.description}`}
              />
            </div>

            {/* Ícone de Categoria com tint suave CDS */}
            <CategoryIconBox
              icon={cat?.icon}
              color={cat?.color}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
              iconClassName="w-4 h-4"
              strokeWidth={1.5}
            />

            {/* Dados Centrais */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-ink truncate max-w-[200px] sm:max-w-[320px]">
                  {item.description || 'Lançamento sem descrição'}
                </span>
                {item.isInstallment && (
                  <span className="text-[10px] font-semibold bg-muted/70 text-body border border-border/40 px-1.5 py-0.2 rounded-md shrink-0">
                    {item.installmentCurrent}/{item.installmentTotal}
                  </span>
                )}
                {item.isPossibleDuplicate && !item.isDuplicate ? (
                  <span
                    title={item.duplicateReason || 'Possível duplicata por data e valor'}
                    className="text-[10px] font-semibold bg-amber-50 text-amber-900 border border-action/40 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5"
                  >
                    <AlertTriangle className="w-2.5 h-2.5 text-action" strokeWidth={1.5} /> possível
                    duplicata
                  </span>
                ) : item.isDuplicate ? (
                  <span
                    title={item.duplicateReason}
                    className="text-[10px] font-semibold bg-amber-50 text-amber-900 border border-action/30 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5"
                  >
                    <AlertTriangle className="w-2.5 h-2.5 text-action" strokeWidth={1.5} />{' '}
                    Duplicada
                  </span>
                ) : null}
                {item.isNonExpense && (
                  <span className="text-[10px] font-medium bg-muted/70 text-body2 border border-border/30 px-1.5 py-0.2 rounded-md shrink-0">
                    Não é despesa
                  </span>
                )}
                {item.isReconciledManual && (
                  <span className="text-[10px] font-semibold bg-emerald-50 text-income border border-emerald-200/70 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5">
                    <Link2 className="w-2.5 h-2.5" strokeWidth={1.5} /> Conciliado
                  </span>
                )}
              </div>

              {/* Linha de Metadados: Categoria, Subcategoria, Membro, Confiança da IA */}
              <div className="flex items-center gap-2 text-[11px] text-body2 mt-0.5 flex-wrap">
                <span className="font-mono text-body">{item.date}</span>

                {cat ? (
                  <span className="font-semibold text-body flex items-center gap-1">
                    <span>• {cat.name}</span>
                    {subcategory && (
                      <span className="text-body3 font-normal">/ {subcategory.name}</span>
                    )}
                  </span>
                ) : (
                  <span className="font-semibold text-amber-900 bg-amber-50 border border-action/30 px-1.5 py-0.2 rounded">
                    Pendente
                  </span>
                )}

                {item.source === 'ai_suggestion' && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.2 rounded-full ${
                      item.isUncertain ||
                      (typeof item.aiConfidence === 'number' && item.aiConfidence < 0.6)
                        ? 'text-amber-900 bg-amber-50 border border-amber-300'
                        : 'text-body bg-muted/60 border border-border/40'
                    }`}
                    title={item.aiReasoning || 'Sugerido pela IA'}
                  >
                    <Sparkles className="w-2.5 h-2.5 text-action" strokeWidth={1.5} />
                    {item.isUncertain ||
                    (typeof item.aiConfidence === 'number' && item.aiConfidence < 0.6)
                      ? 'sugestão incerta'
                      : 'IA'}
                    {typeof item.aiConfidence === 'number' && (
                      <span className="ml-0.5 font-normal">
                        {Math.round(item.aiConfidence * 100)}%
                      </span>
                    )}
                  </span>
                )}

                {/* Micro-pergunta 'Contar o que foi' para sugestões incertas ou sem categoria */}
                {(item.isUncertain ||
                  !item.category_id ||
                  (typeof item.aiConfidence === 'number' && item.aiConfidence < 0.6)) && (
                  <div
                    className="w-full mt-1.5 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      placeholder="Contar o que foi (ex: fralda do bebê)..."
                      value={item.userNote || ''}
                      onChange={(e) => onUpdateUserNote?.(item.id, e.target.value)}
                      className="text-[11px] px-2 py-1 rounded-lg border border-amber-200 bg-amber-50/60 focus:bg-white text-ink placeholder:text-body3 w-full max-w-[260px] outline-none focus:ring-1 focus:ring-amber-400 transition-all"
                    />
                    {item.userNote ? (
                      <span className="text-[10px] text-emerald-700 font-semibold shrink-0">
                        Salvo p/ regra
                      </span>
                    ) : null}
                  </div>
                )}

                {member && (
                  <span className="text-body3 text-[10px] hidden sm:inline">({member.name})</span>
                )}
              </div>
            </div>

            {/* Lado Direito: Valor */}
            <div className="text-right shrink-0">
              <span
                className={`font-semibold text-xs sm:text-sm tabular-nums whitespace-nowrap block ${
                  isIncome ? 'text-income' : 'text-ink'
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
