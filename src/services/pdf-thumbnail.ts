/**
 * Utilitário para renderização client-side de thumbnail da 1ª página de PDFs usando pdfjs-dist.
 * Funciona de forma assíncrona, com cache de thumbnail em memória (DataURL) para performance
 * e sem re-renderizar múltiplos canvas desnecessariamente.
 */

// Worker do pdfjs-dist configurado de modo unificado e seguro para Vite
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null

export async function getPdfJsForThumbnail() {
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

// Cache em memória (URL ou path -> DataURL em JPEG comprimido)
const thumbnailCache = new Map<string, string>()

export interface RenderPdfThumbnailOptions {
  /**
   * Largura alvo desejada da thumbnail em pixels (default: 320px)
   */
  targetWidth?: number
  /**
   * Timeout em milissegundos antes de abortar a geração (default: 12000ms)
   */
  timeoutMs?: number
}

/**
 * Renderiza a primeira página do PDF a partir de uma URL (assinada ou pública)
 * e retorna uma string data:image/jpeg ou lança erro em caso de falha.
 */
export async function renderPdfFirstPageThumbnail(
  pdfUrl: string,
  options: RenderPdfThumbnailOptions = {},
): Promise<string> {
  if (!pdfUrl) {
    throw new Error('URL do PDF não informada.')
  }

  // Verifica cache
  const cached = thumbnailCache.get(pdfUrl)
  if (cached) {
    return cached
  }

  const { targetWidth = 320, timeoutMs = 12000 } = options

  const pdfjs = await getPdfJsForThumbnail()
  const version = pdfjs.version || '4.10.38'
  const cMapUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/cmaps/`
  const standardFontDataUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/standard_fonts/`

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Tempo limite excedido ao renderizar miniatura do PDF.'))
    }, timeoutMs)
  })

  const renderPromise = (async () => {
    const loadingTask = pdfjs.getDocument({
      url: pdfUrl,
      cMapUrl,
      cMapPacked: true,
      standardFontDataUrl,
      // Desativa parsing de texto e fontes pesadas não essenciais para a thumbnail
      disableRange: false,
      disableStream: false,
    })

    const pdfDoc = await loadingTask.promise
    if (pdfDoc.numPages < 1) {
      throw new Error('PDF sem páginas disponíveis.')
    }

    const page = await pdfDoc.getPage(1)
    const initialViewport = page.getViewport({ scale: 1 })

    // Calcula escala para atingir o targetWidth (ex: 320px)
    const scale = Math.min(2, Math.max(0.4, targetWidth / initialViewport.width))
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)

    const context = canvas.getContext('2d', { alpha: false })
    if (!context) {
      throw new Error('Contexto 2D do Canvas indisponível.')
    }

    // Fundo branco prévio para PDFs com fundo transparente
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const renderTask = page.render({
      canvasContext: context,
      viewport,
    })

    await renderTask.promise

    // Converte para JPEG leve com qualidade 0.80
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)

    // Libera canvas da memória
    canvas.width = 0
    canvas.height = 0

    // Guarda em cache limitado (máximo 60 itens para não estourar memória)
    if (thumbnailCache.size > 60) {
      const firstKey = thumbnailCache.keys().next().value
      if (firstKey) thumbnailCache.delete(firstKey)
    }
    thumbnailCache.set(pdfUrl, dataUrl)

    return dataUrl
  })()

  try {
    return await Promise.race([renderPromise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

/**
 * Limpa o cache de miniaturas (útil para testes ou recarregamento forçado)
 */
export function clearPdfThumbnailCache() {
  thumbnailCache.clear()
}
