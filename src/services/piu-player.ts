// Player do "piu" do Curiango — toca quando chega push com o app aberto.
// ARQUITETURA FINAL (v0.0.432 — "áudio pré-carregado"):
// 1. No 1º toque da sessão, o mp3 é baixado e fica PRÉ-CARREGADO no elemento <audio>.
// 2. No push, o SW pergunta via MessageChannel; a página chama play() no elemento
//    pré-carregado — INSTANTÂNEO (sem fetch, sem decode) — e responde o resultado real.
// 3. canPlay: true só é respondido COM O SOM JÁ TOCANDO. Falha → som do sistema. Nunca mudo.
// 4. O AudioContext (WebAudio) ficou como fallback — o elemento é mais confiável no Android.
const PIU_URL =
  'https://evcxjxuakiyjerujntli.supabase.co/storage/v1/object/public/branding/curiango-piu-final.mp3?v=1'

let audioEl: HTMLAudioElement | null = null
let unlocked = false

/** Chamado no 1º pointerdown/keydown da sessão: baixa e pré-carrega o piu (play() fica instantâneo). */
export function initPiuUnlock(): void {
  if (unlocked) return
  unlocked = true
  try {
    if (!audioEl) {
      audioEl = new Audio(PIU_URL)
      audioEl.preload = 'auto'
      audioEl.volume = 0.9
      audioEl.load() // baixa AGORA, com gesto — fica pronto pro push
    }
  } catch {
    /* silencioso */
  }
}

/**
 * PROVA REAL: play() no elemento pré-carregado (instantâneo — sem rede).
 * Retorna true SOMENTE se o som começou a tocar de fato.
 */
export async function attemptPiuPlay(): Promise<boolean> {
  try {
    if (document.hidden || !unlocked || !audioEl) return false
    audioEl.currentTime = 0
    await audioEl.play() // resolve quando o áudio começou de fato
    return true
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
  try {
    if (!audioEl) {
      initPiuUnlock()
    }
    if (audioEl) {
      audioEl.currentTime = 0
      void audioEl.play().catch(() => {
        /* autoplay bloqueado — som do sistema cobre */
      })
    }
  } catch {
    /* silencioso */
  }
}
