import { TransactionCategory } from '@/types/finance'
import { BUDGET_PRESETS, matchCategoryToPresetKey } from '@/types/budget-presets'
import { upsertDefaultBudget } from '@/services/transactions'
import { updateCategory, updateFamilyDetails } from '@/services/family'

export interface ApplyPresetResult {
  appliedCount: number
  totalBudgetCents: number
  percentOfIncome: number
}

/**
 * Aplica um preset orçamentário (50/30/20, 60/20/20, 70/20/10) a uma família,
 * aceitando opcionalmente valores customizados em centavos por categoria (customAmountsByCatId).
 *
 * Para cada categoria de despesa mapeada ou que possua valor customizado:
 * - Upsert em default_budgets com o teto em centavos.
 * - Sincroniza o balde (budget_bucket: essentials | lifestyle | future).
 * - Tetos orçamentários passam a ser presets flexíveis e 100% editáveis.
 *
 * Percentuais são sempre calculados dinamicamente em tempo de renderização (teto / renda * 100),
 * nunca fixos ou lidos de percentual engessado no banco.
 */
export async function applyBudgetPreset(
  familyId: string,
  presetId: '50_30_20' | '60_20_20' | '70_20_10' | string,
  categories: TransactionCategory[],
  netIncomeCents: number,
  customAmountsByCatId?: Record<string, number>,
): Promise<ApplyPresetResult> {
  const preset = (BUDGET_PRESETS as Record<string, any>)[presetId]
  if (!preset) {
    throw new Error(`Preset "${presetId}" não encontrado.`)
  }

  const expenseCategories = categories.filter((c) => c.type === 'expense')
  let appliedCount = 0
  let totalBudgetCents = 0

  for (const cat of expenseCategories) {
    const matchedKey = matchCategoryToPresetKey(cat.name)
    const presetItem = matchedKey
      ? preset.categories?.find((p: any) => p.matchKey === matchedKey)
      : undefined

    const hasCustomAmount = customAmountsByCatId && typeof customAmountsByCatId[cat.id] === 'number'

    // Se a categoria não tem valor customizado e nem item correspondente no preset, não aplica teto automático
    if (!presetItem && !hasCustomAmount) {
      continue
    }

    const targetBucket = presetItem?.bucket || cat.budget_bucket || 'lifestyle'
    const targetPercent = presetItem?.percent ?? 0

    // Se o usuário informou um valor customizado em R$ (centavos) para esta categoria, usa-o diretamente.
    // Caso contrário, calcula baseado no percentual sugerido pelo modelo.
    const targetAmountCents = hasCustomAmount
      ? Math.max(0, Math.round(customAmountsByCatId[cat.id]))
      : Math.round((netIncomeCents * targetPercent) / 100)

    // Atualiza o balde na categoria se necessário
    if (targetBucket && targetBucket !== cat.budget_bucket) {
      await updateCategory(cat.id, {
        budget_bucket: targetBucket,
      })
    }

    // Upsert na tabela default_budgets para definir o teto orçamentário recorrente
    await upsertDefaultBudget(familyId, cat.id, targetAmountCents, null)
    appliedCount += 1
    totalBudgetCents += targetAmountCents
  }

  // Persistir o modelo de orçamento na família
  try {
    await updateFamilyDetails(familyId, { budget_model: presetId })
  } catch (err) {
    console.warn('Não foi possível persistir budget_model na família:', err)
  }

  const percentOfIncome =
    netIncomeCents > 0 ? Math.round((totalBudgetCents / netIncomeCents) * 100) : 0

  return {
    appliedCount,
    totalBudgetCents,
    percentOfIncome,
  }
}

/**
 * Atualiza o percentual de uma categoria específica (calculando o valor em R$ correspondente)
 */
export async function updateCategoryBudgetPercent(
  familyId: string,
  categoryId: string,
  percent: number,
  netIncomeCents: number,
): Promise<void> {
  const amountCents = Math.round((netIncomeCents * percent) / 100)
  await upsertDefaultBudget(familyId, categoryId, amountCents, null)
}

/**
 * Atualiza o teto orçamentário de uma categoria diretamente em centavos (R$)
 */
export async function updateCategoryBudgetAmount(
  familyId: string,
  categoryId: string,
  amountCents: number,
): Promise<void> {
  await upsertDefaultBudget(familyId, categoryId, amountCents, null)
}
