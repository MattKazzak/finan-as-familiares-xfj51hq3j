import { useState, useEffect, useCallback } from 'react'

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

declare global {
  interface Navigator {
    standalone?: boolean
  }
}

const STORAGE_KEY = 'curiangoo_pwa_install_dismissed'

// Estado global mantido na memória da aba/janela para sincronização instantânea
// entre qualquer consumidor (Profile, InstallPwaBanner, etc.)
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null
const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>()

function setGlobalDeferredPrompt(prompt: BeforeInstallPromptEvent | null) {
  globalDeferredPrompt = prompt
  promptListeners.forEach((listener) => listener(prompt))
}

// Inicializa a escuta global do evento no window logo no carregamento do módulo
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    setGlobalDeferredPrompt(e as BeforeInstallPromptEvent)
  })

  window.addEventListener('appinstalled', () => {
    setGlobalDeferredPrompt(null)
  })
}

/**
 * Função utilitária para detectar o cenário atual de instalação:
 * - 'native': Suporta prompt nativo direto de 1 clique (Android / Chrome / Edge)
 * - 'ios': Dispositivo Apple (iPhone / iPad / iPod) exigindo menu de Compartilhar
 * - 'manual': Outros navegadores sem suporte ao prompt nativo (Firefox, Samsung Internet sem prompt, etc.)
 */
export function getInstallScenario(
  deferredPrompt: BeforeInstallPromptEvent | null,
  isIos: boolean,
): 'native' | 'ios' | 'manual' {
  if (deferredPrompt) return 'native'
  if (isIos) return 'ios'
  return 'manual'
}

export function usePwaInstall() {
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const matchMediaStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches
    const navigatorStandalone = Boolean(window.navigator?.standalone)
    return Boolean(matchMediaStandalone || navigatorStandalone)
  })

  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const userAgent = window.navigator?.userAgent || window.navigator?.vendor || ''
    const isIosDevice =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (window.navigator?.platform === 'MacIntel' && (window.navigator?.maxTouchPoints ?? 0) > 1)
    const isAndroidDevice = /Android/i.test(userAgent)
    return window.innerWidth <= 768 || isIosDevice || isAndroidDevice
  })

  const [isIos, setIsIos] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const userAgent = window.navigator?.userAgent || window.navigator?.vendor || ''
    return (
      /iPad|iPhone|iPod/.test(userAgent) ||
      (window.navigator?.platform === 'MacIntel' && (window.navigator?.maxTouchPoints ?? 0) > 1)
    )
  })

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt,
  )
  const [isInstalled, setIsInstalled] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Verificação se já está rodando em modo standalone (PWA instalado)
    const checkIsStandalone = () => {
      const matchMediaStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches
      const navigatorStandalone = Boolean(window.navigator?.standalone)
      return Boolean(matchMediaStandalone || navigatorStandalone)
    }

    const standaloneActive = checkIsStandalone()
    setIsStandalone(standaloneActive)

    // 2. Detecção de dispositivo móvel (Touch / UserAgent / screen width)
    const userAgent = window.navigator?.userAgent || window.navigator?.vendor || ''
    const isIosDevice =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (window.navigator?.platform === 'MacIntel' && (window.navigator?.maxTouchPoints ?? 0) > 1)
    const isAndroidDevice = /Android/i.test(userAgent)
    const isMobileViewport = window.innerWidth <= 768 || isIosDevice || isAndroidDevice

    setIsIos(isIosDevice)
    setIsMobileDevice(isMobileViewport)

    // 3. Verificação de dismissed
    try {
      const dismissedState = localStorage.getItem(STORAGE_KEY) === 'true'
      setIsDismissed(dismissedState)
    } catch {
      // Ignora erro se localStorage estiver bloqueado
    }

    // 4. Sincroniza listener de prompt global
    const handlePromptChange = (prompt: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(prompt)
    }
    promptListeners.add(handlePromptChange)
    setDeferredPrompt(globalDeferredPrompt)

    // Captura local também para garantir fallback
    const handleLocalBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setGlobalDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsStandalone(true)
      setGlobalDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleLocalBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Listener para caso o display mode mude dinamicamente
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)')
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches)
    }
    mediaQuery?.addEventListener?.('change', handleMediaChange)

    return () => {
      promptListeners.delete(handlePromptChange)
      window.removeEventListener('beforeinstallprompt', handleLocalBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      mediaQuery?.removeEventListener?.('change', handleMediaChange)
    }
  }, [])

  const dismiss = useCallback(() => {
    setIsDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // Ignora erro se localStorage estiver bloqueado
    }
  }, [])

  /**
   * Dispara o prompt nativo de instalação.
   * Executa deferredPrompt.prompt(), aguarda o desfecho do usuário e limpa o deferredPrompt.
   */
  const triggerInstall = useCallback(async (): Promise<boolean> => {
    const promptEvent = deferredPrompt || globalDeferredPrompt
    if (!promptEvent) return false

    try {
      await promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      setGlobalDeferredPrompt(null)
      setDeferredPrompt(null)

      if (outcome === 'accepted') {
        setIsInstalled(true)
        setIsStandalone(true)
        return true
      }
      return false
    } catch (err) {
      console.warn('Erro ao disparar prompt de instalação PWA:', err)
      return false
    }
  }, [deferredPrompt])

  const scenario = getInstallScenario(deferredPrompt, isIos)

  // Deve exibir banner quando:
  // - Não estiver em modo standalone
  // - For dispositivo móvel
  // - Não tiver sido dispensado pelo usuário
  // - Não tiver acabado de instalar
  const canShowBanner = !isStandalone && isMobileDevice && !isDismissed && !isInstalled

  return {
    canShowBanner,
    isStandalone,
    isMobileDevice,
    isIos,
    isDismissed,
    deferredPrompt,
    hasNativePrompt: Boolean(deferredPrompt),
    scenario,
    dismiss,
    triggerInstall,
    // Auxiliar para testes e controle manual se necessário
    setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => {
      setGlobalDeferredPrompt(prompt)
    },
  }
}
