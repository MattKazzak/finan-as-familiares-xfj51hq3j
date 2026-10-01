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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL, formatDayGroupHeader } from '@/lib/formatters'
import { formatTransactionTitle } from '@/services/installments'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { TransactionInlineRow } from '@/components/transactions/TransactionInlineRow'
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
    isCategorizingPendingWithAi,
    handleCategorizePendingWithAi,
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
    setSelectedTx,
    setIsDetailOpen,
    setEditingTx,
    setIsEditTxOpen,
    setTxToDelete,
  } = useWallet()

  return (
    <div className="space-y-5 mt-0 animate-in fade-in-50 duration-200">
      {/* 1. VISÃO DE RESUMO PÓS-IMPORTAÇÃO & SEÇÃO DE REVISÃO DE PENDENTES (Com Barra de Progresso) */}
      {lastImportSummary ? (
        <div className="rounded-3xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 p-4 sm:p-5 shadow-sm space-y-3 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
                {lastImportSummary.pending === 0 ? '🎉' : '📥'}
              </div>
              <div className="flex-1">
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                  {lastImportSummary.pending === 0 ? (
                    'Tudo categorizado! 🎉'
                  ) : (
                    <>
                      📥 Extrato importado: {lastImportSummary.categorized} de{' '}
                      {lastImportSummary.total} transações categorizadas
                    </>
                  )}
                </h4>
                <p className="text-xs text-slate-600 mt-1">
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
                  className={`text-xs font-bold rounded-xl shadow-xs transition-all gap-1.5 ${
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
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-xl">
                  100% revisado
                </span>
              )}

              <button
                type="button"
                onClick={() => setLastImportSummary(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Fechar aviso de importação"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barra de Progresso da Revisão */}
          {lastImportSummary.total > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>Progresso da categorização</span>
                <span className="tabular-nums text-emerald-800">
                  {lastImportSummary.categorized} de {lastImportSummary.total} revisadas (
                  {Math.round((lastImportSummary.categorized / lastImportSummary.total) * 100)}
                  %)
                </span>
              </div>
              <div className="w-full bg-emerald-200/70 h-2.5 rounded-full overflow-hidden">
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
      ) : pendingTransactionsCount > 0 ? (
        /* Banner complementar quando há pendentes sem o lastImportSummary ativo */
        <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-4 h-4 text-amber-700" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                Lançamentos Pendentes ({pendingTransactionsCount})
              </h4>
              <span className="text-[11px] text-slate-600 block">
                Você tem {pendingTransactionsCount}{' '}
                {pendingTransactionsCount === 1 ? 'transação pendente' : 'transações pendentes'} de
                categorização neste mês. Toque na linha para categorizar ou utilize a IA.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={handleCategorizePendingWithAi}
              disabled={isCategorizingPendingWithAi}
              className="text-xs font-bold rounded-xl shrink-0 bg-violet-600 hover:bg-violet-700 text-white shadow-2xs gap-1.5 h-8 px-3"
            >
              {isCategorizingPendingWithAi ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Categorizando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-violet-200" />
                  <span>✨ Categorizar pendentes com IA</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilterOnlyPending((prev) => !prev)}
              className={`text-xs font-bold rounded-xl shrink-0 h-8 ${
                filterOnlyPending
                  ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                  : 'border-amber-300 text-amber-900 hover:bg-amber-100/70 bg-white'
              }`}
            >
              {filterOnlyPending
                ? 'Ver todas as transações'
                : `Ver apenas pendentes (${pendingTransactionsCount})`}
            </Button>
          </div>
        </div>
      ) : filterOnlyPending && pendingTransactionsCount === 0 ? (
        /* Estado de Sucesso quando o usuário estava filtrando pendentes e terminou todas */
        <div className="rounded-3xl border border-emerald-300 bg-emerald-50/80 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
              🎉
            </div>
            <div>
              <h4 className="font-extrabold text-sm sm:text-base text-emerald-950">
                Tudo categorizado! Parabéns!
              </h4>
              <p className="text-xs text-emerald-800">
                Não há mais nenhuma transação pendente neste mês.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setFilterOnlyPending(false)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded-xl font-bold"
          >
            Ver todas as transações
          </Button>
        </div>
      ) : null}

      {/* Summary Strip (3 Mini Cards) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold uppercase tracking-wider">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Receitas</span>
          </div>
          <span className="text-sm sm:text-lg font-bold text-slate-900 tabular-nums mt-1 truncate">
            {formatBRL(monthIncomeCents)}
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-red-600 text-[11px] font-bold uppercase tracking-wider">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Despesas</span>
          </div>
          <span className="text-sm sm:text-lg font-bold text-slate-900 tabular-nums mt-1 truncate">
            {formatBRL(monthExpenseCents)}
          </span>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <Scale className="w-3.5 h-3.5" />
            <span>Saldo Mês</span>
          </div>
          <span
            className={`text-sm sm:text-lg font-bold tabular-nums mt-1 truncate ${
              monthNetCents >= 0 ? 'text-emerald-700' : 'text-red-600'
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
              activeFiltersCount > 0
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'text-slate-600'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrar</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          {/* Chip Discreto de Gestão de Recorrentes */}
          <button
            type="button"
            onClick={openRecurringIncomes}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors shadow-2xs active:scale-95 shrink-0"
            title="Gerenciar regras recorrentes mensais"
          >
            <span>Recorrentes 🔁</span>
            {recurringIncomes.length > 0 && (
              <span className="text-[10px] text-slate-500 font-normal ml-0.5">
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
              className="text-xs text-slate-500 hover:text-slate-800 underline transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>

        <span className="text-xs text-slate-400 font-medium">
          {`${filteredTransactions.length} ${filteredTransactions.length === 1 ? 'transação' : 'transações'}`}
        </span>
      </div>

      {/* Lista Agrupada por Dia com Ações de Swipe/Botões de Edição e Exclusão */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Carregando transações...</div>
      ) : groupedTransactions.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center text-slate-400 mb-2">
            🏷️
          </div>
          <p className="font-bold text-slate-800 text-sm">Nenhuma transação encontrada</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {activeFiltersCount > 0
              ? 'Tente remover os filtros selecionados.'
              : 'Nenhum lançamento registrado neste mês. Você pode lançar manualmente ou importar seu extrato bancário.'}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button
              onClick={openImportStatement}
              variant="outline"
              className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xs rounded-xl"
            >
              <UploadCloud className="w-4 h-4 mr-1.5 text-emerald-600" />
              Importar Extrato (OFX)
            </Button>
            <Button
              onClick={() => openNewTransaction('expense')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nova transação
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTransactions.map(([dateKey, dayTxs]) => (
            <div
              key={dateKey}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden"
            >
              {/* Cabeçalho do dia */}
              <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700">
                  {formatDayGroupHeader(dateKey)}
                </span>
                <span className="text-[11px] text-slate-400">
                  <span>
                    {dayTxs.length} {dayTxs.length === 1 ? 'item' : 'itens'}
                  </span>
                </span>
              </div>

              {/* Lista de itens do dia */}
              <div className="divide-y divide-slate-100">
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
                        setSelectedTx(tx)
                        setIsDetailOpen(true)
                      }}
                      className={`flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors group cursor-pointer ${
                        isProjected ? 'bg-slate-50/50 border-l-4 border-l-amber-400 opacity-90' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                          style={{
                            backgroundColor:
                              tx.category?.color ||
                              (isIncome ? '#10B981' : isProjected ? '#F59E0B' : '#64748B'),
                          }}
                        >
                          <CategoryIcon name={tx.category?.icon} className="w-5 h-5" />
                        </div>

                        <div className="overflow-hidden pr-2">
                          <div className="flex items-center gap-1.5 overflow-hidden flex-wrap">
                            <p
                              className={`font-semibold text-sm group-hover:text-emerald-700 transition-colors truncate ${
                                isProjected ? 'text-slate-700' : 'text-slate-900'
                              }`}
                              title={formatTransactionTitle(tx)}
                            >
                              {formatTransactionTitle(tx)}
                            </p>
                            {isProjected && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 border border-dashed border-amber-400 px-1.5 py-0.2 rounded-md shrink-0">
                                <span>Previsto</span>
                              </span>
                            )}
                            {tx.is_recurring ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/70 px-1.5 py-0.2 rounded-md shrink-0">
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>Fixa</span>
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {tx.member?.name || 'Família'}
                            </span>
                            {tx.category ? (
                              <span className="text-[11px] text-slate-500 font-medium truncate">
                                <span>{tx.category.name}</span>
                                {tx.subcategory && (
                                  <span className="text-emerald-700 font-semibold ml-1">
                                    · {tx.subcategory.name}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded shrink-0">
                                <span>Pendente de categoria</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span
                          className={`font-bold text-sm sm:text-base tabular-nums ${
                            isIncome
                              ? 'text-emerald-600'
                              : isProjected
                                ? 'text-amber-800 border-b border-dashed border-amber-400'
                                : 'text-red-600'
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
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        </div>
      )}
    </div>
  )
}
