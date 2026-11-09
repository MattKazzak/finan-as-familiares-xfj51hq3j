import React from 'react'
import { RefreshCw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useServiceWorkerUpdate } from '@/hooks/use-service-worker'

interface PwaUpdateBannerProps {
  className?: string
}

export function PwaUpdateBanner({ className = '' }: PwaUpdateBannerProps) {
  const { hasUpdate, isUpdating, updateServiceWorker, dismissUpdate } = useServiceWorkerUpdate()

  if (!hasUpdate) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Atualização disponível do Curiangoo"
      className={`fixed top-4 inset-x-3 z-50 max-w-md mx-auto animate-in fade-in slide-in-from-top-4 duration-300 ${className}`}
    >
      <div className="bg-ink text-white border border-action/40 shadow-2xl shadow-black/40 rounded-2xl p-3 sm:p-3.5 ring-1 ring-white/10 flex items-center gap-3">
        {/* Ícone de novidade */}
        <div
          data-testid="pwa-update-icon"
          className="w-9 h-9 rounded-xl bg-action/15 text-action border border-action/30 flex items-center justify-center shrink-0"
        >
          <Sparkles className="w-4 h-4 text-action" />
        </div>

        {/* Texto informativo discreto */}
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-xs font-semibold text-white tracking-tight leading-snug">
            Nova versão disponível
          </p>
          <p className="text-[11px] text-white/70 leading-tight">
            Atualize para carregar as melhorias recentes.
          </p>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={updateServiceWorker}
            disabled={isUpdating}
            className="h-7 px-2.5 text-xs bg-action hover:opacity-90 text-white font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all active:scale-95 border-0"
          >
            <RefreshCw className={`w-3 h-3 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Atualizando...' : 'Atualizar'}</span>
          </Button>

          <button
            type="button"
            onClick={dismissUpdate}
            className="text-white/70 hover:text-white text-xs p-1 rounded-md transition-colors"
            title="Lembrar mais tarde"
            aria-label="Dispensar aviso de atualização"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
