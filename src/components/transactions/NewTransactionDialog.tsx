import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { useAuth } from '@/hooks/use-auth'
import { useFamily } from '@/hooks/use-family'
import {
  createTransaction,
  createTransactionsBatch,
  updateTransaction,
} from '@/services/transactions'
import { generateInstallmentTransactions } from '@/services/installments'
import { upsertCategorizationRule } from '@/services/categorization-rules'
import { extractPatternFromDescription } from '@/services/import/categorization'
import { parseBRLToCents, formatNumberBRL, formatBRL } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import type { Transaction } from '@/types/finance'
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  UploadCloud,
  Layers,
  Minus,
  Plus,
} from 'lucide-react'

export interface NewTransactionPrefill {
  initialType?: 'income' | 'expense'
  initialCategoryId?: string
  initialSubcategoryId?: string
  initialAmountCents?: number
  initialDescription?: string
  initialMemberId?: string
}

export interface NewTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTransaction?: Transaction | null
  onSuccess?: () => void
  initialType?: 'income' | 'expense'
  initialCategoryId?: string
  initialSubcategoryId?: string
  initialAmountCents?: number
  initialDescription?: string
  initialMemberId?: string
}

export const NewTransactionDialog: React.FC<NewTransactionDialogProps> = ({
  open,
  onOpenChange,
  editingTransaction,
  onSuccess,
  initialType,
  initialCategoryId,
  initialSubcategoryId,
  initialAmountCents,
  initialDescription,
  initialMemberId,
}) => {
  const {
    family,
    members,
    categories,
    newTransactionDefaultType,
    newTransactionPrefill,
    triggerRefresh,
    openImportStatement,
    voiceTransactionData,
    setVoiceTransactionData,
  } = useFamily()
  const { user } = useAuth()
  const { toast } = useToast()

  const [type, setType] = useState<'income' | 'expense'>(
    initialType || newTransactionPrefill?.initialType || newTransactionDefaultType || 'expense',
  )
  const [description, setDescription] = useState(
    initialDescription || newTransactionPrefill?.initialDescription || '',
  )
  const [amountStr, setAmountStr] = useState(
    initialAmountCents !== undefined
      ? formatNumberBRL(initialAmountCents)
      : newTransactionPrefill?.initialAmountCents !== undefined
        ? formatNumberBRL(newTransactionPrefill.initialAmountCents)
        : '',
  )
  const [memberId, setMemberId] = useState(
    initialMemberId || newTransactionPrefill?.initialMemberId || '',
  )
  const [categoryId, setCategoryId] = useState<string>(
    initialCategoryId || newTransactionPrefill?.initialCategoryId || 'none',
  )
  const [subcategoryId, setSubcategoryId] = useState<string>(
    initialSubcategoryId || newTransactionPrefill?.initialSubcategoryId || 'none',
  )
  const [transactionDate, setTransactionDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [rememberRule, setRememberRule] = useState<boolean>(true)

  // Estado de parcelamento
  const [installmentsCount, setInstallmentsCount] = useState<number>(1)
  const [amountMode, setAmountMode] = useState<'per_installment' | 'total'>('per_installment')

  useEffect(() => {
    if (!open) return

    if (editingTransaction) {
      setType(editingTransaction.type)
      setDescription(editingTransaction.description || '')
      setAmountStr(formatNumberBRL(editingTransaction.amount_cents))
      setMemberId(editingTransaction.member_id)
      setCategoryId(editingTransaction.category_id || 'none')
      setSubcategoryId(editingTransaction.subcategory_id || 'none')
      setTransactionDate(editingTransaction.transaction_date)
      setInstallmentsCount(editingTransaction.installment_total || 1)
      setAmountMode('per_installment')
    } else {
      const effectiveType =
        initialType ?? newTransactionPrefill?.initialType ?? newTransactionDefaultType ?? 'expense'
      const effectiveDesc = initialDescription ?? newTransactionPrefill?.initialDescription ?? ''
      const effectiveAmountCents = initialAmountCents ?? newTransactionPrefill?.initialAmountCents
      const effectiveMember =
        initialMemberId ??
        newTransactionPrefill?.initialMemberId ??
        (members.length > 0 ? members[0].id : '')
      const effectiveCategory =
        initialCategoryId ?? newTransactionPrefill?.initialCategoryId ?? 'none'
      const effectiveSubcategory =
        initialSubcategoryId ?? newTransactionPrefill?.initialSubcategoryId ?? 'none'

      setType(effectiveType)
      setDescription(effectiveDesc)
      setAmountStr(effectiveAmountCents !== undefined ? formatNumberBRL(effectiveAmountCents) : '')
      setMemberId(effectiveMember)
      setCategoryId(effectiveCategory)
      setSubcategoryId(effectiveSubcategory)
      setTransactionDate(new Date().toISOString().slice(0, 10))
      setInstallmentsCount(1)
      setAmountMode('per_installment')
    }
    setRememberRule(true)
    setErrorMsg(null)
  }, [
    open,
    editingTransaction,
    initialType,
    initialCategoryId,
    initialSubcategoryId,
    initialAmountCents,
    initialDescription,
    initialMemberId,
    newTransactionDefaultType,
    newTransactionPrefill,
    members,
  ])

  // Subcategorias disponíveis para a categoria selecionada
  const selectedCategoryObj = categories.find((c) => c.id === categoryId)
  const availableSubcategories = selectedCategoryObj?.subcategories || []

  // Ao alterar a categoria pai, limpa a subcategoria selecionada
  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId)
    setSubcategoryId('none')
  }

  const filteredCategories = categories.filter((c) => c.type === type)

  // Verifica se a transação sendo editada estava sem categoria
  const isEditingUncategorized = Boolean(editingTransaction && !editingTransaction.category_id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family) {
      setErrorMsg('Família não configurada.')
      return
    }

    const cents = parseBRLToCents(amountStr)
    if (cents <= 0) {
      setErrorMsg('Informe um valor válido maior que zero.')
      return
    }

    if (!memberId) {
      setErrorMsg('Selecione um membro da família.')
      return
    }

    if (!description.trim()) {
      setErrorMsg('Informe uma descrição.')
      return
    }

    try {
      setLoading(true)
      setErrorMsg(null)

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, {
          member_id: memberId,
          category_id: categoryId === 'none' ? null : categoryId,
          subcategory_id: subcategoryId === 'none' || categoryId === 'none' ? null : subcategoryId,
          type,
          amount_cents: cents,
          description: description.trim(),
          transaction_date: transactionDate,
        })

        // Aprendizado contínuo: se o usuário optou por lembrar a regra e definiu uma categoria válida
        if (rememberRule && categoryId !== 'none') {
          try {
            const rawPattern = extractPatternFromDescription(description.trim())
            if (rawPattern && rawPattern.length >= 2) {
              await upsertCategorizationRule({
                family_id: family.id,
                user_id: user?.id || null,
                pattern: rawPattern,
                category_id: categoryId,
                subcategory_id: subcategoryId === 'none' ? null : subcategoryId,
              })
              console.log('Regra de categorização memorizada com sucesso:', rawPattern)
            }
          } catch (ruleErr) {
            console.warn('Não foi possível salvar regra de categorização:', ruleErr)
          }
        }

        toast({ title: 'Sucesso', description: 'Transação atualizada com sucesso.' })
      } else if (type === 'expense' && installmentsCount > 1) {
        // Compra parcelada: gera a parcela 1 (status 'confirmed') e as demais (status 'projected')
        const perInstallmentCents =
          amountMode === 'total' ? Math.round(cents / installmentsCount) : cents

        const { transactions: installmentPayloads } = generateInstallmentTransactions({
          familyId: family.id,
          memberId,
          categoryId: categoryId === 'none' ? null : categoryId,
          subcategoryId: subcategoryId === 'none' || categoryId === 'none' ? null : subcategoryId,
          baseDescription: description.trim(),
          amountCents: perInstallmentCents,
          baseDate: transactionDate,
          startInstallmentNumber: 1,
          totalInstallments: installmentsCount,
        })

        await createTransactionsBatch(installmentPayloads)

        toast({
          title: 'Compra parcelada registrada! 🎉',
          description: `1ª parcela confirmada neste mês e ${installmentsCount - 1} parcelas projetadas para os próximos meses.`,
        })
      } else {
        await createTransaction({
          family_id: family.id,
          member_id: memberId,
          category_id: categoryId === 'none' ? null : categoryId,
          subcategory_id: subcategoryId === 'none' || categoryId === 'none' ? null : subcategoryId,
          type,
          amount_cents: cents,
          description: description.trim(),
          transaction_date: transactionDate,
          is_installment: false,
          status: 'confirmed',
        })

        // Se o usuário optou por lembrar a regra e definiu uma categoria válida para nova transação
        if (rememberRule && categoryId !== 'none') {
          try {
            const rawPattern = extractPatternFromDescription(description.trim())
            if (rawPattern && rawPattern.length >= 2) {
              await upsertCategorizationRule({
                family_id: family.id,
                user_id: user?.id || null,
                pattern: rawPattern,
                category_id: categoryId,
                subcategory_id: subcategoryId === 'none' ? null : subcategoryId,
              })
              console.log('Regra de categorização memorizada com sucesso:', rawPattern)
            }
          } catch (ruleErr) {
            console.warn('Não foi possível salvar regra de categorização:', ruleErr)
          }
        }

        toast({ title: 'Sucesso', description: 'Transação registrada com sucesso!' })
      }

      triggerRefresh()
      if (onSuccess) onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao salvar transação:', err)
      setErrorMsg('Não foi possível salvar a transação. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl p-6 sm:p-7">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-xl font-bold text-slate-900">
              <span>{editingTransaction ? 'Editar Transação' : 'Nova Transação'}</span>
            </DialogTitle>
            {!editingTransaction ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={openImportStatement}
                className="text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 font-semibold gap-1.5 h-8 px-2.5 rounded-xl"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Importar extrato</span>
                <span className="sm:hidden">Extrato</span>
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        {/* Alternador Despesa / Receita */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl my-2">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              type === 'expense'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Despesa</span>
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              type === 'income'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Receita</span>
          </button>{' '}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {errorMsg ? (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              <span>{errorMsg}</span>
            </div>
          ) : null}

          {/* Valor */}
          <div>
            <Label htmlFor="tx-amount" className="text-xs font-semibold text-slate-700">
              Valor (R$)
            </Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                R$
              </span>
              <Input
                id="tx-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="pl-10 text-lg font-bold tabular-nums"
                autoFocus
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="tx-desc" className="text-xs font-semibold text-slate-700">
              Descrição
            </Label>
            <Input
              id="tx-desc"
              type="text"
              placeholder="Ex.: Supermercado, Aluguel, Salário"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Membro responsável */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Membro da Família</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o membro" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span>
                        {m.name}
                        {m.is_admin ? ' (Admin)' : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoria */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
              <Select value={categoryId} onValueChange={handleCategoryChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span>Sem categoria</span>
                  </SelectItem>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span>{c.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subcategoria (aparece quando categoria estiver selecionada) */}
          {categoryId !== 'none' && availableSubcategories.length > 0 ? (
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  <span>Subcategoria </span>
                  <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
                </Label>
                {subcategoryId !== 'none' ? (
                  <button
                    type="button"
                    onClick={() => setSubcategoryId('none')}
                    className="text-[11px] text-slate-400 hover:text-slate-600"
                  >
                    <span>Limpar</span>
                  </button>
                ) : null}
              </div>
              <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Nenhuma (categoria geral)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span>Nenhuma</span>
                  </SelectItem>
                  {availableSubcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      <span>{sub.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Data */}
          <div>
            <Label htmlFor="tx-date" className="text-xs font-semibold text-slate-700">
              Data da Transação
            </Label>
            <Input
              id="tx-date"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Seção de Parcelamento (disponível para novas despesas) */}
          {!editingTransaction && type === 'expense' && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <Label className="text-xs font-bold text-slate-800">Parcelamento</Label>
                </div>
                {installmentsCount > 1 && (
                  <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                    {installmentsCount}x de{' '}
                    {formatBRL(
                      amountMode === 'total'
                        ? Math.round(parseBRLToCents(amountStr) / installmentsCount)
                        : parseBRLToCents(amountStr),
                    )}
                  </span>
                )}
              </div>

              {/* Stepper de Parcelas */}
              <div className="flex items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-600 font-medium pl-1">
                  {installmentsCount === 1 ? 'À vista (1x)' : `Parcelar em ${installmentsCount}x`}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInstallmentsCount((prev) => Math.max(1, prev - 1))}
                    disabled={installmentsCount <= 1}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors font-bold"
                    title="Diminuir parcelas"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <span className="w-8 text-center font-bold text-sm text-slate-900 tabular-nums">
                    {installmentsCount}x
                  </span>

                  <button
                    type="button"
                    onClick={() => setInstallmentsCount((prev) => Math.min(48, prev + 1))}
                    disabled={installmentsCount >= 48}
                    className="w-8 h-8 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 flex items-center justify-center transition-colors font-bold"
                    title="Aumentar parcelas"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Opção se o valor digitado é por parcela ou total */}
              {installmentsCount > 1 && (
                <div className="space-y-2 pt-1 border-t border-slate-200/70">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">O valor digitado acima é:</span>
                    <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setAmountMode('per_installment')}
                        className={`px-2 py-1 rounded-md transition-all ${
                          amountMode === 'per_installment'
                            ? 'bg-white text-purple-950 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Por parcela
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmountMode('total')}
                        className={`px-2 py-1 rounded-md transition-all ${
                          amountMode === 'total'
                            ? 'bg-white text-purple-950 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Total da compra
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    💡 A 1ª parcela será confirmada no mês da transação. As outras{' '}
                    <strong>{installmentsCount - 1} parcelas</strong> serão criadas automaticamente
                    como <em>projetadas</em> nos próximos meses, já abatendo do orçamento futuro.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Opção de Aprendizado Contínuo para transação pendente ou edição com categoria definida */}
          {categoryId !== 'none' && (
            <div
              className={`p-2.5 rounded-xl border transition-colors ${
                isEditingUncategorized
                  ? 'bg-purple-50/70 border-purple-200'
                  : 'bg-slate-50 border-slate-200/80'
              }`}
            >
              <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                <input
                  type="checkbox"
                  checked={rememberRule}
                  onChange={(e) => setRememberRule(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>Lembrar para transações futuras com este nome</span>
                  </span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Auto-categorizar importações futuras semelhantes a &quot;
                    {extractPatternFromDescription(description) || description || '...'}&quot;.
                  </p>
                </div>
              </label>
            </div>
          )}

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <span className="flex items-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{editingTransaction ? 'Salvar Alterações' : 'Confirmar'}</span>
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
