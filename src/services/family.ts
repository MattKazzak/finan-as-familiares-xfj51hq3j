// Serviço de dados da Família, Membros e Categorias
import { supabase } from '@/lib/supabase/client'
import { normalizeFamilyName } from '@/lib/formatters'
import type {
  Family,
  FamilyMember,
  TransactionCategory,
  FamilyInvite,
  FamilyInvitePreview,
} from '@/types/finance'

// Lock reentrante em memória para evitar que duas invocações simultâneas de auto-criação
// (ex: montagem paralela de componentes no signup) criem mais de uma família para o mesmo user_id.
const pendingWorkspaceCreations = new Map<string, Promise<Family | null>>()

/**
 * Garante que apenas 1 família seja criada por usuário, com verificação prévia no banco
 * e lock simples por Promise em andamento.
 */
export async function ensureSingleFamilyWorkspace(user: {
  id: string
  email?: string
  user_metadata?: Record<string, any>
}): Promise<Family | null> {
  const userId = user.id

  // Se já há uma criação em andamento para este user_id, reutiliza a mesma Promise
  const ongoing = pendingWorkspaceCreations.get(userId)
  if (ongoing) {
    return ongoing
  }

  const creationPromise = (async () => {
    try {
      // 1. Consulta preventiva: verifica se já existe família criada pelo usuário ou vinculada a ele
      const { data: existingFamilies } = await (supabase as any)
        .from('families')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: true })
        .limit(1)

      if (existingFamilies && existingFamilies.length > 0) {
        return existingFamilies[0] as Family
      }

      // Consulta se o usuário já é membro de alguma família via family_members
      const { data: memberRecords } = await (supabase as any)
        .from('family_members')
        .select('family_id')
        .eq('user_id', userId)
        .limit(1)

      if (memberRecords && memberRecords.length > 0 && memberRecords[0].family_id) {
        const { data: linkedFam } = await (supabase as any)
          .from('families')
          .select('*')
          .eq('id', memberRecords[0].family_id)
          .single()
        if (linkedFam) {
          return linkedFam as Family
        }
      }

      // 2. Se realmente não existe família, cria com segurança
      const rawName = (user.user_metadata?.name as string) || ''
      const fallbackMemberName = rawName || user.email?.split('@')[0] || 'Principal'
      const fallbackFamilyName = 'Minha Família'

      await createNewFamilyWorkspace(fallbackFamilyName, fallbackMemberName)

      const { data: refetched } = await (supabase as any)
        .from('families')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)

      return refetched && refetched.length > 0 ? (refetched[0] as Family) : null
    } catch (createErr) {
      console.error('Erro ao auto-criar família para o usuário:', createErr)
      return null
    } finally {
      // Libera o lock após a conclusão
      pendingWorkspaceCreations.delete(userId)
    }
  })()

  pendingWorkspaceCreations.set(userId, creationPromise)
  return creationPromise
}

export async function createNewFamilyWorkspace(
  familyName?: string,
  memberName?: string,
): Promise<string> {
  const cleanFamilyName = familyName ? normalizeFamilyName(familyName) : ''
  const { data, error } = await (supabase as any).rpc('create_new_family_workspace', {
    p_family_name: cleanFamilyName || 'Minha Família',
    p_member_name: memberName || 'Principal',
  })

  if (error) throw error
  return data as string
}

export interface ActivateFamilyOnboardingPlanParams {
  familyId: string
  monthlyNetIncomeCents: number
  modelPresetId?: '50_30_20' | '60_25_15' | '70_20_10'
}

export interface ActivateFamilyOnboardingPlanResult {
  success: boolean
  family_id: string
  monthly_net_income_cents: number
  model_preset_id: string
  categories_count: number
  subcategories_count: number
  total_budget_cents: number
}

export async function activateFamilyOnboardingPlanRpc({
  familyId,
  monthlyNetIncomeCents,
  modelPresetId = '50_30_20',
}: ActivateFamilyOnboardingPlanParams): Promise<ActivateFamilyOnboardingPlanResult> {
  const { data, error } = await (supabase as any).rpc('activate_family_onboarding_plan', {
    p_family_id: familyId,
    p_monthly_net_income_cents: monthlyNetIncomeCents,
    p_model_preset_id: modelPresetId,
  })

  if (error) throw error
  return data as ActivateFamilyOnboardingPlanResult
}

export async function fetchFamilyData() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { family: null, members: [], categories: [] }
  }

  // Busca a família pertencente ao usuário autenticado (como owner ou única família acessível via RLS)
  let { data: families, error: famErr } = await (supabase as any)
    .from('families')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)

  if (famErr) throw famErr
  let family: Family | null = families && families.length > 0 ? (families[0] as Family) : null

  // Se o usuário não possui uma família criada ainda, verifica se há convite pendente para aplicar
  if (!family) {
    let pendingInviteApplied = false
    try {
      const pendingInviteCode =
        sessionStorage.getItem('curiangoo_pending_invite_code') ||
        localStorage.getItem('curiangoo_pending_invite_code')
      if (pendingInviteCode) {
        const acceptRes = await acceptFamilyInvite(pendingInviteCode)
        if (acceptRes?.family_id) {
          sessionStorage.removeItem('curiangoo_pending_invite_code')
          localStorage.removeItem('curiangoo_pending_invite_code')
          pendingInviteApplied = true

          const { data: acceptedFam } = await (supabase as any)
            .from('families')
            .select('*')
            .eq('id', acceptRes.family_id)
            .single()

          if (acceptedFam) {
            family = acceptedFam as Family
          }
        }
      }
    } catch (inviteErr) {
      console.warn('Erro ao aplicar convite pendente na inicialização:', inviteErr)
    }

    if (!family && !pendingInviteApplied) {
      // Guard reentrante com lock por user_id: impede criação duplicada simultânea no mesmo ciclo
      family = await ensureSingleFamilyWorkspace(user)
    }
  }
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
      .eq('family_id', family.id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    (supabase as any)
      .from('transaction_subcategories')
      .select('*')
      .eq('family_id', family.id)
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
  const { data, error } = await (supabase as any).rpc('add_family_member_without_account', {
    p_family_id: familyId,
    p_name: name.trim(),
  })

  if (error) throw error
  return data as FamilyMember
}

export async function updateFamilyMember(id: string, name: string) {
  const { data, error } = await (supabase as any).rpc('rename_family_member', {
    p_member_id: id,
    p_new_name: name.trim(),
  })

  if (error) throw error
  return data as FamilyMember
}

export async function deleteFamilyMember(id: string) {
  // Chama a RPC remove_family_member para garantir validação de admin e segurança de vínculos
  const { data, error } = await (supabase as any).rpc('remove_family_member', {
    p_member_id: id,
  })

  if (error) throw error
  return data
}

export async function leaveFamilyWorkspace(familyId: string) {
  const { data, error } = await (supabase as any).rpc('leave_family', {
    p_family_id: familyId,
  })

  if (error) throw error
  return data
}

export async function generateFamilyInvite(familyId: string): Promise<FamilyInvite> {
  const { data, error } = await (supabase as any).rpc('generate_family_invite', {
    p_family_id: familyId,
  })

  if (error) throw error
  return data as FamilyInvite
}

export async function fetchFamilyInvites(familyId: string): Promise<FamilyInvite[]> {
  const { data, error } = await (supabase as any)
    .from('family_invites')
    .select(
      'id, code, role, status, uses_count, max_uses, expires_at, created_at, family_id, created_by, accepted_by, accepted_at',
    )
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as FamilyInvite[]
}

export async function getInvitePreview(code: string): Promise<FamilyInvitePreview> {
  const cleanCode = code.trim().toUpperCase()
  const { data, error } = await (supabase as any).rpc('get_invite_preview', {
    p_code: cleanCode,
  })

  if (error) throw error
  return data as FamilyInvitePreview
}

export async function acceptFamilyInvite(code: string): Promise<{
  success: boolean
  family_id: string
  member_id: string
  member_name?: string
  already_member?: boolean
}> {
  const cleanCode = code.trim().toUpperCase()
  const { data, error } = await (supabase as any).rpc('accept_family_invite', {
    p_code: cleanCode,
  })

  if (error) throw error
  return data
}

export async function updateFamilyDetails(
  familyId: string,
  updates: {
    name?: string
    avatar_url?: string | null
    monthly_net_income_cents?: number | null
    budget_model?: string | null
  },
) {
  const payload = { ...updates }
  if (payload.name !== undefined) {
    payload.name = normalizeFamilyName(payload.name)
  }

  const { data, error } = await (supabase as any)
    .from('families')
    .update(payload)
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
  budgetBucket?: 'essentials' | 'lifestyle' | 'future' | null,
) {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error('O nome da categoria é obrigatório.')
  }

  // Validação obrigatória do balde orçamentário para despesas
  let resolvedBucket = budgetBucket
  if (type === 'expense') {
    if (!resolvedBucket) {
      throw new Error('O balde orçamentário é obrigatório para categorias de despesa.')
    }
    const validBuckets = ['essentials', 'lifestyle', 'future']
    if (!validBuckets.includes(resolvedBucket)) {
      throw new Error('Balde orçamentário inválido.')
    }
  } else {
    // Receitas não usam balde orçamentário
    resolvedBucket = null
  }

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
      name: trimmedName,
      type,
      color: color || (type === 'income' ? '#10B981' : '#64748B'),
      icon: icon || 'Tag',
      budget_bucket: resolvedBucket,
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
    budget_bucket?: 'essentials' | 'lifestyle' | 'future' | null
  },
) {
  const payload: any = {}
  if (updates.name !== undefined) {
    const trimmed = updates.name.trim()
    if (!trimmed) throw new Error('O nome da categoria é obrigatório.')
    payload.name = trimmed
  }
  if (updates.color !== undefined) payload.color = updates.color
  if (updates.icon !== undefined) payload.icon = updates.icon
  if (updates.type !== undefined) payload.type = updates.type
  if (updates.percent_default !== undefined) payload.percent_default = updates.percent_default
  if (updates.percent_alert !== undefined) payload.percent_alert = updates.percent_alert

  // Validação se o budget_bucket foi informado ou se alterou para despesa
  if (updates.budget_bucket !== undefined) {
    if (updates.type === 'expense' || (!updates.type && updates.budget_bucket !== null)) {
      if (!updates.budget_bucket) {
        throw new Error('O balde orçamentário é obrigatório para categorias de despesa.')
      }
      const validBuckets = ['essentials', 'lifestyle', 'future']
      if (!validBuckets.includes(updates.budget_bucket)) {
        throw new Error('Balde orçamentário inválido.')
      }
      payload.budget_bucket = updates.budget_bucket
    } else if (updates.type === 'income') {
      payload.budget_bucket = null
    } else {
      payload.budget_bucket = updates.budget_bucket
    }
  }

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
