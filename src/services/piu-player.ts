// Player do "piu" do Curiango — toca quando chega push com o app aberto (SW manda PLAY_PIU).
// ARQUITETURA À PROVA DE FALHAS (v0.0.425):
// 1. SWs são efêmeros — NADA de estado em memória do SW. No push, o SW PERGUNTA à página
//    via MessageChannel ("consegue tocar áudio AGORA?") com timeout de 350ms.
// 2. A página responde canPlay só se: visível + áudio destravado + AudioContext running.
// 3. Fail-safe: sem resposta/qualquer erro → som do sistema (nunca notificação muda).
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

/**
 * Responde ao handshake do SW: a página consegue tocar o piu NESTE instante?
 * Critérios: página visível + sessão destravada + (AudioContext running OU elemento pronto).
 * Tenta resume rápido do AudioContext (150ms) antes de responder.
 */
export async function canPlayPiuNow(): Promise<boolean> {
  try {
    if (document.hidden || !unlocked) return false
    if (ctx && ctx.state === 'suspended') {
      await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 150))])
    }
    return (ctx !== null && ctx.state === 'running') || audioEl !== null
  } catch {
    return false
  }
}

/** Responde o PIU_QUERY do SW via MessagePort (o SW espera até 350ms). */
export function handlePiuQuery(port: MessagePort): void {
  if (!port) return
  void canPlayPiuNow()
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
    src.start()
    return true
  } catch {
    return false
  }
}

function playViaElement(): void {
  try {
    if (!audioEl) return
    audioEl.currentTime = 0
    void audioEl.play().catch(() => {
      /* autoplay bloqueado — som do sistema cobre */
    })
  } catch {
    /* silencioso */
  }
}

export function playPiu(): void {
  void playViaContext().then((ok) => {
    if (!ok) playViaElement()
  })
}
