import React from 'react'
import { Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

interface CuriangoFloatingButtonProps {
  onClick?: () => void
}

/**
 * Botão Flutuante do Curiangoo Copilot (v0.0.307)
 *
 * Botão em formato de pílula elegante fixado no canto inferior direito,
 * estritamente acima da barra de navegação no mobile:
 * - Mobile: bottom-20 right-4 (z-40)
 * - Desktop: bottom-6 right-6
 * - Ícone do Curiangoo (CuriangoLogo) em vez de microfone
 * - Rótulo curto e claro: "Falar com o Curiangoo"
 * - Paleta CDS v1.0: fundo #14213D com detalhe/borda sutil em âmbar #FCA311
 * - Zero overflow horizontal em telas móveis (360–412px)
 * - Ao tocar, abre o chat do Copilot (/copilot ou onClick)
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
      className="fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 group inline-flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full bg-[#14213D] text-white shadow-curiango-dock border border-[#FCA311]/40 hover:border-[#FCA311] hover:scale-105 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311] focus-visible:ring-offset-2 touch-manipulation cursor-pointer max-w-[calc(100vw-2rem)] select-none"
      aria-label="Falar com o Curiangoo"
      title="Falar com o Curiangoo — Copilot Inteligente"
    >
      {/* Efeito de brilho pulsante sutil */}
      <span className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Ícone oficial do pássaro Curiangoo com cor âmbar #FCA311 */}
      <div className="relative flex items-center justify-center shrink-0">
        <CuriangoLogo
          size={22}
          color="#FCA311"
          className="transition-transform group-hover:scale-110 drop-shadow-sm"
        />
        <Sparkles
          className="w-2.5 h-2.5 text-white absolute -top-1 -right-1 fill-white drop-shadow animate-pulse"
          strokeWidth={1.5}
        />
      </div>

      {/* Rótulo curto e claro */}
      <span className="text-xs sm:text-sm font-semibold tracking-tight text-white group-hover:text-amber-200 transition-colors whitespace-nowrap">
        Falar com o Curiangoo
      </span>
    </button>
  )
}
export default CuriangoFloatingButton
