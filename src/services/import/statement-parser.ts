// Motor de parsing profissional de extratos e faturas brasileiras (PDF, OFX e CSV)
// Suporta bancos e fintechs como Nubank, Rico, Inter, Itaú, Bradesco, Santander, BTG, XP, C6, Caixa, etc.
import type { TransactionType } from '@/types/finance'

import {
  parseInstallmentFromDescription,
  type ParsedInstallmentInfo,
} from '@/services/installments'

export interface ParsedRawTransaction {
  id: string // temporário único no preview
  date: string // YYYY-MM-DD
  description: string
  amount_cents: number // positivo, centavos
  type: TransactionType
  rawLine?: string
  installmentInfo?: ParsedInstallmentInfo
}

export interface IgnoredLineInfo {
  lineNumber?: number
  text: string
  reason: string
}

export interface ParseDiagnostics {
  totalLines: number
  linesWithDate: number
  linesWithValue: number
  linesWithBoth: number
  rejectionReasons: Record<string, number>
  sampleLines?: string[]
  suggestion?: string
}

export interface ParseResult {
  success: boolean
  transactions: ParsedRawTransaction[]
  format: 'csv' | 'ofx' | 'pdf' | 'unknown'
  error?: string
  warnings?: string[]
  ignoredCount?: number
  ignoredLines?: IgnoredLineInfo[]
  diagnostics?: ParseDiagnostics
}

/**
 * Converte strings de valor variadas em centavos positivos e tipo (income | expense)
 * Exemplos aceitos:
 *  - "1.234,56", "-1.234,56", "1234,56", "-1234.56"
 *  - "R$ 4.178,98", "(148,00)", "45,00 D", "45,00 C", "45,00-"
 */
export function parseAmount(valStr: string): { amountCents: number; type: TransactionType } | null {
  if (!valStr) return null

  let clean = valStr.trim()
  if (!clean) return null

  let isNegative = false

  // Notações com D (débito/saída) ou C (crédito/entrada) no final ou início
  if (/\b(D|DEB|DEBITO)\b/i.test(clean) || clean.endsWith('-') || clean.startsWith('-')) {
    isNegative = true
  }

  // Tratar parenteses contábeis (ex: (120,50) = negativo)
  if (clean.startsWith('(') && clean.endsWith(')')) {
    isNegative = true
    clean = clean.slice(1, -1)
  }

  // Se tem sinal de menos
  if (clean.includes('-')) {
    isNegative = true
    clean = clean.replace(/-/g, '')
  }

  // Remove caracteres comuns de moeda e formatação
  clean = clean
    .replace(/\+/g, '')
    .replace(/[R$\s]/g, '')
    .replace(/\b(D|C|DEB|CRED)\b/gi, '')
    .trim()

  if (!clean) return null

  // Identificar se usa vírgula como separador decimal (1.234,56) ou ponto (1,234.56)
  if (clean.includes(',') && clean.includes('.')) {
    const lastComma = clean.lastIndexOf(',')
    const lastDot = clean.lastIndexOf('.')
    if (lastComma > lastDot) {
      // 1.234,56 (BR)
      clean = clean.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234.56 (US)
      clean = clean.replace(/,/g, '')
    }
  } else if (clean.includes(',')) {
    // 1234,56 -> 1234.56
    clean = clean.replace(',', '.')
  }

  const numericVal = parseFloat(clean)
  if (isNaN(numericVal) || !isFinite(numericVal)) return null

  const cents = Math.round(Math.abs(numericVal) * 100)
  if (cents <= 0) return null

  return {
    amountCents: cents,
    type: isNegative ? 'expense' : 'income',
  }
}

/**
 * Converte strings de data para YYYY-MM-DD com validação estrita de calendário e ano plausível (2000 até anoAtual + 1)
 */
export function parseDate(dateStr: string): string | null {
  if (!dateStr) return null
  const clean = dateStr.trim().slice(0, 10)

  const currentYear = new Date().getFullYear()
  const minYear = 2000
  const maxYear = currentYear + 1

  const validateYMD = (y: number, m: number, d: number): string | null => {
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null
    if (y < minYear || y > maxYear) return null
    if (m < 1 || m > 12) return null
    if (d < 1 || d > 31) return null

    // Validar dias por mês
    const daysInMonth = new Date(y, m, 0).getDate()
    if (d > daysInMonth) return null

    const yStr = String(y)
    const mStr = String(m).padStart(2, '0')
    const dStr = String(d).padStart(2, '0')
    return `${yStr}-${mStr}-${dStr}`
  }

  // 1. Formato YYYYMMDD ou YYYYMMDDHHMMSS (comum em OFX com ou sem fuso horario)
  if (/^\d{8}/.test(clean)) {
    const y = parseInt(clean.slice(0, 4), 10)
    const m = parseInt(clean.slice(4, 6), 10)
    const d = parseInt(clean.slice(6, 8), 10)
    return validateYMD(y, m, d)
  }

  // 2. Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map((v) => parseInt(v, 10))
    return validateYMD(y, m, d)
  }

  // 3. Formato DD/MM/YYYY ou DD/MM/YY
  const slashParts = clean.split('/')
  if (slashParts.length === 3) {
    let day = parseInt(slashParts[0], 10)
    let month = parseInt(slashParts[1], 10)
    let year = parseInt(slashParts[2], 10)
    if (slashParts[2].length === 2) {
      year = 2000 + year
    }
    // Caso esteja invertido YYYY/MM/DD
    if (day > 1000) {
      return validateYMD(day, month, year)
    }
    return validateYMD(year, month, day)
  }

  // 4. Formato DD-MM-YYYY
  const dashParts = clean.split('-')
  if (dashParts.length === 3 && dashParts[0].length === 2 && dashParts[2].length === 4) {
    const day = parseInt(dashParts[0], 10)
    const month = parseInt(dashParts[1], 10)
    const year = parseInt(dashParts[2], 10)
    return validateYMD(year, month, day)
  }

  // 5. Formato DD/MM (assume ano corrente)
  if (slashParts.length === 2 && slashParts[0].length === 2 && slashParts[1].length === 2) {
    const day = parseInt(slashParts[0], 10)
    const month = parseInt(slashParts[1], 10)
    return validateYMD(currentYear, month, day)
  }

  return null
}

// =========================================================================
// FILTROS DE RUÍDO: Cabeçalhos, Rodapés, Telefones, Resumos e Faturas BR
// =========================================================================

// Termos que NUNCA pertencem a uma transação individual e indicam cabeçalho/rodapé/resumo bancário
const NOISE_KEYWORDS: string[] = [
  // Telefones / SAC / Ouvidoria / Atendimento
  'AUTO ATENDIMENTO',
  'AUTOATENDIMENTO',
  'WHATSAPP',
  'CENTRAL DE ATENDIMENTO',
  'SAC',
  'OUVIDORIA',
  'CAPITAIS E REGIOES',
  'DEMAIS LOCALIDADES',
  'DEFICIENTES AUDITIVOS',
  'FALE CONOSCO',
  'CONSULTORIA DE INVESTIMENTOS',
  'DEFICIENCIA AUDITIVA',
  'CANAL DE DENUNCIA',

  // Cabeçalhos de fatura de cartão / dados do titular / endereço
  'TITULAR',
  'ENDERECO',
  'ENDEREÇO',
  'VENCIMENTO',
  'RESUMO DA SUA FATURA',
  'RESUMO DA FATURA',
  'TOTAL DA FATURA',
  'FATURA ANTERIOR',
  'PAGAMENTO MINIMO',
  'PAGAMENTO MÍNIMO',
  'LIMITE TOTAL',
  'LIMITE DISPONIVEL',
  'LIMITE UTILIZADO',
  'PONTOS DO CARTAO',
  'TOTAL DESTA FATURA',
  'SUA FATURA',
  'CARTAO RICO',
  'CARTÃO RICO',
  'RICO VISA INFINITE',
  'VISA INFINITE',
  'MASTERCARD BLACK',
  'ELO NANQUIM',
  'NUMERO DA CONTA',
  'AGENCIA/CONTA',
  'AGENCIA',
  'AGÊNCIA',
  'CONTA CORRENTE',
  'EXTRATO MENSAL',
  'EXTRATO DE CONTA',
  'EXTRATO DE CONTA CORRENTE',
  'DEMONSTRATIVO',
  'PERIODO DE',
  'PERÍODO DE',

  // Totais e Saldos
  'SALDO ANTERIOR',
  'SALDO ATUAL',
  'SALDO DISPONIVEL',
  'SALDO DO DIA',
  'SALDO FINAL',
  'SALDO BLOQUEADO',
  'TOTAL DE CREDITOS',
  'TOTAL DE DEBITOS',
  'TOTAL GERAL',
  'SUBTOTAL',
  'ENCARGOS TOTAIS',
  'CET ANUAL',
  'JUROS DE MORA',

  // Dados legais e cadastrais
  'CNPJ',
  'CPF',
  'INSCRICAO ESTADUAL',
  'INSCRIÇÃO ESTADUAL',
  'BANCO XP S.A',
  'BANCO RICO',
  'BANCO DO BRASIL S.A',
  'BANCO BRADESCO S.A',
  'BANCO ITAU S.A',
  'BANCO SANTANDER',
  'WWW.',
  'HTTP://',
  'HTTPS://',
  '.COM.BR',
]

/**
 * Normaliza string removendo acentos para checagens case-insensitive
 */
function cleanForNoiseCheck(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

/**
 * Identifica se uma linha de texto é ruído (cabeçalho, rodapé, atendimento, totais, URLs)
 */
export function isNoiseLine(line: string): { isNoise: boolean; reason?: string } {
  if (!line || line.trim().length === 0) {
    return { isNoise: true, reason: 'Linha vazia' }
  }

  const clean = cleanForNoiseCheck(line)

  // 1. Telefones e padrões de contato BR: "+55", "(11)", "0800", "3003", "4004"
  if (
    /\+55\b/.test(clean) ||
    /\b0800\s*\d{3}\s*\d{4}\b/.test(clean) ||
    /\b(3003|4004|4003|4935|3004)[-\s]?\d{4}\b/.test(clean) ||
    /\(\d{2}\)\s*\d{4,5}[-\s]?\d{4}/.test(clean)
  ) {
    return { isNoise: true, reason: 'Contém número de telefone ou canal de atendimento' }
  }

  // 2. URLs e links
  if (/https?:\/\/|www\.|\.com\.br|\.com\b/i.test(line)) {
    return { isNoise: true, reason: 'Contém endereço de site ou URL' }
  }

  // 3. Palavras-chave de cabeçalho e rodapé
  for (const kw of NOISE_KEYWORDS) {
    if (clean.includes(kw)) {
      return { isNoise: true, reason: `Contém palavra-chave de rodapé/cabeçalho: "${kw}"` }
    }
  }

  // 4. CEP
  if (/\bCEP\s*:?\s*\d{5}[-\s]?\d{3}\b/i.test(line)) {
    return { isNoise: true, reason: 'Contém CEP de endereço' }
  }

  return { isNoise: false }
}

/**
 * Validação semântica da descrição:
 * Rejeita descrições gigantes (>200 chars), curtas demais (<2 chars), ou compostas apenas de dígitos/símbolos.
 */
export function isValidDescription(desc: string): boolean {
  if (!desc) return false
  const trimmed = desc.trim()
  if (trimmed.length < 2 || trimmed.length > 200) return false

  // Se for apenas números, barras, traços ou pontuações
  const letters = trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, '')
  if (letters.length < 2) return false

  return true
}

/**
 * Classificação inteligente para cartão de crédito:
 * Em faturas de cartão de crédito, compras e lançamentos são DESPESAS (expense).
 * Só são income se contiverem palavras claras de reembolso, estorno, pagamento de fatura recebido ou crédito de volta.
 */
export function resolveCreditCardTransactionType(
  rawType: TransactionType,
  description: string,
): TransactionType {
  const norm = cleanForNoiseCheck(description)

  // Palavras claras de crédito/estorno/reembolso
  const isCreditWord =
    norm.includes('ESTORNO') ||
    norm.includes('REEMBOLSO') ||
    norm.includes('CASHBACK') ||
    norm.includes('CREDITO CONCEDIDO') ||
    norm.includes('PAGAMENTO RECEBIDO') ||
    norm.includes('SALARIO') ||
    norm.includes('SALÁRIO')

  if (isCreditWord) {
    return 'income'
  }

  // Por padrão de fatura, qualquer lançamento de compra é despesa
  return 'expense'
}

/**
 * Deduplica transações com mesma data + descrição + valor dentro do lote do mesmo arquivo
 */
export function deduplicateTransactions(transactions: ParsedRawTransaction[]): {
  unique: ParsedRawTransaction[]
  duplicatesRemoved: number
} {
  const seen = new Set<string>()
  const unique: ParsedRawTransaction[] = []
  let duplicatesRemoved = 0

  for (const tx of transactions) {
    const key = `${tx.date}|${tx.amount_cents}|${tx.description.toLowerCase().trim()}|${tx.type}`
    if (seen.has(key)) {
      duplicatesRemoved++
      continue
    }
    seen.add(key)
    unique.push(tx)
  }

  return { unique, duplicatesRemoved }
}

// ==========================================
// 1. PARSER CSV (Bancos BR: Nubank, Inter, Itaú, Bradesco, etc.)
// ==========================================
export function parseCSV(content: string): ParseResult {
  const rawLines = content.split(/\r?\n/)
  const ignoredLines: IgnoredLineInfo[] = []

  if (rawLines.length < 2) {
    return {
      success: false,
      transactions: [],
      format: 'csv',
      error: 'O arquivo CSV está vazio ou possui apenas cabeçalho.',
      ignoredLines: [],
      ignoredCount: 0,
    }
  }

  // Detectar delimitador (; ou , ou \t)
  const headerCandidate = rawLines.find((l) => l.trim().length > 0) || rawLines[0]
  const semicolonCount = (headerCandidate.match(/;/g) || []).length
  const commaCount = (headerCandidate.match(/,/g) || []).length
  const tabCount = (headerCandidate.match(/\t/g) || []).length

  let delimiter = ','
  if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';'
  else if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t'

  const splitLine = (line: string): string[] => {
    const pattern = new RegExp(
      `(?:^|${delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}]*))`,
      'g',
    )
    const matches: string[] = []
    let match
    while ((match = pattern.exec(line)) !== null) {
      let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2]
      matches.push(val ? val.trim() : '')
    }
    return matches
  }

  // Encontrar a primeira linha que parece ser cabeçalho de colunas
  let headerIndex = -1
  let dateIdx = -1
  let descIdx = -1
  let amountIdx = -1
  let creditIdx = -1
  let debitIdx = -1

  for (let i = 0; i < Math.min(rawLines.length, 10); i++) {
    const cols = splitLine(rawLines[i]).map((h) =>
      h
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim(),
    )

    const dIdx = cols.findIndex((h) =>
      ['data', 'date', 'data lancamento', 'data movimento', 'dt'].some(
        (k) => h === k || h.includes(k),
      ),
    )
    const dsIdx = cols.findIndex((h) =>
      [
        'descricao',
        'description',
        'historico',
        'estabelecimento',
        'titulo',
        'detalhe',
        'memo',
      ].some((k) => h === k || h.includes(k)),
    )
    const aIdx = cols.findIndex((h) =>
      ['valor', 'amount', 'valor (r$)', 'quantia', 'valor r$'].some(
        (k) => h === k || h.includes(k),
      ),
    )
    const cIdx = cols.findIndex((h) =>
      ['credito', 'entrada', 'receita', 'credito (r$)'].some((k) => h === k || h.includes(k)),
    )
    const debIdx = cols.findIndex((h) =>
      ['debito', 'saida', 'despesa', 'debito (r$)'].some((k) => h === k || h.includes(k)),
    )

    if (dIdx !== -1 && (aIdx !== -1 || (cIdx !== -1 && debIdx !== -1))) {
      headerIndex = i
      dateIdx = dIdx
      descIdx = dsIdx
      amountIdx = aIdx
      creditIdx = cIdx
      debitIdx = debIdx
      break
    }
  }

  // Se não identificou cabeçalho por palavras-chave conhecidas (ou arquivo sem cabeçalho):
  // Fazer detecção automática por amostragem dos dados (amostra até 30 linhas)
  if (
    headerIndex === -1 ||
    dateIdx === -1 ||
    (amountIdx === -1 && (creditIdx === -1 || debitIdx === -1))
  ) {
    // Determinar se a primeira linha (ou linha 0) é um cabeçalho ou já dados
    const sampleRows: { lineIdx: number; row: string[] }[] = []
    for (let i = 0; i < Math.min(rawLines.length, 35); i++) {
      const row = splitLine(rawLines[i])
      if (row.length >= 2) {
        sampleRows.push({ lineIdx: i, row })
      }
    }

    const maxCols = Math.max(...sampleRows.map((s) => s.row.length), 0)
    const dateScores = new Array(maxCols).fill(0)
    const amountScores = new Array(maxCols).fill(0)
    const textScores = new Array(maxCols).fill(0)

    for (const sample of sampleRows) {
      sample.row.forEach((colVal, colI) => {
        if (!colVal) return
        if (parseDate(colVal)) {
          dateScores[colI]++
        }
        if (parseAmount(colVal)) {
          amountScores[colI]++
        }
        if (colVal.length >= 3 && !parseDate(colVal) && !parseAmount(colVal)) {
          textScores[colI]++
        }
      })
    }

    // A coluna com mais datas
    let bestDateCol = -1
    let maxDateCount = 0
    dateScores.forEach((cnt, colI) => {
      if (cnt > maxDateCount) {
        maxDateCount = cnt
        bestDateCol = colI
      }
    })

    // Colunas candidatas a valor (excluindo a coluna de data)
    const amountCandidates: { col: number; score: number }[] = []
    amountScores.forEach((cnt, colI) => {
      if (colI !== bestDateCol && cnt > 0) {
        amountCandidates.push({ col: colI, score: cnt })
      }
    })
    amountCandidates.sort((a, b) => b.score - a.score)

    if (bestDateCol !== -1 && amountCandidates.length > 0) {
      dateIdx = bestDateCol

      // Se temos pelo menos 2 colunas fortes de valor, checar se podem ser Débito e Crédito
      if (
        creditIdx === -1 &&
        debitIdx === -1 &&
        amountCandidates.length >= 2 &&
        amountCandidates[1].score >= Math.max(1, Math.floor(sampleRows.length * 0.15))
      ) {
        // Possível débito e crédito separados
        // Tentar manter o que foi achado ou associar
        debitIdx = amountCandidates[0].col
        creditIdx = amountCandidates[1].col
        amountIdx = -1
      } else {
        amountIdx = amountCandidates[0].col
      }

      // Descrição: melhor coluna de texto que não seja data nem valor
      let bestDescCol = -1
      let maxTextCount = -1
      textScores.forEach((cnt, colI) => {
        if (
          colI !== dateIdx &&
          colI !== amountIdx &&
          colI !== creditIdx &&
          colI !== debitIdx &&
          cnt > maxTextCount
        ) {
          maxTextCount = cnt
          bestDescCol = colI
        }
      })
      if (bestDescCol !== -1) {
        descIdx = bestDescCol
      }

      // Se a linha 0 não tem data nem valor válidos na coluna de data/valor, é cabeçalho
      const firstRow = sampleRows[0]?.row
      const firstRowHasDate = firstRow && parseDate(firstRow[dateIdx])
      if (firstRowHasDate) {
        headerIndex = -1 // Começa a ler da linha 0
      } else {
        headerIndex = 0
      }
    } else {
      // Fallback clássico se nem a amostragem encontrou
      if (headerIndex === -1) headerIndex = 0
      if (dateIdx === -1) dateIdx = 0
      if (descIdx === -1) descIdx = 1
      if (amountIdx === -1) amountIdx = 2
    }
  }

  const rawTransactions: ParsedRawTransaction[] = []
  const rejectionReasons: Record<string, number> = {}
  let linesWithDate = 0
  let linesWithValue = 0
  let linesWithBoth = 0
  const sampleLines: string[] = []

  const startLine = headerIndex >= 0 ? headerIndex + 1 : 0

  for (let i = startLine; i < rawLines.length; i++) {
    const line = rawLines[i].trim()
    if (!line) continue

    if (sampleLines.length < 5) {
      sampleLines.push(line.length > 80 ? line.slice(0, 80) + '...' : line)
    }

    // Checar se a linha é ruído de extrato (ex: SALDO ANTERIOR, TOTAL, telefones)
    const noise = isNoiseLine(line)
    if (noise.isNoise) {
      const reason = noise.reason || 'Ruído detectado'
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1
      ignoredLines.push({
        lineNumber: i + 1,
        text: line,
        reason,
      })
      continue
    }

    const row = splitLine(line)
    if (row.length < 2) {
      const reason = 'Colunas insuficientes'
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1
      ignoredLines.push({ lineNumber: i + 1, text: line, reason })
      continue
    }

    const rawDate = dateIdx >= 0 && dateIdx < row.length ? row[dateIdx] : ''
    const parsedDate = parseDate(rawDate)

    // Checar valor
    let hasVal = false
    let amountCents = 0
    let type: TransactionType = 'expense'

    if (creditIdx !== -1 && debitIdx !== -1 && creditIdx < row.length && debitIdx < row.length) {
      const creditVal = parseAmount(row[creditIdx])
      const debitVal = parseAmount(row[debitIdx])

      if (creditVal && creditVal.amountCents > 0) {
        amountCents = creditVal.amountCents
        type = 'income'
        hasVal = true
      } else if (debitVal && debitVal.amountCents > 0) {
        amountCents = debitVal.amountCents
        type = 'expense'
        hasVal = true
      }
    } else if (amountIdx !== -1 && amountIdx < row.length && row[amountIdx]) {
      const parsedAmount = parseAmount(row[amountIdx])
      if (parsedAmount && parsedAmount.amountCents > 0) {
        amountCents = parsedAmount.amountCents
        type = parsedAmount.type
        hasVal = true
      }
    }

    if (parsedDate) linesWithDate++
    if (hasVal) linesWithValue++
    if (parsedDate && hasVal) linesWithBoth++

    if (!parsedDate) {
      const reason = rawDate ? `Data não reconhecida (${rawDate})` : 'Linha sem campo de data'
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1
      ignoredLines.push({
        lineNumber: i + 1,
        text: line,
        reason,
      })
      continue
    }

    let description =
      descIdx !== -1 && row[descIdx] ? row[descIdx].replace(/^["']|["']$/g, '').trim() : ''

    // Se a coluna de descrição escolhida estiver vazia, procurar na linha a primeira coluna textual válida
    if (!description) {
      for (let c = 0; c < row.length; c++) {
        if (c !== dateIdx && c !== amountIdx && c !== creditIdx && c !== debitIdx) {
          const cand = row[c]?.replace(/^["']|["']$/g, '').trim()
          if (cand && isValidDescription(cand)) {
            description = cand
            break
          }
        }
      }
    }

    if (!isValidDescription(description)) {
      const reason = description
        ? `Descrição inválida (${description.slice(0, 30)})`
        : 'Descrição vazia ou inexistente'
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1
      ignoredLines.push({ lineNumber: i + 1, text: line, reason })
      continue
    }

    if (amountCents <= 0) {
      const reason = 'Valor zerado ou não identificado na linha'
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1
      ignoredLines.push({ lineNumber: i + 1, text: line, reason })
      continue
    }

    const installmentInfo = parseInstallmentFromDescription(description)

    rawTransactions.push({
      id: `csv-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: parsedDate,
      description,
      amount_cents: amountCents,
      type,
      rawLine: line,
      installmentInfo: installmentInfo.isInstallment ? installmentInfo : undefined,
    })
  }

  // Deduplicação interna
  const { unique, duplicatesRemoved } = deduplicateTransactions(rawTransactions)
  const warnings: string[] = []
  if (duplicatesRemoved > 0) {
    warnings.push(`${duplicatesRemoved} lançamento(s) duplicado(s) descartado(s) automaticamente.`)
  }

  const totalLines = rawLines.filter((l) => l.trim().length > 0).length

  if (unique.length === 0) {
    let suggestion =
      'Verifique se o arquivo possui colunas com data (ex.: DD/MM/AAAA) e valores numéricos válidos.'
    if (linesWithDate > 0 && linesWithValue === 0) {
      suggestion = `Identificamos ${linesWithDate} linha(s) com data, mas nenhuma coluna com valor legível. Certifique-se de que a coluna de valor não contém caracteres adicionais ou exporte novamente do seu banco.`
    } else if (linesWithValue > 0 && linesWithDate === 0) {
      suggestion = `Identificamos ${linesWithValue} linha(s) com valores monetários, mas nenhuma data válida brasileira (dd/mm/aaaa ou yyyy-mm-dd).`
    } else if (linesWithBoth > 0) {
      suggestion = `${linesWithBoth} linha(s) continham data e valor, mas foram rejeitadas pelo filtro de ruído ou descrição inválida.`
    }

    return {
      success: false,
      transactions: [],
      format: 'csv',
      error: `Não encontramos lançamentos válidos neste arquivo CSV (${linesWithDate} linha(s) com data e ${linesWithValue} com valor encontradas).`,
      ignoredLines,
      ignoredCount: ignoredLines.length,
      warnings,
      diagnostics: {
        totalLines,
        linesWithDate,
        linesWithValue,
        linesWithBoth,
        rejectionReasons,
        sampleLines,
        suggestion,
      },
    }
  }

  return {
    success: true,
    transactions: unique,
    format: 'csv',
    ignoredLines,
    ignoredCount: ignoredLines.length,
    warnings,
    diagnostics: {
      totalLines,
      linesWithDate,
      linesWithValue,
      linesWithBoth,
      rejectionReasons,
    },
  }
}

// ==========================================
// 2. PARSER OFX (Open Financial Exchange - SGML 1.x / XML 2.x)
// ==========================================

/**
 * Decodifica entidades HTML/XML comuns presentes em descrições de arquivos OFX
 */
function decodeOFXEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
}

/**
 * Extrai o valor de uma tag OFX dentro de um bloco de transação.
 * Suporta XML (<TAG>valor</TAG> ou <TAG val="..."/>) e SGML (<TAG>valor\n sem tag de fechamento).
 */
function extractOFXTagValue(block: string, tagName: string): string {
  if (!block || !tagName) return ''

  // 1. Tag fechada clássica XML: <TAG>valor</TAG>
  const closedRegex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i')
  const closedMatch = closedRegex.exec(block)
  if (closedMatch && closedMatch[1] !== undefined) {
    return decodeOFXEntities(closedMatch[1].trim())
  }

  // 2. Tag SGML sem fechamento (padrão bancos brasileiros como Inter, Itaú, Nubank):
  // <TAG>valor seguido por quebra de linha ou pela abertura da próxima tag <
  const sgmlRegex = new RegExp(`<${tagName}>([^<\\r\\n]+)`, 'i')
  const sgmlMatch = sgmlRegex.exec(block)
  if (sgmlMatch && sgmlMatch[1] !== undefined) {
    return decodeOFXEntities(sgmlMatch[1].trim())
  }

  return ''
}

/**
 * Divide o conteúdo OFX em blocos de transação <STMTTRN>.
 * Trata tanto XML 2.x (com </STMTTRN>) quanto SGML 1.x (sem </STMTTRN>, onde cada <STMTTRN>
 * vai até o próximo <STMTTRN> ou tag delimitadora final como </BANKTRANLIST>, </CCSTMTRS>, etc.)
 */
function extractOFXTransactionBlocks(content: string): string[] {
  const blocks: string[] = []

  // Testar se tem </STMTTRN> (XML ou SGML bem comportado)
  if (/<\/STMTTRN>/i.test(content)) {
    const xmlRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
    let match: RegExpExecArray | null
    while ((match = xmlRegex.exec(content)) !== null) {
      if (match[1] && match[1].trim()) {
        blocks.push(match[1])
      }
    }
    if (blocks.length > 0) return blocks
  }

  // Se não tem </STMTTRN> (SGML padrão bancos BR como Banco Inter, Caixa, BB):
  // Dividir o texto por <STMTTRN> e processar cada fatia
  const parts = content.split(/<STMTTRN>/i)
  // A primeira parte (parts[0]) é o cabeçalho antes do primeiro <STMTTRN>
  for (let i = 1; i < parts.length; i++) {
    let part = parts[i]
    // Cortar se encontrar o fechamento de listas ou tags de fechamento do bloco pai
    const closingIdx = part.search(
      /<\/(?:BANKTRANLIST|CCDATA|CCSTMTRS|STMTRS|BANKMSGSRSV1|CREDITCARDMSGSRSV1|OFX)>/i,
    )
    if (closingIdx !== -1) {
      part = part.substring(0, closingIdx)
    }
    if (part.trim()) {
      blocks.push(part)
    }
  }

  return blocks
}

export function parseOFX(content: string): ParseResult {
  const ignoredLines: IgnoredLineInfo[] = []

  if (!content || !content.trim()) {
    return {
      success: false,
      transactions: [],
      format: 'ofx',
      error: 'O arquivo OFX selecionado está vazio.',
      ignoredLines: [],
      ignoredCount: 0,
    }
  }

  // Diagnóstico amigável e claro caso não pareça um OFX válido
  if (!/<STMTTRN/i.test(content)) {
    return {
      success: false,
      transactions: [],
      format: 'ofx',
      error:
        'Isto não parece um extrato OFX válido (nenhum bloco de transações <STMTTRN> foi encontrado). Tem certeza de que exportou no formato OFX no seu banco?',
      ignoredLines: [],
      ignoredCount: 0,
    }
  }

  // Detectar se o arquivo trata de fatura de cartão de crédito (<CCSTMTRS>, <CCDATA>, <CREDITCARDMSGSRSV1>)
  const isCreditCardOFX =
    /<CCSTMTRS>/i.test(content) ||
    /<CREDITCARDMSGSRSV1>/i.test(content) ||
    /<CCDATA>/i.test(content)

  const rawBlocks = extractOFXTransactionBlocks(content)
  const transactions: ParsedRawTransaction[] = []
  let count = 0

  for (const block of rawBlocks) {
    count++

    const trntype = extractOFXTagValue(block, 'TRNTYPE').toUpperCase()
    const dtpostedRaw = extractOFXTagValue(block, 'DTPOSTED')
    const trnamtRaw = extractOFXTagValue(block, 'TRNAMT')
    const memo = extractOFXTagValue(block, 'MEMO')
    const name = extractOFXTagValue(block, 'NAME')

    // Data: DTPOSTED pode vir no formato YYYYMMDD, YYYYMMDDHHMMSS ou com fuso horario
    const date = parseDate(dtpostedRaw)
    if (!date) {
      ignoredLines.push({
        lineNumber: count,
        text: block.replace(/\s+/g, ' ').trim().slice(0, 100),
        reason: dtpostedRaw ? `Data DTPOSTED inválida (${dtpostedRaw})` : 'Transação sem DTPOSTED',
      })
      continue
    }

    // Descrição: preferir MEMO, depois NAME. Se ambos existirem e forem diferentes, usar o mais detalhado
    let description = memo || name || ''
    if (memo && name && memo !== name) {
      // Se MEMO é mais longo/rico que NAME (ou vice-versa)
      description = memo.length >= name.length ? memo : name
    }

    // Limpar descrição de espaços excessivos e aspas
    description = description.replace(/^["']|["']$/g, '').trim()

    if (!isValidDescription(description)) {
      ignoredLines.push({
        lineNumber: count,
        text: block.replace(/\s+/g, ' ').trim().slice(0, 100),
        reason: description
          ? `Descrição MEMO/NAME inválida (${description.slice(0, 30)})`
          : 'Transação sem descrição (MEMO/NAME vazios)',
      })
      continue
    }

    // Valor: TRNAMT pode vir com ponto (-250.00), com vírgula (-250,00) ou formato brasileiro (1.234,56)
    const parsedAmt = parseAmount(trnamtRaw)
    if (!parsedAmt || parsedAmt.amountCents <= 0) {
      ignoredLines.push({
        lineNumber: count,
        text: block.replace(/\s+/g, ' ').trim().slice(0, 100),
        reason: trnamtRaw ? `Valor TRNAMT inválido (${trnamtRaw})` : 'Transação sem valor TRNAMT',
      })
      continue
    }

    // Resolução do tipo (income vs expense)
    let finalType: TransactionType = parsedAmt.type

    if (isCreditCardOFX) {
      // Em faturas de cartão de crédito (CCSTMTRS), a imensa maioria dos lançamentos são despesas
      // Exceções: estornos, cashback, pagamentos recebidos
      finalType = resolveCreditCardTransactionType(parsedAmt.type, description)
    } else {
      // Em conta corrente (STMTTRS):
      // TRNTYPE dá pistas fortes:
      if (
        trntype === 'CREDIT' ||
        trntype === 'DEP' ||
        trntype === 'INT' ||
        trntype === 'DIV' ||
        trntype === 'DIRECTDEP'
      ) {
        finalType = 'income'
      } else if (
        trntype === 'DEBIT' ||
        trntype === 'PAYMENT' ||
        trntype === 'FEE' ||
        trntype === 'SRVCHG' ||
        trntype === 'POS' ||
        trntype === 'ATM' ||
        trntype === 'CHECK'
      ) {
        finalType = 'expense'
      } else {
        // Se TRNTYPE for OTHER ou não mapeado, respeita o sinal numérico do TRNAMT
        finalType = parsedAmt.type
      }
    }

    const installmentInfo = parseInstallmentFromDescription(description)

    transactions.push({
      id: `ofx-${count}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date,
      description,
      amount_cents: parsedAmt.amountCents,
      type: finalType,
      installmentInfo: installmentInfo.isInstallment ? installmentInfo : undefined,
    })
  }

  const { unique, duplicatesRemoved } = deduplicateTransactions(transactions)
  const warnings: string[] = []
  if (duplicatesRemoved > 0) {
    warnings.push(`${duplicatesRemoved} lançamento(s) duplicado(s) descartado(s) do OFX.`)
  }

  if (unique.length === 0) {
    return {
      success: false,
      transactions: [],
      format: 'ofx',
      error:
        'Não encontramos lançamentos válidos neste arquivo OFX. Verifique se o extrato possui transações no período selecionado.',
      ignoredLines,
      ignoredCount: ignoredLines.length,
      warnings,
    }
  }

  return {
    success: true,
    transactions: unique,
    format: 'ofx',
    ignoredLines,
    ignoredCount: ignoredLines.length,
    warnings,
  }
}

// ==========================================
// 3. PARSER PDF (Extração de texto e linhas de extrato / fatura)
// ==========================================

/**
 * Item posicionado extraído do PDF com coordenadas geométricas
 */
export interface PDFTextItemPositioned {
  str: string
  x: number
  y: number
  width?: number
  height?: number
}

/**
 * Agrupa itens de texto extraídos de uma página PDF por proximidade no eixo Y (mesma linha visual)
 * e ordena os itens de cada linha da esquerda para a direita pelo eixo X.
 * Tolerância típica: ~3 a 5 pontos verticais para acomodar fontes ligeiramente desalinhadas.
 */
export function reconstructLinesFromPositionedItems(
  items: PDFTextItemPositioned[],
  yTolerance: number = 4,
): string[] {
  if (!items || items.length === 0) return []

  // Filtrar itens vazios
  const validItems = items.filter(
    (it) => it && typeof it.str === 'string' && it.str.trim().length > 0,
  )
  if (validItems.length === 0) return []

  // Agrupar por Y aproximado
  // Observação: no PDF coordinate space, Y normalmente cresce de baixo para cima (bottom-left origin).
  // Agrupamos itens cujo Y esteja dentro de yTolerance.
  interface LineGroup {
    y: number
    items: PDFTextItemPositioned[]
  }

  const groups: LineGroup[] = []

  for (const item of validItems) {
    const matchedGroup = groups.find((g) => Math.abs(g.y - item.y) <= yTolerance)
    if (matchedGroup) {
      matchedGroup.items.push(item)
      // Ajusta Y médio do grupo para estabilidade
      matchedGroup.y =
        (matchedGroup.y * (matchedGroup.items.length - 1) + item.y) / matchedGroup.items.length
    } else {
      groups.push({
        y: item.y,
        items: [item],
      })
    }
  }

  // Ordenar grupos verticais: do topo da página para o final
  // No PDF.js padrão, Y maior significa mais alto na página.
  groups.sort((a, b) => b.y - a.y)

  // Em cada grupo, ordenar da esquerda para a direita (X crescente)
  const lines: string[] = []
  for (const group of groups) {
    group.items.sort((a, b) => a.x - b.x)
    const lineText = group.items.map((it) => it.str.trim()).join(' ')
    if (lineText.trim()) {
      lines.push(lineText.trim())
    }
  }

  return lines
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()

  const getPdfJs = async (): Promise<any> => {
    if ((window as any).pdfjsLib) {
      return (window as any).pdfjsLib
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      script.onload = () => {
        const lib = (window as any).pdfjsLib
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
          resolve(lib)
        } else {
          reject(new Error('PDF.js carregado mas global não definida'))
        }
      }
      script.onerror = () => reject(new Error('Falha ao carregar o motor de leitura de PDF.'))
      document.head.appendChild(script)
    })
  }

  const pdfjs = await getPdfJs()
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) })
  const doc = await loadingTask.promise
  const pageLinesAccumulator: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()

    // Extrair itens com coordenadas transform: [scaleX, skewY, skewX, scaleY, transX, transY]
    const positionedItems: PDFTextItemPositioned[] = []

    for (const item of textContent.items) {
      if (!item || typeof item.str !== 'string') continue
      const str = item.str
      // transform[4] = x, transform[5] = y
      if (Array.isArray(item.transform) && item.transform.length >= 6) {
        const x = item.transform[4]
        const y = item.transform[5]
        positionedItems.push({
          str,
          x,
          y,
          width: item.width,
          height: item.height,
        })
      } else {
        // Fallback caso não tenha transform
        positionedItems.push({
          str,
          x: 0,
          y: 0,
        })
      }
    }

    const reconstructed = reconstructLinesFromPositionedItems(positionedItems)
    if (reconstructed.length > 0) {
      pageLinesAccumulator.push(...reconstructed)
    } else {
      // Fallback para caso nenhum item seja posicionado
      const rawFallback = textContent.items.map((item: any) => item.str).join(' ')
      if (rawFallback.trim()) pageLinesAccumulator.push(rawFallback)
    }
  }

  return pageLinesAccumulator.join('\n')
}

/**
 * Parser robusto de nível profissional para texto extraído de extrato ou fatura de cartão em PDF.
 * Detecta se é fatura de cartão (ex: Cartão Rico, Nubank, Itaú Cartões) e aplica as regras estruturais estritas:
 *  - Ignora ruído de cabeçalho, rodapé e telefones de atendimento.
 *  - Só aceita linha que contenha uma data válida E um valor monetário brasileiro.
 *  - Descrição é o texto entre a data e o valor, devidamente sanitizado.
 *  - Linhas de fatura de cartão são despesas (expense) por padrão, a não ser que indiquem estorno/salário.
 *  - Deduplicação no arquivo.
 */
export function parsePDFText(text: string): ParseResult {
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      transactions: [],
      format: 'pdf',
      error: 'Não foi possível extrair texto do arquivo PDF.',
      ignoredLines: [],
      ignoredCount: 0,
    }
  }

  const ignoredLines: IgnoredLineInfo[] = []
  const rawTransactions: ParsedRawTransaction[] = []

  // Detecta se o documento é uma fatura de cartão de crédito (ex.: "Cartão Rico", "fatura", "Visa Infinite")
  const normFullText = cleanForNoiseCheck(text)
  const isCreditCardInvoice =
    normFullText.includes('FATURA') ||
    normFullText.includes('CARTAO RICO') ||
    normFullText.includes('CARTÃO RICO') ||
    normFullText.includes('VISA INFINITE') ||
    normFullText.includes('MASTERCARD') ||
    normFullText.includes('RESUMO DA SUA FATURA')

  // Quebrar por quebras de linha
  const lines = text.split(/\r?\n/)

  // Regex para data válida no padrão brasileiro (DD/MM/YYYY, DD/MM/YY ou DD/MM) ou ISO (YYYY-MM-DD)
  const dateRegex = /\b(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}(?:\/\d{2,4})?|\d{2}-\d{2}-\d{4})\b/
  // Regex para valor monetário BR: "1.234,56", "1234,56", "R$ 148,00", "-50,00", "45,00 D"
  const amountRegex =
    /([+-]?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}\b(?:\s*[DC])?|[+-]?\s*(?:R\$\s*)?\d+,\d{2}\b(?:\s*[DC])?)/g

  let lineCount = 0
  const rejectionReasons: Record<string, number> = {}
  let linesWithDate = 0
  let linesWithValue = 0
  let linesWithBoth = 0
  const sampleLines: string[] = []

  for (const rawLine of lines) {
    lineCount++
    const line = rawLine.trim()
    if (!line) continue

    if (sampleLines.length < 5) {
      sampleLines.push(line.length > 80 ? line.slice(0, 80) + '...' : line)
    }

    // 1. Filtrar ruído (cabeçalho, rodapé, telefones, canais de atendimento, URLs)
    const noiseCheck = isNoiseLine(line)
    if (noiseCheck.isNoise) {
      const reason = noiseCheck.reason || 'Linha de cabeçalho ou rodapé ignorada'
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1
      ignoredLines.push({
        lineNumber: lineCount,
        text: line.length > 90 ? line.slice(0, 90) + '...' : line,
        reason,
      })
      continue
    }

    // 2. Validação estrutural: precisa de data E valor monetário
    const dateMatch = line.match(dateRegex)
    const amountMatches = line.match(amountRegex)

    // Validar se a data e o valor encontrados são de fato válidos pelo parser
    const rawDateCand = dateMatch ? dateMatch[0] : ''
    const fullDateStr =
      rawDateCand.length === 5 ? `${rawDateCand}/${new Date().getFullYear()}` : rawDateCand
    const parsedDateCand = rawDateCand ? parseDate(fullDateStr) : null

    const lastAmtMatch =
      amountMatches && amountMatches.length > 0 ? amountMatches[amountMatches.length - 1] : ''
    const parsedAmtCand = lastAmtMatch ? parseAmount(lastAmtMatch) : null

    if (parsedDateCand) linesWithDate++
    if (parsedAmtCand && parsedAmtCand.amountCents > 0) linesWithValue++
    if (parsedDateCand && parsedAmtCand && parsedAmtCand.amountCents > 0) linesWithBoth++

    if (!parsedDateCand || !parsedAmtCand || parsedAmtCand.amountCents <= 0) {
      let reason = 'Linha sem estrutura de data e valor'
      if (!parsedDateCand && (!parsedAmtCand || parsedAmtCand.amountCents <= 0)) {
        reason = 'Sem data e sem valor na linha'
      } else if (!parsedDateCand) {
        reason = rawDateCand
          ? `Data inválida ou fora do intervalo (${rawDateCand})`
          : 'Não possui data na linha'
      } else {
        reason = lastAmtMatch
          ? `Valor monetário zerado ou inválido (${lastAmtMatch})`
          : 'Não possui valor monetário na linha'
      }
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1
      ignoredLines.push({
        lineNumber: lineCount,
        text: line.length > 90 ? line.slice(0, 90) + '...' : line,
        reason,
      })
      continue
    }

    const parsedDate = parsedDateCand
    const parsedAmt = parsedAmtCand

    // 5. Descrição: extrair o texto limpo da linha, removendo a data, o valor e prefixos monetários
    let desc = line
      .replace(dateRegex, ' ')
      .replace(amountRegex, ' ')
      .replace(/R\$/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Se sobrou apenas caracteres soltos ou a descrição for ruído disfarçado
    if (!isValidDescription(desc)) {
      const reason = `Descrição inválida ou insuficiente: "${desc.slice(0, 30)}"`
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1
      ignoredLines.push({
        lineNumber: lineCount,
        text: line,
        reason,
      })
      continue
    }

    // Checar novamente se a própria descrição residual contém termos proibidos
    const descNoise = isNoiseLine(desc)
    if (descNoise.isNoise) {
      const reason = descNoise.reason || 'Descrição contém termos de rodapé/cabeçalho'
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1
      ignoredLines.push({
        lineNumber: lineCount,
        text: line,
        reason,
      })
      continue
    }

    // 6. Resolução do tipo de transação (income vs expense)
    let finalType: TransactionType = parsedAmt.type
    if (isCreditCardInvoice) {
      // Em faturas de cartão de crédito, compras são sempre DESPESA, a não ser estornos/reembolsos
      finalType = resolveCreditCardTransactionType(parsedAmt.type, desc)
    } else {
      // Se a descrição for claramente de salário ou remuneração, é income mesmo que não venha com sinal explícito
      const normDesc = cleanForNoiseCheck(desc)
      if (
        normDesc.includes('SALARIO') ||
        normDesc.includes('SALÁRIO') ||
        normDesc.includes('REMUNERACAO')
      ) {
        finalType = 'income'
      }
    }

    const installmentInfo = parseInstallmentFromDescription(desc)

    rawTransactions.push({
      id: `pdf-${lineCount}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: parsedDate,
      description: desc,
      amount_cents: parsedAmt.amountCents,
      type: finalType,
      rawLine: line,
      installmentInfo: installmentInfo.isInstallment ? installmentInfo : undefined,
    })
  }

  // Deduplicação interna
  const { unique, duplicatesRemoved } = deduplicateTransactions(rawTransactions)
  const warnings: string[] = []
  if (duplicatesRemoved > 0) {
    warnings.push(
      `${duplicatesRemoved} lançamento(s) duplicado(s) no mesmo extrato PDF foram descartados.`,
    )
  }

  const totalLines = lines.filter((l) => l.trim().length > 0).length

  if (unique.length === 0) {
    let suggestion =
      'Verifique se o PDF contém o texto dos lançamentos ou se é uma imagem escaneada.'
    if (linesWithDate > 0 && linesWithValue === 0) {
      suggestion = `Encontramos ${linesWithDate} linha(s) com data, mas nenhuma com valor legível. Pode haver formatação gráfica ou colunas separadas.`
    } else if (linesWithValue > 0 && linesWithDate === 0) {
      suggestion = `Encontramos ${linesWithValue} linha(s) com valor, mas nenhuma data no padrão brasileiro (DD/MM/AAAA ou DD/MM).`
    } else if (linesWithBoth > 0) {
      suggestion = `${linesWithBoth} linha(s) continham data e valor, mas foram filtradas como ruído bancário ou descrição inválida.`
    }

    return {
      success: false,
      transactions: [],
      format: 'pdf',
      error: `Não encontramos lançamentos válidos neste PDF (${linesWithDate} linha(s) com data e ${linesWithValue} com valor encontradas).`,
      ignoredLines,
      ignoredCount: ignoredLines.length,
      warnings,
      diagnostics: {
        totalLines,
        linesWithDate,
        linesWithValue,
        linesWithBoth,
        rejectionReasons,
        sampleLines,
        suggestion,
      },
    }
  }

  return {
    success: true,
    transactions: unique,
    format: 'pdf',
    ignoredLines,
    ignoredCount: ignoredLines.length,
    warnings,
    diagnostics: {
      totalLines,
      linesWithDate,
      linesWithValue,
      linesWithBoth,
      rejectionReasons,
    },
  }
}

/**
 * Função principal para analisar qualquer arquivo enviado pelo usuário (CSV, OFX ou PDF)
 */
export async function parseStatementFile(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  try {
    if (ext === 'ofx') {
      const text = await readFileAsText(file)
      return parseOFX(text)
    }

    if (ext === 'pdf') {
      try {
        const text = await extractTextFromPDF(file)
        return parsePDFText(text)
      } catch (pdfErr: any) {
        console.warn('Erro ao processar PDF:', pdfErr)
        return {
          success: false,
          transactions: [],
          format: 'pdf',
          error:
            'Não foi possível extrair o conteúdo textual deste PDF (pode ser uma imagem escaneada). Dica: gere o arquivo CSV ou OFX no aplicativo do seu banco para uma leitura 100% precisa.',
        }
      }
    }

    // Padrão CSV ou arquivos de texto
    const text = await readFileAsText(file)
    // Se o conteúdo tiver tags OFX mesmo com extensão trocada
    if (text.includes('<STMTTRN>') || text.includes('<OFX>')) {
      return parseOFX(text)
    }
    return parseCSV(text)
  } catch (err: any) {
    return {
      success: false,
      transactions: [],
      format: ext === 'ofx' ? 'ofx' : ext === 'pdf' ? 'pdf' : 'csv',
      error: err?.message || 'Falha ao ler o arquivo selecionado.',
    }
  }
}

/**
 * Lê o arquivo em texto lidando com UTF-8 e fallback para ISO-8859-1 (Latin-1)
 */
export async function readFileAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

  try {
    return utf8Decoder.decode(buffer)
  } catch {
    // Fallback para windows-1252 / latin-1
    const latinDecoder = new TextDecoder('iso-8859-1')
    return latinDecoder.decode(buffer)
  }
}
