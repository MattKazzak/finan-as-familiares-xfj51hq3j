// Leitor moderno e robusto de faturas de cartão de crédito e extratos em PDF
// Extrai todo o conteúdo textual bruto (rawText) das páginas via pdfjs-dist
// sem regexes rígidos ou heurísticas quebradiças, delegando a inteligência para a Edge Function.

// Configuração segura do worker do PDF.js
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null

async function getPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then(async (pdfjs) => {
      if (typeof window !== 'undefined') {
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

export interface ExtractedPdfPage {
  pageNumber: number
  text: string
}

export interface ExtractedPdfTextResult {
  rawText: string
  pageCount: number
  pages: ExtractedPdfPage[]
}

export interface ExtractPdfOptions {
  password?: string
}

export type PdfPasswordErrorKind = 'NEED_PASSWORD' | 'INCORRECT_PASSWORD'

export class PdfPasswordProtectedError extends Error {
  readonly kind: PdfPasswordErrorKind
  readonly originalError?: unknown

  constructor(
    kind: PdfPasswordErrorKind,
    message = kind === 'INCORRECT_PASSWORD'
      ? 'Senha incorreta. Tente novamente.'
      : 'Esta fatura é protegida por senha.',
    originalError?: unknown,
  ) {
    super(message)
    this.name = 'PdfPasswordProtectedError'
    this.kind = kind
    this.originalError = originalError
    Object.setPrototypeOf(this, PdfPasswordProtectedError.prototype)
  }
}

/**
 * Verifica se um erro lançado pelo pdfjs-dist ou outro componente é de proteção de senha.
 */
export function isPdfPasswordError(err: unknown): err is PdfPasswordProtectedError {
  if (err instanceof PdfPasswordProtectedError) return true
  if (!err || typeof err !== 'object') return false
  const anyErr = err as { name?: string; message?: string; code?: number }
  if (anyErr.name === 'PasswordException') return true
  const msg = String(anyErr.message || '').toLowerCase()
  if (
    msg.includes('no password given') ||
    msg.includes('password exception') ||
    msg.includes('password required') ||
    msg.includes('incorrect password') ||
    msg.includes('bad password') ||
    msg.includes('invalid password')
  ) {
    return true
  }
  return false
}

/**
 * Classifica a exceção do PDF.js em NEED_PASSWORD ou INCORRECT_PASSWORD.
 */
export function classifyPdfPasswordError(
  err: unknown,
  hadPassword = false,
): PdfPasswordProtectedError {
  if (err instanceof PdfPasswordProtectedError) {
    return err
  }

  const anyErr = err as { name?: string; message?: string; code?: number } | null | undefined
  const msg = String(anyErr?.message || '').toLowerCase()
  const code = typeof anyErr?.code === 'number' ? anyErr.code : undefined

  // No pdfjs-dist: PasswordResponses.NEED_PASSWORD = 1, PasswordResponses.INCORRECT_PASSWORD = 2
  if (
    code === 2 ||
    msg.includes('incorrect') ||
    msg.includes('bad password') ||
    msg.includes('invalid password')
  ) {
    return new PdfPasswordProtectedError(
      'INCORRECT_PASSWORD',
      'Senha incorreta. Tente novamente.',
      err,
    )
  }

  if (hadPassword) {
    // Se foi fornecida uma senha e ainda assim falhou por senha, é senha incorreta
    return new PdfPasswordProtectedError(
      'INCORRECT_PASSWORD',
      'Senha incorreta. Tente novamente.',
      err,
    )
  }

  return new PdfPasswordProtectedError('NEED_PASSWORD', 'Esta fatura é protegida por senha.', err)
}

/**
 * Percorre todas as páginas do PDF e extrai todo o conteúdo textual bruto em uma única string (`rawText`).
 * Simples, robusto e livre de labirintos de regex.
 * Suporta opção `password` para faturas protegidas.
 */
export async function extractRawTextFromPdf(
  input: ArrayBuffer | File,
  options?: ExtractPdfOptions,
): Promise<ExtractedPdfTextResult> {
  let buffer: ArrayBuffer
  if (input instanceof File) {
    buffer = await input.arrayBuffer()
  } else {
    buffer = input
  }

  if (!buffer || buffer.byteLength === 0) {
    throw new Error('O arquivo PDF selecionado está vazio.')
  }

  const pdfjs = await getPdfJs()
  const docParams: any = {
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }

  if (options?.password) {
    docParams.password = options.password
  }

  const loadingTask = pdfjs.getDocument(docParams)

  let pdfDoc: any
  try {
    pdfDoc = await loadingTask.promise
  } catch (docErr: any) {
    if (isPdfPasswordError(docErr)) {
      throw classifyPdfPasswordError(docErr, Boolean(options?.password))
    }
    throw docErr
  }
  const pageCount = pdfDoc.numPages
  const pageTexts: string[] = []

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const textContent = await page.getTextContent()

    // Agrupar itens de texto preservando a ordem de leitura
    const pageStrings: string[] = []
    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string') {
        const text = item.str.trim()
        if (text) {
          pageStrings.push(text)
        }
      }
    }

    if (pageStrings.length > 0) {
      pageTexts.push(pageStrings.join(' '))
    }
  }

  const pages: ExtractedPdfPage[] = pageTexts.map((text, idx) => ({
    pageNumber: idx + 1,
    text,
  }))
  const rawText = pageTexts.join('\n\n')

  return {
    rawText,
    pageCount,
    pages,
  }
}

/**
 * Mantido para compatibilidade reversa ou testes que usem extractTextFromPdf
 */
export async function extractTextFromPdf(
  pdfBuffer: ArrayBuffer,
  options?: ExtractPdfOptions,
): Promise<{
  fullText: string
  lines: string[]
  pageCount: number
}> {
  const { rawText, pageCount } = await extractRawTextFromPdf(pdfBuffer, options)
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return {
    fullText: rawText,
    lines,
    pageCount,
  }
}

/**
 * Gera hash determinístico curto para FITID a partir de data, descrição e valor
 */
export function generatePdfFitid(date: string, description: string, amountCents: number): string {
  const cleanDesc = description.toLowerCase().replace(/[^a-z0-9]/g, '')
  const norm = `${date}_${cleanDesc}_${amountCents}`
  let hash = 0
  for (let i = 0; i < norm.length; i++) {
    const char = norm.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  const positive = Math.abs(hash).toString(36)
  return `PDF-${date.replace(/-/g, '')}-${positive}`
}

/**
 * Normaliza uma string de descrição para fins de comparação e deduplicação:
 * remove acentos, caracteres não alfanuméricos e espaços extras.
 */
export function normalizeDescriptionForDedup(desc: string): string {
  return (desc || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Filtro determinístico pós-IA (em código, NÃO no prompt):
 * Intercepta pagamentos de fatura, quitações anteriores, ajustes, encargos e IOF.
 * Retorna true se a descrição indicar uma linha não-despesa que deve vir
 * DESMARCADA por padrão e com selo "não é despesa".
 *
 * NOTA DE PRODUTO: Não interceptar "tarifa" (decisão acordada com a usuária).
 */
export function isDeterministicNonExpense(description: string): boolean {
  if (!description) return false
  const norm = normalizeDescriptionForDedup(description)

  // Padrões de pagamento de fatura anterior / quitação
  const isPayment =
    norm.includes('pagamentorecebido') ||
    norm.includes('pagamentodefatura') ||
    norm.includes('pagamentoefetuado') ||
    norm.includes('pagamentofatura') ||
    norm.includes('pagtodefatura') ||
    norm.includes('pagtoextrato') ||
    norm.includes('pagamentotitulo') ||
    norm.includes('pagamentominimo') ||
    norm.includes('pagamentoparcial') ||
    norm.includes('pagamentocartao') ||
    norm.includes('quitacaodefatura') ||
    norm.includes('pagtoantecipado') ||
    norm.includes('autpagto')

  // Padrões de ajustes de fatura
  const isAdjustment =
    norm.includes('ajuste') ||
    norm.includes('estornoajuste') ||
    norm.includes('ajustedebito') ||
    norm.includes('ajustecredito')

  // Padrões de encargos e IOF
  const isCharges = norm.includes('encargo') || norm.includes('encargos') || norm.includes('iof')

  return isPayment || isAdjustment || isCharges
}

export interface DedupableTransaction {
  date: string
  description: string
  cleanMerchant?: string
  amountCents: number
  [key: string]: any
}

/**
 * Remove duplicatas entre blocos/páginas (mesma data + descrição normalizada + valor).
 * Preserva o primeiro item encontrado e descarta réplicas geradas por sobreposição
 * de páginas ou cabeçalhos repetidos.
 */
export function deduplicateExtractedTransactions<T extends DedupableTransaction>(items: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    const normDesc = normalizeDescriptionForDedup(item.cleanMerchant || item.description)
    const key = `${item.date}_${normDesc}_${item.amountCents}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }

  return result
}
