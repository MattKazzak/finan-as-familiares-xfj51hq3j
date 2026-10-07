import {
  Sparkles,
  GraduationCap,
  Info,
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  GripVertical,
  AlertTriangle,
  Tag,
  MoreVertical,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatBRL, formatMonthYear } from '@/lib/formatters'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { SortableList } from '@/components/common/SortableList'
import { CategoryEditorPopover } from '@/components/categories/CategoryEditorPopover'
import { SubcategoryEditorPopover } from '@/components/categories/SubcategoryEditorPopover'
import { BudgetOverviewCard } from '@/components/wallet/BudgetOverviewCard'
import { BudgetAlertsFarol } from '@/components/wallet/BudgetAlertsFarol'
import { BUCKET_METADATA } from '@/types/budget-presets'
import { useToast } from '@/hooks/use-toast'
import {
  upsertDefaultBudget,
  upsertMonthBudgetOverride,
  resetMonthBudgetToDefault,
} from '@/services/transactions'
import { useWallet } from './WalletContext'

export function WalletBudgetsTab() {
  const {
    family,
    currentDate,
    monthKey,
    setIsApplyModelOpen,
    categoryBudgetData,
    setActiveAlertEditCategory,
    isMethodologyExpanded,
    setIsMethodologyExpanded,
    addNewCategory,
    editCategory,
    setDefaultBudgets,
    setMonthOverrides,
    triggerRefresh,
    loadMonthData,
    reorderCategoriesList,
    expandedBudgetCategories,
    openCategoryTransactionsDrawer,
    setEditingCategoryFromMenu,
    setAddingSubcatForCategory,
    handleInitiateDeleteCategory,
    toggleCatBudgetExpand,
    reorderSubcategoriesList,
    editSubcategory,
    handleInitiateDeleteSubcategory,
    addNewSubcategory,
    mountedAlertEditCategory,
    isAlertEditorOpen,
    setIsAlertEditorOpen,
    mountedCategoryFromMenu,
    isMenuCategoryEditorOpen,
    setIsMenuCategoryEditorOpen,
    setMountedCategoryFromMenu,
    mountedAddingSubcatCategory,
    isMenuSubcatEditorOpen,
    setIsMenuSubcatEditorOpen,
    setMountedAddingSubcatCategory,
    setAddingSubcatForCategory: _setAddingSubcatForCategory,
  } = useWallet()

  const { toast } = useToast()

  return (
    <div className="space-y-5 mt-0 animate-in fade-in-50 duration-200">
      {/* Cabeçalho da Aba Orçamentos: Ações Rápidas (Receitas Fixas & Modelo Sugerido) */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-card/90 backdrop-blur-sm p-3.5 rounded-2xl border border-border/40 shadow-curiango">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-buckets-goals flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 select-none" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground dark:text-white leading-tight">
              Planejamento & Orçamentos
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Tetos baseados em percentuais da renda líquida familiar com liberdade total
            </p>
            <p className="text-[10px] text-muted-foreground italic flex items-center gap-1 mt-0.5">
              <GraduationCap className="w-3 h-3 text-muted-foreground shrink-0 not-italic" />
              <span>
                Modelos baseados em metodologias consagradas: 50/30/20 (Elizabeth Warren) e
                variações para perfis de família.
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsApplyModelOpen(true)}
            className="rounded-xl text-xs font-semibold gap-1.5 border-border text-foreground bg-slate-100/60 hover:bg-brand-amber/20 h-8 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-amber" />
            <span>Aplicar modelo sugerido</span>
          </Button>
        </div>
      </div>

      {/* CARD DE ONBOARDING LEVE (QUANDO A RENDA LÍQUIDA AINDA NÃO FOI DEFINIDA) */}
      {(!family?.monthly_net_income_cents || family.monthly_net_income_cents <= 0) && (
        <div className="bg-gradient-to-br from-brand via-[#192a4f] to-brand-dark text-white rounded-3xl p-5 shadow-sm border border-brand flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in-50 duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-brand-amber shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm sm:text-base text-white">
                Defina a renda líquida mensal da família
              </h4>
              <p className="text-xs text-white/80 mt-1 max-w-xl leading-relaxed">
                O app calcula os tetos ideais automaticamente com base na metodologia de consultores
                financeiros (Essenciais 57%, Estilo de Vida 21%, Futuro 22%), convertendo em reais e
                oferecendo total flexibilidade de personalização.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setIsApplyModelOpen(true)}
            className="bg-brand-amber hover:bg-[#e08e08] text-brand font-bold text-xs rounded-xl shadow-md self-start sm:self-center shrink-0 gap-1.5 border-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span>Configurar em 3 passos</span>
          </Button>
        </div>
      )}

      {/* PAINEL FLUÍDO E ORGÂNICO DOS 3 BALDES, RENDA LÍQUIDA E FAROL PREVENTIVO */}
      {family?.monthly_net_income_cents && family.monthly_net_income_cents > 0 ? (
        <BudgetOverviewCard
          family={family}
          bucketsSummary={categoryBudgetData.bucketsSummary}
          totalBudget={categoryBudgetData.totalBudget}
          totalBudgetPercentOfIncome={categoryBudgetData.totalBudgetPercentOfIncome}
          totalSpent={categoryBudgetData.totalSpent}
          currentDate={currentDate}
          monthKey={monthKey}
          categoryList={categoryBudgetData.list}
          onOpenModelDialog={() => setIsApplyModelOpen(true)}
        />
      ) : null}

      {/* Card Geral de Orçamento Recorrente / Projeção */}
      {(() => {
        const now = new Date()
        const isFutureMonth =
          currentDate.getFullYear() > now.getFullYear() ||
          (currentDate.getFullYear() === now.getFullYear() &&
            currentDate.getMonth() > now.getMonth())

        const cardTitle = isFutureMonth
          ? `Projeção de ${formatMonthYear(currentDate)}`
          : `Orçamento de ${formatMonthYear(currentDate)}`

        const badgeText = categoryBudgetData.isTotalOver
          ? `Excedeu ${formatBRL(Math.abs(categoryBudgetData.totalRemaining))}`
          : isFutureMonth
            ? `Livre ${formatBRL(categoryBudgetData.totalRemaining)}`
            : `Restam ${formatBRL(categoryBudgetData.totalRemaining)}`

        const consumedPrefix = isFutureMonth ? 'Comprometido ' : 'Gasto '

        return (
          <div className="bg-card/90 backdrop-blur-sm rounded-3xl p-6 border border-border/40 shadow-curiango">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                  {cardTitle}
                </span>
                {isFutureMonth ? (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    · Teto mensal: {formatBRL(categoryBudgetData.totalBudget)}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    · Padrão mensal
                  </span>
                )}
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full self-start sm:self-auto ${
                  categoryBudgetData.isTotalOver
                    ? 'bg-rose-100 text-finance-expense dark:bg-rose-950/40'
                    : categoryBudgetData.totalPercent >= 75
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40'
                      : 'bg-emerald-100 text-finance-income dark:bg-emerald-950/40'
                }`}
              >
                <span>{badgeText}</span>
              </span>
            </div>

            <div className="flex items-baseline justify-between mb-3">
              <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground dark:text-white tabular-nums">
                <span className="text-base sm:text-lg font-medium text-muted-foreground mr-1.5">
                  {consumedPrefix}
                </span>
                <span className="inline-flex items-baseline gap-1.5 flex-wrap">
                  <span>{formatBRL(categoryBudgetData.totalSpent)}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    de {formatBRL(categoryBudgetData.totalBudget)}
                  </span>
                </span>
              </span>
              <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                <span>{categoryBudgetData.totalPercent}%</span>
              </span>
            </div>

            {/* Barra de Progresso com Limites CDS: <75% #059669, 75-100% #FCA311, >100% #E11D48 */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  categoryBudgetData.isTotalOver
                    ? 'bg-finance-expense'
                    : categoryBudgetData.totalPercent >= 75
                      ? 'bg-brand-amber'
                      : 'bg-finance-income'
                }`}
                style={{ width: `${Math.min(categoryBudgetData.totalPercent, 100)}%` }}
              />
            </div>

            <div className="text-[11px] text-muted-foreground mt-2 text-right">
              <span>Tetos recorrentes mensais</span>
            </div>
          </div>
        )
      })()}

      {/* FAROL & ALERTAS PREVENTIVOS — Posicionado logo abaixo do card de orçamento e acima da lista de categorias */}
      <BudgetAlertsFarol
        family={family}
        bucketsSummary={categoryBudgetData.bucketsSummary}
        totalBudget={categoryBudgetData.totalBudget}
        totalBudgetPercentOfIncome={categoryBudgetData.totalBudgetPercentOfIncome}
        categoryList={categoryBudgetData.list}
        currentDate={currentDate}
        monthKey={monthKey}
        onOpenCategoryEditor={(cat) => setActiveAlertEditCategory(cat)}
        onOpenModelDialog={() => setIsApplyModelOpen(true)}
      />

      {/* Lista de Orçamentos com Hierarquia Categoria Pai -> Subcategorias e Gestão Inline com Ícones */}
      <div className="bg-card/90 backdrop-blur-sm rounded-3xl border border-border/40 p-5 shadow-curiango space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-base text-foreground dark:text-white">
              Categorias e Subcategorias
            </h3>
            <p className="text-xs text-muted-foreground">
              Clique na linha para definir teto. Use o lápis para editar, o + para criar
              subcategoria e a lixeira para excluir.
            </p>
            <div className="mt-1.5 max-w-full">
              <button
                type="button"
                onClick={() => setIsMethodologyExpanded((prev) => !prev)}
                aria-expanded={isMethodologyExpanded}
                aria-label={
                  isMethodologyExpanded
                    ? 'Recolher nota de metodologia'
                    : 'Expandir nota de metodologia'
                }
                title={
                  isMethodologyExpanded
                    ? 'Clique para recolher nota de metodologia'
                    : 'Clique para expandir nota de metodologia completa'
                }
                className="group flex items-start gap-1.5 text-left text-[11px] leading-relaxed cursor-pointer select-none max-w-full w-full rounded-md p-0.5 -m-0.5 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300 transition-colors"
              >
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-200/60 shrink-0 mt-0.5 transition-colors"
                  aria-hidden="true"
                  title={
                    isMethodologyExpanded
                      ? 'Clique para recolher nota de metodologia'
                      : 'Clique para ver metodologia completa'
                  }
                >
                  <Info className="w-3.5 h-3.5" />
                </span>
                <span
                  className={`min-w-0 flex-1 transition-all duration-200 text-slate-500/90 group-hover:text-slate-700 ${
                    isMethodologyExpanded ? 'break-words whitespace-normal' : 'truncate block'
                  }`}
                >
                  Essa taxonomia de categorias foi desenhada respeitando a Pesquisa de Orçamentos
                  Familiares (POF) do IBGE e o comportamento real de consumo do Brasil moderno.
                </span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <CategoryEditorPopover
              title="Nova Categoria"
              defaultType="expense"
              bucketsSummary={categoryBudgetData.bucketsSummary as any}
              family={family}
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:bg-brand-gray bg-brand-gray/60 px-2.5 py-1.5 rounded-xl border border-brand-gray transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova categoria</span>
                </button>
              }
              onSave={async (data) => {
                try {
                  const newCat = await addNewCategory(
                    data.name,
                    data.type,
                    data.color,
                    data.icon,
                    data.budget_bucket,
                  )
                  if (
                    family &&
                    newCat &&
                    data.type === 'expense' &&
                    data.budget_amount_cents !== undefined
                  ) {
                    await upsertDefaultBudget(family.id, newCat.id, data.budget_amount_cents, null)
                  }
                  triggerRefresh()
                  await loadMonthData()
                } catch (err: any) {
                  console.error('Erro ao criar categoria:', err)
                  toast({
                    title: 'Erro ao criar categoria',
                    description: err?.message || 'Tente novamente.',
                    variant: 'destructive',
                  })
                }
              }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {categoryBudgetData.list.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <p className="text-sm font-semibold text-slate-600">
                Nenhuma categoria de despesa cadastrada
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-3">
                Crie sua primeira categoria para organizar seu orçamento familiar.
              </p>
              <CategoryEditorPopover
                title="Criar Primeira Categoria"
                defaultType="expense"
                bucketsSummary={categoryBudgetData.bucketsSummary as any}
                family={family}
                trigger={
                  <Button
                    size="sm"
                    className="bg-brand-amber hover:bg-[#e08e08] text-brand font-bold rounded-xl text-xs gap-1.5 border-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Criar categoria</span>
                  </Button>
                }
                onSave={async (data) => {
                  try {
                    const newCat = await addNewCategory(
                      data.name,
                      data.type,
                      data.color,
                      data.icon,
                      data.budget_bucket,
                    )
                    if (
                      family &&
                      newCat &&
                      data.type === 'expense' &&
                      data.budget_amount_cents !== undefined
                    ) {
                      await upsertDefaultBudget(
                        family.id,
                        newCat.id,
                        data.budget_amount_cents,
                        null,
                      )
                    }
                    triggerRefresh()
                    await loadMonthData()
                  } catch (err: any) {
                    console.error('Erro ao criar categoria:', err)
                    toast({
                      title: 'Erro ao criar categoria',
                      description: err?.message || 'Tente novamente.',
                      variant: 'destructive',
                    })
                  }
                }}
              />
            </div>
          ) : null}

          <SortableList
            items={categoryBudgetData.list}
            keyExtractor={(item) => item.category.id}
            onReorder={async (newOrder) => {
              const orderedIds = newOrder.map((it) => it.category.id)
              await reorderCategoriesList(orderedIds)
            }}
            renderItem={(item, _idx, _dragHandleProps, isDragging) => {
              const isExpanded = Boolean(expandedBudgetCategories[item.category.id])
              const hasSubcats = item.subcategories.length > 0

              return (
                <div
                  className={`border rounded-2xl overflow-hidden bg-white transition-all ${
                    isDragging
                      ? 'border-emerald-500 shadow-xl'
                      : 'border-slate-200/80 shadow-2xs hover:border-slate-300'
                  }`}
                >
                  {/* Bloco da Categoria Pai */}
                  <div
                    onClick={() => openCategoryTransactionsDrawer(item.category, null, 'category')}
                    className="p-3 sm:p-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors group select-none touch-manipulation"
                  >
                    {/* Top Row: Identificação + Ações */}
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      {/* Ícone da Categoria + Nome completo e badges */}
                      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                        {/* Ícone da categoria */}
                        <div
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0 mt-0.5"
                          style={{ backgroundColor: item.category.color || '#64748B' }}
                        >
                          <CategoryIcon
                            name={item.category.icon}
                            className="w-4 h-4 sm:w-5 sm:h-5"
                          />
                        </div>

                        {/* Informações textuais da categoria */}
                        <div className="min-w-0 flex-1">
                          {/* Nome da categoria completo - quebra em 2 linhas se necessário, nunca truncado */}
                          <div className="flex flex-col">
                            <span
                              className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-emerald-700 transition-colors break-words leading-snug"
                              title={item.category.name}
                            >
                              {item.category.name}
                            </span>

                            {/* Badges em linha flexível abaixo do nome */}
                            <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                              {item.category.budget_bucket && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 leading-none whitespace-nowrap ${
                                    BUCKET_METADATA[item.category.budget_bucket]?.bgLight ||
                                    'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {BUCKET_METADATA[item.category.budget_bucket]?.shortLabel}
                                </span>
                              )}

                              {(() => {
                                const dynamicPercent =
                                  family?.monthly_net_income_cents && item.limitCents > 0
                                    ? Math.round(
                                        (item.limitCents / family.monthly_net_income_cents) * 1000,
                                      ) / 10
                                    : null

                                if (item.limitCents > 0) {
                                  return (
                                    <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 rounded-md tabular-nums shrink-0 leading-none whitespace-nowrap">
                                      {family?.monthly_net_income_cents
                                        ? `${dynamicPercent}% da renda`
                                        : '—'}
                                    </span>
                                  )
                                }

                                return (
                                  <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-md shrink-0 leading-none whitespace-nowrap">
                                    Sem teto próprio · Cota livre no balde
                                  </span>
                                )
                              })()}

                              {item.hasOverride ? (
                                <span className="text-[9px] font-semibold bg-amber-100/90 text-amber-900 border border-amber-200/80 px-1.5 py-0.5 rounded-md leading-none shrink-0 whitespace-nowrap">
                                  ajustado
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Coluna de Ações + Chevron (alinhamento no topo, nunca sobrepondo texto) */}
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-start mt-0.5">
                        {/* AÇÕES DE GESTÃO: Desktop (barra com 3 botões em cápsula limpa) */}
                        <div
                          className="hidden md:flex items-center gap-0.5 bg-slate-100/70 p-0.5 rounded-xl border border-slate-200/60 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Lápis: Editar categoria */}
                          <CategoryEditorPopover
                            category={item.category}
                            initialLimitCents={item.defaultLimitCents || item.limitCents}
                            bucketsSummary={categoryBudgetData.bucketsSummary as any}
                            family={family}
                            trigger={
                              <button
                                type="button"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-all"
                                title="Editar categoria (nome, cor, ícone, teto)"
                                aria-label={`Editar categoria ${item.category.name}`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            }
                            onSave={async (data) => {
                              try {
                                await editCategory(item.category.id, {
                                  name: data.name,
                                  type: data.type,
                                  color: data.color,
                                  icon: data.icon,
                                  budget_bucket: data.budget_bucket,
                                })
                                if (
                                  data.type === 'expense' &&
                                  typeof data.budget_amount_cents === 'number'
                                ) {
                                  const newLimit = Math.max(0, data.budget_amount_cents)
                                  setDefaultBudgets((prev) => {
                                    const exists = prev.some(
                                      (b) =>
                                        b.category_id === item.category.id && !b.subcategory_id,
                                    )
                                    if (exists) {
                                      return prev.map((b) =>
                                        b.category_id === item.category.id && !b.subcategory_id
                                          ? { ...b, amount_cents: newLimit }
                                          : b,
                                      )
                                    }
                                    return [
                                      ...prev,
                                      {
                                        id: `temp-${Date.now()}`,
                                        family_id: family!.id,
                                        category_id: item.category.id,
                                        subcategory_id: null,
                                        amount_cents: newLimit,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                      } as any,
                                    ]
                                  })
                                  if (item.hasOverride) {
                                    setMonthOverrides((prev) =>
                                      prev.filter(
                                        (b) =>
                                          !(
                                            b.category_id === item.category.id && !b.subcategory_id
                                          ),
                                      ),
                                    )
                                  }
                                  await upsertDefaultBudget(
                                    family!.id,
                                    item.category.id,
                                    newLimit,
                                    null,
                                  )
                                  if (item.hasOverride) {
                                    await resetMonthBudgetToDefault(
                                      family!.id,
                                      item.category.id,
                                      monthKey,
                                      null,
                                    )
                                  }
                                }
                                triggerRefresh()
                                await loadMonthData()
                              } catch (err: any) {
                                console.error('Erro ao editar categoria:', err)
                                toast({
                                  title: 'Erro ao editar categoria',
                                  description: err?.message || 'Tente novamente.',
                                  variant: 'destructive',
                                })
                              }
                            }}
                          />

                          {/* + : Criar subcategoria */}
                          <SubcategoryEditorPopover
                            parentCategoryName={item.category.name}
                            trigger={
                              <button
                                type="button"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-700 hover:bg-white transition-all"
                                title="Adicionar subcategoria"
                                aria-label={`Adicionar subcategoria em ${item.category.name}`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            }
                            onSave={async (data) => {
                              try {
                                await addNewSubcategory(item.category.id, data.name)
                                triggerRefresh()
                                await loadMonthData()
                              } catch (err: any) {
                                console.error('Erro ao criar subcategoria:', err)
                                toast({
                                  title: 'Erro ao criar subcategoria',
                                  description: err?.message || 'Tente novamente.',
                                  variant: 'destructive',
                                })
                              }
                            }}
                          />

                          {/* Lixeira: Excluir categoria */}
                          <button
                            type="button"
                            onClick={(e) => handleInitiateDeleteCategory(item.category, e)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white transition-all"
                            title="Excluir categoria"
                            aria-label={`Excluir categoria ${item.category.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* AÇÕES DE GESTÃO: Mobile / Tablet (< md) via Menu "Mais Opções" (⋯) */}
                        <div
                          className="flex md:hidden items-center shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                title="Mais opções da categoria"
                                aria-label={`Opções da categoria ${item.category.name}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-52 max-w-[calc(100vw-2rem)] rounded-2xl shadow-xl p-1.5 text-xs"
                            >
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setTimeout(() => {
                                    setEditingCategoryFromMenu(item.category)
                                  }, 50)
                                }}
                                className="gap-2 py-2 px-2.5 rounded-xl cursor-pointer text-slate-700 focus:bg-slate-100 min-h-[40px]"
                              >
                                <Edit3 className="w-4 h-4 text-slate-500 shrink-0" />
                                <span className="font-medium">Editar categoria</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setTimeout(() => {
                                    setAddingSubcatForCategory(item.category)
                                  }, 50)
                                }}
                                className="gap-2 py-2 px-2.5 rounded-xl cursor-pointer text-slate-700 focus:bg-slate-100 min-h-[40px]"
                              >
                                <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span className="font-medium">Nova subcategoria</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setTimeout(() => {
                                    handleInitiateDeleteCategory(item.category, e as any)
                                  }, 0)
                                }}
                                className="gap-2 py-2 px-2.5 rounded-xl cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 min-h-[40px]"
                              >
                                <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                                <span className="font-medium">Excluir categoria</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Chevron de Expandir / Recolher Subcategorias */}
                        <button
                          type="button"
                          onClick={(e) => toggleCatBudgetExpand(item.category.id, e)}
                          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                          title={isExpanded ? 'Recolher subcategorias' : 'Expandir subcategorias'}
                          aria-label={
                            isExpanded ? 'Recolher subcategorias' : 'Expandir subcategorias'
                          }
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Seção Inferior: Valores + Barra de Progresso (apenas na categoria pai) + Farol */}
                    <div className="mt-2.5 sm:mt-2">
                      {/* Linha de Valores: Gasto vs Teto */}
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-xs sm:text-sm text-slate-500 tabular-nums flex items-baseline gap-1.5 flex-wrap">
                          {item.category.budget_bucket === 'future' ||
                          item.category.name.toLowerCase().includes('reserva') ||
                          item.category.name.toLowerCase().includes('invest') ? (
                            <>
                              <span className="text-slate-600 font-medium">Aportado:</span>
                              <span className="font-bold text-slate-800 text-sm sm:text-base">
                                {formatBRL(item.spentCents)}
                              </span>
                              <span className="text-slate-400 text-xs">de</span>
                              {item.limitCents > 0 ? (
                                <span className="text-slate-600 font-medium">
                                  {formatBRL(item.limitCents)}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">(Sem meta definida)</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-slate-800 text-sm sm:text-base">
                                {formatBRL(item.spentCents)}
                              </span>
                              <span className="text-slate-400 text-xs">de</span>
                              {item.limitCents > 0 ? (
                                <span className="text-slate-600 font-medium">
                                  {formatBRL(item.limitCents)}
                                </span>
                              ) : (
                                <span className="inline-flex items-baseline gap-1 flex-wrap">
                                  <span className="text-slate-600 font-medium">R$ 0,00</span>
                                  <span className="text-[11px] text-slate-400 font-normal">
                                    <span>(Sem teto alocado)</span>
                                  </span>
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Percentual ou Marcador */}
                        <div className="text-right shrink-0">
                          {item.limitCents > 0 ? (
                            <span
                              className={`text-xs sm:text-sm font-bold tabular-nums ${
                                item.category.budget_bucket === 'future' ||
                                item.category.name.toLowerCase().includes('reserva') ||
                                item.category.name.toLowerCase().includes('invest')
                                  ? 'text-emerald-700'
                                  : item.isOver || item.percent > 90
                                    ? 'text-red-600'
                                    : item.percent >= 71
                                      ? 'text-amber-600'
                                      : 'text-emerald-700'
                              }`}
                            >
                              {item.percent}%
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-400 tabular-nums">
                              —
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barra de Progresso em Largura Total (APENAS na categoria pai) */}
                      {item.limitCents > 0 ? (
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              item.category.budget_bucket === 'future' ||
                              item.category.name.toLowerCase().includes('reserva') ||
                              item.category.name.toLowerCase().includes('invest')
                                ? 'bg-emerald-600'
                                : item.isOver || item.percent > 90
                                  ? 'bg-red-500'
                                  : item.percent >= 71
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(item.percent, 100)}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Linhas Aninhadas: Subcategorias com Recuo e Visual Suave OU Mensagem Vazia */}
                  {isExpanded ? (
                    <div
                      key={`budget-subcats-${item.category.id}`}
                      className="bg-slate-50/70 border-t border-slate-100 divide-y divide-slate-100/80 pl-2.5 sm:pl-6 pr-2.5 sm:pr-4 py-1.5"
                    >
                      {hasSubcats ? (
                        <SortableList
                          items={item.subcategories}
                          keyExtractor={(sub) => sub.subcategory.id}
                          className="space-y-1 divide-y-0"
                          onReorder={async (newSubOrder) => {
                            const orderedSubIds = newSubOrder.map((s) => s.subcategory.id)
                            await reorderSubcategoriesList(item.category.id, orderedSubIds)
                          }}
                          renderItem={(subItem, _sIdx, subDragHandleProps, isSubDragging) => (
                            <div
                              key={`budget-sub-${subItem.subcategory.id}`}
                              onClick={() =>
                                openCategoryTransactionsDrawer(
                                  item.category,
                                  subItem.subcategory,
                                  'subcategory',
                                )
                              }
                              className={`py-2 px-2 sm:px-2.5 flex flex-col sm:flex-row sm:items-center justify-between rounded-xl cursor-pointer transition-colors group/sub gap-1.5 sm:gap-3 touch-manipulation ${
                                isSubDragging ? 'bg-white shadow-md' : 'hover:bg-white'
                              }`}
                            >
                              {/* Linha superior no mobile / lado esquerdo no desktop: Alça de arrasto + Nome + Badges + Ações no mobile */}
                              <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 min-w-0 w-full sm:flex-1 sm:w-auto">
                                <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    {...subDragHandleProps}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      e.preventDefault()
                                    }}
                                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 active:text-emerald-600 cursor-grab active:cursor-grabbing shrink-0 touch-none rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
                                    title="Arraste para reordenar subcategoria"
                                    aria-label={`Arrastar subcategoria ${subItem.subcategory.name}`}
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </button>
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/sub:bg-emerald-500 transition-colors shrink-0" />
                                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                      <span
                                        className="text-xs sm:text-sm font-semibold text-slate-700 group-hover/sub:text-emerald-700 transition-colors break-words leading-snug"
                                        title={subItem.subcategory.name}
                                      >
                                        {subItem.subcategory.name}
                                      </span>
                                      {subItem.hasOverride ? (
                                        <span className="text-[9px] font-semibold bg-amber-100/90 text-amber-900 border border-amber-200/80 px-1.5 py-0.5 rounded-md leading-none shrink-0 whitespace-nowrap">
                                          ajustado
                                        </span>
                                      ) : null}
                                      {subItem.isOver ? (
                                        <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                {/* Ações inline no mobile (ao lado do nome para fácil acesso por toque) */}
                                <div
                                  className="flex sm:hidden items-center gap-1 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <SubcategoryEditorPopover
                                    subcategory={subItem.subcategory}
                                    parentCategoryName={item.category.name}
                                    showBudgetFields={true}
                                    initialDefaultLimitCents={subItem.defaultLimitCents}
                                    initialMonthLimitCents={subItem.limitCents}
                                    hasMonthOverride={subItem.hasOverride}
                                    currentMonthLabel={formatMonthYear(currentDate)}
                                    trigger={
                                      <button
                                        type="button"
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 transition-all"
                                        title="Editar subcategoria e teto"
                                        aria-label={`Editar subcategoria ${subItem.subcategory.name} e teto`}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    }
                                    onSave={async (data) => {
                                      try {
                                        if (data.name && data.name !== subItem.subcategory.name) {
                                          await editSubcategory(subItem.subcategory.id, {
                                            name: data.name,
                                          })
                                        }

                                        if (family) {
                                          if (data.isEditingOnlyThisMonth) {
                                            const monthCents = data.monthLimitCents || 0
                                            await upsertMonthBudgetOverride(
                                              family.id,
                                              item.category.id,
                                              monthKey,
                                              monthCents,
                                              subItem.subcategory.id,
                                            )
                                          } else {
                                            const defCents = data.defaultLimitCents || 0
                                            await upsertDefaultBudget(
                                              family.id,
                                              item.category.id,
                                              defCents,
                                              subItem.subcategory.id,
                                            )
                                            if (subItem.hasOverride) {
                                              await resetMonthBudgetToDefault(
                                                family.id,
                                                item.category.id,
                                                monthKey,
                                                subItem.subcategory.id,
                                              )
                                            }
                                          }
                                        }

                                        triggerRefresh()
                                        await loadMonthData()
                                      } catch (err: any) {
                                        console.error(
                                          'Erro ao atualizar subcategoria ou teto:',
                                          err,
                                        )
                                        toast({
                                          title: 'Erro ao salvar',
                                          description: err?.message || 'Tente novamente.',
                                          variant: 'destructive',
                                        })
                                      }
                                    }}
                                  />

                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleInitiateDeleteSubcategory(
                                        subItem.subcategory,
                                        item.category.name,
                                        e,
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-slate-200/70 transition-all"
                                    title="Excluir subcategoria"
                                    aria-label={`Excluir subcategoria ${subItem.subcategory.name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Linha de valores: no mobile recuada com a mesma margem do texto (pl-8), no desktop alinhada à direita com ações e espaçador */}
                              <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto shrink-0 pl-8 sm:pl-0">
                                <div className="text-left sm:text-right text-xs tabular-nums text-slate-500 min-w-0">
                                  {subItem.limitCents > 0 ? (
                                    <div className="flex items-baseline gap-1 flex-wrap sm:justify-end">
                                      <span className="font-semibold text-slate-800">
                                        {formatBRL(subItem.spentCents)}
                                      </span>
                                      <span className="text-slate-400 text-[10px]">de</span>
                                      <span className="text-slate-500">
                                        {formatBRL(subItem.limitCents)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-baseline gap-1 sm:justify-end">
                                      {subItem.spentCents > 0 ? (
                                        <span className="font-semibold text-slate-800">
                                          {formatBRL(subItem.spentCents)}
                                        </span>
                                      ) : null}
                                      <span className="text-slate-400 font-medium">—</span>
                                    </div>
                                  )}
                                </div>

                                {/* ÍCONES DE GESTÃO NO DESKTOP + Espaçador */}
                                <div
                                  className="hidden sm:flex items-center gap-1 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <SubcategoryEditorPopover
                                    subcategory={subItem.subcategory}
                                    parentCategoryName={item.category.name}
                                    showBudgetFields={true}
                                    initialDefaultLimitCents={subItem.defaultLimitCents}
                                    initialMonthLimitCents={subItem.limitCents}
                                    hasMonthOverride={subItem.hasOverride}
                                    currentMonthLabel={formatMonthYear(currentDate)}
                                    trigger={
                                      <button
                                        type="button"
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 transition-all"
                                        title="Editar subcategoria e teto"
                                        aria-label={`Editar subcategoria ${subItem.subcategory.name} e teto`}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    }
                                    onSave={async (data) => {
                                      try {
                                        if (data.name && data.name !== subItem.subcategory.name) {
                                          await editSubcategory(subItem.subcategory.id, {
                                            name: data.name,
                                          })
                                        }

                                        if (family) {
                                          if (data.isEditingOnlyThisMonth) {
                                            const monthCents = data.monthLimitCents || 0
                                            await upsertMonthBudgetOverride(
                                              family.id,
                                              item.category.id,
                                              monthKey,
                                              monthCents,
                                              subItem.subcategory.id,
                                            )
                                          } else {
                                            const defCents = data.defaultLimitCents || 0
                                            await upsertDefaultBudget(
                                              family.id,
                                              item.category.id,
                                              defCents,
                                              subItem.subcategory.id,
                                            )
                                            if (subItem.hasOverride) {
                                              await resetMonthBudgetToDefault(
                                                family.id,
                                                item.category.id,
                                                monthKey,
                                                subItem.subcategory.id,
                                              )
                                            }
                                          }
                                        }

                                        triggerRefresh()
                                        await loadMonthData()
                                      } catch (err: any) {
                                        console.error(
                                          'Erro ao atualizar subcategoria ou teto:',
                                          err,
                                        )
                                        toast({
                                          title: 'Erro ao salvar',
                                          description: err?.message || 'Tente novamente.',
                                          variant: 'destructive',
                                        })
                                      }
                                    }}
                                  />

                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleInitiateDeleteSubcategory(
                                        subItem.subcategory,
                                        item.category.name,
                                        e,
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-slate-200/70 transition-all"
                                    title="Excluir subcategoria"
                                    aria-label={`Excluir subcategoria ${subItem.subcategory.name}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div
                                  className="hidden sm:block w-7 shrink-0 pointer-events-none"
                                  aria-hidden="true"
                                />
                              </div>
                            </div>
                          )}
                        />
                      ) : null}

                      {/* Linha extra: Direto na categoria / Sem subcategoria (quando houver gastos diretos) */}
                      {item.directSpentCents > 0 && (
                        <div
                          onClick={() =>
                            openCategoryTransactionsDrawer(item.category, null, 'direct')
                          }
                          className="py-2 px-2 sm:px-2.5 flex flex-col sm:flex-row sm:items-center justify-between rounded-xl cursor-pointer transition-colors hover:bg-white group/direct gap-1.5 sm:gap-3 touch-manipulation border-t border-slate-100"
                        >
                          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
                            <div className="w-5 h-6 flex items-center justify-center shrink-0">
                              <Tag className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs sm:text-sm font-medium text-slate-700 group-hover/direct:text-amber-700 transition-colors break-words leading-snug">
                                Direto na categoria / Sem subcategoria
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto shrink-0 pl-8 sm:pl-0">
                            <div className="text-left sm:text-right text-xs tabular-nums text-slate-500 min-w-0">
                              <span className="font-semibold text-slate-800">
                                {formatBRL(item.directSpentCents)}
                              </span>
                            </div>
                            <div
                              className="hidden sm:block w-7 shrink-0 pointer-events-none"
                              aria-hidden="true"
                            />
                          </div>
                        </div>
                      )}

                      {!hasSubcats && item.directSpentCents === 0 ? (
                        <div className="py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="italic text-slate-400">
                            <span>Nenhuma subcategoria cadastrada</span>
                          </span>
                          <SubcategoryEditorPopover
                            parentCategoryName={item.category.name}
                            trigger={
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors self-start sm:self-auto"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Criar subcategoria</span>
                              </button>
                            }
                            onSave={async (data) => {
                              try {
                                await addNewSubcategory(item.category.id, data.name)
                                triggerRefresh()
                                await loadMonthData()
                              } catch (err: any) {
                                console.error('Erro ao criar subcategoria:', err)
                                toast({
                                  title: 'Erro ao criar subcategoria',
                                  description: err?.message || 'Tente novamente.',
                                  variant: 'destructive',
                                })
                              }
                            }}
                          />
                        </div>
                      ) : null}

                      {hasSubcats ? (
                        <div className="py-2 px-2.5">
                          <SubcategoryEditorPopover
                            parentCategoryName={item.category.name}
                            trigger={
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Adicionar subcategoria</span>
                              </button>
                            }
                            onSave={async (data) => {
                              try {
                                await addNewSubcategory(item.category.id, data.name)
                                triggerRefresh()
                                await loadMonthData()
                              } catch (err: any) {
                                console.error('Erro ao criar subcategoria:', err)
                                toast({
                                  title: 'Erro ao criar subcategoria',
                                  description: err?.message || 'Tente novamente.',
                                  variant: 'destructive',
                                })
                              }
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            }}
          />

          {/* Linha discreta no fim da lista: "+ Nova categoria" */}
          <div className="pt-2">
            <CategoryEditorPopover
              title="Nova Categoria"
              defaultType="expense"
              bucketsSummary={categoryBudgetData.bucketsSummary as any}
              family={family}
              trigger={
                <button
                  type="button"
                  className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-emerald-500/50 hover:bg-emerald-50/30 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-all"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>Nova categoria</span>
                </button>
              }
              onSave={async (data) => {
                try {
                  const newCat = await addNewCategory(
                    data.name,
                    data.type,
                    data.color,
                    data.icon,
                    data.budget_bucket,
                  )
                  if (
                    family &&
                    newCat &&
                    data.type === 'expense' &&
                    data.budget_amount_cents !== undefined
                  ) {
                    await upsertDefaultBudget(family.id, newCat.id, data.budget_amount_cents, null)
                  }
                  triggerRefresh()
                  await loadMonthData()
                } catch (err: any) {
                  console.error('Erro ao criar categoria:', err)
                  toast({
                    title: 'Erro ao criar categoria',
                    description: err?.message || 'Tente novamente.',
                    variant: 'destructive',
                  })
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Editor de categoria controlado aberto via clique em item de alerta do Farol */}
      {mountedAlertEditCategory &&
        (() => {
          const item = categoryBudgetData.list.find(
            (it) => it.category.id === mountedAlertEditCategory.id,
          )
          const initialLimit = item?.defaultLimitCents || item?.limitCents || 0

          return (
            <CategoryEditorPopover
              key={`alert-edit-${mountedAlertEditCategory.id}`}
              category={mountedAlertEditCategory}
              open={isAlertEditorOpen}
              onOpenChange={(isOpen) => {
                setIsAlertEditorOpen(isOpen)
                if (!isOpen) {
                  setTimeout(() => {
                    setActiveAlertEditCategory(null)
                  }, 300)
                }
              }}
              initialLimitCents={initialLimit}
              bucketsSummary={categoryBudgetData.bucketsSummary as any}
              family={family}
              onSave={async (data) => {
                try {
                  await editCategory(mountedAlertEditCategory.id, {
                    name: data.name,
                    type: data.type,
                    color: data.color,
                    icon: data.icon,
                    budget_bucket: data.budget_bucket,
                  })
                  if (data.type === 'expense' && typeof data.budget_amount_cents === 'number') {
                    const newLimit = Math.max(0, data.budget_amount_cents)
                    setDefaultBudgets((prev) => {
                      const exists = prev.some(
                        (b) => b.category_id === mountedAlertEditCategory.id && !b.subcategory_id,
                      )
                      if (exists) {
                        return prev.map((b) =>
                          b.category_id === mountedAlertEditCategory.id && !b.subcategory_id
                            ? { ...b, amount_cents: newLimit }
                            : b,
                        )
                      }
                      return [
                        ...prev,
                        {
                          id: `temp-${Date.now()}`,
                          family_id: family!.id,
                          category_id: mountedAlertEditCategory.id,
                          subcategory_id: null,
                          amount_cents: newLimit,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        } as any,
                      ]
                    })
                    if (item?.hasOverride) {
                      setMonthOverrides((prev) =>
                        prev.filter(
                          (b) =>
                            !(b.category_id === mountedAlertEditCategory.id && !b.subcategory_id),
                        ),
                      )
                    }
                    await upsertDefaultBudget(
                      family!.id,
                      mountedAlertEditCategory.id,
                      newLimit,
                      null,
                    )
                    if (item?.hasOverride) {
                      await resetMonthBudgetToDefault(
                        family!.id,
                        mountedAlertEditCategory.id,
                        monthKey,
                        null,
                      )
                    }
                  }
                  setIsAlertEditorOpen(false)
                  setTimeout(() => {
                    setActiveAlertEditCategory(null)
                  }, 300)
                  triggerRefresh()
                  await loadMonthData()
                } catch (err: any) {
                  console.error('Erro ao editar categoria via alerta:', err)
                  toast({
                    title: 'Erro ao editar categoria',
                    description: err?.message || 'Tente novamente.',
                    variant: 'destructive',
                  })
                }
              }}
            />
          )
        })()}

      {/* Editor de categoria aberto a partir do menu mobile (⋯) */}
      {mountedCategoryFromMenu &&
        (() => {
          const item = categoryBudgetData.list.find(
            (it) => it.category.id === mountedCategoryFromMenu.id,
          )
          const initialLimit = item?.defaultLimitCents || item?.limitCents || 0

          return (
            <CategoryEditorPopover
              key={`menu-edit-${mountedCategoryFromMenu.id}`}
              category={mountedCategoryFromMenu}
              open={isMenuCategoryEditorOpen}
              onOpenChange={(isOpen) => {
                setIsMenuCategoryEditorOpen(isOpen)
                if (!isOpen) {
                  setTimeout(() => {
                    setEditingCategoryFromMenu(null)
                    setMountedCategoryFromMenu(null)
                  }, 300)
                }
              }}
              initialLimitCents={initialLimit}
              bucketsSummary={categoryBudgetData.bucketsSummary as any}
              family={family}
              onSave={async (data) => {
                try {
                  await editCategory(mountedCategoryFromMenu.id, {
                    name: data.name,
                    type: data.type,
                    color: data.color,
                    icon: data.icon,
                    budget_bucket: data.budget_bucket,
                  })
                  if (data.type === 'expense' && typeof data.budget_amount_cents === 'number') {
                    const newLimit = Math.max(0, data.budget_amount_cents)
                    setDefaultBudgets((prev) => {
                      const exists = prev.some(
                        (b) => b.category_id === mountedCategoryFromMenu.id && !b.subcategory_id,
                      )
                      if (exists) {
                        return prev.map((b) =>
                          b.category_id === mountedCategoryFromMenu.id && !b.subcategory_id
                            ? { ...b, amount_cents: newLimit }
                            : b,
                        )
                      }
                      return [
                        ...prev,
                        {
                          id: `temp-${Date.now()}`,
                          family_id: family!.id,
                          category_id: mountedCategoryFromMenu.id,
                          subcategory_id: null,
                          amount_cents: newLimit,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        } as any,
                      ]
                    })
                    if (item?.hasOverride) {
                      setMonthOverrides((prev) =>
                        prev.filter(
                          (b) =>
                            !(b.category_id === mountedCategoryFromMenu.id && !b.subcategory_id),
                        ),
                      )
                    }
                    await upsertDefaultBudget(
                      family!.id,
                      mountedCategoryFromMenu.id,
                      newLimit,
                      null,
                    )
                    if (item?.hasOverride) {
                      await resetMonthBudgetToDefault(
                        family!.id,
                        mountedCategoryFromMenu.id,
                        monthKey,
                        null,
                      )
                    }
                  }
                  setIsMenuCategoryEditorOpen(false)
                  setTimeout(() => {
                    setEditingCategoryFromMenu(null)
                    setMountedCategoryFromMenu(null)
                  }, 300)
                  triggerRefresh()
                  await loadMonthData()
                } catch (err: any) {
                  console.error('Erro ao editar categoria:', err)
                  toast({
                    title: 'Erro ao editar categoria',
                    description: err?.message || 'Tente novamente.',
                    variant: 'destructive',
                  })
                }
              }}
            />
          )
        })()}

      {/* Editor de nova subcategoria aberto a partir do menu mobile (⋯) */}
      {mountedAddingSubcatCategory && (
        <SubcategoryEditorPopover
          key={`menu-new-subcat-${mountedAddingSubcatCategory.id}`}
          parentCategoryName={mountedAddingSubcatCategory.name}
          open={isMenuSubcatEditorOpen}
          onOpenChange={(isOpen) => {
            setIsMenuSubcatEditorOpen(isOpen)
            if (!isOpen) {
              setTimeout(() => {
                _setAddingSubcatForCategory(null)
                setMountedAddingSubcatCategory(null)
              }, 300)
            }
          }}
          onSave={async (data) => {
            try {
              await addNewSubcategory(mountedAddingSubcatCategory.id, data.name)
              setIsMenuSubcatEditorOpen(false)
              setTimeout(() => {
                _setAddingSubcatForCategory(null)
                setMountedAddingSubcatCategory(null)
              }, 300)
              triggerRefresh()
              await loadMonthData()
            } catch (err: any) {
              console.error('Erro ao criar subcategoria:', err)
              toast({
                title: 'Erro ao criar subcategoria',
                description: err?.message || 'Tente novamente.',
                variant: 'destructive',
              })
            }
          }}
        />
      )}
    </div>
  )
}
