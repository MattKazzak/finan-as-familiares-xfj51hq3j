import { describe, it, expect } from 'vitest'
import {
  orderCorners,
  detectDocumentCorners,
  getQuadDimensions,
  applyScanFiltersToImageData,
  Point,
} from '@/services/document-scanner-core'

describe('Document Scanner Core - Algoritmos de Detecção e Processamento', () => {
  it('ordena 4 cantos em topLeft, topRight, bottomRight e bottomLeft corretamente', () => {
    const rawPoints: Point[] = [
      { x: 500, y: 700 }, // BR
      { x: 50, y: 50 }, // TL
      { x: 50, y: 700 }, // BL
      { x: 500, y: 50 }, // TR
    ]

    const ordered = orderCorners(rawPoints)
    expect(ordered.topLeft).toEqual({ x: 50, y: 50 })
    expect(ordered.topRight).toEqual({ x: 500, y: 50 })
    expect(ordered.bottomRight).toEqual({ x: 500, y: 700 })
    expect(ordered.bottomLeft).toEqual({ x: 50, y: 700 })
  })

  it('calcula dimensões do quadrilátero com base nos pontos', () => {
    const corners = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 400, y: 0 },
      bottomRight: { x: 400, y: 600 },
      bottomLeft: { x: 0, y: 600 },
    }
    const dims = getQuadDimensions(corners)
    expect(dims.width).toBe(400)
    expect(dims.height).toBe(600)
  })

  it('detectDocumentCorners retorna margem segura quando a imagem tem baixo contraste', () => {
    // Imagem sintética cinza uniforme de 100x100
    const w = 100
    const h = 100
    const buffer = new Uint8ClampedArray(w * h * 4)
    buffer.fill(128)
    const imgData = { width: w, height: h, data: buffer } as unknown as ImageData

    const corners = detectDocumentCorners(imgData, 1000, 1000)
    // Fallback de 7% de margem
    expect(corners.topLeft.x).toBe(70)
    expect(corners.topLeft.y).toBe(70)
    expect(corners.bottomRight.x).toBe(930)
    expect(corners.bottomRight.y).toBe(930)
  })

  it('detectDocumentCorners detecta retângulo contrastante central', () => {
    const w = 100
    const h = 100
    const buffer = new Uint8ClampedArray(w * h * 4)

    // Fundo escuro (mesa preta, valor 20)
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 20
      buffer[i + 1] = 20
      buffer[i + 2] = 20
      buffer[i + 3] = 255
    }

    // Papel branco central (x: 15..85, y: 15..85)
    for (let y = 15; y <= 85; y++) {
      for (let x = 15; x <= 85; x++) {
        const idx = (y * w + x) * 4
        buffer[idx] = 240
        buffer[idx + 1] = 240
        buffer[idx + 2] = 240
      }
    }

    const imgData = { width: w, height: h, data: buffer } as unknown as ImageData
    const corners = detectDocumentCorners(imgData, 1000, 1000)

    // Os cantos devem estar próximos de x=150..850, y=150..850
    expect(corners.topLeft.x).toBeLessThanOrEqual(200)
    expect(corners.topLeft.y).toBeLessThanOrEqual(200)
    expect(corners.bottomRight.x).toBeGreaterThanOrEqual(800)
    expect(corners.bottomRight.y).toBeGreaterThanOrEqual(800)
  })

  it('aplica filtro preto e branco de alto contraste (binarização)', () => {
    const w = 2
    const h = 2
    const buffer = new Uint8ClampedArray([
      240,
      240,
      240,
      255, // claro -> deve ir pra 255
      30,
      30,
      30,
      255, // escuro -> deve ir pra 0
      250,
      250,
      250,
      255,
      20,
      20,
      20,
      255,
    ])
    const imgData = { width: w, height: h, data: buffer } as unknown as ImageData

    applyScanFiltersToImageData(imgData, { filterMode: 'bw' })

    // Primeiro pixel vira 255 (fundo branco limpo)
    expect(buffer[0]).toBe(255)
    expect(buffer[1]).toBe(255)
    expect(buffer[2]).toBe(255)

    // Segundo pixel vira 0 (texto preto nítido)
    expect(buffer[4]).toBe(0)
    expect(buffer[5]).toBe(0)
    expect(buffer[6]).toBe(0)
  })

  it('aplica filtro de escala de cinza', () => {
    const w = 1
    const h = 1
    const buffer = new Uint8ClampedArray([200, 100, 50, 255])
    const imgData = { width: w, height: h, data: buffer } as unknown as ImageData

    applyScanFiltersToImageData(imgData, { filterMode: 'grayscale' })

    // R, G e B devem ser idênticos (cinza neutro)
    expect(buffer[0]).toBe(buffer[1])
    expect(buffer[1]).toBe(buffer[2])
  })
})
