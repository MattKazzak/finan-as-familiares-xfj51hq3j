import { useState, useEffect, useCallback } from 'react'

export interface ServiceWorkerUpdateState {
  hasUpdate: boolean
  isUpdating: boolean
  updateServiceWorker: () => Promise<void>
  dismissUpdate: () => void
}

let registrationInstance: ServiceWorkerRegistration | null = null
const updateListeners = new Set<(hasUpdate: boolean) => void>()
let globalHasUpdate = false

function notifyUpdateListeners(value: boolean) {
  globalHasUpdate = value
  updateListeners.forEach((fn) => fn(value))
}

export function registerAppServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  // Previne múltiplos registros na mesma sessão da janela
  if (window.__CURIANGOO_SW_REGISTERED__) {
    return
  }
  window.__CURIANGOO_SW_REGISTERED__ = true

  // URL ESTÁVEL: nunca usar timestamp no sw.js — o Chrome trata cada URL nova como
  // outro worker → instala → ativa → controllerchange → reload → loop infinito.
  const swUrl = '/sw.js'

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(swUrl, { scope: '/' })
      .then((registration) => {
        registrationInstance = registration

        // Waiting worker: ativa IMEDIATAMENTE (skipWaiting) — o controllerchange recarrega 1x.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          notifyUpdateListeners(true)
        }

        // Listener de novas versões encontradas
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing
          if (!installingWorker) return

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nova versão baixada enquanto já havia uma anterior ativa
              notifyUpdateListeners(true)
            }
          })
        })

        // Checagem periódica suave de novas versões (a cada 30 minutos se a aba estiver ativa)
        setInterval(
          () => {
            registration.update().catch(() => {})
          },
          1000 * 60 * 30,
        )

        // Força a checagem de update logo após abrir o app (PWA demora a pegar versão nova)
        registration.update().catch(() => {})
        // E de novo aos 10s (o SW novo baixa em background; garante a troca na 1ª sessão)
        setTimeout(() => {
          registration.update().catch(() => {})
        }, 10000)
      })
      .catch((err) => {
        console.warn('[SW Registration] Não foi possível registrar service worker:', err)
      })

    // Se o controller mudar (skipWaiting ativado), recarrega UMA vez por sessão.
    // Proteção anti-loop: nunca recarregar 2x (update + controllerchange + update...).
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
}

declare global {
  interface Window {
    __CURIANGOO_SW_REGISTERED__?: boolean
  }
}

export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [hasUpdate, setHasUpdate] = useState<boolean>(globalHasUpdate)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)

  useEffect(() => {
    const handleUpdate = (updated: boolean) => {
      setHasUpdate(updated)
    }

    updateListeners.add(handleUpdate)
    setHasUpdate(globalHasUpdate)

    return () => {
      updateListeners.delete(handleUpdate)
    }
  }, [])

  const updateServiceWorker = useCallback(async () => {
    setIsUpdating(true)
    try {
      if (registrationInstance?.waiting) {
        // Envia mensagem direta para o worker em espera assumir imediatamente
        registrationInstance.waiting.postMessage({ type: 'SKIP_WAITING' })
      } else if (navigator.serviceWorker) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        } else {
          // Fallback para hard reload
          window.location.reload()
        }
      } else {
        window.location.reload()
      }
    } catch (err) {
      console.warn('Erro ao atualizar Service Worker:', err)
      window.location.reload()
    }
  }, [])

  const dismissUpdate = useCallback(() => {
    notifyUpdateListeners(false)
  }, [])

  return {
    hasUpdate,
    isUpdating,
    updateServiceWorker,
    dismissUpdate,
  }
}
