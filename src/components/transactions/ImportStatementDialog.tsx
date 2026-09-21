// Componente completo de Importação de Extrato Bancário (CSV, OFX, PDF)
// Inclui: upload drag&drop, detecção automática, categorização inteligente,
// tela de revisão inline, detecção de possíveis duplicadas e criação ágil de categorias.

import React, { useState, useRef, useMemo } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import { CategoryIcon, AVAILABLE_ICONS } from '@/components/common/CategoryIcon'
import { formatBRL, parseBRLToCents, formatNumberBRL } from '@/lib/formatters'
import {
  parseStatementFile,
  type ParsedRawTransaction,
  type IgnoredLineInfo,
  type ParseDiagnostics,
} from '@/services/import/statement-parser'
import {
  matchCategorization,
  extractPatternFromDescription,
  normalizeText,
} from '@/services/import/categorization'
import { fetchCategorizationRules, upsertCategorizationRule } from '@/services/categorization-rules'
import {
  createTransactionsBatch,
  fetchTransactions,
  updateTransaction,
} from '@/services/transactions'
import type {
  Transaction,
  TransactionCategory,
  TransactionType,
  CategorizationRule,
} from '@/types/finance'
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Sparkles,
  Copy,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
  Building2,
  Star,
  ExternalLink,
  Maximize2,
  Minimize2,
  Tag,
} from 'lucide-react'

import {
  parseInstallmentFromDescription,
  generateInstallmentTransactions,
  type ParsedInstallmentInfo,
} from '@/services/installments'
import { findReconciliationMatch, type MatchStatus } from '@/services/import/reconciliation'

export interface ReviewItem {
  id: string
  date: string
  description: string
  amount_cents: number
  type: TransactionType
  fitid?: string // FITID bancário
  member_id: string
  category_id: string | null
  subcategory_id?: string | null
  rememberRule?: boolean
  isDuplicate: boolean
  duplicateReason?: string
  selected: boolean
  // Dados de parcelamento
  isInstallment?: boolean
  installmentCurrent?: number
  installmentTotal?: number
  matchedProjectId?: string | null // Se casou com uma transação 'projected' existente no banco
  matchedGroupId?: string | null
  generateFutureInstallments?: boolean // Se é 1/YY e deve gerar as X-1 parcelas futuras
  // Conciliação Inteligente com Lançamento Manual (Smart Matching)
  isReconciledManual?: boolean // Se está marcado para mesclar com lançamento manual
  matchedManualTransaction?: Transaction | null // A transação manual candidata ou vinculada
  reconciliationStatus?: MatchStatus // 'unmatched' | 'single_match' | 'multiple_candidates'
  reconciliationCandidates?: Transaction[] // Lista de candidatas manuais (em caso de múltiplas)
  reconciliationReason?: string // Explicação para o usuário
}

interface ImportStatementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const CATEGORY_COLORS = [
  '#F59E0B',
  '#3B82F6',
  '#6366F1',
  '#EC4899',
  '#EF4444',
  '#8B5CF6',
  '#14B8A6',
  '#10B981',
  '#059669',
  '#64748B',
  '#84CC16',
  '#F97316',
]

export const ImportStatementDialog: React.FC<ImportStatementDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { family, members, categories, addNewCategory, triggerRefresh, setLastImportSummary } =
    useFamily()
  const { toast } = useToast()

  // Estados do fluxo
  const [step, setStep] = useState<'upload' | 'review'>('upload')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<ParseDiagnostics | null>(null)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; format: string } | null>(
    null,
  )
  const [ignoredLines, setIgnoredLines] = useState<IgnoredLineInfo[]>([])
  const [showIgnoredLines, setShowIgnoredLines] = useState(false)
  const [fileWarnings, setFileWarnings] = useState<string[]>([])
  const [showBankGuide, setShowBankGuide] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Itens em revisão
  const [items, setItems] = useState<ReviewItem[]>([])
  const [defaultMemberId, setDefaultMemberId] = useState<string>('')
  const [categorizationRules, setCategorizationRules] = useState<CategorizationRule[]>([])
  // Accordion na revisão do extrato: ID do item atualmente expandido (null = todos recolhidos)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // Estado para criar categoria rápida inline
  const [isQuickCatOpen, setIsQuickCatOpen] = useState(false)
  const [quickCatTargetItemId, setQuickCatTargetItemId] = useState<string | null>(null)
  const [quickCatName, setQuickCatName] = useState('')
  const [quickCatType, setQuickCatType] = useState<TransactionType>('expense')
  const [quickCatColor, setQuickCatColor] = useState('#3B82F6')
  const [quickCatIcon, setQuickCatIcon] = useState('Tag')
  const [quickCatSaving, setQuickCatSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Membro padrão inicial
  React.useEffect(() => {
    if (members.length > 0 && !defaultMemberId) {
      const admin = members.find((m) => m.is_admin) || members[0]
      setDefaultMemberId(admin.id)
    }
  }, [members, defaultMemberId])

  // Lista de bancos para o mini-guia "Onde exportar o OFX"
  const BANK_GUIDES = [
    {
      name: 'Banco Inter',
      step: 'Extrato → Filtrar período → Exportar → Escolher "OFX"',
      badge: 'Conta / Fatura',
    },
    {
      name: 'Nubank',
      step: 'Faturas → Resumo da Fatura → Exportar Fatura → Escolher formato "OFX"',
      badge: 'Cartão / Conta',
    },
    {
      name: 'Itaú',
      step: 'Conta Corrente → Ver Extrato → Salvar em outros formatos → OFX',
      badge: 'Internet Banking',
    },
    {
      name: 'Bradesco',
      step: 'Saldos e Extratos → Extrato Mensal/Periódico → Salvar como OFX / Money',
      badge: 'Internet Banking',
    },
    {
      name: 'Santander',
      step: 'Conta Corrente → Extrato → Exportar extrato → Selecionar OFX',
      badge: 'Internet Banking',
    },
    {
      name: 'Banco do Brasil',
      step: 'Extrato de Conta Corrente → Salvar extrato → Formato OFX / Money 2000+',
      badge: 'App / Web',
    },
    {
      name: 'Caixa Econômica',
      step: 'Minha Conta → Extrato por período → Exportar para Money/OFX',
      badge: 'Internet Banking',
    },
    {
      name: 'Sicredi',
      step: 'Conta Corrente → Extratos → Exportar → Arquivo OFX',
      badge: 'App / Web',
    },
    {
      name: 'C6 Bank',
      step: 'Extrato da Conta → Ícone de compartilhar/exportar → Escolher OFX',
      badge: 'App C6',
    },
  ]

  // Resetar ao fechar
  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep('upload')
      setItems([])
      setExpandedItemId(null)
      setErrorMessage(null)
      setDiagnostics(null)
      setFileInfo(null)
      setIgnoredLines([])
      setShowIgnoredLines(false)
      setFileWarnings([])
      setIsQuickCatOpen(false)
      setShowBankGuide(false)
      setIsExpanded(false)
    }
    onOpenChange(isOpen)
  }

  // Processamento do arquivo enviado
  const handleProcessFile = async (file: File) => {
    if (!family) {
      setErrorMessage('Nenhuma família ativa identificada.')
      return
    }

    setParsing(true)
    setErrorMessage(null)
    setDiagnostics(null)

    try {
      // 1. Parser do arquivo
      const result = await parseStatementFile(file)
      if (!result.success || result.transactions.length === 0) {
        setErrorMessage(
          result.error ||
            'Não foram encontradas transações válidas no arquivo. Verifique se o formato é CSV, OFX ou PDF de extrato bancário.',
        )
        if (result.diagnostics) {
          setDiagnostics(result.diagnostics)
        }
        setParsing(false)
        return
      }

      setFileInfo({
        name: file.name,
        size: file.size,
        format: result.format.toUpperCase(),
      })
      setIgnoredLines(result.ignoredLines || [])
      setFileWarnings(result.warnings || [])

      // 2. Buscar transações existentes para verificação inteligente de duplicadas
      const dates = result.transactions.map((t) => t.date)
      const minDate = dates.reduce((a, b) => (a < b ? a : b))
      const maxDate = dates.reduce((a, b) => (a > b ? a : b))

      let existingTxs: Transaction[] = []
      let loadedRules: CategorizationRule[] = []
      try {
        const [txs, rules] = await Promise.all([
          fetchTransactions({ familyId: family.id }),
          fetchCategorizationRules(family.id).catch(() => []),
        ])
        existingTxs = txs
        loadedRules = rules
        setCategorizationRules(rules)
      } catch (fetchErr) {
        console.warn('Não foi possível carregar transações ou regras anteriores:', fetchErr)
      }

      // Função de similaridade simples para descrição
      const isSimilar = (a: string, b: string) => {
        const normA = (a || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const normB = (b || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        if (normA === normB) return true
        if (normA.includes(normB) || normB.includes(normA)) return true
        return false
      }

      // 3. Montar itens para a tela de revisão aplicando:
      //    a) Conciliação inteligente (Smart Matching com transações manuais ±3 dias)
      //    b) Detecção de parcelas e correspondência de projeções
      //    c) Anti-duplicidade tradicional
      //    d) Auto-categorização por regras
      const activeMemberId = defaultMemberId || members[0]?.id || ''
      const claimedManualIds = new Set<string>()

      const reviewList: ReviewItem[] = result.transactions.map((tx: ParsedRawTransaction) => {
        // Encontrar categoria e subcategoria usando as regras da tabela categorization_rules
        const matchResult = matchCategorization(tx.description, tx.type, categories, loadedRules)

        // Detecção de parcelamento na descrição
        const instInfo = tx.installmentInfo || parseInstallmentFromDescription(tx.description)
        const isInstallment = instInfo.isInstallment && tx.type === 'expense'
        const currentInst = isInstallment ? instInfo.current : 1
        const totalInst = isInstallment ? instInfo.total : 1

        // Checar duplicata e verificar correspondência com projeção futura existente
        let matchedProjectId: string | null = null
        let matchedGroupId: string | null = null
        let dupMatch: Transaction | undefined = undefined

        const txMonth = tx.date.slice(0, 7) // YYYY-MM

        if (isInstallment) {
          // Procurar se já existe uma 'projected' correspondente
          const matchingProjection = existingTxs.find((ex) => {
            const exMonth = ex.transaction_date?.slice(0, 7)
            const sameMonth = exMonth === txMonth
            const sameAmount = ex.amount_cents === tx.amount_cents
            const sameInstNum =
              ex.installment_number === currentInst ||
              (ex.description && ex.description.includes(`${currentInst}/${totalInst}`))
            const descMatch =
              isSimilar(ex.description || '', instInfo.cleanDescription) ||
              isSimilar(ex.description || '', tx.description)

            return (
              ex.status === 'projected' && sameMonth && sameAmount && (sameInstNum || descMatch)
            )
          })

          if (matchingProjection) {
            matchedProjectId = matchingProjection.id
            matchedGroupId = matchingProjection.installment_group_id || null
          }

          // Checar se já existe uma 'confirmed' (duplicata de parcela confirmada)
          dupMatch = existingTxs.find((ex) => {
            const exMonth = ex.transaction_date?.slice(0, 7)
            const sameMonth = exMonth === txMonth
            const sameAmount = ex.amount_cents === tx.amount_cents
            const sameGroup =
              matchedGroupId && ex.installment_group_id
                ? ex.installment_group_id === matchedGroupId
                : false
            const descMatch = isSimilar(ex.description || '', tx.description)

            return ex.status !== 'projected' && sameMonth && sameAmount && (sameGroup || descMatch)
          })
        } else {
          // Transação comum: verificar se é duplicata idêntica tradicional (mesma data, mesmo FITID se houver, ou mesma descrição)
          dupMatch = existingTxs.find((ex) => {
            // Se ambos têm FITID/bank_transaction_id idêntico: duplicata absoluta
            if (tx.fitid && ex.bank_transaction_id && ex.bank_transaction_id === tx.fitid) {
              return true
            }
            // Transação confirmada já vinculada a extrato anterior
            return (
              ex.transaction_date === tx.date &&
              ex.amount_cents === tx.amount_cents &&
              ex.bank_transaction_id &&
              isSimilar(ex.description || '', tx.description)
            )
          })
        }

        // ================= CONCILIAÇÃO INTELIGENTE (SMART MATCHING) =================
        // Se NÃO for uma duplicata idêntica já vinculada nem uma projeção parcelada,
        // checar se é um lançamento manual que coincide com o extrato (±3 dias, mesmo valor e tipo)
        let isReconciledManual = false
        let matchedManualTransaction: Transaction | null = null
        let reconciliationCandidates: Transaction[] = []
        let reconciliationReason: string | undefined = undefined
        let reconciliationStatus: MatchStatus = 'unmatched'

        if (!dupMatch && !matchedProjectId) {
          const reconMatch = findReconciliationMatch(
            {
              id: tx.id,
              date: tx.date,
              amount_cents: tx.amount_cents,
              type: tx.type,
              description: tx.description,
              fitid: tx.fitid,
            },
            existingTxs,
            claimedManualIds,
            3,
          )

          reconciliationStatus = reconMatch.status
          reconciliationCandidates = reconMatch.candidateTransactions
          reconciliationReason = reconMatch.matchReason

          if (reconMatch.suggestAutoMerge && reconMatch.matchedTransaction) {
            isReconciledManual = true
            matchedManualTransaction = reconMatch.matchedTransaction
            claimedManualIds.add(reconMatch.matchedTransaction.id)
          }
        }

        // Se for parcela 1/YY (ou a primeira parcela importada de uma compra), gerar projeções futuras por padrão
        const isFirstInstallment = isInstallment && currentInst === 1 && totalInst > 1

        let duplicateReason: string | undefined = undefined
        if (dupMatch) {
          duplicateReason = `Transação idêntica já cadastrada em ${dupMatch.transaction_date}`
        }

        // Se houver transação manual mesclada:
        // Preserva a Categoria, Subcategoria, Membro da família e anotações que o usuário já havia preenchido manualmente
        const initialCategoryId =
          isReconciledManual && matchedManualTransaction?.category_id
            ? matchedManualTransaction.category_id
            : matchResult
              ? matchResult.category.id
              : null

        const initialSubcategoryId =
          isReconciledManual && matchedManualTransaction
            ? matchedManualTransaction.subcategory_id || null
            : matchResult?.subcategory
              ? matchResult.subcategory.id
              : null

        const initialMemberId =
          isReconciledManual && matchedManualTransaction?.member_id
            ? matchedManualTransaction.member_id
            : activeMemberId

        return {
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount_cents: tx.amount_cents,
          type: tx.type,
          fitid: tx.fitid,
          member_id: initialMemberId,
          category_id: initialCategoryId,
          subcategory_id: initialSubcategoryId,
          rememberRule: !!initialCategoryId,
          isDuplicate: !!dupMatch,
          duplicateReason,
          isInstallment,
          installmentCurrent: currentInst,
          installmentTotal: totalInst,
          matchedProjectId,
          matchedGroupId,
          generateFutureInstallments: isFirstInstallment,
          // Se for duplicada, desmarcar por padrão para segurança do usuário
          selected: !dupMatch,
          // Conciliação inteligente
          isReconciledManual,
          matchedManualTransaction,
          reconciliationStatus,
          reconciliationCandidates,
          reconciliationReason,
        }
      })

      setItems(reviewList)
      setStep('review')
    } catch (err: any) {
      console.error('Erro na importação:', err)
      setErrorMessage(err?.message || 'Erro inesperado ao ler o extrato. Tente outro formato.')
    } finally {
      setParsing(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleProcessFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleProcessFile(file)
    }
  }

  // Ações na revisão
  const handleToggleSelectAll = (checked: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: checked })))
  }

  const handleToggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    )
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleUpdateItemField = (id: string, field: keyof ReviewItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const updated = { ...item, [field]: value }
        // Se a categoria mudou e a subcategoria atual não pertence a ela, limpa a subcategoria
        if (field === 'category_id') {
          if (!value) {
            updated.subcategory_id = null
            updated.rememberRule = false
          } else {
            const cat = categories.find((c) => c.id === value)
            const validSub = cat?.subcategories?.some((s) => s.id === item.subcategory_id)
            if (!validSub) {
              updated.subcategory_id = null
            }
            if (item.rememberRule === undefined) {
              updated.rememberRule = true
            }
          }
        }
        return updated
      }),
    )
  }

  const handleApplyMemberToAll = (newMemberId: string) => {
    setDefaultMemberId(newMemberId)
    setItems((prev) => prev.map((i) => ({ ...i, member_id: newMemberId })))
  }

  // Modal rápido de nova categoria
  const openQuickCategoryModal = (itemId?: string) => {
    setQuickCatTargetItemId(itemId || null)
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

      // Se foi aberto a partir de uma linha específica, já vincula a ela
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

  // Estatísticas da revisão
  const selectedCount = useMemo(() => items.filter((i) => i.selected).length, [items])
  const duplicateCount = useMemo(() => items.filter((i) => i.isDuplicate).length, [items])
  const mergedCount = useMemo(() => items.filter((i) => i.isReconciledManual).length, [items])
  const multipleCandidatesCount = useMemo(
    () => items.filter((i) => i.reconciliationStatus === 'multiple_candidates').length,
    [items],
  )
  const uncategorizedCount = useMemo(() => items.filter((i) => !i.category_id).length, [items])
  const totalAmountSelected = useMemo(() => {
    let inc = 0
    let exp = 0
    items
      .filter((i) => i.selected)
      .forEach((i) => {
        if (i.type === 'income') inc += i.amount_cents
        else exp += i.amount_cents
      })
    return { inc, exp }
  }, [items])

  // Salvar no banco
  const handleSaveImported = async () => {
    if (!family) return
    const selectedItems = items.filter((i) => i.selected)

    if (selectedItems.length === 0) {
      toast({
        title: 'Nenhuma transação selecionada',
        description: 'Marque ao menos uma transação para importar.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)

      // Separar itens que:
      // 1. Atualizam projeção existente ('projected' -> 'confirmed')
      // 2. Mesclam com transação manual existente (vincula bank_transaction_id / FITID, sem duplicar orçamento)
      // 3. Criam novas transações no banco
      const toUpdateProjections: Array<{
        id: string
        payload: any
      }> = []

      const toUpdateManualMerges: Array<{
        id: string
        payload: any
      }> = []

      const toCreatePayloads: Array<any> = []

      for (const item of selectedItems) {
        // Caso A: Se este item está marcado para mesclar com lançamento manual existente
        // Atualiza a transação manual existente com o FITID bancário (e ajusta a data para a do banco,
        // preservando categoria, subcategoria, membro e anotações já definidas)
        if (item.isReconciledManual && item.matchedManualTransaction) {
          toUpdateManualMerges.push({
            id: item.matchedManualTransaction.id,
            payload: {
              bank_transaction_id: item.fitid || `merged-${item.matchedManualTransaction.id}`,
              // Ajusta a data para a data do extrato bancário oficial
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

        // Caso B: Se este item casa com uma projeção futura existente no banco, converte para 'confirmed'
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

        // Se for parcela e foi marcado para gerar projeções futuras (ex: 1/YY)
        if (
          item.isInstallment &&
          item.generateFutureInstallments &&
          (item.installmentTotal || 1) > 1
        ) {
          const totalInst = item.installmentTotal || 1
          const startNum = item.installmentCurrent || 1
          const instGroup = item.matchedGroupId || crypto.randomUUID()

          // Gera todas as parcelas (a 1ª como confirmed e as próximas como projected)
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
          })

          toCreatePayloads.push(...gen.transactions)
        } else if (item.isInstallment) {
          // Parcela avulsa ou intermediária sem projeção correspondente
          toCreatePayloads.push({
            family_id: family.id,
            member_id: item.member_id || members[0]?.id,
            category_id: item.category_id,
            subcategory_id: item.subcategory_id || null,
            type: item.type,
            amount_cents: item.amount_cents,
            description: item.description.trim() || 'Transação parcelada',
            transaction_date: item.date,
            is_installment: true,
            installment_number: item.installmentCurrent || 1,
            installment_total: item.installmentTotal || 1,
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
            is_installment: false,
            status: 'confirmed',
            bank_transaction_id: item.fitid || null,
          })
        }
      }

      // Executa updates (projeções e mesclas manuais) e criações em lote
      await Promise.all([
        ...toUpdateManualMerges.map((up) => updateTransaction(up.id, up.payload)),
        ...toUpdateProjections.map((up) => updateTransaction(up.id, up.payload)),
        createTransactionsBatch(toCreatePayloads),
      ])

      // Upsert das regras de categorização para itens com "Lembrar para compras futuras"
      const rulesToUpsert = selectedItems.filter(
        (i) => i.rememberRule && i.category_id && i.description && i.description.trim(),
      )

      for (const item of rulesToUpsert) {
        try {
          const rawPattern =
            extractPatternFromDescription(item.description) || normalizeText(item.description)
          const patternToSave = (rawPattern || item.description.trim()).toUpperCase()

          if (patternToSave && patternToSave.length >= 2) {
            await upsertCategorizationRule({
              family_id: family.id,
              user_id: null,
              pattern: patternToSave,
              category_id: item.category_id!,
              subcategory_id: item.subcategory_id || null,
            })
          }
        } catch (ruleErr) {
          console.warn('Não foi possível salvar regra de categorização ao importar:', ruleErr)
        }
      }

      const pendingCount = selectedItems.filter((i) => !i.category_id).length
      const categorizedCount = selectedItems.length - pendingCount

      setLastImportSummary({
        total: selectedItems.length,
        categorized: categorizedCount,
        pending: pendingCount,
        importedAt: new Date(),
      })

      const detailsMsgParts: string[] = []
      if (toUpdateManualMerges.length > 0) {
        detailsMsgParts.push(`${toUpdateManualMerges.length} mesclada(s) com lançamento manual`)
      }
      if (toUpdateProjections.length > 0) {
        detailsMsgParts.push(`${toUpdateProjections.length} projeção(ões) convertida(s)`)
      }

      const detailsMsg = detailsMsgParts.length > 0 ? ` (${detailsMsgParts.join(', ')})` : ''

      toast({
        title: 'Extrato importado com sucesso! 🎉',
        description: `${selectedItems.length} transações processadas com sucesso${detailsMsg}. Orçamento sem duplicações.`,
      })

      triggerRefresh()
      if (onSuccess) onSuccess()
      handleDialogChange(false)
    } catch (err: any) {
      console.error('Erro ao salvar lote:', err)
      toast({
        title: 'Falha ao salvar transações',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent
          className={`flex flex-col p-3 sm:p-6 overflow-hidden transition-all duration-200 border-slate-200/90 shadow-2xl ${
            /* Mobile: quase full-screen com cantos suaves */
            'w-[calc(100vw-1rem)] h-[calc(100dvh-1rem)] max-w-none max-h-none rounded-2xl sm:w-auto sm:h-auto'
          } ${
            /* Desktop (sm+): tamanho padrão espaçoso ou expandido */
            isExpanded
              ? 'sm:w-[98vw] sm:max-w-7xl sm:h-[94vh] sm:max-h-[94vh] sm:rounded-2xl'
              : 'sm:w-[94vw] sm:max-w-6xl sm:h-[88vh] sm:max-h-[88vh] sm:rounded-2xl'
          }`}
        >
          <DialogHeader className="shrink-0 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2 pr-7 sm:pr-8">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base shrink-0">
                  📥
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 truncate">
                      Importar Extrato Bancário
                    </DialogTitle>
                    {step === 'review' && fileInfo ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                        <span>{fileInfo.format}</span>
                        <span className="text-emerald-400">•</span>
                        <span className="max-w-[140px] sm:max-w-[220px] truncate">
                          {fileInfo.name}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {step === 'upload'
                      ? 'Recomendado: OFX (100% de precisão bancária). Também aceita CSV e PDF.'
                      : `Revisão de lançamentos: ajuste categorias, membros, datas e confirme a importação`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {step === 'review' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('upload')}
                    className="text-xs h-8 rounded-xl px-2.5"
                    title="Enviar outro extrato"
                  >
                    <span>Trocar arquivo</span>
                  </Button>
                ) : null}

                {/* Botão de Expandir / Colapsar no desktop */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="hidden sm:inline-flex items-center justify-center h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  title={
                    isExpanded ? 'Restaurar tamanho padrão' : 'Expandir diálogo para tela cheia'
                  }
                  aria-label={isExpanded ? 'Restaurar tamanho padrão' : 'Expandir diálogo'}
                >
                  {isExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* ================= ETAPA 1: UPLOAD ================= */}
          {step === 'upload' ? (
            <div className="flex-1 overflow-y-auto py-6 space-y-5">
              {errorMessage ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <strong className="block font-bold text-amber-900 text-sm">
                        Não foi possível identificar lançamentos no arquivo
                      </strong>
                      <span className="text-amber-800/90 mt-0.5 block">{errorMessage}</span>
                    </div>
                  </div>

                  {diagnostics ? (
                    <div className="bg-white/80 rounded-xl p-3 border border-amber-200/60 space-y-2 text-xs">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        <span>Diagnóstico da Leitura:</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center font-mono">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-sans block">
                            Linhas analisadas
                          </span>
                          <span className="font-bold text-slate-800 text-sm">
                            {diagnostics.totalLines}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-sans block">
                            Com data válida
                          </span>
                          <span
                            className={`font-bold text-sm ${diagnostics.linesWithDate > 0 ? 'text-emerald-700' : 'text-slate-400'}`}
                          >
                            {diagnostics.linesWithDate}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-sans block">
                            Com valor legível
                          </span>
                          <span
                            className={`font-bold text-sm ${diagnostics.linesWithValue > 0 ? 'text-emerald-700' : 'text-slate-400'}`}
                          >
                            {diagnostics.linesWithValue}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-sans block">
                            Data + Valor
                          </span>
                          <span
                            className={`font-bold text-sm ${diagnostics.linesWithBoth > 0 ? 'text-amber-700' : 'text-slate-400'}`}
                          >
                            {diagnostics.linesWithBoth}
                          </span>
                        </div>
                      </div>

                      {diagnostics.suggestion ? (
                        <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-blue-900 text-[11px] leading-relaxed">
                          <strong className="font-semibold">Orientação: </strong>
                          {diagnostics.suggestion}
                        </div>
                      ) : null}

                      {diagnostics.rejectionReasons &&
                      Object.keys(diagnostics.rejectionReasons).length > 0 ? (
                        <div className="pt-1">
                          <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                            Motivos das rejeições:
                          </span>
                          <ul className="space-y-0.5 text-[11px] text-slate-600 pl-3 list-disc">
                            {Object.entries(diagnostics.rejectionReasons)
                              .slice(0, 4)
                              .map(([reason, count]) => (
                                <li key={reason}>
                                  <span className="font-medium text-slate-800">{count}x</span>{' '}
                                  {reason}
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Zona Drag & Drop */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  parsing
                    ? 'border-emerald-500 bg-emerald-50/50 cursor-wait'
                    : 'border-slate-300 hover:border-emerald-600 hover:bg-slate-50/80 bg-white'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.ofx,.pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  {parsing ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <UploadCloud className="w-8 h-8 stroke-[1.8]" />
                  )}
                </div>

                <h3 className="font-bold text-base text-slate-800">
                  {parsing ? 'Processando e categorizando extrato...' : 'Arraste seu extrato aqui'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  {parsing
                    ? 'Lendo transações, identificando valores e aplicando inteligência de categorias...'
                    : 'Ou clique para selecionar um arquivo do seu computador ou celular'}
                </p>

                {/* Badges de Formato com Destaque para OFX */}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600 text-white shadow-sm px-3 py-1 rounded-xl">
                    <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                    <span>OFX (Recomendado • 100% Preciso)</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>CSV (Alternativa confiável)</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg">
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF (Melhor esforço)</span>
                  </span>
                </div>
              </div>

              {/* Box Informativo: Por que preferir OFX & Mini-guia expansível */}
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 p-3.5 sm:p-4 text-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Star className="w-4 h-4 text-emerald-700 fill-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                        OFX é o formato oficial e recomendado
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Ao exportar em <strong>OFX</strong> no seu banco, os dados chegam sem falhas
                        de layout, com datas e valores exatos. O <strong>CSV</strong> também é uma
                        ótima alternativa. Já arquivos em <strong>PDF</strong> funcionam por
                        aproximação visual e podem falhar dependendo da formatação gráfica do banco.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBankGuide((prev) => !prev)}
                    className="h-8 text-xs rounded-xl bg-white/90 border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 shrink-0 font-semibold gap-1"
                  >
                    <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{showBankGuide ? 'Ocultar guia' : 'Como exportar nos bancos'}</span>
                    {showBankGuide ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>

                {/* Lista de Bancos Expansível */}
                {showBankGuide && (
                  <div className="pt-2 border-t border-emerald-200/80">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-2">
                      <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Passo a passo nos principais bancos brasileiros:</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {BANK_GUIDES.map((b) => (
                        <div
                          key={b.name}
                          className="p-2.5 rounded-xl bg-white/95 border border-emerald-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{b.name}</span>
                            <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {b.badge}
                            </span>
                          </div>
                          <p className="text-slate-600 leading-snug">{b.step}</p>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-slate-500 mt-2 italic">
                      Dica: No Internet Banking ou no app, procure o botão de
                      download/compartilhamento no extrato ou fatura e escolha a opção{' '}
                      <strong>OFX</strong> (às vezes chamada de "Money", "MS Money" ou "Outros
                      formatos").
                    </p>
                  </div>
                )}
              </div>

              {/* Informações e Recursos de Apoio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Categorias Inteligentes</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    O sistema reconhece termos como iFood, Uber, Mercado, Farmácia e Salário
                    automaticamente.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                    <Copy className="w-3.5 h-3.5 text-blue-600" />
                    <span>Anti-Duplicidade</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Transações com mesma data e valor já registradas são identificadas para evitar
                    lançamentos repetidos.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                    <Info className="w-3.5 h-3.5 text-purple-600" />
                    <span>Revisão Completa</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Você pode alterar categorias, atribuir membros, desmarcar itens ou criar novas
                    categorias antes de salvar.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* ================= ETAPA 2: REVISÃO ANTES DE SALVAR ================= */}
          {step === 'review' ? (
            <div className="flex-1 flex flex-col min-h-0 pt-2 space-y-3">
              {/* Barra de Ações Rápidas no Topo */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Selecionar / Desmarcar Todos */}
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCount === items.length && items.length > 0}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      Selecionar todos ({selectedCount}/{items.length})
                    </span>
                  </label>

                  {/* Badge de lançamentos válidos */}
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {items.length} válidos
                  </span>

                  {/* Badge de Mescla com Lançamento Manual (Conciliação Inteligente) */}
                  {mergedCount > 0 && (
                    <span className="text-[11px] font-bold text-teal-800 bg-teal-100/90 border border-teal-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <span>🔗</span>
                      <span>{mergedCount} mesclada(s) com manual</span>
                    </span>
                  )}

                  {/* Aviso de múltiplas candidatas */}
                  {multipleCandidatesCount > 0 && (
                    <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span>⚡</span>
                      <span>{multipleCandidatesCount} com múltiplos manuais</span>
                    </span>
                  )}

                  {/* Alerta de duplicatas */}
                  {duplicateCount > 0 && (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {duplicateCount} duplicata(s)
                    </span>
                  )}

                  {/* Alerta de pendentes de categoria */}
                  {uncategorizedCount > 0 && (
                    <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-600" />
                      {uncategorizedCount} pendente(s) de categoria
                    </span>
                  )}
                </div>

                {/* Membro em lote & Criar Categoria */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="hidden sm:inline">Atribuir a:</span>
                    <Select value={defaultMemberId} onValueChange={handleApplyMemberToAll}>
                      <SelectTrigger className="h-8 text-xs bg-white w-32 rounded-xl">
                        <SelectValue placeholder="Membro" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openQuickCategoryModal()}
                    className="h-8 text-xs rounded-xl text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />+ Categoria
                  </Button>
                </div>
              </div>

              {/* Avisos e Filtro de Ruído Expansível */}
              {ignoredLines.length > 0 && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <Info className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        <strong className="font-semibold text-slate-800">
                          {ignoredLines.length}
                        </strong>{' '}
                        {ignoredLines.length === 1 ? 'linha ignorada' : 'linhas ignoradas'} pelo
                        filtro de segurança (cabeçalho, rodapé ou sem data/valor)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowIgnoredLines((prev) => !prev)}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 hover:underline"
                    >
                      <span>{showIgnoredLines ? 'Ocultar detalhes' : 'Ver linhas ignoradas'}</span>
                      {showIgnoredLines ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {showIgnoredLines && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/70 max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                      {ignoredLines.map((ign, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-2 p-1 rounded bg-white/70 text-slate-600"
                        >
                          <span className="truncate flex-1" title={ign.text}>
                            {ign.lineNumber ? `L${ign.lineNumber}: ` : ''}
                            {ign.text}
                          </span>
                          <span className="shrink-0 text-[10px] text-amber-700 font-sans bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            {ign.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Lista Scrollável de Transações com padrão Accordion Tap-to-Expand */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 border border-slate-200/80 rounded-2xl bg-slate-50/40 p-2">
                {items.map((item) => {
                  const isIncome = item.type === 'income'
                  const currentCategory = categories.find((c) => c.id === item.category_id)
                  const filteredCategories = categories.filter((c) => c.type === item.type)
                  const availableSubcategories = currentCategory?.subcategories || []
                  const isOpen = expandedItemId === item.id

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        isOpen
                          ? 'bg-amber-50/40 border-amber-300 shadow-md ring-2 ring-amber-400/40'
                          : item.isDuplicate
                            ? 'bg-amber-50/60 border-amber-200 shadow-2xs hover:bg-amber-50'
                            : item.selected
                              ? 'bg-white border-slate-200/90 shadow-2xs hover:bg-slate-50/80'
                              : 'opacity-60 bg-slate-100/70 border-slate-200/60 shadow-2xs'
                      }`}
                    >
                      {/* ================= 1. LINHA RECOLHIDA (TAP-TO-EXPAND HEADER) ================= */}
                      <div className="p-2.5 sm:p-3 flex items-center justify-between gap-2 min-h-[44px]">
                        {/* Checkbox de seleção para importação */}
                        <div
                          className="shrink-0 flex items-center pr-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleItem(item.id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            title={
                              item.selected ? 'Desmarcar da importação' : 'Marcar para importação'
                            }
                          />
                        </div>

                        {/* Botão de toque em toda a linha para abrir o accordion */}
                        <button
                          type="button"
                          role="button"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setExpandedItemId((prev) => (prev === item.id ? null : item.id))
                          }
                          className="flex items-center justify-between gap-2.5 min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl select-none"
                        >
                          {/* Lado esquerdo: Ícone da categoria + Descrição + Badges */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
                              style={{
                                backgroundColor: currentCategory?.color || '#F59E0B',
                                color: '#FFFFFF',
                              }}
                            >
                              {currentCategory?.icon ? (
                                <CategoryIcon name={currentCategory.icon} className="w-3.5 h-3.5" />
                              ) : (
                                <Tag className="w-3.5 h-3.5" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p
                                className="font-bold text-xs sm:text-sm text-slate-900 truncate leading-tight"
                                title={item.description}
                              >
                                {item.description || 'Transação sem descrição'}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 mt-0.5 min-w-0 flex-wrap">
                                <span className="tabular-nums font-mono text-slate-600 shrink-0">
                                  {item.date}
                                </span>
                                {item.isReconciledManual && (
                                  <span
                                    title={
                                      item.reconciliationReason ||
                                      'Transação manual correspondente vinculada sem duplicar orçamento'
                                    }
                                    className="font-bold text-[10px] bg-teal-100 text-teal-900 border border-teal-300 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span>🔗 Mesclada com lançamento manual</span>
                                  </span>
                                )}
                                {!item.isReconciledManual &&
                                  item.reconciliationStatus === 'multiple_candidates' && (
                                    <span
                                      title={item.reconciliationReason}
                                      className="font-semibold text-[10px] bg-indigo-100 text-indigo-900 border border-indigo-300 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span>
                                        ⚡ {item.reconciliationCandidates?.length} candidatas
                                        manuais (decida na expansão)
                                      </span>
                                    </span>
                                  )}
                                {item.isInstallment && (
                                  <span className="font-bold text-[10px] bg-purple-100 text-purple-900 border border-purple-300/80 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                                    <span>
                                      {item.installmentCurrent}/{item.installmentTotal}
                                    </span>
                                  </span>
                                )}
                                {item.matchedProjectId && (
                                  <span className="font-semibold text-[10px] bg-blue-100 text-blue-900 border border-blue-300/80 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                                    <span>Converte projeção</span>
                                  </span>
                                )}
                                {item.isDuplicate && (
                                  <span
                                    title={item.duplicateReason}
                                    className="font-semibold text-[10px] bg-amber-100 text-amber-900 border border-amber-300/80 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5"
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                                    <span>Duplicada</span>
                                  </span>
                                )}
                                {!item.category_id ? (
                                  <span className="font-semibold text-[10px] bg-amber-100 text-amber-900 border border-amber-300/80 px-1.5 py-0.2 rounded font-mono shrink-0">
                                    Pendente
                                  </span>
                                ) : (
                                  <span className="truncate text-slate-600 font-medium">
                                    • {currentCategory?.name}
                                  </span>
                                )}{' '}
                              </div>
                            </div>
                          </div>

                          {/* Lado direito: Valor alinhado + Chevron */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`font-extrabold text-xs sm:text-sm tabular-nums whitespace-nowrap ${
                                isIncome ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              {isIncome ? '+' : '−'} {formatBRL(item.amount_cents)}
                            </span>
                            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                              {isOpen ? (
                                <ChevronUp className="w-3.5 h-3.5 transition-transform" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 transition-transform" />
                              )}
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* ================= 2. PAINEL EXPANDIDO COM OS CONTROLES COMPLETOS ================= */}
                      <div
                        className={`grid transition-all duration-200 ease-out ${
                          isOpen
                            ? 'grid-rows-[1fr] opacity-100'
                            : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="p-3 sm:p-4 pt-1 sm:pt-1 border-t border-slate-200/80 space-y-3 bg-gradient-to-b from-amber-50/20 to-white/95">
                            {/* Bloco de Conciliação Inteligente com Lançamento Manual (Smart Matching) */}
                            {item.matchedManualTransaction ||
                            item.reconciliationStatus === 'multiple_candidates' ? (
                              <div
                                className={`p-3 rounded-xl border text-xs space-y-2.5 ${
                                  item.isReconciledManual
                                    ? 'bg-teal-50/80 border-teal-200 text-teal-950'
                                    : 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <span className="text-sm">🔗</span>
                                    <span>
                                      {item.isReconciledManual
                                        ? 'Mesclada com lançamento manual'
                                        : 'Correspondência manual detectada'}
                                    </span>
                                    {item.isReconciledManual && (
                                      <span className="text-[10px] font-semibold text-teal-800 bg-white/80 border border-teal-300 px-1.5 py-0.2 rounded-full">
                                        Ativo
                                      </span>
                                    )}
                                  </div>

                                  {/* Toggle / Checkbox de mescla */}
                                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold px-2.5 py-1 rounded-lg bg-white shadow-2xs border border-teal-300 text-teal-900 hover:bg-teal-50">
                                    <input
                                      type="checkbox"
                                      checked={item.isReconciledManual ?? false}
                                      onChange={(e) => {
                                        const shouldMerge = e.target.checked
                                        if (shouldMerge) {
                                          const targetManual =
                                            item.matchedManualTransaction ||
                                            item.reconciliationCandidates?.[0] ||
                                            null
                                          handleUpdateItemField(item.id, 'isReconciledManual', true)
                                          if (targetManual) {
                                            handleUpdateItemField(
                                              item.id,
                                              'matchedManualTransaction',
                                              targetManual,
                                            )
                                            if (targetManual.category_id) {
                                              handleUpdateItemField(
                                                item.id,
                                                'category_id',
                                                targetManual.category_id,
                                              )
                                            }
                                            if (targetManual.subcategory_id) {
                                              handleUpdateItemField(
                                                item.id,
                                                'subcategory_id',
                                                targetManual.subcategory_id,
                                              )
                                            }
                                            if (targetManual.member_id) {
                                              handleUpdateItemField(
                                                item.id,
                                                'member_id',
                                                targetManual.member_id,
                                              )
                                            }
                                          }
                                        } else {
                                          handleUpdateItemField(
                                            item.id,
                                            'isReconciledManual',
                                            false,
                                          )
                                        }
                                      }}
                                      className="rounded border-teal-400 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                                    />
                                    <span>
                                      {item.isReconciledManual
                                        ? '🔗 Mesclada (desmarque se forem compras distintas)'
                                        : 'Vincular e mesclar com este lançamento'}
                                    </span>
                                  </label>
                                </div>

                                {/* Informações da transação manual vinculada */}
                                {item.matchedManualTransaction && (
                                  <div className="bg-white/90 rounded-lg p-2.5 border border-teal-200/80 space-y-1 text-[11px]">
                                    <div className="flex items-center justify-between text-slate-700">
                                      <span className="font-semibold text-slate-900">
                                        Lançamento manual no app:
                                      </span>
                                      <span className="font-mono text-slate-600 font-medium">
                                        Data: {item.matchedManualTransaction.transaction_date}
                                      </span>
                                    </div>
                                    <div className="text-slate-800 font-medium truncate">
                                      "
                                      {item.matchedManualTransaction.description || 'Sem descrição'}
                                      "
                                      {item.matchedManualTransaction.category?.name ? (
                                        <span className="text-teal-700 font-semibold ml-2">
                                          • {item.matchedManualTransaction.category.name}
                                          {item.matchedManualTransaction.subcategory?.name
                                            ? ` / ${item.matchedManualTransaction.subcategory.name}`
                                            : ''}
                                        </span>
                                      ) : null}
                                      {item.matchedManualTransaction.member?.name ? (
                                        <span className="text-slate-500 ml-2">
                                          ({item.matchedManualTransaction.member.name})
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="text-[10px] text-teal-900/80 pt-0.5">
                                      {item.isReconciledManual
                                        ? '✓ O FITID do banco será vinculado à transação manual existente, preservando categoria, subcategoria e membro. O valor será contabilizado uma única vez no orçamento.'
                                        : 'Se mantiver desmarcado, uma nova transação será importada e a transação manual permanecerá independente.'}
                                    </p>
                                  </div>
                                )}

                                {/* Se houver múltiplas candidatas, permitir seleção da candidata desejada */}
                                {!item.isReconciledManual &&
                                  (item.reconciliationCandidates?.length || 0) > 1 && (
                                    <div className="space-y-1.5 pt-1">
                                      <span className="font-semibold text-slate-800 text-[11px] block">
                                        Escolha qual lançamento manual corresponde a esta despesa:
                                      </span>
                                      <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {item.reconciliationCandidates?.map((cand) => (
                                          <div
                                            key={cand.id}
                                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-indigo-200 text-[11px]"
                                          >
                                            <div className="min-w-0 flex-1">
                                              <span className="font-bold text-slate-800 block truncate">
                                                {cand.description || 'Sem descrição'}
                                              </span>
                                              <span className="text-[10px] text-slate-500">
                                                {cand.transaction_date} •{' '}
                                                {cand.category?.name || 'Sem categoria'} •{' '}
                                                {cand.member?.name || 'Membro'}
                                              </span>
                                            </div>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              onClick={() => {
                                                handleUpdateItemField(
                                                  item.id,
                                                  'isReconciledManual',
                                                  true,
                                                )
                                                handleUpdateItemField(
                                                  item.id,
                                                  'matchedManualTransaction',
                                                  cand,
                                                )
                                                if (cand.category_id) {
                                                  handleUpdateItemField(
                                                    item.id,
                                                    'category_id',
                                                    cand.category_id,
                                                  )
                                                }
                                                if (cand.subcategory_id) {
                                                  handleUpdateItemField(
                                                    item.id,
                                                    'subcategory_id',
                                                    cand.subcategory_id,
                                                  )
                                                }
                                                if (cand.member_id) {
                                                  handleUpdateItemField(
                                                    item.id,
                                                    'member_id',
                                                    cand.member_id,
                                                  )
                                                }
                                              }}
                                              className="h-7 text-[10px] px-2 font-bold rounded-lg bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100 shrink-0"
                                            >
                                              🔗 Mesclar com esta
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            ) : null}

                            {/* Linha 1: Descrição editável, Data, Toggle Receita/Despesa e Membro */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                              {/* Descrição */}
                              <div className="sm:col-span-5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                  Descrição
                                </label>
                                <Input
                                  value={item.description}
                                  onChange={(e) =>
                                    handleUpdateItemField(item.id, 'description', e.target.value)
                                  }
                                  className="h-8 text-xs font-semibold bg-white border-slate-300 focus:border-emerald-600 rounded-xl"
                                />
                              </div>

                              {/* Data */}
                              <div className="sm:col-span-3">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                  Data
                                </label>
                                <input
                                  type="date"
                                  value={item.date}
                                  onChange={(e) =>
                                    handleUpdateItemField(item.id, 'date', e.target.value)
                                  }
                                  className="h-8 w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-xl px-2.5 font-medium focus:outline-none focus:border-emerald-600"
                                />
                              </div>

                              {/* Toggle Receita / Despesa */}
                              <div className="sm:col-span-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                  Tipo
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateItemField(
                                      item.id,
                                      'type',
                                      isIncome ? 'expense' : 'income',
                                    )
                                  }
                                  className={`h-8 w-full text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors border ${
                                    isIncome
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                  }`}
                                >
                                  {isIncome ? (
                                    <>
                                      <ArrowUpRight className="w-3.5 h-3.5" /> Receita
                                    </>
                                  ) : (
                                    <>
                                      <ArrowDownRight className="w-3.5 h-3.5" /> Despesa
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Membro */}
                              <div className="sm:col-span-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                  Membro
                                </label>
                                <Select
                                  value={item.member_id}
                                  onValueChange={(val) =>
                                    handleUpdateItemField(item.id, 'member_id', val)
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs bg-white border-slate-300 rounded-xl">
                                    <SelectValue placeholder="Membro" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {members.map((m) => (
                                      <SelectItem key={m.id} value={m.id} className="text-xs">
                                        {m.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Detalhes de Parcelamento quando detectado */}
                            {item.isInstallment && (
                              <div className="p-3 bg-purple-50/70 border border-purple-200/90 rounded-xl space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-purple-950 flex items-center gap-1.5">
                                    <span>📦 Despesa Parcelada Detectada</span>
                                    <span className="bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-full font-mono text-[11px]">
                                      Parcela {item.installmentCurrent} de {item.installmentTotal}
                                    </span>
                                  </span>
                                  {item.matchedProjectId ? (
                                    <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                      ✓ Projeção existente encontrada no mês
                                    </span>
                                  ) : null}
                                </div>

                                {item.matchedProjectId ? (
                                  <p className="text-[11px] text-purple-800 leading-relaxed">
                                    Esta parcela corresponde a uma projeção futura já cadastrada. Ao
                                    importar, ela será convertida de <em>projetada</em> para{' '}
                                    <strong>confirmada</strong> sem gerar duplicidade.
                                  </p>
                                ) : item.installmentCurrent === 1 &&
                                  (item.installmentTotal || 1) > 1 ? (
                                  <label className="flex items-start gap-2 cursor-pointer select-none text-[11px] text-purple-950 font-medium">
                                    <input
                                      type="checkbox"
                                      checked={item.generateFutureInstallments ?? true}
                                      onChange={(e) =>
                                        handleUpdateItemField(
                                          item.id,
                                          'generateFutureInstallments',
                                          e.target.checked,
                                        )
                                      }
                                      className="mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span>
                                      <strong>
                                        Gerar automaticamente as {(item.installmentTotal || 1) - 1}{' '}
                                        parcelas futuras
                                      </strong>{' '}
                                      como despesas projetadas nos próximos meses (mesmo dia,
                                      categoria e valor).
                                    </span>
                                  </label>
                                ) : (
                                  <p className="text-[11px] text-purple-800 leading-relaxed">
                                    Parcela intermediária sem projeção prévia identificada. Será
                                    criada como despesa confirmada deste mês.
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Linha 2: Categoria e Subcategoria */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                              {/* Categoria */}
                              <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                                  Categoria
                                </label>
                                <Select
                                  value={item.category_id || 'none'}
                                  onValueChange={(val) => {
                                    if (val === 'CREATE_NEW') {
                                      openQuickCategoryModal(item.id)
                                    } else {
                                      handleUpdateItemField(
                                        item.id,
                                        'category_id',
                                        val === 'none' ? null : val,
                                      )
                                    }
                                  }}
                                >
                                  <SelectTrigger
                                    className={`h-9 text-xs bg-white rounded-xl shadow-2xs font-medium border-2 ${
                                      !item.category_id
                                        ? 'text-amber-900 border-amber-400 bg-amber-50/40'
                                        : 'text-slate-900 border-slate-300'
                                    }`}
                                  >
                                    <SelectValue placeholder="Sem categoria">
                                      {currentCategory ? (
                                        <span className="flex items-center gap-1.5 truncate">
                                          <CategoryIcon
                                            name={currentCategory.icon}
                                            className="w-3.5 h-3.5 shrink-0"
                                          />
                                          <span className="truncate">{currentCategory.name}</span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">Sem categoria</span>
                                      )}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="max-h-72">
                                    <SelectItem value="none" className="text-xs text-slate-500">
                                      Sem categoria
                                    </SelectItem>
                                    {filteredCategories.map((c) => (
                                      <SelectItem
                                        key={c.id}
                                        value={c.id}
                                        className="text-xs py-1.5"
                                      >
                                        <span className="flex items-center gap-1.5">
                                          <CategoryIcon name={c.icon} className="w-3.5 h-3.5" />
                                          {c.name}
                                        </span>
                                      </SelectItem>
                                    ))}
                                    <SelectItem
                                      value="CREATE_NEW"
                                      className="text-xs font-semibold text-emerald-700 border-t mt-1"
                                    >
                                      + Criar nova categoria
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Subcategoria */}
                              <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                                  Subcategoria
                                </label>
                                <Select
                                  value={item.subcategory_id || 'none'}
                                  onValueChange={(val) =>
                                    handleUpdateItemField(
                                      item.id,
                                      'subcategory_id',
                                      val === 'none' ? null : val,
                                    )
                                  }
                                  disabled={availableSubcategories.length === 0}
                                >
                                  <SelectTrigger className="h-9 text-xs w-full rounded-xl bg-white border-slate-300 shadow-2xs font-medium">
                                    <SelectValue
                                      placeholder={
                                        availableSubcategories.length === 0
                                          ? 'Sem subcategorias nesta categoria'
                                          : 'Subcategoria opcional...'
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    <SelectItem value="none" className="text-xs text-slate-500">
                                      Sem subcategoria
                                    </SelectItem>
                                    {availableSubcategories.map((sub) => (
                                      <SelectItem key={sub.id} value={sub.id} className="text-xs">
                                        {sub.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Lembrar regra para compras futuras */}
                            {item.category_id && (
                              <div className="pt-0.5">
                                <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                                  <input
                                    type="checkbox"
                                    checked={item.rememberRule ?? true}
                                    onChange={(e) =>
                                      handleUpdateItemField(
                                        item.id,
                                        'rememberRule',
                                        e.target.checked,
                                      )
                                    }
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                                  />
                                  <span className="text-slate-700 font-medium flex items-center gap-1.5 text-[11px]">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Lembrar para compras futuras com este nome</span>
                                  </span>
                                </label>
                              </div>
                            )}

                            {/* Ações da linha expandida: Remover ou Concluir e Recolher */}
                            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(item.id)}
                                className="rounded-xl text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-8 gap-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remover do extrato</span>
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setExpandedItemId(null)}
                                className="rounded-xl text-xs font-bold gap-1 bg-slate-900 hover:bg-slate-800 text-white h-8 px-3"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Concluir</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Totalizador Rodapé */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs shrink-0">
                <span className="text-slate-500 font-medium">
                  {selectedCount} de {items.length} transações prontas para importar
                </span>
                <div className="flex items-center gap-3">
                  {totalAmountSelected.inc > 0 ? (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      <span>Entradas: +{formatBRL(totalAmountSelected.inc)}</span>
                    </span>
                  ) : null}
                  {totalAmountSelected.exp > 0 ? (
                    <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded">
                      <span>Saídas: −{formatBRL(totalAmountSelected.exp)}</span>
                    </span>
                  ) : null}{' '}
                </div>
              </div>
            </div>
          ) : null}

          {/* Footer do Diálogo */}
          <DialogFooter className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
            {step === 'upload' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
                className="w-full sm:w-auto text-xs"
              >
                Cancelar
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('upload')}
                  disabled={saving}
                  className="w-full sm:w-auto text-xs"
                >
                  Voltar
                </Button>

                <Button
                  type="button"
                  onClick={handleSaveImported}
                  disabled={saving || selectedCount === 0}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    `Importar ${selectedCount} ${selectedCount === 1 ? 'Transação' : 'Transações'}`
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL SECUNDÁRIO: CRIAÇÃO RÁPIDA DE NOVA CATEGORIA */}
      <Dialog open={isQuickCatOpen} onOpenChange={setIsQuickCatOpen}>
        <DialogContent className="max-w-sm w-[90vw] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Nova Categoria</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateQuickCategory} className="space-y-3 pt-1">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Nome da categoria</Label>
              <Input
                type="text"
                placeholder="Ex.: Padaria, Farmácia Pet, Streaming"
                value={quickCatName}
                onChange={(e) => setQuickCatName(e.target.value)}
                className="mt-1 text-xs"
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
                  <SelectTrigger className="mt-1 text-xs">
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
                  <SelectTrigger className="mt-1 text-xs">
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
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={quickCatSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {quickCatSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                <span>Salvar Categoria</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
