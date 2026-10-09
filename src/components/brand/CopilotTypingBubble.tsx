import React from 'react'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

interface CopilotTypingBubbleProps {
  className?: string
  label?: string
}

/**
 * Bolha do assistente Curiango com typing indicator (3 reticências pulsando).
 * Padrão CDS v1.0 mobile-first para o VoiceTransactionDialog e para a tela /copilot.
 */
export const CopilotTypingBubble: React.FC<CopilotTypingBubbleProps> = ({
  className = '',
  label = 'Curiangoo digitando...',
}) => {
  return (
    <div
      data-testid="copilot-typing-indicator"
      className={`flex items-start gap-2 animate-in fade-in duration-150 max-w-full ${className}`}
    >
      {/* Avatar compacto Curiango */}
      <div className="w-7 h-7 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-2xs border border-brand/20 p-1 mt-0.5">
        <CuriangoLogo size={16} color="#FCA311" />
      </div>

      <div className="bg-white border border-slate-200/90 text-slate-800 rounded-2xl rounded-tl-xs px-3.5 py-2.5 flex items-center gap-2.5 shadow-curiango">
        <div className="flex items-center gap-1 py-0.5" aria-label="digitando...">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
    </div>
  )
}
