import React, { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Search, Sparkles, FolderTree, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { TransactionCategory } from '@/types/finance'

export interface SubcategoryOption {
  id: string
  name: string
  category_id?: string
  icon?: string | null
  color?: string | null
}

interface ContextualSubcategorySelectorProps {
  /**
   * Subcategorias da categoria ativa (para o contexto imediato)
   */
  subcategories: SubcategoryOption[]
  /**
   * ID da subcategoria atualmente selecionada
   */
  selectedSubcategoryId: string | null | undefined
  /**
   * Callback quando o usuário seleciona ou limpa uma subcategoria
   */
  onSelect: (subcategoryId: string | null, categoryId?: string) => void
  /**
   * Todas as categorias da família (usadas para o "Ver todas" agrupado por categoria e busca global)
   */
  allCategories?: TransactionCategory[]
  /**
   * ID da categoria atualmente selecionada (opcional)
   */
  currentCategoryId?: string | null
  /**
   * Ranking contextual: IDs de subcategorias ordenados por frequência (mais usadas da família)
   * e/ou uso recente no histórico de transações.
   */
  recentUsageIds?: string[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ContextualSubcategorySelector({
  subcategories,
  selectedSubcategoryId,
  onSelect,
  allCategories = [],
  currentCategoryId,
  recentUsageIds = [],
  placeholder = 'Selecione uma subcategoria...',
  disabled = false,
  className,
}: ContextualSubcategorySelectorProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showAllGrouped, setShowAllGrouped] = useState(false)

  // Subcategoria ativa selecionada (busca tanto na lista local quanto em allCategories)
  const selectedSubcategory = useMemo(() => {
    if (!selectedSubcategoryId) return null
    const foundLocal = subcategories.find((s) => s.id === selectedSubcategoryId)
    if (foundLocal) return foundLocal

    for (const cat of allCategories) {
      const match = (cat.subcategories || []).find((s) => s.id === selectedSubcategoryId)
      if (match) return match
    }
    return null
  }, [subcategories, allCategories, selectedSubcategoryId])

  // Todas as 117 subcategorias da família agrupadas por categoria
  const fullCatalogByCat = useMemo(() => {
    return allCategories
      .filter((cat) => (cat.subcategories || []).length > 0)
      .map((cat) => ({
        category: cat,
        subcategories: (cat.subcategories || []).map((s) => ({
          id: s.id,
          name: s.name,
          category_id: cat.id,
          icon: s.icon || cat.icon,
          color: s.color || cat.color,
        })),
      }))
  }, [allCategories])

  // Lista plana de todas as subcategorias para busca instantânea em todo o catálogo
  const allSubcategoriesFlat = useMemo(() => {
    const list: Array<
      SubcategoryOption & { categoryName?: string; categoryColor?: string; categoryIcon?: string }
    > = []
    for (const cat of allCategories) {
      for (const s of cat.subcategories || []) {
        list.push({
          id: s.id,
          name: s.name,
          category_id: cat.id,
          categoryName: cat.name,
          categoryColor: cat.color || undefined,
          categoryIcon: cat.icon || undefined,
          icon: s.icon || cat.icon,
          color: s.color || cat.color,
        })
      }
    }
    return list
  }, [allCategories])

  // 3-4 SUGESTÕES CONTEXTUAIS no topo:
  // 1. Mais usadas pela família nesta categoria (recentUsageIds)
  // 2. Mais recentemente usadas
  // 3. Desempate pela ordem canônica do seed (ordem padrão recebida em subcategories)
  // 4. Sem histórico (conta nova), caem para a ordem canônica do seed
  const contextualSuggestions = useMemo(() => {
    if (subcategories.length <= 4) return subcategories

    const ranked: SubcategoryOption[] = []
    const seen = new Set<string>()

    // Prioriza histórico de transações da categoria
    for (const id of recentUsageIds) {
      const match = subcategories.find((s) => s.id === id)
      if (match && !seen.has(match.id)) {
        ranked.push(match)
        seen.add(match.id)
        if (ranked.length >= 4) break
      }
    }

    // Se tiver menos de 3-4, completa com a ordem canônica natural do seed
    if (ranked.length < 4) {
      for (const item of subcategories) {
        if (!seen.has(item.id)) {
          ranked.push(item)
          seen.add(item.id)
          if (ranked.length >= 4) break
        }
      }
    }

    return ranked
  }, [subcategories, recentUsageIds])

  // Busca instantânea com filtro sobre as subcategorias (busca local se categoria já fixada, ou global se digitada)
  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return []

    // Se temos allCategories preenchidas, busca em todas as 117 subcategorias do catálogo
    const pool = allSubcategoriesFlat.length > 0 ? allSubcategoriesFlat : subcategories
    return pool.filter((s) => {
      const matchSub = s.name.toLowerCase().includes(term)
      const matchCat = (s as any).categoryName?.toLowerCase().includes(term)
      return matchSub || matchCat
    })
  }, [search, allSubcategoriesFlat, subcategories])

  const handleSelect = (id: string | null, categoryId?: string) => {
    onSelect(id, categoryId)
    setOpen(false)
    setSearch('')
    setShowAllGrouped(false)
  }

  const content = (
    <div className="flex flex-col h-full max-h-[82vh] sm:max-h-[460px] text-foreground">
      {/* Campo de Busca com filtro instantâneo */}
      <div className="p-3 border-b border-border/50 bg-slate-50/50">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar entre as 117 subcategorias..."
            className="pl-9 pr-8 h-10 text-xs sm:text-sm rounded-xl bg-white border-border/80 focus:bg-white"
            autoFocus={!isMobile}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 p-1 rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Lista com rolagem confortável */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 overscroll-contain">
        {/* CASO 1: BUSCA ATIVA */}
        {search.trim().length > 0 ? (
          searchResults.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-slate-700">Nenhuma subcategoria encontrada</p>
              <p className="text-[11px]">Tente buscar por outro termo ou sinônimo.</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Resultados ({searchResults.length})</span>
                <span className="text-[10px] font-normal lowercase">Toque para selecionar</span>
              </div>
              {searchResults.map((item) => {
                const isSelected = selectedSubcategoryId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id, item.category_id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors',
                      isSelected
                        ? 'bg-amber-500/15 text-slate-900 font-semibold border border-amber-300'
                        : 'hover:bg-slate-100 text-slate-800',
                    )}
                  >
                    <div className="min-w-0 flex-1 flex flex-col">
                      <span className="truncate font-medium">{item.name}</span>
                      {(item as any).categoryName && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                          <FolderTree className="w-2.5 h-2.5" />
                          <span>{(item as any).categoryName}</span>
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0 ml-2" />}
                  </button>
                )
              })}
            </div>
          )
        ) : showAllGrouped ? (
          /* CASO 2: "VER TODAS" - LISTA COMPLETA AGRUPADA POR CATEGORIA */
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold text-slate-700 border-b border-border/40 pb-2">
              <div className="flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-amber-600" />
                <span>Todas as 117 subcategorias agrupadas</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAllGrouped(false)}
                className="text-amber-700 hover:text-amber-800 font-semibold text-xs"
              >
                Voltar
              </button>
            </div>

            {/* Opção para limpar / sem subcategoria */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors text-muted-foreground hover:bg-slate-100',
                !selectedSubcategoryId && 'bg-slate-100 font-semibold text-slate-900',
              )}
            >
              <span className="italic">Geral (sem subcategoria)</span>
              {!selectedSubcategoryId && (
                <Check className="w-3.5 h-3.5 shrink-0 ml-2 text-slate-700" />
              )}
            </button>

            {fullCatalogByCat.length > 0 ? (
              fullCatalogByCat.map(({ category, subcategories: catSubs }) => (
                <div
                  key={category.id}
                  className="space-y-1 bg-slate-50/60 p-2 rounded-2xl border border-slate-100"
                >
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-800">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: category.color || '#64748B' }}
                    />
                    <span className="truncate">{category.name}</span>
                    <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                      {catSubs.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-0.5">
                    {catSubs.map((sub) => {
                      const isSelected = selectedSubcategoryId === sub.id
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSelect(sub.id, category.id)}
                          className={cn(
                            'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors',
                            isSelected
                              ? 'bg-amber-500/15 text-slate-900 font-semibold border border-amber-300'
                              : 'hover:bg-white text-slate-700 bg-white/70 border border-transparent',
                          )}
                        >
                          <span className="truncate">{sub.name}</span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-1.5" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            ) : (
              // Fallback se allCategories não foi fornecido: agrupa as subcategories locais
              <div className="space-y-1">
                {subcategories.map((sub) => {
                  const isSelected = selectedSubcategoryId === sub.id
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSelect(sub.id, sub.category_id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors',
                        isSelected
                          ? 'bg-amber-500/15 text-slate-900 font-semibold'
                          : 'hover:bg-slate-100 text-slate-700',
                      )}
                    >
                      <span className="truncate">{sub.name}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-1.5" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* CASO 3: MODO PADRÃO COM DIVULGAÇÃO PROGRESSIVA (3-4 SUGESTÕES CONTEXTUAIS + BOTÃO VER TODAS) */
          <>
            {/* Opção para limpar / sem subcategoria */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors text-muted-foreground hover:bg-slate-100',
                !selectedSubcategoryId && 'bg-slate-100 font-semibold text-slate-900',
              )}
            >
              <span className="italic">Geral (sem subcategoria)</span>
              {!selectedSubcategoryId && (
                <Check className="w-3.5 h-3.5 shrink-0 ml-2 text-slate-700" />
              )}
            </button>

            {/* 3-4 SUGESTÕES CONTEXTUAIS */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Sugestões mais usadas</span>
              </div>

              {contextualSuggestions.length > 0 ? (
                contextualSuggestions.map((item) => {
                  const isSelected = selectedSubcategoryId === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        handleSelect(item.id, item.category_id || currentCategoryId || undefined)
                      }
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm transition-colors',
                        isSelected
                          ? 'bg-amber-500/15 text-slate-900 font-semibold border border-amber-300'
                          : 'hover:bg-slate-100 text-slate-800',
                      )}
                    >
                      <span className="truncate">{item.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0 ml-2" />}
                    </button>
                  )
                })
              ) : (
                <div className="p-3 text-xs text-muted-foreground text-center">
                  Nenhuma subcategoria específica.
                </div>
              )}

              {/* Botão "Ver todas" agrupado por categoria */}
              <div className="pt-2 px-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllGrouped(true)}
                  className="w-full text-xs font-bold rounded-xl h-9 border-dashed border-border/80 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center gap-1.5"
                >
                  <FolderTree className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    Ver todas as{' '}
                    {allSubcategoriesFlat.length > 0
                      ? allSubcategoriesFlat.length
                      : subcategories.length}{' '}
                    subcategorias
                  </span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className={cn(
        'w-full justify-between rounded-xl h-10 px-3 text-xs sm:text-sm font-normal text-left truncate bg-white border-border/80 shadow-2xs hover:bg-slate-50',
        !selectedSubcategory && 'text-muted-foreground',
        className,
      )}
    >
      <span className="truncate">
        {selectedSubcategory ? selectedSubcategory.name : placeholder}
      </span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  )

  if (isMobile) {
    return (
      <>
        <div onClick={() => !disabled && setOpen(true)} className="w-full">
          {triggerButton}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="p-0 rounded-t-3xl max-h-[85vh] flex flex-col border-t border-border/40"
          >
            <SheetHeader className="p-4 pb-2 border-b border-border/40 text-left">
              <SheetTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Escolher Subcategoria</span>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">{content}</div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0 rounded-2xl shadow-cds border border-line bg-white"
        align="start"
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}
