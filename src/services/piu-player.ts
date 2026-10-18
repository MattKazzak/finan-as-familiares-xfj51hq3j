// Player do "piu" do Curiango — toca quando chega push com o app aberto (SW manda PLAY_PIU).
// Navegadores bloqueiam áudio sem interação prévia (autoplay policy): o piu toca quando
// o usuário já tocou no app nesta sessão (sticky activation) ou ao tocar na notificação.
// O som do sistema (canal Android/iOS) é o garantido com app fechado — este é o toque de marca.
const PIU_URL =
  'https://evcxjxuakiyjerujntli.supabase.co/storage/v1/object/public/branding/curiango-piu.mp3'

let ctx: AudioContext | null = null
let audioEl: HTMLAudioElement | null = null

async function playViaContext(): Promise<boolean> {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return false
    if (!ctx) ctx = new AC()
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
    if (!audioEl) {
      audioEl = new Audio(PIU_URL)
      audioEl.preload = 'auto'
      audioEl.volume = 0.9
    }
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
