import { supabase } from '@/lib/supabase/client'
import {
  BUDGET_PRESETS,
  matchCategoryToPresetKey,
  type CategoryPresetConfig,
} from '@/types/budget-presets'
import type { TransactionCategory } from '@/types/finance'
import { upsertDefaultBudget } from '@/services/transactions'

export interface ApplyPresetResult {
  updatedCategoriesCount: number
  updatedBudgetsCount: number
  totalBudgetCalculatedCents: number
}

/**
 * Aplica um preset orçamentário para a família:
 * 1. Salva a renda líquida na família (se informada)
 * 2. Mapeia as categorias da matriz para as categorias existentes no banco
 * 3. Atualiza percent_default, percent_alert e budget_bucket na transaction_categories
 * 4. Calcula o valor em reais: Math.round((monthlyNetIncomeCents * percent) / 100)
 * 5. Grava os tetos padrão na tabela default_budgets para as categorias correspondentes
 *    PRESERVANDO todos os overrides pontuais de meses criados pelo usuário
 */
export async function applyBudgetPreset(params: {
  familyId: string
  presetId: 'equilibrado' | 'enxuto' | 'acelerador'
  monthlyNetIncomeCents: number
  existingCategories: TransactionCategory[]
}): Promise<ApplyPresetResult> {
  const { familyId, presetId, monthlyNetIncomeCents, existingCategories } = params

  const preset = BUDGET_PRESETS.find((p) => p.id === presetId)
  if (!preset) throw new Error('Preset não encontrado')

  // 1. Atualizar a renda líquida na tabela families
  const { error: famError } = await (supabase as any)
    .from('families')
    .update({ monthly_net_income_cents: monthlyNetIncomeCents })
    .eq('id', familyId)

  if (famError) throw famError

  // 2. Mapear categorias existentes da família com base nas chaves do preset
  // Chaves: moradia, alimentacao, transporte, saude, educacao, lazer, compras, assinaturas, reserva, metas
  const presetMap = new Map<string, CategoryPresetConfig>()
  preset.categories.forEach((cat) => {
    presetMap.set(cat.key, cat)
  })

  // Lista de despesas existentes
  const expenseCategories = existingCategories.filter((c) => c.type === 'expense')

  let updatedCategoriesCount = 0
  let updatedBudgetsCount = 0
  let totalBudgetCalculatedCents = 0

  // Guardar quais chaves de preset já foram associadas para evitar atribuir duas categorias à mesma chave
  const usedKeys = new Set<string>()

  for (const cat of expenseCategories) {
    const key = matchCategoryToPresetKey(cat.name)
    if (!key) continue
    if (usedKeys.has(key)) continue

    const config = presetMap.get(key)
    if (!config) continue

    usedKeys.add(key)

    // Atualiza metadados da categoria no banco
    const { error: catErr } = await (supabase as any)
      .from('transaction_categories')
      .update({
        percent_default: config.percent,
        percent_alert: config.percentAlert ?? null,
        budget_bucket: config.bucket,
      })
      .eq('id', cat.id)

    if (catErr) {
      console.error(`Erro ao atualizar categoria ${cat.name}:`, catErr)
      continue
    }

    updatedCategoriesCount += 1

    // Calcular o teto padrão em centavos
    const amountCents = Math.round((monthlyNetIncomeCents * config.percent) / 100)
    totalBudgetCalculatedCents += amountCents

    // Salvar teto padrão da categoria pai (preserva overrides de meses)
    try {
      await upsertDefaultBudget(familyId, cat.id, amountCents, null)
      updatedBudgetsCount += 1
    } catch (bErr) {
      console.error(`Erro ao atualizar default_budget para ${cat.name}:`, bErr)
    }
  }

  return {
    updatedCategoriesCount,
    updatedBudgetsCount,
    totalBudgetCalculatedCents,
  }
}

/**
 * Atualiza o percentual ou teto de uma categoria específica individualmente:
 * Se o usuário editar o %, recalcula o teto em reais na default_budgets e salva o percent_default na categoria.
 * Se o usuário editar o teto em reais, calcula o % equivalente em relação à renda da família e atualiza ambos.
 */
export async function updateCategoryBudgetPercent(params: {
  familyId: string
  categoryId: string
  monthlyNetIncomeCents: number
  newPercent: number
  percentAlert?: number | null
  budgetBucket?: string | null
}): Promise<number> {
  const { familyId, categoryId, monthlyNetIncomeCents, newPercent, percentAlert, budgetBucket } =
    params

  const roundedPercent = Math.max(0, Math.min(100, Math.round(newPercent * 100) / 100))
  const newAmountCents =
    monthlyNetIncomeCents > 0 ? Math.round((monthlyNetIncomeCents * roundedPercent) / 100) : 0

  const updatePayload: any = {
    percent_default: roundedPercent,
  }
  if (percentAlert !== undefined) updatePayload.percent_alert = percentAlert
  if (budgetBucket !== undefined) updatePayload.budget_bucket = budgetBucket

  await (supabase as any).from('transaction_categories').update(updatePayload).eq('id', categoryId)

  await upsertDefaultBudget(familyId, categoryId, newAmountCents, null)

  return newAmountCents
}

/**
 * Atualiza o teto em reais diretamente e sincroniza o % de percent_default se houver renda cadastrada
 */
export async function updateCategoryBudgetAmount(params: {
  familyId: string
  categoryId: string
  monthlyNetIncomeCents: number
  newAmountCents: number
}): Promise<number | null> {
  const { familyId, categoryId, monthlyNetIncomeCents, newAmountCents } = params

  await upsertDefaultBudget(familyId, categoryId, newAmountCents, null)

  let calculatedPercent: number | null = null
  if (monthlyNetIncomeCents > 0) {
    calculatedPercent = Math.round((newAmountCents / monthlyNetIncomeCents) * 1000) / 10 // ex: 25.5%
    await (supabase as any)
      .from('transaction_categories')
      .update({ percent_default: calculatedPercent })
      .eq('id', categoryId)
  }

  return calculatedPercent
}
