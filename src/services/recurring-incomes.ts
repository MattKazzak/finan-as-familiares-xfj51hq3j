// Serviço de Receitas Fixas Recorrentes Mensais
import { supabase } from '@/lib/supabase/client'
import type {
  RecurringIncome,
  RecurringIncomeOverride,
  EffectiveRecurringIncome,
  Transaction,
} from '@/types/finance'

// 1. Buscar todas as receitas fixas da família
export async function fetchRecurringIncomes(familyId: string) {
  const { data, error } = await (supabase as any)
    .from('recurring_incomes')
    .select(`
      *,
      member:family_members(*),
      category:transaction_categories(*),
      subcategory:transaction_subcategories(*)
    `)
    .eq('family_id', familyId)
    .order('day_of_month', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as RecurringIncome[]
}

// 2. Buscar overrides/exceções de receitas fixas para determinado mês
export async function fetchRecurringIncomeOverrides(familyId: string, monthStr: string) {
  const monthDate = `${monthStr}-01`
  const { data, error } = await (supabase as any)
    .from('recurring_income_overrides')
    .select('*')
    .eq('family_id', familyId)
    .eq('month', monthDate)

  if (error) throw error
  return (data || []) as RecurringIncomeOverride[]
}

// 3. Criar nova receita fixa recorrente
export async function createRecurringIncome(payload: {
  family_id: string
  member_id: string
  category_id?: string | null
  subcategory_id?: string | null
  name: string
  amount_cents: number
  day_of_month: number
}) {
  const { data, error } = await (supabase as any)
    .from('recurring_incomes')
    .insert({
      family_id: payload.family_id,
      member_id: payload.member_id,
      category_id: payload.category_id || null,
      subcategory_id: payload.subcategory_id || null,
      name: payload.name.trim(),
      amount_cents: payload.amount_cents,
      day_of_month: Math.max(1, Math.min(31, payload.day_of_month)),
      active: true,
    })
    .select(`
      *,
      member:family_members(*),
      category:transaction_categories(*),
      subcategory:transaction_subcategories(*)
    `)
    .single()

  if (error) throw error
  return data as RecurringIncome
}

// 4. Atualizar dados gerais da receita fixa (padrão)
export async function updateRecurringIncome(
  id: string,
  payload: Partial<{
    member_id: string
    category_id: string | null
    subcategory_id: string | null
    name: string
    amount_cents: number
    day_of_month: number
    active: boolean
  }>,
) {
  const cleanPayload: any = { ...payload }
  if (cleanPayload.name) cleanPayload.name = cleanPayload.name.trim()
  if (cleanPayload.day_of_month) {
    cleanPayload.day_of_month = Math.max(1, Math.min(31, cleanPayload.day_of_month))
  }

  const { data, error } = await (supabase as any)
    .from('recurring_incomes')
    .update(cleanPayload)
    .eq('id', id)
    .select(`
      *,
      member:family_members(*),
      category:transaction_categories(*),
      subcategory:transaction_subcategories(*)
    `)
    .single()

  if (error) throw error
  return data as RecurringIncome
}

// 5. Excluir receita fixa (com opção de apagar todas as geradas ou manter as já geradas)
export async function deleteRecurringIncome(
  id: string,
  deleteGeneratedTransactions: boolean = false,
) {
  if (deleteGeneratedTransactions) {
    await (supabase as any).from('transactions').delete().eq('recurring_income_id', id)
  } else {
    // Apenas desassocia mantendo as transações intactas
    await (supabase as any)
      .from('transactions')
      .update({ recurring_income_id: null })
      .eq('recurring_income_id', id)
  }

  const { error } = await (supabase as any).from('recurring_incomes').delete().eq('id', id)
  if (error) throw error
}

// 6. Definir exceção/ajuste pontual deste mês para uma receita fixa
export async function upsertRecurringIncomeOverride(
  familyId: string,
  recurringIncomeId: string,
  monthStr: string,
  amountCents: number,
) {
  const monthDate = `${monthStr}-01`
  const { data: existing } = await (supabase as any)
    .from('recurring_income_overrides')
    .select('id')
    .eq('recurring_income_id', recurringIncomeId)
    .eq('month', monthDate)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await (supabase as any)
      .from('recurring_income_overrides')
      .update({ amount_cents: amountCents })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data as RecurringIncomeOverride
  } else {
    const { data, error } = await (supabase as any)
      .from('recurring_income_overrides')
      .insert({
        family_id: familyId,
        recurring_income_id: recurringIncomeId,
        month: monthDate,
        amount_cents: amountCents,
      })
      .select()
      .single()
    if (error) throw error
    return data as RecurringIncomeOverride
  }
}

// 7. Remover exceção pontual (voltar ao valor padrão recorrente)
export async function resetRecurringIncomeToDefault(recurringIncomeId: string, monthStr: string) {
  const monthDate = `${monthStr}-01`
  const { error } = await (supabase as any)
    .from('recurring_income_overrides')
    .delete()
    .eq('recurring_income_id', recurringIncomeId)
    .eq('month', monthDate)

  if (error) throw error
}

/**
 * Utilitário: calcula a data YYYY-MM-DD para um dia no mês informado.
 * Se o mês não possuir aquele dia (ex: dia 31 em fevereiro ou abril),
 * ajusta com segurança para o último dia do respectivo mês.
 */
export function getSafeDateForMonth(monthStr: string, day: number): string {
  const [yearStr, monthNumStr] = monthStr.split('-')
  const year = parseInt(yearStr, 10)
  const monthIndex = parseInt(monthNumStr, 10) - 1 // 0-based

  // Último dia do mês (dia 0 do mês seguinte)
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const safeDay = Math.min(Math.max(1, day), lastDay)
  const dayPadded = String(safeDay).padStart(2, '0')
  return `${monthStr}-${dayPadded}`
}

/**
 * AUTO-LANÇAMENTO IDEMPOTENTE
 * Regra do usuário:
 * "ao entrar num mês (ou ao abrir o app), as receitas fixas cujo dia já passou no mês corrente
 * e que ainda não geraram transação naquele mês devem gerar a transação automaticamente (idempotente —
 * uma única transação por receita fixa por mês, marcada como 'fixa'/recorrente, com referência à receita fixa
 * de origem para permitir regeneração segura e exclusão em cadeia)"
 *
 * Também permite forçar geração manual antecipada se o usuário desejar.
 */
export async function processAutoRecurringIncomes(params: {
  familyId: string
  targetMonthStr?: string // formato YYYY-MM. Defaults para o mês atual
  forceAllDays?: boolean // Se true, gera mesmo que o dia não tenha chegado ainda
}): Promise<{ generatedCount: number; errors: string[] }> {
  const now = new Date()
  const currentMonthStr = params.targetMonthStr || now.toISOString().slice(0, 7)
  const todayDay = now.getDate()
  const monthDate = `${currentMonthStr}-01`

  // 1. Buscar receitas fixas ativas
  const recurringIncomes = await fetchRecurringIncomes(params.familyId)
  const activeIncomes = recurringIncomes.filter((item) => item.active)

  if (activeIncomes.length === 0) {
    return { generatedCount: 0, errors: [] }
  }

  // 2. Buscar overrides deste mês
  const overrides = await fetchRecurringIncomeOverrides(params.familyId, currentMonthStr)
  const overrideMap = new Map<string, number>()
  overrides.forEach((o) => overrideMap.set(o.recurring_income_id, o.amount_cents))

  // 3. Buscar transações já existentes no mês com vínculo
  const { data: existingTransactions, error: txError } = await (supabase as any)
    .from('transactions')
    .select('id, recurring_income_id, recurring_month')
    .eq('family_id', params.familyId)
    .eq('recurring_month', monthDate)

  if (txError) {
    console.error('Erro ao verificar transações recorrentes existentes:', txError)
    throw txError
  }

  const existingMap = new Set<string>()
  ;(existingTransactions || []).forEach((tx: any) => {
    if (tx.recurring_income_id) {
      existingMap.add(tx.recurring_income_id)
    }
  })

  // Determinar se estamos no mês corrente, mês passado ou mês futuro
  const systemMonthStr = now.toISOString().slice(0, 7)
  const isPastMonth = currentMonthStr < systemMonthStr
  const isCurrentMonth = currentMonthStr === systemMonthStr

  let generatedCount = 0
  const errors: string[] = []

  for (const income of activeIncomes) {
    // Se já foi gerada neste mês, pula
    if (existingMap.has(income.id)) {
      continue
    }

    // Regra de timing:
    // Se for mês passado, o dia com certeza já passou.
    // Se for mês corrente, gera se todayDay >= income.day_of_month OU se forceAllDays for true.
    // Se for mês futuro, só gera se forceAllDays for true.
    const shouldGenerate =
      params.forceAllDays || isPastMonth || (isCurrentMonth && todayDay >= income.day_of_month)

    if (!shouldGenerate) {
      continue
    }

    // Valor efetivo (respeitando override deste mês)
    const amountCents = overrideMap.has(income.id)
      ? overrideMap.get(income.id)!
      : income.amount_cents

    if (amountCents <= 0) {
      // Valor zero indica que o usuário desativou a receita neste mês específico
      continue
    }

    const txDate = getSafeDateForMonth(currentMonthStr, income.day_of_month)

    try {
      const { error: insertErr } = await (supabase as any).from('transactions').insert({
        family_id: params.familyId,
        member_id: income.member_id,
        category_id: income.category_id || null,
        subcategory_id: income.subcategory_id || null,
        type: 'income',
        amount_cents: amountCents,
        description: income.name,
        transaction_date: txDate,
        recurring_income_id: income.id,
        is_recurring: true,
        recurring_month: monthDate,
      })

      if (insertErr) {
        // Se bater no índice único (idempotência a nível de banco), ignora erro de duplicidade
        if (insertErr.code === '23505') {
          existingMap.add(income.id)
          continue
        }
        console.error(`Erro ao auto-lançar receita fixa ${income.name}:`, insertErr)
        errors.push(insertErr.message)
      } else {
        generatedCount += 1
        existingMap.add(income.id)
      }
    } catch (e: any) {
      console.error(e)
      errors.push(e.message || 'Erro inesperado')
    }
  }

  return { generatedCount, errors }
}
