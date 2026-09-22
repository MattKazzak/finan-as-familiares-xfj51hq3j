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

export function usePwaInstall() {
  const [isStandalone, setIsStandalone] = useState<boolean>(true)
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false)
  const [isIos, setIsIos] = useState<boolean>(false)
  const [isDismissed, setIsDismissed] = useState<boolean>(true)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Verificação se já está rodando em modo standalone (PWA instalado)
    const checkIsStandalone = () => {
      const matchMediaStandalone = window.matchMedia('(display-mode: standalone)').matches
      const navigatorStandalone = Boolean(window.navigator.standalone)
      return matchMediaStandalone || navigatorStandalone
    }

    const standaloneActive = checkIsStandalone()
    setIsStandalone(standaloneActive)

    // 2. Detecção de dispositivo móvel (Touch / UserAgent / screen width)
    const userAgent = window.navigator.userAgent || window.navigator.vendor || ''
    const isIosDevice =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isAndroidDevice = /Android/i.test(userAgent)
    const isMobileViewport = window.innerWidth <= 768 || isIosDevice || isAndroidDevice

    setIsIos(isIosDevice)
    setIsMobileDevice(isMobileViewport)

    // 3. Verificação se o usuário já dispensou o banner
    const dismissedState = localStorage.getItem(STORAGE_KEY) === 'true'
    setIsDismissed(dismissedState)

    // 4. Captura do evento beforeinstallprompt no Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsStandalone(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Listener para caso o display mode mude dinamicamente
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches)
    }
    mediaQuery.addEventListener('change', handleMediaChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      mediaQuery.removeEventListener('change', handleMediaChange)
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

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return false
    try {
      await deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true)
        setIsStandalone(true)
      }
      setDeferredPrompt(null)
      return choiceResult.outcome === 'accepted'
    } catch (err) {
      console.warn('Erro ao disparar prompt de instalação PWA:', err)
      return false
    }
  }, [deferredPrompt])

  // Deve exibir quando:
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
    hasNativePrompt: Boolean(deferredPrompt),
    dismiss,
    triggerInstall,
  }
}
