import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useFamily } from '@/hooks/use-family'
import { useToast } from '@/hooks/use-toast'
import { TrendingUp, ShoppingBag, FileInput, Check, ChevronRight, PartyPopper } from 'lucide-react'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

/**
 * FirstTour — Tour de primeiro acesso (18/10, pedido do Matheus).
 *
 * Padrão dos grandes apps (Duolingo/Notion/Rocket Money): NÃO é modal bloqueante
 * nem carrossel de slides — é um CHECKLIST PROGRESSIVO na Home que ensina fazendo.
 * Cada passo é uma ação real no app; ao completar, o passo vira ✓ e some do card.
 * Os 3 passos concluídos = card desaparece para sempre (tour_completed_at no banco).
 *
 * Passos (ordem de valor pro usuário novo):
 *  1. Lançar uma RECEITA (o app precisa saber o que entra)
 *  2. Lançar uma DESPESA (o coração do app — categorização IA)
 *  3. Importar um EXTRATO (o atalho que traz o histórico inteiro)
 */
export interface FirstTourProps {
  /** Passos já concluídos (family.tour_steps_done) */
  stepsDone: string[]
}

const STEPS = [
  {
    id: 'receita',
    label: 'Lance sua primeira receita',
    hint: 'Salário, freela, vendas — o app calcula seus baldes a partir daqui',
    icon: TrendingUp,
    type: 'income' as const,
  },
  {
    id: 'despesa',
    label: 'Lance uma despesa',
    hint: 'O Curiango categoriza por IA — você confirma com 1 toque',
    icon: ShoppingBag,
    type: 'expense' as const,
  },
  {
    id: 'importar',
    label: 'Importe um extrato (opcional)',
    hint: 'OFX ou PDF do banco — traz o histórico inteiro de uma vez',
    icon: FileInput,
    type: null,
  },
] as const

export function FirstTour({ stepsDone }: FirstTourProps) {
  const { openNewTransaction, triggerRefresh } = useFamily()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [completing, setCompleting] = useState<string | null>(null)

  const pending = STEPS.filter((s) => !stepsDone.includes(s.id))

  // Todos os 3 concluídos (ou marcados) → tour não renderiza
  if (pending.length === 0) return null

  const completeStep = async (stepId: string) => {
    try {
      setCompleting(stepId)
      const { data, error } = await (supabase as any).rpc('mark_tour_step', {
        p_step: stepId,
      })
      if (error) throw error
      triggerRefresh()
      const done = Array.isArray(data) ? data[0] : data
      if (Array.isArray(done) && done.length >= 3) {
        toast({
          title: 'Tour concluído! 🎉',
          description: 'O Curiango cuida das contas com você a partir daqui.',
        })
      }
    } catch {
      // Falha silenciosa: o tour não pode bloquear o uso do app
    } finally {
      setCompleting(null)
    }
  }

  const handleStep = (step: (typeof STEPS)[number]) => {
    if (step.type) {
      // Abre o dialog de nova transação já no tipo certo; ao gravar, marca o passo
      openNewTransaction({ type: step.type })
      // Marca o passo otimisticamente (o dialog grava a transação; o passo é o convite)
      void completeStep(step.id)
    } else {
      navigate('/carteira?tab=importar')
      void completeStep(step.id)
    }
  }

  // Restam só os opcionais? Mostra estado de parabéns
  const obrigatóriosPendentes = pending.filter((s) => s.id !== 'importar')
  const soOpcional = obrigatóriosPendentes.length === 0

  return (
    <div className="rounded-2xl border border-[rgba(20,33,61,0.08)] bg-white/95 px-4 py-4 shadow-sm">
      {/* Cabeçalho com o Curiango guiando */}
      <div className="flex items-start gap-3 mb-3">
        <CuriangoLogo size={36} color="#FCA311" eyeColor="#14213D" eyeRadius={3.4} eyeHighlight />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#14213D] leading-tight">
            {soOpcional ? 'Você já sabe usar o básico! 🎉' : 'Bem-vindo ao Curiangoo!'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
            {soOpcional
              ? 'Se quiser, importe seu extrato e o Curiango organiza o histórico inteiro.'
              : 'Comece por aqui — 3 passos rápidos e suas finanças ganham vida:'}
          </p>
        </div>
        {/* Progresso */}
        <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0 mt-1">
          {stepsDone.length}/3
        </span>
      </div>

      {/* Passos */}
      <div className="space-y-1.5">
        {pending.map((step) => {
          const Icon = step.icon
          const isBusy = completing === step.id
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => handleStep(step)}
              disabled={isBusy}
              className="w-full flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left transition-all hover:border-[#FCA311]/40 hover:bg-[#FCA311]/5 active:scale-[0.99] disabled:opacity-60"
            >
              <span className="w-8 h-8 rounded-lg bg-[#14213D]/5 text-[#14213D] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-800 leading-tight">
                  {step.label}
                </span>
                <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">
                  {step.hint}
                </span>
              </span>
              {isBusy ? (
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {/* Passos já feitos (linha discreta de ✓) */}
      {stepsDone.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100">
          {STEPS.filter((s) => stepsDone.includes(s.id)).map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium"
            >
              <Check className="w-3 h-3" /> {s.label.replace('Lance sua primeira ', '')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default FirstTour
