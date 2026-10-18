/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'
import { playPiu, initPiuUnlock, handlePiuQuery } from './services/piu-player'

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

// Som do Curiango: no push, o SW pergunta via PIU_QUERY e a página TOCA O PIU DE VERDADE
// (prova real) — responde canPlay:true só com o som já tocando. PLAY_PIU = notificationclick.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_PIU') playPiu()
    if (event.data?.type === 'PIU_QUERY' && event.ports?.[0]) {
      handlePiuQuery(event.ports[0])
    }
  })
}
// Destravamento do áudio: o 1º toque/tecla da sessão (regra de autoplay do Chrome —
// renova a cada abertura do app; sem isso o piu falha e o som do sistema cobre).
window.addEventListener('pointerdown', initPiuUnlock, { once: true, capture: true })
window.addEventListener('keydown', initPiuUnlock, { once: true, capture: true })

createRoot(document.getElementById('root')!).render(<App />)
