/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { startRealtimePiu, initPiuUnlock, playPiu } from './services/realtime-piu'

// @skip-protected: Do not remove. Required for React rendering.
import { registerAppServiceWorker } from './hooks/use-service-worker'

// BLINDAGEM ANTI-DARK-MODE (antes do primeiro paint): remove a classe dark,
// limpa preferências de tema persistidas e fixa o color-scheme em light.
// O app é light-only por decisão de produto — comportamento idêntico em qualquer navegador.
;(function forceLightTheme() {
  try {
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'
    document.body?.style.setProperty('color-scheme', 'light')
    localStorage.removeItem('theme')
    localStorage.removeItem('next-themes')
    localStorage.removeItem('next-themes-prefers-color-scheme')
  } catch {
    // localStorage indisponível — segue o fluxo
  }
})()

// Registra o Service Worker (curiangoo-sw.js — nome novo, nunca cacheado)
registerAppServiceWorker()

// SPLASH DO CURIANGO (19/10): o HTML estático (#splash) cobre o tempo de carregamento
// do JS; quando o React monta, esvanece suave e remove do DOM. Se algo falhar, o
// splash some mesmo assim (fallback 4s) — nunca prende o usuário numa tela morta.
;(function dismissSplash() {
  const remove = () => {
    const el = document.getElementById('splash')
    if (!el) return
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 500)
  }
  if (document.readyState === 'complete') {
    setTimeout(remove, 350)
  } else {
    window.addEventListener('load', () => setTimeout(remove, 350), { once: true })
  }
  setTimeout(remove, 4000) // fallback: nunca prender
})()

// PIU DO CURIANGO (padrão Discord/Slack): a página escuta INSERTs via Supabase Realtime
// e toca o piu na hora — determinístico, sem SW, sem handshake, sem timeout.
startRealtimePiu()

// Destravamento do áudio: 1º toque/tecla da sessão (regra de autoplay do Chrome).
window.addEventListener('pointerdown', initPiuUnlock, { once: true, capture: true })
window.addEventListener('keydown', initPiuUnlock, { once: true, capture: true })

// PLAY_PIU do SW (ao tocar numa notificação — gesto garantido)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_PIU') playPiu()
  })
}

createRoot(document.getElementById('root')!).render(<App />)
