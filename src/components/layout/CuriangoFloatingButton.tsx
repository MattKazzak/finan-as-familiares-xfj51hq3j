import React, { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

interface CuriangoFloatingButtonProps {
  onClick?: () => void
}

const COPILOT_FAB_HINT_DISMISSED_KEY = 'curiangoo_copilot_fab_hint_dismissed_v1'

/**
 * Botão Flutuante do Curiangoo Copilot (v0.0.309 - R52)
 *
 * Características:
 * - FAB compacto e silencioso: círculo com o ícone oficial do Curiango (CuriangoLogo)
 * - SEM rótulo permanente
 * - Cor da marca (#14213D) com sombra suave shadow-curiango-dock e borda sutil em rgba(20,33,61,0.08)
 * - Tamanho reduzido (w-12 h-12 / sm:w-13 sm:h-13), não obstrui o conteúdo
 * - Canto inferior direito acima da barra de navegação:
 *   * Mobile (< md): bottom-20 right-4 (z-40)
 *   * Desktop (>= md): bottom-6 right-6
 * - Na primeira visita à Home, uma dica discreta em balão ("Fale com o Curiangoo") aparece 1x e some (persistência via localStorage)
 * - Ao tocar, navega para /copilot (ou executa onClick)
 * - Zero overflow horizontal em telas móveis (360–412px)
 */
export const CuriangoFloatingButton: React.FC<CuriangoFloatingButtonProps> = ({ onClick }) => {
  const navigate = useNavigate()
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(COPILOT_FAB_HINT_DISMISSED_KEY)
      if (!dismissed) {
        // Exibe a dica 1x por alguns segundos
        setShowHint(true)
        const timer = setTimeout(() => {
          setShowHint(false)
          try {
            localStorage.setItem(COPILOT_FAB_HINT_DISMISSED_KEY, 'true')
          } catch {
            // Silencioso em caso de cookies desabilitados
          }
        }, 5000)
        return () => clearTimeout(timer)
      }
    } catch {
      // localStorage indisponível (ex: iframe restrito)
    }
  }, [])

  const dismissHint = () => {
    setShowHint(false)
    try {
      localStorage.setItem(COPILOT_FAB_HINT_DISMISSED_KEY, 'true')
    } catch {
      // Silencioso
    }
  }

  const handleClick = () => {
    dismissHint()
    if (onClick) {
      onClick()
    } else {
      navigate('/copilot')
    }
  }

  return (
    <div className="fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 flex flex-col items-end pointer-events-none">
      {/* Balão de Dica Discreta da 1ª Visita (Aparece 1x e some) */}
      {showHint && (
        <div
          role="status"
          aria-live="polite"
          onClick={dismissHint}
          className="pointer-events-auto mb-2 mr-1 px-3 py-1.5 rounded-2xl bg-white text-[#14213D] shadow-curiango border border-slate-200/90 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300 cursor-pointer select-none max-w-[200px]"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#FCA311] shrink-0" strokeWidth={1.5} />
          <span className="truncate">Fale com o Curiangoo</span>
          <span className="text-[10px] text-slate-400 font-normal ml-0.5">✕</span>
        </div>
      )}

      {/* FAB Compacto e Silencioso (Círculo da Marca #14213D com Ícone do Curiango) */}
      <button
        type="button"
        onClick={handleClick}
        className="pointer-events-auto w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#14213D] text-white shadow-curiango-dock border border-white/10 hover:border-[#FCA311]/50 hover:scale-105 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311] focus-visible:ring-offset-2 touch-manipulation cursor-pointer flex items-center justify-center relative group select-none"
        aria-label="Falar com o Curiangoo"
        title="Falar com o Curiangoo — Copilot Inteligente"
      >
        {/* Glow hover discreto */}
        <span className="absolute inset-0 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* Ícone oficial do pássaro Curiangoo em tom âmbar #FCA311 */}
        <div className="relative flex items-center justify-center">
          <CuriangoLogo
            size={24}
            color="#FCA311"
            className="transition-transform group-hover:scale-110 drop-shadow-sm"
          />
          <Sparkles
            className="w-2.5 h-2.5 text-white absolute -top-1.5 -right-1.5 fill-white drop-shadow animate-pulse"
            strokeWidth={1.5}
          />
        </div>
      </button>
    </div>
  )
}

export default CuriangoFloatingButton
