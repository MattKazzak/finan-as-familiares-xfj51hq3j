// Serviço de dados da Família, Membros e Categorias
import { supabase } from '@/lib/supabase/client'
import type { Family, FamilyMember, TransactionCategory } from '@/types/finance'

export async function fetchFamilyData() {
  const { data: families, error: famErr } = await (supabase as any)
    .from('families')
    .select('*')
    .limit(1)

  if (famErr) throw famErr
  const family: Family | null = families && families.length > 0 ? (families[0] as Family) : null

  if (!family) {
    return { family: null, members: [], categories: [] }
  }

  const [{ data: members, error: memErr }, { data: categories, error: catErr }] = await Promise.all(
    [
      (supabase as any)
        .from('family_members')
        .select('*')
        .eq('family_id', family.id)
        .order('is_admin', { ascending: false })
        .order('name', { ascending: true }),
      (supabase as any)
        .from('transaction_categories')
        .select('*')
        .or(`family_id.eq.${family.id},family_id.is.null`)
        .order('name', { ascending: true }),
    ],
  )

  if (memErr) throw memErr
  if (catErr) throw catErr

  return {
    family,
    members: (members || []) as FamilyMember[],
    categories: (categories || []) as TransactionCategory[],
  }
}

export async function addFamilyMember(familyId: string, name: string) {
  const { data, error } = await (supabase as any)
    .from('family_members')
    .insert({
      family_id: familyId,
      name: name.trim(),
      is_admin: false,
    })
    .select()
    .single()

  if (error) throw error
  return data as FamilyMember
}

export async function updateFamilyMember(id: string, name: string) {
  const { data, error } = await (supabase as any)
    .from('family_members')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as FamilyMember
}

export async function deleteFamilyMember(id: string) {
  const { error } = await (supabase as any).from('family_members').delete().eq('id', id)

  if (error) throw error
}

export async function addCategory(
  familyId: string,
  name: string,
  type: 'income' | 'expense',
  color?: string,
  icon?: string,
) {
  const { data, error } = await (supabase as any)
    .from('transaction_categories')
    .insert({
      family_id: familyId,
      name: name.trim(),
      type,
      color: color || (type === 'income' ? '#10B981' : '#64748B'),
      icon: icon || 'Tag',
    })
    .select()
    .single()

  if (error) throw error
  return data as TransactionCategory
}

export async function deleteCategory(id: string) {
  const { error } = await (supabase as any).from('transaction_categories').delete().eq('id', id)

  if (error) throw error
}
