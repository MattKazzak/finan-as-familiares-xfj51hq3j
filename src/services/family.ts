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

  const [
    { data: members, error: memErr },
    { data: categories, error: catErr },
    { data: subcategories, error: subErr },
  ] = await Promise.all([
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
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    (supabase as any)
      .from('transaction_subcategories')
      .select('*')
      .or(`family_id.eq.${family.id},family_id.is.null`)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  ])

  if (memErr) throw memErr
  if (catErr) throw catErr
  if (subErr) throw subErr

  // Associar subcategorias às categorias correspondentes
  const subMap: Record<string, any[]> = {}
  ;(subcategories || []).forEach((sub: any) => {
    if (!subMap[sub.category_id]) {
      subMap[sub.category_id] = []
    }
    subMap[sub.category_id].push(sub)
  })

  const enrichedCategories = (categories || []).map((cat: any) => ({
    ...cat,
    subcategories: subMap[cat.id] || [],
  }))

  return {
    family,
    members: (members || []) as FamilyMember[],
    categories: enrichedCategories as TransactionCategory[],
    subcategories: (subcategories || []) as any[],
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

export async function updateFamilyDetails(
  familyId: string,
  updates: { name?: string; avatar_url?: string | null; monthly_net_income_cents?: number | null },
) {
  const { data, error } = await (supabase as any)
    .from('families')
    .update(updates)
    .eq('id', familyId)
    .select()
    .single()

  if (error) throw error
  return data as Family
}

export async function uploadFamilyAvatarFile(familyId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'png'
  const fileName = `${familyId}-${Date.now()}.${fileExt}`
  const filePath = `family-avatars/${fileName}`

  // Tenta upload no bucket Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('family-avatars')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    })

  if (!uploadError) {
    const { data: publicData } = supabase.storage.from('family-avatars').getPublicUrl(filePath)

    if (publicData?.publicUrl) {
      return publicData.publicUrl
    }
  }

  // Fallback: se Storage falhar ou não estiver disponível no mock/ambiente, ler como Data URL Base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Erro ao converter imagem'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function addCategory(
  familyId: string,
  name: string,
  type: 'income' | 'expense',
  color?: string,
  icon?: string,
) {
  // Obter o maior sort_order atual para adicionar ao final
  const { data: maxOrderData } = await (supabase as any)
    .from('transaction_categories')
    .select('sort_order')
    .eq('family_id', familyId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (maxOrderData?.[0]?.sort_order ?? 0) + 1

  const { data, error } = await (supabase as any)
    .from('transaction_categories')
    .insert({
      family_id: familyId,
      name: name.trim(),
      type,
      color: color || (type === 'income' ? '#10B981' : '#64748B'),
      icon: icon || 'Tag',
      sort_order: nextOrder,
    })
    .select()
    .single()

  if (error) throw error
  return data as TransactionCategory
}

export async function updateCategory(
  id: string,
  updates: {
    name?: string
    color?: string
    icon?: string
    type?: 'income' | 'expense'
    percent_default?: number | null
    percent_alert?: number | null
    budget_bucket?: string | null
  },
) {
  const payload: any = {}
  if (updates.name !== undefined) payload.name = updates.name.trim()
  if (updates.color !== undefined) payload.color = updates.color
  if (updates.icon !== undefined) payload.icon = updates.icon
  if (updates.type !== undefined) payload.type = updates.type
  if (updates.percent_default !== undefined) payload.percent_default = updates.percent_default
  if (updates.percent_alert !== undefined) payload.percent_alert = updates.percent_alert
  if (updates.budget_bucket !== undefined) payload.budget_bucket = updates.budget_bucket

  const { data, error } = await (supabase as any)
    .from('transaction_categories')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as TransactionCategory
}

export async function getCategoryUsageCount(categoryId: string): Promise<number> {
  const { count, error } = await (supabase as any)
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)

  if (error) throw error
  return count || 0
}

export async function getSubcategoryUsageCount(subcategoryId: string): Promise<number> {
  const { count, error } = await (supabase as any)
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('subcategory_id', subcategoryId)

  if (error) throw error
  return count || 0
}

export async function deleteCategory(id: string, reassignOrClearTxs: boolean = true) {
  if (reassignOrClearTxs) {
    // Desassocia as transações para evitar violações de chave ou manter integridade do histórico
    await (supabase as any)
      .from('transactions')
      .update({ category_id: null, subcategory_id: null })
      .eq('category_id', id)
  }
  const { error } = await (supabase as any).from('transaction_categories').delete().eq('id', id)

  if (error) throw error
}

export async function addSubcategory(
  categoryId: string,
  familyId: string,
  name: string,
  icon?: string,
  color?: string,
) {
  const { data, error } = await (supabase as any)
    .from('transaction_subcategories')
    .insert({
      category_id: categoryId,
      family_id: familyId,
      name: name.trim(),
      icon: icon || null,
      color: color || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSubcategory(
  id: string,
  updates: { name?: string; icon?: string | null; color?: string | null },
) {
  const payload: any = {}
  if (updates.name !== undefined) payload.name = updates.name.trim()
  if (updates.icon !== undefined) payload.icon = updates.icon
  if (updates.color !== undefined) payload.color = updates.color

  const { data, error } = await (supabase as any)
    .from('transaction_subcategories')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSubcategory(id: string, clearTxs: boolean = true) {
  if (clearTxs) {
    // Desassocia as transações da subcategoria
    await (supabase as any)
      .from('transactions')
      .update({ subcategory_id: null })
      .eq('subcategory_id', id)
  }
  const { error } = await (supabase as any).from('transaction_subcategories').delete().eq('id', id)

  if (error) throw error
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  if (!orderedIds || orderedIds.length === 0) return

  const updates = orderedIds.map((id, index) =>
    (supabase as any)
      .from('transaction_categories')
      .update({ sort_order: index + 1 })
      .eq('id', id),
  )

  const results = await Promise.all(updates)
  for (const res of results) {
    if (res.error) throw res.error
  }
}

export async function reorderSubcategories(orderedIds: string[]): Promise<void> {
  if (!orderedIds || orderedIds.length === 0) return

  const updates = orderedIds.map((id, index) =>
    (supabase as any)
      .from('transaction_subcategories')
      .update({ sort_order: index + 1 })
      .eq('id', id),
  )

  const results = await Promise.all(updates)
  for (const res of results) {
    if (res.error) throw res.error
  }
}
