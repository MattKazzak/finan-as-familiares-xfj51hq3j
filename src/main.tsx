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

// AUTO-CURA DE CHUNK VELHO (20/10, tela branca pós-deploy): quando o app em
// execução pede um chunk lazy que o deploy novo já substituiu (arquivo some do
// servidor), o import dinâmico falha e a tela fica branca — o usuário precisa
// fechar e reabrir 2x. Fix: captura o erro de chunk e recarrega a página UMA
// vez por sessão (sessionStorage evita loop infinito se o problema persistir).
;(function healStaleChunks() {
  const KEY = 'curiangoo_chunk_reload'
  window.addEventListener('error', (e) => {
    const msg = e?.message || ''
    const isChunkError =
      /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
        msg,
      ) || /Loading chunk .* failed/i.test(msg)
    if (!isChunkError) return
    try {
      if (sessionStorage.getItem(KEY)) return // já recarregou nesta sessão — não loopa
      sessionStorage.setItem(KEY, '1')
    } catch {
      // sessionStorage indisponível — recarrega mesmo assim (1x)
    }
    window.location.replace(window.location.href)
  })
  // Vite também rejeita promises de import — cobre o caminho unhandledrejection
  window.addEventListener('unhandledrejection', (e) => {
    const reason = String(e?.reason?.message || e?.reason || '')
    if (
      /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
        reason,
      )
    ) {
      try {
        if (sessionStorage.getItem(KEY)) return
        sessionStorage.setItem(KEY, '1')
      } catch {
        // segue
      }
      window.location.replace(window.location.href)
    }
  })
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

// REFERRAL (22/10): captura ?ref=CODE do link de convite ANTES de tudo —
// guarda na sessionStorage (o usuário pode não estar logado ainda; o código
// é aplicado no 1º login/signup via use-auth).
;(function captureReferral() {
  try {
    const m = window.location.search.match(/[?&]ref=([A-Za-z0-9]+)/)
    if (m) {
      sessionStorage.setItem('curiangoo_ref', m[1].toUpperCase())
      // limpa o ?ref= da URL (o usuário pode recarregar/compartilhar o link limpo)
      window.history.replaceState({}, '', window.location.pathname)
    }
  } catch {
    /* sessionStorage indisponível — segue */
  }
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
