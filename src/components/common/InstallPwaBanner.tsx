import React, { useState } from 'react'
import { Share, Download, X, Check, Smartphone, HelpCircle } from 'lucide-react'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { Button } from '@/components/ui/button'
import { InstallInstructionsModal } from '@/components/common/InstallInstructionsModal'

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

  if (!canShowBanner) {
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

  // Posição calculada com espaçamento seguro para NÃO cobrir o Dock Flutuante inferior
  const positionClasses =
    variant === 'bottom-nav'
      ? 'fixed bottom-20 inset-x-3 z-30 max-w-lg mx-auto'
      : 'fixed bottom-4 inset-x-3 z-30 max-w-lg mx-auto'

  return (
    <>
      <div
        role="region"
        aria-label="Instalação do Curiangoo"
        className={`${positionClasses} ${className} animate-in fade-in slide-in-from-bottom-4 duration-300`}
      >
        <div className="bg-slate-900/95 backdrop-blur-md text-white border border-emerald-500/30 shadow-2xl shadow-emerald-950/40 rounded-2xl p-3.5 sm:p-4 ring-1 ring-white/10">
          <div className="flex items-start gap-3">
            {/* Ícone oficial Curiangoo com fallback */}
            <div className="w-10 h-10 rounded-xl bg-[#14213D] p-1 shrink-0 shadow-md flex items-center justify-center overflow-hidden border border-[#14213D]">
              <img
                src="/icon-192.png"
                alt="Curiangoo"
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = '/icon.svg'
                }}
              />
            </div>

            {/* Conteúdo Informativo */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-bold text-xs sm:text-sm text-emerald-300 tracking-tight flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Instalar Curiangoo</span>
                </span>
                <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-600/40 font-medium">
                  {hasNativePrompt ? '1 Clique' : 'App Rápido'}
                </span>
              </div>

              {isIos ? (
                // Instruções iOS Safari
                <p className="text-xs text-slate-200 leading-relaxed font-normal">
                  📲 Toque no botão{' '}
                  <strong className="text-white font-semibold inline-flex items-center gap-0.5">
                    Compartilhar <Share className="w-3 h-3 text-emerald-400 inline mx-0.5" />
                  </strong>{' '}
                  e depois em{' '}
                  <strong className="text-emerald-300 font-semibold">
                    &ldquo;Adicionar à Tela de Início&rdquo;
                  </strong>
                  .
                </p>
              ) : hasNativePrompt ? (
                // Android / Chrome com prompt nativo
                <p className="text-xs text-slate-200 leading-relaxed font-normal">
                  Instale o aplicativo com 1 clique para abrir em tela cheia e ter acesso
                  instantâneo às finanças da família.
                </p>
              ) : (
                // Outros navegadores sem prompt nativo
                <p className="text-xs text-slate-200 leading-relaxed font-normal">
                  Adicione o Curiangoo à sua tela inicial pelo menu do seu navegador para usar como
                  aplicativo nativo.
                </p>
              )}

              {/* Ações */}
              <div className="flex items-center gap-2 mt-2.5 pt-1">
                <Button
                  size="sm"
                  onClick={handleBannerActionClick}
                  disabled={installing}
                  className="h-8 px-3 text-xs bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all active:scale-95 border-0"
                >
                  {hasNativePrompt ? (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>{installing ? 'Instalando...' : 'Instalar Aplicativo'}</span>
                    </>
                  ) : isIos ? (
                    <>
                      <Share className="w-3.5 h-3.5" />
                      <span>Como Instalar</span>
                    </>
                  ) : (
                    <>
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Ver Instruções</span>
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={dismiss}
                  className="h-8 px-3 text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Entendido</span>
                </Button>

                <button
                  type="button"
                  onClick={dismiss}
                  className="ml-auto text-slate-400 hover:text-slate-200 text-xs p-1 rounded-md transition-colors"
                  title="Dispensar aviso"
                  aria-label="Dispensar aviso de instalação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de instruções para Cenário B e Cenário C */}
      <InstallInstructionsModal open={isModalOpen} onOpenChange={setIsModalOpen} isIos={isIos} />
    </>
  )
}
