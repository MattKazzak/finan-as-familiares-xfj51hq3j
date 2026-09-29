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

export interface ExtractedPdfTextResult {
  rawText: string
  pageCount: number
}

/**
 * Percorre todas as páginas do PDF e extrai todo o conteúdo textual bruto em uma única string (`rawText`).
 * Simples, robusto e livre de labirintos de regex.
 */
export async function extractRawTextFromPdf(
  input: ArrayBuffer | File,
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
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  })

  const pdfDoc = await loadingTask.promise
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

  const rawText = pageTexts.join('\n\n')

  return {
    rawText,
    pageCount,
  }
}

/**
 * Mantido para compatibilidade reversa ou testes que usem extractTextFromPdf
 */
export async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<{
  fullText: string
  lines: string[]
  pageCount: number
}> {
  const { rawText, pageCount } = await extractRawTextFromPdf(pdfBuffer)
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
