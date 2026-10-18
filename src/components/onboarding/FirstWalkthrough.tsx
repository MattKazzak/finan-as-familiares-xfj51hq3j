import { useState } from 'react'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import { ArrowDown, ArrowUp, X } from 'lucide-react'

/**
 * FirstWalkthrough — Tour de primeiro acesso v2 (19/10, visão do Matheus).
 *
 * O Matheus rejeitou o checklist: "eu imaginei o fundo escuro, os balõezinhos
 * mostrando 'aqui registre receita'". Este componente é EXATAMENTE isso — o
 * padrão dos grandes apps (coach marks / spotlight tour, como o Duolingo,
 * WhatsApp e o Google fazem na 1ª visita):
 *
 *  - Overlay ESCURO semitransparente cobrindo a Home
 *  - O elemento real fica "recortado" do overlay (spotlight via z-index)
 *  - Um BALÃO aponta pro elemento, com copy educativa (missão educativa 18/10)
 *  - Toque em qualquer lugar avança; X pula o tour inteiro
 *  - Progresso persiste em families.tour_steps_done (passo 'tour' via mark_tour_step)
 *
 * Passos (ordem de valor pro usuário amador):
 *  1. Saldo        — "aqui você vê o total da família"
 *  2. Tour/rotina  — "comece lançando uma receita" (aponta pro próprio tour card)
 *  3. Dock Nova    — "aqui você registra tudo: receita, despesa, voz"
 */
export type WalkthroughStepId = 'saldo' | 'tour' | 'dock'

interface WalkthroughStep {
  id: WalkthroughStepId
  /** data-testid do elemento alvo — o spotlight recorta o elemento real */
  targetSelector: string
  /** Balão acima ou abaixo do alvo? */
  position: 'top' | 'bottom'
  title: string
  text: string
}

const STEPS: WalkthroughStep[] = [
  {
    id: 'saldo',
    targetSelector: '[data-testid="balance-block"]',
    position: 'bottom',
    title: 'Este é o saldo da família',
    text: 'Tudo que entra e sai se soma aqui, em tempo real. Toque para continuar.',
  },
  {
    id: 'tour',
    targetSelector: '[data-testid="first-tour-card"]',
    position: 'bottom',
    title: 'Comece por aqui',
    text: 'Lance sua primeira receita — o Curiango calcula seus baldes a partir daqui.',
  },
  {
    id: 'dock',
    targetSelector: '[data-testid="dock-new-transaction"]',
    position: 'top',
    title: 'Registre tudo por aqui',
    text: 'Receita, despesa ou falando com o Curiango — um toque e está lançado.',
  },
]

export interface FirstWalkthroughProps {
  /** Passos já concluídos (family.tour_steps_done) */
  stepsDone: string[]
  /** Marca o passo no banco (RPC mark_tour_step) */
  onCompleteStep: (stepId: string) => void
  /** Pula o tour inteiro */
  onSkip: () => void
}

export function FirstWalkthrough({ stepsDone, onCompleteStep, onSkip }: FirstWalkthroughProps) {
  const pending = STEPS.filter((s) => !stepsDone.includes(s.id))
  const [index, setIndex] = useState(0)

  if (pending.length === 0) return null

  const step = pending[Math.min(index, pending.length - 1)]
  const target = document.querySelector(step.targetSelector)

  // Alvo não está na tela (ex.: card do tour já concluído)? Pula este passo.
  if (!target) {
    onCompleteStep(step.id)
    return null
  }

  const rect = target.getBoundingClientRect()
  const PAD = 8

  const advance = () => {
    onCompleteStep(step.id)
    setIndex((i) => i + 1)
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label="Tour de primeiro acesso">
      {/* Overlay escuro com JANELA recortada no elemento real (spotlight) */}
      <div
        className="absolute inset-0 bg-[#0B1526]/80 transition-all duration-300"
        style={{
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            ${rect.left - PAD}px ${rect.top - PAD}px,
            ${rect.left - PAD}px ${rect.bottom + PAD}px,
            ${rect.right + PAD}px ${rect.bottom + PAD}px,
            ${rect.right + PAD}px ${rect.top - PAD}px,
            ${rect.left - PAD}px ${rect.top - PAD}px
          )`,
        }}
        onClick={advance}
      />

      {/* Balão do Curiango apontando pro alvo */}
      <div
        className="absolute z-10 max-w-[300px] animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={
          step.position === 'bottom'
            ? { top: rect.bottom + PAD + 12, left: Math.max(16, rect.left) }
            : { bottom: window.innerHeight - rect.top + PAD + 12, left: Math.max(16, rect.left) }
        }
      >
        <div className="rounded-2xl bg-white shadow-elevation-3 px-4 py-3.5 border border-[rgba(20,33,61,0.08)]">
          <div className="flex items-start gap-3">
            <CuriangoLogo
              size={32}
              color="#FCA311"
              eyeColor="#14213D"
              eyeRadius={3.4}
              eyeHighlight
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[#14213D] leading-tight">{step.title}</p>
              <p className="text-[12px] text-slate-600 leading-snug mt-1">{step.text}</p>
            </div>
            <button
              type="button"
              onClick={onSkip}
              aria-label="Pular tour"
              className="shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Setinha apontando o alvo */}
          <div
            className={`absolute left-8 w-3 h-3 rotate-45 bg-white border-[rgba(20,33,61,0.08)] ${
              step.position === 'bottom'
                ? '-top-1.5 border-l border-t'
                : '-bottom-1.5 border-r border-b'
            }`}
          />
          {/* Rodapé: progresso + dica de toque */}
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
            <div className="flex gap-1">
              {STEPS.map((s) => (
                <span
                  key={s.id}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    s.id === step.id ? 'bg-[#FCA311]' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {step.position === 'bottom' ? (
                <span className="inline-flex items-center gap-1">
                  <ArrowDown className="w-3 h-3" /> Toque para continuar
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" /> Toque para continuar
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FirstWalkthrough
