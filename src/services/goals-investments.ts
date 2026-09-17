// Serviço de Metas e Investimentos
import { supabase } from '@/lib/supabase/client'
import type { Goal, Investment, AssetType } from '@/types/finance'

// METAS
export async function fetchGoals(familyId: string) {
  const { data, error } = await (supabase as any)
    .from('goals')
    .select(`
      *,
      category:transaction_categories(*)
    `)
    .eq('family_id', familyId)
    .order('deadline', { ascending: true })

  if (error) throw error
  return (data || []) as Goal[]
}

export async function createGoal(payload: {
  family_id: string
  name: string
  category_id?: string | null
  target_amount_cents: number
  deadline: string
}) {
  const { data, error } = await (supabase as any)
    .from('goals')
    .insert(payload)
    .select(`
      *,
      category:transaction_categories(*)
    `)
    .single()

  if (error) throw error
  return data as Goal
}

export async function updateGoal(
  id: string,
  payload: Partial<{
    name: string
    category_id: string | null
    target_amount_cents: number
    deadline: string
  }>,
) {
  const { data, error } = await (supabase as any)
    .from('goals')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      category:transaction_categories(*)
    `)
    .single()

  if (error) throw error
  return data as Goal
}

export async function deleteGoal(id: string) {
  const { error } = await (supabase as any).from('goals').delete().eq('id', id)

  if (error) throw error
}

// INVESTIMENTOS
export async function fetchInvestments(familyId: string) {
  const { data, error } = await (supabase as any)
    .from('investments')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as Investment[]
}

export async function createInvestment(payload: {
  family_id: string
  name: string
  ticker?: string | null
  asset_type: AssetType
  quantity: number
  avg_price_cents: number
  current_price_cents: number
}) {
  const { data, error } = await (supabase as any)
    .from('investments')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data as Investment
}

export async function updateInvestment(
  id: string,
  payload: Partial<{
    name: string
    ticker: string | null
    asset_type: AssetType
    quantity: number
    avg_price_cents: number
    current_price_cents: number
  }>,
) {
  const { data, error } = await (supabase as any)
    .from('investments')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Investment
}

export async function updateInvestmentPrice(id: string, currentPriceCents: number) {
  const { data, error } = await (supabase as any)
    .from('investments')
    .update({ current_price_cents: currentPriceCents })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Investment
}

export async function deleteInvestment(id: string) {
  const { error } = await (supabase as any).from('investments').delete().eq('id', id)

  if (error) throw error
}
