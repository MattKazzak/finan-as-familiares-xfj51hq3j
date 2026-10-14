import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { ContextualSubcategorySelector } from '@/components/categories/ContextualSubcategorySelector'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import type { CategorizationRule, Transaction, RecurringIncome } from '@/types/finance'
import {
  Loader2,
  Repeat,
  Layers,
  Minus,
  Plus,
  Sparkles,
  Calendar,
  Check,
  ExternalLink,
  ChevronDown,
  ArrowDownRight,
  ArrowUpRight,
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
  onOpenVoice: _onOpenVoice,
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
    openRecurringIncomes,
  } = useFamily()
  const { user } = useAuth()
  const { toast } = useToast()

  // Regras de categorização do banco para sugestão/auto-categorização
  const [dbRules, setDbRules] = useState<CategorizationRule[]>([])

  const [type, setType] = useState<'income' | 'expense'>(
    initialType || newTransactionPrefill?.initialType || newTransactionDefaultType || 'income',
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
  const [paymentMethod, setPaymentMethod] = useState<
    'pix' | 'credit' | 'debit' | 'cash' | 'voucher' | 'other'
  >('other')
  const [transactionDate, setTransactionDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [rememberRule, setRememberRule] = useState<boolean>(true)

  // Controle de expansão do seletor de membros e categorias
  const [isMemberExpanded, setIsMemberExpanded] = useState(false)
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false)

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
    setIsMemberExpanded(false)
    setIsCategoryExpanded(false)

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
      setPaymentMethod((editingTransaction.payment_method as any) || 'other')
      setIsRecurring(Boolean(editingTransaction.is_recurring))
      const txDay = parseInt(editingTransaction.transaction_date?.slice(8, 10) || '1', 10)
      setDayOfMonth(Number.isNaN(txDay) ? 1 : Math.max(1, Math.min(31, txDay)))
    } else {
      const effectiveType =
        initialType ?? newTransactionPrefill?.initialType ?? newTransactionDefaultType ?? 'income'
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
      setPaymentMethod('other')
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
  const handleCategorySelect = (newCatId: string) => {
    userManuallyChangedCategoryRef.current = true
    setCategoryId(newCatId)
    setSubcategoryId('none')
    setSuggestedCategoryInfo(null)
    setIsCategoryExpanded(false)
  }

  // Ao selecionar um membro manualmente
  const handleMemberSelect = (selectedId: string) => {
    setMemberId(selectedId)
    setIsMemberExpanded(false)
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

  // Membro atualmente selecionado
  const selectedMemberObj = members.find((m) => m.id === memberId)
  const isSelectedMemberYou = selectedMemberObj?.id === activeMemberId

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
          payment_method: paymentMethod,
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
            payment_method: paymentMethod,
            recurring_income_id: recurringRule?.id || null,
            is_recurring: true,
            recurring_month: monthDateStr,
            status: initialStatus,
          })
        } catch (txErr: any) {
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

        const payloadsWithMethod = installmentPayloads.map((p) => ({
          ...p,
          payment_method: paymentMethod,
        }))

        await createTransactionsBatch(payloadsWithMethod)

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
          payment_method: paymentMethod,
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

  // Abre o diálogo global de contas fixas recorrentes
  const handleOpenRecurringManager = () => {
    onOpenChange(false)
    if (openRecurringIncomes) {
      openRecurringIncomes()
    }
  }

  // Conteúdo do formulário unificado (estilo Nubank / Copilot Money)
  const renderFormBody = () => (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 min-w-0">
      {errorMsg ? (
        <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
        </div>
      ) : null}

      {/* ========================================================
          1. CABEÇALHO & SELETOR DE TIPO (Tabs modernas em pílula fluida - PROTAGONISTA NO TOPO)
          ======================================================== */}
      <div
        data-testid="transaction-type-toggle"
        className="relative p-1.5 bg-slate-100 rounded-2xl flex items-center gap-1.5 border border-slate-200/80 shadow-inner"
      >
        <button
          type="button"
          onClick={() => handleTypeChange('income')}
          aria-pressed={type === 'income'}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none ${
            type === 'income'
              ? 'bg-finance-income text-white shadow-md shadow-finance-income/30 scale-[1.01]'
              : 'bg-white/60 text-slate-600 hover:text-slate-900 hover:bg-white'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center ${
              type === 'income' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-finance-income'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span className="tracking-tight">Receita</span>
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange('expense')}
          aria-pressed={type === 'expense'}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none ${
            type === 'expense'
              ? 'bg-finance-expense text-white shadow-md shadow-finance-expense/30 scale-[1.01]'
              : 'bg-white/60 text-slate-600 hover:text-slate-900 hover:bg-white'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center ${
              type === 'expense' ? 'bg-white/20 text-white' : 'bg-rose-100 text-finance-expense'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span className="tracking-tight">Despesa</span>
        </button>
      </div>

      {/* ========================================================
          2. VALOR HERÓI (Tipografia imponente sem caixa cinza pesada)
          ======================================================== */}
      <div className="text-center py-2 sm:py-3 space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
          {type === 'expense' ? 'Quanto você gastou?' : 'Quanto você recebeu?'}
        </span>
        <div className="inline-flex items-baseline justify-center gap-1 max-w-full">
          <span
            className={`text-xl sm:text-2xl font-bold tracking-tight transition-colors ${
              type === 'expense' ? 'text-finance-expense' : 'text-finance-income'
            }`}
          >
            R$
          </span>
          <input
            id="tx-amount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className={`bg-transparent text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 tabular-nums text-center focus:outline-hidden placeholder:text-slate-300 w-full min-w-0 max-w-[280px] sm:max-w-xs transition-colors ${
              amountStr ? (type === 'expense' ? 'text-finance-expense' : 'text-finance-income') : ''
            }`}
            autoFocus={!isMobile}
          />
        </div>
      </div>

      {/* ========================================================
          3. CAMPO DE DESCRIÇÃO (Clean, espaçado e minimalista)
          ======================================================== */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <Label htmlFor="tx-desc" className="text-xs font-semibold text-slate-700">
            Descrição
          </Label>
          {suggestedCategoryInfo && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 animate-in fade-in">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>{suggestedCategoryInfo}</span>
            </span>
          )}
        </div>
        <div className="relative">
          <Input
            id="tx-desc"
            type="text"
            placeholder={
              type === 'expense'
                ? 'Ex: Almoço de domingo, Mercado, Uber...'
                : 'Ex: Salário, Freelance, Rendimentos...'
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-2xl bg-slate-50/70 border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-emerald-500 h-11 text-sm transition-all"
          />
        </div>
      </div>

      {/* ========================================================
          4. SELETOR DE MEMBRO DISCRETO (EXPANSÍVEL)
          - Escondido quando a família tem 1 membro (auto-atribuído em silêncio)
          - Linha discreta quando recolhido com avatar, nome e chevron
          - Revela chips ao expandir; recolhe ao selecionar
          ======================================================== */}
      {members.length > 1 && (
        <div
          data-testid="transaction-member-block"
          className="rounded-2xl border border-[rgba(20,33,61,0.06)] bg-[#F8F9FB]/90 p-2.5 sm:p-3 transition-all space-y-2 shadow-curiango"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs font-medium text-[#64748B] shrink-0">
              {type === 'expense' ? 'Quem pagou:' : 'Quem recebeu:'}
            </span>

            <button
              type="button"
              data-testid="member-summary-trigger"
              onClick={() => setIsMemberExpanded((prev) => !prev)}
              aria-expanded={isMemberExpanded}
              className="inline-flex items-center gap-1.5 min-w-0 max-w-[70%] py-1 px-2.5 rounded-full bg-white border border-[rgba(20,33,61,0.08)] hover:border-slate-300 hover:bg-slate-50 text-xs text-[#14213D] font-medium transition-all cursor-pointer shadow-2xs group"
            >
              <span className="w-4 h-4 rounded-full bg-slate-200 text-[10px] font-bold text-[#14213D] flex items-center justify-center shrink-0">
                {selectedMemberObj?.name?.charAt(0).toUpperCase() || '?'}
              </span>
              <span className="truncate">
                {selectedMemberObj?.name || 'Selecionar'}
                {isSelectedMemberYou ? ' (Você)' : ''}
              </span>
              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#64748B] transition-transform duration-200 shrink-0 ${
                  isMemberExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* Chips expandidos de membros */}
          {isMemberExpanded && (
            <div
              data-testid="member-chips-container"
              className="pt-2 border-t border-[rgba(20,33,61,0.06)] flex flex-wrap gap-1.5 animate-in fade-in-50 duration-150"
            >
              {members.map((m) => {
                const isSelected = memberId === m.id
                const isYou = m.id === activeMemberId
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleMemberSelect(m.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[#14213D] text-white border-[#14213D] shadow-xs scale-[1.01]'
                        : 'bg-white text-[#14213D] border-[rgba(20,33,61,0.1)] hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-[#14213D]'
                      }`}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </span>
                    <span>{m.name}</span>
                    {isYou && (
                      <span
                        className={`text-[10px] font-normal ${
                          isSelected ? 'text-slate-300' : 'text-[#64748B]'
                        }`}
                      >
                        (Você)
                      </span>
                    )}
                    {isSelected && <Check className="w-3 h-3 shrink-0 ml-0.5 text-white" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          5. SELETOR DE CATEGORIA RECOLHIDO E ORGANIZADO
          - Linha discreta inicial coerente com o seletor de membro
          - Mostra ícone + nome selecionado (ou "Selecionar categoria")
          - Destaque sutil com âmbar #FCA311 apenas no detalhe ativo
          - Expande em grade ordenada de 2 colunas no mobile
          - Opção "Sem categoria" dentro do bloco expandido
          ======================================================== */}
      <div
        data-testid="transaction-category-block"
        className="rounded-2xl border border-[rgba(20,33,61,0.06)] bg-[#F8F9FB]/90 p-2.5 sm:p-3 transition-all space-y-2 shadow-curiango"
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-xs font-medium text-[#64748B] shrink-0">Categoria:</span>

          <div className="flex items-center gap-1.5 min-w-0 max-w-[70%]">
            <button
              type="button"
              data-testid="category-summary-trigger"
              onClick={() => setIsCategoryExpanded((prev) => !prev)}
              aria-expanded={isCategoryExpanded}
              className={`inline-flex items-center gap-1.5 min-w-0 py-1 px-2.5 rounded-full bg-white border text-xs font-medium transition-all cursor-pointer shadow-2xs group ${
                selectedCategoryObj
                  ? 'border-[#FCA311]/50 text-[#14213D]'
                  : 'border-[rgba(20,33,61,0.08)] text-[#64748B] hover:text-[#14213D] hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {selectedCategoryObj ? (
                <>
                  <span className="w-4 h-4 rounded-md bg-[#FCA311]/15 text-[#14213D] flex items-center justify-center shrink-0">
                    <CategoryIcon
                      name={selectedCategoryObj.icon}
                      className="w-3 h-3 text-[#14213D]"
                    />
                  </span>
                  <span className="truncate text-[#14213D] font-semibold">
                    {selectedCategoryObj.name}
                  </span>
                </>
              ) : (
                <span className="truncate">
                  {categoryId === 'none' ? 'Sem categoria' : 'Selecionar'}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#64748B] transition-transform duration-200 shrink-0 ${
                  isCategoryExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {categoryId !== 'none' && (
              <button
                type="button"
                onClick={() => {
                  setCategoryId('none')
                  setSubcategoryId('none')
                }}
                className="text-[11px] text-[#64748B] hover:text-rose-600 px-1 cursor-pointer transition-colors shrink-0"
                title="Limpar categoria"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Bloco expandido: grade organizada de categorias */}
        {isCategoryExpanded && (
          <div
            data-testid="category-expanded-grid"
            className="pt-2 border-t border-[rgba(20,33,61,0.06)] space-y-2 animate-in fade-in-50 duration-150"
          >
            {/* Opção "Sem categoria" */}
            <div className="flex items-center justify-between pb-1">
              <button
                type="button"
                onClick={() => handleCategorySelect('none')}
                className={`w-full py-2 px-3 rounded-xl text-xs font-medium border transition-all flex items-center justify-between cursor-pointer ${
                  categoryId === 'none'
                    ? 'bg-slate-100 text-[#14213D] border-[#14213D]/30 font-semibold shadow-2xs'
                    : 'bg-white text-[#64748B] border-[rgba(20,33,61,0.08)] hover:bg-slate-50 hover:text-[#14213D]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-slate-200/80 flex items-center justify-center shrink-0 text-slate-500">
                    <Minus className="w-3 h-3" />
                  </div>
                  <span>Sem categoria</span>
                </div>
                {categoryId === 'none' && <Check className="w-3.5 h-3.5 text-[#14213D]" />}
              </button>
            </div>

            {/* Grade de 2 colunas para mobile e sm (zero overflow horizontal) */}
            <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
              {filteredCategories.map((c) => {
                const isSelected = categoryId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCategorySelect(c.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-2 min-w-0 cursor-pointer text-left ${
                      isSelected
                        ? 'bg-white text-[#14213D] border-[#FCA311] shadow-xs ring-1 ring-[#FCA311]/40'
                        : 'bg-white text-[#14213D] border-[rgba(20,33,61,0.08)] hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#FCA311]/20 text-[#14213D]'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <CategoryIcon
                        name={c.icon}
                        className={`w-3.5 h-3.5 ${isSelected ? 'text-[#14213D]' : 'text-slate-600'}`}
                      />
                    </div>
                    <span className="truncate flex-1 font-medium text-[11px] sm:text-xs">
                      {c.name}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#FCA311] shrink-0" strokeWidth={2.5} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Subcategorias: Seletor Contextual Progressivo com 3-4 sugestões, busca e Ver todas */}
      {categoryId !== 'none' ? (
        <div className="space-y-1.5 pt-0.5 animate-in fade-in-50">
          <div className="flex items-center justify-between px-1">
            <Label className="text-[11px] font-semibold text-slate-600">
              Subcategoria <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            {subcategoryId !== 'none' && (
              <button
                type="button"
                onClick={() => setSubcategoryId('none')}
                className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
          <ContextualSubcategorySelector
            subcategories={availableSubcategories.map((s) => ({
              id: s.id,
              name: s.name,
              category_id: s.category_id,
            }))}
            selectedSubcategoryId={subcategoryId === 'none' ? null : subcategoryId}
            onSelect={(newSubId, newCatId) => {
              if (newCatId && newCatId !== categoryId) {
                setCategoryId(newCatId)
              }
              setSubcategoryId(newSubId || 'none')
            }}
            allCategories={categories}
            currentCategoryId={categoryId}
            placeholder="Selecione ou busque uma subcategoria..."
          />
        </div>
      ) : null}

      {/* ========================================================
          6. DATA DA TRANSAÇÃO & MEIO DE PAGAMENTO
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tx-date" className="text-xs font-semibold text-slate-700 px-1">
            Data
          </Label>
          <Input
            id="tx-date"
            type="date"
            value={transactionDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-2xl bg-slate-50/70 border-slate-200/80 hover:border-slate-300 focus:bg-white h-10 text-xs sm:text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 px-1">Forma de Pagamento</Label>
          <Select value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)}>
            <SelectTrigger className="h-10 text-xs sm:text-sm rounded-2xl bg-slate-50/70 border-slate-200/80">
              <SelectValue placeholder="Forma de pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pix">Pix</SelectItem>
              <SelectItem value="credit">Crédito</SelectItem>
              <SelectItem value="debit">Débito</SelectItem>
              <SelectItem value="cash">Dinheiro</SelectItem>
              <SelectItem value="voucher">Vale</SelectItem>
              <SelectItem value="other">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ========================================================
          7. SEÇÃO DE RECORRÊNCIA (Switch sutil e moderno + link para gerenciar fixos)
          ======================================================== */}
      {editingRecurringRule ? (
        <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/70 space-y-3">
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
        <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/60">
                <Repeat className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <Label
                  htmlFor="tx-repeat-switch"
                  className="text-xs font-bold text-slate-900 cursor-pointer block leading-tight"
                >
                  Repetir todo mês (Fixo)
                </Label>
                <p className="text-[11px] text-slate-500 leading-tight mt-0.5 truncate">
                  Alimenta o planejamento fixo do orçamento
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

          {/* Link discreto para gerenciar contas fixas */}
          <div className="pt-1 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleOpenRecurringManager}
              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold hover:underline cursor-pointer"
            >
              <span>Gerenciar contas fixas 🔁</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Seção expandida quando "Repetir todo mês" ativado */}
          {isRecurring && (
            <div className="pt-2.5 border-t border-slate-200/70 space-y-2 animate-in fade-in-50">
              <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/90">
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
                <strong>Contas & Rendas Recorrentes</strong> e lançada no extrato todo dia{' '}
                {dayOfMonth}.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* ========================================================
          8. SEÇÃO DE PARCELAMENTO (APENAS PARA DESPESAS AVULSAS NÃO RECORRENTES)
          ======================================================== */}
      {!editingRecurringRule && !editingTransaction && type === 'expense' && !isRecurring && (
        <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-600" />
              <Label className="text-xs font-bold text-slate-800">Parcelamento</Label>
            </div>
            {installmentsCount > 1 && (
              <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full">
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
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors font-bold cursor-pointer"
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
                className="w-8 h-8 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 flex items-center justify-center transition-colors font-bold cursor-pointer"
                title="Aumentar parcelas"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {installmentsCount > 1 && (
            <div className="space-y-2 pt-1 border-t border-slate-200/70 animate-in fade-in-50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">O valor digitado acima é:</span>
                <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setAmountMode('per_installment')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
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
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
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
          9. APRENDIZADO CONTÍNUO (Lembrar para transações futuras)
          ======================================================== */}
      {categoryId !== 'none' && (
        <div
          className={`p-3 rounded-2xl border transition-colors ${
            isEditingUncategorized
              ? 'bg-purple-50/70 border-purple-200'
              : 'bg-slate-50/70 border-slate-200/80'
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
          10. BOTÃO DE AÇÃO PRINCIPAL (Cantos suaves rounded-2xl, altura generosa, toque confortável)
          ======================================================== */}
      <div className="pt-2 sm:pt-3 space-y-2">
        <Button
          type="submit"
          disabled={loading}
          className={`w-full h-12 sm:h-13 font-bold rounded-2xl text-base shadow-lg transition-all active:scale-[0.99] cursor-pointer ${
            type === 'expense'
              ? 'bg-finance-expense hover:bg-[#c8143c] text-white shadow-finance-expense/25'
              : 'bg-finance-income hover:bg-[#047857] text-white shadow-finance-income/25'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            <span>
              {editingRecurringRule
                ? 'Salvar Regra Fixa'
                : editingTransaction
                  ? 'Salvar Alterações'
                  : type === 'expense'
                    ? 'Confirmar Despesa'
                    : 'Confirmar Receita'}
            </span>
          </span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onOpenChange(false)
            if (setVoiceTransactionData) setVoiceTransactionData(null)
          }}
          disabled={loading}
          className="w-full text-xs text-slate-500 hover:text-slate-800 h-9 rounded-xl cursor-pointer"
        >
          Cancelar
        </Button>
      </div>
    </form>
  )

  // Em mobile (< sm / 768px), abre como BOTTOM SHEET com rounded-t-3xl e drag handle sutil
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t border-slate-200/90 bg-white p-5 pb-8 max-h-[92vh] overflow-y-auto overflow-x-hidden min-w-0"
        >
          {/* Puxador suave no topo (drag handle) */}
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 -mt-1 shrink-0" />

          <SheetHeader className="text-left space-y-0.5 mb-2">
            <SheetTitle className="text-lg font-bold text-slate-900 tracking-tight">
              {editingRecurringRule
                ? 'Editar Regra Recorrente'
                : editingTransaction
                  ? 'Editar Transação'
                  : 'Nova Transação'}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              {editingRecurringRule
                ? 'Atualize os dados da regra recorrente mensal.'
                : editingTransaction
                  ? 'Atualize os dados ou valores da transação registrada.'
                  : 'Preencha o valor e a categoria do lançamento.'}
            </SheetDescription>
          </SheetHeader>

          {renderFormBody()}
        </SheetContent>
      </Sheet>
    )
  }

  // Em desktop (>= sm), abre como DIALOG centralizado elegante com rounded-3xl
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] rounded-3xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto overflow-x-hidden min-w-0 border-slate-200 shadow-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
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
                : 'Preencha o valor e a categoria do lançamento.'}
          </DialogDescription>
        </DialogHeader>

        {renderFormBody()}
      </DialogContent>
    </Dialog>
  )
}

export default NewTransactionDialog
