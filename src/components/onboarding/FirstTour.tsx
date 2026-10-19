import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useFamily } from '@/hooks/use-family'
import { ChevronRight } from 'lucide-react'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

/**
 * FirstTour — Convite sutil ao Copilot (19/10, v2 — visão do Matheus).
 *
 * A v1 era um checklist de 3 passos ("virou uma espécie de modal, está errado —
 * aqui era pra ser só o meio por onde o usuário chega no Copilot").
 * Agora é UMA mensagem sutil, uma linha: o usuário novo entende que É AQUI que
 * ele fala com o Curiango. "Bem-vindo! Fale comigo — toque em mim, eu te ajudo."
 * O toque abre o chat do Copilot e o card some para sempre (mark_tour_step
 * 'copilot') — cumpriu sua missão de porta de entrada.
 */
export interface FirstTourProps {
  /** Passos já concluídos (family.tour_steps_done) */
  stepsDone: string[]
}

export function FirstTour({ stepsDone }: FirstTourProps) {
  const navigate = useNavigate()
  const { triggerRefresh } = useFamily()

  // Já entrou pelo convite (toque registrado)? O card cumpriu sua missão — some.
  if (Array.isArray(stepsDone) && stepsDone.includes('copilot')) return null

  const openCopilot = async () => {
    navigate('/copilot')
    try {
      await (supabase as any).rpc('mark_tour_step', { p_step: 'copilot' })
      triggerRefresh()
    } catch {
      // Falha silenciosa: o convite não pode bloquear o uso do app
    }
  }

  return (
    <button
      type="button"
      data-testid="first-tour-card"
      onClick={openCopilot}
      className="w-full flex items-center gap-3 rounded-2xl border border-[rgba(20,33,61,0.08)] bg-white/95 px-4 py-3.5 shadow-sm text-left transition-all hover:border-[#FCA311]/40 hover:bg-[#FCA311]/5 active:scale-[0.99]"
    >
      <CuriangoLogo size={40} color="#FCA311" eyeColor="#14213D" eyeRadius={3.4} eyeHighlight />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#14213D] leading-tight">
          Bem-vindo! Fale comigo 🪶
        </span>
        <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">
          Toque em mim — eu lanço, categorizo e organizo pra você.
        </span>
      </span>
      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
    </button>
  )
}

export default FirstTour
