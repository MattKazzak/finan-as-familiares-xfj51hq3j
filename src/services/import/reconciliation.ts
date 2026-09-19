// Serviço de Conciliação Inteligente (Smart Matching / Reconciliation)
// Permite reconciliar transações manuais com extratos bancários importados (OFX / CSV / PDF)
// evitando duplicações no orçamento familiar.
import type { Transaction, TransactionType } from '@/types/finance'

export interface BankStatementCandidate {
  id: string
  date: string // YYYY-MM-DD
  amount_cents: number
  type: TransactionType
  description: string
  fitid?: string
}

export interface MatchCandidate {
  manualTransaction: Transaction
  daysDiff: number // Diferença em dias corridos (pode ser negativa se manual antes do extrato ou positiva)
  absDaysDiff: number // |dias|
  descriptionSimilarity: number // 0 a 1
}

export type MatchStatus = 'unmatched' | 'single_match' | 'multiple_candidates'

export interface ReconciliationResult {
  status: MatchStatus
  matchedTransaction: Transaction | null
  candidateTransactions: Transaction[]
  /**
   * Se true, o sistema sugere a mescla automática por ser correspondência única.
   */
  suggestAutoMerge: boolean
  matchReason?: string
}

/**
 * Calcula a diferença em dias corridos entre duas datas YYYY-MM-DD
 * (bankDate - manualDate em dias).
 * Exemplo: bankDate="2026-03-17", manualDate="2026-03-15" => +2
 */
export function getDaysDifference(bankDateStr: string, manualDateStr: string): number {
  const [bY, bM, bD] = bankDateStr.split('-').map(Number)
  const [mY, mM, mD] = manualDateStr.split('-').map(Number)

  const utcBank = Date.UTC(bY, bM - 1, bD)
  const utcManual = Date.UTC(mY, mM - 1, mD)

  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((utcBank - utcManual) / msPerDay)
}

/**
 * Normaliza string para comparação de similaridade
 */
function normalizeString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Similaridade simplificada entre duas descrições (Jaccard com tokens + substrings)
 */
export function calculateDescriptionSimilarity(a: string, b: string): number {
  const normA = normalizeString(a)
  const normB = normalizeString(b)

  if (!normA || !normB) return 0
  if (normA === normB) return 1
  if (normA.includes(normB) || normB.includes(normA)) return 0.85

  const tokensA = new Set(normA.split(' ').filter((t) => t.length > 2))
  const tokensB = new Set(normB.split(' ').filter((t) => t.length > 2))

  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let intersection = 0
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersection++
  })

  const union = new Set([...tokensA, ...tokensB]).size
  return union > 0 ? intersection / union : 0
}

/**
 * Verifica se uma transação existente no banco é elegível como transação manual para conciliação:
 * - Não deve ter bank_transaction_id / FITID vinculado anteriormente;
 * - Não deve ser uma transação 'projected' (as projeções têm seu próprio fluxo de conversão);
 * - Deve ter status 'confirmed' ou nulo.
 */
export function isEligibleManualTransaction(tx: Transaction): boolean {
  if (tx.status === 'projected') return false
  if (tx.bank_transaction_id && tx.bank_transaction_id.trim().length > 0) return false
  return true
}

/**
 * Encontra candidatas no banco de dados para uma transação do extrato.
 * Critérios:
 *  a) Mesmo valor exato (amount_cents)
 *  b) Mesmo tipo (income x income, expense x expense)
 *  c) Data dentro de janela de tolerância de ±3 dias corridos
 *  d) Transação manual sem bank_transaction_id vinculado e não já alocada em outra mescla
 *
 * @param statementTx Transação vinda do extrato
 * @param manualPool Lista de transações existentes no banco para conciliação
 * @param alreadyClaimedManualIds IDs de transações manuais já reservadas por outros itens do extrato
 * @param toleranceDays Tolerância de dias corridos (padrão: 3)
 */
export function findReconciliationMatch(
  statementTx: BankStatementCandidate,
  manualPool: Transaction[],
  alreadyClaimedManualIds: Set<string> = new Set(),
  toleranceDays: number = 3,
): ReconciliationResult {
  const candidates: MatchCandidate[] = []

  for (const manual of manualPool) {
    // 1. Não pode ter sido reivindicada por outro item anterior do extrato
    if (alreadyClaimedManualIds.has(manual.id)) continue

    // 2. Elegibilidade (sem bank_transaction_id e não projetada)
    if (!isEligibleManualTransaction(manual)) continue

    // 3. Critério a: Mesmo valor exato
    if (manual.amount_cents !== statementTx.amount_cents) continue

    // 4. Critério b: Mesmo tipo
    if (manual.type !== statementTx.type) continue

    // 5. Critério c: Janela de tolerância de ± toleranceDays corridos
    const diff = getDaysDifference(statementTx.date, manual.transaction_date)
    const absDiff = Math.abs(diff)
    if (absDiff > toleranceDays) continue

    const sim = calculateDescriptionSimilarity(
      manual.description || '',
      statementTx.description || '',
    )

    candidates.push({
      manualTransaction: manual,
      daysDiff: diff,
      absDaysDiff: absDiff,
      descriptionSimilarity: sim,
    })
  }

  if (candidates.length === 0) {
    return {
      status: 'unmatched',
      matchedTransaction: null,
      candidateTransactions: [],
      suggestAutoMerge: false,
    }
  }

  // Ordenar candidatas: menor diferença de dias primeiro, depois maior similaridade na descrição
  candidates.sort((a, b) => {
    if (a.absDaysDiff !== b.absDaysDiff) {
      return a.absDaysDiff - b.absDaysDiff
    }
    return b.descriptionSimilarity - a.descriptionSimilarity
  })

  // Se houver correspondência única:
  if (candidates.length === 1) {
    const single = candidates[0]
    const daysLabel =
      single.absDaysDiff === 0
        ? 'na mesma data'
        : `${single.absDaysDiff} dia(s) de diferença (${single.daysDiff > 0 ? '+' : ''}${single.daysDiff}d)`

    return {
      status: 'single_match',
      matchedTransaction: single.manualTransaction,
      candidateTransactions: [single.manualTransaction],
      suggestAutoMerge: true,
      matchReason: `Lançamento manual idêntico encontrado ${daysLabel}`,
    }
  }

  // Se houver múltiplas candidatas:
  // Requisito: quando houver múltiplas candidatas à mesma transação do extrato,
  // NÃO mesclar automaticamente — deixar desmarcado e sinalizar para o usuário decidir.
  return {
    status: 'multiple_candidates',
    matchedTransaction: null,
    candidateTransactions: candidates.map((c) => c.manualTransaction),
    suggestAutoMerge: false,
    matchReason: `${candidates.length} lançamentos manuais com mesmo valor encontrados na janela de ±${toleranceDays} dias`,
  }
}
