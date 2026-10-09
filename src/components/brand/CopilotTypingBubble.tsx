import React from 'react'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

interface CopilotTypingBubbleProps {
  className?: string
  label?: string
}

/**
 * Bolha do assistente Curiango com typing indicator (3 reticências pulsando).
 * UX-1 (Rodada 25): Apenas o ícone do pássaro + as 3 reticências animadas,
 * SEM o texto "Curiangoo pensando" e SEM fundo azul (aparência limpa e profissional).
 */
export const CopilotTypingBubble: React.FC<CopilotTypingBubbleProps> = ({ className = '' }) => {
  return (
    <div
      data-testid="copilot-typing-indicator"
      className={`flex items-center gap-2 animate-in fade-in duration-150 max-w-full ${className}`}
    >
      {/* Avatar compacto Curiango - ícone do pássaro */}
      <div
        data-testid="copilot-typing-avatar"
        className="w-7 h-7 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shrink-0 shadow-2xs p-1"
      >
        <CuriangoLogo size={18} color="#FCA311" />
      </div>

      {/* Bolha limpa com apenas 3 reticências animadas (sem texto e sem fundo azul) */}
      <div
        data-testid="copilot-typing-dots"
        className="bg-white border border-slate-200/90 text-slate-800 rounded-2xl rounded-tl-xs px-3 py-2 flex items-center shadow-curiango"
      >
        <div className="flex items-center gap-1.5 py-0.5" aria-label="digitando...">
          <span
            className="w-2 h-2 rounded-full bg-[#059669] animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-[#059669] animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-[#059669] animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  )
}
