import { useState, useEffect, useCallback } from 'react'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import {
  ArrowDown,
  ArrowUp,
  X,
  Sparkles,
  Wallet,
  Plus,
  MessageCircle,
  Scale,
  BarChart3,
  Bell,
} from 'lucide-react'

/**
 * FirstWalkthrough — Tour de primeiro acesso v3 (19/10, visão do Matheus).
 *
 * "Eu imaginei o fundo escuro, os balõezinhos mostrando 'aqui registre receita'".
 * MISSÃO EDUCATIVA (18/10): o tour É a primeira aula do Curiango — cada balão
 * ensina um conceito em linguagem de amador, nunca jargão.
 *
 * Arquitetura v3 (corrige os 2 bugs da v2, achados no teste do Matheus):
 *  - O componente SEMPRE renderiza enquanto ativo (nunca desmonta entre passos —
 *    na v2, passo sem alvo na tela desmontava o componente inteiro e o clique
 *    de avançar morria).
 *  - Alvo sem data-testid na tela → passo é PULADO, não trava.
 *  - Overlay com pointer-events no overlay inteiro (toque em qualquer lugar avança)
 *    e o balão com stopPropagation (toque no balão não avança por acidente).
 *
 * Roteiro (7 passos — boas-vindas + 6 descobertas):
 *  1. BOAS-VINDAS do Curiango (centro, sem alvo) — mensagem hipnotizante
 *  2. Saldo da família — "o pulso do ninho"
 *  3. Card do tour (primeira receita) — a ação que destrava tudo
 *  4. Balão do Curiango (insights) — "eu falo com você"
 *  5. Orçamento em 3 Baldes — o método
 *  6. Dock Nova — registrar tudo por aqui
 *  7. Perfil — onde configurar e reiniciar este tour
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
  /** Balão acima/abaixo do alvo (ignorado no modo center) */
  position: 'top' | 'bottom'
  /** Ícone do balão (além do Curiango) */
  Icon?: typeof Wallet
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
    Icon: Wallet,
    title: 'Aqui é o seu saldo',
    text: 'Nada de novidade por enquanto — mas eu não vou deixar faltar grana no fim do mês. Tudo que entra e sai passa por aqui, e eu fico de olho.',
  },
  {
    id: 'primeira-receita',
    targetSelector: '[data-testid="first-tour-card"]',
    position: 'bottom',
    Icon: Sparkles,
    title: 'Registre suas receitas',
    text: 'Ou fale comigo — "recebi 2.500 de salário" — que eu registro pra você. É o que faz tudo aqui funcionar.',
  },
  {
    id: 'copilot',
    targetSelector: '[data-testid="copilot-card"]',
    position: 'bottom',
    Icon: MessageCircle,
    title: 'Acabou a ansiedade financeira',
    text: 'Eu organizo tudo pra você, é só me dizer: "lancei 60 no mercado", "quanto tenho pra semana?", "quanto sobrou esse mês?" — fala comigo como se fosse um amigo.',
  },
  {
    id: 'baldes',
    targetSelector: '[data-testid="first-floating-card"]',
    position: 'bottom',
    Icon: Scale,
    title: 'O método dos 3 Baldes',
    text: 'Seu dinheiro se divide em Necessidades, Estilo de Vida e Futuro. Simples assim: quando um balde enche demais, eu te aviso antes do prejuízo.',
  },
  {
    id: 'dock',
    targetSelector: '[data-testid="dock-new-transaction"]',
    position: 'top',
    Icon: Plus,
    title: 'Registrar é um toque',
    text: 'Esse botão é seu melhor amigo: receita, despesa, parcelado ou falando comigo. Lançar no dia = controle no fim do mês.',
  },
  {
    id: 'perfil',
    targetSelector: '[data-testid="dock-profile"]',
    position: 'top',
    Icon: Bell,
    title: 'Tudo se ajusta aqui',
    text: 'Seu perfil, notificações e preferências moram aqui. Se quiser rever este tour, é só voltar em Perfil → Reiniciar tour.',
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
  // Estado LOCAL do índice (o componente é dono da navegação — nunca desmonta
  // entre passos; desmontar era o bug da v2 que matava o toque).
  const pending = STEPS.filter((s) => !stepsDone.includes(s.id))
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [measuring, setMeasuring] = useState(true)

  const step = pending[Math.min(index, pending.length - 1)]

  // Medir o alvo do passo atual (e re-medir em resize/scroll)
  const measure = useCallback(() => {
    if (!step) return
    if (!step.targetSelector) {
      setRect(null)
      setMeasuring(false)
      return
    }
    const el = document.querySelector(step.targetSelector)
    if (!el) {
      // Alvo ausente (ex.: copilot em modo free com layout diferente): PULA o
      // passo e segue pro próximo — nunca trava (bug v2).
      setRect(null)
      setMeasuring(false)
      return
    }
    setRect(el.getBoundingClientRect())
    setMeasuring(false)
  }, [step])

  useEffect(() => {
    setMeasuring(true)
    // Espera 1 frame pra o layout assentar após a troca de passo
    const raf = requestAnimationFrame(() => measure())
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [measure, index])

  if (!step) return null

  const isCenter = !step.targetSelector || !rect
  const PAD = 8

  const advance = () => {
    onCompleteStep(step.id)
    setIndex((i) => i + 1)
  }

  const skipAll = () => {
    onCompleteStep(step.id)
    onSkip()
  }

  // Posição do balão: ancorado no alvo ou centralizado
  const balloonStyle: React.CSSProperties = isCenter
    ? {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 320,
      }
    : step.position === 'bottom'
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

      {/* Balão do Curiango */}
      <div
        className="absolute z-10 animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={balloonStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl bg-white shadow-elevation-3 px-4 py-4 border border-[rgba(20,33,61,0.08)]">
          <div className="flex items-start gap-3">
            <CuriangoLogo
              size={36}
              color="#FCA311"
              eyeColor="#14213D"
              eyeRadius={3.4}
              eyeHighlight
            />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-[#14213D] leading-tight">
                {step.Icon && (
                  <step.Icon className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5 text-[#FCA311]" />
                )}
                {step.title}
              </p>
              <p className="text-[12.5px] text-slate-600 leading-relaxed mt-1.5">{step.text}</p>
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

          {/* Rodapé: progresso + botão avançar explícito (o toque no overlay também avança) */}
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
              {index === 0 ? 'Vamos começar' : 'Continuar'}
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Setinha apontando o alvo (só no modo ancorado) */}
        {!isCenter && (
          <div
            className={`absolute left-8 w-3 h-3 rotate-45 bg-white border-[rgba(20,33,61,0.08)] ${
              step.position === 'bottom'
                ? '-top-1.5 border-l border-t'
                : '-bottom-1.5 border-r border-b'
            }`}
          />
        )}
      </div>

      {/* Dica de navegação (só a partir do 2º passo) */}
      {index > 0 && (
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
