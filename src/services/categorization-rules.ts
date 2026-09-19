import { supabase } from '@/lib/supabase/client'
import type { CategorizationRule } from '@/types/finance'

export interface CreateCategorizationRuleInput {
  family_id: string
  user_id?: string | null
  pattern: string
  category_id: string
  subcategory_id?: string | null
}

/**
 * Busca todas as regras de categorização da família/usuário, ordenadas pelas mais longas/específicas primeiro.
 */
export async function fetchCategorizationRules(familyId: string): Promise<CategorizationRule[]> {
  const { data, error } = await supabase
    .from('categorization_rules')
    .select(`
      id,
      family_id,
      user_id,
      pattern,
      category_id,
      subcategory_id,
      created_at,
      category:transaction_categories(*),
      subcategory:transaction_subcategories(*)
    `)
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar regras de categorização:', error)
    throw error
  }

  // Ordena por comprimento do pattern decrescente (matches mais longos ganham precedência)
  const rules = (data || []) as unknown as CategorizationRule[]
  return rules.sort((a, b) => (b.pattern?.length || 0) - (a.pattern?.length || 0))
}

/**
 * Cria ou atualiza uma regra de categorização para um padrão específico.
 */
export async function upsertCategorizationRule(
  input: CreateCategorizationRuleInput,
): Promise<CategorizationRule> {
  const cleanPattern = input.pattern.trim().toUpperCase()
  if (!cleanPattern) {
    throw new Error('O padrão de busca não pode ser vazio.')
  }

  // Verificar se já existe uma regra para esse mesmo pattern na família
  const { data: existing } = await supabase
    .from('categorization_rules')
    .select('id')
    .eq('family_id', input.family_id)
    .ilike('pattern', cleanPattern)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('categorization_rules')
      .update({
        category_id: input.category_id,
        subcategory_id: input.subcategory_id || null,
        user_id: input.user_id || undefined,
      })
      .eq('id', existing.id)
      .select(`
        id,
        family_id,
        user_id,
        pattern,
        category_id,
        subcategory_id,
        created_at,
        category:transaction_categories(*),
        subcategory:transaction_subcategories(*)
      `)
      .single()

    if (error) {
      console.error('Erro ao atualizar regra de categorização:', error)
      throw error
    }
    return data as unknown as CategorizationRule
  }

  const { data, error } = await supabase
    .from('categorization_rules')
    .insert({
      family_id: input.family_id,
      user_id: input.user_id || null,
      pattern: cleanPattern,
      category_id: input.category_id,
      subcategory_id: input.subcategory_id || null,
    })
    .select(`
      id,
      family_id,
      user_id,
      pattern,
      category_id,
      subcategory_id,
      created_at,
      category:transaction_categories(*),
      subcategory:transaction_subcategories(*)
    `)
    .single()

  if (error) {
    console.error('Erro ao criar regra de categorização:', error)
    throw error
  }

  return data as unknown as CategorizationRule
}

/**
 * Exclui uma regra de categorização.
 */
export async function deleteCategorizationRule(id: string): Promise<void> {
  const { error } = await supabase.from('categorization_rules').delete().eq('id', id)
  if (error) {
    console.error('Erro ao deletar regra de categorização:', error)
    throw error
  }
}
