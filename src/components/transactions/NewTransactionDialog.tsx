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
import { createTransaction, updateTransaction } from '@/services/transactions'
import { upsertCategorizationRule } from '@/services/categorization-rules'
import { extractPatternFromDescription } from '@/services/import/categorization'
import { parseBRLToCents, formatNumberBRL } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import type { Transaction } from '@/types/finance'
import { ArrowDownRight, ArrowUpRight, Loader2, UploadCloud } from 'lucide-react'

interface NewTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTransaction?: Transaction | null
  onSuccess?: () => void
}

export const NewTransactionDialog: React.FC<NewTransactionDialogProps> = ({
  open,
  onOpenChange,
  editingTransaction,
  onSuccess,
}) => {
  const {
    family,
    members,
    categories,
    newTransactionDefaultType,
    triggerRefresh,
    openImportStatement,
  } = useFamily()
  const { user } = useAuth()
  const { toast } = useToast()

  const [type, setType] = useState<'income' | 'expense'>(newTransactionDefaultType)
  const [description, setDescription] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [memberId, setMemberId] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [subcategoryId, setSubcategoryId] = useState<string>('none')
  const [transactionDate, setTransactionDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [rememberRule, setRememberRule] = useState<boolean>(true)
  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type)
      setDescription(editingTransaction.description || '')
      setAmountStr(formatNumberBRL(editingTransaction.amount_cents))
      setMemberId(editingTransaction.member_id)
      setCategoryId(editingTransaction.category_id || 'none')
      setSubcategoryId(editingTransaction.subcategory_id || 'none')
      setTransactionDate(editingTransaction.transaction_date)
    } else {
      setType(newTransactionDefaultType)
      setDescription('')
      setAmountStr('')
      // Padrão primeiro membro
      if (members.length > 0 && !memberId) {
        setMemberId(members[0].id)
      }
      setCategoryId('none')
      setSubcategoryId('none')
      setTransactionDate(new Date().toISOString().slice(0, 10))
    }
    setRememberRule(true)
    setErrorMsg(null)
  }, [editingTransaction, newTransactionDefaultType, open, members])

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
        })
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
