import React from 'react'
import { Share, Download, X, Check, Smartphone } from 'lucide-react'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { Button } from '@/components/ui/button'

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
  const { canShowBanner, isIos, hasNativePrompt, dismiss, triggerInstall } = usePwaInstall()
  const [installing, setInstalling] = React.useState(false)

  if (!canShowBanner) {
    return null
  }

  const handleInstallClick = async () => {
    setInstalling(true)
    await triggerInstall()
    setInstalling(false)
  }

  // Posição calculada com espaçamento seguro para NÃO cobrir o menu inferior nem o FAB central '+'
  // No mobile, a bottom navigation tem h-14 (56px) + safe areas + o FAB central sobe ~20px (-translate-y-5).
  // Logo, 'bottom-nav' usa bottom-20 (80px) ou bottom-[4.75rem], permitindo folga limpa e elegante.
  const positionClasses =
    variant === 'bottom-nav'
      ? 'fixed bottom-[4.5rem] inset-x-3 z-30 max-w-lg mx-auto'
      : 'fixed bottom-4 inset-x-3 z-30 max-w-lg mx-auto'

  return (
    <div
      role="region"
      aria-label="Instalação do Curiangoo"
      className={`${positionClasses} ${className} animate-in fade-in slide-in-from-bottom-4 duration-300`}
    >
      <div className="bg-slate-900/95 backdrop-blur-md text-white border border-emerald-500/30 shadow-2xl shadow-emerald-950/40 rounded-2xl p-3.5 sm:p-4 ring-1 ring-white/10">
        <div className="flex items-start gap-3">
          {/* Ícone com a marca Curiangoo */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-800 to-teal-700 p-0.5 shrink-0 shadow-md flex items-center justify-center overflow-hidden border border-emerald-400/40">
            <img
              src="/icon.svg"
              alt="Curiangoo"
              className="w-full h-full object-cover rounded-[10px]"
              onError={(e) => {
                // Fallback gracioso
                e.currentTarget.style.display = 'none'
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
                App Rápido
              </span>
            </div>

            {isIos ? (
              // Instruções iOS Safari
              <p className="text-xs text-slate-200 leading-relaxed font-normal">
                📲 Instale o Curiangoo no celular: toque no botão{' '}
                <strong className="text-white font-semibold inline-flex items-center gap-0.5">
                  Compartilhar <Share className="w-3 h-3 text-emerald-400 inline mx-0.5" />
                </strong>{' '}
                (quadrado com seta para cima) e selecione{' '}
                <strong className="text-emerald-300 font-semibold">
                  &ldquo;Adicionar à Tela de Início&rdquo;
                </strong>
                .
              </p>
            ) : (
              // Instruções Android / Outros
              <p className="text-xs text-slate-200 leading-relaxed font-normal">
                Instale o aplicativo na sua tela de início para abrir em tela cheia, sem barra de
                endereço e com acesso instantâneo.
              </p>
            )}

            {/* Ações */}
            <div className="flex items-center gap-2 mt-2.5 pt-1">
              {!isIos && hasNativePrompt && (
                <Button
                  size="sm"
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{installing ? 'Instalando...' : 'Instalar Aplicativo'}</span>
                </Button>
              )}

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
              >
                <span className="sr-only">Dispensar</span>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
