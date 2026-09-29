import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { useFamily } from '@/hooks/use-family'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  createTransaction,
  createTransactionsBatch,
  updateTransaction,
} from '@/services/transactions'
import { generateInstallmentTransactions } from '@/services/installments'
import { createRecurringIncome, updateRecurringIncome } from '@/services/recurring-incomes'
import { fetchCategorizationRules, upsertCategorizationRule } from '@/services/categorization-rules'
import {
  matchCategorization,
  extractPatternFromDescription,
} from '@/services/import/categorization'
import { parseBRLToCents, formatNumberBRL, formatBRL } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import type { CategorizationRule, Transaction, RecurringIncome } from '@/types/finance'
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Mic,
  Repeat,
  Layers,
  Minus,
  Plus,
  Sparkles,
  Calendar,
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
  editingRecurringRule?: RecurringIncome | null
  onSuccess?: () => void
  initialType?: 'income' | 'expense'
  initialCategoryId?: string
  initialSubcategoryId?: string
  initialAmountCents?: number
  initialDescription?: string
  initialMemberId?: string
  onOpenVoice?: () => void
}

export const NewTransactionDialog: React.FC<NewTransactionDialogProps> = ({
  open,
  onOpenChange,
  editingTransaction,
  editingRecurringRule,
  onSuccess,
  initialType,
  initialCategoryId,
  initialSubcategoryId,
  initialAmountCents,
  initialDescription,
  initialMemberId,
  onOpenVoice,
}) => {
  const isMobile = useIsMobile()
  const {
    family,
    members,
    categories,
    activeMemberId,
    newTransactionDefaultType,
    newTransactionPrefill,
    triggerRefresh,
    setVoiceTransactionData,
  } = useFamily()
  const { user } = useAuth()
  const { toast } = useToast()

  // Regras de categorização do banco para sugestão/auto-categorização
  const [dbRules, setDbRules] = useState<CategorizationRule[]>([])

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

  // Feedback de auto-sugestão de categoria
  const [suggestedCategoryInfo, setSuggestedCategoryInfo] = useState<string | null>(null)
  // Rastreia se o usuário escolheu uma categoria manualmente para não sobrescrever
  const userManuallyChangedCategoryRef = useRef(false)

  // Estado de recorrência ("Repetir todo mês")
  const [isRecurring, setIsRecurring] = useState<boolean>(false)
  const [dayOfMonth, setDayOfMonth] = useState<number>(() => new Date().getDate())

  // Estado de parcelamento (apenas para despesas avulsas não-recorrentes)
  const [installmentsCount, setInstallmentsCount] = useState<number>(1)
  const [amountMode, setAmountMode] = useState<'per_installment' | 'total'>('per_installment')

  // Carrega regras de categorização para auto-sugestão em tempo de digitação
  useEffect(() => {
    if (!open || !family?.id) return
    let isMounted = true
    fetchCategorizationRules(family.id)
      .then((rules) => {
        if (isMounted) setDbRules(rules)
      })
      .catch((err) => {
        console.warn('Erro ao carregar regras de categorização no modal:', err)
      })
    return () => {
      isMounted = false
    }
  }, [open, family?.id])

  // Inicializa os campos ao abrir o modal
  useEffect(() => {
    if (!open) return

    userManuallyChangedCategoryRef.current = false
    setSuggestedCategoryInfo(null)

    if (editingRecurringRule) {
      setType((editingRecurringRule.type || 'income') as 'income' | 'expense')
      setDescription(editingRecurringRule.name || '')
      setAmountStr(formatNumberBRL(editingRecurringRule.amount_cents))
      setMemberId(editingRecurringRule.member_id)
      setCategoryId(editingRecurringRule.category_id || 'none')
      setSubcategoryId(editingRecurringRule.subcategory_id || 'none')
      const todayStr = new Date().toISOString().slice(0, 10)
      setTransactionDate(todayStr)
      setInstallmentsCount(1)
      setAmountMode('per_installment')
      setIsRecurring(true)
      setDayOfMonth(editingRecurringRule.day_of_month || 1)
    } else if (editingTransaction) {
      setType(editingTransaction.type)
      setDescription(editingTransaction.description || '')
      setAmountStr(formatNumberBRL(editingTransaction.amount_cents))
      setMemberId(editingTransaction.member_id)
      setCategoryId(editingTransaction.category_id || 'none')
      setSubcategoryId(editingTransaction.subcategory_id || 'none')
      setTransactionDate(editingTransaction.transaction_date)
      setInstallmentsCount(editingTransaction.installment_total || 1)
      setAmountMode('per_installment')
      setIsRecurring(Boolean(editingTransaction.is_recurring))
      const txDay = parseInt(editingTransaction.transaction_date?.slice(8, 10) || '1', 10)
      setDayOfMonth(Number.isNaN(txDay) ? 1 : Math.max(1, Math.min(31, txDay)))
    } else {
      const effectiveType =
        initialType ?? newTransactionPrefill?.initialType ?? newTransactionDefaultType ?? 'expense'
      const effectiveDesc = initialDescription ?? newTransactionPrefill?.initialDescription ?? ''
      const effectiveAmountCents = initialAmountCents ?? newTransactionPrefill?.initialAmountCents

      // Regra de Membro Logado Pré-selecionado:
      // 1) activeMemberId do dispositivo (escolhido no "Quem está usando?" ou auto-selecionado)
      // 2) Membro vinculado ao Supabase Auth user_id
      // 3) Admin da família
      // 4) Primeiro membro
      const userMember = members.find((m) => m.user_id === user?.id)
      const activeMember = members.find((m) => m.id === activeMemberId)
      const effectiveMember =
        initialMemberId ??
        newTransactionPrefill?.initialMemberId ??
        activeMember?.id ??
        userMember?.id ??
        members.find((m) => m.is_admin)?.id ??
        (members.length > 0 ? members[0].id : '')

      const effectiveCategory =
        initialCategoryId ?? newTransactionPrefill?.initialCategoryId ?? 'none'
      const effectiveSubcategory =
        initialSubcategoryId ?? newTransactionPrefill?.initialSubcategoryId ?? 'none'

      const todayStr = new Date().toISOString().slice(0, 10)
      const currentDay = new Date().getDate()

      setType(effectiveType)
      setDescription(effectiveDesc)
      setAmountStr(effectiveAmountCents !== undefined ? formatNumberBRL(effectiveAmountCents) : '')
      setMemberId(effectiveMember)
      setCategoryId(effectiveCategory)
      setSubcategoryId(effectiveSubcategory)
      setTransactionDate(todayStr)
      setInstallmentsCount(1)
      setAmountMode('per_installment')
      setIsRecurring(false)
      setDayOfMonth(currentDay)
    }

    setRememberRule(true)
    setErrorMsg(null)
  }, [
    open,
    editingRecurringRule,
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
    activeMemberId,
    user,
  ])

  // Subcategorias disponíveis para a categoria selecionada
  const selectedCategoryObj = categories.find((c) => c.id === categoryId)
  const availableSubcategories = selectedCategoryObj?.subcategories || []

  // Ao alterar o toggle Despesa / Receita
  const handleTypeChange = (newType: 'income' | 'expense') => {
    if (newType === type) return
    setType(newType)
    // Se a categoria selecionada atualmente for incompatível com o novo tipo, reseta
    if (selectedCategoryObj && selectedCategoryObj.type !== newType) {
      setCategoryId('none')
      setSubcategoryId('none')
      setSuggestedCategoryInfo(null)
      userManuallyChangedCategoryRef.current = false
    }
    // Parcelamento é exclusivo para despesas
    if (newType === 'income') {
      setInstallmentsCount(1)
    }
  }

  // Ao alterar a categoria pai manualmente
  const handleCategoryChange = (newCatId: string) => {
    userManuallyChangedCategoryRef.current = true
    setCategoryId(newCatId)
    setSubcategoryId('none')
    setSuggestedCategoryInfo(null)
  }

  // Sugestão automática de categoria baseada nas regras do banco e regras padrão
  useEffect(() => {
    if (editingTransaction || editingRecurringRule) return
    if (userManuallyChangedCategoryRef.current) return
    if (!description || description.trim().length < 3) return

    const match = matchCategorization(description.trim(), type, categories, dbRules)
    if (match && match.category) {
      setCategoryId(match.category.id)
      if (match.subcategory) {
        setSubcategoryId(match.subcategory.id)
        setSuggestedCategoryInfo(`Sugerido: ${match.category.name} (${match.subcategory.name})`)
      } else {
        setSubcategoryId('none')
        setSuggestedCategoryInfo(`Sugerido: ${match.category.name}`)
      }
    }
  }, [description, type, categories, dbRules, editingTransaction, editingRecurringRule])

  // Mantém sincronizado o dia do mês com a data escolhida quando o usuário altera a data
  const handleDateChange = (newDate: string) => {
    setTransactionDate(newDate)
    if (newDate) {
      const parsedDay = parseInt(newDate.slice(8, 10), 10)
      if (!Number.isNaN(parsedDay)) {
        setDayOfMonth(Math.max(1, Math.min(31, parsedDay)))
      }
    }
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

      if (editingRecurringRule) {
        // ==========================================
        // FLUXO DE EDIÇÃO DE REGRA RECORRENTE EXISTENTE
        // ==========================================
        await updateRecurringIncome(editingRecurringRule.id, {
          member_id: memberId,
          category_id: categoryId === 'none' ? null : categoryId,
          subcategory_id: subcategoryId === 'none' || categoryId === 'none' ? null : subcategoryId,
          name: description.trim(),
          type,
          amount_cents: cents,
          day_of_month: dayOfMonth,
        })

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
            }
          } catch (ruleErr) {
            console.warn('Não foi possível salvar regra de categorização:', ruleErr)
          }
        }

        toast({
          title: 'Regra recorrente atualizada! 🔁',
          description: `A regra "${description.trim()}" foi salva com sucesso.`,
        })
      } else if (editingTransaction) {
        // Se a transação estiver vinculada a uma regra fixa recorrente, atualiza a regra fixa também se desejado
        if (editingTransaction.recurring_income_id && isRecurring) {
          try {
            await updateRecurringIncome(editingTransaction.recurring_income_id, {
              member_id: memberId,
              category_id: categoryId === 'none' ? null : categoryId,
              subcategory_id:
                subcategoryId === 'none' || categoryId === 'none' ? null : subcategoryId,
              name: description.trim(),
              type,
              amount_cents: cents,
              day_of_month: dayOfMonth,
            })
          } catch (recErr) {
            console.warn('Erro ao atualizar regra recorrente da transação:', recErr)
          }
        }

        await updateTransaction(editingTransaction.id, {
          member_id: memberId,
          category_id: categoryId === 'none' ? null : categoryId,
          subcategory_id: subcategoryId === 'none' || categoryId === 'none' ? null : subcategoryId,
          type,
          amount_cents: cents,
          description: description.trim(),
          transaction_date: transactionDate,
        })

        // Aprendizado contínuo: memoriza padrão se usuário marcou checkbox
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
            }
          } catch (ruleErr) {
            console.warn('Não foi possível salvar regra de categorização:', ruleErr)
          }
        }

        toast({ title: 'Sucesso', description: 'Transação atualizada com sucesso.' })
      } else if (isRecurring) {
        // ==========================================
        // FLUXO DE RECORRÊNCIA: "Repetir todo mês"
        // ==========================================
        // Cria a regra recorrente usando o mesmo modelo de Contas & Rendas Fixas (tabela recurring_incomes)
        const recurringRule = await createRecurringIncome({
          family_id: family.id,
          member_id: memberId,
          category_id: categoryId === 'none' ? null : categoryId,
          subcategory_id: subcategoryId === 'none' || categoryId === 'none' ? null : subcategoryId,
          name: description.trim(),
          type,
          amount_cents: cents,
          day_of_month: dayOfMonth,
        })

        // Cria também a transação correspondente para o mês corrente vinculada à regra
        const monthDateStr = transactionDate.slice(0, 7) + '-01'
        const todayDay = new Date().getDate()
        const isPastOrToday = todayDay >= dayOfMonth
        const initialStatus: 'confirmed' | 'projected' = isPastOrToday ? 'confirmed' : 'projected'

        try {
          await createTransaction({
            family_id: family.id,
            member_id: memberId,
            category_id: categoryId === 'none' ? null : categoryId,
            subcategory_id:
              subcategoryId === 'none' || categoryId === 'none' ? null : subcategoryId,
            type,
            amount_cents: cents,
            description: description.trim(),
            transaction_date: transactionDate,
            recurring_income_id: recurringRule?.id || null,
            is_recurring: true,
            recurring_month: monthDateStr,
            status: initialStatus,
          })
        } catch (txErr: any) {
          // Se duplicar idempotente no banco não quebra o fluxo
          console.warn('Lançamento inicial da recorrência gerou aviso:', txErr)
        }

        // Memoriza regra de categorização
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
            }
          } catch (ruleErr) {
            console.warn('Não foi possível salvar regra de categorização:', ruleErr)
          }
        }

        toast({
          title: type === 'income' ? 'Receita fixa cadastrada! 🎉' : 'Despesa fixa cadastrada! 🔄',
          description: `Será repetida todo mês no dia ${dayOfMonth} com previsão automática no orçamento.`,
        })
      } else if (type === 'expense' && installmentsCount > 1) {
        // Compra parcelada avulsa
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
        // Lançamento manual avulso
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

  // Atalho para Lançamento por voz com IA
  const handleTriggerVoice = () => {
    onOpenChange(false)
    if (onOpenVoice) {
      onOpenVoice()
    }
  }

  // Conteúdo do formulário unificado (reutilizado tanto no Dialog desktop quanto no Bottom Sheet mobile)
  const renderFormBody = () => (
    <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
      {errorMsg ? (
        <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl">
          <span>{errorMsg}</span>
        </div>
      ) : null}

      {/* ========================================================
          1. TOGGLE SEGMENTADO DESPESA / RECEITA NO TOPO
          ======================================================== */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl">
        <button
          type="button"
          onClick={() => handleTypeChange('expense')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            type === 'expense'
              ? 'bg-red-500 text-white shadow-sm shadow-red-500/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
          <span>Despesa</span>
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange('income')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            type === 'income'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
          <span>Receita</span>
        </button>
      </div>

      {/* ========================================================
          2. VALOR (BRL)
          ======================================================== */}
      <div>
        <Label htmlFor="tx-amount" className="text-xs font-semibold text-slate-700">
          Valor (R$)
        </Label>
        <div className="relative mt-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
            R$
          </span>
          <Input
            id="tx-amount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="pl-11 text-xl font-extrabold tabular-nums rounded-xl h-12"
            autoFocus={!isMobile}
          />
        </div>
      </div>

      {/* ========================================================
          3. DESCRIÇÃO
          ======================================================== */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label htmlFor="tx-desc" className="text-xs font-semibold text-slate-700">
            Descrição
          </Label>
          {suggestedCategoryInfo && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 animate-in fade-in">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>{suggestedCategoryInfo}</span>
            </span>
          )}
        </div>
        <Input
          id="tx-desc"
          type="text"
          placeholder={
            type === 'expense'
              ? 'Ex.: Supermercado, Aluguel, Farmácia'
              : 'Ex.: Salário, Pró-labore, Freelance'
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-xl"
        />
      </div>

      {/* ========================================================
          4. MEMBRO DA FAMÍLIA (PRÉ-SELECIONADO COM O LOGADO) & CATEGORIA
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Membro responsável */}
        <div>
          <Label className="text-xs font-semibold text-slate-700">Membro da Família</Label>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger className="mt-1 rounded-xl">
              <SelectValue placeholder="Selecione o membro" />
            </SelectTrigger>
            <SelectContent className="max-w-[calc(100vw-2rem)]">
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span>
                    {m.name}
                    {m.id === activeMemberId ? ' (Você)' : m.is_admin ? ' (Admin)' : ''}
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
            <SelectTrigger className="mt-1 rounded-xl">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="max-w-[calc(100vw-2rem)]">
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
        <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/80">
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
            <SelectTrigger className="bg-white rounded-xl">
              <SelectValue placeholder="Nenhuma (categoria geral)" />
            </SelectTrigger>
            <SelectContent className="max-w-[calc(100vw-2rem)]">
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

      {/* ========================================================
          5. DATA DA TRANSAÇÃO
          ======================================================== */}
      <div>
        <Label htmlFor="tx-date" className="text-xs font-semibold text-slate-700">
          Data da Transação
        </Label>
        <Input
          id="tx-date"
          type="date"
          value={transactionDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="mt-1 rounded-xl"
        />
      </div>

      {/* ========================================================
          6. NOVO TOGGLE: "Repetir todo mês" COM SELETOR DE DIA
          ======================================================== */}
      {editingRecurringRule ? (
        <div className="bg-gradient-to-br from-emerald-50/60 to-teal-50/40 p-3.5 rounded-2xl border border-emerald-200/80 space-y-3">
          <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-emerald-200/70">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-xs font-semibold text-slate-800">Dia do mês</span>
            </div>

            <div className="w-36">
              <Select
                value={String(dayOfMonth)}
                onValueChange={(val) => setDayOfMonth(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 text-xs font-bold rounded-lg bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Dia" />
                </SelectTrigger>
                <SelectContent className="max-h-60 max-w-[calc(100vw-2rem)]">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      <span>Dia {d} de cada mês</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-[11px] text-emerald-900/80 leading-relaxed bg-emerald-100/40 p-2 rounded-xl border border-emerald-200/50">
            🔁 <strong>Regra Recorrente:</strong> Esta{' '}
            {type === 'income' ? 'receita fixa' : 'despesa fixa'} é gerada automaticamente no dia{' '}
            {dayOfMonth} de cada mês e alimenta a projeção orçamentária.
          </p>
        </div>
      ) : !editingTransaction ? (
        <div className="bg-gradient-to-br from-emerald-50/60 to-teal-50/40 p-3.5 rounded-2xl border border-emerald-200/80 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <Repeat className="w-4 h-4 stroke-[2.4]" />
              </div>
              <div>
                <Label
                  htmlFor="tx-repeat-switch"
                  className="text-xs font-bold text-slate-900 cursor-pointer block"
                >
                  Repetir todo mês
                </Label>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Cria regra recorrente de {type === 'income' ? 'receita fixa' : 'despesa fixa'} no
                  orçamento da família.
                </p>
              </div>
            </div>

            <Switch
              id="tx-repeat-switch"
              checked={isRecurring}
              onCheckedChange={(checked) => {
                setIsRecurring(checked)
                if (checked) {
                  setInstallmentsCount(1)
                }
              }}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>

          {/* Seção expandida quando "Repetir todo mês" ativado */}
          {isRecurring && (
            <div className="pt-2 border-t border-emerald-200/60 space-y-2.5 animate-in fade-in-50">
              <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-emerald-200/70">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="text-xs font-semibold text-slate-800">Dia do mês</span>
                </div>

                <div className="w-36">
                  <Select
                    value={String(dayOfMonth)}
                    onValueChange={(val) => setDayOfMonth(parseInt(val, 10))}
                  >
                    <SelectTrigger className="h-8 text-xs font-bold rounded-lg bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Dia" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 max-w-[calc(100vw-2rem)]">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          <span>Dia {d} de cada mês</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-[11px] text-emerald-900/80 leading-relaxed bg-emerald-100/40 p-2 rounded-xl border border-emerald-200/50">
                🔄 <strong>Lançamento Automático:</strong> Esta{' '}
                {type === 'income' ? 'renda' : 'despesa'} será integrada às{' '}
                <strong>Contas & Rendas Recorrentes</strong> e lançada no extrato de cada mês no dia{' '}
                {dayOfMonth}.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* ========================================================
          7. SEÇÃO DE PARCELAMENTO (APENAS PARA DESPESAS AVULSAS NÃO RECORRENTES)
          ======================================================== */}
      {!editingRecurringRule && !editingTransaction && type === 'expense' && !isRecurring && (
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
                <strong>{installmentsCount - 1} parcelas</strong> serão criadas automaticamente como{' '}
                <em>projetadas</em> nos próximos meses.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          8. APRENDIZADO CONTÍNUO (LEMBRAR PARA TRANSAÇÕES FUTURAS)
          ======================================================== */}
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
                <span>Lembrar categoria para nomes semelhantes</span>
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Auto-categorizar lançamentos futuros semelhantes a &quot;
                {extractPatternFromDescription(description) || description || '...'}&quot;.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* ========================================================
          BOTÕES DE AÇÃO DO RODAPÉ
          ======================================================== */}
      <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onOpenChange(false)
            if (setVoiceTransactionData) setVoiceTransactionData(null)
          }}
          disabled={loading}
          className="w-full sm:w-auto rounded-xl"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-700/20"
        >
          <span className="flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>
              {editingRecurringRule
                ? 'Salvar Regra'
                : editingTransaction
                  ? 'Salvar Alterações'
                  : 'Confirmar Lançamento'}
            </span>
          </span>
        </Button>
      </div>
    </form>
  )

  // Em mobile (< sm / 768px), abre como BOTTOM SHEET elegante com largura total e margens adaptadas ao viewport
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t border-slate-200/90 bg-white p-5 pb-8 max-h-[92vh] overflow-y-auto overflow-x-hidden min-w-0"
        >
          {/* Barra superior suave de arraste */}
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 -mt-1" />

          <SheetHeader className="text-left space-y-1 mb-3">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-lg font-bold text-slate-900 tracking-tight">
                {editingRecurringRule
                  ? 'Editar Regra Recorrente'
                  : editingTransaction
                    ? 'Editar Transação'
                    : 'Nova Transação'}
              </SheetTitle>

              {/* Botão de Atalho para Falar com IA */}
              {!editingRecurringRule && !editingTransaction && onOpenVoice ? (
                <button
                  type="button"
                  onClick={handleTriggerVoice}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/80 px-2.5 py-1.5 rounded-xl border border-emerald-300/80 transition-colors shrink-0"
                  title="Falar Lançamento com IA"
                >
                  <Mic className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Falar com IA</span>
                </button>
              ) : null}
            </div>
            <SheetDescription className="text-xs text-slate-500">
              {editingRecurringRule
                ? 'Atualize os dados da regra recorrente mensal.'
                : editingTransaction
                  ? 'Atualize os dados ou valores da transação registrada.'
                  : 'Registre uma despesa ou receita rápida no orçamento familiar.'}
            </SheetDescription>
          </SheetHeader>

          {renderFormBody()}
        </SheetContent>
      </Sheet>
    )
  }

  // Em desktop (>= sm), abre como DIALOG centralizado padrão shadcn
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] rounded-3xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto overflow-x-hidden min-w-0">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {editingRecurringRule
                  ? 'Editar Regra Recorrente'
                  : editingTransaction
                    ? 'Editar Transação'
                    : 'Nova Transação'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {editingRecurringRule
                  ? 'Atualize os dados da regra recorrente mensal.'
                  : editingTransaction
                    ? 'Atualize os dados ou valores da transação registrada.'
                    : 'Registre uma despesa ou receita rápida no orçamento familiar.'}
              </DialogDescription>
            </div>

            {/* Atalho de Falar com IA no desktop */}
            {!editingRecurringRule && !editingTransaction && onOpenVoice ? (
              <button
                type="button"
                onClick={handleTriggerVoice}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/80 px-2.5 py-1.5 rounded-xl border border-emerald-300/80 transition-colors shrink-0"
                title="Falar Lançamento com IA"
              >
                <Mic className="w-3.5 h-3.5 text-emerald-700" />
                <span>Falar com IA</span>
              </button>
            ) : null}
          </div>
        </DialogHeader>

        {renderFormBody()}
      </DialogContent>
    </Dialog>
  )
}
