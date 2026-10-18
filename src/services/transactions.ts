// Serviço de Transações e Orçamentos
import { supabase } from '@/lib/supabase/client'
import type { Transaction, Budget, DefaultBudget } from '@/types/finance'

export interface TransactionFilter {
  familyId: string
  memberId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  type?: 'income' | 'expense' | null
  month?: string // YYYY-MM
  status?: 'confirmed' | 'projected' | null
  limit?: number
  offset?: number
}

export async function fetchTransactions(filter: TransactionFilter) {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      member:family_members(*),
      category:transaction_categories(*),
      subcategory:transaction_subcategories(*),
      recurring_income:recurring_incomes(*)
    `)
    .eq('family_id', filter.familyId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (filter.memberId) {
    query = query.eq('member_id', filter.memberId)
  }

  if (filter.categoryId) {
    query = query.eq('category_id', filter.categoryId)
  }

  if (filter.subcategoryId) {
    query = query.eq('subcategory_id', filter.subcategoryId)
  }

  if (filter.type) {
    query = query.eq('type', filter.type)
  }

  if (filter.status) {
    query = query.eq('status', filter.status)
  }

  if (filter.month) {
    const start = `${filter.month}-01`
    const nextMonthDate = new Date(`${filter.month}-01T12:00:00Z`)
    nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1)
    const end = nextMonthDate.toISOString().slice(0, 10)
    query = query.gte('transaction_date', start).lt('transaction_date', end)
  }

  if (filter.offset !== undefined && filter.limit !== undefined) {
    query = query.range(filter.offset, filter.offset + filter.limit - 1)
  } else if (filter.limit) {
    query = query.limit(filter.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as Transaction[]
}

export interface MonthAggregates {
  incomeCents: number
  expenseCents: number
  netCents: number
  spentByCat: Record<string, number>
  spentBySubcat: Record<string, number>
  directSpentByCat: Record<string, number>
}

export async function fetchMonthAggregates(
  familyId: string,
  monthStr: string,
): Promise<MonthAggregates> {
  const start = `${monthStr}-01`
  const nextMonthDate = new Date(`${monthStr}-01T12:00:00Z`)
  nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1)
  const end = nextMonthDate.toISOString().slice(0, 10)

  // Consulta leve sem joins pesados.
  // SINCRONIA (17/10): exclui 'projected' — os cards de Receitas/Despesas do mês
  // e os gastos por categoria (Orçamentos) devem bater com a Home, que só conta
  // transações realizadas. Projetadas aparecem na lista c/ badge 'Previsto'.
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount_cents, category_id, subcategory_id')
    .eq('family_id', familyId)
    .neq('status', 'projected')
    .gte('transaction_date', start)
    .lt('transaction_date', end)

  if (error) throw error

  let incomeCents = 0
  let expenseCents = 0
  const spentByCat: Record<string, number> = {}
  const spentBySubcat: Record<string, number> = {}
  const directSpentByCat: Record<string, number> = {}

  for (const row of data || []) {
    const amount = Number(row.amount_cents) || 0
    if (row.type === 'income') {
      incomeCents += amount
    } else if (row.type === 'expense') {
      expenseCents += amount
      if (row.category_id) {
        spentByCat[row.category_id] = (spentByCat[row.category_id] || 0) + amount
        if (row.subcategory_id) {
          spentBySubcat[row.subcategory_id] = (spentBySubcat[row.subcategory_id] || 0) + amount
        } else {
          directSpentByCat[row.category_id] = (directSpentByCat[row.category_id] || 0) + amount
        }
      }
    }
  }

  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    spentByCat,
    spentBySubcat,
    directSpentByCat,
  }
}

export async function createTransaction(payload: {
  family_id: string
  member_id: string
  category_id?: string | null
  subcategory_id?: string | null
  type: 'income' | 'expense'
  amount_cents: number
  description: string
  transaction_date: string
  payment_method?: string | null
  ai_confidence?: number | null
  recurring_income_id?: string | null
  is_recurring?: boolean
  recurring_month?: string | null
  is_installment?: boolean
  installment_number?: number | null
  installment_total?: number | null
  installment_group_id?: string | null
  status?: 'confirmed' | 'projected'
  bank_transaction_id?: string | null
}) {
  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select(`
      *,
      member:family_members(*),
      category:transaction_categories(*),
      subcategory:transaction_subcategories(*),
      recurring_income:recurring_incomes(*)
    `)
    .single()

  if (error) throw error
  return data as Transaction
}

export async function createTransactionsBatch(
  payloads: Array<{
    family_id: string
    member_id: string
    category_id?: string | null
    subcategory_id?: string | null
    type: 'income' | 'expense'
    amount_cents: number
    description: string
    transaction_date: string
    payment_method?: string | null
    ai_confidence?: number | null
    recurring_income_id?: string | null
    is_recurring?: boolean
    recurring_month?: string | null
    is_installment?: boolean
    installment_number?: number | null
    installment_total?: number | null
    installment_group_id?: string | null
    status?: 'confirmed' | 'projected'
    bank_transaction_id: string | null
    ai_reasoning?: string | null
  }>,
) {
  if (payloads.length === 0) return []
  const { data, error } = await supabase.from('transactions').insert(payloads).select(`
      *,
      member:family_members(*),
      category:transaction_categories(*),
      subcategory:transaction_subcategories(*),
      recurring_income:recurring_incomes(*)
    `)

  if (error) throw error
  return (data || []) as Transaction[]
}

export async function updateTransaction(
  id: string,
  payload: Partial<{
    member_id: string
    category_id: string | null
    subcategory_id: string | null
    type: 'income' | 'expense'
    amount_cents: number
    description: string
    transaction_date: string
    payment_method: string | null
    ai_confidence?: number | null
    recurring_income_id: string | null
    is_recurring: boolean
    recurring_month: string | null
    is_installment: boolean
    installment_number: number | null
    installment_total: number | null
    installment_group_id: string | null
    status: 'confirmed' | 'projected'
    bank_transaction_id: string | null
  }>,
) {
  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      member:family_members(*),
      category:transaction_categories(*),
      subcategory:transaction_subcategories(*),
      recurring_income:recurring_incomes(*)
    `)
    .single()

  if (error) throw error
  return data as Transaction
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)

  if (error) throw error
}

// Orçamentos

// 1. Buscar Orçamentos Padrão Recorrentes (válidos para todos os meses)
export async function fetchDefaultBudgets(familyId: string) {
  const { data, error } = await supabase
    .from('default_budgets')
    .select(`
      *,
      category:transaction_categories(*),
      subcategory:transaction_subcategories(*)
    `)
    .eq('family_id', familyId)

  if (error) throw error
  return (data || []) as DefaultBudget[]
}

// 2. Buscar Ajustes/Overrides de um mês específico
export async function fetchMonthBudgetOverrides(familyId: string, monthStr: string) {
  const monthDate = `${monthStr}-01`
  const { data, error } = await supabase
    .from('budgets')
    .select(`
      *,
      category:transaction_categories(*),
      subcategory:transaction_subcategories(*)
    `)
    .eq('family_id', familyId)
    .eq('month', monthDate)

  if (error) throw error
  return (data || []) as Budget[]
}

// 3. Salvar ou atualizar Orçamento Padrão Recorrente (aplica-se a todos os meses)
export async function upsertDefaultBudget(
  familyId: string,
  categoryId: string,
  amountCents: number,
  subcategoryId?: string | null,
) {
  // Como subcategory_id pode ser null, primeiro verificamos se já existe registro
  let query = supabase
    .from('default_budgets')
    .select('id')
    .eq('family_id', familyId)
    .eq('category_id', categoryId)

  if (subcategoryId) {
    query = query.eq('subcategory_id', subcategoryId)
  } else {
    query = query.is('subcategory_id', null)
  }

  const { data: existing } = await query.maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabase
      .from('default_budgets')
      .update({ amount_cents: amountCents })
      .eq('id', existing.id)
      .select(`
        *,
        category:transaction_categories(*),
        subcategory:transaction_subcategories(*)
      `)
      .single()
    if (error) throw error
    return data as DefaultBudget
  } else {
    const { data, error } = await supabase
      .from('default_budgets')
      .insert({
        family_id: familyId,
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        amount_cents: amountCents,
      })
      .select(`
        *,
        category:transaction_categories(*),
        subcategory:transaction_subcategories(*)
      `)
      .single()
    if (error) throw error
    return data as DefaultBudget
  }
}

// 4. Salvar ou atualizar Ajuste Pontual de um Mês Específico (Override)
export async function upsertMonthBudgetOverride(
  familyId: string,
  categoryId: string,
  monthStr: string,
  amountCents: number,
  subcategoryId?: string | null,
) {
  const monthDate = `${monthStr}-01`
  let query = supabase
    .from('budgets')
    .select('id')
    .eq('family_id', familyId)
    .eq('category_id', categoryId)
    .eq('month', monthDate)

  if (subcategoryId) {
    query = query.eq('subcategory_id', subcategoryId)
  } else {
    query = query.is('subcategory_id', null)
  }

  const { data: existing } = await query.maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabase
      .from('budgets')
      .update({ amount_cents: amountCents })
      .eq('id', existing.id)
      .select(`
        *,
        category:transaction_categories(*),
        subcategory:transaction_subcategories(*)
      `)
      .single()
    if (error) throw error
    return data as Budget
  } else {
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        family_id: familyId,
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        month: monthDate,
        amount_cents: amountCents,
      })
      .select(`
        *,
        category:transaction_categories(*),
        subcategory:transaction_subcategories(*)
      `)
      .single()
    if (error) throw error
    return data as Budget
  }
}

// 5. Remover ajuste pontual (voltar ao padrão do mês)
export async function resetMonthBudgetToDefault(
  familyId: string,
  categoryId: string,
  monthStr: string,
  subcategoryId?: string | null,
) {
  const monthDate = `${monthStr}-01`
  let query = supabase
    .from('budgets')
    .delete()
    .eq('family_id', familyId)
    .eq('category_id', categoryId)
    .eq('month', monthDate)

  if (subcategoryId) {
    query = query.eq('subcategory_id', subcategoryId)
  } else {
    query = query.is('subcategory_id', null)
  }

  const { error } = await query
  if (error) throw error
}

// 6. Remover completamente o orçamento padrão recorrente
export async function deleteDefaultBudget(id: string) {
  const { error } = await supabase.from('default_budgets').delete().eq('id', id)

  if (error) throw error
}
