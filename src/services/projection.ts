/**
 * MOTOR DE PROJEÇÃO FINANCEIRA — Carteira › Projeção (27/10, ordem do Matheus)
 *
 * FILOSOFIA (usuário leigo, app educativo):
 * - 1 número gigante: "R$ X do seu dinheiro futuro já tem dono"
 * - Série de 12 meses, sem jargão: mês apertado = âmbar + frase pronta
 * - Lista "quem come seu futuro": cada compromisso com origem e data-fim
 * - Máx 1 ação por visita — o Curiango prepara, o usuário aprova (Caminho B, Ação 5)
 *
 * HONESTIDADE: projeção baseada só no que o usuário lançou (recorrentes +
 * parcelas + metas + média de gastos). A UI SEMPRE diz "com base nos seus
 * lançamentos" — mesmo padrão do YNAB, sem Open Finance.
 *
 * REGRAS DE EXATIDÃO (27/10 — corrigidas após auditoria do próprio motor):
 * 1. O saldo base é o saldo ATÉ HOJE (nunca o total global): assim as parcelas e
 *    contas fixas que ainda vão cair NÃO entram duas vezes.
 * 2. Toda parcela usada na projeção tem data > hoje. Nenhuma parcela já paga
 *    entra de novo na conta.
 * 3. No MÊS CORRENTE só conta o que ainda não passou: recorrente com
 *    day_of_month > dia de hoje, parcelas com data > hoje; a média de gastos
 *    variáveis não entra (já está refletida no saldo de hoje).
 * 4. A média de gastos variáveis ignora o que é recorrente e o que é parcela
 *    (senão esses valores seriam somados duas vezes).
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
  saldoCents: number // acumulado a partir do saldo de hoje
}

/** Um compromisso DENTRO de um mês específico — é o que a lista mostra. */
export interface ProjectionItem {
  nome: string
  valorCents: number
  origin: CommitmentOrigin
  /** Dia do mês em que cai (1-31), quando conhecido */
  dia: number | null
  /** Rótulo curto de contexto: "3 de 6", "4ª de 6", "conta fixa" */
  detalhe: string
}

export interface ProjectionResult {
  /** Saldo real até hoje (transações confirmadas com data <= hoje) */
  saldoAtualCents: number
  /** Total do dinheiro futuro já comprometido (soma de todos os meses) */
  totalComprometidoCents: number
  /** Até quando vai o compromisso mais distante (label) */
  comprometidoAte: string | null
  /** Soma mensal das contas fixas — a leitura "por mês", que o leigo entende */
  totalMensalFixo: number
  months: ProjectionMonth[]
  /** Itens mês a mês, para a lista navegável (padrão Monarch "Upcoming"). */
  itensPorMes: Record<string, ProjectionItem[]>
  /** Total de compromissos do mês ativo — o número grande do topo. */
  totalMesAtivoCents: number
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
 * @param saldoAtualCents   saldo real ATÉ HOJE (RPC get_family_balance_until com a data de hoje)
 * @param recorrentes       contas fixas ativas (entradas e saídas)
 * @param parcelasFuturas   transações is_installment com data > HOJE (nenhuma já paga)
 * @param metas             metas já enriquecidas com `progressoCents` (soma das
 *                          receitas da categoria vinculada) e, opcionalmente,
 *                          `aporteMensalCents` (o que o usuário declarou guardar) * @param mediaGastosCents  média mensal de gastos VARIÁVEIS (sem recorrentes, sem parcelas)
 * @param startingMonthKey  mês ativo (YYYY-MM)
 * @param todayStr          data de hoje (YYYY-MM-DD) — separa o que já caiu do que ainda vai cair
 */
export function buildProjection(
  saldoAtualCents: number,
  recorrentes: RecurringIncome[],
  parcelasFuturas: Transaction[],
  metas: Goal[],
  mediaGastosCents: number,
  startingMonthKey: string,
  todayStr: string,
  horizonteMeses = 12,
): ProjectionResult {
  const months: ProjectionMonth[] = []
  const commitMap = new Map<string, FutureCommitment>()

  const todayDay = Number(todayStr.slice(8, 10)) || 1
  const thisMonthKey = todayStr.slice(0, 7)

  let running = saldoAtualCents

  // ── Lançamentos futuros: parcelas E contas já agendadas ───────────────────
  //
  // CONVERSA COM O APP (27/10): antes eu só olhava `is_installment`. Uma conta
  // já lançada com data futura (ex.: IPVA em jan/27, mensalidade agendada) é
  // dinheiro REALMENTE comprometido e ficava de fora — a projeção mentia por
  // omissão. Agora todo lançamento futuro entra: parcela agrupa a série,
  // lançamento avulso conta sozinho.
  const parcelasPorMes = new Map<string, number>()
  const parcelaGrupos = new Map<string, FutureCommitment>()

  for (const tx of parcelasFuturas) {
    const mk = (tx.transaction_date || '').slice(0, 7)
    if (mk < startingMonthKey) continue // segurança: nada anterior ao mês ativo
    const amt = Number(tx.amount_cents) || 0
    if (amt <= 0) continue
    const isEntrada = tx.type === 'income'
    parcelasPorMes.set(mk, (parcelasPorMes.get(mk) || 0) + (isEntrada ? -amt : amt))
    // Receita futura já lançada não é compromisso — entra só no fluxo do mês.
    if (isEntrada) continue

    const instalment = Boolean((tx as any).is_installment)
    const key = instalment ? (tx as any).installment_group_id || tx.id : `avulso-${tx.id}`
    const existing = parcelaGrupos.get(key)
    if (existing) {
      existing.mesesRestantes += 1
      existing.ateQuando = mk > (existing.ateQuando || '') ? mk : existing.ateQuando
    } else {
      parcelaGrupos.set(key, {
        id: key,
        nome: tx.description || (instalment ? 'Compra parcelada' : 'Conta agendada'),
        valorCents: amt,
        ateQuando: mk,
        origin: instalment ? 'parcela' : 'divida',
        mesesRestantes: 1,
      })
    }
  }

  // ── Recorrentes: fluxo por mês + compromisso (só despesa) ─────────────────
  const recEntradas = new Map<string, number>()
  const recSaidas = new Map<string, number>()

  for (const rec of recorrentes) {
    if (!rec.active) continue
    const amt = Number(rec.amount_cents) || 0
    const isExpense = rec.type === 'expense'
    if (amt <= 0) continue

    // RECEITA NUNCA É COMPROMISSO (correção 27/10): entra no fluxo do mês,
    // jamais na lista "quem já tem seu dinheiro" nem no total comprometido.
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

    const diaCobranca = Number(rec.day_of_month) || 1
    for (let i = 0; i < horizonteMeses; i++) {
      const mk = addMonths(startingMonthKey, i)
      // MÊS CORRENTE: só conta o que ainda não caiu (dia da cobrança > hoje).
      // O que já passou está dentro do saldo de hoje — contar de novo inflaria.
      if (mk === thisMonthKey && diaCobranca <= todayDay) continue
      if (isExpense) recSaidas.set(mk, (recSaidas.get(mk) || 0) + amt)
      else recEntradas.set(mk, (recEntradas.get(mk) || 0) + amt)
    }
  }

  // ── Metas: só entram quando o usuário DECLARA o aporte mensal ─────────────
  //
  // DECISÃO DE PRODUTO (27/10, auditoria do motor): uma meta não é dívida — é
  // intenção. Tratá-la como compromisso automático inventava dinheiro que
  // ninguém prometeu (a Reserva de Emergência de R$ 5.000 virava R$ 8.100 de
  // "dinheiro já comprometido" em 12 meses). Agora a meta entra na projeção
  // SÓ quando o usuário diz "quero guardar X por mês" (a ação de 1 toque).
  // A tela de Metas avisa quando o ritmo declarado não chega ao prazo.
  const metaSaidas = new Map<string, number>()

  for (const goal of metas) {
    const target = Number(goal.target_amount_cents) || 0
    // Progresso da meta = soma das RECEITAS da categoria vinculada (mesma regra
    // da tela de Metas). `current_amount_cents` não existe em goals — ler esse
    // campo devolvia sempre 0 e fazia a meta parecer 100% pendente.
    const current = Number(goal.progressoCents) || 0
    const falta = Math.max(0, target - current)
    if (falta <= 0) continue
    // Sem aporte declarado não há compromisso — a meta é só uma intenção.
    const aporteDeclarado = Number(goal.aporteMensalCents) || 0
    if (aporteDeclarado <= 0) continue

    const deadlineMk = (goal.deadline || '').slice(0, 7)
    let mesesAtePrazo = horizonteMeses
    if (deadlineMk >= startingMonthKey) {
      const [y0, m0] = startingMonthKey.split('-').map(Number)
      const [y1, m1] = deadlineMk.split('-').map(Number)
      mesesAtePrazo = Math.max(1, (y1 - y0) * 12 + (m1 - m0) + 1)
    }
    // AÇÃO DE 1 TOQUE (27/10): o valor é SEMPRE o que o usuário declarou —
    // a projeção nunca adivinha aporte pelo prazo.
    const aporte = aporteDeclarado

    const mesesNoHorizonte = Math.min(mesesAtePrazo, horizonteMeses)
    const ateMk =
      deadlineMk >= startingMonthKey ? deadlineMk : addMonths(startingMonthKey, horizonteMeses - 1)

    commitMap.set(`meta-${goal.id}`, {
      id: `meta-${goal.id}`,
      nome: `Meta: ${goal.name}`,
      valorCents: aporte,
      ateQuando: ateMk,
      origin: 'meta',
      mesesRestantes: mesesNoHorizonte,
    })

    for (let i = 0; i < mesesNoHorizonte; i++) {
      const mk = addMonths(startingMonthKey, i)
      // Mês corrente: o aporte do mês ou já saiu (está no saldo) ou ainda vai
      // sair — não temos o dia, então não contamos (conservador, nunca otimista).
      if (mk === thisMonthKey) continue
      metaSaidas.set(mk, (metaSaidas.get(mk) || 0) + aporte)
    }
  }

  // ── Itens mês a mês (a lista que o usuário lê) ───────────────────────────
  //
  // PADRÃO MONARCH "Upcoming" (pesquisa 27/10): o leigo entende LISTA, não
  // gráfico de 12 meses. Cada mês mostra nome, valor, dia e de que se trata.
  const itensPorMes: Record<string, ProjectionItem[]> = {}
  for (let i = 0; i < horizonteMeses; i++) {
    itensPorMes[addMonths(startingMonthKey, i)] = []
  }

  // Recorrentes (conta fixa): dia conhecido
  for (const rec of recorrentes) {
    if (!rec.active) continue
    const amt = Number(rec.amount_cents) || 0
    if (amt <= 0 || rec.type !== 'expense') continue
    const dia = Number(rec.day_of_month) || null
    // Quantos meses essa conta já existe, para o rótulo "conta fixa"
    for (let i = 0; i < horizonteMeses; i++) {
      const mk = addMonths(startingMonthKey, i)
      if (mk === thisMonthKey && dia && dia <= todayDay) continue
      itensPorMes[mk]?.push({
        nome: rec.name,
        valorCents: amt,
        origin: 'recorrente',
        dia,
        detalhe: 'conta fixa',
      })
    }
  }

  // Lançamentos futuros: parcelas com número, avulsos sozinhos
  for (const tx of parcelasFuturas) {
    const mk = (tx.transaction_date || '').slice(0, 7)
    if (mk < startingMonthKey) continue
    if (tx.type === 'income') continue
    const amt = Number(tx.amount_cents) || 0
    if (amt <= 0) continue
    const dia = Number((tx.transaction_date || '').slice(8, 10)) || null
    const numero = Number((tx as any).installment_number) || 0
    const total = Number((tx as any).installment_total) || 0
    itensPorMes[mk]?.push({
      nome: tx.description || 'Lançamento',
      valorCents: amt,
      origin: (tx as any).is_installment ? 'parcela' : 'divida',
      dia,
      detalhe:
        (tx as any).is_installment && numero > 0 && total > 0 ? `${numero} de ${total}` : 'uma vez',
    })
  }

  // Metas com aporte declarado
  for (const goal of metas) {
    const aporteDeclarado = Number(goal.aporteMensalCents) || 0
    if (aporteDeclarado <= 0) continue
    const falta = Math.max(
      0,
      (Number(goal.target_amount_cents) || 0) - (Number(goal.progressoCents) || 0),
    )
    if (falta <= 0) continue
    const deadlineMk = (goal.deadline || '').slice(0, 7)
    for (let i = 0; i < horizonteMeses; i++) {
      const mk = addMonths(startingMonthKey, i)
      if (mk === thisMonthKey) continue
      if (deadlineMk && mk > deadlineMk) continue
      itensPorMes[mk]?.push({
        nome: `Guardar: ${goal.name}`,
        valorCents: aporteDeclarado,
        origin: 'meta',
        dia: null,
        detalhe: 'aporte do mês',
      })
    }
  }

  // Ordena cada mês: maior valor primeiro, itens sem dia ao fim
  const totalPorMes: Record<string, number> = {}
  for (const mk of Object.keys(itensPorMes)) {
    itensPorMes[mk].sort((a, b) => b.valorCents - a.valorCents)
    totalPorMes[mk] = itensPorMes[mk].reduce((acc, it) => acc + it.valorCents, 0)
  }
  const totalMesAtivoCents = totalPorMes[startingMonthKey] || 0

  // ── Série mensal ──────────────────────────────────────────────────────────
  for (let i = 0; i < horizonteMeses; i++) {
    const mk = addMonths(startingMonthKey, i)
    const entradas = recEntradas.get(mk) || 0
    const fixas =
      (recSaidas.get(mk) || 0) + (parcelasPorMes.get(mk) || 0) + (metaSaidas.get(mk) || 0)
    // Média de gastos variáveis: já está dentro do saldo de hoje no mês corrente.
    const variaveis = mk === thisMonthKey ? 0 : mediaGastosCents

    running += entradas - fixas - variaveis
    months.push({
      monthKey: mk,
      label: monthLabelOf(mk),
      entradasCents: entradas,
      saidasCents: fixas + variaveis,
      saldoCents: running,
    })
  }

  // ── Total comprometido (só despesas fixas + parcelas + metas) ─────────────
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

  // O rótulo "até X" só é honesto quando TODOS os compromissos têm fim previsto.
  // Com conta fixa (recorrente) na lista, o horizonte é sempre 12 meses — dizer
  // "até fev/27" olhando só as parcelas mentia sobre o número ao lado.
  const temRecorrenteSemFim = commitments.some((c) => c.ateQuando === null)
  const temRecorrente = Array.from(commitMap.values()).some((c) => c.origin === 'recorrente')
  // Soma mensal das contas fixas: dá ao usuário a leitura "por mês", que é como
  // ele pensa. O total de 12 meses sozinho é um número abstrato e assustador.
  const totalMensalFixo = Array.from(commitMap.values())
    .filter((c) => c.origin === 'recorrente')
    .reduce((acc, c) => acc + c.valorCents, 0)

  const comprometidoAte =
    commitments.length === 0
      ? null
      : temRecorrenteSemFim || temRecorrente
        ? monthLabelOf(addMonths(thisMonthKey, horizonteMeses - 1))
        : monthLabelOf(
            commitments.reduce(
              (acc, c) => (c.ateQuando && c.ateQuando > acc ? c.ateQuando : acc),
              '0000-00',
            ),
          )

  const primeiroMesApertado = months.find((m) => m.saldoCents < 0) || null
  const mesMaisApertado =
    months.length > 0
      ? months.reduce((acc, m) => (m.saldoCents < acc.saldoCents ? m : acc), months[0])
      : null

  return {
    saldoAtualCents,
    totalComprometidoCents: totalComprometido,
    comprometidoAte,
    totalMensalFixo,
    months,
    itensPorMes,
    totalMesAtivoCents,
    commitments,
    primeiroMesApertado,
    mesMaisApertado,
  }
}
