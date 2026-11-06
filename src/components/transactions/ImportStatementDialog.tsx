// Componente completo de Importação de Extrato Bancário em formato OFX
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
import { useNavigate, useLocation } from 'react-router-dom'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useImportSession } from '@/contexts/ImportSessionContext'
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
  extractLearningPattern,
  normalizeText,
} from '@/services/import/categorization'
import { cleanMerchantDescription } from '@/services/import/merchant-cleaner'
import { resolveBrazilianMerchantSeed } from '@/services/import/brazilian-seeds'
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
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
  Star,
  ExternalLink,
  Maximize2,
  Minimize2,
  Tag,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  RotateCcw,
  Link2,
} from 'lucide-react'

import {
  parseInstallmentFromDescription,
  generateInstallmentTransactions,
  cleanInstallmentBaseDescription,
  type ParsedInstallmentInfo,
} from '@/services/installments'
import { findReconciliationMatch, type MatchStatus } from '@/services/import/reconciliation'
import {
  categorizeBatchWithAI,
  parsePdfWithAI,
  type AiPdfTransactionItem,
} from '@/services/ai-categorizer'
import {
  extractRawTextFromPdf,
  generatePdfFitid,
  isPdfPasswordError,
  classifyPdfPasswordError,
  deduplicateExtractedTransactions,
  isDeterministicNonExpense,
  isNonTransactionLine,
  type ExtractedPdfTextResult,
} from '@/services/import/pdf-parser'

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
  source?: 'database_rule' | 'fallback_rule' | 'name_match' | 'ai_suggestion' | 'manual'
  aiReasoning?: string
  aiConfidence?: number
  isUncertain?: boolean // Confiança abaixo de CONFIDENCE_THRESHOLD (0.6)
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
  // Filtro determinístico pós-IA (quitação de fatura anterior, ajuste, encargos, IOF)
  isNonExpense?: boolean
  isPossibleDuplicate?: boolean
  userNote?: string
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
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const { family, members, categories, addNewCategory, triggerRefresh, setLastImportSummary } =
    useFamily()
  const { toast } = useToast()
  const { setImportSession } = useImportSession()

  // Estados do fluxo
  const [step, setStep] = useState<'upload' | 'review'>('upload')
  const [parsing, setParsing] = useState(false)
  const [isAiCategorizing, setIsAiCategorizing] = useState(false)
  const [extractionProgress, setExtractionProgress] = useState<string>('')
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<ParseDiagnostics | null>(null)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; format: string } | null>(
    null,
  )
  const [ignoredLines, setIgnoredLines] = useState<IgnoredLineInfo[]>([])
  const [showIgnoredLines, setShowIgnoredLines] = useState(false)
  const [fileWarnings, setFileWarnings] = useState<string[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  // Estados para PDF protegido por senha (em memória, nunca persistidos)
  const [isPasswordProtected, setIsPasswordProtected] = useState(false)
  const [pdfPassword, setPdfPassword] = useState('')
  const [showPdfPassword, setShowPdfPassword] = useState(false)
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Validação de fechamento (total declarado vs soma dos lançamentos)
  const [declaredTotalCents, setDeclaredTotalCents] = useState<number | null>(null)
  const [failedPages, setFailedPages] = useState<number[]>([])
  const [currentFile, setCurrentFile] = useState<File | null>(null)

  // Itens em revisão
  const [items, setItems] = useState<ReviewItem[]>([])
  const [defaultMemberId, setDefaultMemberId] = useState<string>('')
  const [categorizationRules, setCategorizationRules] = useState<CategorizationRule[]>([])
  // Accordion na revisão do extrato: ID do item atualmente expandido (null = todos recolhidos)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  // Estado para edição rápida de categoria e modal secundário de detalhes adicionais
  const [categoryPickerItemId, setCategoryPickerItemId] = useState<string | null>(null)
  const [detailModalItemId, setDetailModalItemId] = useState<string | null>(null)

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

  // Resetar ao fechar ou cancelar
  const resetPasswordState = () => {
    setIsPasswordProtected(false)
    setPdfPassword('')
    setShowPdfPassword(false)
    setPendingPdfFile(null)
    setPasswordError(null)
  }

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Guarda: se algum seletor secundário estiver aberto, fecha apenas ele e preserva a importação pai
      if (categoryPickerItemId || detailModalItemId || isQuickCatOpen) {
        setCategoryPickerItemId(null)
        setDetailModalItemId(null)
        setIsQuickCatOpen(false)
        return
      }

      setStep('upload')
      setItems([])
      setExpandedItemId(null)
      setCategoryPickerItemId(null)
      setDetailModalItemId(null)
      setErrorMessage(null)
      setDiagnostics(null)
      setFileInfo(null)
      setIgnoredLines([])
      setShowIgnoredLines(false)
      setFileWarnings([])
      setIsQuickCatOpen(false)
      setIsExpanded(false)
      setExtractionProgress('')
      setDeclaredTotalCents(null)
      setFailedPages([])
      setCurrentFile(null)
      resetPasswordState()
    }
    onOpenChange(isOpen)
  }

  // Processamento do arquivo enviado (com suporte opcional a senha do PDF)
  const handleProcessFile = async (file: File, explicitPassword?: string) => {
    if (!family) {
      setErrorMessage('Nenhuma família ativa identificada.')
      return
    }

    setParsing(true)
    setErrorMessage(null)
    setDiagnostics(null)
    setPasswordError(null)
    setExtractionProgress('')
    setDeclaredTotalCents(null)
    setFailedPages([])
    setCurrentFile(file)

    const isPdf = file.name.toLowerCase().endsWith('.pdf')
    const isOfx = file.name.toLowerCase().endsWith('.ofx')

    try {
      // Carregar dados de conciliação do banco (transações e regras existentes da família)
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

      const isSimilar = (a: string, b: string) => {
        const normA = (a || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const normB = (b || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        if (normA === normB) return true
        if (normA.includes(normB) || normB.includes(normA)) return true
        return false
      }

      const activeMemberId = defaultMemberId || members[0]?.id || ''
      const claimedManualIds = new Set<string>()

      // =========================================================================
      // FLUXO A: FATURA DE CARTÃO EM PDF VIA IA ESPECIALIZADA (batch-categorize)
      // "IA À PROVA DE FALHAS": Extração por blocos/páginas paralelas + dedup +
      // validação de fechamento + filtro determinístico pós-IA
      // =========================================================================
      if (isPdf) {
        setIsAiCategorizing(false)
        setExtractionProgress('Lendo páginas do documento PDF...')

        // 1. Extração pura de texto bruto por páginas com pdfjs-dist (com senha opcional)
        let extractedPdf: ExtractedPdfTextResult
        try {
          extractedPdf = await extractRawTextFromPdf(file, {
            password: explicitPassword || (isPasswordProtected ? pdfPassword : ''),
          })
          // Sucesso na extração: limpar estado de bloqueio por senha
          setIsPasswordProtected(false)
          setPasswordError(null)
          setPendingPdfFile(null)
          setPdfPassword('')
        } catch (pdfErr: any) {
          if (isPdfPasswordError(pdfErr)) {
            const classified = classifyPdfPasswordError(
              pdfErr,
              Boolean(explicitPassword || pdfPassword),
            )
            setIsPasswordProtected(true)
            setPendingPdfFile(file)

            if (classified.kind === 'INCORRECT_PASSWORD') {
              setPasswordError('Senha incorreta. Tente novamente.')
              setErrorMessage('Senha incorreta. Tente novamente.')
            } else {
              setPasswordError(null)
              setErrorMessage(
                'Esta fatura é protegida por senha. Digite a senha do PDF abaixo para continuar a importação.',
              )
            }
            return
          }

          throw new Error(
            pdfErr?.message || 'Não foi possível extrair o texto da fatura em PDF selecionada.',
          )
        }

        const validPages = (extractedPdf.pages || []).filter(
          (p) => p.text && p.text.trim().length > 0,
        )
        if (validPages.length === 0 && (!extractedPdf.rawText || !extractedPdf.rawText.trim())) {
          throw new Error(
            'Não conseguimos identificar o texto desta fatura. Se ela foi gerada como imagem pelo seu banco, experimente baixar o extrato pelo computador ou importar o arquivo OFX/CSV.',
          )
        }

        setIsAiCategorizing(true)
        const totalPages = validPages.length > 0 ? validPages.length : 1

        setExtractionProgress(
          totalPages === 1
            ? 'Identificando lançamentos com IA (GPT-4o mini)...'
            : `Lendo ${totalPages} páginas em paralelo...`,
        )

        // 2. Extração em blocos em chamadas PARALELAS (requisito de performance acordado)
        // Rastrear progresso por página concluída para feedback dinâmico
        let completedChunks = 0
        const updateChunkProgress = () => {
          completedChunks++
          if (totalPages > 1) {
            if (completedChunks < totalPages) {
              setExtractionProgress(
                `Lendo página ${completedChunks + 1} de ${totalPages} e identificando lançamentos...`,
              )
            } else {
              setExtractionProgress('Categorizando lançamentos e conferindo fechamento...')
            }
          } else {
            setExtractionProgress('Categorizando lançamentos e conferindo fechamento...')
          }
        }

        // 2. Extração com pool de concorrência máxima de 2 páginas simultâneas
        // Evita estourar rate limit da OpenAI mantendo paralelismo parcial
        interface PageTask {
          pageNumber: number
          text: string
        }

        const tasks: PageTask[] =
          validPages.length > 0
            ? validPages.map((p, idx) => ({
                pageNumber: p.pageNumber || idx + 1,
                text: p.text,
              }))
            : [{ pageNumber: 1, text: extractedPdf.rawText || '' }]

        interface PageExecutionResult {
          pageNumber: number
          res: any
        }

        const pageResults: PageExecutionResult[] = []
        const CONCURRENCY_LIMIT = 2
        let taskIndex = 0

        async function worker() {
          while (taskIndex < tasks.length) {
            const currentTaskIdx = taskIndex++
            const currentTask = tasks[currentTaskIdx]
            try {
              const res = await parsePdfWithAI(currentTask.text, family.id)
              updateChunkProgress()
              pageResults.push({ pageNumber: currentTask.pageNumber, res })
            } catch (err: any) {
              updateChunkProgress()
              pageResults.push({
                pageNumber: currentTask.pageNumber,
                res: {
                  success: false,
                  transactions: [],
                  declaredTotalCents: null,
                  error: err?.message,
                },
              })
            }
          }
        }

        const workerCount = Math.min(CONCURRENCY_LIMIT, tasks.length)
        const workers = Array.from({ length: workerCount }, () => worker())
        await Promise.all(workers)

        setExtractionProgress('Mesclando resultados e validando lançamentos...')

        // 3. Mesclar resultados e capturar total declarado (se identificável em alguma página)
        const allExtractedTransactions: AiPdfTransactionItem[] = []
        let identifiedDeclaredTotal: number | null = null
        const currentFailedPages: number[] = []

        // Ordenar os resultados por número de página original
        pageResults.sort((a, b) => a.pageNumber - b.pageNumber)

        for (const item of pageResults) {
          const res = item.res
          const hasTx = res && Array.isArray(res.transactions) && res.transactions.length > 0
          if (hasTx) {
            allExtractedTransactions.push(...res.transactions)
          } else if (!res?.success) {
            currentFailedPages.push(item.pageNumber)
          }

          if (
            typeof res?.declaredTotalCents === 'number' &&
            res.declaredTotalCents > 0 &&
            !identifiedDeclaredTotal
          ) {
            identifiedDeclaredTotal = res.declaredTotalCents
          }
        }

        // Se TODAS as páginas falharem e não houver nenhuma transação
        if (allExtractedTransactions.length === 0) {
          const firstError = pageResults.find((r) => r.res?.error)?.res?.error
          throw new Error(
            firstError ||
              'Tivemos uma instabilidade temporária ao comunicar com a inteligência de leitura da fatura. Tente novamente em instantes.',
          )
        }

        // Se algumas páginas falharam mas outras tiveram transações: salva failedPages para o aviso na revisão
        setFailedPages(currentFailedPages)

        // 4. Deduplicação entre blocos/páginas (mesma data + descrição normalizada + valor)
        // com descarte sumário adicional de qualquer linha de resumo / cabeçalho / não-transação
        const deduplicatedTransactions = deduplicateExtractedTransactions(
          allExtractedTransactions,
        ).filter(
          (tx) =>
            !isNonTransactionLine(tx.description) && !isNonTransactionLine(tx.cleanMerchant || ''),
        )

        setDeclaredTotalCents(identifiedDeclaredTotal)
        setFileInfo({
          name: file.name,
          size: file.size,
          format: 'PDF (FATURA)',
        })
        setIgnoredLines([])
        setFileWarnings([])

        // 5. Montar itens para a tela de revisão aplicando filtro determinístico pós-IA
        const reviewList: ReviewItem[] = deduplicatedTransactions.map(
          (tx: AiPdfTransactionItem, idx: number) => {
            const description = tx.cleanMerchant || tx.description
            const amountCents = tx.amountCents
            const date = tx.date
            const txType: TransactionType = tx.type === 'income' ? 'income' : 'expense'
            const fitid = generatePdfFitid(date, description, amountCents)
            const txId = `pdf-${idx}-${Date.now()}`

            // Filtro determinístico pós-IA (em código): linhas de pagamento/ajuste/encargo/IOF
            // Marcadas como isNonExpense = true e DESMARCADAS por padrão
            const isNonExpense =
              isNonTransactionLine(tx.description) ||
              isNonTransactionLine(tx.cleanMerchant || '') ||
              isDeterministicNonExpense(tx.description) ||
              isDeterministicNonExpense(tx.cleanMerchant)

            // 1ª camada: verificar se existe regra prévia no banco
            const ruleMatch = matchCategorization(description, txType, categories, loadedRules)

            // Camada Determinística Rápida 2: Seed Brasileiro em código
            const seedMatch =
              !ruleMatch && txType === 'expense'
                ? resolveBrazilianMerchantSeed(description, categories) ||
                  (tx.description ? resolveBrazilianMerchantSeed(tx.description, categories) : null)
                : null

            // Categoria final: regra do banco tem prioridade máxima (1ª camada),
            // seguida pelo Seed Brasileiro (2ª camada), senão sugestão da IA (3ª camada)
            let finalCatId: string | null = null
            let finalSubId: string | null = null
            let source: ReviewItem['source'] = 'ai_suggestion'

            if (ruleMatch) {
              finalCatId = ruleMatch.category.id
              finalSubId = ruleMatch.subcategory?.id || null
              source = ruleMatch.source || 'database_rule'
            } else if (seedMatch) {
              finalCatId = seedMatch.categoryId
              finalSubId = seedMatch.subcategoryId || null
              source = 'fallback_rule'
            } else if (tx.categoryId && categories.some((c) => c.id === tx.categoryId)) {
              finalCatId = tx.categoryId
              finalSubId = tx.subcategoryId || null
              source = 'ai_suggestion'
            }

            // Parcelas
            const instInfo = parseInstallmentFromDescription(
              tx.installment ? `${description} ${tx.installment}` : description,
            )
            const isInstallment = instInfo.isInstallment && txType === 'expense'
            const currentInst = isInstallment ? instInfo.current : 1
            const totalInst = isInstallment ? instInfo.total : 1

            // Anti-duplicidade e projeções
            let matchedProjectId: string | null = null
            let matchedGroupId: string | null = null
            let dupMatch: Transaction | undefined = undefined
            const txMonth = date.slice(0, 7)

            if (isInstallment) {
              const matchingProjection = existingTxs.find((ex) => {
                const exMonth = ex.transaction_date?.slice(0, 7)
                const sameMonth = exMonth === txMonth
                const sameAmount = ex.amount_cents === amountCents
                const sameInstNum =
                  ex.installment_number === currentInst ||
                  (ex.description && ex.description.includes(`${currentInst}/${totalInst}`))
                const descMatch =
                  isSimilar(ex.description || '', instInfo.cleanDescription) ||
                  isSimilar(ex.description || '', description)
                return (
                  ex.status === 'projected' && sameMonth && sameAmount && (sameInstNum || descMatch)
                )
              })

              if (matchingProjection) {
                matchedProjectId = matchingProjection.id
                matchedGroupId = matchingProjection.installment_group_id || null
              }

              dupMatch = existingTxs.find((ex) => {
                const exMonth = ex.transaction_date?.slice(0, 7)
                const sameMonth = exMonth === txMonth
                const sameAmount = ex.amount_cents === amountCents
                const sameGroup =
                  matchedGroupId && ex.installment_group_id
                    ? ex.installment_group_id === matchedGroupId
                    : false
                const descMatch = isSimilar(ex.description || '', description)
                return (
                  ex.status !== 'projected' && sameMonth && sameAmount && (sameGroup || descMatch)
                )
              })
            } else {
              dupMatch = existingTxs.find((ex) => {
                if (fitid && ex.bank_transaction_id && ex.bank_transaction_id === fitid) {
                  return true
                }
                return (
                  ex.transaction_date === date &&
                  ex.amount_cents === amountCents &&
                  ex.bank_transaction_id &&
                  isSimilar(ex.description || '', description)
                )
              })
            }

            // Conciliação inteligente com lançamento manual
            let isReconciledManual = false
            let matchedManualTransaction: Transaction | null = null
            let reconciliationCandidates: Transaction[] = []
            let reconciliationReason: string | undefined = undefined
            let reconciliationStatus: MatchStatus = 'unmatched'

            if (!dupMatch && !matchedProjectId) {
              const reconMatch = findReconciliationMatch(
                {
                  id: txId,
                  date,
                  amount_cents: amountCents,
                  type: txType,
                  description,
                  fitid,
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

            const isFirstInstallment = isInstallment && currentInst === 1 && totalInst > 1
            const initialCat =
              isReconciledManual && matchedManualTransaction?.category_id
                ? matchedManualTransaction.category_id
                : finalCatId
            const initialSub =
              isReconciledManual && matchedManualTransaction
                ? matchedManualTransaction.subcategory_id || null
                : finalSubId
            const initialMem =
              isReconciledManual && matchedManualTransaction?.member_id
                ? matchedManualTransaction.member_id
                : activeMemberId

            // Itens com flag "não é despesa" vêm DESMARCADOS por padrão
            const isSelected = !dupMatch && !isNonExpense

            return {
              id: txId,
              date,
              description,
              amount_cents: amountCents,
              type: txType,
              fitid,
              member_id: initialMem,
              category_id: initialCat,
              subcategory_id: initialSub,
              rememberRule: !!initialCat,
              source: isReconciledManual ? 'manual' : source,
              aiReasoning: isNonExpense
                ? 'Identificado como quitação, ajuste ou encargo (não é despesa nova)'
                : 'Extraído e classificado pela IA financeira do Curiangoo',
              aiConfidence: tx.confidence,
              isUncertain: typeof tx.confidence === 'number' && tx.confidence < 0.6,
              isDuplicate: !!dupMatch || !!(tx as any).isPossibleDuplicate,
              isPossibleDuplicate: !!(tx as any).isPossibleDuplicate,
              duplicateReason: dupMatch
                ? `Transação idêntica já cadastrada em ${dupMatch.transaction_date}`
                : (tx as any).duplicateReason,
              isInstallment,
              installmentCurrent: currentInst,
              installmentTotal: totalInst,
              matchedProjectId,
              matchedGroupId,
              generateFutureInstallments: isFirstInstallment,
              selected: isSelected,
              isReconciledManual,
              matchedManualTransaction,
              reconciliationStatus,
              reconciliationCandidates,
              reconciliationReason,
              isNonExpense,
            }
          },
        )

        setItems(reviewList)
        setStep('review')
        return
      }

      // =========================================================================
      // FLUXO B: EXTRATO BANCÁRIO OFX (Parser XML local rápido + IA para resto)
      // =========================================================================
      const result = await parseStatementFile(file)
      if (!result.success || result.transactions.length === 0) {
        setErrorMessage(
          result.error ||
            'Não foram encontradas transações válidas no arquivo OFX. Verifique se o arquivo foi exportado corretamente do seu banco.',
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

      const reviewList: ReviewItem[] = result.transactions.map((tx: ParsedRawTransaction) => {
        // Higienizar descrição para match mais assertivo
        const cleanedDesc = cleanMerchantDescription(tx.description)
        const matchResult =
          matchCategorization(tx.description, tx.type, categories, loadedRules) ||
          (cleanedDesc ? matchCategorization(cleanedDesc, tx.type, categories, loadedRules) : null)

        // Camada determinística 2: Seed Brasileiro
        const seedResult =
          !matchResult && tx.type === 'expense'
            ? resolveBrazilianMerchantSeed(tx.description, categories) ||
              (cleanedDesc ? resolveBrazilianMerchantSeed(cleanedDesc, categories) : null)
            : null

        const instInfo = tx.installmentInfo || parseInstallmentFromDescription(tx.description)
        const isInstallment = instInfo.isInstallment && tx.type === 'expense'
        const currentInst = isInstallment ? instInfo.current : 1
        const totalInst = isInstallment ? instInfo.total : 1

        let matchedProjectId: string | null = null
        let matchedGroupId: string | null = null
        let dupMatch: Transaction | undefined = undefined
        const txMonth = tx.date.slice(0, 7)

        if (isInstallment) {
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
          dupMatch = existingTxs.find((ex) => {
            if (tx.fitid && ex.bank_transaction_id && ex.bank_transaction_id === tx.fitid) {
              return true
            }
            return (
              ex.transaction_date === tx.date &&
              ex.amount_cents === tx.amount_cents &&
              ex.bank_transaction_id &&
              isSimilar(ex.description || '', tx.description)
            )
          })
        }

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

        const isFirstInstallment = isInstallment && currentInst === 1 && totalInst > 1
        let duplicateReason: string | undefined = undefined
        if (dupMatch) {
          duplicateReason = `Transação idêntica já cadastrada em ${dupMatch.transaction_date}`
        }

        const initialCategoryId =
          isReconciledManual && matchedManualTransaction?.category_id
            ? matchedManualTransaction.category_id
            : matchResult
              ? matchResult.category.id
              : seedResult
                ? seedResult.categoryId
                : null

        const initialSubcategoryId =
          isReconciledManual && matchedManualTransaction
            ? matchedManualTransaction.subcategory_id || null
            : matchResult?.subcategory
              ? matchResult.subcategory.id
              : seedResult
                ? seedResult.subcategoryId
                : null

        const initialMemberId =
          isReconciledManual && matchedManualTransaction?.member_id
            ? matchedManualTransaction.member_id
            : activeMemberId

        const initialSource = isReconciledManual
          ? 'manual'
          : matchResult?.source || (seedResult ? 'fallback_rule' : undefined)

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
          source: initialSource,
          isDuplicate: !!dupMatch,
          duplicateReason,
          isInstallment,
          installmentCurrent: currentInst,
          installmentTotal: totalInst,
          matchedProjectId,
          matchedGroupId,
          generateFutureInstallments: isFirstInstallment,
          selected: !dupMatch,
          isReconciledManual,
          matchedManualTransaction,
          reconciliationStatus,
          reconciliationCandidates,
          reconciliationReason,
        }
      })

      // Se houver transações sem categoria (não resolvidas por regra nem pelo Seed Brasileiro), aciona a IA
      const uncategorizedItems = reviewList.filter((item) => !item.category_id && !item.isDuplicate)
      if (uncategorizedItems.length > 0) {
        setIsAiCategorizing(true)
        try {
          const aiPayload = uncategorizedItems.map((item) => ({
            tempId: item.id,
            description: item.description,
            amountCents: item.amount_cents,
            date: item.date,
          }))

          const validCategoryIds = new Set(categories.map((c) => c.id))
          const aiSuggestions = await categorizeBatchWithAI(aiPayload, family.id, {
            validCategoryIds,
          })
          if (aiSuggestions && aiSuggestions.length > 0) {
            const suggestionMap = new Map<string, (typeof aiSuggestions)[0]>()
            aiSuggestions.forEach((s) => suggestionMap.set(s.tempId, s))

            reviewList.forEach((item) => {
              const sug = suggestionMap.get(item.id)
              if (sug) {
                const catExists = sug.categoryId ? validCategoryIds.has(sug.categoryId) : false
                const isLowConfidence = typeof sug.confidence === 'number' && sug.confidence < 0.6
                if (sug.categoryId && catExists) {
                  item.category_id = sug.categoryId
                  item.subcategory_id = sug.subcategoryId || null
                  item.source = 'ai_suggestion'
                  item.aiConfidence = sug.confidence
                  item.aiReasoning = sug.reasoning
                  item.rememberRule = true
                  item.isUncertain = isLowConfidence
                } else {
                  // ID inválido ou needsReview -> null + needsReview. Nunca aplica categoria inexistente.
                  item.category_id = null
                  item.subcategory_id = null
                  item.source = 'ai_suggestion'
                  item.aiConfidence = sug.confidence
                  item.aiReasoning = sug.reasoning || 'Pendente de categorização pelo usuário'
                  item.isUncertain = true
                }
              }
            })
          }
        } catch (aiErr) {
          console.warn('Falha graciosa na categorização por IA do extrato:', aiErr)
        } finally {
          setIsAiCategorizing(false)
        }
      }

      setItems(reviewList)

      // Encaminha para a nova rota dedicada /importar (item 1 do plano)
      const currentFileInfo = {
        name: file.name,
        size: file.size,
        format: isPdf ? 'Fatura PDF' : 'Extrato OFX',
      }

      setImportSession({
        items: reviewList,
        fileInfo: currentFileInfo,
        declaredTotalCents,
        failedPages,
        sourceRoute: location.pathname || '/carteira',
      })

      // Fecha o modal de upload e navega para /importar
      handleDialogChange(false)
      navigate('/importar')
      return
    } catch (err: any) {
      console.error('Erro na importação:', err)
      setErrorMessage(err?.message || 'Erro inesperado ao processar o extrato.')
    } finally {
      setParsing(false)
      setIsAiCategorizing(false)
    }
  }

  const validateAndProcessFile = (file: File) => {
    // Ao iniciar novo arquivo, limpa qualquer estado anterior de senha
    resetPasswordState()

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (ext !== 'ofx' && ext !== 'pdf') {
      if (ext === 'csv') {
        setErrorMessage(
          'O formato .CSV não é aceito. Suportamos extratos em formato .OFX e faturas de cartão de crédito em .PDF (Nubank, Inter, C6, Itaú, Santander, etc.).',
        )
      } else {
        setErrorMessage(
          'Formato não suportado. Por favor, selecione um arquivo .OFX ou uma fatura em .PDF gerada pelo seu banco.',
        )
      }
      return
    }
    handleProcessFile(file)
  }

  // Submissão da senha da fatura protegida
  const handleSubmitPdfPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!pendingPdfFile) return
    if (!pdfPassword.trim()) {
      setPasswordError('Informe a senha do PDF para continuar.')
      return
    }
    setPasswordError(null)
    await handleProcessFile(pendingPdfFile, pdfPassword)
  }

  // Cancelar desbloqueio e voltar ao estado normal de envio
  const handleCancelPasswordPrompt = () => {
    resetPasswordState()
    setErrorMessage(null)
    setDiagnostics(null)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndProcessFile(file)
    }
    // Limpar o valor do input para permitir selecionar novamente o mesmo arquivo se necessário
    if (e.target) {
      e.target.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      validateAndProcessFile(file)
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

  const handleUpdateItemField = <K extends keyof ReviewItem>(
    id: string,
    field: K,
    value: ReviewItem[K],
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const updated = { ...item, [field]: value }
        // Se a categoria mudou e a subcategoria atual não pertence a ela, limpa a subcategoria
        if (field === 'category_id') {
          if (!value) {
            updated.subcategory_id = null
            updated.rememberRule = false
            updated.source = undefined
          } else {
            const cat = categories.find((c) => c.id === value)
            const validSub = cat?.subcategories?.some((s) => s.id === item.subcategory_id)
            if (!validSub) {
              updated.subcategory_id = null
            }
            if (item.rememberRule === undefined) {
              updated.rememberRule = true
            }
            // Se o usuário confirmou/editou manualmente, marcar a fonte
            if (item.source !== 'ai_suggestion') {
              updated.source = 'manual'
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
  const nonExpenseCount = useMemo(() => items.filter((i) => i.isNonExpense).length, [items])
  const mergedCount = useMemo(() => items.filter((i) => i.isReconciledManual).length, [items])
  const multipleCandidatesCount = useMemo(
    () => items.filter((i) => i.reconciliationStatus === 'multiple_candidates').length,
    [items],
  )
  const uncategorizedCount = useMemo(() => items.filter((i) => !i.category_id).length, [items])
  const totalAmountSelected = useMemo(() => {
    let inc = 0
    let exp = 0
    let gross = 0
    items
      .filter((i) => i.selected)
      .forEach((i) => {
        if (i.type === 'income') {
          if (!i.isNonExpense) inc += i.amount_cents
        } else {
          gross += i.amount_cents
          if (!i.isNonExpense) exp += i.amount_cents
        }
      })
    return { inc, exp, gross }
  }, [items])

  // Validação de fechamento da fatura:
  // Compara a soma líquida de todas as compras e estornos extraídos de todos os blocos/cartões
  // com o valor total devido da fatura declarado no cabeçalho.
  // Em faturas com estornos reais (type='income' e não marcados como quitação), o total devido da fatura
  // é despesas menos estornos (ou a soma de despesas se não houver estornos).
  // Tolerância de fechamento: ±R$ 0,05 (5 centavos).
  const closingValidation = useMemo(() => {
    if (!declaredTotalCents || declaredTotalCents <= 0) {
      return null
    }

    // Itens legítimos do mês (excluindo linhas de quitação de fatura/limites marcadas como isNonExpense)
    const validExpenseItems = items.filter((i) => i.type === 'expense' && !i.isNonExpense)
    const validIncomeReversals = items.filter((i) => i.type === 'income' && !i.isNonExpense)

    const expensesSum = validExpenseItems.reduce((acc, curr) => acc + curr.amount_cents, 0)
    const reversalsSum = validIncomeReversals.reduce((acc, curr) => acc + curr.amount_cents, 0)

    // Saldo líquido devido: despesas menos estornos legítimos
    const netSum = expensesSum - reversalsSum

    // Avalia fechamento tanto pelo líquido (quando há estornos legítimos) quanto pela soma bruta de despesas
    const diffNet = Math.abs(netSum - declaredTotalCents)
    const diffGross = Math.abs(expensesSum - declaredTotalCents)
    const diffCents = Math.min(diffNet, diffGross)
    const matches = diffCents <= 5 // tolerância de ±5 centavos (R$ 0,05)

    if (!matches) {
      console.info(
        `[ImportStatement] Divergência residual na conciliação da fatura: soma=${netSum} / despesas=${expensesSum} vs declarado=${declaredTotalCents} (dif=${diffCents} centavos).`,
      )
    }

    return {
      declaredTotalCents,
      expensesSumCents: diffNet < diffGross && reversalsSum > 0 ? netSum : expensesSum,
      diffCents,
      matches,
      itemCount: validExpenseItems.length + validIncomeReversals.length,
    }
  }, [items, declaredTotalCents])

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
        payload: Parameters<typeof updateTransaction>[1]
      }> = []

      const toUpdateManualMerges: Array<{
        id: string
        payload: Parameters<typeof updateTransaction>[1]
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
            aiConfidence: resolvedAiConfidence,
          })

          toCreatePayloads.push(...gen.transactions)
        } else if (item.isInstallment) {
          // Parcela avulsa ou intermediária sem projeção correspondente
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

      // Executa updates (projeções e mesclas manuais) e criações em lote
      await Promise.all([
        ...toUpdateManualMerges.map((up) => updateTransaction(up.id, up.payload)),
        ...toUpdateProjections.map((up) => updateTransaction(up.id, up.payload)),
        createTransactionsBatch(toCreatePayloads),
      ])

      // Loop de Aprendizado (Parte 5):
      // Salva regra na tabela categorization_rules quando a categoria difere da sugestão da IA,
      // ou item estava sem categoria/needsReview, ou rememberRule está ativo.
      // Usa até 3 palavras significativas limpas, lowercase, sem acentos.
      // Não sobrescreve regras existentes do usuário silenciosamente.
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
      }

      if (pendingConflicts.length > 0) {
        setConflictingRules(pendingConflicts)
        setConflictModalOpen(true)
        return
      }

      finishDialogImportSuccess(
        selectedItems.length,
        toUpdateManualMerges.length,
        toUpdateProjections.length,
      )
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

  const finishDialogImportSuccess = (
    totalCount: number,
    manualMergesCount: number = 0,
    projectionsCount: number = 0,
  ) => {
    const pendingCount = items.filter((i) => i.selected && !i.category_id).length
    const categorizedCount = totalCount - pendingCount

    setLastImportSummary({
      total: totalCount,
      categorized: categorizedCount,
      pending: pendingCount,
      importedAt: new Date(),
    })

    const detailsMsgParts: string[] = []
    if (manualMergesCount > 0) {
      detailsMsgParts.push(`${manualMergesCount} mesclada(s) com lançamento manual`)
    }
    if (projectionsCount > 0) {
      detailsMsgParts.push(`${projectionsCount} projeção(ões) convertida(s)`)
    }

    const detailsMsg = detailsMsgParts.length > 0 ? ` (${detailsMsgParts.join(', ')})` : ''

    toast({
      title: 'Extrato importado com sucesso! 🎉',
      description: `${totalCount} transações processadas com sucesso${detailsMsg}. Orçamento sem duplicações.`,
    })

    triggerRefresh()
    if (onSuccess) onSuccess()
    handleDialogChange(false)
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
      finishDialogImportSuccess(items.filter((i) => i.selected).length)
    }
  }

  const handleKeepOldRules = () => {
    setConflictModalOpen(false)
    finishDialogImportSuccess(items.filter((i) => i.selected).length)
  }

  const itemForDetailModal = useMemo(
    () => items.find((i) => i.id === detailModalItemId) || null,
    [items, detailModalItemId],
  )

  const itemForCategoryPicker = useMemo(
    () => items.find((i) => i.id === categoryPickerItemId) || null,
    [items, categoryPickerItemId],
  )

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent
          className={`flex flex-col p-0 overflow-hidden transition-all duration-200 border-slate-200/90 shadow-2xl ${
            /* Mobile (< sm): tela cheia fixa em h-[100dvh], max-h-none, rounded-none, sem margens externas */
            'w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[94vw] sm:max-w-5xl sm:h-[88vh] sm:max-h-[88vh] sm:rounded-2xl'
          } ${
            /* Desktop (sm+): expandido se solicitado */
            isExpanded ? 'sm:w-[98vw] sm:max-w-7xl sm:h-[94vh] sm:max-h-[94vh]' : ''
          }`}
        >
          {/* Header FIXO no topo */}
          <DialogHeader className="shrink-0 px-3.5 sm:px-6 py-3 border-b border-slate-100 bg-white/95 backdrop-blur-md z-10">
            <div className="flex items-center justify-between gap-2 pr-7 sm:pr-8">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-ink text-action flex items-center justify-center shrink-0 shadow-2xs">
                  <UploadCloud className="w-4.5 h-4.5 stroke-[1.8]" />
                </div>
                <div className="min-w-0">
                  {step === 'review' ? (
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        Revisar Lançamentos ({items.filter((i) => !i.isNonExpense).length}
                        {items.some((i) => i.isNonExpense) ? ` • ${items.length} total` : ''})
                      </DialogTitle>
                      {/* Badge de conciliação integrado ao lado do total */}
                      {closingValidation?.matches ? (
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shadow-2xs">
                          <span>
                            ✔ Conciliada ({formatBRL(closingValidation.declaredTotalCents)})
                          </span>
                        </span>
                      ) : closingValidation && !closingValidation.matches ? (
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <span>Fatura ({formatBRL(closingValidation.declaredTotalCents)})</span>
                        </span>
                      ) : null}
                      {/* Indicador de Total no cabeçalho: desconsidera isNonExpense e mostra Bruto x Líquido se divergirem */}
                      {totalAmountSelected.exp > 0 || totalAmountSelected.gross > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-full">
                          {totalAmountSelected.gross > 0 &&
                          totalAmountSelected.gross !== totalAmountSelected.exp ? (
                            <span>
                              Bruto: {formatBRL(totalAmountSelected.gross)} • Líq:{' '}
                              {formatBRL(totalAmountSelected.exp)}
                            </span>
                          ) : (
                            <span>Total: {formatBRL(totalAmountSelected.exp)}</span>
                          )}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        Importar Extrato ou Fatura
                      </DialogTitle>
                    </div>
                  )}
                  <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                    {step === 'upload'
                      ? 'Do banco ou do cartão: a IA lê e você só confere.'
                      : fileInfo
                        ? `${fileInfo.format} • ${fileInfo.name}`
                        : `${items.length} lançamentos identificados`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {step === 'review' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep('upload')}
                    className="text-[11px] sm:text-xs h-7 sm:h-8 rounded-lg sm:rounded-xl px-2 sm:px-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    title="Trocar arquivo de extrato"
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
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
              {/* Box amigável quando o PDF é protegido por senha */}
              {isPasswordProtected && pendingPdfFile ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs space-y-3.5 shadow-2xs">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Lock className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="font-bold text-amber-950 text-sm">
                          Esta fatura é protegida por senha
                        </strong>
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                          {pendingPdfFile.name}
                        </span>
                      </div>
                      <p className="text-xs text-amber-900/90 leading-relaxed">
                        Muitos bancos protegem a fatura em PDF por segurança. Geralmente a senha é a
                        sua <strong>data de nascimento</strong> (ex: DDMMAAAA ou DDMMAA) ou os{' '}
                        <strong>primeiros/últimos dígitos do CPF</strong> (ex: os 5 ou 6 primeiros
                        dígitos).
                      </p>
                    </div>
                  </div>

                  {/* Formulário de senha (em memória, nunca salvo) */}
                  <form
                    onSubmit={handleSubmitPdfPassword}
                    className="pt-1 space-y-3 max-w-md w-full"
                  >
                    <div className="space-y-1.5">
                      <label
                        htmlFor="pdf-password-input"
                        className="block text-xs font-semibold text-amber-950"
                      >
                        Senha do PDF
                      </label>
                      <div className="relative flex items-center">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                        <Input
                          id="pdf-password-input"
                          type={showPdfPassword ? 'text' : 'password'}
                          value={pdfPassword}
                          onChange={(e) => {
                            setPdfPassword(e.target.value)
                            if (passwordError) setPasswordError(null)
                          }}
                          placeholder="Digite a senha da fatura"
                          autoComplete="off"
                          autoFocus
                          disabled={parsing}
                          className="h-10 pl-9 pr-10 text-xs sm:text-sm bg-white border-amber-300 focus-visible:ring-amber-500 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPdfPassword((prev) => !prev)}
                          className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 focus:outline-hidden"
                          aria-label={showPdfPassword ? 'Ocultar senha' : 'Ver senha'}
                          tabIndex={-1}
                        >
                          {showPdfPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {passwordError ? (
                        <p className="text-xs font-semibold text-rose-700 flex items-center gap-1 pt-0.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{passwordError}</span>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Button
                        type="submit"
                        disabled={parsing || !pdfPassword.trim()}
                        className="h-9 px-4 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-xl shadow-2xs gap-1.5"
                      >
                        {parsing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Desbloqueando...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Desbloquear e Continuar</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={parsing}
                        onClick={handleCancelPasswordPrompt}
                        className="h-9 text-xs text-slate-600 hover:text-slate-900 rounded-xl gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Escolher outro arquivo</span>
                      </Button>
                    </div>
                  </form>
                </div>
              ) : errorMessage ? (
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

                  {/* Ações amigáveis: Tentar novamente / Escolher outro arquivo */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {currentFile ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={parsing}
                        onClick={() => handleProcessFile(currentFile)}
                        className="h-8 px-3.5 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-xl shadow-2xs gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Tentar novamente</span>
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={parsing}
                      onClick={() => {
                        setErrorMessage(null)
                        setDiagnostics(null)
                        setCurrentFile(null)
                        setFailedPages([])
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                      }}
                      className="h-8 text-xs text-amber-900 hover:text-amber-950 hover:bg-amber-100/60 rounded-xl gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Escolher outro arquivo</span>
                    </Button>
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
                    ? 'border-action bg-amber-50/40 cursor-wait'
                    : 'border-slate-300 hover:border-action hover:bg-amber-50/30 bg-white'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ofx,application/pdf,.pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-ink text-action flex items-center justify-center mx-auto mb-4 shadow-sm">
                  {parsing ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <UploadCloud className="w-8 h-8 stroke-[1.8]" />
                  )}
                </div>

                <h3 className="font-bold text-base text-slate-800">
                  {parsing
                    ? isAiCategorizing
                      ? extractionProgress || 'Aplicando inteligência por IA (GPT-4o mini)...'
                      : extractionProgress || 'Lendo seu arquivo...'
                    : 'Arraste seu arquivo aqui'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  {parsing
                    ? isAiCategorizing
                      ? 'Extraindo todas as páginas em paralelo com IA à prova de falhas e conferindo total...'
                      : 'Lendo lançamentos, identificando parcelas e aplicando as regras da sua família...'
                    : 'Extrato do banco ou fatura do cartão — ou toque para escolher do dispositivo'}
                </p>

                {/* Badges de formatos suportados */}
                {/* Badges de formatos — FIX 25/10: dois chips claros em vez de um
                    badge único verde confuso; cores da marca. */}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-ink text-[color:var(--text-inverse)] shadow-sm px-3.5 py-1.5 rounded-xl">
                    <FileText className="w-3.5 h-3.5 stroke-[1.8]" />
                    <span>Extrato do banco · .ofx</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-action text-white shadow-sm px-3.5 py-1.5 rounded-xl">
                    <FileText className="w-3.5 h-3.5 stroke-[1.8]" />
                    <span>Fatura do cartão · .pdf</span>
                  </span>
                </div>
              </div>

              {/* Box Informativo: Como funciona */}
              <div className="rounded-2xl border border-line bg-bg p-4 sm:p-5 text-xs shadow-2xs">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-action/15 text-[#B45309] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Sparkles className="w-4 h-4 stroke-[1.8]" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight">
                      Como funciona
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
                      A IA lê seu arquivo, separa as compras, identifica parcelas e sugere as
                      categorias da sua família. Você revisa tudo antes de confirmar — nada entra
                      sem seu OK.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* ================= ETAPA 2: REVISÃO ANTES DE SALVAR ================= */}
          {step === 'review' ? (
            <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-5 space-y-2.5 sm:space-y-3">
              {/* Aviso de páginas falhadas (se alguma falhou mas outras trouxeram lançamentos) */}
              {failedPages.length > 0 && (
                <div
                  role="alert"
                  className="p-3 sm:p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 text-xs shadow-xs space-y-1 shrink-0"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base sm:text-lg shrink-0 mt-0.5 leading-none">⚠</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-amber-950 text-xs sm:text-sm leading-snug">
                        Não foi possível ler completamente a página {failedPages.join(', ')} da
                        fatura.
                      </p>
                      <p className="text-[11px] text-amber-900/80 mt-0.5 leading-relaxed">
                        Verifique se faltam transações ou se a soma final confere. As transações das
                        demais páginas foram carregadas abaixo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Informativo sutil de apoio em caso de divergência residual */}
              {closingValidation && !closingValidation.matches && (
                <div
                  role="status"
                  className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-center gap-2 shrink-0"
                >
                  <Info className="w-4 h-4 text-slate-500 shrink-0" />
                  <p className="text-[11px] sm:text-xs text-slate-600 leading-snug flex-1">
                    Revise os itens antes de confirmar
                  </p>
                </div>
              )}

              {/* Barra de Ações Rápidas no Topo */}
              <div className="bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {/* Selecionar / Desmarcar Todos */}
                  <label className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedCount === items.length && items.length > 0}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>
                      Selecionar todos ({selectedCount}/{items.length})
                    </span>
                  </label>

                  {/* Badge de lançamentos válidos */}
                  <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-emerald-600" />
                    {items.length} válidos
                  </span>

                  {/* Badge de Mescla com Lançamento Manual */}
                  {mergedCount > 0 && (
                    <span className="text-[10px] sm:text-[11px] font-semibold text-finance-income bg-emerald-50 border border-emerald-200/70 px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <Link2
                        className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-finance-income"
                        strokeWidth={1.5}
                      />
                      <span>{mergedCount} mesclada(s)</span>
                    </span>
                  )}

                  {/* Alerta de duplicatas */}
                  {duplicateCount > 0 && (
                    <span className="text-[10px] sm:text-[11px] font-semibold text-amber-700 bg-amber-100/80 border border-amber-200 px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {duplicateCount} duplicada(s)
                    </span>
                  )}

                  {/* Badge quitação/ajuste */}
                  {nonExpenseCount > 0 && (
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 bg-slate-200/90 border border-slate-300 px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-slate-600" />
                      {nonExpenseCount} quitação/ajuste
                    </span>
                  )}
                </div>

                {/* Membro em lote & Criar Categoria */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="hidden sm:inline">Atribuir a:</span>
                    <Select value={defaultMemberId} onValueChange={handleApplyMemberToAll}>
                      <SelectTrigger className="h-8 text-xs bg-white w-28 sm:w-32 rounded-xl">
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
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-xs shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <Info className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        <strong className="font-semibold text-slate-800">
                          {ignoredLines.length}
                        </strong>{' '}
                        {ignoredLines.length === 1 ? 'linha ignorada' : 'linhas ignoradas'} pelo
                        filtro
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowIgnoredLines((prev) => !prev)}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 hover:underline"
                    >
                      <span>{showIgnoredLines ? 'Ocultar' : 'Ver linhas ignoradas'}</span>
                      {showIgnoredLines ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {showIgnoredLines && (
                    <div className="mt-2 pt-2 border-t border-slate-200/70 max-h-32 overflow-y-auto space-y-1 font-mono text-[11px]">
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

              {/* LISTA COMPACTA DE LANÇAMENTOS - ESTILO EXTRATO PREMIUM COM TOQUE AMPLO */}
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100/90 -mx-1 sm:mx-0 px-1 pr-1.5 overscroll-contain">
                {items.map((item) => {
                  const currentCategory = categories.find((c) => c.id === item.category_id)
                  const isIncome = item.type === 'income'
                  const memberName = members.find((m) => m.id === item.member_id)?.name

                  return (
                    <div
                      key={item.id}
                      onClick={() => setDetailModalItemId(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setDetailModalItemId(item.id)
                        }
                      }}
                      className={`group py-2.5 px-2 rounded-xl transition-colors flex items-center justify-between gap-2.5 cursor-pointer select-none active:bg-slate-100/80 ${
                        item.selected ? 'hover:bg-slate-50/90' : 'opacity-40 bg-slate-50/40'
                      }`}
                    >
                      {/* Checkbox de seleção múltipla com stopPropagation para não abrir o editor */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 flex items-center"
                      >
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleToggleItem(item.id)}
                          aria-label={`Selecionar ${item.description}`}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 shrink-0 cursor-pointer"
                        />
                      </div>

                      {/* Lado Esquerdo: Ícone da categoria em badge arredondado + Título fiel/completo + Subtítulo leve */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Ícone de categoria em badge arredondado */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs text-white"
                          style={{
                            backgroundColor: currentCategory?.color || '#94A3B8',
                          }}
                        >
                          {currentCategory?.icon ? (
                            <CategoryIcon
                              name={currentCategory.icon}
                              className="w-4 h-4 text-white"
                            />
                          ) : (
                            <Tag className="w-4 h-4 text-white" />
                          )}
                        </div>

                        {/* Textos: Estabelecimento sem truncar abreviado (break-words line-clamp-2) + Subtítulo leve */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 break-words line-clamp-2">
                              {item.description}
                            </span>
                            {item.isPossibleDuplicate && !item.isDuplicate ? (
                              <span
                                title={
                                  item.duplicateReason || 'Possível duplicata por data e valor'
                                }
                                className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.2 rounded shrink-0"
                              >
                                possível duplicata
                              </span>
                            ) : item.isDuplicate ? (
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/90 border border-amber-300 px-1.5 py-0.2 rounded shrink-0">
                                Duplicata
                              </span>
                            ) : null}
                            {item.isReconciledManual && (
                              <span className="text-[10px] font-semibold text-finance-income bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                                <Link2
                                  className="w-2.5 h-2.5 text-finance-income"
                                  strokeWidth={1.5}
                                />{' '}
                                Mesclada
                              </span>
                            )}
                          </div>

                          {/* Subtítulo leve com data (ex: 11/07), badge de parcela "7/10" discreto e nome do membro */}
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate mt-0.5">
                            <span className="font-medium text-slate-600">
                              {item.date ? item.date.slice(5).replace('-', '/') : ''}
                            </span>
                            {item.isInstallment && (
                              <span className="font-semibold text-[10px] text-slate-700 bg-muted/70 border border-border/40 px-1.5 py-0.2 rounded-md shrink-0">
                                {item.installmentCurrent}/{item.installmentTotal}
                              </span>
                            )}
                            {memberName && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="truncate max-w-[90px] sm:max-w-none">
                                  {memberName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Lado Direito: Valor monetário + Pílula clicável com categoria e ✨ */}
                      <div className="flex flex-col items-end shrink-0 gap-1 pl-1">
                        <span
                          className={`font-bold text-xs sm:text-sm tabular-nums ${
                            isIncome ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {isIncome ? '+ ' : '− '}
                          {formatBRL(item.amount_cents)}
                        </span>

                        {/* Pílula clicável de categoria (1 clique para abrir seletor de categorias direto) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCategoryPickerItemId(item.id)
                          }}
                          className={`inline-flex items-center gap-1 max-w-[120px] xs:max-w-[140px] sm:max-w-[180px] text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full transition-all border ${
                            currentCategory
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100/80 active:bg-emerald-200/70'
                              : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 active:bg-amber-200/70'
                          }`}
                          title="Clique para trocar a categoria em 1 clique"
                        >
                          <span className="truncate">
                            {currentCategory ? currentCategory.name : 'Sem categoria'}
                          </span>
                          <span className="shrink-0 text-[10px]">✨</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* Rodapé FIXO na base (Sticky Bottom Bar) com sombra e blur */}
          <div className="shrink-0 border-t border-slate-100 bg-white/95 backdrop-blur-md p-3 sm:p-4 z-10 shadow-lg">
            {step === 'upload' ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogChange(false)}
                  className="w-full sm:w-auto text-xs h-9 rounded-xl"
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:justify-between">
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span>
                    {selectedCount} de {items.length} selecionadas
                  </span>
                  {totalAmountSelected.inc > 0 ? (
                    <span className="text-emerald-700 font-semibold">
                      +{formatBRL(totalAmountSelected.inc)}
                    </span>
                  ) : null}
                  {totalAmountSelected.gross > 0 &&
                  totalAmountSelected.gross !== totalAmountSelected.exp ? (
                    <span className="text-[11px] text-slate-400">
                      (Bruto: {formatBRL(totalAmountSelected.gross)} • Líq:{' '}
                      {formatBRL(totalAmountSelected.exp)})
                    </span>
                  ) : null}
                </div>

                <Button
                  type="button"
                  onClick={handleSaveImported}
                  disabled={saving || selectedCount === 0}
                  className="w-full sm:w-auto min-h-[46px] h-12 px-6 bg-brand-amber hover:bg-[#e08e08] text-brand font-bold text-sm rounded-xl shadow-md transition-all gap-2 flex items-center justify-center border-0"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importando...</span>
                    </>
                  ) : (
                    <span>
                      Importar {selectedCount} {selectedCount === 1 ? 'Transação' : 'Transações'}
                      {totalAmountSelected.exp > 0 || totalAmountSelected.inc > 0 ? (
                        <>
                          {' '}
                          •{' '}
                          {formatBRL(
                            totalAmountSelected.exp > 0
                              ? totalAmountSelected.exp
                              : totalAmountSelected.inc,
                          )}
                        </>
                      ) : null}
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SELETOR RÁPIDO DE CATEGORIAS (1 CLIQUE): BOTTOM SHEET NO MOBILE, DIALOG NO DESKTOP */}
      {isMobile ? (
        <Sheet
          open={Boolean(categoryPickerItemId && itemForCategoryPicker)}
          onOpenChange={(openVal) => {
            if (!openVal) setCategoryPickerItemId(null)
          }}
        >
          <SheetContent
            side="bottom"
            onPointerDownOutside={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setCategoryPickerItemId(null)
            }}
            onInteractOutside={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setCategoryPickerItemId(null)
            }}
            className="rounded-t-2xl p-4 max-h-[85vh] flex flex-col w-full max-w-[calc(100vw-1rem)] mx-auto border-x"
          >
            <SheetHeader className="pb-3 border-b border-slate-100 text-left">
              <SheetTitle className="text-base font-bold text-slate-900">
                Escolher Categoria
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500 break-words line-clamp-2">
                {itemForCategoryPicker?.description || 'Transação'}
              </SheetDescription>
            </SheetHeader>

            <div className="py-2 space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (categoryPickerItemId) {
                    handleUpdateItemField(categoryPickerItemId, 'category_id', null)
                  }
                  setCategoryPickerItemId(null)
                }}
                className={`w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl text-left text-xs transition-colors ${
                  !itemForCategoryPicker?.category_id
                    ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200'
                    : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                    —
                  </span>
                  <span className="font-medium">Sem categoria</span>
                </span>
                {!itemForCategoryPicker?.category_id && (
                  <Check className="w-4 h-4 text-amber-700" />
                )}
              </button>

              {categories
                .filter((c) =>
                  itemForCategoryPicker ? c.type === itemForCategoryPicker.type : true,
                )
                .map((cat) => {
                  const isSelected = itemForCategoryPicker?.category_id === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (categoryPickerItemId) {
                          handleUpdateItemField(categoryPickerItemId, 'category_id', cat.id)
                        }
                        setCategoryPickerItemId(null)
                      }}
                      className={`w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: cat.color || '#3B82F6' }}
                        >
                          {cat.icon ? (
                            <CategoryIcon name={cat.icon} className="w-4 h-4" />
                          ) : (
                            <Tag className="w-4 h-4" />
                          )}
                        </span>
                        <span className="truncate font-medium">{cat.name}</span>
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  )
                })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  const targetId = categoryPickerItemId
                  setCategoryPickerItemId(null)
                  if (targetId) openQuickCategoryModal(targetId)
                }}
                className="text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 rounded-xl min-h-[44px] h-11 px-4"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Nova Categoria</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setCategoryPickerItemId(null)
                }}
                className="text-xs text-slate-500 rounded-xl min-h-[44px] h-11 px-4"
              >
                Fechar
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog
          open={Boolean(categoryPickerItemId && itemForCategoryPicker)}
          onOpenChange={(openVal) => {
            if (!openVal) setCategoryPickerItemId(null)
          }}
        >
          <DialogContent
            onPointerDownOutside={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setCategoryPickerItemId(null)
            }}
            onInteractOutside={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setCategoryPickerItemId(null)
            }}
            className="max-w-sm w-[92vw] rounded-2xl p-4 sm:p-5 max-h-[85vh] flex flex-col"
          >
            <DialogHeader className="pb-2 border-b border-slate-100">
              <DialogTitle className="text-base font-bold text-slate-900">
                Escolher Categoria
              </DialogTitle>
              <p className="text-xs text-slate-500 break-words line-clamp-2">
                {itemForCategoryPicker?.description || 'Transação'}
              </p>
            </DialogHeader>

            <div className="py-2 space-y-1 max-h-[60vh] overflow-y-auto pr-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (categoryPickerItemId) {
                    handleUpdateItemField(categoryPickerItemId, 'category_id', null)
                  }
                  setCategoryPickerItemId(null)
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors ${
                  !itemForCategoryPicker?.category_id
                    ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200'
                    : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                    —
                  </span>
                  <span>Sem categoria</span>
                </span>
                {!itemForCategoryPicker?.category_id && (
                  <Check className="w-4 h-4 text-amber-700" />
                )}
              </button>

              {categories
                .filter((c) =>
                  itemForCategoryPicker ? c.type === itemForCategoryPicker.type : true,
                )
                .map((cat) => {
                  const isSelected = itemForCategoryPicker?.category_id === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (categoryPickerItemId) {
                          handleUpdateItemField(categoryPickerItemId, 'category_id', cat.id)
                        }
                        setCategoryPickerItemId(null)
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: cat.color || '#3B82F6' }}
                        >
                          {cat.icon ? (
                            <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" />
                          ) : (
                            <Tag className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <span className="truncate">{cat.name}</span>
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  )
                })}
            </div>

            <DialogFooter className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  const targetId = categoryPickerItemId
                  setCategoryPickerItemId(null)
                  if (targetId) openQuickCategoryModal(targetId)
                }}
                className="text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Nova Categoria</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setCategoryPickerItemId(null)
                }}
                className="text-xs text-slate-500 rounded-xl"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL SECUNDÁRIO 2: DETALHES ADICIONAIS SOB DEMANDA (BOTTOM SHEET NO MOBILE, DIALOG NO DESKTOP) */}
      {isMobile ? (
        <Sheet
          open={Boolean(detailModalItemId && itemForDetailModal)}
          onOpenChange={(openVal) => {
            if (!openVal) setDetailModalItemId(null)
          }}
        >
          <SheetContent
            side="bottom"
            onPointerDownOutside={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDetailModalItemId(null)
            }}
            onInteractOutside={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDetailModalItemId(null)
            }}
            className="rounded-t-2xl p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto w-full max-w-[calc(100vw-1rem)] mx-auto border-x"
          >
            <SheetHeader className="pb-2 border-b border-slate-100 text-left">
              <div className="flex items-center justify-between gap-2 pr-6">
                <SheetTitle className="text-base font-bold text-slate-900">
                  Detalhes do Lançamento
                </SheetTitle>
                {itemForDetailModal && (
                  <span
                    className={`font-semibold text-base tabular-nums shrink-0 ${
                      itemForDetailModal.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {itemForDetailModal.type === 'income' ? '+' : '−'}{' '}
                    {formatBRL(itemForDetailModal.amount_cents)}
                  </span>
                )}
              </div>
              <SheetDescription className="sr-only">
                Editar detalhes da transação importada
              </SheetDescription>
            </SheetHeader>

            {itemForDetailModal && (
              <div className="space-y-4 text-xs">
                {/* Nome completo da transação em destaque */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Nome Completo do Lançamento
                  </Label>
                  <Input
                    value={itemForDetailModal.description}
                    onChange={(e) =>
                      handleUpdateItemField(itemForDetailModal.id, 'description', e.target.value)
                    }
                    className="min-h-[44px] h-11 text-xs rounded-xl"
                  />
                </div>

                {/* Seletor rápido de categoria principal (botão confortável 44px) */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Categoria
                  </Label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      const currentId = itemForDetailModal.id
                      setCategoryPickerItemId(currentId)
                    }}
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl flex items-center justify-between text-left transition-colors"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {(() => {
                        const currentCat = categories.find(
                          (c) => c.id === itemForDetailModal.category_id,
                        )
                        return (
                          <>
                            <span
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                              style={{ backgroundColor: currentCat?.color || '#94A3B8' }}
                            >
                              {currentCat?.icon ? (
                                <CategoryIcon name={currentCat.icon} className="w-4 h-4" />
                              ) : (
                                <Tag className="w-4 h-4" />
                              )}
                            </span>
                            <span className="truncate font-semibold text-slate-900 text-xs">
                              {currentCat ? currentCat.name : 'Escolher categoria...'}
                            </span>
                          </>
                        )
                      })()}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold shrink-0">
                      Trocar ✨
                    </span>
                  </button>
                </div>

                {/* Subcategoria se houver */}
                {(() => {
                  const cat = categories.find((c) => c.id === itemForDetailModal.category_id)
                  const subs = cat?.subcategories || []
                  if (subs.length === 0) return null
                  return (
                    <div>
                      <Label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Subcategoria ({cat?.name})
                      </Label>
                      <Select
                        value={itemForDetailModal.subcategory_id || 'none'}
                        onValueChange={(val) =>
                          handleUpdateItemField(
                            itemForDetailModal.id,
                            'subcategory_id',
                            val === 'none' ? null : val,
                          )
                        }
                      >
                        <SelectTrigger className="min-h-[44px] h-11 text-xs bg-white rounded-xl">
                          <SelectValue placeholder="Subcategoria opcional" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs text-slate-500 min-h-[44px]">
                            Nenhuma
                          </SelectItem>
                          {subs.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="text-xs min-h-[44px]">
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })()}

                {/* Data e Tipo */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-[11px] font-bold text-slate-600 block mb-1">Data</Label>
                    <input
                      type="date"
                      value={itemForDetailModal.date}
                      onChange={(e) =>
                        handleUpdateItemField(itemForDetailModal.id, 'date', e.target.value)
                      }
                      className="min-h-[44px] h-11 w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-xl px-2.5 font-medium focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-bold text-slate-600 block mb-1">Tipo</Label>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateItemField(
                          itemForDetailModal.id,
                          'type',
                          itemForDetailModal.type === 'income' ? 'expense' : 'income',
                        )
                      }
                      className={`min-h-[44px] h-11 w-full text-xs font-bold rounded-xl flex items-center justify-center gap-1 border transition-colors ${
                        itemForDetailModal.type === 'income'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {itemForDetailModal.type === 'income' ? (
                        <>
                          <ArrowUpRight className="w-4 h-4" /> Receita
                        </>
                      ) : (
                        <>
                          <ArrowDownRight className="w-4 h-4" /> Despesa
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Membro responsável */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Membro Responsável
                  </Label>
                  <Select
                    value={itemForDetailModal.member_id}
                    onValueChange={(val) =>
                      handleUpdateItemField(itemForDetailModal.id, 'member_id', val)
                    }
                  >
                    <SelectTrigger className="min-h-[44px] h-11 text-xs bg-white rounded-xl">
                      <SelectValue placeholder="Selecione o membro" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs min-h-[44px]">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Conciliação Manual se disponível */}
                {itemForDetailModal.matchedManualTransaction && (
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1 text-finance-income">
                        <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Lançamento manual
                        vinculado
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={itemForDetailModal.isReconciledManual ?? false}
                          onChange={(e) =>
                            handleUpdateItemField(
                              itemForDetailModal.id,
                              'isReconciledManual',
                              e.target.checked,
                            )
                          }
                          className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>Mesclar</span>
                      </label>
                    </div>
                    <p className="text-[11px] text-emerald-900/80">
                      "{itemForDetailModal.matchedManualTransaction.description}" em{' '}
                      {itemForDetailModal.matchedManualTransaction.transaction_date}
                    </p>
                  </div>
                )}

                {/* Se houver múltiplas candidatas manuais */}
                {!itemForDetailModal.isReconciledManual &&
                  (itemForDetailModal.reconciliationCandidates?.length || 0) > 1 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="font-semibold text-slate-800 text-[11px] block">
                        Escolha qual lançamento manual corresponde a esta despesa:
                      </span>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {itemForDetailModal.reconciliationCandidates?.map((cand) => (
                          <div
                            key={cand.id}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-indigo-200 text-[11px]"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-800 block truncate">
                                {cand.description || 'Sem descrição'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {cand.transaction_date} • {cand.category?.name || 'Sem categoria'} •{' '}
                                {cand.member?.name || 'Membro'}
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                handleUpdateItemField(
                                  itemForDetailModal.id,
                                  'isReconciledManual',
                                  true,
                                )
                                handleUpdateItemField(
                                  itemForDetailModal.id,
                                  'matchedManualTransaction',
                                  cand,
                                )
                                if (cand.category_id) {
                                  handleUpdateItemField(
                                    itemForDetailModal.id,
                                    'category_id',
                                    cand.category_id,
                                  )
                                }
                                if (cand.subcategory_id) {
                                  handleUpdateItemField(
                                    itemForDetailModal.id,
                                    'subcategory_id',
                                    cand.subcategory_id,
                                  )
                                }
                                if (cand.member_id) {
                                  handleUpdateItemField(
                                    itemForDetailModal.id,
                                    'member_id',
                                    cand.member_id,
                                  )
                                }
                              }}
                              className="min-h-[44px] text-[11px] px-3 font-semibold rounded-lg bg-emerald-50 text-finance-income border border-emerald-200 hover:bg-emerald-100 shrink-0"
                            >
                              <Link2 className="w-3 h-3 mr-1 inline" strokeWidth={1.5} /> Mesclar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Detalhes de Parcelamento quando detectado */}
                {itemForDetailModal.isInstallment && (
                  <div className="p-3 bg-muted/60 border border-border/40 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>Despesa Parcelada</span>
                        <span className="bg-muted text-slate-700 px-2 py-0.5 rounded-full font-mono text-[11px]">
                          Parcela {itemForDetailModal.installmentCurrent} de{' '}
                          {itemForDetailModal.installmentTotal}
                        </span>
                      </span>
                      {itemForDetailModal.matchedProjectId ? (
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          ✓ Projeção existente
                        </span>
                      ) : null}
                    </div>

                    {itemForDetailModal.matchedProjectId ? (
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Esta parcela corresponde a uma projeção futura já cadastrada. Ao importar,
                        ela será convertida de <em>projetada</em> para <strong>confirmada</strong>{' '}
                        sem gerar duplicidade.
                      </p>
                    ) : itemForDetailModal.installmentCurrent === 1 &&
                      (itemForDetailModal.installmentTotal || 1) > 1 ? (
                      <label className="flex items-start gap-2 cursor-pointer select-none text-[11px] text-slate-700 font-medium">
                        <input
                          type="checkbox"
                          checked={itemForDetailModal.generateFutureInstallments ?? true}
                          onChange={(e) =>
                            handleUpdateItemField(
                              itemForDetailModal.id,
                              'generateFutureInstallments',
                              e.target.checked,
                            )
                          }
                          className="mt-0.5 rounded border-slate-300 text-slate-700 focus:ring-slate-500 w-4 h-4"
                        />
                        <span>
                          <strong>
                            Gerar automaticamente as{' '}
                            {(itemForDetailModal.installmentTotal || 1) - 1} parcelas futuras
                          </strong>{' '}
                          como despesas projetadas nos próximos meses.
                        </span>
                      </label>
                    ) : (
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Parcela intermediária sem projeção prévia identificada. Será criada como
                        despesa confirmada deste mês.
                      </p>
                    )}
                  </div>
                )}

                {/* Lembrar regra para compras futuras */}
                {itemForDetailModal.category_id && (
                  <div className="pt-0.5">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs select-none min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={itemForDetailModal.rememberRule ?? true}
                        onChange={(e) =>
                          handleUpdateItemField(
                            itemForDetailModal.id,
                            'rememberRule',
                            e.target.checked,
                          )
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-slate-700 font-medium flex items-center gap-1.5 text-xs">
                        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Lembrar categoria para lançamentos futuros com este nome</span>
                      </span>
                    </label>
                    {itemForDetailModal.source === 'ai_suggestion' &&
                      itemForDetailModal.aiReasoning && (
                        <p className="text-[10px] text-slate-600 mt-0.5 italic flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-brand-amber inline" strokeWidth={1.5} />
                          <span>Sugestão por IA: {itemForDetailModal.aiReasoning}</span>
                        </p>
                      )}
                  </div>
                )}

                {/* Botões do Rodapé de Detalhes: Excluir / Concluir */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveItem(itemForDetailModal.id)
                      setDetailModalItemId(null)
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl min-h-[44px] h-11 px-3 gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir do extrato</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDetailModalItemId(null)
                    }}
                    className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl min-h-[44px] h-11 px-5"
                  >
                    Pronto
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog
          open={Boolean(detailModalItemId && itemForDetailModal)}
          onOpenChange={(openVal) => {
            if (!openVal) setDetailModalItemId(null)
          }}
        >
          <DialogContent
            onPointerDownOutside={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDetailModalItemId(null)
            }}
            onInteractOutside={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDetailModalItemId(null)
            }}
            className="max-w-md w-[92vw] rounded-2xl p-4 sm:p-6 space-y-4 max-h-[88vh] overflow-y-auto"
          >
            <DialogHeader className="pb-2 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-base font-bold text-slate-900">
                  Detalhes do Lançamento
                </DialogTitle>
                {itemForDetailModal && (
                  <span
                    className={`font-semibold text-sm tabular-nums ${
                      itemForDetailModal.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {itemForDetailModal.type === 'income' ? '+' : '−'}{' '}
                    {formatBRL(itemForDetailModal.amount_cents)}
                  </span>
                )}
              </div>
            </DialogHeader>

            {itemForDetailModal && (
              <div className="space-y-3.5 text-xs">
                {/* Descrição */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Descrição
                  </Label>
                  <Input
                    value={itemForDetailModal.description}
                    onChange={(e) =>
                      handleUpdateItemField(itemForDetailModal.id, 'description', e.target.value)
                    }
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                {/* Data e Tipo */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-[11px] font-bold text-slate-600 block mb-1">Data</Label>
                    <input
                      type="date"
                      value={itemForDetailModal.date}
                      onChange={(e) =>
                        handleUpdateItemField(itemForDetailModal.id, 'date', e.target.value)
                      }
                      className="h-9 w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-xl px-2.5 font-medium focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-bold text-slate-600 block mb-1">Tipo</Label>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateItemField(
                          itemForDetailModal.id,
                          'type',
                          itemForDetailModal.type === 'income' ? 'expense' : 'income',
                        )
                      }
                      className={`h-9 w-full text-xs font-bold rounded-xl flex items-center justify-center gap-1 border transition-colors ${
                        itemForDetailModal.type === 'income'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {itemForDetailModal.type === 'income' ? (
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
                </div>

                {/* Membro responsável */}
                <div>
                  <Label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Membro Responsável
                  </Label>
                  <Select
                    value={itemForDetailModal.member_id}
                    onValueChange={(val) =>
                      handleUpdateItemField(itemForDetailModal.id, 'member_id', val)
                    }
                  >
                    <SelectTrigger className="h-9 text-xs bg-white rounded-xl">
                      <SelectValue placeholder="Selecione o membro" />
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

                {/* Subcategoria se houver */}
                {(() => {
                  const cat = categories.find((c) => c.id === itemForDetailModal.category_id)
                  const subs = cat?.subcategories || []
                  if (subs.length === 0) return null
                  return (
                    <div>
                      <Label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Subcategoria ({cat?.name})
                      </Label>
                      <Select
                        value={itemForDetailModal.subcategory_id || 'none'}
                        onValueChange={(val) =>
                          handleUpdateItemField(
                            itemForDetailModal.id,
                            'subcategory_id',
                            val === 'none' ? null : val,
                          )
                        }
                      >
                        <SelectTrigger className="h-9 text-xs bg-white rounded-xl">
                          <SelectValue placeholder="Subcategoria opcional" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs text-slate-500">
                            Nenhuma
                          </SelectItem>
                          {subs.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="text-xs">
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })()}

                {/* Conciliação Manual se disponível */}
                {itemForDetailModal.matchedManualTransaction && (
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1 text-finance-income">
                        <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Lançamento manual
                        vinculado
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                        <input
                          type="checkbox"
                          checked={itemForDetailModal.isReconciledManual ?? false}
                          onChange={(e) =>
                            handleUpdateItemField(
                              itemForDetailModal.id,
                              'isReconciledManual',
                              e.target.checked,
                            )
                          }
                          className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                        />
                        <span>Mesclar</span>
                      </label>
                    </div>
                    <p className="text-[11px] text-emerald-900/80">
                      "{itemForDetailModal.matchedManualTransaction.description}" em{' '}
                      {itemForDetailModal.matchedManualTransaction.transaction_date}
                    </p>
                  </div>
                )}

                {/* Se houver múltiplas candidatas manuais, permitir selecionar uma */}
                {!itemForDetailModal.isReconciledManual &&
                  (itemForDetailModal.reconciliationCandidates?.length || 0) > 1 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="font-semibold text-slate-800 text-[11px] block">
                        Escolha qual lançamento manual corresponde a esta despesa:
                      </span>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {itemForDetailModal.reconciliationCandidates?.map((cand) => (
                          <div
                            key={cand.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-indigo-200 text-[11px]"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-800 block truncate">
                                {cand.description || 'Sem descrição'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {cand.transaction_date} • {cand.category?.name || 'Sem categoria'} •{' '}
                                {cand.member?.name || 'Membro'}
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                handleUpdateItemField(
                                  itemForDetailModal.id,
                                  'isReconciledManual',
                                  true,
                                )
                                handleUpdateItemField(
                                  itemForDetailModal.id,
                                  'matchedManualTransaction',
                                  cand,
                                )
                                if (cand.category_id) {
                                  handleUpdateItemField(
                                    itemForDetailModal.id,
                                    'category_id',
                                    cand.category_id,
                                  )
                                }
                                if (cand.subcategory_id) {
                                  handleUpdateItemField(
                                    itemForDetailModal.id,
                                    'subcategory_id',
                                    cand.subcategory_id,
                                  )
                                }
                                if (cand.member_id) {
                                  handleUpdateItemField(
                                    itemForDetailModal.id,
                                    'member_id',
                                    cand.member_id,
                                  )
                                }
                              }}
                              className="h-7 text-[10px] px-2 font-semibold rounded-lg bg-emerald-50 text-finance-income border border-emerald-200 hover:bg-emerald-100 shrink-0"
                            >
                              <Link2 className="w-3 h-3 mr-1 inline" strokeWidth={1.5} /> Mesclar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Detalhes de Parcelamento quando detectado */}
                {itemForDetailModal.isInstallment && (
                  <div className="p-3 bg-muted/60 border border-border/40 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>Despesa Parcelada</span>
                        <span className="bg-muted text-slate-700 px-2 py-0.5 rounded-full font-mono text-[11px]">
                          Parcela {itemForDetailModal.installmentCurrent} de{' '}
                          {itemForDetailModal.installmentTotal}
                        </span>
                      </span>
                      {itemForDetailModal.matchedProjectId ? (
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          ✓ Projeção existente encontrada no mês
                        </span>
                      ) : null}
                    </div>

                    {itemForDetailModal.matchedProjectId ? (
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Esta parcela corresponde a uma projeção futura já cadastrada. Ao importar,
                        ela será convertida de <em>projetada</em> para <strong>confirmada</strong>{' '}
                        sem gerar duplicidade.
                      </p>
                    ) : itemForDetailModal.installmentCurrent === 1 &&
                      (itemForDetailModal.installmentTotal || 1) > 1 ? (
                      <label className="flex items-start gap-2 cursor-pointer select-none text-[11px] text-slate-700 font-medium">
                        <input
                          type="checkbox"
                          checked={itemForDetailModal.generateFutureInstallments ?? true}
                          onChange={(e) =>
                            handleUpdateItemField(
                              itemForDetailModal.id,
                              'generateFutureInstallments',
                              e.target.checked,
                            )
                          }
                          className="mt-0.5 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                        />
                        <span>
                          <strong>
                            Gerar automaticamente as{' '}
                            {(itemForDetailModal.installmentTotal || 1) - 1} parcelas futuras
                          </strong>{' '}
                          como despesas projetadas nos próximos meses.
                        </span>
                      </label>
                    ) : (
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Parcela intermediária sem projeção prévia identificada. Será criada como
                        despesa confirmada deste mês.
                      </p>
                    )}
                  </div>
                )}

                {/* Lembrar regra para compras futuras */}
                {itemForDetailModal.category_id && (
                  <div className="pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                      <input
                        type="checkbox"
                        checked={itemForDetailModal.rememberRule ?? true}
                        onChange={(e) =>
                          handleUpdateItemField(
                            itemForDetailModal.id,
                            'rememberRule',
                            e.target.checked,
                          )
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                      <span className="text-slate-700 font-medium flex items-center gap-1.5 text-[11px]">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Lembrar categoria para lançamentos futuros com este nome</span>
                      </span>
                    </label>
                    {itemForDetailModal.source === 'ai_suggestion' &&
                      itemForDetailModal.aiReasoning && (
                        <p className="text-[10px] text-slate-600 mt-0.5 italic flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-brand-amber inline" strokeWidth={1.5} />
                          <span>Sugestão por IA: {itemForDetailModal.aiReasoning}</span>
                        </p>
                      )}
                  </div>
                )}

                {/* Botões do Rodapé de Detalhes: Excluir / Concluir */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      handleRemoveItem(itemForDetailModal.id)
                      setDetailModalItemId(null)
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl h-8 gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir do extrato</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setDetailModalItemId(null)}
                    className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-8 px-4"
                  >
                    Pronto
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL SECUNDÁRIO: CRIAÇÃO RÁPIDA DE NOVA CATEGORIA */}
      <Dialog open={isQuickCatOpen} onOpenChange={setIsQuickCatOpen}>
        <DialogContent
          onPointerDownOutside={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsQuickCatOpen(false)
          }}
          onInteractOutside={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsQuickCatOpen(false)
          }}
          className="max-w-sm w-[90vw] rounded-2xl p-5"
        >
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
                className="bg-brand-amber hover:bg-[#e08e08] text-brand font-bold border-0"
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
    </>
  )
}
