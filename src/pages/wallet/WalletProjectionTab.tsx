import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Info,
  Repeat,
  Target,
  CreditCard,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useWallet } from './WalletContext'
import { useActiveMonth, getCurrentSystemMonthStr } from '@/contexts/ActiveMonthContext'
import { formatBRL, parseBRLToCents } from '@/lib/formatters'
import { useValuePrivacy } from '@/hooks/use-value-privacy'
import { useToast } from '@/hooks/use-toast'
import { useFamily } from '@/hooks/use-family'
import {
  buildProjection,
  monthLabelOf,
  type ProjectionResult,
  type ProjectionItem,
} from '@/services/projection'
import type { Transaction, Goal, RecurringIncome } from '@/types/finance'

/**
 * ABA PROJEÇÃO FINANCEIRA (27/10)
 *
 * REDESENHO após feedback do dono ("está amadora, me parece confuso") e pesquisa
 * nos players (Monarch Money "Upcoming", Copilot, Simplifi):
 *
 * - O padrão que o LEIGO entende não é gráfico de 12 meses — é LISTA por mês.
 * - O usuário navega MÊS A MÊS com as setas (que já existem no topo da Carteira)
 *   e vê, um por um, o que já tem dono naquele mês: nome, dia, valor e de que
 *   se trata ("3 de 6", "conta fixa", "uma vez").
 * - O total do mês é o número grande. O horizonte total vive numa linha
 *   secundária, porque é informação de contexto, não a estrela da tela.
 * - MÁXIMO 1 ação por visita (Caminho B, Ação 5).
 */
const APORTES_KEY = 'curiangoo_aportes_metas_v1'
function readAportesSalvos(): Record<string, number> {
  try {
    const raw = localStorage.getItem(APORTES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}
function writeAporteSalvo(goalId: string, cents: number) {
  try {
    const atual = readAportesSalvos()
    if (cents > 0) atual[goalId] = cents
    else delete atual[goalId]
    localStorage.setItem(APORTES_KEY, JSON.stringify(atual))
  } catch {
    /* silencioso: preferência local, nunca bloqueia a tela */
  }
}

const ORIGIN_ICON = {
  recorrente: Repeat,
  parcela: CreditCard,
  meta: Target,
  divida: Receipt,
} as const

export function WalletProjectionTab() {
  const { family, recurringIncomes } = useWallet()
  const { activeMonth } = useActiveMonth()
  const { hideValues, maskValue } = useValuePrivacy()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { refreshTrigger } = useFamily()

  const [acaoAberta, setAcaoAberta] = useState(false)
  const [valorAporte, setValorAporte] = useState('')
  const [loading, setLoading] = useState(true)
  const [saldoCents, setSaldoCents] = useState(0)
  const [parcelasFuturas, setParcelasFuturas] = useState<Transaction[]>([])
  const [metas, setMetas] = useState<Goal[]>([])
  const [mediaGastosCents, setMediaGastosCents] = useState(0)
  // Contas fixas buscadas AQUI (não herdadas do contexto da Carteira): o
  // contexto só recarrega quando o mês muda, então uma conta fixa criada em
  // outra tela não aparecia na projeção.
  const [recorrentesLocal, setRecorrentesLocal] = useState<RecurringIncome[]>([])
  const [todayStr] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  useEffect(() => {
    if (!family?.id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const { startOfThisMonth, threeAgoStr } = (() => {
          const d = new Date()
          const tm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
          const t3 = new Date(d.getFullYear(), d.getMonth() - 3, 1)
          return {
            startOfThisMonth: tm,
            threeAgoStr: `${t3.getFullYear()}-${String(t3.getMonth() + 1).padStart(2, '0')}-01`,
          }
        })()

        const [saldoRes, futurosRes, metasRes, recRes, receitasRes, gastosRes] = await Promise.all([
          // Saldo ATÉ HOJE: o total global já inclui as parcelas futuras lançadas
          // e contaria o mesmo dinheiro duas vezes.
          (supabase as any).rpc('get_family_balance_until', {
            p_family_id: family.id,
            p_until_date: todayStr,
          }),
          // Tudo que AINDA VAI CAIR: parcelas e lançamentos agendados.
          supabase
            .from('transactions')
            .select('*')
            .eq('family_id', family.id)
            .gt('transaction_date', todayStr)
            .neq('status', 'projected'),
          supabase.from('goals').select('*').eq('family_id', family.id),
          supabase.from('recurring_incomes').select('*').eq('family_id', family.id),
          supabase
            .from('transactions')
            .select('category_id, amount_cents, type')
            .eq('family_id', family.id)
            .eq('type', 'income')
            .neq('status', 'projected'),
          // Gastos VARIÁVEIS dos 3 meses fechados (sem recorrente, sem parcela).
          supabase
            .from('transactions')
            .select('amount_cents, transaction_date, recurring_income_id, is_installment')
            .eq('family_id', family.id)
            .eq('type', 'expense')
            .neq('status', 'projected')
            .gte('transaction_date', threeAgoStr)
            .lt('transaction_date', startOfThisMonth),
        ])

        if (cancelled) return

        const saldoRow = Array.isArray(saldoRes.data) ? saldoRes.data[0] : saldoRes.data
        setSaldoCents(
          (Number(saldoRow?.total_income_cents) || 0) -
            (Number(saldoRow?.total_expense_cents) || 0),
        )
        setParcelasFuturas((futurosRes.data || []) as Transaction[])
        setRecorrentesLocal((recRes.data || []) as RecurringIncome[])

        // Progresso da meta = soma das receitas da categoria vinculada
        const porCategoria = new Map<string, number>()
        for (const r of receitasRes.data || []) {
          const cid = (r as any).category_id
          if (!cid) continue
          porCategoria.set(
            cid,
            (porCategoria.get(cid) || 0) + (Number((r as any).amount_cents) || 0),
          )
        }
        const aportesSalvos = readAportesSalvos()
        setMetas(
          ((metasRes.data || []) as Goal[]).map((g) => ({
            ...g,
            progressoCents: g.category_id ? porCategoria.get(g.category_id) || 0 : 0,
            aporteMensalCents: aportesSalvos[g.id] || undefined,
          })),
        )

        const rows = (gastosRes.data || []).filter(
          (r: any) => !r.recurring_income_id && !r.is_installment,
        )
        setMediaGastosCents(
          Math.round(
            rows.reduce((acc: number, r: any) => acc + (Number(r.amount_cents) || 0), 0) / 3,
          ),
        )
      } catch (err) {
        console.warn('[projecao] Falha ao carregar dados:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [family?.id, refreshTrigger, todayStr])

  const projection: ProjectionResult = useMemo(
    () =>
      buildProjection(
        saldoCents,
        recorrentesLocal.length > 0 ? recorrentesLocal : recurringIncomes || [],
        parcelasFuturas,
        metas,
        mediaGastosCents,
        activeMonth,
        todayStr,
        12,
      ),
    [
      saldoCents,
      recorrentesLocal,
      recurringIncomes,
      parcelasFuturas,
      metas,
      mediaGastosCents,
      activeMonth,
      todayStr,
    ],
  )

  const fmt = (cents: number) => (hideValues ? maskValue(formatBRL(cents)) : formatBRL(cents))

  // Mês que o usuário está olhando (sincronizado com o seletor do topo)
  const itens: ProjectionItem[] = projection.itensPorMes[activeMonth] || []
  const totalMes = itens.reduce((acc, it) => acc + it.valorCents, 0)
  const mesProjection = projection.months.find((m) => m.monthKey === activeMonth)
  const isMesAtual = activeMonth === getCurrentSystemMonthStr()
  const isPassado = activeMonth < getCurrentSystemMonthStr()

  const metaFoco = useMemo(() => {
    const comPrazo = metas.filter(
      (g) => g.deadline && (Number(g.target_amount_cents) || 0) > (g.progressoCents || 0),
    )
    if (comPrazo.length === 0) return null
    return comPrazo.reduce((acc, g) => {
      const faltaAcc = (Number(acc.target_amount_cents) || 0) - (acc.progressoCents || 0)
      const faltaG = (Number(g.target_amount_cents) || 0) - (g.progressoCents || 0)
      return faltaG > faltaAcc ? g : acc
    })
  }, [metas])

  const salvarAporte = () => {
    if (!metaFoco) return
    const cents = parseBRLToCents(valorAporte)
    if (!cents || cents <= 0) {
      toast({
        title: 'Informe um valor',
        description: 'Digite quanto você quer guardar por mês (ex.: 200,00).',
        variant: 'destructive',
      })
      return
    }
    writeAporteSalvo(metaFoco.id, cents)
    setMetas((prev) =>
      prev.map((g) => (g.id === metaFoco.id ? { ...g, aporteMensalCents: cents } : g)),
    )
    setAcaoAberta(false)
    setValorAporte('')
    toast({
      title: 'Projeção atualizada 👍',
      description: `Agora considero ${formatBRL(cents)} por mês em “${metaFoco.name}”.`,
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-36 rounded-3xl bg-surface-2 animate-pulse" />
        <div className="h-56 rounded-3xl bg-surface-2 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-2">
      {/* MÊS ABERTO: o número grande é do MÊS, não do ano */}
      <div className="rounded-3xl bg-ink text-[color:var(--text-inverse)] p-5 shadow-cds">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            {isPassado ? 'Já foi' : isMesAtual ? 'Ainda vai sair este mês' : 'Comprometido em'}
          </p>
          <span className="text-[11px] font-semibold text-brand-amber">
            {monthLabelOf(activeMonth).replace('/', ' de ')}
          </span>
        </div>
        <p className="mt-1.5 text-3xl font-extrabold leading-none tracking-tight">
          {fmt(totalMes)}
        </p>
        <p className="mt-2 text-xs text-white/80 leading-snug">
          {totalMes > 0 ? (
            <>
              {itens.length} {itens.length === 1 ? 'compromisso' : 'compromissos'} neste mês
              {isMesAtual ? ' — contas fixas e parcelas que ainda vão cair' : ''}.
            </>
          ) : (
            <>Nada comprometido neste mês. Tudo livre.</>
          )}
        </p>

        {/* Contexto: quanto é o horizonte todo (secundário, discreto) */}
        {projection.totalComprometidoCents > 0 && (
          <p className="mt-3 pt-3 border-t border-white/10 text-[10px] text-white/50 leading-snug">
            No total, os próximos 12 meses têm {fmt(projection.totalComprometidoCents)} já
            comprometidos
            {projection.totalMensalFixo > 0
              ? ` — ${fmt(projection.totalMensalFixo)} por mês em contas fixas`
              : ''}
            .
          </p>
        )}
      </div>

      {/* ALERTA DO MÊS (educativo, nunca alarmista) */}
      {mesProjection && mesProjection.saldoCents < 0 && (
        <div className="rounded-2xl border-l-[3px] border-l-amber-500 bg-amber-50/70 p-3.5 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink leading-snug">
              Este mês o saldo fica negativo
            </p>
            <p className="text-[11px] text-body2 leading-snug mt-0.5">
              Pelo ritmo atual, seu saldo chega a {fmt(mesProjection.saldoCents)}. Não é o fim do
              mundo — é só a hora de segurar um pouco antes.
            </p>

            {metaFoco && !acaoAberta && (
              <button
                type="button"
                onClick={() => setAcaoAberta(true)}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-ink text-white text-[11px] font-semibold px-3 py-2 active:scale-95 transition-transform cursor-pointer"
              >
                <Target className="w-3 h-3" strokeWidth={2} />
                Definir quanto guardar por mês
              </button>
            )}

            {metaFoco && acaoAberta && (
              <div className="mt-2.5 rounded-xl bg-surface border border-line p-2.5">
                <label className="block text-[10px] font-semibold text-ink mb-1">
                  Quanto quero guardar por mês em “{metaFoco.name}”
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-body2">R$</span>
                  <input
                    inputMode="decimal"
                    value={valorAporte}
                    onChange={(e) => setValorAporte(e.target.value)}
                    placeholder="200,00"
                    className="flex-1 min-w-0 text-[12px] px-2 py-1.5 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-action"
                  />
                  <button
                    type="button"
                    onClick={salvarAporte}
                    className="rounded-lg bg-action text-white text-[11px] font-bold px-2.5 py-1.5 active:scale-95 transition-transform cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* A LISTA — o coração da aba (padrão Monarch "Upcoming") */}
      <div className="rounded-3xl border border-line bg-surface overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold text-ink">O que já tem dono</h3>
          <span className="text-[10px] font-semibold text-body3">{monthLabelOf(activeMonth)}</span>
        </div>

        {itens.length === 0 ? (
          <div className="px-4 pb-5 pt-1 text-center">
            <CalendarClock className="w-6 h-6 text-body3 mx-auto mb-1.5" strokeWidth={1.5} />
            <p className="text-[11px] text-body2 leading-snug">
              {isPassado
                ? 'Nenhum compromisso registrado neste mês.'
                : 'Nada comprometido aqui. Use as setas do mês no topo para ver os próximos.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {itens.map((it, idx) => {
              const Icon = ORIGIN_ICON[it.origin] || Repeat
              return (
                <li key={`${it.nome}-${idx}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-body2" strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-ink truncate leading-tight">
                      {it.nome}
                    </p>
                    <p className="text-[10px] text-body2 leading-tight mt-0.5">
                      {it.dia ? `dia ${it.dia} · ` : ''}
                      {it.detalhe}
                    </p>
                  </div>
                  <span className="text-[12px] font-bold text-ink shrink-0 tabular-nums">
                    {fmt(it.valorCents)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {itens.length > 0 && (
          <div className="px-4 py-3 bg-surface-2/70 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-body2">Total do mês</span>
            <span className="text-[13px] font-extrabold text-ink tabular-nums">
              {fmt(totalMes)}
            </span>
          </div>
        )}
      </div>

      {/* SETAS DO MÊS (reforço: o gesto principal é navegar) */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-[10px] text-body3">
          Use as setas do mês no topo para ver o próximo
        </span>
      </div>

      {/* EXPLICAÇÃO — curta, educativa */}
      <div className="rounded-2xl bg-surface-2 border border-line p-3.5 flex gap-2.5">
        <Info className="w-4 h-4 text-body3 shrink-0 mt-0.5" strokeWidth={1.8} />
        <div className="min-w-0">
          <p className="text-[11px] text-body2 leading-snug">
            <span className="font-semibold text-ink">Como isso funciona:</span> eu listo o que você
            já lançou — contas fixas, parcelas e metas — mês a mês. Não é adivinhação: é o seu
            próprio dinheiro já prometido.
          </p>
          <button
            type="button"
            onClick={() => navigate('/copilot')}
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink hover:text-action transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3" strokeWidth={2} />
            Perguntar ao Curiango
          </button>
        </div>
      </div>

      {/* RESULTADO DO MÊS — só quando há dados, discreto */}
      {mesProjection && totalMes > 0 && (
        <div className="rounded-2xl border border-line bg-surface px-4 py-3 flex items-center gap-2.5">
          {mesProjection.saldoCents >= 0 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2} />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" strokeWidth={2} />
          )}
          <p className="text-[11px] text-body2 leading-snug">
            Sobrando ou faltando, seu saldo previsto no fim deste mês:{' '}
            <span className="font-bold text-ink">{fmt(mesProjection.saldoCents)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
