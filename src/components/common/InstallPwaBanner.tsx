import React, { useEffect, useState } from 'react'
import { Share, Download, X, Check, Smartphone, HelpCircle } from 'lucide-react'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { Button } from '@/components/ui/button'
import { InstallInstructionsModal } from '@/components/common/InstallInstructionsModal'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

interface InstallPwaBannerProps {
  /**
   * Posição da visualização:
   * 'bottom-nav': acima do menu inferior fixo no mobile (bottom-16/bottom-20)
   * 'floating': fixo na parte inferior da tela (ex: tela de login)
   */
  variant?: 'bottom-nav' | 'floating'
  className?: string
}

export function InstallPwaBanner({
  variant = 'bottom-nav',
  className = '',
}: InstallPwaBannerProps) {
  const { canShowBanner, isIos, hasNativePrompt, deferredPrompt, dismiss, triggerInstall } =
    usePwaInstall()
  const [installing, setInstalling] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  // Engajamento: só aparece após 8s de uso — o 1º minuto é pra entender o app,
  // não pra pedir instalação (padrão de mercado; evita competir com o onboarding).
  const [engaged, setEngaged] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setEngaged(true), 8000)
    return () => window.clearTimeout(t)
  }, [])

  if (!canShowBanner || !engaged) {
    return null
  }

  /**
   * Fluxo de clique do banner seguindo os 3 cenários:
   * - CENÁRIO A: Chrome / Edge / Android com deferredPrompt -> prompt nativo direto sem modal
   * - CENÁRIO B: iOS -> modal de instruções da Apple
   * - CENÁRIO C: outros navegadores sem prompt direto -> modal dinâmico com 3 pontinhos
   */
  const handleBannerActionClick = async () => {
    if (deferredPrompt) {
      // CENÁRIO A: Dispara diretamente o prompt nativo do sistema sem abrir modal
      try {
        setInstalling(true)
        await triggerInstall()
      } finally {
        setInstalling(false)
      }
    } else {
      // CENÁRIO B (iOS) ou CENÁRIO C (Outros navegadores sem suporte ao prompt nativo)
      setIsModalOpen(true)
    }
  }

  // Posição calculada com espaçamento seguro para NÃO cobrir a barra edge-to-edge inferior
  const positionClasses =
    variant === 'bottom-nav'
      ? 'fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] inset-x-3 z-30 max-w-lg mx-auto'
      : 'fixed bottom-4 inset-x-3 z-30 max-w-lg mx-auto'

  return (
    <>
      <div
        role="region"
        aria-label="Instalação do Curiangoo"
        className={`${positionClasses} ${className} animate-in fade-in slide-in-from-bottom-4 duration-300`}
      >
        <div className="bg-ink text-white shadow-2xl shadow-black/40 rounded-2xl p-3.5 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            {/* Ícone oficial Curiangoo */}
            <div
              data-testid="install-banner-logo"
              aria-label="Curiangoo"
              className="w-10 h-10 rounded-xl bg-white/5 p-1 shrink-0 flex items-center justify-center overflow-hidden ring-1 ring-white/10"
            >
              <CuriangoLogo size={26} color="#FFC629" />
            </div>

            {/* Conteúdo: título + 1 linha, sem badges — sóbrio e confiante */}
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-sm font-semibold text-white leading-snug">
                Instalar o Curiangoo no celular
              </p>
              <p className="text-[11px] text-white/70 leading-snug mt-0.5">
                {hasNativePrompt
                  ? 'Abre em tela cheia, como um app nativo.'
                  : isIos
                    ? 'Via Compartilhar › Adicionar à Tela de Início.'
                    : 'Pelo menu do navegador, adicione à tela inicial.'}
              </p>

              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={handleBannerActionClick}
                  disabled={installing}
                  className="h-8 px-4 text-xs bg-action hover:opacity-90 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all active:scale-95 border-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{installing ? 'Instalando…' : 'Instalar'}</span>
                </Button>

                <button
                  type="button"
                  onClick={dismiss}
                  className="text-xs text-white/70 hover:text-white font-medium px-2 py-1 rounded-md transition-colors"
                >
                  Agora não
                </button>
              </div>
            </div>

            {/* X discreto no canto */}
            <button
              type="button"
              onClick={dismiss}
              className="self-start text-white/60 hover:text-white p-1 -m-1 rounded-md transition-colors shrink-0"
              title="Dispensar"
              aria-label="Dispensar aviso de instalação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>{' '}
      </div>

      {/* Modal de instruções para Cenário B e Cenário C */}
      <InstallInstructionsModal open={isModalOpen} onOpenChange={setIsModalOpen} isIos={isIos} />
    </>
  )
}
