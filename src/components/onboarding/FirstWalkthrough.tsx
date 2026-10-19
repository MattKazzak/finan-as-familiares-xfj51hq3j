import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'
import { ArrowDown, X } from 'lucide-react'

/**
 * FirstWalkthrough — Tour de primeiro acesso v3.4 (19/10, prints do Matheus).
 *
 * MISSÃO EDUCATIVA (18/10): o tour É a primeira aula do Curiango — cada balão
 * ensina um conceito em linguagem de amador, nunca jargão.
 *
 * v3.4 (print 20:16):
 *  - MASCOTE = o PÁSSARO OFICIAL da marca (CuriangoLogo), INVERTIDO pra olhar
 *    pra conversa. O "gatinho" kawaii da v3.3 perdeu a identidade — o Matheus:
 *    "você já tem o pássaro, é só colocar ele lá, pode ser inteiro, inverte-o".
 *  - ESPERA INTELIGENTE: o tour não nasce mais sobre um app que ainda não
 *    renderizou. Enquanto houver outro dialog aberto (wizard de configuração)
 *    ou o alvo ainda não existir no DOM, ele ESPERA e re-tenta — os balões
 *    pousam nos elementos reais (saldo, copilot, baldes, dock).
 *  - Alvo que NUNCA aparece (gated/free): balão vira centralizado, nunca quebrado.
 *  - PASSO COPILOT com ação real: botão "Abrir o Copilot" navega pra /copilot
 *    e encerra o tour (o Matheus: "não abre o copilot nem vai pra outra tela").
 *  - Mantém: seta no centro do alvo, scroll automático, balão auto-inverte,
 *    Continuar sólido, X no canto da tela, navegação por ID em ordem fixa.
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
    // Matheus 19/10 (print 20:52): a seta errava o alvo — agora aponta pro
    // botão Nova do dock (o caminho REAL de lançar, navy central).
    id: 'primeira-receita',
    targetSelector: '[data-testid="dock-new-transaction"]',
    position: 'top',
    title: 'Registre suas receitas',
    text: 'Ou fale comigo — "recebi 2.500 de salário" — que eu registro pra você. É o que faz tudo aqui funcionar.',
  },
  {
    // Matheus 19/10: "só a que mencionei o clicável que leva pro chat" —
    // ilumina o card-convite do Copilot (que agora É o convite sutil).
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

/** Altura estimada do balão + mascote — usada pra decidir se inverte de lado */
const BALLOON_H_ESTIMATE = 230
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
  const navigate = useNavigate()
  // Navegação por ID na ordem FIXA de STEPS (a lista não encolhe — bug v3)
  const firstPending = STEPS.find((s) => !stepsDone.includes(s.id))?.id ?? null
  const [currentId, setCurrentId] = useState<WalkthroughStepId | null>(firstPending)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [measuring, setMeasuring] = useState(true)
  /** Lado EFETIVO do balão (pode inverter do preferido se não couber) */
  const [effectivePos, setEffectivePos] = useState<'top' | 'bottom'>('bottom')

  const step = STEPS.find((s) => s.id === currentId)
  const isFirstStep = step?.id === STEPS[0].id

  /** Mede, escolhe o lado que cabe e posiciona a seta no centro do alvo */
  const applyPlacement = useCallback(
    (r: DOMRect) => {
      if (!step) return
      const viewH = window.innerHeight
      const spaceBelow = viewH - r.bottom
      const spaceAbove = r.top
      let pos = step.position
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
      setMeasuring(false)
    },
    [step],
  )

  // Geração: cada measure() novo cancela a cadeia anterior (o listener de
  // scroll dispara measure a cada frame de scroll — sem guarda, as cadeias
  // de retry se acumulam).
  const measureGen = useRef(0)

  const measure = useCallback(() => {
    if (!step) return
    if (!step.targetSelector) {
      setRect(null)
      setMeasuring(false)
      return
    }
    const gen = ++measureGen.current
    let attempts = 0
    const tryFind = () => {
      if (gen !== measureGen.current) return
      // ESPERA INTELIGENTE: outro dialog aberto (wizard de configuração da
      // família)? O tour não nasce por cima dele — espera fechar.
      const otherDialog = document.querySelector(
        '[role="dialog"]:not([aria-label="Tour de primeiro acesso"])',
      )
      if (otherDialog) {
        window.setTimeout(tryFind, 700)
        return
      }
      const el = document.querySelector(step.targetSelector!)
      if (el) {
        const r0 = el.getBoundingClientRect()
        const viewH = window.innerHeight
        if (r0.top < 60 || r0.bottom > viewH - 90) {
          // Alvo fora da vista → rola pra centro ANTES de medir
          el.scrollIntoView({ block: 'center', behavior: 'auto' })
          // Âncora velha = bug do print (balão 515px abaixo do alvo): re-mede
          // no duplo rAF (layout pós-scroll) E como fallback em 300ms — e o
          // listener de scroll re-medir se o scroll chegar depois.
          const remeasure = () => {
            if (gen !== measureGen.current) return
            const el2 = document.querySelector(step.targetSelector!)
            if (el2) applyPlacement(el2.getBoundingClientRect())
          }
          requestAnimationFrame(() => requestAnimationFrame(remeasure))
          window.setTimeout(remeasure, 300)
        } else {
          applyPlacement(r0)
        }
        return
      }
      // Alvo ainda não renderizou → re-tenta (categorias/RPCs chegam async)
      attempts++
      if (attempts < 14) {
        window.setTimeout(tryFind, 180)
      } else {
        // Alvo NUNCA apareceu (gated/free): balão centralizado, nunca quebrado
        setRect(null)
        setMeasuring(false)
      }
    }
    tryFind()
  }, [step, applyPlacement])

  useEffect(() => {
    setMeasuring(true)
    setRect(null)
    const raf = requestAnimationFrame(() => measure())
    // AMOSTRADOR contínuo (padrão Driver.js): o layout da Home muda DEPOIS do
    // primeiro paint (RPCs chegam, fontes carregam, card do tour monta, scroll
    // assenta) — medir uma vez só deixa o balão ancorado numa posição velha
    // (bug do gap 515/520 nos prints do Matheus). Re-mede a cada 250ms enquanto
    // o passo está ativo; setRect com o valor anterior = React nem re-renderiza.
    const sampler = window.setInterval(() => {
      if (!step?.targetSelector) return
      const el = document.querySelector(step.targetSelector)
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect((prev) =>
        prev &&
        Math.abs(prev.top - r.top) < 1 &&
        Math.abs(prev.left - r.left) < 1 &&
        Math.abs(prev.width - r.width) < 1
          ? prev
          : r,
      )
      setMeasuring(false)
    }, 250)
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(sampler)
    }
  }, [measure])
  // NUNCA null durante measuring (bug provado no Chrome 19/10: entre passos o
  // tour sumia até 2,5s — "passos quebrados" do Matheus). Balão fica
  // centralizado visível enquanto mede e pousa quando o alvo é encontrado.
  if (!step) return null

  const isCenter = !step.targetSelector || !rect || measuring

  const advance = () => {
    onCompleteStep(step.id)
    // Próximo passo pendente na ordem fixa (a lista NÃO encolhe — bug v3)
    const idx = STEPS.findIndex((s) => s.id === step.id)
    const next = STEPS.slice(idx + 1).find((s) => !stepsDone.includes(s.id))
    if (!next) {
      // Último passo: marca 'tour' e FECHA NA HORA (Matheus 19/10: o tour deve
      // fechar sozinho no último passo — não esperar o refresh do banco chegar).
      onCompleteStep('tour')
      setCurrentId(null)
    } else {
      setCurrentId(next.id)
    }
  }

  const skipAll = () => {
    onCompleteStep(step.id)
    onSkip()
    // X no canto fecha NA HORA (Matheus: "não fecha quando clico no X")
    setCurrentId(null)
  }

  // PASSO COPILOT com ação real (Matheus: "não abre o copilot nem vai pra outra tela")
  const openCopilot = () => {
    onCompleteStep('copilot')
    onCompleteStep('tour')
    navigate('/copilot')
  }

  // Container do balão: ancorado no alvo (lado efetivo) ou centralizado
  const containerLeft = rect ? Math.max(16, Math.min(rect.left, window.innerWidth - 336)) : 0
  const balloonStyle: React.CSSProperties = isCenter
    ? {
        // Boas-vindas ENQUADRADA (Matheus 19/10: "não enquadra exatamente dentro
        // da janela clara"): inset horizontal fixo, sem transform — o card
        // respeita a largura da tela com margem simétrica.
        left: 16,
        right: 16,
        maxWidth: 360,
      }
    : effectivePos === 'bottom'
      ? {
          // CLAMP (Matheus 19/10: balão dos Baldes ficava escondido embaixo e o
          // Continuar não era clicável): o topo do balão nunca passa do limite
          // que deixa o rodapé do card visível acima do dock.
          top: Math.min(rect!.bottom + PAD + 12, window.innerHeight - 260),
          left: containerLeft,
          maxWidth: 320,
        }
      : {
          bottom: Math.min(window.innerHeight - rect!.top + PAD + 12, window.innerHeight - 260),
          left: containerLeft,
          maxWidth: 320,
        }

  // Seta: centro real do alvo, relativo AO CARD (bug provado no Chrome 19/10:
  // arrowOff ~72px — a seta era posicionada relativa ao container, mas vive
  // dentro do card, que fica 64px+8px à direita quando o mascote está ao lado).
  const mascotOffset = effectivePos === 'bottom' && !isCenter ? 72 : 0
  const arrowLeft = rect
    ? Math.max(
        16,
        Math.min(
          rect.left + rect.width / 2 - containerLeft - mascotOffset - 6,
          window.innerWidth - containerLeft - mascotOffset - 44,
        ),
      )
    : 24

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

      {/* Pular tour — canto da TELA (fora do balão, padrão Duolingo) */}
      <button
        type="button"
        onClick={skipAll}
        aria-label="Pular tour"
        className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Mascote = PÁSSARO OFICIAL invertido (olha pra conversa) + balão uniforme */}
      <div
        className="absolute z-10 animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={balloonStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pássaro: EM CIMA quando o balão sobe; AO LADO quando desce OU no modo
            centralizado (boas-vindas) — o Matheus não gostou do pássaro em cima
            no modo centralizado ("não enquadra exatamente dentro da janela"). */}
        {effectivePos === 'top' && (
          <CuriangoLogo
            size={64}
            color="#FCA311"
            eyeColor="#14213D"
            eyeRadius={3.4}
            eyeHighlight
            className="block mx-auto -mb-2 relative z-10"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}

        <div className="flex items-end gap-2">
          {/* Balão abaixo do alvo OU centralizado → pássaro À ESQUERDA do balão */}
          {(effectivePos === 'bottom' || isCenter) && (
            <CuriangoLogo
              size={64}
              color="#FCA311"
              eyeColor="#14213D"
              eyeRadius={3.4}
              eyeHighlight
              className="shrink-0 -mb-1"
              style={{ transform: 'scaleX(-1)' }}
            />
          )}

          <div className="flex-1 min-w-0 relative">
            <div className="rounded-xl bg-white shadow-elevation-3 px-4 py-3.5 border border-[rgba(20,33,61,0.08)]">
              <p className="text-[14px] font-bold text-[#14213D] leading-tight">{step.title}</p>
              <p className="text-[12.5px] text-slate-600 leading-relaxed mt-1">{step.text}</p>

              {/* Rodapé: avançar MINIMALISTA (Matheus 19/10: Continuar ocupava
                  espaço demais, pontinhos desnecessários). Só a flechinha âmbar;
                  no passo Copilot, o botão de ação real. */}
              <div className="flex items-center justify-end gap-1.5 mt-2.5">
                {step.id === 'copilot' && (
                  <button
                    type="button"
                    onClick={openCopilot}
                    className="text-[11.5px] font-bold text-white bg-[#14213D] hover:bg-[#1d2f52] px-3.5 py-1.5 rounded-full transition-colors shadow-sm"
                  >
                    Abrir o Copilot
                  </button>
                )}
                <button
                  type="button"
                  onClick={advance}
                  aria-label={isFirstStep ? 'Começar tour' : 'Próximo passo'}
                  className="w-8 h-8 rounded-full bg-[#FCA311] hover:bg-[#E08A00] text-white flex items-center justify-center transition-colors shadow-sm"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Setinha apontando o alvo — no CENTRO real dele */}
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
        </div>
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
