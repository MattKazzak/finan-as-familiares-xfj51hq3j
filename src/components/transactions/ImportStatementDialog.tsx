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
import { matchCategorization } from '@/services/import/categorization'
import { fetchCategorizationRules } from '@/services/categorization-rules'
import { createTransactionsBatch, fetchTransactions } from '@/services/transactions'
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
} from 'lucide-react'

export interface ReviewItem {
  id: string
  date: string
  description: string
  amount_cents: number
  type: TransactionType
  member_id: string
  category_id: string | null
  subcategory_id?: string | null
  isDuplicate: boolean
  duplicateReason?: string
  selected: boolean
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

      // 3. Montar itens para a tela de revisão aplicando categorização automática
      const activeMemberId = defaultMemberId || members[0]?.id || ''
      const reviewList: ReviewItem[] = result.transactions.map((tx: ParsedRawTransaction) => {
        // Encontrar categoria e subcategoria usando as regras da tabela categorization_rules
        const matchResult = matchCategorization(tx.description, tx.type, categories, loadedRules)

        // Checar duplicata
        const dupMatch = existingTxs.find((ex) => {
          return (
            ex.transaction_date === tx.date &&
            ex.amount_cents === tx.amount_cents &&
            isSimilar(ex.description, tx.description)
          )
        })

        return {
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount_cents: tx.amount_cents,
          type: tx.type,
          member_id: activeMemberId,
          category_id: matchResult ? matchResult.category.id : null,
          subcategory_id: matchResult?.subcategory ? matchResult.subcategory.id : null,
          isDuplicate: !!dupMatch,
          duplicateReason: dupMatch
            ? `Transação idêntica já cadastrada em ${dupMatch.transaction_date}`
            : undefined,
          // Se for duplicada, desmarcar por padrão para segurança do usuário
          selected: !dupMatch,
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
        return { ...item, [field]: value }
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
      const payloads = selectedItems.map((item) => ({
        family_id: family.id,
        member_id: item.member_id || members[0]?.id,
        category_id: item.category_id,
        subcategory_id: item.subcategory_id || null,
        type: item.type,
        amount_cents: item.amount_cents,
        description: item.description.trim() || 'Transação importada',
        transaction_date: item.date,
      }))
      await createTransactionsBatch(payloads)

      const pendingCount = selectedItems.filter((i) => !i.category_id).length
      const categorizedCount = selectedItems.length - pendingCount

      setLastImportSummary({
        total: selectedItems.length,
        categorized: categorizedCount,
        pending: pendingCount,
        importedAt: new Date(),
      })

      toast({
        title: 'Extrato importado com sucesso! 🎉',
        description: `${selectedItems.length} transações foram adicionadas à carteira da família.`,
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
                    {items.length} lançamentos válidos detectados
                  </span>

                  {/* Alerta de duplicatas */}
                  {duplicateCount > 0 && (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {duplicateCount} duplicata(s) detectada(s)
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

              {/* Lista Scrollável de Transações */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 border border-slate-200/80 rounded-2xl bg-white p-2">
                {items.map((item) => {
                  const isIncome = item.type === 'income'
                  const currentCategory = categories.find((c) => c.id === item.category_id)
                  const filteredCategories = categories.filter((c) => c.type === item.type)
                  const availableSubcategories = currentCategory?.subcategories || []

                  return (
                    <div
                      key={item.id}
                      className={`pt-2.5 pb-2.5 px-2.5 rounded-xl transition-colors ${
                        item.isDuplicate
                          ? 'bg-amber-50/50 border border-amber-200/60'
                          : item.selected
                            ? 'hover:bg-slate-50/80'
                            : 'opacity-60 bg-slate-50/50'
                      }`}
                    >
                      {/* ================= DESKTOP LAYOUT (md+): Linha Horizontal Completa e Espaçosa ================= */}
                      <div className="hidden md:flex items-center gap-3 w-full">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleToggleItem(item.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                        />

                        {/* Data */}
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => handleUpdateItemField(item.id, 'date', e.target.value)}
                          className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 shrink-0 w-32 focus:border-emerald-500 focus:outline-none"
                        />

                        {/* Toggle Receita / Despesa */}
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateItemField(item.id, 'type', isIncome ? 'expense' : 'income')
                          }
                          className={`text-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1 shrink-0 transition-colors ${
                            isIncome
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                          title="Alternar entre receita e despesa"
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

                        {/* Descrição editável (ocupa o espaço flexível) */}
                        <div className="flex-1 min-w-[180px] flex items-center gap-1.5">
                          <Input
                            value={item.description}
                            onChange={(e) =>
                              handleUpdateItemField(item.id, 'description', e.target.value)
                            }
                            className="h-8 text-xs font-semibold text-slate-800 bg-transparent border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:bg-white px-2 py-1 rounded-lg w-full"
                          />
                          {item.isDuplicate ? (
                            <span
                              title={item.duplicateReason}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200 shrink-0"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span className="hidden lg:inline">Possível Duplicada</span>
                            </span>
                          ) : null}
                          {!item.category_id ? (
                            <span
                              title="Transação sem match de regra. Você pode definir a categoria agora ou depois na Carteira."
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80 shrink-0"
                            >
                              <span className="hidden lg:inline">Pendente de categoria</span>
                              <span className="lg:hidden">Pendente</span>
                            </span>
                          ) : null}
                        </div>

                        {/* Membro */}
                        <div className="shrink-0">
                          <Select
                            value={item.member_id}
                            onValueChange={(val) =>
                              handleUpdateItemField(item.id, 'member_id', val)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs w-28 lg:w-32 rounded-lg bg-white border-slate-200">
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

                        {/* Categoria */}
                        <div className="shrink-0">
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
                            <SelectTrigger className="h-8 text-xs w-36 lg:w-44 rounded-lg bg-white border-slate-200">
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
                            <SelectContent>
                              <SelectItem value="none" className="text-xs text-slate-500">
                                Sem categoria
                              </SelectItem>
                              {filteredCategories.map((c) => (
                                <SelectItem key={c.id} value={c.id} className="text-xs">
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
                        <div className="shrink-0 w-32 lg:w-36">
                          {availableSubcategories.length > 0 ? (
                            <Select
                              value={item.subcategory_id || 'none'}
                              onValueChange={(val) =>
                                handleUpdateItemField(
                                  item.id,
                                  'subcategory_id',
                                  val === 'none' ? null : val,
                                )
                              }
                            >
                              <SelectTrigger className="h-8 text-xs w-full rounded-lg bg-white border-slate-200">
                                <SelectValue placeholder="Subcategoria" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs text-slate-500">
                                  Sem subcat.
                                </SelectItem>
                                {availableSubcategories.map((sub) => (
                                  <SelectItem key={sub.id} value={sub.id} className="text-xs">
                                    {sub.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-[11px] text-slate-400 block px-2 italic truncate">
                              Sem subcat.
                            </span>
                          )}
                        </div>

                        {/* Valor */}
                        <div className="text-right min-w-[100px] shrink-0">
                          <span
                            className={`font-bold text-sm tabular-nums ${
                              isIncome ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {isIncome ? '+' : '−'} {formatBRL(item.amount_cents)}
                          </span>
                        </div>

                        {/* Remover */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                          title="Remover linha"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* ================= MOBILE LAYOUT (<md): Bloco empilhado confortável ================= */}
                      <div className="flex md:hidden flex-col gap-2.5">
                        {/* Linha 1: Checkbox + Descrição + Valor */}
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleItem(item.id)}
                            className="mt-1.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <Input
                              value={item.description}
                              onChange={(e) =>
                                handleUpdateItemField(item.id, 'description', e.target.value)
                              }
                              className="h-8 text-xs font-semibold text-slate-800 bg-white border-slate-200 focus:border-emerald-500 px-2 rounded-lg w-full"
                            />
                          </div>
                          <div className="text-right shrink-0 pt-1">
                            <span
                              className={`font-bold text-xs tabular-nums ${
                                isIncome ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              {isIncome ? '+' : '−'} {formatBRL(item.amount_cents)}
                            </span>
                          </div>
                        </div>

                        {/* Badges de duplicata e categoria pendente se aplicável */}
                        {(item.isDuplicate || !item.category_id) && (
                          <div className="flex items-center gap-1.5 flex-wrap pl-6">
                            {item.isDuplicate ? (
                              <span
                                title={item.duplicateReason}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Possível Duplicada</span>
                              </span>
                            ) : null}
                            {!item.category_id ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80">
                                <span>Pendente de categoria</span>
                              </span>
                            ) : null}
                          </div>
                        )}

                        {/* Linha 2: Data + Tipo (Receita/Despesa) + Membro */}
                        <div className="flex items-center gap-2 pl-6 flex-wrap">
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) => handleUpdateItemField(item.id, 'date', e.target.value)}
                            className="text-[11px] text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 flex-1 min-w-[120px]"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateItemField(
                                item.id,
                                'type',
                                isIncome ? 'expense' : 'income',
                              )
                            }
                            className={`text-[11px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1 shrink-0 ${
                              isIncome
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {isIncome ? (
                              <>
                                <ArrowUpRight className="w-3 h-3" /> Receita
                              </>
                            ) : (
                              <>
                                <ArrowDownRight className="w-3 h-3" /> Despesa
                              </>
                            )}
                          </button>

                          <Select
                            value={item.member_id}
                            onValueChange={(val) =>
                              handleUpdateItemField(item.id, 'member_id', val)
                            }
                          >
                            <SelectTrigger className="h-7 text-xs w-28 rounded-lg bg-white border-slate-200 shrink-0">
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

                        {/* Linha 3: Categoria + Subcategoria + Excluir */}
                        <div className="flex items-center gap-2 pl-6">
                          <div className="flex-1 min-w-0">
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
                              <SelectTrigger className="h-8 text-xs w-full rounded-lg bg-white border-slate-200">
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
                              <SelectContent>
                                <SelectItem value="none" className="text-xs text-slate-500">
                                  Sem categoria
                                </SelectItem>
                                {filteredCategories.map((c) => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">
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

                          {availableSubcategories.length > 0 ? (
                            <div className="w-32 shrink-0">
                              <Select
                                value={item.subcategory_id || 'none'}
                                onValueChange={(val) =>
                                  handleUpdateItemField(
                                    item.id,
                                    'subcategory_id',
                                    val === 'none' ? null : val,
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 text-xs w-full rounded-lg bg-white border-slate-200">
                                  <SelectValue placeholder="Subcategoria" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none" className="text-xs text-slate-500">
                                    Sem subcat.
                                  </SelectItem>
                                  {availableSubcategories.map((sub) => (
                                    <SelectItem key={sub.id} value={sub.id} className="text-xs">
                                      {sub.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                            title="Remover linha"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
