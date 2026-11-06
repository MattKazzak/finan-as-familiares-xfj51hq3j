import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'

/**
 * BANNER DE TRIAL (22/10, pedido do Matheus) — padrão de mercado:
 * aparece SÓ nos últimos 3 dias do teste grátis (urgência real), no topo da
 * área clara da Home. Fora dessa janela: silêncio total (banner fixo vira
 * papel de parede — "banner blindness").
 *
 * - Dispensável por sessão (sessionStorage): se o usuário fecha, não persegue
 *   até reabrir o app. Ao reabrir, volta — são os últimos dias, importa.
 * - Dois caminhos, ambos levam ao Perfil (onde vivem o Convide e Ganhe e os
 *   planos): convidar amigo (+7 dias grátis) ou ver planos.
 * - Copy educativa e simples (missão educativa do Curiangoo): explica o que
 *   acontece quando o teste acabar, sem jargão.
 */
interface TrialBannerProps {
  daysLeft: number
}

const DISMISS_KEY = 'curiangoo_trial_banner_dismissed_v1'

export function TrialBanner({ daysLeft }: TrialBannerProps) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Janela de exibição: só nos últimos 3 dias (daysLeft 1, 2 ou 3).
  if (dismissed || daysLeft < 1 || daysLeft > 3) return null

  const title =
    daysLeft === 1 ? 'Seu teste grátis acaba amanhã' : `Seu teste grátis acaba em ${daysLeft} dias`

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true')
    } catch {
      // sessão restrita — silencioso
    }
  }

  return (
    <div
      data-testid="trial-banner"
      className="rounded-2xl border border-action/45 bg-action/10 px-4 py-3.5 shadow-cds animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-9 h-9 rounded-full bg-action/20 flex items-center justify-center mt-0.5">
          <Clock className="w-4 h-4 text-warning" strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight text-ink">{title}</p>
          <p className="text-[11px] text-body2 leading-snug mt-1">
            Convide um amigo e ganhe +7 dias — os lançamentos continuam grátis pra sempre.
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-ink text-white active:scale-95 transition-transform"
            >
              Convidar amigo
            </button>
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-line text-ink active:scale-95 transition-transform"
            >
              Ver planos
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar aviso"
          className="shrink-0 text-slate-400 hover:text-slate-700 text-sm px-1 -mt-0.5"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default TrialBanner
