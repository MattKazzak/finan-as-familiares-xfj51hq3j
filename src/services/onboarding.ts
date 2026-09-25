import { supabase } from '@/lib/supabase/client'
import { BudgetBucket } from '@/types/finance'
import { upsertDefaultBudget } from '@/services/transactions'
import { updateFamilyDetails } from '@/services/family'

export interface CategorySeedDefinition {
  name: string
  bucket: BudgetBucket
  icon: string
  color: string
  type: 'expense'
  suggestedPercent: number // Percentual padrão sugerido dentro da renda total para o modelo 50/30/20
  subcategories: Array<{
    name: string
    icon?: string
    color?: string
  }>
}

/**
 * Árvore padronizada de Categorias e Subcategorias especificada para o Curiangoo:
 *
 * Balde 'essentials' (Necessidades - 50%):
 * - Moradia: Aluguel/Financiamento, Condomínio, Energia, Água, Gás, Internet/Telefone, Manutenção
 * - Alimentação Básica: Supermercado, Hortifruti & Feira, Açougue, Padaria
 * - Transporte: Combustível, Transporte Público, Aplicativos (Uber/99), Manutenção & Seguro, Estacionamento
 * - Saúde: Farmácia & Remédios, Consultas & Exames, Plano de Saúde, Odontologia
 * - Educação: Mensalidades, Material Escolar, Cursos
 *
 * Balde 'lifestyle' (Estilo de Vida - 30%):
 * - Lazer & Gastronomia: Restaurantes, Bares, Delivery, Cinema & Passeios
 * - Cuidados Pessoais & Estética: Salão/Barbearia, Manicure & Estética, Cosméticos
 * - Compras & Desejos: Vestuário & Calçados, Eletrônicos & Casa, Presentes, Hábitos Pessoais
 * - Assinaturas & Serviços: Streaming, Música, Softwares
 * - Pets: Ração, Veterinário & Vacinas, Higiene & Acessórios
 *
 * Balde 'future' (Futuro & Metas - 20%):
 * - Reserva de Emergência: Aporte da Reserva
 * - Investimentos & Aposentadoria: Aportes, Previdência
 * - Grandes Projetos: Metas Gerais
 */
export const STANDARDIZED_CATEGORIES_TREE: CategorySeedDefinition[] = [
  // Essentials (Necessidades) -> Soma sugerida dos percentuais = 50%
  {
    name: 'Moradia',
    bucket: 'essentials',
    icon: 'Home',
    color: '#6366F1', // Indigo
    type: 'expense',
    suggestedPercent: 20,
    subcategories: [
      { name: 'Aluguel/Financiamento', icon: 'Home' },
      { name: 'Condomínio', icon: 'Building' },
      { name: 'Energia', icon: 'Zap' },
      { name: 'Água', icon: 'Droplets' },
      { name: 'Gás', icon: 'Flame' },
      { name: 'Internet/Telefone', icon: 'Wifi' },
      { name: 'Manutenção', icon: 'Wrench' },
    ],
  },
  {
    name: 'Alimentação Básica',
    bucket: 'essentials',
    icon: 'ShoppingCart',
    color: '#F59E0B', // Amber
    type: 'expense',
    suggestedPercent: 14,
    subcategories: [
      { name: 'Supermercado', icon: 'ShoppingCart' },
      { name: 'Hortifruti & Feira', icon: 'Apple' },
      { name: 'Açougue', icon: 'Beef' },
      { name: 'Padaria', icon: 'Coffee' },
    ],
  },
  {
    name: 'Transporte',
    bucket: 'essentials',
    icon: 'Car',
    color: '#3B82F6', // Blue
    type: 'expense',
    suggestedPercent: 8,
    subcategories: [
      { name: 'Combustível', icon: 'Fuel' },
      { name: 'Transporte Público', icon: 'Bus' },
      { name: 'Aplicativos (Uber/99)', icon: 'Car' },
      { name: 'Manutenção & Seguro', icon: 'ShieldAlert' },
      { name: 'Estacionamento', icon: 'CircleParking' },
    ],
  },
  {
    name: 'Saúde',
    bucket: 'essentials',
    icon: 'HeartPulse',
    color: '#EF4444', // Red
    type: 'expense',
    suggestedPercent: 5,
    subcategories: [
      { name: 'Farmácia & Remédios', icon: 'Pill' },
      { name: 'Consultas & Exames', icon: 'Stethoscope' },
      { name: 'Plano de Saúde', icon: 'Shield' },
      { name: 'Odontologia', icon: 'Smile' },
    ],
  },
  {
    name: 'Educação',
    bucket: 'essentials',
    icon: 'GraduationCap',
    color: '#8B5CF6', // Purple
    type: 'expense',
    suggestedPercent: 3,
    subcategories: [
      { name: 'Mensalidades', icon: 'GraduationCap' },
      { name: 'Material Escolar', icon: 'BookOpen' },
      { name: 'Cursos', icon: 'Award' },
    ],
  },

  // Lifestyle (Estilo de Vida) -> Soma sugerida dos percentuais = 30%
  {
    name: 'Lazer & Gastronomia',
    bucket: 'lifestyle',
    icon: 'UtensilsCrossed',
    color: '#EC4899', // Pink
    type: 'expense',
    suggestedPercent: 10,
    subcategories: [
      { name: 'Restaurantes', icon: 'Utensils' },
      { name: 'Bares', icon: 'Wine' },
      { name: 'Delivery', icon: 'Bike' },
      { name: 'Cinema & Passeios', icon: 'Film' },
    ],
  },
  {
    name: 'Cuidados Pessoais & Estética',
    bucket: 'lifestyle',
    icon: 'Sparkles',
    color: '#F43F5E', // Rose
    type: 'expense',
    suggestedPercent: 6,
    subcategories: [
      { name: 'Salão/Barbearia', icon: 'Scissors' },
      { name: 'Manicure & Estética', icon: 'Sparkles' },
      { name: 'Cosméticos', icon: 'Package' },
    ],
  },
  {
    name: 'Compras & Desejos',
    bucket: 'lifestyle',
    icon: 'ShoppingBag',
    color: '#14B8A6', // Teal
    type: 'expense',
    suggestedPercent: 6,
    subcategories: [
      { name: 'Vestuário & Calçados', icon: 'Shirt' },
      { name: 'Eletrônicos & Casa', icon: 'Laptop' },
      { name: 'Presentes', icon: 'Gift' },
      { name: 'Hábitos Pessoais', icon: 'Smile' },
    ],
  },
  {
    name: 'Assinaturas & Serviços',
    bucket: 'lifestyle',
    icon: 'Tv',
    color: '#06B6D4', // Cyan
    type: 'expense',
    suggestedPercent: 4,
    subcategories: [
      { name: 'Streaming', icon: 'Tv' },
      { name: 'Música', icon: 'Headphones' },
      { name: 'Softwares', icon: 'Terminal' },
    ],
  },
  {
    name: 'Pets',
    bucket: 'lifestyle',
    icon: 'PawPrint',
    color: '#EAB308', // Yellow
    type: 'expense',
    suggestedPercent: 4,
    subcategories: [
      { name: 'Ração', icon: 'Utensils' },
      { name: 'Veterinário & Vacinas', icon: 'HeartPulse' },
      { name: 'Higiene & Acessórios', icon: 'Sparkles' },
    ],
  },

  // Future (Futuro & Metas) -> Soma sugerida dos percentuais = 20%
  {
    name: 'Reserva de Emergência',
    bucket: 'future',
    icon: 'ShieldCheck',
    color: '#10B981', // Emerald
    type: 'expense',
    suggestedPercent: 10,
    subcategories: [{ name: 'Aporte da Reserva', icon: 'ShieldCheck' }],
  },
  {
    name: 'Investimentos & Aposentadoria',
    bucket: 'future',
    icon: 'TrendingUp',
    color: '#059669', // Dark Emerald
    type: 'expense',
    suggestedPercent: 6,
    subcategories: [
      { name: 'Aportes', icon: 'TrendingUp' },
      { name: 'Previdência', icon: 'Landmark' },
    ],
  },
  {
    name: 'Grandes Projetos',
    bucket: 'future',
    icon: 'Target',
    color: '#0D9488', // Teal Dark
    type: 'expense',
    suggestedPercent: 4,
    subcategories: [{ name: 'Metas Gerais', icon: 'Target' }],
  },
]

export interface SeedCategoriesAndPlanOptions {
  familyId: string
  monthlyNetIncomeCents: number
  modelPresetId: '50_30_20' | '60_25_15' | '70_20_10'
}

/**
 * Fatores multiplicadores de reponderação dos percentuais das categorias para os modelos alternativos.
 * Base 50_30_20 = 50 / 30 / 20.
 * Modelo 60_25_15: balde essentials cresce 20% (60/50 = 1.2), lifestyle (25/30 = 0.833), future (15/20 = 0.75).
 * Modelo 70_20_10: balde essentials cresce 40% (70/50 = 1.4), lifestyle (20/30 = 0.667), future (10/20 = 0.5).
 */
export function getCategoryWeightFactor(
  bucket: BudgetBucket,
  presetId: '50_30_20' | '60_25_15' | '70_20_10',
): number {
  if (presetId === '60_25_15') {
    if (bucket === 'essentials') return 60 / 50 // 1.2
    if (bucket === 'lifestyle') return 25 / 30 // ~0.833
    if (bucket === 'future') return 15 / 20 // 0.75
  } else if (presetId === '70_20_10') {
    if (bucket === 'essentials') return 70 / 50 // 1.4
    if (bucket === 'lifestyle') return 20 / 30 // ~0.667
    if (bucket === 'future') return 10 / 20 // 0.5
  }
  return 1.0
}

/**
 * Cria a árvore padronizada completa com idempotência e aplica os tetos sugeridos com base na renda líquida
 */
export async function seedStandardizedCategoriesAndApplyPlan({
  familyId,
  monthlyNetIncomeCents,
  modelPresetId = '50_30_20',
}: SeedCategoriesAndPlanOptions): Promise<{
  createdCategoriesCount: number
  createdSubcategoriesCount: number
  totalBudgetCents: number
}> {
  if (!familyId) {
    throw new Error('familyId é obrigatório')
  }

  // 1. Atualiza renda líquida na tabela families
  await updateFamilyDetails(familyId, {
    monthly_net_income_cents: monthlyNetIncomeCents,
  })

  // 2. Busca categorias existentes da família para idempotência
  const { data: existingCategories, error: fetchCatError } = await (supabase as any)
    .from('transaction_categories')
    .select('id, name, budget_bucket, sort_order')
    .eq('family_id', familyId)

  if (fetchCatError) {
    throw fetchCatError
  }

  const existingCatMap = new Map<string, any>()
  let maxSortOrder = 0
  for (const c of existingCategories || []) {
    existingCatMap.set(c.name.trim().toLowerCase(), c)
    if (c.sort_order && c.sort_order > maxSortOrder) {
      maxSortOrder = c.sort_order
    }
  }

  // 3. Busca subcategorias existentes para idempotência
  const { data: existingSubcategories, error: fetchSubError } = await (supabase as any)
    .from('transaction_subcategories')
    .select('id, category_id, name')
    .eq('family_id', familyId)

  if (fetchSubError) {
    throw fetchSubError
  }

  const existingSubMap = new Set<string>()
  for (const s of existingSubcategories || []) {
    existingSubMap.add(`${s.category_id}::${s.name.trim().toLowerCase()}`)
  }

  let createdCategoriesCount = 0
  let createdSubcategoriesCount = 0
  let totalBudgetCents = 0

  // 4. Itera sobre a árvore padronizada
  for (let i = 0; i < STANDARDIZED_CATEGORIES_TREE.length; i++) {
    const catDef = STANDARDIZED_CATEGORIES_TREE[i]
    const catKey = catDef.name.trim().toLowerCase()

    let categoryRecord = existingCatMap.get(catKey)

    if (!categoryRecord) {
      maxSortOrder += 1
      const { data: newCat, error: insertCatError } = await (supabase as any)
        .from('transaction_categories')
        .insert({
          family_id: familyId,
          name: catDef.name,
          type: catDef.type,
          budget_bucket: catDef.bucket,
          icon: catDef.icon,
          color: catDef.color,
          sort_order: maxSortOrder,
        })
        .select()
        .single()

      if (insertCatError) {
        // Se bater no índice único por concorrência, faz fallback buscando
        const { data: fallbackCat } = await (supabase as any)
          .from('transaction_categories')
          .select('id, name, budget_bucket, sort_order')
          .eq('family_id', familyId)
          .eq('name', catDef.name)
          .single()

        if (fallbackCat) {
          categoryRecord = fallbackCat
        } else {
          console.error(`Erro ao criar categoria ${catDef.name}:`, insertCatError)
          throw insertCatError
        }
      } else {
        categoryRecord = newCat
        existingCatMap.set(catKey, newCat)
        createdCategoriesCount += 1
      }
    } else {
      // Se já existia mas não tinha bucket ou bucket diferente, atualiza
      if (!categoryRecord.budget_bucket || categoryRecord.budget_bucket !== catDef.bucket) {
        await (supabase as any)
          .from('transaction_categories')
          .update({ budget_bucket: catDef.bucket })
          .eq('id', categoryRecord.id)
      }
    }

    const categoryId = categoryRecord.id

    // 5. Inserir subcategorias com idempotência
    if (catDef.subcategories && catDef.subcategories.length > 0) {
      for (let sIdx = 0; sIdx < catDef.subcategories.length; sIdx++) {
        const subDef = catDef.subcategories[sIdx]
        const subKey = `${categoryId}::${subDef.name.trim().toLowerCase()}`

        if (!existingSubMap.has(subKey)) {
          const { error: insertSubError } = await (supabase as any)
            .from('transaction_subcategories')
            .insert({
              category_id: categoryId,
              family_id: familyId,
              name: subDef.name,
              icon: subDef.icon || catDef.icon,
              color: subDef.color || catDef.color,
              sort_order: sIdx + 1,
            })

          if (!insertSubError) {
            existingSubMap.add(subKey)
            createdSubcategoriesCount += 1
          } else {
            console.warn(`Aviso ao criar subcategoria ${subDef.name}:`, insertSubError)
          }
        }
      }
    }

    // 6. Calcular e definir o teto inicial sugerido em default_budgets
    const weightFactor = getCategoryWeightFactor(catDef.bucket, modelPresetId)
    const effectivePercent = catDef.suggestedPercent * weightFactor
    const targetAmountCents = Math.round((monthlyNetIncomeCents * effectivePercent) / 100)

    if (targetAmountCents > 0) {
      await upsertDefaultBudget(familyId, categoryId, targetAmountCents, null)
      totalBudgetCents += targetAmountCents
    }
  }

  return {
    createdCategoriesCount,
    createdSubcategoriesCount,
    totalBudgetCents,
  }
}
