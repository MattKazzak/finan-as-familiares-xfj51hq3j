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
import { useFamily } from '@/hooks/use-family'
import { createTransaction, updateTransaction } from '@/services/transactions'
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
  const { toast } = useToast()

  const [type, setType] = useState<'income' | 'expense'>(newTransactionDefaultType)
  const [description, setDescription] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [memberId, setMemberId] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type)
      setDescription(editingTransaction.description || '')
      setAmountStr(formatNumberBRL(editingTransaction.amount_cents))
      setMemberId(editingTransaction.member_id)
      setCategoryId(editingTransaction.category_id || 'none')
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
      setTransactionDate(new Date().toISOString().slice(0, 10))
    }
    setErrorMsg(null)
  }, [editingTransaction, newTransactionDefaultType, open, members])

  const filteredCategories = categories.filter((c) => c.type === type)

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
          type,
          amount_cents: cents,
          description: description.trim(),
          transaction_date: transactionDate,
        })
        toast({ title: 'Sucesso', description: 'Transação atualizada com sucesso.' })
      } else {
        await createTransaction({
          family_id: family.id,
          member_id: memberId,
          category_id: categoryId === 'none' ? null : categoryId,
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
              {editingTransaction ? 'Editar Transação' : 'Nova Transação'}
            </DialogTitle>
            {!editingTransaction && (
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
            )}
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
            Despesa
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
            Receita
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {errorMsg}
            </div>
          )}

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
                      {m.name} {m.is_admin ? '(Admin)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoria */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingTransaction ? 'Salvar Alterações' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
