import { useState, useEffect, useCallback, useRef } from 'react'
import { CuriangoChatBust } from '@/components/brand/CuriangoLogo'
import { ArrowDown, X } from 'lucide-react'

/**
 * FirstWalkthrough — Tour de primeiro acesso v3.2 (19/10, visão do Matheus).
 *
 * MISSÃO EDUCATIVA (18/10): o tour É a primeira aula do Curiango — cada balão
 * ensina um conceito em linguagem de amador, nunca jargão.
 *
 * Arquitetura v3.2 (corrige o teste do Matheus):
 *  - SETA no centro real do alvo (v3.1 usava left-8 fixo — a seta "não ficava
 *    em cima" do elemento).
 *  - SCROLL automático: alvo fora da tela é rolado pra vista antes de medir
 *    (os "próximos passos quebrados, desce pra bottom" — o balão ancorava num
 *    elemento invisível e caía pra baixo).
 *  - BALÃO auto-inverte: se não cabe abaixo do alvo, sobe pra cima (e vice-versa).
 *  - Navegação por ID na ordem FIXA (v3 navegava por índice numa lista que
 *    encolhia → passos pulados).
 *  - PERSONA: CuriangoChatBust (busto rindo + piscando, olhando pra conversa) é
 *    o ÚNICO ícone dos balões — pedido do Matheus ("ele olhando para a conversa,
 *    não apenas um enfeite").
 *
 * Roteiro (7 passos): boas-vindas → saldo → primeira-receita → copilot →
 * baldes → dock → perfil
 */
export type WalkthroughStepId =
  | 'boas-vindas'
  | 'saldo'
  | 'primeira-receita'
  | 'copilot'
  | 'baldes'
  | 'dock'
  | 'perfil'

interface WalkthroughStep {
  id: WalkthroughStepId
  /** data-testid do alvo; null = balão centralizado (boas-vindas) */
  targetSelector: string | null
  /** Lado preferido do balão; auto-inverte se não couber na tela */
  position: 'top' | 'bottom'
  title: string
  text: string
}

const STEPS: WalkthroughStep[] = [
  {
    id: 'boas-vindas',
    targetSelector: null,
    position: 'bottom',
    title: 'Oi! Eu sou o Curiango 🪶',
    text: 'Se você reservou um tempo pra cuidar das suas finanças, você já está na frente da maioria. Pouca gente sabe o que acontece no próprio ninho — eu vou te mostrar, passo a passo, e te ajudar nos dias que estão por vir.',
  },
  {
    id: 'saldo',
    targetSelector: '[data-testid="balance-block"]',
    position: 'bottom',
    title: 'Aqui é o seu saldo',
    text: 'Nada de novidade por enquanto — mas eu não vou deixar faltar grana no fim do mês. Tudo que entra e sai passa por aqui, e eu fico de olho.',
  },
  {
    id: 'primeira-receita',
    targetSelector: '[data-testid="first-tour-card"]',
    position: 'bottom',
    title: 'Registre suas receitas',
    text: 'Ou fale comigo — "recebi 2.500 de salário" — que eu registro pra você. É o que faz tudo aqui funcionar.',
  },
  {
    id: 'copilot',
    targetSelector: '[data-testid="copilot-card"]',
    position: 'bottom',
    title: 'Acabou a ansiedade financeira',
    text: 'Eu organizo tudo pra você, é só me dizer: "comprei 60 no mercado", "quanto tenho pra semana?", "quanto sobrou esse mês?" — fala comigo como se fosse um amigo.',
  },
  {
    id: 'baldes',
    targetSelector: '[data-testid="first-floating-card"]',
    position: 'bottom',
    title: 'O método dos 3 Baldes',
    text: 'Seu dinheiro se divide em Necessidades, Estilo de Vida e Futuro. Simples assim: quando um balde enche demais, eu te aviso antes do prejuízo.',
  },
  {
    id: 'dock',
    targetSelector: '[data-testid="dock-new-transaction"]',
    position: 'top',
    title: 'Registrar é um toque',
    text: 'Esse botão é seu melhor amigo: receita, despesa, parcelado ou falando comigo. Lançar no dia = controle no fim do mês.',
  },
  {
    id: 'perfil',
    targetSelector: '[data-testid="dock-profile"]',
    position: 'top',
    title: 'Tudo se ajusta aqui',
    text: 'Seu perfil, notificações e preferências moram aqui. Se quiser rever este tour, é só voltar em Perfil → Reiniciar tour.',
  },
]

/** Altura estimada do balão — usada pra decidir se inverte de lado */
const BALLOON_H_ESTIMATE = 190
const PAD = 8

export interface FirstWalkthroughProps {
  /** Passos já concluídos (family.tour_steps_done) */
  stepsDone: string[]
  /** Marca o passo no banco (RPC mark_tour_step) */
  onCompleteStep: (stepId: string) => void
  /** Pula o tour inteiro */
  onSkip: () => void
}

export function FirstWalkthrough({ stepsDone, onCompleteStep, onSkip }: FirstWalkthroughProps) {
  // Navegação por ID na ordem FIXA de STEPS (a lista não encolhe — bug v3)
  const firstPending = STEPS.find((s) => !stepsDone.includes(s.id))?.id ?? null
  const [currentId, setCurrentId] = useState<WalkthroughStepId | null>(firstPending)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [measuring, setMeasuring] = useState(true)
  /** Lado EFETIVO do balão (pode inverter do preferido se não couber) */
  const [effectivePos, setEffectivePos] = useState<'top' | 'bottom'>('bottom')
  /** Posição X da seta (centro do alvo, clamped) */
  const [arrowLeft, setArrowLeft] = useState(32)
  const balloonRef = useRef<HTMLDivElement>(null)

  const step = STEPS.find((s) => s.id === currentId)
  const isFirstStep = step?.id === STEPS[0].id

  const measure = useCallback(() => {
    if (!step) return
    if (!step.targetSelector) {
      setRect(null)
      setMeasuring(false)
      return
    }
    const el = document.querySelector(step.targetSelector)
    if (!el) {
      // Alvo ausente (ex.: card gated em modo free): PULA o passo — nunca trava
      setRect(null)
      setMeasuring(false)
      return
    }
    // Alvo fora da vista → rola pra centro ANTES de medir (bug "passos quebrados")
    const r0 = el.getBoundingClientRect()
    const viewH = window.innerHeight
    if (r0.top < 60 || r0.bottom > viewH - 90) {
      el.scrollIntoView({ block: 'center', behavior: 'auto' })
      // Re-mede após o scroll assentar
      window.setTimeout(() => {
        const r = el.getBoundingClientRect()
        applyPlacement(r)
      }, 80)
      return
    }
    applyPlacement(r0)
  }, [step])

  /** Mede, escolhe o lado que cabe e posiciona a seta no centro do alvo */
  const applyPlacement = (r: DOMRect) => {
    const viewH = window.innerHeight
    const spaceBelow = viewH - r.bottom
    const spaceAbove = r.top
    let pos = step!.position
    if (
      pos === 'bottom' &&
      spaceBelow < BALLOON_H_ESTIMATE + 24 &&
      spaceAbove > BALLOON_H_ESTIMATE + 24
    ) {
      pos = 'top'
    } else if (
      pos === 'top' &&
      spaceAbove < BALLOON_H_ESTIMATE + 24 &&
      spaceBelow > BALLOON_H_ESTIMATE + 24
    ) {
      pos = 'bottom'
    }
    setEffectivePos(pos)
    setRect(r)
    // Seta no CENTRO do alvo (clamp pra não sair da tela)
    setArrowLeft(Math.max(24, Math.min(r.left + r.width / 2 - 6, window.innerWidth - 44)))
    setMeasuring(false)
  }

  useEffect(() => {
    setMeasuring(true)
    const raf = requestAnimationFrame(() => measure())
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [measure])

  if (!step) return null

  const isCenter = !step.targetSelector || !rect

  const advance = () => {
    onCompleteStep(step.id)
    // Próximo passo pendente na ordem fixa (a lista NÃO encolhe — bug v3)
    const idx = STEPS.findIndex((s) => s.id === step.id)
    const next = STEPS.slice(idx + 1).find((s) => !stepsDone.includes(s.id))
    if (!next) {
      // Último passo: marca 'tour' pra encerrar o walkthrough
      onCompleteStep('tour')
    } else {
      setCurrentId(next.id)
    }
  }

  const skipAll = () => {
    onCompleteStep(step.id)
    onSkip()
  }

  // Posição do balão: ancorado no alvo (lado efetivo) ou centralizado
  const balloonStyle: React.CSSProperties = isCenter
    ? {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 320,
      }
    : effectivePos === 'bottom'
      ? {
          top: rect!.bottom + PAD + 12,
          left: Math.max(16, Math.min(rect!.left, window.innerWidth - 336)),
          maxWidth: 320,
        }
      : {
          bottom: window.innerHeight - rect!.top + PAD + 12,
          left: Math.max(16, Math.min(rect!.left, window.innerWidth - 336)),
          maxWidth: 320,
        }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label="Tour de primeiro acesso">
      {/* Overlay escuro; toque em QUALQUER lugar avança (o balão é o único que não) */}
      <div
        className="absolute inset-0 bg-[#0B1526]/85"
        onClick={advance}
        style={
          !isCenter && rect
            ? {
                clipPath: `polygon(
                  0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                  ${rect.left - PAD}px ${rect.top - PAD}px,
                  ${rect.left - PAD}px ${rect.bottom + PAD}px,
                  ${rect.right + PAD}px ${rect.bottom + PAD}px,
                  ${rect.right + PAD}px ${rect.top - PAD}px,
                  ${rect.left - PAD}px ${rect.top - PAD}px
                )`,
              }
            : undefined
        }
      />

      {/* Balão do Curiango — persona: busto à esquerda olhando pra conversa */}
      <div
        ref={balloonRef}
        className="absolute z-10 animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={balloonStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl bg-white shadow-elevation-3 px-4 py-4 border border-[rgba(20,33,61,0.08)]">
          <div className="flex items-start gap-3">
            {/* O Curiango: pescoço pra cima, rindo, piscando — encarando o texto */}
            <CuriangoChatBust size={48} lookRight className="shrink-0 -mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-[#14213D] leading-tight">{step.title}</p>
              <p className="text-[12.5px] text-slate-600 leading-relaxed mt-1.5">{step.text}</p>

              {/* Rodapé: progresso + avançar explícito (o toque no overlay também avança) */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
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
                <button
                  type="button"
                  onClick={advance}
                  className="text-[11px] font-bold text-[#14213D] bg-[#FCA311]/15 hover:bg-[#FCA311]/25 px-3 py-1.5 rounded-full transition-colors inline-flex items-center gap-1"
                >
                  {isFirstStep ? 'Vamos começar' : 'Continuar'}
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={skipAll}
              aria-label="Pular tour"
              className="shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Setinha apontando o alvo — no CENTRO real dele (v3.2) */}
        {!isCenter && (
          <div
            className={`absolute w-3 h-3 rotate-45 bg-white border-[rgba(20,33,61,0.08)] ${
              effectivePos === 'bottom'
                ? '-top-1.5 border-l border-t'
                : '-bottom-1.5 border-r border-b'
            }`}
            style={{ left: arrowLeft }}
          />
        )}
      </div>

      {/* Dica de navegação (só a partir do 2º passo) */}
      {!isFirstStep && (
        <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
          <span className="text-[11px] text-white/60 font-medium bg-[#0B1526]/60 px-3 py-1.5 rounded-full">
            Toque em qualquer lugar para continuar
          </span>
        </div>
      )}
    </div>
  )
}

export default FirstWalkthrough
