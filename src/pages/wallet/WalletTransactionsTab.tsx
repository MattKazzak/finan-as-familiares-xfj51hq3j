import {
  Sparkles,
  X,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Filter,
  UploadCloud,
  Plus,
  Edit3,
  Trash2,
  Check,
  ListChecks,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL, formatDayGroupHeader } from '@/lib/formatters'
import { formatTransactionTitle } from '@/services/installments'
import { CategoryIcon, CategoryIconBox } from '@/components/common/CategoryIcon'
import { TransactionInlineRow } from '@/components/transactions/TransactionInlineRow'
import { SwipeReviewDeck } from '@/components/wallet/SwipeReviewDeck'
import { extractPatternFromDescription, normalizeText } from '@/services/import/categorization'
import { useFamily } from '@/hooks/use-family'
import { useWallet } from './WalletContext'

export function WalletTransactionsTab() {
  const { openRecurringIncomes } = useFamily()
  const {
    lastImportSummary,
    setLastImportSummary,
    pendingTransactionsCount,
    filterOnlyPending,
    setFilterOnlyPending,
    monthIncomeCents,
    monthExpenseCents,
    monthNetCents,
    setIsFilterSheetOpen,
    activeFiltersCount,
    recurringIncomes,
    setFilterMemberIds,
    setFilterCategoryIds,
    setFilterType,
    filteredTransactions,
    loading,
    groupedTransactions,
    hasMoreTransactions,
    loadingMore,
    loadMoreTransactions,
    openImportStatement,
    openNewTransaction,
    pendingByPatternMap,
    categories,
    members,
    expandedPendingTxId,
    setExpandedPendingTxId,
    handleSaveInlineCategory,
    handleSaveBatchSameName,
    aiPendingSuggestions,
    selectionMode,
    selectedTxIds,
    toggleSelectionMode,
    toggleTxSelection,
    clearSelection,
    bulkCategoryDialogOpen,
    setBulkCategoryDialogOpen,
    handleBulkApplyCategory,
    bulkApplying,
    setSelectedTx,
    setIsDetailOpen,
    setEditingTx,
    setIsEditTxOpen,
    setTxToDelete,
  } = useWallet()

  return (
    <div className="space-y-6 sm:space-y-7 mt-0 animate-in fade-in-50 duration-200 min-w-0">
      {/* 1. VISÃO DE RESUMO PÓS-IMPORTAÇÃO & SEÇÃO DE REVISÃO DE PENDENTES (Com Barra de Progresso) */}
      {lastImportSummary ? (
        <div className="rounded-3xl border border-line bg-white/95 backdrop-blur-sm p-5 sm:p-6 shadow-elevation-1 space-y-3 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-2 dark:bg-surface-2 text-ink dark:text-white flex items-center justify-center shrink-0 font-semibold text-base">
                {lastImportSummary.pending === 0 ? '✓' : '↓'}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm sm:text-base text-ink dark:text-white leading-tight">
                  {lastImportSummary.pending === 0 ? (
                    'Tudo categorizado!'
                  ) : (
                    <>
                      Extrato importado: {lastImportSummary.categorized} de{' '}
                      {lastImportSummary.total} transações categorizadas
                    </>
                  )}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {lastImportSummary.pending === 0
                    ? 'Todas as transações do extrato estão devidamente classificadas nos 3 Baldes.'
                    : `${lastImportSummary.pending} transações pendentes de revisão. Toque em qualquer linha para abrir e categorizar.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
              {lastImportSummary.pending > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setFilterOnlyPending((prev) => !prev)}
                  className={`text-xs font-semibold rounded-xl shadow-xs transition-all gap-1.5 ${
                    filterOnlyPending
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {filterOnlyPending
                      ? 'Ver todas as transações'
                      : `Revisar pendentes (${lastImportSummary.pending})`}
                  </span>
                </Button>
              ) : (
                <span className="text-xs font-semibold text-income bg-income-subtle dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-1 rounded-xl">
                  100% revisado
                </span>
              )}

              <button
                type="button"
                onClick={() => setLastImportSummary(null)}
                className="p-1.5 text-body3 hover:text-ink rounded-lg hover:bg-surface-2 transition-colors"
                title="Fechar aviso de importação"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barra de Progresso da Revisão */}
          {lastImportSummary.total > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-ink dark:text-white">
                <span>Progresso da categorização</span>
                <span className="tabular-nums text-income">
                  {lastImportSummary.categorized} de {lastImportSummary.total} revisadas (
                  {Math.round((lastImportSummary.categorized / lastImportSummary.total) * 100)}
                  %)
                </span>
              </div>
              <div className="w-full bg-surface-2 dark:bg-surface-2 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((lastImportSummary.categorized / lastImportSummary.total) * 100),
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ) : filterOnlyPending && pendingTransactionsCount === 0 ? (
        /* Estado de Sucesso quando o usuário estava filtrando pendentes e terminou todas */
        <div className="rounded-3xl border border-border/40 bg-card/90 backdrop-blur-sm p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-cds animate-in fade-in-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-2 dark:bg-surface-2 text-ink dark:text-white flex items-center justify-center font-semibold text-base shrink-0">
              ✓
            </div>
            <div>
              <h4 className="font-semibold text-sm sm:text-base text-ink dark:text-white">
                Tudo categorizado!
              </h4>
              <p className="text-xs text-muted-foreground">
                Não há transações pendentes de categorização neste mês.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setFilterOnlyPending(false)}
            className="bg-action hover:bg-action-hover text-white text-xs rounded-xl font-semibold border-0"
          >
            Ver todas as transações
          </Button>
        </div>
      ) : null}

      {/* ===== Deck de revisão em swipe (P2 — padrão Rocket Money) ===== */}
      {!selectionMode && pendingTransactionsCount > 0 ? <SwipeReviewDeck /> : null}

      {/* ===== Barra de seleção (bulk edit P1 — padrão Monarch) ===== */}
      {selectionMode ? (
        <div className="rounded-3xl border-2 border-violet-300 bg-violet-50/80 backdrop-blur-sm p-3.5 flex items-center justify-between gap-3 shadow-cds sticky top-14 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 font-bold text-sm">
              {selectedTxIds.size}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-violet-900">
                {selectedTxIds.size === 1
                  ? '1 transação selecionada'
                  : `${selectedTxIds.size} transações selecionadas`}
              </p>
              <p className="text-[11px] text-violet-700">Toque nas linhas para marcar</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="rounded-xl text-xs text-violet-700 hover:text-violet-900 h-8 px-2"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setBulkCategoryDialogOpen(true)}
              disabled={selectedTxIds.size === 0 || bulkApplying}
              className="rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white h-8 px-3 gap-1.5"
            >
              {bulkApplying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ListChecks className="w-3.5 h-3.5" />
              )}
              <span>Categorizar</span>
            </Button>
          </div>
        </div>
      ) : null}

      {/* Summary Strip (3 Mini Cards com elevação e respiro) */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white/95 backdrop-blur-sm p-3.5 sm:p-4 rounded-2xl border border-line shadow-elevation-1 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-income text-[11px] font-semibold uppercase tracking-wider">
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Receitas</span>
          </div>
          <span className="text-sm sm:text-lg font-semibold tracking-tight text-income tabular-nums mt-1 truncate">
            {formatBRL(monthIncomeCents)}
          </span>
        </div>

        <div className="bg-white/95 backdrop-blur-sm p-3.5 sm:p-4 rounded-2xl border border-line shadow-elevation-1 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-expense text-[11px] font-semibold uppercase tracking-wider">
            <ArrowDownRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Despesas</span>
          </div>
          <span className="text-sm sm:text-lg font-semibold tracking-tight text-expense tabular-nums mt-1 truncate">
            {formatBRL(monthExpenseCents)}
          </span>
        </div>

        <div className="bg-white/95 backdrop-blur-sm p-3.5 sm:p-4 rounded-2xl border border-line shadow-elevation-1 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
            <Scale className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Saldo Mês</span>
          </div>
          <span
            className={`text-sm sm:text-lg font-semibold tracking-tight tabular-nums mt-1 truncate ${
              monthNetCents >= 0 ? 'text-income' : 'text-expense'
            }`}
          >
            {formatBRL(monthNetCents)}
          </span>
        </div>
      </div>

      {/* Barra de Filtro, Chip Discreto de Recorrentes e Contagem */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFilterSheetOpen(true)}
            className={`rounded-xl text-xs font-semibold gap-1.5 h-8 ${
              activeFiltersCount > 0 ? 'border-action bg-action/15 text-ink' : 'text-body2'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrar</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-ink text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          {/* Chip Discreto de Gestão de Recorrentes */}
          <button
            type="button"
            onClick={openRecurringIncomes}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 h-8 rounded-xl border border-line bg-surface hover:bg-surface-2 text-ink transition-colors shadow-2xs active:scale-95 shrink-0"
            title="Gerenciar regras recorrentes mensais"
          >
            <span>Recorrentes 🔁</span>
            {recurringIncomes.length > 0 && (
              <span className="text-[10px] text-body2 font-normal ml-0.5">
                ({recurringIncomes.length})
              </span>
            )}
          </button>

          {activeFiltersCount > 0 && (
            <button
              onClick={() => {
                setFilterOnlyPending(false)
                setFilterMemberIds([])
                setFilterCategoryIds([])
                setFilterType(null)
              }}
              className="text-xs text-body2 hover:text-ink underline transition-colors"
            >
              Limpar filtros
            </button>
          )}

          {/* Bulk edit por seleção (P1 — padrão Monarch/Actual) */}
          <button
            type="button"
            onClick={toggleSelectionMode}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 h-8 rounded-xl border transition-colors shadow-2xs active:scale-95 shrink-0 ${
              selectionMode
                ? 'border-violet-300 bg-violet-50 text-violet-700'
                : 'border-line bg-surface hover:bg-surface-2 text-ink'
            }`}
            title="Selecionar várias transações para categorizar em lote"
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>{selectionMode ? 'Sair da seleção' : 'Selecionar'}</span>
          </button>
        </div>

        <span className="text-xs text-body3 font-medium">
          {`${filteredTransactions.length} ${filteredTransactions.length === 1 ? 'transação' : 'transações'}`}
        </span>
      </div>

      {/* Lista Agrupada por Dia com Ações de Swipe/Botões de Edição e Exclusão */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-xs">
          Carregando transações...
        </div>
      ) : groupedTransactions.length === 0 ? (
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-10 text-center border border-line shadow-elevation-1">
          <div className="w-10 h-10 rounded-xl bg-surface-2 dark:bg-surface-2 text-ink dark:text-white mx-auto flex items-center justify-center shrink-0 mb-2">
            <CategoryIcon name="Tag" className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <p className="font-semibold text-ink dark:text-white text-sm">
            Nenhuma transação encontrada
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            {activeFiltersCount > 0
              ? 'Tente remover os filtros selecionados.'
              : 'Nenhum lançamento registrado neste mês. Você pode lançar manualmente ou importar seu extrato bancário.'}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button
              onClick={openImportStatement}
              variant="outline"
              className="border-border text-ink hover:bg-surface-2 text-xs rounded-xl"
            >
              <UploadCloud className="w-4 h-4 mr-1.5 text-ink" />
              Importar Extrato (OFX)
            </Button>
            <Button
              onClick={() => openNewTransaction('income')}
              className="bg-action hover:bg-action-hover text-white text-xs rounded-xl font-semibold border-0"
            >
              <Plus className="w-4 h-4 mr-1.5 stroke-[2]" />
              Adicionar primeira transação
            </Button>{' '}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTransactions.map(([dateKey, dayTxs]) => (
            <div
              key={dateKey}
              className="bg-card/90 backdrop-blur-sm rounded-3xl border border-border/40 shadow-cds overflow-hidden"
            >
              {/* Cabeçalho do dia */}
              <div className="bg-surface-2/80 dark:bg-surface-2/60 px-4 py-2 border-b border-border/40 flex items-center justify-between">
                <span className="font-semibold text-xs text-ink dark:text-white">
                  {formatDayGroupHeader(dateKey)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  <span>
                    {dayTxs.length} {dayTxs.length === 1 ? 'item' : 'itens'}
                  </span>
                </span>
              </div>

              {/* Lista de itens do dia */}
              <div className="divide-y divide-border/40">
                {dayTxs.map((tx) => {
                  const isPending = !tx.category_id

                  // Se a transação estiver pendente de categoria, exibir EDIÇÃO RÁPIDA EM LINHA
                  if (isPending) {
                    const patternKey = (
                      extractPatternFromDescription(tx.description || '') ||
                      normalizeText(tx.description || '')
                    ).toUpperCase()
                    const matchingIds = (pendingByPatternMap.get(patternKey) || []).filter(
                      (id) => id !== tx.id,
                    )

                    return (
                      <div key={tx.id} className="p-2 sm:p-2.5">
                        <TransactionInlineRow
                          transaction={tx}
                          categories={categories}
                          members={members}
                          isExpanded={expandedPendingTxId === tx.id}
                          onToggleExpand={() =>
                            setExpandedPendingTxId((prev) => (prev === tx.id ? null : tx.id))
                          }
                          onSave={handleSaveInlineCategory}
                          onSaveBatchSameName={handleSaveBatchSameName}
                          matchingCount={matchingIds.length}
                          matchingTransactionIds={matchingIds}
                          aiSuggestion={aiPendingSuggestions[tx.id] || null}
                        />
                      </div>
                    )
                  }

                  const isIncome = tx.type === 'income'
                  const isProjected = tx.status === 'projected'

                  return (
                    <div
                      key={tx.id}
                      onClick={() => {
                        // Modo seleção (bulk edit P1): toque marca/desmarca em vez de abrir detalhe
                        if (selectionMode) {
                          toggleTxSelection(tx.id)
                          return
                        }
                        setSelectedTx(tx)
                        setIsDetailOpen(true)
                      }}
                      className={`flex items-center justify-between p-3.5 hover:bg-surface-2/80 dark:hover:bg-surface-2/40 transition-colors group cursor-pointer ${
                        isProjected
                          ? 'bg-surface-2/50 border-l-4 border-l-amber-400 opacity-90'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        {/* Checkbox no modo seleção (bulk edit P1) */}
                        {selectionMode ? (
                          <div
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                              selectedTxIds.has(tx.id)
                                ? 'bg-violet-600 border-violet-600'
                                : 'border-line-strong bg-surface'
                            }`}
                          >
                            {selectedTxIds.has(tx.id) && (
                              <Check className="w-4 h-4 text-white stroke-[3]" />
                            )}
                          </div>
                        ) : null}
                        <CategoryIconBox
                          icon={tx.category?.icon}
                          color={tx.category?.color}
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          iconClassName="w-4 h-4"
                          strokeWidth={1.5}
                        />

                        <div className="overflow-hidden pr-2">
                          <div className="flex items-center gap-1.5 overflow-hidden flex-wrap">
                            <p
                              className={`font-medium text-xs sm:text-sm group-hover:text-ink dark:group-hover:text-white transition-colors truncate ${
                                isProjected ? 'text-muted-foreground' : 'text-ink dark:text-white'
                              }`}
                              title={formatTransactionTitle(tx)}
                            >
                              {formatTransactionTitle(tx)}
                            </p>
                            {isProjected && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-900 border border-dashed border-amber-400 px-1.5 py-0.2 rounded-md shrink-0">
                                <span>Previsto</span>
                              </span>
                            )}
                            {tx.is_recurring ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300/70 px-1.5 py-0.2 rounded-md shrink-0">
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>Fixa</span>
                              </span>
                            ) : null}
                            {/* Chip "✨ IA" (padrão Copilot Intelligence, P0-2): transação
                                categorizada pela IA tem ai_confidence < 1.0 gravado.
                                Correção manual = null/1.0 → chip some (rastro auditável). */}
                            {tx.ai_confidence != null && tx.ai_confidence < 1.0 ? (
                              <span
                                title="Categoria sugerida pela IA"
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200/90 px-1.5 py-0.2 rounded-md shrink-0"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>IA</span>
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground bg-surface-2 dark:bg-surface-2 px-1.5 py-0.5 rounded">
                              {tx.member?.name || 'Família'}
                            </span>
                            {tx.category ? (
                              <span className="text-xs text-muted-foreground truncate font-normal">
                                <span>{tx.category.name}</span>
                                {tx.subcategory && (
                                  <span className="text-ink dark:text-white font-medium ml-1">
                                    · {tx.subcategory.name}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded shrink-0">
                                <span>Pendente de categoria</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span
                          className={`font-semibold tracking-tight text-xs sm:text-sm md:text-base tabular-nums ${
                            isIncome
                              ? 'text-income'
                              : isProjected
                                ? 'text-amber-800 border-b border-dashed border-amber-400'
                                : 'text-expense'
                          }`}
                        >
                          <span>
                            {isIncome ? '+' : '−'} {formatBRL(tx.amount_cents)}
                          </span>
                        </span>

                        {/* Botões de Ação Rápida (visíveis no hover apenas em telas sm+) */}
                        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingTx(tx)
                              setIsEditTxOpen(true)
                            }}
                            className="p-1.5 text-body3 hover:text-action hover:bg-action-subtle rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setTxToDelete(tx)
                            }}
                            className="p-1.5 text-body3 hover:text-expense hover:bg-rose-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Paginação / Scroll Infinito / Carregar Mais */}
          {hasMoreTransactions && (
            <div className="pt-2 pb-6 flex flex-col items-center justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadMoreTransactions}
                disabled={loadingMore}
                className="rounded-full text-xs font-medium border-border/60 hover:bg-surface-2 text-ink dark:text-white px-5 py-2 shadow-sm"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-action" />
                    <span>Carregando mais lançamentos...</span>
                  </span>
                ) : (
                  <span>Carregar mais 50 lançamentos</span>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
