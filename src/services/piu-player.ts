// Player do "piu" do Curiango — toca quando chega push com o app aberto (SW manda PLAY_PIU).
// Política de autoplay: áudio só toca se houve interação do usuário nesta sessão da página.
// Estratégia: no PRIMEIRO toque em qualquer lugar do app, destravamos e pré-carregamos o áudio —
// daí em diante o piu toca em qualquer push da sessão. App fechado = som do sistema (canal).
const PIU_URL =
  'https://evcxjxuakiyjerujntli.supabase.co/storage/v1/object/public/branding/curiango-piu-final.mp3?v=1'

let ctx: AudioContext | null = null
let audioEl: HTMLAudioElement | null = null
let unlocked = false

/** Estado atual da sessão de áudio (visível + destravado = piu confiável). */
export function isPiuUnlocked(): boolean {
  return unlocked
}

/** Avisa o SW se o piu pode tocar com confiança (p/ decidir suprimir o som do sistema). */
export function notifyPiuState(active: boolean): void {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'PIU_SESSION', active })
  } catch {
    /* silencioso */
  }
}

/** Chamado no primeiro pointerdown do app: destrava o áudio da sessão e pré-carrega o piu. */
export function initPiuUnlock(): void {
  if (unlocked) return
  unlocked = true
  notifyPiuState(!document.hidden)
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
      // pré-carrega de fato (autoplay policy exige gesto p/ PLAY, mas preload é livre)
      audioEl.load()
    }
  } catch {
    /* silencioso */
  }
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
