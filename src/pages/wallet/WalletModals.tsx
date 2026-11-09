import React from 'react'
import {
  Sparkles,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Check,
  Loader2,
  FolderPlus,
  Target,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatBRL, formatMonthYear } from '@/lib/formatters'
import {
  DeleteCategoryConfirmDialog,
  DeleteSubcategoryConfirmDialog,
} from '@/components/categories/DeleteCategoryConfirmDialog'
import { CategoryTransactionsDrawer } from '@/components/wallet/CategoryTransactionsDrawer'
import { ApplyBudgetModelDialog } from '@/components/wallet/ApplyBudgetModelDialog'
import { TransactionDetailDialog } from '@/components/transactions/TransactionDetailDialog'
import { NewTransactionDialog } from '@/components/transactions/NewTransactionDialog'
import { BulkCategoryDialog } from '@/components/wallet/BulkCategoryDialog'
import { useWallet } from './WalletContext'

export function WalletModals() {
  const {
    currentDate,
    monthKey,
    family,
    members,
    categories,
    transactions,
    triggerRefresh,
    loadMonthData,
    openNewTransaction,
    openImportStatement,

    // Filtros
    isFilterSheetOpen,
    setIsFilterSheetOpen,
    filterMemberIds,
    setFilterMemberIds,
    filterCategoryIds,
    setFilterCategoryIds,
    filterType,
    setFilterType,
    filterOnlyPending,
    setFilterOnlyPending,

    // Detalhe e Edição de Transação
    selectedTx,
    setSelectedTx,
    isDetailOpen,
    setIsDetailOpen,
    editingTx,
    setEditingTx,
    editingRecurringRule,
    setEditingRecurringRule,
    isEditTxOpen,
    setIsEditTxOpen,
    txToDelete,
    setTxToDelete,
    handleConfirmDeleteTx,

    // Modal de Orçamento
    isBudgetDialogOpen,
    setIsBudgetDialogOpen,
    editingBudgetCatId,
    editingBudgetSubcatId,
    defaultAmountStr,
    setDefaultAmountStr,
    monthAmountStr,
    setMonthAmountStr,
    isEditingOnlyThisMonth,
    setIsEditingOnlyThisMonth,
    hasMonthOverride,
    savingBudget,
    handleSaveBudgetForm,
    handleResetToDefault,
    handleMakeThisMonthDefault,

    // Drawer de transações por categoria
    budgetDrawerOpen,
    setBudgetDrawerOpen,
    budgetDrawerCategory,
    budgetDrawerSubcategory,
    budgetDrawerFilterType,

    // Exclusão de Categoria / Subcategoria
    categoryToDelete,
    setCategoryToDelete,
    categoryUsageCount,
    loadingCatUsage,
    handleConfirmDeleteCategory,

    subcategoryToDelete,
    setSubcategoryToDelete,
    subcatParentCategoryName,
    subcategoryUsageCount,
    loadingSubUsage,
    handleConfirmDeleteSubcategory,

    // Modais auxiliares
    recurringIncomes,
    recurringOverrides,
    isApplyModelOpen,
    setIsApplyModelOpen,

    // Modal de subcategoria legado
    isNewSubcatDialogOpen,
    setIsNewSubcatDialogOpen,
    categoryForNewSubcat,
    newSubcatName,
    setNewSubcatName,
    savingNewSubcat,
    addNewSubcategory,
  } = useWallet()

  // Resgatar nomes da categoria e subcategoria em edição de orçamento
  const editingBudgetCat = categories.find((c) => c.id === editingBudgetCatId)
  const editingBudgetSubcat = editingBudgetCat?.subcategories?.find(
    (s) => s.id === editingBudgetSubcatId,
  )

  return (
    <>
      {/* 1. Modal de Edição de Orçamento / Teto */}
      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Target className="w-5 h-5" strokeWidth={1.5} />
              </span>
              <span>
                {editingBudgetSubcat
                  ? `Teto de ${editingBudgetSubcat.name}`
                  : `Teto de ${editingBudgetCat?.name || 'Categoria'}`}
              </span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveBudgetForm} className="space-y-4 pt-2">
            {/* Seletor de Escopo: Padrão vs Só Este Mês */}
            <div className="bg-surface-2 p-1.5 rounded-2xl flex gap-1 border border-line">
              <button
                type="button"
                onClick={() => setIsEditingOnlyThisMonth(false)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  !isEditingOnlyThisMonth
                    ? 'bg-surface text-emerald-800 shadow-xs'
                    : 'text-body2 hover:text-ink'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Padrão Mensal (Todos os meses)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditingOnlyThisMonth(true)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  isEditingOnlyThisMonth
                    ? 'bg-surface text-emerald-800 shadow-xs'
                    : 'text-body2 hover:text-ink'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Apenas {formatMonthYear(currentDate)}</span>
              </button>
            </div>

            {!isEditingOnlyThisMonth ? (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-ink">Valor Padrão Mensal (R$)</Label>
                <p className="text-[11px] text-body2">
                  Esse valor será aplicado como meta padrão em todos os meses futuros.
                </p>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-body3 font-bold text-sm">
                    R$
                  </span>
                  <Input
                    type="text"
                    value={defaultAmountStr}
                    onChange={(e) => setDefaultAmountStr(e.target.value)}
                    placeholder="0,00"
                    className="pl-10 text-base font-bold rounded-xl tabular-nums"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-ink">
                  Ajuste Excepcional para {formatMonthYear(currentDate)} (R$)
                </Label>
                <p className="text-[11px] text-body2">
                  Substitui temporariamente o teto padrão neste mês específico.
                </p>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-body3 font-bold text-sm">
                    R$
                  </span>
                  <Input
                    type="text"
                    value={monthAmountStr}
                    onChange={(e) => setMonthAmountStr(e.target.value)}
                    placeholder="0,00"
                    className="pl-10 text-base font-bold rounded-xl tabular-nums"
                  />
                </div>
                {hasMonthOverride && (
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-amber-700 font-medium">
                      Este mês já tem um ajuste ativo.
                    </span>
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Voltar ao padrão</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {isEditingOnlyThisMonth && hasMonthOverride && (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Deseja tornar esse valor o padrão fixo?</span>
                </p>
                <p className="text-body2">
                  Se esse gasto se tornou recorrente, você pode promover esse valor como novo padrão
                  permanente para todos os meses.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMakeThisMonthDefault}
                  className="mt-1 bg-white hover:bg-amber-100 text-amber-900 border-amber-300 text-xs rounded-xl font-bold w-full"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  <span>Tornar este valor o padrão de todos os meses</span>
                </Button>
              </div>
            )}

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBudgetDialogOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingBudget}
                className="bg-action hover:bg-action-hover text-white rounded-xl text-xs font-bold border-0"
              >
                {savingBudget ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  'Salvar Orçamento'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Sheet Lateral de Filtros */}
      <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-6 overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-lg font-bold">Filtrar Transações</SheetTitle>
          </SheetHeader>

          <div className="space-y-6">
            {/* Filtro: Apenas Pendentes */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-body2 uppercase tracking-wider">
                Status de Revisão
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFilterOnlyPending(!filterOnlyPending)}
                  className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    filterOnlyPending
                      ? 'border-amber-600 bg-amber-50 text-amber-900'
                      : 'border-line bg-surface text-ink hover:bg-surface-2'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Apenas pendentes de categoria</span>
                </button>
              </div>
            </div>

            {/* Filtro por Tipo */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-body2 uppercase tracking-wider">
                Tipo de Transação
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFilterType(null)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    filterType === null
                      ? 'border-action bg-action/15 text-ink'
                      : 'border-line text-body2'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('expense')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    filterType === 'expense'
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-line text-body2'
                  }`}
                >
                  Despesas
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('income')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    filterType === 'income'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-line text-body2'
                  }`}
                >
                  Receitas
                </button>
              </div>
            </div>

            {/* Filtro por Membro */}
            {members.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-body2 uppercase tracking-wider">
                  Membro
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const isSelected = filterMemberIds.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setFilterMemberIds((prev) =>
                            isSelected ? prev.filter((id) => id !== m.id) : [...prev, m.id],
                          )
                        }}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all ${
                          isSelected
                            ? 'bg-ink text-white border-ink'
                            : 'bg-surface text-body2 border-line hover:bg-surface-2'
                        }`}
                      >
                        {m.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Filtro por Categoria */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-body2 uppercase tracking-wider">
                Categoria
              </Label>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                {categories.map((c) => {
                  const isSelected = filterCategoryIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setFilterCategoryIds((prev) =>
                          isSelected ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                        )
                      }}
                      className={`text-xs px-2.5 py-1.5 rounded-xl border font-medium transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-ink text-white border-ink'
                          : 'bg-surface text-body2 border-line hover:bg-surface-2'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                      <span>{c.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Ações de Limpar e Aplicar */}
            <div className="pt-6 border-t flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilterOnlyPending(false)
                  setFilterMemberIds([])
                  setFilterCategoryIds([])
                  setFilterType(null)
                }}
                className="flex-1 rounded-xl text-xs"
              >
                Limpar Tudo
              </Button>
              <Button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="flex-1 bg-action hover:bg-action-hover text-white rounded-xl text-xs font-bold border-0"
              >
                Ver Resultados
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 3. Diálogo de Detalhes da Transação */}
      {selectedTx && (
        <TransactionDetailDialog
          transaction={selectedTx}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          onEdit={(tx) => {
            setIsDetailOpen(false)
            setEditingTx(tx)
            setIsEditTxOpen(true)
          }}
          onDelete={(tx) => {
            setIsDetailOpen(false)
            setTxToDelete(tx)
          }}
        />
      )}

      {/* 4. Diálogo de Criação/Edição Completa de Transação */}
      <NewTransactionDialog
        open={isEditTxOpen}
        onOpenChange={(open) => {
          setIsEditTxOpen(open)
          if (!open) {
            setEditingTx(null)
            setEditingRecurringRule(null)
          }
        }}
        editingTransaction={editingTx}
        editingRecurringRule={editingRecurringRule}
        onSuccess={() => {
          triggerRefresh()
          loadMonthData()
        }}
      />

      {/* 5. Diálogo de Confirmação de Exclusão de Transação */}
      <Dialog open={Boolean(txToDelete)} onOpenChange={(open) => !open && setTxToDelete(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-ink">Excluir Transação?</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-body2 space-y-2">
            <p>
              Tem certeza que deseja excluir esta transação de{' '}
              <span className="font-bold text-ink">
                {txToDelete ? formatBRL(txToDelete.amount_cents) : ''}
              </span>
              ?
            </p>
            <p className="text-body2 italic">
              Esta ação removerá o lançamento do seu extrato e atualizará o total gasto da
              categoria.
            </p>
          </div>
          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTxToDelete(null)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDeleteTx}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
            >
              Sim, Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Drawer de Transações Filtradas por Categoria / Subcategoria */}
      <CategoryTransactionsDrawer
        open={budgetDrawerOpen}
        onOpenChange={setBudgetDrawerOpen}
        category={budgetDrawerCategory}
        subcategory={budgetDrawerSubcategory}
        filterType={budgetDrawerFilterType}
        transactions={transactions}
        onTransactionUpdated={() => {
          triggerRefresh()
          loadMonthData()
        }}
      />

      {/* 7. Modal de Exclusão com Verificação de Vínculo de Categoria */}
      <DeleteCategoryConfirmDialog
        category={categoryToDelete}
        usageCount={categoryUsageCount}
        loadingUsage={loadingCatUsage}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleConfirmDeleteCategory}
      />

      {/* 8. Modal de Exclusão com Verificação de Vínculo de Subcategoria */}
      <DeleteSubcategoryConfirmDialog
        subcategory={subcategoryToDelete}
        parentCategoryName={subcatParentCategoryName}
        usageCount={subcategoryUsageCount}
        loadingUsage={loadingSubUsage}
        onClose={() => setSubcategoryToDelete(null)}
        onConfirm={handleConfirmDeleteSubcategory}
      />

      {/* 9. Modal de Aplicação de Modelo de Orçamento Sugerido */}
      {family && (
        <ApplyBudgetModelDialog
          open={isApplyModelOpen}
          onOpenChange={setIsApplyModelOpen}
          family={family}
          categories={categories}
          onSuccess={() => {
            triggerRefresh()
            loadMonthData()
          }}
        />
      )}

      {/* 11. Modal de Criação Rápida de Subcategoria (Fallback legado) */}
      <Dialog open={isNewSubcatDialogOpen} onOpenChange={setIsNewSubcatDialogOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-emerald-600" />
              <span>Nova Subcategoria</span>
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!categoryForNewSubcat || !newSubcatName.trim()) return
              try {
                await addNewSubcategory(categoryForNewSubcat.id, newSubcatName.trim())
                setIsNewSubcatDialogOpen(false)
                setNewSubcatName('')
                triggerRefresh()
                await loadMonthData()
              } catch (err: any) {
                console.error('Erro ao criar subcategoria:', err)
              }
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-2">
              <Label className="text-xs font-bold text-ink">Pertence à Categoria</Label>
              <div className="p-2.5 rounded-xl bg-surface-2 flex items-center gap-2 text-xs font-bold text-ink">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: categoryForNewSubcat?.color || '#10B981' }}
                />
                <span>{categoryForNewSubcat?.name}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-ink">Nome da Subcategoria</Label>
              <Input
                type="text"
                placeholder="Ex: Combustível, Açougue..."
                value={newSubcatName}
                onChange={(e) => setNewSubcatName(e.target.value)}
                className="rounded-xl text-sm"
                autoFocus
                required
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewSubcatDialogOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingNewSubcat || !newSubcatName.trim()}
                className="bg-action hover:bg-action-hover text-white rounded-xl text-xs font-bold border-0"
              >
                {savingNewSubcat ? 'Criando...' : 'Criar Subcategoria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk edit por seleção (P1 — padrão Monarch/Actual) */}
      <BulkCategoryDialog />
    </>
  )
}
