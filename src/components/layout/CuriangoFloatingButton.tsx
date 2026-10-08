import React from 'react'
import { Sparkles, Mic } from 'lucide-react'

import { useNavigate } from 'react-router-dom'

interface CuriangoFloatingButtonProps {
  onClick?: () => void
}

/**
 * FAB Flutuante do Curiangoo Copilot
 *
 * Botão circular elegante fixado no canto inferior direito:
 * - Mobile: acima da Bottom Navigation (bottom-20 right-4)
 * - Desktop: bottom-6 right-6
 * - Área de toque acessível (52px / h-13 w-13 ≥ 44px)
 * - Se onClick não for fornecido, navega para a tela dedicada /copilot
 */
export const CuriangoFloatingButton: React.FC<CuriangoFloatingButtonProps> = ({ onClick }) => {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      navigate('/copilot')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 group flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-[#FCA311] via-[#fba825] to-[#ffb845] text-[#14213D] shadow-curiango-dock border border-[#FCA311]/40 hover:scale-105 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311] focus-visible:ring-offset-2 touch-manipulation cursor-pointer"
      aria-label="Abrir Curiangoo Copilot por Voz"
      title="Curiangoo Copilot — Lançamento por Voz com IA"
    >
      {/* Efeito de brilho pulsante sutil */}
      <span className="absolute inset-0 rounded-full bg-white/25 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Ícone duplo: Microfone com faísca de IA */}
      <div className="relative flex items-center justify-center">
        <Mic
          className="w-6 h-6 text-[#14213D] drop-shadow-sm transition-transform group-hover:scale-110"
          strokeWidth={1.5}
        />
        <Sparkles
          className="w-3.5 h-3.5 text-white absolute -top-1.5 -right-2 fill-white drop-shadow animate-pulse"
          strokeWidth={1.5}
        />
      </div>
    </button>
  )
}
export default CuriangoFloatingButton
