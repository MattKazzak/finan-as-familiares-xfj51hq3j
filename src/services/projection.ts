/**
 * MOTOR DE PROJEÇÃO FINANCEIRA — Carteira › Projeção (27/10, ordem do Matheus)
 *
 * FILOSOFIA (usuário leigo, app educativo):
 * - 1 número gigante: "R$ X do seu dinheiro futuro já tem dono"
 * - Linha do saldo em 12 meses, sem jargão: mês apertado = âmbar + frase pronta
 * - Lista "quem come seu futuro": cada compromisso com origem e data-fim
 * - Máx 1 ação por visita — o Curiango prepara, o usuário aprova (Caminho B, Ação 5)
 *
 * HONESTIDADE: projeção baseada só no que o usuário lançou (recorrentes +
 * parcelas + metas + média de gastos). A UI SEMPRE diz "com base nos seus
 * lançamentos" — mesmo padrão do YNAB, sem Open Finance.
 */

import type { RecurringIncome, Transaction, Goal } from '@/types/finance'

export type CommitmentOrigin = 'recorrente' | 'parcela' | 'meta' | 'divida'

export interface FutureCommitment {
  id: string
  nome: string
  valorCents: number
  /** YYYY-MM do último compromisso (null = indeterminado, ex: assinatura) */
  ateQuando: string | null
  origin: CommitmentOrigin
  /** Número de meses em que ainda vai cobrar (para o total comprometido) */
  mesesRestantes: number
}

export interface ProjectionMonth {
  /** YYYY-MM */
  monthKey: string
  label: string // "nov/26"
  entradasCents: number
  saidasCents: number
  saldoCents: number // acumulado a partir do saldo atual
}

export interface ProjectionResult {
  /** Saldo real de hoje (última transação confirmada acumulada) */
  saldoAtualCents: number
  /** Total do dinheiro futuro já comprometido (soma de todos os meses) */
  totalComprometidoCents: number
  /** Até quando vai o compromisso mais distante (label) */
  comprometidoAte: string | null
  months: ProjectionMonth[]
  commitments: FutureCommitment[]
  /** Primeiro mês projetado no vermelho (saldo < 0) — o alerta-chave */
  primeiroMesApertado: ProjectionMonth | null
  /** Mês com menor saldo (mesmo positivo) — o "mais apertado" */
  mesMaisApertado: ProjectionMonth | null
}

const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabelOf(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${MONTH_LABELS[m - 1]}/${String(y).slice(2)}`
}

function addMonths(monthKey: string, n: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return monthKeyOf(d)
}

/**
 * Calcula a projeção de 12 meses a partir do mês ativo.
 *
 * @param saldoAtualCents  saldo real acumulado até hoje (fonte: get_family_balance_until / Home)
 * @param recorrentes     contas fixas ativas (entradas e saídas)
 * @param parcelasFuturas transações is_installment com data >= mês ativo
 * @param metas           metas com aporte mensal estimado
 * @param mediaGastosCents média de gastos variáveis dos últimos 3 meses (fallback
 *                        quando a família não lança tudo como recorrente)
 */
export function buildProjection(
  saldoAtualCents: number,
  recorrentes: RecurringIncome[],
  parcelasFuturas: Transaction[],
  metas: Goal[],
  mediaGastosCents: number,
  startingMonthKey: string,
  horizonteMeses = 12,
): ProjectionResult {
  const months: ProjectionMonth[] = []
  const commitMap = new Map<string, FutureCommitment>()

  // Saldo acumulado começa no real
  let running = saldoAtualCents

  // Parcelas futuras agrupadas por mês
  const parcelasPorMes = new Map<string, number>()
  for (const tx of parcelasFuturas) {
    const mk = (tx.transaction_date || '').slice(0, 7)
    if (mk < startingMonthKey) continue // retroativas já entraram no saldo atual
    const amt = Number(tx.amount_cents) || 0
    parcelasPorMes.set(mk, (parcelasPorMes.get(mk) || 0) + amt)
  }

  // Compromissos de parcela (agrupados por grupo = uma linha na lista)
  const parcelaGrupos = new Map<string, FutureCommitment>()
  for (const tx of parcelasFuturas) {
    const key = (tx as any).installment_group_id || tx.id
    const mk = (tx.transaction_date || '').slice(0, 7)
    if (mk < startingMonthKey) continue
    const existing = parcelaGrupos.get(key)
    const amt = Number(tx.amount_cents) || 0
    if (existing) {
      existing.mesesRestantes += 1
      existing.ateQuando = mk > (existing.ateQuando || '') ? mk : existing.ateQuando
      // valor mensal = valor de UMA parcela (todas iguais na série do Copilot)
    } else {
      parcelaGrupos.set(key, {
        id: key,
        nome: tx.description || 'Compra parcelada',
        valorCents: amt,
        ateQuando: mk,
        origin: 'parcela',
        mesesRestantes: 1,
      })
    }
  }

  // Recorrentes: entradas e saídas por mês
  const recEntradas = new Map<string, number>()
  const recSaidas = new Map<string, number>()
  for (const rec of recorrentes) {
    if (!rec.active) continue
    const amt = Number(rec.amount_cents) || 0
    const isExpense = rec.type === 'expense'
    // CORREÇÃO (27/10, achada na prova visual): RECEITA NÃO É COMPROMISSO.
    // O salário entra no fluxo do mês (recEntradas), mas nunca na lista
    // "quem já tem seu dinheiro" nem no total comprometido — senão o número
    // gigante somava o que a família VAI RECEBER como se fosse dívida.
    if (isExpense) {
      commitMap.set(`rec-${rec.id}`, {
        id: `rec-${rec.id}`,
        nome: rec.name,
        valorCents: amt,
        ateQuando: null, // indeterminado (aluguel, assinatura, conta fixa)
        origin: 'recorrente' as CommitmentOrigin,
        mesesRestantes: horizonteMeses,
      })
    }
    for (let i = 0; i < horizonteMeses; i++) {
      const mk = addMonths(startingMonthKey, i)
      if (isExpense) recSaidas.set(mk, (recSaidas.get(mk) || 0) + amt)
      else recEntradas.set(mk, (recEntradas.get(mk) || 0) + amt)
    }
  }

  // Metas: aporte mensal estimado até o prazo (ou até o horizonte)
  const metaSaidas = new Map<string, number>()
  for (const goal of metas) {
    const target = Number(goal.target_amount_cents) || 0
    const deadlineMk = (goal.deadline || '').slice(0, 7)
    if (target <= 0) continue
    // aporte mensal = total / meses restantes até prazo (mín. 1 mês)
    let mesesAtePrazo = 1
    if (deadlineMk >= startingMonthKey) {
      const [y0, m0] = startingMonthKey.split('-').map(Number)
      const [y1, m1] = deadlineMk.split('-').map(Number)
      mesesAtePrazo = Math.max(1, (y1 - y0) * 12 + (m1 - m0) + 1)
    }
    const aporte = Math.round(target / mesesAtePrazo)
    const ateMk =
      deadlineMk >= startingMonthKey ? deadlineMk : addMonths(startingMonthKey, horizonteMeses - 1)
    commitMap.set(`meta-${goal.id}`, {
      id: `meta-${goal.id}`,
      nome: `Meta: ${goal.name}`,
      valorCents: aporte,
      ateQuando: ateMk,
      origin: 'meta',
      mesesRestantes: Math.min(mesesAtePrazo, horizonteMeses),
    })
    for (let i = 0; i < Math.min(mesesAtePrazo, horizonteMeses); i++) {
      const mk = addMonths(startingMonthKey, i)
      metaSaidas.set(mk, (metaSaidas.get(mk) || 0) + aporte)
    }
  }

  // Série mensal
  for (let i = 0; i < horizonteMeses; i++) {
    const mk = addMonths(startingMonthKey, i)
    const entradas = recEntradas.get(mk) || 0
    const saidas =
      (recSaidas.get(mk) || 0) + (parcelasPorMes.get(mk) || 0) + (metaSaidas.get(mk) || 0)
    // Gastos variáveis: média dos últimos meses como compromisso contínuo
    const variaveis = mediaGastosCents
    running += entradas - saidas - variaveis
    months.push({
      monthKey: mk,
      label: monthLabelOf(mk),
      entradasCents: entradas,
      saidasCents: saidas + variaveis,
      saldoCents: running,
    })
  }

  // Total comprometido = saídas fixas + parcelas + metas (NÃO conta gasto variável estimado)
  let totalComprometido = 0
  const commitments: FutureCommitment[] = []
  for (const c of commitMap.values()) {
    totalComprometido += c.valorCents * c.mesesRestantes
    commitments.push(c)
  }
  for (const g of parcelaGrupos.values()) {
    totalComprometido += g.valorCents * g.mesesRestantes
    commitments.push(g)
  }
  commitments.sort((a, b) => b.valorCents * b.mesesRestantes - a.valorCents * a.mesesRestantes)

  const comprometidoAte =
    commitments.length > 0
      ? monthLabelOf(
          commitments.reduce(
            (acc, c) => (c.ateQuando && c.ateQuando > acc ? c.ateQuando : acc),
            '0000-00',
          ),
        )
      : null

  const primeiroMesApertado = months.find((m) => m.saldoCents < 0) || null
  const mesMaisApertado =
    months.length > 0
      ? months.reduce((acc, m) => (m.saldoCents < acc.saldoCents ? m : acc), months[0])
      : null

  return {
    saldoAtualCents,
    totalComprometidoCents: totalComprometido,
    comprometidoAte,
    months,
    commitments,
    primeiroMesApertado,
    mesMaisApertado,
  }
}
