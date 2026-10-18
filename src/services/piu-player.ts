// Player do "piu" do Curiango — toca quando chega push com o app aberto (SW manda PLAY_PIU).
// AudioContext precisa de gesto prévio do usuário pra desbloquear; como notificações chegam
// sem interação, usamos o elemento <audio> (autoplay permitido p/ áudio curto em notificação).
let audioEl: HTMLAudioElement | null = null

export function playPiu(): void {
  try {
    if (!audioEl) {
      audioEl = new Audio(
        'https://evcxjxuakiyjerujntli.supabase.co/storage/v1/object/public/branding/curiango-piu.mp3',
      )
      audioEl.preload = 'auto'
      audioEl.volume = 0.9
    }
    audioEl.currentTime = 0
    void audioEl.play().catch(() => {
      /* autoplay bloqueado — o som do sistema cobre */
    })
  } catch {
    /* silencioso */
  }
}
