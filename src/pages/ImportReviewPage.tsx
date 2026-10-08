import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  FileSpreadsheet,
  Check,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
  Plus,
  Users,
} from 'lucide-react'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import { useImportSession } from '@/contexts/ImportSessionContext'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategoryIcon, AVAILABLE_ICONS } from '@/components/common/CategoryIcon'
import { CATEGORY_COLORS } from '@/components/categories/CategoryEditorPopover'
import { formatBRL } from '@/lib/formatters'
import {
  normalizeText,
  extractPatternFromDescription,
  extractLearningPattern,
} from '@/services/import/categorization'
import { findSimilarReviewItems } from '@/services/import/similar-matcher'
import { isNonTransactionLine } from '@/services/import/pdf-parser'
import {
  generateInstallmentTransactions,
  cleanInstallmentBaseDescription,
} from '@/services/installments'
import { createTransactionsBatch, updateTransaction } from '@/services/transactions'
import { fetchCategorizationRules, upsertCategorizationRule } from '@/services/categorization-rules'
import type { CategorizationRule } from '@/types/finance'
import type { ReviewItem } from '@/components/transactions/ImportStatementDialog'
import type { TransactionType } from '@/types/finance'
import { ImportItemList } from '@/components/import/ImportItemList'
import { ImportItemEditor } from '@/components/import/ImportItemEditor'
import { ImportQuickFilters, type QuickFilterType } from '@/components/import/ImportQuickFilters'
import { ImportConfirmationFooter } from '@/components/import/ImportConfirmationFooter'

export default function ImportPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const { toast } = useToast()
  const { family, members, categories, addNewCategory, triggerRefresh, setLastImportSummary } =
    useFamily()

  const { session, setImportSession, clearImportSession } = useImportSession()

  // Lista de itens em revisão carregados da sessão (filtrando linhas de não-transação)
  const [items, setItems] = useState<ReviewItem[]>(() =>
    (session?.items || []).filter((it) => !isNonTransactionLine(it.description)),
  )
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)

  // Filtros rápidos e ordenação
  const [currentFilter, setCurrentFilter] = useState<QuickFilterType>('all')
  const [sortByConfidence, setSortByConfidence] = useState(false)

  // Salvamento
  const [saving, setSaving] = useState(false)
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [conflictingRules, setConflictingRules] = useState<
    Array<{
      ruleId: string
      pattern: string
      oldCategoryName: string
      newCategoryId: string
      newSubcategoryId: string | null
      newCategoryName: string
    }>
  >([])

  // Modal de Criação Rápida de Nova Categoria inline
  const [isQuickCatOpen, setIsQuickCatOpen] = useState(false)
  const [quickCatTargetItemId, setQuickCatTargetItemId] = useState<string | null>(null)
  const [quickCatName, setQuickCatName] = useState('')
  const [quickCatType, setQuickCatType] = useState<TransactionType>('expense')
  const [quickCatColor, setQuickCatColor] = useState('#3B82F6')
  const [quickCatIcon, setQuickCatIcon] = useState('Tag')
  const [quickCatSaving, setQuickCatSaving] = useState(false)

  // Se a sessão atualizar externamente
  useEffect(() => {
    if (session?.items && session.items.length > 0) {
      const sanitized = session.items.filter((it) => !isNonTransactionLine(it.description))
      setItems(sanitized)
      if (!selectedItemId && sanitized.length > 0) {
        setSelectedItemId(sanitized[0].id)
      }
    }
  }, [session])

  // Mantém primeiro item selecionado no desktop quando lista muda
  useEffect(() => {
    if (!isMobile && items.length > 0 && !selectedItemId) {
      setSelectedItemId(items[0].id)
    }
  }, [isMobile, items, selectedItemId])

  // Atualização em tempo real na sessão para sobreviver a recarregamentos acidentais
  const persistItems = useCallback(
    (newItems: ReviewItem[]) => {
      setItems(newItems)
      if (session) {
        setImportSession({
          ...session,
          items: newItems,
        })
      }
    },
    [session, setImportSession],
  )

  // Seleção de item
  const handleSelectItem = (id: string) => {
    setSelectedItemId(id)
    if (isMobile) {
      setIsMobileSheetOpen(true)
    }
  }

  // Marcar / desmarcar item
  const handleToggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    )
  }

  const handleUpdateUserNote = (id: string, note: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, userNote: note } : item)))
  }
  // Marcar / desmarcar todos os visíveis ou todos
  const handleToggleSelectAll = (checked: boolean) => {
    persistItems(items.map((item) => ({ ...item, selected: checked })))
  }

  // Remover item da revisão
  const handleRemoveItem = (id: string) => {
    const updated = items.filter((item) => item.id !== id)
    persistItems(updated)
    if (selectedItemId === id) {
      const next = updated[0]?.id || null
      setSelectedItemId(next)
      if (isMobile) {
        setIsMobileSheetOpen(false)
      }
    }
  }

  // Atualizar campo de um item
  const handleUpdateItemField = (id: string, field: keyof ReviewItem, value: any) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item
      const copy = { ...item, [field]: value }

      if (field === 'category_id') {
        if (!value) {
          copy.subcategory_id = null
          copy.rememberRule = false
        } else {
          const cat = categories.find((c) => c.id === value)
          const validSub = cat?.subcategories?.some((s) => s.id === item.subcategory_id)
          if (!validSub) {
            copy.subcategory_id = null
          }
          if (copy.rememberRule === undefined) {
            copy.rememberRule = true
          }
          copy.source = 'manual'
        }
      }
      return copy
    })

    persistItems(updated)
  }

  // ITEM 3 DO PLANO: "Aplicar a semelhantes" na mesma revisão
  const handleApplyToSimilar = (
    baseItem: ReviewItem,
    targetCategoryId: string | null,
    targetSubcategoryId: string | null,
  ) => {
    const similar = findSimilarReviewItems(baseItem, items)
    const similarIds = new Set(similar.map((s) => s.id))

    const updated = items.map((item) => {
      if (similarIds.has(item.id)) {
        return {
          ...item,
          category_id: targetCategoryId,
          subcategory_id: targetSubcategoryId,
          rememberRule: true,
          source: 'manual' as const,
        }
      }
      return item
    })

    persistItems(updated)
    toast({
      title: 'Categoria aplicada a semelhantes!',
      description: `Aplicada a ${similar.length} lançamentos semelhantes nesta revisão.`,
    })
  }

  // Abertura do modal de criação rápida de categoria
  const handleOpenQuickCategory = (itemId: string) => {
    setQuickCatTargetItemId(itemId)
    setQuickCatName('')
    setQuickCatType('expense')
    setQuickCatColor('#3B82F6')
    setQuickCatIcon('Tag')
    setIsQuickCatOpen(true)
  }

  const handleCreateQuickCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickCatName.trim()) return

    try {
      setQuickCatSaving(true)
      const created = await addNewCategory(
        quickCatName.trim(),
        quickCatType,
        quickCatColor,
        quickCatIcon,
      )

      if (quickCatTargetItemId) {
        handleUpdateItemField(quickCatTargetItemId, 'category_id', created.id)
      }

      setIsQuickCatOpen(false)
      triggerRefresh()
    } catch {
      toast({
        title: 'Erro ao criar categoria',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setQuickCatSaving(false)
    }
  }

  // Filtros e ordenação
  const filterCounts = useMemo(() => {
    let pendingCategory = 0
    let lowConfidence = 0
    let expenses = 0
    let incomes = 0
    let duplicates = 0

    items.forEach((item) => {
      if (!item.category_id) pendingCategory++
      const isUncertainItem =
        item.isUncertain ||
        !item.category_id ||
        (item.source === 'ai_suggestion' && (item.aiConfidence ?? 1) < 0.6)
      if (item.source === 'ai_suggestion' && isUncertainItem) {
        lowConfidence++
      }
      if (item.type === 'expense') expenses++
      else incomes++
      if (item.isDuplicate) duplicates++
    })

    return {
      total: items.length,
      pendingCategory,
      lowConfidence,
      expenses,
      incomes,
      duplicates,
    }
  }, [items])

  const filteredItems = useMemo(() => {
    let list = items.filter((item) => {
      if (currentFilter === 'pending_category') return !item.category_id
      if (currentFilter === 'low_confidence') {
        return (
          item.isUncertain ||
          !item.category_id ||
          (item.source === 'ai_suggestion' && (item.aiConfidence ?? 1) < 0.6)
        )
      }
      if (currentFilter === 'expenses') return item.type === 'expense'
      if (currentFilter === 'incomes') return item.type === 'income'
      if (currentFilter === 'duplicates') return item.isDuplicate
      return true
    })

    if (sortByConfidence) {
      list = [...list].sort((a, b) => {
        // Sem categoria sempre primeiro
        if (!a.category_id && b.category_id) return -1
        if (a.category_id && !b.category_id) return 1
        // Depois por menor confiança da IA
        const confA = a.aiConfidence ?? (a.category_id ? 1 : 0)
        const confB = b.aiConfidence ?? (b.category_id ? 1 : 0)
        return confA - confB
      })
    }

    return list
  }, [items, currentFilter, sortByConfidence])

  // Contagens do rodapé
  const selectedCount = useMemo(() => items.filter((i) => i.selected).length, [items])

  const { incomeSumCents, expenseSumCents, grossExpenseCents } = useMemo(() => {
    let inc = 0
    let exp = 0
    let gross = 0
    items
      .filter((i) => i.selected)
      .forEach((i) => {
        if (i.type === 'income') {
          // Desconsidera pagamentos de fatura / limites do cálculo líquido de entradas
          if (!i.isNonExpense) inc += i.amount_cents
        } else {
          gross += i.amount_cents
          // Desconsidera itens isNonExpense do total líquido de despesas exibido
          if (!i.isNonExpense) exp += i.amount_cents
        }
      })
    return { incomeSumCents: inc, expenseSumCents: exp, grossExpenseCents: gross }
  }, [items])

  // O item ativo selecionado para edição
  const activeSelectedItem = useMemo(() => {
    return items.find((i) => i.id === selectedItemId) || items[0] || null
  }, [items, selectedItemId])

  // CONFIRMAÇÃO FINAL: Gravação no banco e volta para onde o usuário estava
  const handleConfirmImport = async () => {
    if (!family) return
    const selectedItems = items.filter((i) => i.selected)

    if (selectedItems.length === 0) {
      toast({
        title: 'Nenhum lançamento selecionado',
        description: 'Marque ao menos um lançamento para importar.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)

      const toUpdateProjections: Array<{ id: string; payload: any }> = []
      const toUpdateManualMerges: Array<{ id: string; payload: any }> = []
      const toCreatePayloads: Array<any> = []

      for (const item of selectedItems) {
        // Caso A: Mescla com lançamento manual existente
        if (item.isReconciledManual && item.matchedManualTransaction) {
          toUpdateManualMerges.push({
            id: item.matchedManualTransaction.id,
            payload: {
              bank_transaction_id: item.fitid || `merged-${item.matchedManualTransaction.id}`,
              transaction_date: item.date,
              category_id:
                item.category_id || item.matchedManualTransaction.category_id || undefined,
              subcategory_id:
                item.subcategory_id !== undefined
                  ? item.subcategory_id
                  : item.matchedManualTransaction.subcategory_id,
              member_id: item.member_id || item.matchedManualTransaction.member_id || undefined,
            },
          })
          continue
        }

        // Caso B: Converte projeção futura em confirmada
        if (item.matchedProjectId) {
          toUpdateProjections.push({
            id: item.matchedProjectId,
            payload: {
              status: 'confirmed',
              amount_cents: item.amount_cents,
              description: item.description.trim(),
              transaction_date: item.date,
              category_id: item.category_id || undefined,
              subcategory_id: item.subcategory_id || null,
              member_id: item.member_id || undefined,
              bank_transaction_id: item.fitid || undefined,
            },
          })
          continue
        }

        // Instrumentação ai_confidence para auditoria silente (T3):
        // Convenção: regra determinística do banco ou dicionário / fallback_rule / name_match = 1.0;
        // Sugestão de IA = confidence retornado pelo modelo (0.01 - 0.99);
        // Lançamento manual ou usuário que alterou manualmente para categoria sem IA = NULL.
        let resolvedAiConfidence: number | null = null
        if (
          item.source === 'database_rule' ||
          item.source === 'fallback_rule' ||
          item.source === 'name_match'
        ) {
          resolvedAiConfidence = 1.0
        } else if (item.source === 'ai_suggestion' && typeof item.aiConfidence === 'number') {
          resolvedAiConfidence = Number(item.aiConfidence.toFixed(2))
        }

        // Caso C: Parcela com projeções futuras automáticas
        if (
          item.isInstallment &&
          item.generateFutureInstallments &&
          (item.installmentTotal || 1) > 1
        ) {
          const totalInst = item.installmentTotal || 1
          const startNum = item.installmentCurrent || 1
          const instGroup = item.matchedGroupId || crypto.randomUUID()

          const gen = generateInstallmentTransactions({
            familyId: family.id,
            memberId: item.member_id || members[0]?.id,
            categoryId: item.category_id,
            subcategoryId: item.subcategory_id || null,
            baseDescription: item.description.trim() || 'Despesa parcelada',
            amountCents: item.amount_cents,
            baseDate: item.date,
            startInstallmentNumber: startNum,
            totalInstallments: totalInst,
            groupId: instGroup,
            aiConfidence: resolvedAiConfidence,
          })

          toCreatePayloads.push(...gen.transactions)
        } else if (item.isInstallment) {
          const curNum = item.installmentCurrent || 1
          const totNum = item.installmentTotal || 1
          const baseName = cleanInstallmentBaseDescription(item.description.trim()) || 'Despesa'
          const singleDesc = `${baseName} - Parcela ${curNum}/${totNum}`

          toCreatePayloads.push({
            family_id: family.id,
            member_id: item.member_id || members[0]?.id,
            category_id: item.category_id,
            subcategory_id: item.subcategory_id || null,
            type: item.type,
            amount_cents: item.amount_cents,
            description: singleDesc,
            transaction_date: item.date,
            payment_method: 'other',
            ai_confidence: resolvedAiConfidence,
            is_installment: true,
            installment_number: curNum,
            installment_total: totNum,
            installment_group_id: item.matchedGroupId || crypto.randomUUID(),
            status: 'confirmed',
            bank_transaction_id: item.fitid || null,
          })
        } else {
          // Transação comum
          toCreatePayloads.push({
            family_id: family.id,
            member_id: item.member_id || members[0]?.id,
            category_id: item.category_id,
            subcategory_id: item.subcategory_id || null,
            type: item.type,
            amount_cents: item.amount_cents,
            description: item.description.trim() || 'Transação importada',
            transaction_date: item.date,
            payment_method: 'other',
            ai_confidence: resolvedAiConfidence,
            is_installment: false,
            status: 'confirmed',
            bank_transaction_id: item.fitid || null,
          })
        }
      }

      await Promise.all([
        ...toUpdateManualMerges.map((up) => updateTransaction(up.id, up.payload)),
        ...toUpdateProjections.map((up) => updateTransaction(up.id, up.payload)),
        createTransactionsBatch(toCreatePayloads),
      ])

      // Loop de Aprendizado (Parte 5):
      // Salva regra na tabela categorization_rules quando a categoria escolhida pelo usuário
      // diferir da sugestão da IA, ou o item estava needsReview/sem categoria, ou marcado rememberRule.
      // Termo normalizado: até 3 palavras significativas limpas, lowercase, sem acentos.
      // Não sobrescreve regras existentes do usuário silenciosamente se já existir regra para aquele pattern.
      let existingDbRules: CategorizationRule[] = []
      try {
        existingDbRules = await fetchCategorizationRules(family.id)
      } catch {
        existingDbRules = []
      }

      const existingPatternsSet = new Set(
        existingDbRules.map((r) =>
          (r.pattern || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim(),
        ),
      )

      const learningCandidates = selectedItems.filter((i) => {
        if (!i.category_id || !i.description || !i.description.trim()) return false
        const userChangedCategory =
          i.source === 'ai_suggestion' && (i.isUncertain || !i.aiConfidence || i.rememberRule)
        return i.rememberRule || userChangedCategory
      })

      const pendingConflicts: Array<{
        ruleId: string
        pattern: string
        oldCategoryName: string
        newCategoryId: string
        newSubcategoryId: string | null
        newCategoryName: string
      }> = []

      for (const item of learningCandidates) {
        try {
          const patternToSave = extractLearningPattern(item.description)

          if (patternToSave && patternToSave.length >= 2) {
            const patLower = patternToSave.toLowerCase()
            const existingRule = existingDbRules.find(
              (r) =>
                (r.pattern || '')
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase()
                  .trim() === patLower,
            )

            if (!existingRule) {
              await upsertCategorizationRule({
                family_id: family.id,
                user_id: null,
                pattern: patternToSave,
                category_id: item.category_id!,
                subcategory_id: item.subcategory_id || null,
              })
              existingPatternsSet.add(patLower)
            } else if (existingRule.category_id !== item.category_id) {
              // Conflito de regra existente com categoria diferente
              if (!pendingConflicts.some((c) => c.ruleId === existingRule.id)) {
                const oldCat = categories.find((c) => c.id === existingRule.category_id)
                const newCat = categories.find((c) => c.id === item.category_id)
                pendingConflicts.push({
                  ruleId: existingRule.id,
                  pattern: existingRule.pattern,
                  oldCategoryName: oldCat?.name || 'Antiga',
                  newCategoryId: item.category_id!,
                  newSubcategoryId: item.subcategory_id || null,
                  newCategoryName: newCat?.name || 'Nova',
                })
              }
            }
          }
        } catch (ruleErr) {
          console.warn('Não foi possível salvar regra de aprendizado ao importar:', ruleErr)
        }

        // Salvar regras aprendidas via micro-respostas "Contar o que foi" (T6)
        try {
          for (const item of selectedItems) {
            if (item.userNote && item.category_id) {
              const rawPattern = extractPatternFromDescription(item.description) || item.description
              await upsertCategorizationRule({
                family_id: family.id,
                pattern: rawPattern.toUpperCase().trim(),
                category_id: item.category_id,
                subcategory_id: item.subcategory_id || null,
              })
            }
          }
        } catch (noteRuleErr) {
          console.warn('Erro ao salvar regra originada de nota rápida:', noteRuleErr)
        }
      }

      if (pendingConflicts.length > 0) {
        setConflictingRules(pendingConflicts)
        setConflictModalOpen(true)
        return
      }

      finishImportSuccess(selectedItems.length)
    } catch (err: any) {
      console.error('Erro ao salvar lançamentos importados:', err)
      toast({
        title: 'Falha ao salvar lançamentos',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const finishImportSuccess = (totalSaved: number) => {
    const pendingCount = items.filter((i) => i.selected && !i.category_id).length
    const categorizedCount = totalSaved - pendingCount

    setLastImportSummary({
      total: totalSaved,
      categorized: categorizedCount,
      pending: pendingCount,
      importedAt: new Date(),
    })

    clearImportSession()
    triggerRefresh()

    toast({
      title: 'Extrato importado com sucesso! 🎉',
      description: `${totalSaved} lançamentos gravados no extrato sem duplicações.`,
    })

    const targetRoute = session?.sourceRoute || '/carteira'
    navigate(targetRoute, { replace: true })
  }

  const handleApplyConflictUpdates = async () => {
    try {
      setSaving(true)
      for (const conf of conflictingRules) {
        await upsertCategorizationRule({
          family_id: family!.id,
          user_id: null,
          pattern: conf.pattern,
          category_id: conf.newCategoryId,
          subcategory_id: conf.newSubcategoryId,
        })
      }
      toast({
        title: 'Regras atualizadas!',
        description: `${conflictingRules.length} regra(s) de categorização atualizada(s).`,
      })
    } catch (err) {
      console.error('Erro ao atualizar regras:', err)
    } finally {
      setConflictModalOpen(false)
      setSaving(false)
      finishImportSuccess(selectedCount)
    }
  }

  const handleKeepOldRules = () => {
    setConflictModalOpen(false)
    finishImportSuccess(selectedCount)
  }

  // Cancelar e voltar
  const handleCancelAndLeave = () => {
    clearImportSession()
    navigate(session?.sourceRoute || '/carteira')
  }

  // Se não há itens na revisão, mostra estado vazio amigável com botão de retorno
  if (!items || items.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-3xl mx-auto">
          📥
        </div>
        <h2 className="text-xl font-bold text-slate-900">Nenhuma revisão pendente</h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Para importar uma fatura em PDF ou extrato OFX, abra a Carteira e toque em "Importar
          Extrato".
        </p>
        <div className="pt-2">
          <Button
            onClick={() => navigate('/carteira')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold px-5"
          >
            Ir para Carteira & Extrato
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-[calc(100vh-8rem)] pb-28 sm:pb-24">
      {/* HEADER DA TELA DE REVISÃO DEDICADA */}
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md pt-1 pb-3 mb-3 border-b border-slate-200/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelAndLeave}
              className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
              title="Voltar e descartar revisão"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  Revisão de Importação
                </h1>
                {session?.fileInfo && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md truncate max-w-[180px] sm:max-w-[260px]">
                    <FileSpreadsheet className="w-3 h-3 text-emerald-700 shrink-0" />
                    <span className="truncate">{session.fileInfo.name}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                {items.length} lançamentos extraídos • Ajuste categorias e confirme
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancelAndLeave}
              className="text-xs h-8 rounded-xl text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </Button>
          </div>
        </div>

        {/* BARRA DE FILTROS RÁPIDOS NO TOPO (ITEM 4 DO PLANO) */}
        <div className="mt-3">
          <ImportQuickFilters
            currentFilter={currentFilter}
            onSelectFilter={setCurrentFilter}
            sortByConfidence={sortByConfidence}
            onToggleSortByConfidence={() => setSortByConfidence((prev) => !prev)}
            counts={filterCounts}
          />
        </div>
      </div>

      {/* AVISOS DE PÁGINAS FALHADAS (SE HOUVER) */}
      {session?.failedPages && session.failedPages.length > 0 && (
        <div className="mb-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="font-bold">
              Não foi possível ler completamente a página {session.failedPages.join(', ')} da
              fatura.
            </span>
            <span className="block text-[11px] text-amber-900/80 mt-0.5">
              Verifique se os lançamentos das outras páginas conferem abaixo.
            </span>
          </div>
        </div>
      )}

      {/* ÁREA PRINCIPAL: DESKTOP EM 2 COLUNAS / MOBILE EM LISTA (ITEM 2 DO PLANO) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* COLUNA ESQUERDA: LISTA DE LANÇAMENTOS (MD:COL-SPAN-7 / LG:COL-SPAN-7) */}
        <div className="md:col-span-7 space-y-2 min-w-0">
          <div className="flex items-center justify-between pb-1 text-xs text-slate-500">
            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCount === items.length && items.length > 0}
                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span>
                Selecionar todos ({selectedCount}/{items.length})
              </span>
            </label>

            <span className="text-[11px] text-slate-500">
              Exibindo {filteredItems.length} de {items.length}
            </span>
          </div>
          <ImportItemList
            items={filteredItems}
            selectedItemId={selectedItemId}
            categories={categories}
            members={members}
            onSelectItem={(id) => setSelectedItemId(id)}
            onToggleItem={handleToggleItem}
            onUpdateUserNote={handleUpdateUserNote}
          />{' '}
        </div>

        {/* COLUNA DIREITA DESKTOP: PAINEL DE EDIÇÃO FIXO / STICKY (MD:COL-SPAN-5) */}
        <div className="hidden md:block md:col-span-5 sticky top-28 min-w-0 max-h-[calc(100vh-10rem)]">
          {activeSelectedItem ? (
            <ImportItemEditor
              item={activeSelectedItem}
              allItems={items}
              categories={categories}
              members={members}
              onUpdateField={handleUpdateItemField}
              onRemoveItem={handleRemoveItem}
              onOpenQuickCategory={handleOpenQuickCategory}
              onApplyToSimilar={handleApplyToSimilar}
            />
          ) : (
            <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-xs">
                Selecione um lançamento à esquerda para editar seus detalhes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM SHEET DE EDIÇÃO (ITEM 2 DO PLANO - NUNCA LARGURA FIXA COLADA NA BORDA) */}
      <Sheet open={isMobile && isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[90dvh] p-0 flex flex-col bg-white border-slate-200 overflow-hidden shadow-2xl"
        >
          <SheetHeader className="px-5 pt-4 pb-2 border-b border-slate-100 text-left shrink-0">
            <SheetTitle className="text-sm font-bold text-slate-900">Editar Lançamento</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            {activeSelectedItem && (
              <ImportItemEditor
                item={activeSelectedItem}
                allItems={items}
                categories={categories}
                members={members}
                onUpdateField={handleUpdateItemField}
                onRemoveItem={handleRemoveItem}
                onOpenQuickCategory={handleOpenQuickCategory}
                onClose={() => setIsMobileSheetOpen(false)}
                onApplyToSimilar={handleApplyToSimilar}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* RODAPÉ FIXO DE CONFIRMAÇÃO (ITEM 5 DO PLANO - RESPONSIVO 360-412PX) */}
      <ImportConfirmationFooter
        totalCount={items.length}
        selectedCount={selectedCount}
        incomeSumCents={incomeSumCents}
        expenseSumCents={expenseSumCents}
        saving={saving}
        onConfirm={handleConfirmImport}
        declaredTotalCents={session?.declaredTotalCents}
        grossExpenseCents={grossExpenseCents}
      />

      {/* MODAL DE CRIAÇÃO RÁPIDA DE NOVA CATEGORIA */}
      <Dialog open={isQuickCatOpen} onOpenChange={setIsQuickCatOpen}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] rounded-2xl p-5 mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Nova Categoria</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateQuickCategory} className="space-y-3 pt-1">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Nome da categoria</Label>
              <Input
                type="text"
                placeholder="Ex.: Padaria, Streaming, Pet Shop"
                value={quickCatName}
                onChange={(e) => setQuickCatName(e.target.value)}
                className="mt-1 text-xs rounded-xl"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Tipo</Label>
                <Select
                  value={quickCatType}
                  onValueChange={(v) => setQuickCatType(v as TransactionType)}
                >
                  <SelectTrigger className="mt-1 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Ícone</Label>
                <Select value={quickCatIcon} onValueChange={setQuickCatIcon}>
                  <SelectTrigger className="mt-1 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {AVAILABLE_ICONS.map((icon) => (
                      <SelectItem key={icon} value={icon} className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <CategoryIcon name={icon} className="w-3.5 h-3.5" />
                          {icon}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Cor</Label>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setQuickCatColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      quickCatColor === c ? 'ring-2 ring-slate-900 scale-110' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsQuickCatOpen(false)}
                disabled={quickCatSaving}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={quickCatSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl"
              >
                {quickCatSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                <span>Salvar Categoria</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE ATUALIZAÇÃO DE REGRAS DE APRENDIZADO (TAREFA 4) */}
      <Dialog open={conflictModalOpen} onOpenChange={(open) => !open && handleKeepOldRules()}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] rounded-2xl p-5 mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Atualizar regras existentes?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs text-slate-600">
            <p>
              Encontramos regras existentes para estes estabelecimentos. Deseja atualizar para as
              novas categorias escolhidas?
            </p>

            <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200/80 rounded-xl p-2.5 bg-slate-50/70">
              {conflictingRules.map((c) => (
                <div
                  key={c.ruleId}
                  className="flex items-center justify-between gap-2 text-[11px] bg-white p-2 rounded-lg border border-slate-100 shadow-2xs"
                >
                  <span
                    className="font-semibold text-slate-800 truncate max-w-[140px]"
                    title={c.pattern}
                  >
                    {c.pattern}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-slate-400 line-through truncate max-w-[80px]"
                      title={c.oldCategoryName}
                    >
                      {c.oldCategoryName}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span
                      className="text-emerald-700 font-semibold truncate max-w-[90px]"
                      title={c.newCategoryName}
                    >
                      {c.newCategoryName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleKeepOldRules}
              disabled={saving}
              className="rounded-xl text-xs"
            >
              Manter antigas
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyConflictUpdates}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              <span>Atualizar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
