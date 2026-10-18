// Player do "piu" do Curiango — toca quando chega push com o app aberto.
// ARQUITETURA À PROVA DE FALHAS (v0.0.426 — "prova real"):
// 1. SWs são efêmeros: no push, o SW PERGUNTA à página via MessageChannel.
// 2. A página TENTA TOCAR o piu de verdade NA HORA da pergunta e responde o RESULTADO:
//    som tocando de fato → { canPlay: true } → SW mostra notificação silenciosa.
//    Qualquer falha → { canPlay: false } → SW mostra notificação com som do sistema.
// 3. Nunca há notificação muda: canPlay: true só é respondido COM O SOM JÁ TOCANDO.
// 4. Autoplay policy: o 1º toque na sessão destrava e pré-carrega (initPiuUnlock).
const PIU_URL =
  'https://evcxjxuakiyjerujntli.supabase.co/storage/v1/object/public/branding/curiango-piu-final.mp3?v=1'

let ctx: AudioContext | null = null
let audioEl: HTMLAudioElement | null = null
let unlocked = false

/** Chamado no primeiro pointerdown/keydown do app: destrava o áudio da sessão e pré-carrega o piu. */
export function initPiuUnlock(): void {
  if (unlocked) return
  unlocked = true
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AC) {
      if (!ctx) ctx = new AC()
      void ctx.resume().catch(() => {})
    }
    if (!audioEl) {
      audioEl = new Audio(PIU_URL)
      audioEl.preload = 'auto'
      audioEl.volume = 0.9
      audioEl.load()
    }
  } catch {
    /* silencioso */
  }
}

/** Toca via AudioContext (WebAudio). Retorna true se src.start() executou (som tocando). */
async function playViaContext(): Promise<boolean> {
  try {
    if (!ctx) return false
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
    if (ctx.state !== 'running') return false
    const res = await fetch(PIU_URL)
    const buf = await res.arrayBuffer()
    const audio = await ctx.decodeAudioData(buf)
    const src = ctx.createBufferSource()
    src.buffer = audio
    src.connect(ctx.destination)
    src.start() // síncrono — se não lançou, está tocando
    return true
  } catch {
    return false
  }
}

/** Toca via elemento <audio>. Retorna true se play() resolveu (som tocando). */
async function playViaElement(): Promise<boolean> {
  try {
    if (!audioEl) return false
    audioEl.currentTime = 0
    await audioEl.play() // resolve só quando o áudio começou de fato
    return true
  } catch {
    return false
  }
}

/**
 * PROVA REAL: tenta tocar o piu AGORA e retorna se o som está de fato tocando.
 * Usada no handshake do SW — canPlay: true = som já audível no dispositivo.
 */
export async function attemptPiuPlay(): Promise<boolean> {
  try {
    if (document.hidden || !unlocked) return false
    const viaCtx = await Promise.race([
      playViaContext(),
      new Promise<boolean>((r) => setTimeout(() => r(false), 400)),
    ])
    if (viaCtx) return true
    const viaEl = await Promise.race([
      playViaElement(),
      new Promise<boolean>((r) => setTimeout(() => r(false), 400)),
    ])
    return viaEl
  } catch {
    return false
  }
}

/** Responde o PIU_QUERY do SW: toca o piu e responde o resultado REAL via MessagePort. */
export function handlePiuQuery(port: MessagePort): void {
  if (!port) return
  void attemptPiuPlay()
    .then((canPlay) => {
      try {
        port.postMessage({ canPlay })
      } catch {
        /* port fechado */
      }
    })
    .catch(() => {
      try {
        port.postMessage({ canPlay: false })
      } catch {
        /* port fechado */
      }
    })
}

/** Toca o piu (usado no PLAY_PIU do notificationclick — gesto garantido). */
export function playPiu(): void {
  void playViaContext().then((ok) => {
    if (!ok) playViaElement()
  })
}
