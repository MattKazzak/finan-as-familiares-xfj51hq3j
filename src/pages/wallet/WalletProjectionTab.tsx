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
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useWallet } from './WalletContext'
import { useActiveMonth } from '@/contexts/ActiveMonthContext'
import { formatBRL } from '@/lib/formatters'
import { useValuePrivacy } from '@/hooks/use-value-privacy'
import {
  buildProjection,
  monthKeyOf,
  monthLabelOf,
  type ProjectionResult,
  type FutureCommitment,
} from '@/services/projection'
import type { Transaction, Goal } from '@/types/finance'

/**
 * ABA PROJEÇÃO FINANCEIRA (27/10, ordem do Matheus)
 *
 * Missão: o usuário leigo bate o olho e entende onde está o dinheiro do futuro.
 * Regras de desenho (aprovadas com o dono):
 * 1. UM número gigante — "R$ X já tem dono"
 * 2. Gráfico de 12 meses SEM eixos/jargão — só barras e cor
 * 3. Lista "quem come seu futuro" com origem e data-fim
 * 4. MÁXIMO 1 ação por visita
 * 5. NUNCA esconder a origem dos números: "com base nos seus lançamentos"
 */
export function WalletProjectionTab() {
  const { family, recurringIncomes } = useWallet()
  const { activeMonth } = useActiveMonth()
  const { hideValues, maskValue } = useValuePrivacy()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saldoCents, setSaldoCents] = useState(0)
  // Data de hoje (YYYY-MM-DD) — separa o que já caiu do que ainda vai cair.
  const [todayStrRef] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [parcelasFuturas, setParcelasFuturas] = useState<Transaction[]>([])
  const [metas, setMetas] = useState<Goal[]>([])
  const [mediaGastosCents, setMediaGastosCents] = useState(0)

  useEffect(() => {
    if (!family?.id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const today = new Date()
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        // média de gastos: últimos 3 meses fechados
        const threeAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
        const threeAgoStr = `${threeAgo.getFullYear()}-${String(threeAgo.getMonth() + 1).padStart(2, '0')}-01`

        const startOfThisMonth = `${todayStr.slice(0, 7)}-01`

        const [saldoRes, parcelasRes, metasRes, gastosRes] = await Promise.all([
          // EXATIDÃO (27/10): saldo ATÉ HOJE, nunca o total global. O total
          // global já inclui as parcelas e contas futuras lançadas — usá-lo e
          // depois projetar as mesmas parcelas contava o dinheiro duas vezes.
          (supabase as any).rpc('get_family_balance_until', {
            p_family_id: family.id,
            p_until_date: todayStr,
          }),
          supabase
            .from('transactions')
            .select('*')
            .eq('family_id', family.id)
            .eq('is_installment', true)
            .gt('transaction_date', todayStr)
            .neq('status', 'projected'),
          supabase.from('goals').select('*').eq('family_id', family.id),
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
        const income = Number(saldoRow?.total_income_cents) || 0
        const expense = Number(saldoRow?.total_expense_cents) || 0
        setSaldoCents(income - expense)

        setParcelasFuturas((parcelasRes.data || []) as Transaction[])
        setMetas((metasRes.data || []) as Goal[])

        // média mensal de gastos VARIÁVEIS (3 meses fechados): exclui recorrentes
        // (entram pela própria regra) e parcelas (entram pela série) — senão o
        // mesmo valor seria contado duas vezes no mês.
        const rows = (gastosRes.data || []).filter(
          (r: any) => !r.recurring_income_id && !r.is_installment,
        )
        const totalGastos = rows.reduce(
          (acc: number, r: any) => acc + (Number(r.amount_cents) || 0),
          0,
        )
        setMediaGastosCents(Math.round(totalGastos / 3))
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
  }, [family?.id])

  const projection: ProjectionResult = useMemo(
    () =>
      buildProjection(
        saldoCents,
        recurringIncomes || [],
        parcelasFuturas,
        metas,
        mediaGastosCents,
        activeMonth,
        todayStrRef,
        12,
      ),
    [
      saldoCents,
      recurringIncomes,
      parcelasFuturas,
      metas,
      mediaGastosCents,
      activeMonth,
      todayStrRef,
    ],
  )

  const fmt = (cents: number) => (hideValues ? maskValue(formatBRL(cents)) : formatBRL(cents))

  // Escala do gráfico: maior valor absoluto da série
  const maxAbs = Math.max(
    1,
    ...projection.months.map((m) => Math.abs(m.saldoCents)),
    Math.abs(projection.saldoAtualCents),
  )

  const alerta = projection.primeiroMesApertado
  const apertado = projection.mesMaisApertado

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-3xl bg-slate-100 animate-pulse" />
        <div className="h-40 rounded-3xl bg-slate-100 animate-pulse" />
        <div className="h-24 rounded-3xl bg-slate-100 animate-pulse" />
      </div>
    )
  }

  const semDados =
    projection.commitments.length === 0 && projection.months.every((m) => m.entradasCents === 0)

  return (
    <div className="space-y-4 pb-2">
      {/* HERO: o número que ninguém mais mostra */}
      <div className="rounded-3xl bg-[#14213D] text-white p-5 shadow-curiango">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
          Seu dinheiro futuro
        </p>
        <p className="mt-1.5 text-3xl font-extrabold leading-none tracking-tight">
          {fmt(projection.totalComprometidoCents)}
        </p>
        <p className="mt-2 text-xs text-white/80 leading-snug">
          {projection.totalComprometidoCents > 0 ? (
            <>
              do seu dinheiro já tem dono
              {projection.comprometidoAte ? ` até ${projection.comprometidoAte}` : ''}.
            </>
          ) : (
            <>Nenhum compromisso futuro lançado ainda. Tudo livre por aqui.</>
          )}
        </p>
        <p className="mt-3 text-[10px] text-white/50 leading-snug">
          Com base nos seus lançamentos, contas fixas, parcelas e metas.
        </p>
      </div>

      {/* ALERTA EDUCATIVO: o mês que aperta */}
      {alerta ? (
        <div className="rounded-2xl border-l-[3px] border-l-amber-500 bg-amber-50/70 p-3.5 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#14213D] leading-snug">
              {alerta.label} vai apertar
            </p>
            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
              Pelo ritmo atual, seu saldo chega a {fmt(alerta.saldoCents)} nesse mês. Não é o fim do
              mundo — é só a hora de segurar um pouco antes.
            </p>
          </div>
        </div>
      ) : projection.totalComprometidoCents > 0 ? (
        <div className="rounded-2xl border-l-[3px] border-l-emerald-500 bg-emerald-50/60 p-3.5 flex gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#14213D] leading-snug">
              Seus próximos 12 meses cabem no orçamento
            </p>
            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
              O mês mais apertado é {apertado?.label}, com {fmt(apertado?.saldoCents || 0)} de saldo
              projetado. Continua positivo — bom sinal.
            </p>
          </div>
        </div>
      ) : null}

      {/* GRÁFICO DE 12 MESES: barras simples, sem eixos */}
      {!semDados && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-[#14213D]">Como fica seu saldo</h3>
            <span className="text-[10px] text-slate-400">12 meses</span>
          </div>
          <p className="text-[10px] text-slate-500 mb-3 leading-snug">
            Cada barra é o saldo previsto no fim daquele mês. Barra para baixo = mês apertado.
          </p>

          <div className="flex items-end justify-between gap-[3px] h-28">
            {projection.months.map((m) => {
              const h = Math.max(4, Math.round((Math.abs(m.saldoCents) / maxAbs) * 100))
              const negativo = m.saldoCents < 0
              const isApertado = apertado?.monthKey === m.monthKey
              return (
                <div
                  key={m.monthKey}
                  className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
                >
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      negativo ? 'bg-red-400' : isApertado ? 'bg-amber-400' : 'bg-emerald-400/80'
                    }`}
                    style={{ height: `${h}%` }}
                    title={`${m.label}: ${fmt(m.saldoCents)}`}
                  />
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-[3px] mt-1.5">
            {projection.months.map((m, i) => (
              <div key={m.monthKey} className="flex-1 text-center min-w-0">
                <span
                  className={`text-[8px] font-medium leading-none ${
                    apertado?.monthKey === m.monthKey
                      ? 'text-amber-600 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {i % 2 === 0 ? m.label : ''}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-emerald-400/80" />
              <span className="text-[10px] text-slate-500">tranquilo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-amber-400" />
              <span className="text-[10px] text-slate-500">mais apertado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-red-400" />
              <span className="text-[10px] text-slate-500">no vermelho</span>
            </div>
          </div>
        </div>
      )}

      {/* LISTA: quem come seu futuro */}
      {projection.commitments.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4">
          <h3 className="text-xs font-bold text-[#14213D] mb-0.5">Quem já tem seu dinheiro</h3>
          <p className="text-[10px] text-slate-500 mb-3 leading-snug">
            Da maior para a menor cobrança mensal.
          </p>
          <ul className="space-y-2.5">
            {projection.commitments.slice(0, 6).map((c) => (
              <CommitmentRow key={c.id} c={c} fmt={fmt} />
            ))}
          </ul>
          {projection.commitments.length > 6 && (
            <p className="text-[10px] text-slate-400 mt-3 text-center">
              + {projection.commitments.length - 6} outros compromissos menores
            </p>
          )}
        </div>
      )}

      {/* ESTADO VAZIO EDUCATIVO */}
      {semDados && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center">
          <CalendarClock className="w-7 h-7 text-slate-400 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-xs font-semibold text-[#14213D] mb-1">
            Ainda não tenho o que projetar
          </p>
          <p className="text-[11px] text-slate-500 leading-snug">
            Quando você lançar uma conta fixa (aluguel, assinatura) ou uma compra parcelada, eu
            mostro aqui quanto do seu dinheiro futuro já está comprometido.
          </p>
        </div>
      )}

      {/* UMA AÇÃO SÓ — educativo */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-3.5 flex gap-2.5">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={1.8} />
        <div className="min-w-0">
          <p className="text-[11px] text-slate-600 leading-snug">
            <span className="font-semibold text-[#14213D]">Como isso funciona:</span> eu pego tudo
            que você já lançou — contas fixas, parcelas e metas — e somo mês a mês. Não é
            adivinhação: é o seu próprio dinheiro já prometido.
          </p>
          <button
            type="button"
            onClick={() => navigate('/copilot')}
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#14213D] hover:text-[#FCA311] transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3" strokeWidth={2} />
            Perguntar ao Curiango
          </button>
        </div>
      </div>
    </div>
  )
}

function CommitmentRow({ c, fmt }: { c: FutureCommitment; fmt: (n: number) => string }) {
  const Icon = c.origin === 'parcela' ? CreditCard : c.origin === 'meta' ? Target : Repeat
  const originLabel =
    c.origin === 'parcela' ? 'Parcela' : c.origin === 'meta' ? 'Meta' : 'Conta fixa'
  // FIX (27/10, achado na prova visual): a formatação anterior montava
  // "até 2027/27". Agora usa o label canônico do serviço (dez/27).
  const ateTxt = c.ateQuando ? `até ${monthLabelOf(c.ateQuando)}` : 'todo mês'

  return (
    <li className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-[#14213D] truncate leading-tight">{c.nome}</p>
        <p className="text-[10px] text-slate-500 leading-tight">
          {originLabel} · {ateTxt}
        </p>
      </div>
      <span className="text-[11px] font-bold text-[#14213D] shrink-0 tabular-nums">
        {fmt(c.valorCents)}
        <span className="text-[9px] font-medium text-slate-400">/mês</span>
      </span>
    </li>
  )
}
