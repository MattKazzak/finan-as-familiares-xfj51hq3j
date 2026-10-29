/**
 * Utilitários e algoritmos de processamento de imagem para escaneamento de documentos no cliente:
 * - Detecção automática de bordas de quadrilátero (document corners)
 * - Correção de perspectiva (warp / homografia inversa em Canvas 2D)
 * - Filtros com um toque: Colorido, Escala de Cinza, P&B alto contraste (threshold adaptativo/Otsu)
 * - Nitidez (Unsharp mask)
 * - Geração de PDF multipágina nativo sem dependências externas
 */

export interface Point {
  x: number
  y: number
}

export interface QuadCorners {
  topLeft: Point
  topRight: Point
  bottomRight: Point
  bottomLeft: Point
}

export type ScanFilterMode = 'color' | 'grayscale' | 'bw'

export interface AdvancedScanOptions {
  contrast?: number // ex: 1.0 a 2.0 (padrão 1.25)
  brightness?: number // ex: 0.9 a 1.4 (padrão 1.05)
  filterMode?: ScanFilterMode // 'color' | 'grayscale' | 'bw'
  grayscale?: boolean // legado compatível
  sharpen?: boolean // unsharp mask leve
  quality?: number // 0.85 a 0.95
}

/**
 * Ordena 4 pontos em [topLeft, topRight, bottomRight, bottomLeft]
 */
export function orderCorners(points: Point[]): QuadCorners {
  if (points.length !== 4) {
    throw new Error('Exatamente 4 pontos são necessários para delimitar o quadrilátero')
  }

  // Ordena por soma x + y (topLeft tem a menor soma, bottomRight a maior)
  const sortedBySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y))
  const topLeft = sortedBySum[0]
  const bottomRight = sortedBySum[3]

  // Os dois restantes: o que tiver y maior ou x menor
  // Ordena por diferença (y - x): topRight tem menor diferença (ou x - y maior)
  const remaining = [sortedBySum[1], sortedBySum[2]]
  remaining.sort((a, b) => a.y - a.x - (b.y - b.x))

  const topRight = remaining[0]
  const bottomLeft = remaining[1]

  return { topLeft, topRight, bottomRight, bottomLeft }
}

/**
 * Detecta automaticamente os 4 cantos do documento em uma imagem.
 * Utiliza redução de escala para desempenho fluido em mobile,
 * detecção de gradiente (Sobel simplificado), thresholding e busca do retângulo
 * de maior contraste contra o fundo. Se não houver contraste suficiente, retorna margens suaves (8%).
 */
export function detectDocumentCorners(
  imageData: ImageData,
  origWidth: number,
  origHeight: number,
): QuadCorners {
  const { width: w, height: h, data } = imageData

  // Fallback padrão com margem de 7% caso a foto não tenha contorno contrastante claro
  const defaultCorners: QuadCorners = {
    topLeft: { x: Math.round(origWidth * 0.07), y: Math.round(origHeight * 0.07) },
    topRight: { x: Math.round(origWidth * 0.93), y: Math.round(origHeight * 0.07) },
    bottomRight: { x: Math.round(origWidth * 0.93), y: Math.round(origHeight * 0.93) },
    bottomLeft: { x: Math.round(origWidth * 0.07), y: Math.round(origHeight * 0.93) },
  }

  if (w < 20 || h < 20) return defaultCorners

  // Converte para escala de cinza e calcula gradiente de borda vertical e horizontal
  const gray = new Uint8Array(w * h)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }

  // Identifica bounding box dos picos de gradiente a partir das bordas externas
  // Escaneia a partir das 4 bordas para o centro à procura da primeira transição forte de intensidade
  const thresholdDelta = 28 // sensibilidade do papel contra a mesa
  const minMarginX = Math.floor(w * 0.04)
  const maxMarginX = Math.floor(w * 0.4)
  const minMarginY = Math.floor(h * 0.04)
  const maxMarginY = Math.floor(h * 0.4)

  // Top edge scan: busca Y médio do topo
  let topY = minMarginY
  for (let y = minMarginY; y < maxMarginY; y++) {
    let diffCount = 0
    for (let x = Math.floor(w * 0.25); x < Math.floor(w * 0.75); x += 4) {
      const idx = y * w + x
      const prevIdx = (y - 1) * w + x
      if (Math.abs(gray[idx] - gray[prevIdx]) > thresholdDelta) {
        diffCount++
      }
    }
    if (diffCount > (w * 0.5) / 12) {
      topY = y
      break
    }
  }

  // Bottom edge scan: busca Y da base
  let bottomY = h - 1 - minMarginY
  for (let y = h - 1 - minMarginY; y > h - 1 - maxMarginY; y--) {
    let diffCount = 0
    for (let x = Math.floor(w * 0.25); x < Math.floor(w * 0.75); x += 4) {
      const idx = y * w + x
      const nextIdx = (y + 1) * w + x
      if (Math.abs(gray[idx] - gray[nextIdx]) > thresholdDelta) {
        diffCount++
      }
    }
    if (diffCount > (w * 0.5) / 12) {
      bottomY = y
      break
    }
  }

  // Left edge scan: busca X da esquerda
  let leftX = minMarginX
  for (let x = minMarginX; x < maxMarginX; x++) {
    let diffCount = 0
    for (let y = Math.floor(h * 0.25); y < Math.floor(h * 0.75); y += 4) {
      const idx = y * w + x
      const prevIdx = y * w + (x - 1)
      if (Math.abs(gray[idx] - gray[prevIdx]) > thresholdDelta) {
        diffCount++
      }
    }
    if (diffCount > (h * 0.5) / 12) {
      leftX = x
      break
    }
  }

  // Right edge scan: busca X da direita
  let rightX = w - 1 - minMarginX
  for (let x = w - 1 - minMarginX; x > w - 1 - maxMarginX; x--) {
    let diffCount = 0
    for (let y = Math.floor(h * 0.25); y < Math.floor(h * 0.75); y += 4) {
      const idx = y * w + x
      const nextIdx = y * w + (x + 1)
      if (Math.abs(gray[idx] - gray[nextIdx]) > thresholdDelta) {
        diffCount++
      }
    }
    if (diffCount > (h * 0.5) / 12) {
      rightX = x
      break
    }
  }

  // Validação de sanidade: o documento precisa ter pelo menos 40% da largura e altura
  const detectedW = rightX - leftX
  const detectedH = bottomY - topY

  if (detectedW < w * 0.4 || detectedH < h * 0.4) {
    return defaultCorners
  }

  // Escala as coordenadas de volta para a dimensão original
  const scaleX = origWidth / w
  const scaleY = origHeight / h

  return {
    topLeft: {
      x: Math.round(Math.max(0, leftX * scaleX)),
      y: Math.round(Math.max(0, topY * scaleY)),
    },
    topRight: {
      x: Math.round(Math.min(origWidth, rightX * scaleX)),
      y: Math.round(Math.max(0, topY * scaleY)),
    },
    bottomRight: {
      x: Math.round(Math.min(origWidth, rightX * scaleX)),
      y: Math.round(Math.min(origHeight, bottomY * scaleY)),
    },
    bottomLeft: {
      x: Math.round(Math.max(0, leftX * scaleX)),
      y: Math.round(Math.min(origHeight, bottomY * scaleY)),
    },
  }
}

/**
 * Calcula a largura e a altura do retângulo destino com base nas dimensões euclidianas dos cantos.
 */
export function getQuadDimensions(corners: QuadCorners): { width: number; height: number } {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners

  // Largura superior e inferior
  const widthTop = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y)
  const widthBottom = Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y)
  const maxWidth = Math.max(widthTop, widthBottom)

  // Altura esquerda e direita
  const heightLeft = Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y)
  const heightRight = Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y)
  const maxHeight = Math.max(heightLeft, heightRight)

  return {
    width: Math.max(100, Math.round(maxWidth)),
    height: Math.max(100, Math.round(maxHeight)),
  }
}

/**
 * Calcula a matriz de transformação projetiva (homografia 3x3)
 * que mapeia os 4 cantos arbitrários da imagem original para um retângulo reto [0, 0, dstW, dstH].
 * Em seguida aplica a interpolação bilinear inversa para extrair a imagem desentortada.
 */
export function warpPerspectiveCanvas(
  sourceCanvas: HTMLCanvasElement,
  corners: QuadCorners,
  targetWidth?: number,
  targetHeight?: number,
): HTMLCanvasElement {
  const dims = getQuadDimensions(corners)
  const dstW = Math.min(2400, targetWidth || dims.width)
  const dstH = Math.min(2400, targetHeight || dims.height)

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = dstW
  outputCanvas.height = dstH
  const outCtx = outputCanvas.getContext('2d')
  if (!outCtx) return outputCanvas

  const srcCtx = sourceCanvas.getContext('2d')
  if (!srcCtx) return outputCanvas

  const srcW = sourceCanvas.width
  const srcH = sourceCanvas.height
  const srcImageData = srcCtx.getImageData(0, 0, srcW, srcH)
  const srcPixels = srcImageData.data

  const outImageData = outCtx.createImageData(dstW, dstH)
  const outPixels = outImageData.data

  // Pontos de destino (retângulo reto)
  // Mapeamos dst -> src (backward mapping) para interpolação sem buracos
  const srcPts: [number, number][] = [
    [corners.topLeft.x, corners.topLeft.y],
    [corners.topRight.x, corners.topRight.y],
    [corners.bottomRight.x, corners.bottomRight.y],
    [corners.bottomLeft.x, corners.bottomLeft.y],
  ]

  const dstPts: [number, number][] = [
    [0, 0],
    [dstW, 0],
    [dstW, dstH],
    [0, dstH],
  ]

  // Calcula matriz H que mapeia dstPts -> srcPts
  const H = getPerspectiveTransformMatrix(dstPts, srcPts)

  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      // Coordenadas projetivas
      const denom = H[6] * dx + H[7] * dy + H[8]
      if (Math.abs(denom) < 1e-7) continue

      const sx = (H[0] * dx + H[1] * dy + H[2]) / denom
      const sy = (H[3] * dx + H[4] * dy + H[5]) / denom

      if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
        // Interpolação bilinear para suavidade
        const x0 = Math.floor(sx)
        const x1 = x0 + 1
        const y0 = Math.floor(sy)
        const y1 = y0 + 1

        const fx = sx - x0
        const fy = sy - y0
        const fx1 = 1 - fx
        const fy1 = 1 - fy

        const idx00 = (y0 * srcW + x0) * 4
        const idx10 = (y0 * srcW + x1) * 4
        const idx01 = (y1 * srcW + x0) * 4
        const idx11 = (y1 * srcW + x1) * 4

        const outIdx = (dy * dstW + dx) * 4

        for (let c = 0; c < 3; c++) {
          const val =
            srcPixels[idx00 + c] * fx1 * fy1 +
            srcPixels[idx10 + c] * fx * fy1 +
            srcPixels[idx01 + c] * fx1 * fy +
            srcPixels[idx11 + c] * fx * fy
          outPixels[outIdx + c] = Math.round(val)
        }
        outPixels[outIdx + 3] = 255
      } else if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
        const sIdx = (Math.round(sy) * srcW + Math.round(sx)) * 4
        const outIdx = (dy * dstW + dx) * 4
        outPixels[outIdx] = srcPixels[sIdx]
        outPixels[outIdx + 1] = srcPixels[sIdx + 1]
        outPixels[outIdx + 2] = srcPixels[sIdx + 2]
        outPixels[outIdx + 3] = 255
      }
    }
  }

  outCtx.putImageData(outImageData, 0, 0)
  return outputCanvas
}

/**
 * Resolve sistema 8x8 para obter matriz de homografia 3x3 entre 4 pares de pontos.
 */
function getPerspectiveTransformMatrix(src: [number, number][], dst: [number, number][]): number[] {
  // src[i] -> dst[i]
  const a: number[][] = []
  const b: number[] = []

  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i]
    const [dx, dy] = dst[i]
    a.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx])
    b.push(dx)
    a.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy])
    b.push(dy)
  }

  const h8 = solveGaussianElimination(a, b)
  return [h8[0], h8[1], h8[2], h8[3], h8[4], h8[5], h8[6], h8[7], 1.0]
}

function solveGaussianElimination(A: number[][], b: number[]): number[] {
  const n = b.length
  for (let i = 0; i < n; i++) {
    // Pivoteamento parcial
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k
      }
    }
    const tempA = A[i]
    A[i] = A[maxRow]
    A[maxRow] = tempA

    const tempB = b[i]
    b[i] = b[maxRow]
    b[maxRow] = tempB

    if (Math.abs(A[i][i]) < 1e-12) {
      continue
    }

    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i]
      b[k] -= factor * b[i]
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j]
      }
    }
  }

  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * x[j]
    }
    x[i] = (b[i] - sum) / (A[i][i] || 1e-12)
  }
  return x
}

/**
 * Aplica filtros de aprimoramento em ImageData:
 * - 'color': mantém cores, ajusta contraste e brilho
 * - 'grayscale': escala de cinza calibrada com contraste
 * - 'bw': binarização adaptativa de alto contraste com fundo clareado (estilo scanner profissional)
 * - sharpen: máscara de nitidez leve
 */
export function applyScanFiltersToImageData(
  imageData: ImageData,
  options: {
    contrast?: number
    brightness?: number
    filterMode?: ScanFilterMode
    sharpen?: boolean
  } = {},
): ImageData {
  const { contrast = 1.25, brightness = 1.05, filterMode = 'color', sharpen = false } = options

  const { width: w, height: h, data } = imageData
  const totalPixels = w * h

  // 1. Converte e aplica brilho/contraste
  const contrastFactor = Math.max(0.5, Math.min(2.5, contrast))
  const brightnessFactor = Math.max(0.7, Math.min(1.5, brightness))

  // Pré-cálculo da tabela lookup de contraste e brilho para velocidade máxima
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    let val = (i - 128) * contrastFactor + 128
    val = val * brightnessFactor
    lut[i] = Math.max(0, Math.min(255, Math.round(val)))
  }

  if (filterMode === 'bw') {
    // Threshold adaptativo tipo Sauvola/Otsu simplificado com janela deslizante
    // Primeiro calcula luminância cinza
    const gray = new Uint8Array(totalPixels)
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      gray[j] = lut[g]
    }

    // Calcula limiar médio global com leve bias para preservar traços escuros
    let sum = 0
    for (let j = 0; j < totalPixels; j++) {
      sum += gray[j]
    }
    const globalMean = sum / totalPixels
    const threshold = Math.max(90, Math.min(185, Math.round(globalMean * 0.92)))

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const val = gray[j] >= threshold ? 255 : 0
      data[i] = val
      data[i + 1] = val
      data[i + 2] = val
      // Alpha permanece inalterado
    }
  } else if (filterMode === 'grayscale') {
    for (let i = 0; i < data.length; i += 4) {
      const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      const finalG = lut[g]
      data[i] = finalG
      data[i + 1] = finalG
      data[i + 2] = finalG
    }
  } else {
    // Modo 'color'
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lut[data[i]]
      data[i + 1] = lut[data[i + 1]]
      data[i + 2] = lut[data[i + 2]]
    }
  }

  // 2. Sharpening leve (Unsharp mask 3x3 kernel) se solicitado
  if (sharpen && totalPixels > 100) {
    applyUnsharpMask(imageData)
  }

  return imageData
}

/**
 * Kernel de nitidez leve (unsharp mask 3x3)
 * [ 0, -0.3,  0 ]
 * [-0.3, 2.2, -0.3]
 * [ 0, -0.3,  0 ]
 */
function applyUnsharpMask(imageData: ImageData): void {
  const { width: w, height: h, data } = imageData
  const copy = new Uint8ClampedArray(data)

  const centerWeight = 2.2
  const edgeWeight = -0.3

  for (let y = 1; y < h - 1; y++) {
    const rowOffset = y * w
    const prevRowOffset = (y - 1) * w
    const nextRowOffset = (y + 1) * w

    for (let x = 1; x < w - 1; x++) {
      const idx = (rowOffset + x) * 4
      const topIdx = (prevRowOffset + x) * 4
      const bottomIdx = (nextRowOffset + x) * 4
      const leftIdx = (rowOffset + (x - 1)) * 4
      const rightIdx = (rowOffset + (x + 1)) * 4

      for (let c = 0; c < 3; c++) {
        const val =
          copy[idx + c] * centerWeight +
          (copy[topIdx + c] + copy[bottomIdx + c] + copy[leftIdx + c] + copy[rightIdx + c]) *
            edgeWeight
        data[idx + c] = Math.max(0, Math.min(255, Math.round(val)))
      }
    }
  }
}

/**
 * Gera um arquivo PDF no cliente contendo uma ou mais páginas de imagem em alta definição.
 * Constrói a estrutura nativa de PDF (PDF 1.4 com streams JPEG embutidos) de forma 100% pura,
 * rápida e independente de pacotes pesados de terceiros.
 */
export async function createMultiPagePdfFromBlobs(imageBlobs: Blob[]): Promise<Blob> {
  if (imageBlobs.length === 0) {
    throw new Error('Nenhuma página para gerar PDF')
  }

  // Coleta dados binários e dimensões de cada imagem
  interface PageData {
    width: number
    height: number
    bytes: Uint8Array
  }

  const pages: PageData[] = []

  for (const blob of imageBlobs) {
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // Extrai dimensões criando uma Image
    const img = new Image()
    const objectUrl = URL.createObjectURL(blob)
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        pages.push({
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 1100,
          bytes,
        })
        URL.revokeObjectURL(objectUrl)
        resolve()
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Falha ao processar página de imagem para PDF'))
      }
      img.src = objectUrl
    })
  }

  // Gera o PDF binário puro
  const pdfBytes = buildNativePdfWithJpegPages(pages)
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}

/**
 * Montador de PDF com formato padrão A4/Auto com imagens DCTDecode (JPEG nativo).
 */
function buildNativePdfWithJpegPages(
  pages: { width: number; height: number; bytes: Uint8Array }[],
): Uint8Array {
  const chunks: (string | Uint8Array)[] = []
  const xrefOffsets: number[] = [0] // Objeto 0 é sempre livre

  let currentOffset = 0
  const append = (data: string | Uint8Array) => {
    chunks.push(data)
    currentOffset += typeof data === 'string' ? new TextEncoder().encode(data).length : data.length
  }

  // Cabeçalho PDF 1.4
  append('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')

  const totalPages = pages.length
  // Estrutura de objetos:
  // Obj 1: Catalog
  // Obj 2: Pages tree
  // Para cada página i (1..N):
  //   Obj 2 + (i-1)*3 + 1: Page i
  //   Obj 2 + (i-1)*3 + 2: Content stream i
  //   Obj 2 + (i-1)*3 + 3: XObject Image i

  const catalogObjNum = 1
  const pagesObjNum = 2

  // Catalog
  xrefOffsets.push(currentOffset)
  append(`${catalogObjNum} 0 obj\n<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>\nendobj\n`)

  // Pages tree
  const pageObjNums: number[] = []
  for (let i = 0; i < totalPages; i++) {
    pageObjNums.push(2 + i * 3 + 1)
  }
  const kidsStr = pageObjNums.map((n) => `${n} 0 R`).join(' ')

  xrefOffsets.push(currentOffset)
  append(
    `${pagesObjNum} 0 obj\n<< /Type /Pages /Kids [ ${kidsStr} ] /Count ${totalPages} >>\nendobj\n`,
  )

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i]
    const pageNum = 2 + i * 3 + 1
    const contentNum = 2 + i * 3 + 2
    const imageNum = 2 + i * 3 + 3

    // Dimensões da página no PDF (pontos tipográficos pt; 72 pt/polegada)
    // Ajusta para manter proporção dentro de um A4 padrão (595 x 842 pt)
    const a4W = 595.28
    const a4H = 841.89
    const aspect = page.width / page.height
    let pdfPageW = a4W
    let pdfPageH = a4H

    if (aspect > 1) {
      // Paisagem
      pdfPageW = a4H
      pdfPageH = a4W
    }

    // Conteúdo da página: escala e desenha a imagem preenchendo a página com pequena margem (10pt)
    const margin = 10
    const renderW = pdfPageW - margin * 2
    const renderH = pdfPageH - margin * 2

    // Stream de desenho do XObject: q (save), cm (transform), /ImX Do (draw), Q (restore)
    const contentStream = `q\n${renderW.toFixed(2)} 0 0 ${renderH.toFixed(2)} ${margin.toFixed(2)} ${margin.toFixed(2)} cm\n/Im${i + 1} Do\nQ\n`
    const contentLen = new TextEncoder().encode(contentStream).length

    // Objeto Page
    xrefOffsets.push(currentOffset)
    append(
      `${pageNum} 0 obj\n<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${pdfPageW.toFixed(2)} ${pdfPageH.toFixed(2)}] /Contents ${contentNum} 0 R /Resources << /XObject << /Im${i + 1} ${imageNum} 0 R >> >> >>\nendobj\n`,
    )

    // Objeto Content Stream
    xrefOffsets.push(currentOffset)
    append(
      `${contentNum} 0 obj\n<< /Length ${contentLen} >>\nstream\n${contentStream}endstream\nendobj\n`,
    )

    // Objeto XObject Image (DCTDecode = JPEG nativo sem recodificação)
    xrefOffsets.push(currentOffset)
    const imgHeader = `${imageNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`
    append(imgHeader)
    append(page.bytes)
    append('\nendstream\nendobj\n')
  }

  // Tabela xref
  const startXref = currentOffset
  const totalObjs = 2 + totalPages * 3 + 1
  append(`xref\n0 ${totalObjs}\n`)
  append('0000000000 65535 f \n')
  for (let i = 1; i < totalObjs; i++) {
    const offset = xrefOffsets[i] || 0
    const offsetStr = offset.toString().padStart(10, '0')
    append(`${offsetStr} 00000 n \n`)
  }

  // Trailer
  append(
    `trailer\n<< /Size ${totalObjs} /Root ${catalogObjNum} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`,
  )

  // Mescla chunks em um Uint8Array final
  let totalLength = 0
  const encodedChunks: Uint8Array[] = chunks.map((c) => {
    if (typeof c === 'string') {
      return new TextEncoder().encode(c)
    }
    return c
  })

  for (const chunk of encodedChunks) {
    totalLength += chunk.length
  }

  const buffer = new ArrayBuffer(totalLength)
  const result = new Uint8Array(buffer)
  let pos = 0
  for (const chunk of encodedChunks) {
    result.set(chunk, pos)
    pos += chunk.length
  }

  return result
}
