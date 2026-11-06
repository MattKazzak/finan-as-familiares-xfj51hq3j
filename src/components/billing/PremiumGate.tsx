// PremiumGate — paywall do modelo C2 (17/10): trial 7d → gratuito essencial.
// Usuários em TRIAL/PREMIUM veem a feature; usuários FREE veem um teaser sóbrio
// com CTA para a assinatura (no momento de valor, sem quebrar o app).
// O gate usa a RPC do servidor (nunca confia no cliente).
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAccessStatus } from '@/services/access-status'
import { CuriangoLogo } from '@/components/brand/CuriangoLogo'

interface PremiumGateProps {
  children: React.ReactNode
  /** Título do teaser quando o usuário é free */
  title?: string
  /** Texto do teaser */
  description?: string
}

export function PremiumGate({
  children,
  title = 'Feature Premium',
  description = 'Assine para desbloquear este recurso da família.',
}: PremiumGateProps) {
  const { isPremium, access, loading } = useAccessStatus()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-surface/95 p-4 text-xs text-body3">
        Carregando...
      </div>
    )
  }

  if (isPremium) {
    return <>{children}</>
  }

  return (
    <div className="rounded-2xl border border-line bg-surface/95 px-4 py-4 shadow-cds">
      <div className="flex items-center gap-3">
        <span className="shrink-0 relative">
          <CuriangoLogo size={32} color="#FCA311" eyeColor="#14213D" eyeRadius={2.8} eyeHighlight />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink leading-tight">{title}</p>
          <p className="text-[11px] text-body2 mt-0.5 leading-snug">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/perfil')}
          className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-action text-white hover:bg-action-hover transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          Assinar
        </button>
      </div>
    </div>
  )
}

export default PremiumGate
