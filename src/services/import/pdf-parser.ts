// Parser especializado em faturas de cartão de crédito e extratos em PDF
// Compatível com as principais instituições financeiras brasileiras (Nubank, Banco Inter, C6 Bank, Itaú, Bradesco, Santander, BTG, XP, etc.)
// Reutiliza a tipagem ParsedRawTransaction e ParseResult compatível com o fluxo OFX e a conciliação existente.

import type { TransactionType } from '@/types/finance'
import {
  parseInstallmentFromDescription,
  type ParsedInstallmentInfo,
} from '@/services/installments'
import {
  parseAmount,
  isNoiseLine,
  isValidDescription,
  resolveCreditCardTransactionType,
  deduplicateTransactions,
  type ParsedRawTransaction,
  type IgnoredLineInfo,
  type ParseResult,
} from '@/services/import/statement-parser'

// Configuração segura do worker do PDF.js
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null

async function getPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then(async (pdfjs) => {
      if (typeof window !== 'undefined') {
        // No navegador, se o worker ainda não estiver configurado, usa CDN do cdnjs/jsdelivr
        // compatível com a versão instalada para renderizar o worker sem quebrar o bundler
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          const version = pdfjs.version || '4.10.38'
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`
        }
      }
      return pdfjs
    })
  }
  return pdfjsLibPromise
}

// Mapeamento de meses em português (abreviações e por extenso) para número 01-12
const PT_MONTHS_MAP: Record<string, string> = {
  JAN: '01',
  JANEIRO: '01',
  FEV: '02',
  FEVEREIRO: '02',
  MAR: '03',
  MARCO: '03',
  MARÇO: '03',
  ABR: '04',
  ABRIL: '04',
  MAI: '05',
  MAIO: '05',
  JUN: '06',
  JUNHO: '06',
  JUL: '07',
  JULHO: '07',
  AGO: '08',
  AGOSTO: '08',
  SET: '09',
  SETEMBRO: '09',
  OUT: '10',
  OUTUBRO: '10',
  NOV: '11',
  NOVEMBRO: '11',
  DEZ: '12',
  DEZEMBRO: '12',
}

/**
 * Converte data em texto brasileiro para formato ISO YYYY-MM-DD.
 * Formatos suportados:
 * - "12 OUT", "05 FEV", "28 DEZ"
 * - "12/10", "12/10/2026", "12-10-2026", "12.10.2026"
 * - "12 OUT 2026", "12 DE OUTUBRO DE 2026"
 */
export function normalizePdfDate(
  rawDateStr: string,
  referenceYear: number = new Date().getFullYear(),
): string | null {
  if (!rawDateStr) return null
  const clean = rawDateStr.trim().replace(/\s+/g, ' ')

  // 1. Formato "DD/MM/AAAA" ou "DD-MM-AAAA" ou "DD.MM.AAAA"
  const ddmmyyyyMatch = clean.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10)
    const month = parseInt(ddmmyyyyMatch[2], 10)
    const year = parseInt(ddmmyyyyMatch[3], 10)
    return validateDateYMD(year, month, day)
  }

  // 2. Formato "DD/MM/AA"
  const ddmmyyMatch = clean.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/)
  if (ddmmyyMatch) {
    const day = parseInt(ddmmyyMatch[1], 10)
    const month = parseInt(ddmmyyMatch[2], 10)
    const year = 2000 + parseInt(ddmmyyMatch[3], 10)
    return validateDateYMD(year, month, day)
  }

  // 3. Formato "DD/MM" (assume ano de referência)
  const ddmmMatch = clean.match(/^(\d{1,2})[/\-.](\d{1,2})$/)
  if (ddmmMatch) {
    const day = parseInt(ddmmMatch[1], 10)
    const month = parseInt(ddmmMatch[2], 10)
    return validateDateYMD(referenceYear, month, day)
  }

  // 4. Formato "DD MMM [AAAA]" ou "DD DE MMM [DE AAAA]" (ex: "12 OUT", "05 FEV 2026", "12 DE OUTUBRO DE 2026")
  const textMonthMatch = clean
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/^(\d{1,2})(?:\s+DE)?\s+([A-Z]{3,9})(?:\s+(?:DE\s+)?(\d{4}))?$/)

  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10)
    const monthKey = textMonthMatch[2]
    const year = textMonthMatch[3] ? parseInt(textMonthMatch[3], 10) : referenceYear
    const monthStr = PT_MONTHS_MAP[monthKey]
    if (monthStr) {
      const month = parseInt(monthStr, 10)
      return validateDateYMD(year, month, day)
    }
  }

  return null
}

function validateDateYMD(year: number, month: number, day: number): string | null {
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null
  if (year < 2000 || year > new Date().getFullYear() + 2) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  const daysInMonth = new Date(year, month, 0).getDate()
  if (day > daysInMonth) return null

  const yStr = String(year)
  const mStr = String(month).padStart(2, '0')
  const dStr = String(day).padStart(2, '0')
  return `${yStr}-${mStr}-${dStr}`
}

/**
 * Tenta encontrar um ano de referência no texto global da fatura.
 * Procura por expressões como "Vencimento 10/11/2026", "Fatura de Outubro 2026", "Período 01/10/2026 a 31/10/2026".
 */
export function extractInvoiceReferenceYear(fullText: string): number {
  const currentYear = new Date().getFullYear()
  if (!fullText) return currentYear

  // 1. Expressões explícitas de vencimento ou fatura com ano
  const vencimentoMatch = fullText.match(
    /(?:vencimento|fatura\s+de|periodo|per[íi]odo|fechamento)[^\d\n\r]{0,30}(\d{1,2}[/\-.]\d{1,2}[/\-.])(20\d{2})/i,
  )
  if (vencimentoMatch && vencimentoMatch[2]) {
    const yr = parseInt(vencimentoMatch[2], 10)
    if (yr >= 2020 && yr <= currentYear + 1) return yr
  }

  // 2. Padrão "MÊS DE 202X" ou "MÊS 202X"
  const monthYearMatch = fullText.match(
    /\b(?:jan(?:eiro)?|fev(?:ereiro)?|mar(?:[çc]o)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\s+(?:de\s+)?(20\d{2})\b/i,
  )
  if (monthYearMatch && monthYearMatch[1]) {
    const yr = parseInt(monthYearMatch[1], 10)
    if (yr >= 2020 && yr <= currentYear + 1) return yr
  }

  // 3. Menção isolada de ano recente no cabeçalho (primeiros 1000 caracteres)
  const headerSample = fullText.slice(0, 1500)
  const yearMatches = headerSample.match(/\b(202[0-9]|203[0-9])\b/g)
  if (yearMatches && yearMatches.length > 0) {
    const firstYear = parseInt(yearMatches[0], 10)
    if (firstYear >= 2020 && firstYear <= currentYear + 1) return firstYear
  }

  return currentYear
}

/**
 * Gera hash determinístico curto para FITID a partir de data, descrição e valor
 * Baseado na tríade: data (YYYY-MM-DD) + estabelecimento/descrição normalizada + valor (centavos)
 */
export function generatePdfFitid(date: string, description: string, amountCents: number): string {
  // Limpa caracteres especiais, remove parcelas da descrição para que o identificador reflita data+estabelecimento+valor
  const cleanDesc = description.toLowerCase().replace(/[^a-z0-9]/g, '')
  const norm = `${date}_${cleanDesc}_${amountCents}`
  let hash = 0
  for (let i = 0; i < norm.length; i++) {
    const char = norm.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Converte para 32bit integer
  }
  const positive = Math.abs(hash).toString(36)
  return `PDF-${date.replace(/-/g, '')}-${positive}`
}

export interface ParsePdfLineResult {
  transaction: ParsedRawTransaction | null
  ignoredReason?: string
}

/**
 * Analisa uma linha individual de texto extraída da fatura de cartão de crédito.
 * Suporta formatos típicos de faturas brasileiras:
 *  - Nubank: "12 OUT Mercado Livre 01/03 150,00" ou "12 OUT - Pagamento em 12 OUT - -1.500,00"
 *  - Inter: "05/10/2026 COMPRA CARTAO - IFOOD 45,90"
 *  - C6: "28/09 UBER *TRIP R$ 23,50"
 *  - Itaú: "15/10 DROGARIA SAO PAULO 89,90" ou "15/10 MAGAZINE LUIZA 2/12 210,00"
 *  - Santander: "18/10 RESTAURANTE VARANDA 145,00" ou "20/10 PAGAMENTO DE FATURA EFETUADO -1.250,00" ou "22/10 LOJAS CEM 03/10 89,90"
 *  - Estornos: "20/10 ESTORNO COMPRA XYZ -50,00" ou "20/10 ESTORNO COMPRA XYZ 50,00-"
 */
export function parsePdfTransactionLine(
  line: string,
  referenceYear: number = new Date().getFullYear(),
): ParsePdfLineResult {
  const trimmed = line.trim()
  if (!trimmed) {
    return { transaction: null, ignoredReason: 'Linha vazia' }
  }

  // Ignorar ruídos de cabeçalho, rodapé, SAC, telefones conhecidos
  const noiseCheck = isNoiseLine(trimmed)
  if (noiseCheck.isNoise) {
    return { transaction: null, ignoredReason: noiseCheck.reason }
  }

  // Padrão de valor no final da linha (ou com sinal antes/depois, com ou sem R$)
  // Exemplos capturados:
  // "R$ 150,00", "150,00", "-150,00", "150,00-", "R$ -150,00", "(150,00)", "1.250,90", "120,00 D", "120,00 C"
  const amountRegex =
    /(?:R\$\s*)?(?:[-–—]\s*)?\(?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*\)?(?:[-–—]|[ \t]+[DC])?\s*$/i
  const amountMatch = trimmed.match(amountRegex)

  if (!amountMatch) {
    return { transaction: null, ignoredReason: 'Nenhum valor monetário identificado no final' }
  }

  const rawAmountStr = amountMatch[0].trim()
  const lineWithoutAmount = trimmed.slice(0, trimmed.length - amountMatch[0].length).trim()

  if (!lineWithoutAmount) {
    return { transaction: null, ignoredReason: 'Linha contém apenas valor sem descrição/data' }
  }

  // Padrão de data no início da linha
  // Casos:
  // 1. "DD/MM/AAAA", "DD-MM-AAAA", "DD/MM"
  // 2. "DD MMM" (ex: "12 OUT", "05 FEV", "28 DEZ", "18/OUT")
  const dateRegex =
    /^(?:(\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?)|(\d{1,2}(?:[/\s]+DE[/\s]+|[/\s]+)(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ|JANEIRO|FEVEREIRO|MARCO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)(?:\s+\d{4})?))\b/i

  const dateMatch = lineWithoutAmount.match(dateRegex)
  if (!dateMatch) {
    return { transaction: null, ignoredReason: 'Nenhuma data bancária identificada no início' }
  }

  const rawDateStr = dateMatch[0].trim()
  const parsedDate = normalizePdfDate(rawDateStr, referenceYear)

  if (!parsedDate) {
    return {
      transaction: null,
      ignoredReason: `Data inválida ou fora do calendário: "${rawDateStr}"`,
    }
  }

  // O restante entre a data e o valor é a descrição (+ parcelas se houver)
  let descriptionPart = lineWithoutAmount.slice(dateMatch[0].length).trim()

  // Limpar separadores comuns no início da descrição (ex: traços, barras)
  descriptionPart = descriptionPart.replace(/^[-–—/:,\s]+/, '').trim()

  if (!isValidDescription(descriptionPart)) {
    return {
      transaction: null,
      ignoredReason: `Descrição inválida ou excessivamente curta/ruído: "${descriptionPart}"`,
    }
  }

  // Identificação do valor monetário e tipo base
  const parsedAmount = parseAmount(rawAmountStr)
  if (!parsedAmount || parsedAmount.amountCents <= 0) {
    return { transaction: null, ignoredReason: `Valor numérico inválido: "${rawAmountStr}"` }
  }

  // Em cartão de crédito:
  // Se o valor estiver explícito como negativo (ex: "-150,00", "(150,00)", "150,00-", "150,00 C"):
  // é um pagamento de fatura, crédito ou estorno (income/reembolso).
  // Se a descrição contiver "ESTORNO", "REEMBOLSO", "PAGAMENTO DA FATURA", "PAGAMENTO RECEBIDO",
  // "PAGAMENTO DE FATURA", "PAGTO FATURA", também vira income (crédito/receita).
  const rawIsNegative =
    rawAmountStr.includes('-') ||
    rawAmountStr.includes('–') ||
    rawAmountStr.includes('—') ||
    rawAmountStr.includes('(') ||
    /\bC\b/i.test(rawAmountStr)

  let finalType: TransactionType = 'expense'
  if (rawIsNegative) {
    finalType = 'income'
  } else {
    finalType = resolveCreditCardTransactionType(parsedAmount.type, descriptionPart)
  }

  // Detecção de parcelamento inteligente
  const installmentInfo: ParsedInstallmentInfo = parseInstallmentFromDescription(descriptionPart)

  // Geração de FITID determinístico
  const fitid = generatePdfFitid(parsedDate, descriptionPart, parsedAmount.amountCents)
  const id = `pdf-${Math.random().toString(36).substring(2, 11)}`

  return {
    transaction: {
      id,
      date: parsedDate,
      description: descriptionPart,
      amount_cents: parsedAmount.amountCents,
      type: finalType,
      fitid,
      rawLine: trimmed,
      installmentInfo,
    },
  }
}

/**
 * Extrai todo o texto estruturado por páginas de um documento PDF através do PDF.js
 */
export async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<{
  fullText: string
  lines: string[]
  pageCount: number
}> {
  const pdfjs = await getPdfJs()
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    // Desabilita workers externos se houver restrições no ambiente
    useWorkerFetch: false,
    isEvalSupported: false,
  })

  const pdfDoc = await loadingTask.promise
  const pageCount = pdfDoc.numPages
  const rawLines: string[] = []

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const textContent = await page.getTextContent()

    // Agrupar itens de texto por linha visual (usando coordenada Y aproximada do viewport)
    // O PDF.js retorna transform: [scaleX, skewY, skewX, scaleY, transX, transY]
    const lineMap = new Map<number, Array<{ x: number; text: string }>>()

    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string') {
        const text = item.str
        if (!text) continue

        const transform = (item as any).transform
        const x = Array.isArray(transform) ? transform[4] : 0
        const y = Array.isArray(transform) ? Math.round(transform[5]) : 0

        // Tolerância de ±3 pontos na coordenada vertical para agrupar na mesma linha
        let matchedY = y
        for (const existingY of lineMap.keys()) {
          if (Math.abs(existingY - y) <= 3) {
            matchedY = existingY
            break
          }
        }

        if (!lineMap.has(matchedY)) {
          lineMap.set(matchedY, [])
        }
        lineMap.get(matchedY)!.push({ x, text })
      }
    }

    // Ordena as linhas do topo da página para o fundo (Y decrescente no espaço PDF)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)

    for (const y of sortedYs) {
      const parts = lineMap.get(y)!
      // Ordena horizontalmente os fragmentos da esquerda para a direita
      parts.sort((a, b) => a.x - b.x)
      const combinedLine = parts
        .map((p) => p.text.trim())
        .filter(Boolean)
        .join(' ')
        .trim()

      if (combinedLine) {
        rawLines.push(combinedLine)
      }
    }
  }

  const fullText = rawLines.join('\n')
  return {
    fullText,
    lines: rawLines,
    pageCount,
  }
}

/**
 * Função principal para processamento de faturas em formato PDF.
 * Aceita ArrayBuffer ou File.
 */
export async function parsePdfStatement(
  input: ArrayBuffer | File,
  filename: string = 'fatura.pdf',
): Promise<ParseResult> {
  try {
    let buffer: ArrayBuffer
    if (input instanceof File) {
      buffer = await input.arrayBuffer()
    } else {
      buffer = input
    }

    if (!buffer || buffer.byteLength === 0) {
      return {
        success: false,
        transactions: [],
        format: 'unknown',
        error: 'O arquivo PDF selecionado está vazio.',
      }
    }

    // 1. Extração estruturada do PDF
    const { fullText, lines, pageCount } = await extractTextFromPdf(buffer)

    if (lines.length === 0) {
      return {
        success: false,
        transactions: [],
        format: 'unknown',
        error:
          'Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada sem camada de texto pesquisável.',
      }
    }

    // 2. Extrai o ano de referência da fatura (vencimento ou cabeçalho)
    const referenceYear = extractInvoiceReferenceYear(fullText)

    // 3. Itera pelas linhas procurando lançamentos de cartão
    const transactions: ParsedRawTransaction[] = []
    const ignoredLines: IgnoredLineInfo[] = []
    let linesWithDate = 0
    let linesWithValue = 0
    let linesWithBoth = 0
    const rejectionReasons: Record<string, number> = {}

    lines.forEach((line, index) => {
      // Diagnósticos estatísticos
      const hasDate =
        /\b(?:\d{1,2}[/\-.]\d{1,2}|\d{1,2}\s+(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ))\b/i.test(
          line,
        )
      const hasValue = /\d+,\d{2}\b/.test(line)

      if (hasDate) linesWithDate++
      if (hasValue) linesWithValue++
      if (hasDate && hasValue) linesWithBoth++

      const lineRes = parsePdfTransactionLine(line, referenceYear)
      if (lineRes.transaction) {
        transactions.push(lineRes.transaction)
      } else if (lineRes.ignoredReason) {
        // Registra motivo para diagnósticos
        rejectionReasons[lineRes.ignoredReason] = (rejectionReasons[lineRes.ignoredReason] || 0) + 1
        if (hasDate || hasValue) {
          ignoredLines.push({
            lineNumber: index + 1,
            text: line.length > 100 ? `${line.slice(0, 97)}...` : line,
            reason: lineRes.ignoredReason,
          })
        }
      }
    })

    // 4. Deduplica no mesmo lote
    const { unique, duplicatesRemoved } = deduplicateTransactions(transactions)

    const warnings: string[] = []
    if (duplicatesRemoved > 0) {
      warnings.push(`${duplicatesRemoved} transações idênticas repetidas foram unificadas.`)
    }
    if (pageCount > 1) {
      warnings.push(`Fatura processada com sucesso: ${pageCount} páginas analisadas.`)
    }

    if (unique.length === 0) {
      return {
        success: false,
        transactions: [],
        format: 'unknown',
        error:
          'Não encontramos lançamentos de compras ou pagamentos válidos nesta fatura em PDF. Verifique se o arquivo é uma fatura detalhada com lançamentos e valores.',
        ignoredLines,
        ignoredCount: ignoredLines.length,
        warnings,
        diagnostics: {
          totalLines: lines.length,
          linesWithDate,
          linesWithValue,
          linesWithBoth,
          rejectionReasons,
          sampleLines: lines.slice(0, 5),
          suggestion:
            'Certifique-se de que o PDF é a fatura detalhada do cartão (com a lista de compras discriminadas) e não apenas o boleto de pagamento.',
        },
      }
    }

    return {
      success: true,
      transactions: unique,
      format: 'pdf',
      accountType: 'CREDIT_CARD',
      ignoredLines,
      ignoredCount: ignoredLines.length,
      warnings,
      diagnostics: {
        totalLines: lines.length,
        linesWithDate,
        linesWithValue,
        linesWithBoth,
        rejectionReasons,
      },
    }
  } catch (err: any) {
    return {
      success: false,
      transactions: [],
      format: 'unknown',
      error:
        err?.message ||
        `Falha ao processar a fatura em PDF (${filename}). O arquivo pode estar protegido por senha ou corrompido.`,
    }
  }
}

/**
 * Função utilitária para testar ou processar uma lista de linhas de texto (útil em testes unitários e mocks de faturas)
 */
export function parsePdfTextLines(
  lines: string[],
  referenceYear: number = new Date().getFullYear(),
): ParseResult {
  const transactions: ParsedRawTransaction[] = []
  const ignoredLines: IgnoredLineInfo[] = []
  const rejectionReasons: Record<string, number> = {}

  let linesWithDate = 0
  let linesWithValue = 0
  let linesWithBoth = 0

  lines.forEach((line, index) => {
    const hasDate =
      /\b(?:\d{1,2}[/\-.]\d{1,2}|\d{1,2}\s+(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ))\b/i.test(
        line,
      )
    const hasValue = /\d+,\d{2}\b/.test(line)

    if (hasDate) linesWithDate++
    if (hasValue) linesWithValue++
    if (hasDate && hasValue) linesWithBoth++

    const lineRes = parsePdfTransactionLine(line, referenceYear)
    if (lineRes.transaction) {
      transactions.push(lineRes.transaction)
    } else if (lineRes.ignoredReason) {
      rejectionReasons[lineRes.ignoredReason] = (rejectionReasons[lineRes.ignoredReason] || 0) + 1
      if (hasDate || hasValue) {
        ignoredLines.push({
          lineNumber: index + 1,
          text: line,
          reason: lineRes.ignoredReason,
        })
      }
    }
  })

  const { unique, duplicatesRemoved } = deduplicateTransactions(transactions)
  const warnings: string[] = []
  if (duplicatesRemoved > 0) {
    warnings.push(`${duplicatesRemoved} transações idênticas repetidas foram unificadas.`)
  }

  return {
    success: unique.length > 0,
    transactions: unique,
    format: 'pdf',
    accountType: 'CREDIT_CARD',
    ignoredLines,
    ignoredCount: ignoredLines.length,
    warnings,
    diagnostics: {
      totalLines: lines.length,
      linesWithDate,
      linesWithValue,
      linesWithBoth,
      rejectionReasons,
    },
    error:
      unique.length === 0
        ? 'Não encontramos lançamentos válidos nas linhas analisadas.'
        : undefined,
  }
}
