// Motor de parsing profissional de extratos e faturas brasileiras (PDF, OFX e CSV)
// Suporta bancos e fintechs como Nubank, Rico, Inter, Itaú, Bradesco, Santander, BTG, XP, C6, Caixa, etc.
import type { TransactionType } from '@/types/finance'

export interface ParsedRawTransaction {
  id: string // temporário único no preview
  date: string // YYYY-MM-DD
  description: string
  amount_cents: number // positivo, centavos
  type: TransactionType
  rawLine?: string
}

export interface IgnoredLineInfo {
  lineNumber?: number
  text: string
  reason: string
}

export interface ParseResult {
  success: boolean
  transactions: ParsedRawTransaction[]
  format: 'csv' | 'ofx' | 'pdf' | 'unknown'
  error?: string
  warnings?: string[]
  ignoredCount?: number
  ignoredLines?: IgnoredLineInfo[]
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

  // 1. Formato YYYYMMDD (comum em OFX)
  if (/^\d{8}$/.test(clean)) {
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

  // Se não identificou cabeçalho clássico, heurística posicional
  if (headerIndex === -1) {
    headerIndex = 0
    dateIdx = 0
    descIdx = 1
    amountIdx = 2
  }

  const rawTransactions: ParsedRawTransaction[] = []

  for (let i = headerIndex + 1; i < rawLines.length; i++) {
    const line = rawLines[i].trim()
    if (!line) continue

    // Checar se a linha é ruído de extrato (ex: SALDO ANTERIOR, TOTAL, telefones)
    const noise = isNoiseLine(line)
    if (noise.isNoise) {
      ignoredLines.push({
        lineNumber: i + 1,
        text: line,
        reason: noise.reason || 'Ruído detectado',
      })
      continue
    }

    const row = splitLine(line)
    if (row.length < 2) {
      ignoredLines.push({ lineNumber: i + 1, text: line, reason: 'Colunas insuficientes' })
      continue
    }

    const rawDate = row[dateIdx]
    const parsedDate = parseDate(rawDate)
    if (!parsedDate) {
      ignoredLines.push({
        lineNumber: i + 1,
        text: line,
        reason: 'Data inválida ou fora do intervalo aceito',
      })
      continue
    }

    let description =
      descIdx !== -1 && row[descIdx] ? row[descIdx].replace(/^["']|["']$/g, '').trim() : ''

    if (!isValidDescription(description)) {
      ignoredLines.push({ lineNumber: i + 1, text: line, reason: 'Descrição inválida ou vazia' })
      continue
    }

    let amountCents = 0
    let type: TransactionType = 'expense'

    if (creditIdx !== -1 && debitIdx !== -1) {
      const creditVal = parseAmount(row[creditIdx])
      const debitVal = parseAmount(row[debitIdx])

      if (creditVal && creditVal.amountCents > 0) {
        amountCents = creditVal.amountCents
        type = 'income'
      } else if (debitVal && debitVal.amountCents > 0) {
        amountCents = debitVal.amountCents
        type = 'expense'
      }
    } else if (amountIdx !== -1 && row[amountIdx]) {
      const parsedAmount = parseAmount(row[amountIdx])
      if (parsedAmount) {
        amountCents = parsedAmount.amountCents
        type = parsedAmount.type
      }
    }

    if (amountCents <= 0) {
      ignoredLines.push({ lineNumber: i + 1, text: line, reason: 'Valor zerado ou inválido' })
      continue
    }

    rawTransactions.push({
      id: `csv-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: parsedDate,
      description,
      amount_cents: amountCents,
      type,
      rawLine: line,
    })
  }

  // Deduplicação interna
  const { unique, duplicatesRemoved } = deduplicateTransactions(rawTransactions)
  const warnings: string[] = []
  if (duplicatesRemoved > 0) {
    warnings.push(`${duplicatesRemoved} lançamento(s) duplicado(s) descartado(s) automaticamente.`)
  }

  if (unique.length === 0) {
    return {
      success: false,
      transactions: [],
      format: 'csv',
      error:
        'Não encontramos lançamentos válidos neste arquivo CSV — verifique se as colunas possuem data e valor.',
      ignoredLines,
      ignoredCount: ignoredLines.length,
      warnings,
    }
  }

  return {
    success: true,
    transactions: unique,
    format: 'csv',
    ignoredLines,
    ignoredCount: ignoredLines.length,
    warnings,
  }
}

// ==========================================
// 2. PARSER OFX (Open Financial Exchange - SGML / XML)
// ==========================================
export function parseOFX(content: string): ParseResult {
  const ignoredLines: IgnoredLineInfo[] = []

  if (!content || !/<STMTTRN>/i.test(content)) {
    return {
      success: false,
      transactions: [],
      format: 'ofx',
      error: 'O arquivo não possui o bloco de transações padrão <STMTTRN> do formato OFX.',
      ignoredLines: [],
      ignoredCount: 0,
    }
  }

  const transactions: ParsedRawTransaction[] = []
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match: RegExpExecArray | null
  let count = 0

  const getTagValue = (block: string, tag: string): string => {
    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i')
    const m = regex.exec(block)
    return m ? m[1].trim() : ''
  }

  while ((match = trnRegex.exec(content)) !== null) {
    count++
    const block = match[1]

    const trntype = getTagValue(block, 'TRNTYPE').toUpperCase()
    const dtposted = getTagValue(block, 'DTPOSTED')
    const trnamt = getTagValue(block, 'TRNAMT')
    const memo = getTagValue(block, 'MEMO')
    const name = getTagValue(block, 'NAME')

    const date = parseDate(dtposted)
    if (!date) {
      ignoredLines.push({
        lineNumber: count,
        text: block.slice(0, 100),
        reason: 'Data DTPOSTED inválida',
      })
      continue
    }

    const description = memo || name || ''
    if (!isValidDescription(description)) {
      ignoredLines.push({
        lineNumber: count,
        text: block.slice(0, 100),
        reason: 'Descrição MEMO/NAME inválida ou vazia',
      })
      continue
    }

    const parsedAmt = parseAmount(trnamt)
    if (!parsedAmt || parsedAmt.amountCents <= 0) {
      ignoredLines.push({
        lineNumber: count,
        text: block.slice(0, 100),
        reason: 'Valor TRNAMT inválido ou zero',
      })
      continue
    }

    let finalType: TransactionType = parsedAmt.type
    if (trntype === 'CREDIT' || trntype === 'DEP') {
      finalType = 'income'
    } else if (trntype === 'DEBIT' || trntype === 'PAYMENT' || trntype === 'FEE') {
      finalType = 'expense'
    }

    transactions.push({
      id: `ofx-${count}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date,
      description,
      amount_cents: parsedAmt.amountCents,
      type: finalType,
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
      error: 'Não encontramos lançamentos válidos neste arquivo OFX.',
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
  let fullText = ''

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item: any) => item.str).join(' ')
    fullText += pageText + '\n'
  }

  return fullText
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

  // Regex para data válida no padrão brasileiro (DD/MM/YYYY ou DD/MM)
  const dateRegex = /\b(\d{2}\/\d{2}(?:\/\d{4})?)\b/
  // Regex para valor monetário BR: "1.234,56", "1234,56", "R$ 148,00", "-50,00"
  const amountRegex = /([+-]?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}\b)/g

  let lineCount = 0

  for (const rawLine of lines) {
    lineCount++
    const line = rawLine.trim()
    if (!line) continue

    // 1. Filtrar ruído (cabeçalho, rodapé, telefones, canais de atendimento, URLs)
    const noiseCheck = isNoiseLine(line)
    if (noiseCheck.isNoise) {
      ignoredLines.push({
        lineNumber: lineCount,
        text: line.length > 90 ? line.slice(0, 90) + '...' : line,
        reason: noiseCheck.reason || 'Linha de cabeçalho ou rodapé ignorada',
      })
      continue
    }

    // 2. Validação estrutural: precisa de data E valor monetário
    const dateMatch = line.match(dateRegex)
    const amountMatches = line.match(amountRegex)

    if (!dateMatch || !amountMatches || amountMatches.length === 0) {
      ignoredLines.push({
        lineNumber: lineCount,
        text: line.length > 90 ? line.slice(0, 90) + '...' : line,
        reason: 'Não possui estrutura válida de transação (data + valor monetário)',
      })
      continue
    }

    // 3. Validação da data
    const rawDate = dateMatch[1]
    const fullDateStr = rawDate.length === 5 ? `${rawDate}/${new Date().getFullYear()}` : rawDate
    const parsedDate = parseDate(fullDateStr)
    if (!parsedDate) {
      ignoredLines.push({
        lineNumber: lineCount,
        text: line,
        reason: `Data inválida ou fora do intervalo aceito: ${rawDate}`,
      })
      continue
    }

    // 4. Validação do valor (pega o último valor monetário na linha, que é o montante da transação)
    const lastAmtMatch = amountMatches[amountMatches.length - 1]
    const parsedAmt = parseAmount(lastAmtMatch)
    if (!parsedAmt || parsedAmt.amountCents <= 0) {
      ignoredLines.push({
        lineNumber: lineCount,
        text: line,
        reason: 'Valor monetário zerado ou inválido',
      })
      continue
    }

    // 5. Descrição: extrair o texto limpo da linha, removendo a data, o valor e prefixos monetários
    let desc = line
      .replace(dateRegex, ' ')
      .replace(amountRegex, ' ')
      .replace(/R\$/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Se sobrou apenas caracteres soltos ou a descrição for ruído disfarçado
    if (!isValidDescription(desc)) {
      ignoredLines.push({
        lineNumber: lineCount,
        text: line,
        reason: `Descrição inválida ou insuficiente: "${desc}"`,
      })
      continue
    }

    // Checar novamente se a própria descrição residual contém termos proibidos
    const descNoise = isNoiseLine(desc)
    if (descNoise.isNoise) {
      ignoredLines.push({
        lineNumber: lineCount,
        text: line,
        reason: descNoise.reason || 'Descrição contém termos de rodapé/cabeçalho',
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

    rawTransactions.push({
      id: `pdf-${lineCount}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: parsedDate,
      description: desc,
      amount_cents: parsedAmt.amountCents,
      type: finalType,
      rawLine: line,
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

  if (unique.length === 0) {
    return {
      success: false,
      transactions: [],
      format: 'pdf',
      error:
        'Não encontramos lançamentos válidos neste arquivo — verifique se o PDF é o extrato ou fatura completa.',
      ignoredLines,
      ignoredCount: ignoredLines.length,
      warnings,
    }
  }

  return {
    success: true,
    transactions: unique,
    format: 'pdf',
    ignoredLines,
    ignoredCount: ignoredLines.length,
    warnings,
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
