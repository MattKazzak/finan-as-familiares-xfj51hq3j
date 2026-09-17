// Serviço de Transações e Orçamentos
import { supabase } from '@/lib/supabase/client'
import type { Transaction, Budget } from '@/types/finance'

export interface TransactionFilter {
  familyId: string
  memberId?: string | null
  categoryId?: string | null
  type?: 'income' | 'expense' | null
  month?: string // YYYY-MM
  limit?: number
}

export async function fetchTransactions(filter: TransactionFilter) {
  let query = (supabase as any)
    .from('transactions')
    .select(`
      *,
      member:family_members(*),
      category:transaction_categories(*)
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

  if (filter.type) {
    query = query.eq('type', filter.type)
  }

  if (filter.month) {
    const start = `${filter.month}-01`
    const nextMonthDate = new Date(`${filter.month}-01T12:00:00Z`)
    nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1)
    const end = nextMonthDate.toISOString().slice(0, 10)
    query = query.gte('transaction_date', start).lt('transaction_date', end)
  }

  if (filter.limit) {
    query = query.limit(filter.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as Transaction[]
}

export async function createTransaction(payload: {
  family_id: string
  member_id: string
  category_id?: string | null
  type: 'income' | 'expense'
  amount_cents: number
  description: string
  transaction_date: string
}) {
  const { data, error } = await (supabase as any)
    .from('transactions')
    .insert(payload)
    .select(`
      *,
      member:family_members(*),
      category:transaction_categories(*)
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
    type: 'income' | 'expense'
    amount_cents: number
    description: string
    transaction_date: string
  }>,
) {
  if (payloads.length === 0) return []
  const { data, error } = await (supabase as any).from('transactions').insert(payloads).select(`
      *,
      member:family_members(*),
      category:transaction_categories(*)
    `)

  if (error) throw error
  return (data || []) as Transaction[]
}

export async function updateTransaction(
  id: string,
  payload: Partial<{
    member_id: string
    category_id: string | null
    type: 'income' | 'expense'
    amount_cents: number
    description: string
    transaction_date: string
  }>,
) {
  const { data, error } = await (supabase as any)
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      member:family_members(*),
      category:transaction_categories(*)
    `)
    .single()

  if (error) throw error
  return data as Transaction
}

export async function deleteTransaction(id: string) {
  const { error } = await (supabase as any).from('transactions').delete().eq('id', id)

  if (error) throw error
}

// Orçamentos
export async function fetchBudgets(familyId: string, monthStr: string) {
  const monthDate = `${monthStr}-01`
  const { data, error } = await (supabase as any)
    .from('budgets')
    .select(`
      *,
      category:transaction_categories(*)
    `)
    .eq('family_id', familyId)
    .eq('month', monthDate)

  if (error) throw error
  return (data || []) as Budget[]
}

export async function upsertBudget(
  familyId: string,
  categoryId: string,
  monthStr: string,
  amountCents: number,
) {
  const monthDate = `${monthStr}-01`
  const { data, error } = await (supabase as any)
    .from('budgets')
    .upsert(
      {
        family_id: familyId,
        category_id: categoryId,
        month: monthDate,
        amount_cents: amountCents,
      },
      { onConflict: 'family_id,category_id,month' },
    )
    .select(`
      *,
      category:transaction_categories(*)
    `)
    .single()

  if (error) throw error
  return data as Budget
}

export async function deleteBudget(id: string) {
  const { error } = await (supabase as any).from('budgets').delete().eq('id', id)

  if (error) throw error
}
