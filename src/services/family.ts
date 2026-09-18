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

export async function updateFamilyDetails(
  familyId: string,
  updates: { name?: string; avatar_url?: string | null },
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
