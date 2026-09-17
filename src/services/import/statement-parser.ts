// Parsers unificados para importação de extrato bancário (CSV, OFX e PDF)
import type { TransactionType } from '@/types/finance'

export interface ParsedRawTransaction {
  id: string // temporário único no preview
  date: string // YYYY-MM-DD
  description: string
  amount_cents: number // positivo, centavos
  type: TransactionType
  rawLine?: string
}

export interface ParseResult {
  success: boolean
  transactions: ParsedRawTransaction[]
  format: 'csv' | 'ofx' | 'pdf' | 'unknown'
  error?: string
  warnings?: string[]
}

/**
 * Converte strings de valor variadas (ex: "-1.234,56", "1234.56", "R$ 45,90", "(50,00)", "45.00-")
 * em centavos positivos e tipo (income | expense)
 */
export function parseAmount(valStr: string): { amountCents: number; type: TransactionType } | null {
  if (!valStr) return null

  let clean = valStr.trim()
  // Tratar parenteses financeiros (ex: (120,50) = negativo)
  let isNegative = false
  if (clean.startsWith('(') && clean.endsWith(')')) {
    isNegative = true
    clean = clean.slice(1, -1)
  }

  // Sinais de menos ou mais
  if (clean.includes('-')) {
    isNegative = true
    clean = clean.replace(/-/g, '')
  }
  clean = clean
    .replace(/\+/g, '')
    .replace(/[R$\s]/g, '')
    .trim()

  if (!clean) return null

  // Identificar se usa vírgula como separador decimal (formato brasileiro comum: 1.250,50 ou 250,50)
  // ou ponto como decimal (1250.50 ou 1,250.50)
  let numericVal = 0

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
    // Apenas vírgula: "123,45"
    clean = clean.replace(',', '.')
  }

  numericVal = parseFloat(clean)
  if (isNaN(numericVal)) return null

  const cents = Math.round(Math.abs(numericVal) * 100)
  return {
    amountCents: cents,
    type: isNegative ? 'expense' : 'income',
  }
}

/**
 * Converte vários formatos de data (DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, YYYYMMDD) em YYYY-MM-DD
 */
export function parseDate(dateStr: string): string | null {
  if (!dateStr) return null
  const clean = dateStr.trim().slice(0, 10)

  // 1. Formato YYYYMMDD (comum em OFX)
  if (/^\d{8}$/.test(clean)) {
    const y = clean.slice(0, 4)
    const m = clean.slice(4, 6)
    const d = clean.slice(6, 8)
    return `${y}-${m}-${d}`
  }

  // 2. Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean
  }

  // 3. Formato DD/MM/YYYY ou DD/MM/YY
  const slashParts = clean.split('/')
  if (slashParts.length === 3) {
    let day = slashParts[0].padStart(2, '0')
    let month = slashParts[1].padStart(2, '0')
    let year = slashParts[2]
    if (year.length === 2) year = `20${year}`
    if (year.length === 4) {
      // Caso a data esteja invertida YYYY/MM/DD
      if (parseInt(day) > 1000) {
        return `${day}-${month.padStart(2, '0')}-${year.padStart(2, '0')}`
      }
      return `${year}-${month}-${day}`
    }
  }

  // 4. Formato DD-MM-YYYY
  const dashParts = clean.split('-')
  if (dashParts.length === 3 && dashParts[0].length === 2 && dashParts[2].length === 4) {
    return `${dashParts[2]}-${dashParts[1].padStart(2, '0')}-${dashParts[0].padStart(2, '0')}`
  }

  return null
}

// ==========================================
// 1. PARSER CSV (Bancos BR: Nubank, Inter, Itaú, Bradesco, etc.)
// ==========================================
export function parseCSV(content: string): ParseResult {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) {
    return {
      success: false,
      transactions: [],
      format: 'csv',
      error: 'O arquivo CSV está vazio ou possui apenas cabeçalho.',
    }
  }

  // Detectar delimitador (; ou , ou \t)
  const headerLine = lines[0]
  const semicolonCount = (headerLine.match(/;/g) || []).length
  const commaCount = (headerLine.match(/,/g) || []).length
  const tabCount = (headerLine.match(/\t/g) || []).length

  let delimiter = ','
  if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';'
  else if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t'

  const splitLine = (line: string): string[] => {
    // Regex tolerante para campos com aspas e delimitador
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

  const rawHeaders = splitLine(headerLine).map((h) =>
    h
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim(),
  )

  // Encontrar índices de colunas
  let dateIdx = rawHeaders.findIndex((h) =>
    ['data', 'date', 'data lancamento', 'data movimento', 'dt'].some((k) => h.includes(k)),
  )
  let descIdx = rawHeaders.findIndex((h) =>
    ['descricao', 'description', 'historico', 'estabelecimento', 'titulo', 'detalhe', 'memo'].some(
      (k) => h.includes(k),
    ),
  )
  let amountIdx = rawHeaders.findIndex((h) =>
    ['valor', 'amount', 'valor (r$)', 'quantia', 'valor r$'].some((k) => h === k || h.includes(k)),
  )

  // Colunas específicas de crédito/débito separadas (ex: Itaú / Bradesco)
  const creditIdx = rawHeaders.findIndex((h) =>
    ['credito', 'entrada', 'receita', 'credito (r$)'].some((k) => h.includes(k)),
  )
  const debitIdx = rawHeaders.findIndex((h) =>
    ['debito', 'saida', 'despesa', 'debito (r$)'].some((k) => h.includes(k)),
  )

  // Se não identificou cabeçalho clássico, tenta adivinhar posicionalmente
  const hasNamedHeader =
    dateIdx !== -1 && (amountIdx !== -1 || (creditIdx !== -1 && debitIdx !== -1))
  const startIndex = hasNamedHeader ? 1 : 0

  if (!hasNamedHeader) {
    // Heurística posicional: linha 0 ou 1 tem data na col 0, descrição na col 1, valor na última
    dateIdx = 0
    descIdx = 1
    amountIdx = 2
  }

  const transactions: ParsedRawTransaction[] = []

  for (let i = startIndex; i < lines.length; i++) {
    const row = splitLine(lines[i])
    if (row.length < 2) continue

    const rawDate = row[dateIdx]
    const parsedDate = parseDate(rawDate)
    if (!parsedDate) continue // pula linhas que não contêm data válida

    const description =
      descIdx !== -1 && row[descIdx]
        ? row[descIdx].replace(/^["']|["']$/g, '').trim()
        : 'Transação sem descrição'

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
        // Em CSV de extrato de conta corrente, negativo = saída/despesa, positivo = entrada/receita.
        // Em CSV de fatura de cartão (ex: Nubank), despesas costumam vir como valor positivo.
        // Verificamos a descrição e convenções:
        type = parsedAmount.type
      }
    }

    if (amountCents > 0) {
      transactions.push({
        id: `csv-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        date: parsedDate,
        description,
        amount_cents: amountCents,
        type,
        rawLine: lines[i],
      })
    }
  }

  if (transactions.length === 0) {
    return {
      success: false,
      transactions: [],
      format: 'csv',
      error: 'Não foi possível identificar transações válidas nas linhas do arquivo CSV.',
    }
  }

  return {
    success: true,
    transactions,
    format: 'csv',
  }
}

// ==========================================
// 2. PARSER OFX (Open Financial Exchange - SGML / XML)
// ==========================================
export function parseOFX(content: string): ParseResult {
  if (!content || !content.includes('<STMTTRN>')) {
    // Tentativa case-insensitive
    if (!content || !/<STMTTRN>/i.test(content)) {
      return {
        success: false,
        transactions: [],
        format: 'ofx',
        error: 'O arquivo não possui o bloco de transações padrão <STMTTRN> do formato OFX.',
      }
    }
  }

  const transactions: ParsedRawTransaction[] = []

  // Regex para capturar cada bloco <STMTTRN>...</STMTTRN>
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match: RegExpExecArray | null
  let count = 0

  const getTagValue = (block: string, tag: string): string => {
    // OFX 1.x pode não fechar tags: <TAG>VALOR ou <TAG>VALOR</TAG>
    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i')
    const m = regex.exec(block)
    return m ? m[1].trim() : ''
  }

  while ((match = trnRegex.exec(content)) !== null) {
    count++
    const block = match[1]

    const trntype = getTagValue(block, 'TRNTYPE').toUpperCase() // DEBIT, CREDIT, PAYMENT, CASH, OTHER
    const dtposted = getTagValue(block, 'DTPOSTED')
    const trnamt = getTagValue(block, 'TRNAMT')
    const memo = getTagValue(block, 'MEMO')
    const name = getTagValue(block, 'NAME')

    const date = parseDate(dtposted) || new Date().toISOString().slice(0, 10)
    const description = memo || name || 'Transação OFX'

    const parsedAmt = parseAmount(trnamt)
    if (parsedAmt && parsedAmt.amountCents > 0) {
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
  }

  if (transactions.length === 0) {
    return {
      success: false,
      transactions: [],
      format: 'ofx',
      error: 'Nenhuma transação financeira foi extraída do arquivo OFX.',
    }
  }

  return {
    success: true,
    transactions,
    format: 'ofx',
  }
}

// ==========================================
// 3. PARSER PDF (Extração de texto e linhas de extrato)
// ==========================================
/**
 * Extrai texto de um arquivo PDF no navegador usando a biblioteca oficial Mozilla pdf.js
 * carregada sob demanda via CDN segura, com fallback tolerante.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()

  // Tenta carregar o pdfjsLib da window se já existir ou injetar
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
 * Parser tolerante para texto extraído de extratos PDF bancários (Nubank, Itaú, Bradesco, Inter, Santander)
 */
export function parsePDFText(text: string): ParseResult {
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      transactions: [],
      format: 'pdf',
      error: 'Não foi possível extrair texto do arquivo PDF.',
    }
  }

  const transactions: ParsedRawTransaction[] = []

  // Quebrar por quebras de linha ou sequências de espaços
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 5)

  // Regex para data (DD/MM/YYYY ou DD/MM) no início ou meio da linha + valor monetário (R$ 0,00 ou 0,00)
  // Ex: "15/03/2026 Uber do Brasil -35,90" ou "12/03 Supermercado Pao de Acucar 154,20"
  const dateRegex = /(\b\d{2}\/\d{2}(?:\/\d{4})?\b)/
  const amountRegex = /([+-]?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}\b)/g

  let lineId = 0
  for (const line of lines) {
    const dateMatch = line.match(dateRegex)
    const amountMatches = line.match(amountRegex)

    if (dateMatch && amountMatches && amountMatches.length > 0) {
      lineId++
      const rawDate = dateMatch[1]
      // Se não tem ano, assume o ano atual
      const fullDateStr = rawDate.length === 5 ? `${rawDate}/${new Date().getFullYear()}` : rawDate
      const parsedDate = parseDate(fullDateStr)
      if (!parsedDate) continue

      // Pega o último valor numérico encontrado na linha (normalmente o valor do lançamento)
      const lastAmtMatch = amountMatches[amountMatches.length - 1]
      const parsedAmt = parseAmount(lastAmtMatch)
      if (!parsedAmt || parsedAmt.amountCents === 0) continue

      // Limpa a descrição removendo a data e os valores monetários
      let desc = line.replace(dateRegex, '').replace(amountRegex, '').replace(/R\$/g, '').trim()

      if (desc.length < 2) {
        desc = 'Transação extraída de extrato PDF'
      }

      transactions.push({
        id: `pdf-${lineId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        date: parsedDate,
        description: desc,
        amount_cents: parsedAmt.amountCents,
        type: parsedAmt.type,
        rawLine: line,
      })
    }
  }

  if (transactions.length === 0) {
    return {
      success: false,
      transactions: [],
      format: 'pdf',
      error:
        'Não foram reconhecidas linhas no padrão data + descrição + valor neste PDF. Recomendamos exportar o extrato no formato CSV ou OFX diretamente no internet banking do seu banco.',
    }
  }

  return {
    success: true,
    transactions,
    format: 'pdf',
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
            'Não foi possível ler o conteúdo textual deste PDF (pode ser uma imagem escaneada). Dica: gere o arquivo CSV ou OFX no aplicativo do seu banco para uma leitura 100% precisa.',
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
 * Lê o arquivo em texto lidando com UTF-8 e fallback para ISO-8859-1 (Latin-1),
 * muito comum em arquivos exportados por bancos brasileiros antigos.
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
