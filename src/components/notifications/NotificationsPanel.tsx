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
            <div className="w-9 h-9 rounded-xl bg-ink flex items-center justify-center">
              <Bell className="w-4.5 h-4.5 text-action" />
            </div>
            <h2 className="text-lg font-bold text-ink">Notificações</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-2 text-body2"
            aria-label="Fechar notificações"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {checking ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-ink/40" />
          </div>
        ) : !supported || (!standalone && /iPhone|iPad|iPod/i.test(navigator.userAgent)) ? (
          /* iOS sem PWA instalado */
          <div className="space-y-4">
            <div className="bg-[#FEF7E6] border border-action/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-[#B87700] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-ink mb-1">Instale o app primeiro</p>
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
              className="w-full py-3 rounded-xl border border-line text-sm font-semibold text-body hover:bg-surface-2 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
              Desativar notificações
            </button>

            {/* Som + banner heads-up: o app não pode configurar — guia de 10s por plataforma */}
            <div className="bg-[#FEF7E6] border border-action/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Volume2 className="w-5 h-5 text-[#B87700] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-ink mb-1">Ative o som e a faixa na tela</p>
                  {/iPhone|iPad|iPod/i.test(navigator.userAgent) ? (
                    <div className="text-xs text-[#4B5563] leading-relaxed space-y-2">
                      <p>
                        <strong className="text-ink">1. PWA instalado?</strong> As notificações no
                        iPhone só funcionam com o Curiangoo instalado (iOS 16.4+): Safari → botão
                        Compartilhar → "Adicionar à Tela de Início". Abra pelo ícone.
                      </p>
                      <p>
                        <strong className="text-ink">2. Permitir notificações:</strong> Ajustes →
                        Notificações → Curiangoo → ative "Permitir Notificações",{' '}
                        <strong>Sons</strong> e <strong>Banners</strong> (estilo temporário mostra a
                        faixa no topo).
                      </p>
                      <p>
                        <strong className="text-ink">3. Não perturbe:</strong> Ajustes → Não
                        Perturbe / Modos de Foco → verifique se o Curiangoo não está silenciado.
                      </p>
                      <p className="text-[10px] text-body3">
                        No iOS o som do Curiango toca com o app aberto; com o app fechado, o som é o
                        configurado no Ajustes (o iOS não permite som custom de app web fechado).
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-[#4B5563] leading-relaxed space-y-2">
                      <p>
                        <strong className="text-ink">1. Som e faixa no topo:</strong> segure uma
                        notificação do Curiangoo na bandeja → "Todas as categorias" → toque em{' '}
                        <strong>curiangoo.com</strong> (ou Chrome) → ative <strong>Som</strong> e{' '}
                        <strong>Flutuante</strong>. Igual WhatsApp.
                      </p>
                      <p>
                        <strong className="text-ink">2. App aberto:</strong> o piu do Curiango toca
                        automaticamente (só o piu, sem som do sistema).
                      </p>
                      <p>
                        <strong className="text-ink">3. Não perturbe:</strong> se estiver com "Não
                        perturbe" ativo, notificações chegam sem som — desative ou adicione o Chrome
                        como exceção.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Push não ativado */
          <div className="space-y-4">
            <div className="bg-ink rounded-2xl p-5 text-white">
              <Bell className="w-6 h-6 text-action mb-3" />
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
              className="w-full py-3.5 rounded-xl bg-action hover:opacity-90 text-white font-bold text-sm shadow-elevation-1 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              Ativar notificações
            </button>
            <p className="text-[11px] text-body3 text-center leading-relaxed">
              Você escolhe o que receber e pode desativar quando quiser. Sem spam — só o que
              acontece na sua família.
            </p>
            <p className="text-[10px] text-body3 text-center leading-relaxed">
              Som do Curiango: gravação de Dante Buzzetti (xeno-canto.org, XC668769), licença CC
              BY-NC-SA.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
