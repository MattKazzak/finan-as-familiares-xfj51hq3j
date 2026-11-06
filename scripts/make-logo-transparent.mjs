// ONE-OFF (mantido para referência/reuso): remove o fundo branco da logo do
// login (keying por luminância com tolerância suave + fecho de buracos internos
// + decontamination das bordas antialiased). Rodar manualmente:
//   node scripts/make-logo-transparent.mjs
// IMPORTANTE: o build de produção não aceita gerar o PNG no momento do deploy
// (arquivo novo não fica disponível ao vite), por isso a página usa
// mix-blend-multiply; este script fica aqui para uso futuro (splash, dark mode).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(__dirname, '..', 'src', 'assets', 'imagemgerada1793989752917-c429b.png')
const OUT = path.join(__dirname, '..', 'src', 'assets', 'curiangoo-logo-transparent.png')

const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const { width, height, channels } = info

// Passo 1 — máscara bruta: alpha 0 onde o pixel é "praticamente branco".
// Duas zonas: core (luminância ≥ 250 → apaga) e halo (215-250 → alpha parcial
// proporcional), o que preserva o antialiasing das bordas do traço navy.
const N = width * height
const alphaCore = new Uint8Array(N)
for (let i = 0; i < N; i++) {
  const o = i * channels
  const r = data[o], g = data[o + 1], b = data[o + 2]
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  const chroma = Math.max(r, g, b) - Math.min(r, g, b)
  // chroma alto = pixel colorido de verdade (nunca apagar, mesmo se claro)
  if (lum >= 250 || (lum >= 235 && chroma < 12)) {
    alphaCore[i] = 0
  } else if (lum >= 215 && chroma < 16) {
    alphaCore[i] = Math.round(((245 - lum) / 30) * 255)
  } else {
    alphaCore[i] = 255
  }
}

// Passo 2 — proteção de buracos: flood fill a partir das bordas da imagem
// sobre pixels apagáveis. O que não é alcançado é branco INTERNO (contra-plástico,
// olho) e volta a ser opaco em vez de virar furo transparente.
const visited = new Uint8Array(N)
const queue = new Int32Array(N)
let qh = 0, qt = 0
const push = (i) => {
  if (!visited[i] && alphaCore[i] < 255) { visited[i] = 1; queue[qt++] = i }
}
for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x) }
for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1) }
while (qh < qt) {
  const i = queue[qh++]
  const x = i % width, y = (i / width) | 0
  if (x > 0) push(i - 1)
  if (x < width - 1) push(i + 1)
  if (y > 0) push(i - width)
  if (y < height - 1) push(i + width)
}

// Passo 3 — decontaminate: nas bordas (alpha parcial), mistura o RGB na
// direção da média dos vizinhos opacos, eliminando o leite branco do halo.
const out = Buffer.from(data)
const isOpaque = (i) => alphaCore[i] === 255
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = y * width + x
    const a = alphaCore[i]
    if (a === 0 || a === 255) continue
    let sr = 0, sg = 0, sb = 0, n = 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const j = ny * width + nx
        if (!isOpaque(j)) continue
        const oj = j * channels
        sr += out[oj]; sg += out[oj + 1]; sb += out[oj + 2]
        n++
      }
    }
    if (n > 0) {
      const o = i * channels
      out[o] = Math.round(0.65 * (sr / n) + 0.35 * out[o])
      out[o + 1] = Math.round(0.65 * (sg / n) + 0.35 * out[o + 1])
      out[o + 2] = Math.round(0.65 * (sb / n) + 0.35 * out[o + 2])
      out[o + 3] = a
    }
  }
}

// Aplica a máscara final: alpha parcial do halo só onde o flood fill alcançou;
// branco interno volta a opaco (buraco fechado, não transparente).
for (let i = 0; i < N; i++) {
  const o = i * channels
  out[o + 3] = visited[i] === 1 ? alphaCore[i] : 255
}

await sharp(out, { raw: { width, height, channels } })
  .png({ compressionLevel: 9 })
  .toFile(OUT)

const stats = fs.statSync(OUT)
console.log(`OK: ${OUT} (${width}x${height}, ${(stats.size / 1024).toFixed(1)} KB)`)
