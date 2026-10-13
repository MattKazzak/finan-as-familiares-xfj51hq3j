import React, { useState, useEffect } from 'react'
import { Sparkles, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

interface CuriangoFloatingButtonProps {
  onClick?: () => void
}

export const COPILOT_FAB_SPEECH_BUBBLE_DISMISSED_KEY = 'curiangoo_copilot_fab_bubble_dismissed_v2'
export const COPILOT_FAB_PULSE_STOPPED_KEY = 'curiangoo_copilot_fab_pulse_stopped_v1'

/**
 * Hook para detectar prefers-reduced-motion do usuário.
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    try {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      setPrefersReducedMotion(mediaQuery.matches)

      const handleChange = (event: MediaQueryListEvent) => {
        setPrefersReducedMotion(event.matches)
      }

      mediaQuery.addEventListener?.('change', handleChange)
      return () => {
        mediaQuery.removeEventListener?.('change', handleChange)
      }
    } catch {
      // Ignora erro em browsers legados/ambientes de teste
    }
  }, [])

  return prefersReducedMotion
}

/**
 * Botão Flutuante do Curiangoo Copilot (v0.0.320 - R55)
 *
 * Características:
 * - FAB com respiração/pulso sutil (animate-fab-breathe):
 *   (a) Ciclo lento (3 a 4 segundos de respiração).
 *   (b) Amplitude sutil (escala máx. ≤ 3% e sombra discreta).
 *   (c) Easing suave (ease-in-out), sem saltos.
 *   (d) Pausa serena entre ciclos (~12 a 15 segundos) — presença discreta, não carnaval.
 *   (e) Respeita prefers-reduced-motion (usuários com redução de movimento: sem pulso).
 *   (f) Pulso para DEFINITIVAMENTE após a primeira interação do usuário com o FAB
 *       (abriu o Copilot uma vez, o pulso nunca mais volta — persistido no localStorage).
 * - Balão de fala 1x (speech bubble) saindo do FAB com texto curto e caloroso:
 *   "Oi! Sou o Curiangoo — lanço, consulto e analiso pra você"
 * - Some ao toque ou após 6 segundos e fica lembrado no localStorage (nunca repete).
 * - Ponta triangular simulando balão saindo em direção ao FAB.
 * - Não compete com o card do saldo (tamanho compacto e posicionamento lateral na margem segura).
 * - Ao tocar, navega para /copilot (ou dispara onClick).
 * - Zero overflow horizontal em telas móveis (360–412px).
 */
export const CuriangoFloatingButton: React.FC<CuriangoFloatingButtonProps> = ({ onClick }) => {
  const navigate = useNavigate()
  const [showBubble, setShowBubble] = useState(false)
  const [isPulseActive, setIsPulseActive] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    try {
      // Checa se o usuário já interagiu com o FAB antes
      const pulseStopped = localStorage.getItem(COPILOT_FAB_PULSE_STOPPED_KEY)
      if (!pulseStopped) {
        setIsPulseActive(true)
      }

      const dismissed = localStorage.getItem(COPILOT_FAB_SPEECH_BUBBLE_DISMISSED_KEY)
      if (!dismissed) {
        setShowBubble(true)
        const timer = setTimeout(() => {
          setShowBubble(false)
          try {
            localStorage.setItem(COPILOT_FAB_SPEECH_BUBBLE_DISMISSED_KEY, 'true')
          } catch {
            // Silencioso em caso de cookies desabilitados
          }
        }, 6500)
        return () => clearTimeout(timer)
      }
    } catch {
      // localStorage indisponível (ex: iframe restrito)
    }
  }, [])

  const dismissBubble = () => {
    setShowBubble(false)
    try {
      localStorage.setItem(COPILOT_FAB_SPEECH_BUBBLE_DISMISSED_KEY, 'true')
    } catch {
      // Silencioso
    }
  }

  const markPulseStopped = () => {
    setIsPulseActive(false)
    try {
      localStorage.setItem(COPILOT_FAB_PULSE_STOPPED_KEY, 'true')
    } catch {
      // Silencioso
    }
  }

  const handleClick = () => {
    dismissBubble()
    markPulseStopped()
    if (onClick) {
      onClick()
    } else {
      navigate('/copilot')
    }
  }

  const shouldAnimatePulse = isPulseActive && !prefersReducedMotion

  return (
    <div
      style={{ bottom: 'calc(5.2rem + env(safe-area-inset-bottom, 0px))' }}
      className="fixed z-40 bottom-[calc(5.2rem+env(safe-area-inset-bottom,0px))] md:!bottom-6 md:bottom-6 right-3.5 sm:right-5 md:right-6 flex flex-col items-end pointer-events-none"
    >
      {/* Balão de Fala (Speech Bubble) 1x: sai do FAB com texto curto e caloroso */}
      {showBubble && (
        <div
          role="status"
          aria-live="polite"
          data-testid="copilot-speech-bubble"
          onClick={dismissBubble}
          className="pointer-events-auto mb-2 mr-0 sm:mr-1 max-w-[240px] sm:max-w-[270px] bg-white text-[#14213D] shadow-xl shadow-[#14213D]/10 border border-slate-200/90 rounded-2xl p-2.5 text-xs animate-in fade-in slide-in-from-bottom-2 duration-300 cursor-pointer select-none relative"
        >
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-[#14213D] text-[#FCA311] flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare className="w-3 h-3 fill-[#FCA311]" />
            </div>
            <div className="flex-1 leading-snug">
              <p className="font-semibold text-[11.5px] sm:text-xs text-[#14213D]">
                Oi! Sou o Curiangoo
              </p>
              <p className="text-[10.5px] sm:text-[11px] text-slate-600 font-normal mt-0.5">
                lanço, consulto e analiso pra você
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                dismissBubble()
              }}
              className="text-slate-400 hover:text-slate-700 text-xs px-1 -mr-0.5 -mt-0.5"
              aria-label="Fechar dica"
            >
              ✕
            </button>
          </div>

          {/* Ponta do balão (speech bubble pointer direcionada ao FAB) */}
          <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white border-r border-b border-slate-200/90 transform rotate-45 pointer-events-none" />
        </div>
      )}

      {/* FAB do Copilot: Círculo da Marca #14213D com Ícone do Curiango + Pulso Sutil Lento */}
      <button
        type="button"
        onClick={handleClick}
        className={`pointer-events-auto w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#14213D] text-white shadow-elevation-3 border border-white/10 hover:border-[#FCA311]/50 hover:scale-105 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCA311] focus-visible:ring-offset-2 touch-manipulation cursor-pointer flex items-center justify-center relative group select-none motion-reduce:animate-none ${
          shouldAnimatePulse ? 'animate-fab-breathe' : ''
        }`}
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
