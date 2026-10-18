import { useEffect, useState } from 'react'
import { Bell, BellOff, Smartphone, X, Loader2, CheckCircle2, Volume2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  isPushSupported,
  isStandalonePwa,
  subscribeToPush,
  getPushPreferences,
  getNotificationPermission,
} from '@/services/push'

/**
 * NotificationsPanel — painel deslizante do botão 🔔 da Home.
 * Estado 1: push não ativado → CTA "Ativar notificações" (explica o valor: saber o que o cônjuge lançou).
 * Estado 2: push ativo → confirmação + como funciona + desativar.
 * Estado 3: não suportado (iOS sem PWA instalado) → instrução de instalação.
 */
export default function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(true)
  const [standalone, setStandalone] = useState(true)
  const [permission, setPermission] = useState<string>('default')

  useEffect(() => {
    ;(async () => {
      const supportedNow = isPushSupported()
      setSupported(supportedNow)
      setStandalone(isStandalonePwa())
      if (supportedNow) {
        const perm = await getNotificationPermission()
        setPermission(perm)
        const prefs = await getPushPreferences()
        setActive(!!prefs?.pushEnabled && perm === 'granted')
      }
      setChecking(false)
    })()
  }, [])

  const handleActivate = async () => {
    setLoading(true)
    const res = await subscribeToPush()
    setLoading(false)
    if (res.ok) {
      setActive(true)
      setPermission('granted')
      toast({
        title: 'Notificações ativadas! 🔔',
        description: 'Você vai saber na hora quando alguém da família lançar algo.',
      })
    } else if (res.reason === 'denied') {
      toast({
        title: 'Permissão negada',
        description:
          'Para ativar depois: toque no cadeado ao lado do endereço no navegador → Notificações → Permitir.',
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Não foi possível ativar',
        description:
          res.reason === 'unsupported' ? 'Seu navegador não suporta push.' : 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleDisable = async () => {
    setLoading(true)
    const { disablePush } = await import('@/services/push')
    await disablePush()
    setLoading(false)
    setActive(false)
    toast({ title: 'Notificações desativadas' })
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white h-full shadow-2xl rounded-l-3xl p-5 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#14213D] flex items-center justify-center">
              <Bell className="w-4.5 h-4.5 text-[#FCA311]" />
            </div>
            <h2 className="text-lg font-bold text-[#14213D]">Notificações</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
            aria-label="Fechar notificações"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {checking ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-[#14213D]/40" />
          </div>
        ) : !supported || (!standalone && /iPhone|iPad|iPod/i.test(navigator.userAgent)) ? (
          /* iOS sem PWA instalado */
          <div className="space-y-4">
            <div className="bg-[#FEF7E6] border border-[#FCA311]/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-[#B87700] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-[#14213D] mb-1">Instale o app primeiro</p>
                  <p className="text-xs text-[#4B5563] leading-relaxed">
                    No iPhone, as notificações só funcionam com o Curiangoo instalado na tela de
                    início: toque em <strong>Compartilhar</strong> →{' '}
                    <strong>Adicionar à Tela de Início</strong>. Depois abra pelo ícone e ative as
                    notificações aqui.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : active ? (
          /* Push ativo */
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-900">Notificações ativas</p>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Quando alguém da família lançar um gasto ou receita, você recebe na hora — mesmo
                  com o app fechado.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDisable}
              disabled={loading}
              className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
              Desativar notificações
            </button>

            {/* Som + banner heads-up: o app não pode configurar — guia de 10s por plataforma */}
            <div className="bg-[#FEF7E6] border border-[#FCA311]/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Volume2 className="w-5 h-5 text-[#B87700] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-[#14213D] mb-1">
                    Ative o som e a faixa na tela
                  </p>
                  {/iPhone|iPad|iPod/i.test(navigator.userAgent) ? (
                    <p className="text-xs text-[#4B5563] leading-relaxed">
                      No iPhone: <strong>Ajustes</strong> → <strong>Notificações</strong> →{' '}
                      <strong>Safari</strong> (ou Curiangoo, se instalado) → ative{' '}
                      <strong>Sons</strong> e <strong>Banners</strong>.
                    </p>
                  ) : (
                    <p className="text-xs text-[#4B5563] leading-relaxed">
                      No Android: segure uma notificação do Curiangoo →{' '}
                      <strong>Todas as categorias</strong> → toque em <strong>curiangoo.com</strong>{' '}
                      (ou Chrome) → ative <strong>Som</strong> e <strong>Flutuante</strong>. Feito
                      isso, as notificações aparecem como faixa no topo, com som — igual WhatsApp.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Push não ativado */
          <div className="space-y-4">
            <div className="bg-[#14213D] rounded-2xl p-5 text-white">
              <Bell className="w-6 h-6 text-[#FCA311] mb-3" />
              <p className="text-sm font-bold mb-1">Saiba na hora o que acontece no ninho</p>
              <p className="text-xs text-white/70 leading-relaxed">
                Quando você ou a Karine lançarem um gasto, os outros membros da família recebem uma
                notificação no celular — com som, na tela bloqueada, igual WhatsApp.
              </p>
            </div>
            <button
              type="button"
              onClick={handleActivate}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#FCA311] hover:bg-[#e08e08] text-[#14213D] font-bold text-sm shadow-elevation-1 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              Ativar notificações
            </button>
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Você escolhe o que receber e pode desativar quando quiser. Sem spam — só o que
              acontece na sua família.
            </p>
            <p className="text-[10px] text-slate-300 text-center leading-relaxed">
              Som do Curiango: gravação de Dante Buzzetti (xeno-canto.org, XC668769), licença CC
              BY-NC-SA.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
