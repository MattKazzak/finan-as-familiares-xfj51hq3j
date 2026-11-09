import React from 'react'
import {
  CategoryIcon,
  getHarmonizedCategoryColor,
  getCategoryTintBackground,
} from '@/components/common/CategoryIcon'
import { ContextualSubcategorySelector } from '@/components/categories/ContextualSubcategorySelector'
import { TransactionCategory } from '@/types/finance'
import { AlertCircle, ChevronDown, Check } from 'lucide-react'

interface CategoryHighlightChipProps {
  categoryName: string
  subcategoryName?: string | null
  confidence?: number | null
  isLowConfidence?: boolean
  allCategories?: TransactionCategory[]
  onSelectSubcategory?: (subcategoryId: string | null, categoryId?: string) => void
  disabled?: boolean
  className?: string
}

/**
 * Chip de destaque de Categoria + Subcategoria no padrão Design System CDS v1.0.
 * - Exibe ícone oficial salvo no banco via CategoryIcon
 * - Cor harmonizada CDS
 * - Subcategoria clicável para abrir o ContextualSubcategorySelector existente (correção rápida)
 * - Badge "sugestão incerta" integrada se confidence < 0.6 ou isLowConfidence
 * - 100% responsivo sem overflow horizontal no mobile (360-412px).
 */
export const CategoryHighlightChip: React.FC<CategoryHighlightChipProps> = ({
  categoryName,
  subcategoryName,
  confidence,
  isLowConfidence = false,
  allCategories = [],
  onSelectSubcategory,
  disabled = false,
  className = '',
}) => {
  // Localizar objeto da categoria pelo nome
  const matchedCategory = React.useMemo(() => {
    if (!categoryName) return null
    const lower = categoryName.trim().toLowerCase()
    return (
      allCategories.find((c) => c.name.trim().toLowerCase() === lower) ||
      allCategories.find(
        (c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()),
      ) ||
      null
    )
  }, [allCategories, categoryName])

  const categoryColor = matchedCategory?.color || '#059669'
  const categoryIcon = matchedCategory?.icon || 'Tag'
  const harmonizedColor = getHarmonizedCategoryColor(categoryColor) || '#059669'
  const tintBg = getCategoryTintBackground(harmonizedColor, 0.12) || 'rgba(5, 150, 105, 0.12)'

  // Determinar se a sugestão é incerta (confidence < 0.6 ou flag passada)
  const isUncertain =
    isLowConfidence ||
    (confidence !== null && confidence !== undefined && confidence > 0 && confidence < 0.6)

  // Subcategorias para o seletor contextual
  const subcategoryList = React.useMemo(() => {
    return (matchedCategory?.subcategories || []).map((s) => ({
      id: s.id,
      name: s.name,
      category_id: matchedCategory?.id,
      icon: s.icon || categoryIcon,
      color: s.color || categoryColor,
    }))
  }, [matchedCategory, categoryIcon, categoryColor])

  const activeSubId = React.useMemo(() => {
    if (!subcategoryName) return null
    const lowerSub = subcategoryName.trim().toLowerCase()
    const found = subcategoryList.find((s) => s.name.trim().toLowerCase() === lowerSub)
    return found ? found.id : null
  }, [subcategoryList, subcategoryName])

  return (
    <div
      data-testid="category-highlight-chip"
      className={`inline-flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white border border-line shadow-2xs max-w-full text-xs ${className}`}
    >
      {/* Pílula da Categoria com Ícone e Cor CDS */}
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-semibold text-[11px] sm:text-xs shrink-0"
        style={{
          backgroundColor: tintBg,
          color: harmonizedColor,
        }}
        title={`Categoria: ${categoryName}`}
      >
        <span className="shrink-0 flex items-center justify-center">
          <CategoryIcon name={categoryIcon} className="w-3.5 h-3.5" />
        </span>
        <span className="truncate max-w-[130px] sm:max-w-[170px]">{categoryName}</span>
      </span>

      {/* Subcategoria (se existir ou se o seletor estiver habilitado) */}
      {onSelectSubcategory && !disabled ? (
        <>
          <span className="text-body3 text-[10px] select-none shrink-0">›</span>
          <div className="inline-flex items-center shrink-0 max-w-[180px]">
            <ContextualSubcategorySelector
              subcategories={subcategoryList}
              selectedSubcategoryId={activeSubId}
              allCategories={allCategories}
              currentCategoryId={matchedCategory?.id}
              placeholder={subcategoryName || 'Definir subcategoria'}
              onSelect={(subId, catId) => {
                onSelectSubcategory(subId, catId)
              }}
              className="h-7 text-[11px] sm:text-xs font-semibold px-2 rounded-xl bg-surface-2 border-line hover:bg-surface-2 hover:border-line text-ink"
            />
          </div>
        </>
      ) : subcategoryName ? (
        <>
          <span className="text-body3 text-[10px] select-none shrink-0">›</span>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-2 text-body font-medium text-[11px] truncate max-w-[140px]"
            title={subcategoryName}
          >
            {subcategoryName}
          </span>
        </>
      ) : null}

      {/* Badge de Sugestão Incerta Integrada */}
      {isUncertain && (
        <span
          data-testid="uncertain-suggestion-badge"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-300/80 text-amber-900 font-bold text-[10px] shrink-0 animate-in fade-in"
          title="A IA teve baixa certeza nesta categoria. Toque para ajustar se necessário."
        >
          <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
          <span>sugestão incerta</span>
        </span>
      )}
    </div>
  )
}
