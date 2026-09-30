// Motor de parsing profissional de extratos e faturas bancárias em formato OFX (Open Financial Exchange)
// Suporta bancos e fintechs como Nubank, Inter, Itaú, Bradesco, Santander, BTG, XP, C6, Caixa, Sicredi, etc.
import type { TransactionType } from '@/types/finance'

import {
  parseInstallmentFromDescription,
  type ParsedInstallmentInfo,
} from '@/services/installments'
import { isNonTransactionLine } from '@/services/import/pdf-parser'

export interface ParsedRawTransaction {
  id: string // temporário único no preview
  date: string // YYYY-MM-DD
  description: string
  amount_cents: number // positivo, centavos
  type: TransactionType
  fitid?: string // Identificador bancário único (FITID no OFX ou gerado de forma determinística)
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
  format: 'ofx' | 'pdf' | 'unknown'
  accountType?: 'CREDIT_CARD' | 'CHECKING'
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

  // 3.1. Blocklist determinística de não-transações
  if (isNonTransactionLine(line)) {
    return {
      isNoise: true,
      reason: 'Identificado como resumo de fatura, limite ou termo institucional',
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

  // Palavras claras de crédito/estorno/reembolso/pagamento de fatura
  const isCreditWord =
    norm.includes('ESTORNO') ||
    norm.includes('REEMBOLSO') ||
    norm.includes('CASHBACK') ||
    norm.includes('CREDITO CONCEDIDO') ||
    norm.includes('CREDITO') ||
    norm.includes('PAGAMENTO RECEBIDO') ||
    norm.includes('PAGAMENTO DE FATURA') ||
    norm.includes('PAGAMENTO DA FATURA') ||
    norm.includes('PAGTO FATURA') ||
    norm.includes('PGTO FATURA') ||
    norm.includes('PAGAMENTO EFETUADO') ||
    norm.includes('PAGAMENTO TITULO') ||
    norm.includes('PAGAMENTO BOLETO') ||
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
// PARSER OFX (Open Financial Exchange - SGML 1.x / XML 2.x)
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
    const fitidRaw = extractOFXTagValue(block, 'FITID')
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
    const fitid = fitidRaw.trim() || undefined

    transactions.push({
      id: `ofx-${count}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date,
      description,
      amount_cents: parsedAmt.amountCents,
      type: finalType,
      fitid,
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

/**
 * Função principal para analisar arquivo enviado pelo usuário (aceita .ofx e .pdf)
 */
export async function parseStatementFile(file: File): Promise<ParseResult> {
  const fileNameLower = file.name.toLowerCase()

  // Arquivos .ofx são tratados diretamente pelo parser local
  if (fileNameLower.endsWith('.ofx')) {
    try {
      const text = await readFileAsText(file)
      return parseOFX(text)
    } catch (err: any) {
      return {
        success: false,
        transactions: [],
        format: 'ofx',
        error: err?.message || 'Falha ao ler o arquivo OFX selecionado.',
      }
    }
  }

  if (fileNameLower.endsWith('.csv')) {
    return {
      success: false,
      transactions: [],
      format: 'unknown',
      error:
        'O formato .CSV não é suportado. Suportamos importação de extratos em arquivo OFX e faturas de cartão de crédito em PDF (ex.: Nubank, Inter, C6, Itaú, Santander).',
    }
  }

  return {
    success: false,
    transactions: [],
    format: 'unknown',
    error:
      'Formato de arquivo não suportado. Por favor, envie um arquivo .OFX ou uma fatura em .PDF gerada pelo seu banco.',
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
