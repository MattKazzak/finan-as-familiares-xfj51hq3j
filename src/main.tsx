/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { playPiu, initPiuUnlock } from './services/piu-player'

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

// Registra o Service Worker oficial do Curiangoo com atualização forçada e skipWaiting
registerAppServiceWorker()

// Som do Curiango: o SW manda PLAY_PIU quando chega push com o app aberto.
// Destravamento: o 1º toque em qualquer lugar da sessão libera o áudio (autoplay policy).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_PIU') playPiu()
  })
}
window.addEventListener('pointerdown', initPiuUnlock, { once: true, capture: true })
window.addEventListener('keydown', initPiuUnlock, { once: true, capture: true })

createRoot(document.getElementById('root')!).render(<App />)
