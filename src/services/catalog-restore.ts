import { supabase } from '@/lib/supabase/client'
import { CANONICAL_CATEGORIES, TransactionCategory, TransactionSubcategory } from '@/types/finance'

export interface RestoreCatalogResult {
  categoriesAdded: number
  subcategoriesAdded: number
  reassignedTransactionsCount?: number
}

/**
 * Normaliza nomes para comparação insensível a maiúsculas/minúsculas e acentos
 */
export function normalizeName(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * MODO 1: Restaurar o que falta (Aditivo, 1 clique de confirmação)
 * Insere categorias e subcategorias do padrão canônico (19 cats / 116 subs) que a família não tem.
 * Não renomeia, não reposiciona, não toca em nada criado pelo usuário.
 */
export async function restoreMissingCatalog(
  familyId: string,
  existingCategories: TransactionCategory[],
  existingSubcategories: TransactionSubcategory[],
): Promise<RestoreCatalogResult> {
  let categoriesAdded = 0
  let subcategoriesAdded = 0

  // Mapeamento por nome normalizado
  const existingCatMap = new Map<string, TransactionCategory>()
  existingCategories.forEach((c) => {
    existingCatMap.set(normalizeName(c.name), c)
  })

  // 1. Processar cada categoria do padrão canônico (CANONICAL_CATEGORIES)
  for (const seedCat of CANONICAL_CATEGORIES) {
    const normSeedCatName = normalizeName(seedCat.name)
    let targetCat = existingCatMap.get(normSeedCatName)

    if (!targetCat) {
      // Categoria ausente: criar
      const { data: newCat, error: catErr } = await supabase
        .from('transaction_categories')
        .insert({
          family_id: familyId,
          name: seedCat.name,
          icon: seedCat.icon,
          color: seedCat.color,
          type: seedCat.type,
          budget_bucket: seedCat.bucket,
          sort_order: seedCat.sort_order,
        })
        .select()
        .single()

      if (catErr) {
        console.error('Erro ao adicionar categoria padrão:', catErr)
        continue
      }

      targetCat = newCat as TransactionCategory
      existingCatMap.set(normSeedCatName, targetCat)
      categoriesAdded++
    }

    // 2. Verificar subcategorias canônicas desta categoria
    const existingSubsForCat = existingSubcategories.filter((s) => s.category_id === targetCat!.id)
    const existingSubMap = new Set(existingSubsForCat.map((s) => normalizeName(s.name)))

    const subsToInsert: {
      family_id: string
      category_id: string
      name: string
      icon?: string
      color?: string
      sort_order?: number
    }[] = []

    for (let i = 0; i < seedCat.subcategories.length; i++) {
      const sub = seedCat.subcategories[i]
      if (!existingSubMap.has(normalizeName(sub.name))) {
        subsToInsert.push({
          family_id: familyId,
          category_id: targetCat.id,
          name: sub.name,
          icon: sub.icon || seedCat.icon,
          color: seedCat.color,
          sort_order: i + 1,
        })
      }
    }

    if (subsToInsert.length > 0) {
      const { data: insertedSubs, error: subErr } = await supabase
        .from('transaction_subcategories')
        .insert(subsToInsert)
        .select()

      if (subErr) {
        console.error('Erro ao adicionar subcategorias padrão:', subErr)
      } else if (insertedSubs) {
        subcategoriesAdded += insertedSubs.length
      }
    }
  }

  return { categoriesAdded, subcategoriesAdded }
}

/**
 * MODO 2: Redefinir tudo (Destrutivo com Confirmação Dupla e Proteção Zero Órfãs)
 * Volta 100% ao catálogo padrão.
 * ANTES de remover qualquer categoria/subcategoria customizada, remaneja suas transações
 * para a categoria/subcategoria padrão MAIS PRÓXIMA (por similaridade de nome/propósito).
 * Sem correspondente óbvio, usa a mais abrangente correspondente ('Outros', 'Outras Receitas' ou padrão do tipo).
 * INVARIANTE ABSOLUTA: ZERO transações órfãs.
 */
export async function resetCatalogToDefault(
  familyId: string,
  existingCategories: TransactionCategory[],
  existingSubcategories: TransactionSubcategory[],
): Promise<RestoreCatalogResult> {
  // Passo 1: Primeiro garante que todas as categorias/subcategorias padrão existam
  const restoreRes = await restoreMissingCatalog(
    familyId,
    existingCategories,
    existingSubcategories,
  )

  // Recarrega categorias e subcategorias atualizadas da família
  const { data: refreshedCats } = await supabase
    .from('transaction_categories')
    .select('*')
    .eq('family_id', familyId)

  const { data: refreshedSubs } = await supabase
    .from('transaction_subcategories')
    .select('*')
    .eq('family_id', familyId)

  const currentCats: TransactionCategory[] =
    (refreshedCats as unknown as TransactionCategory[]) || []
  const currentSubs: TransactionSubcategory[] =
    (refreshedSubs as unknown as TransactionSubcategory[]) || []

  // Mapeamento canônico
  const canonicalCatNames = new Set(CANONICAL_CATEGORIES.map((c) => normalizeName(c.name)))

  const canonicalSubNamesByCat = new Map<string, Set<string>>()
  CANONICAL_CATEGORIES.forEach((c) => {
    canonicalSubNamesByCat.set(
      normalizeName(c.name),
      new Set(c.subcategories.map((s) => normalizeName(s.name))),
    )
  })

  // Categorias padrão ativas indexadas
  const standardCatMap = new Map<string, TransactionCategory>()
  currentCats.forEach((c) => {
    if (canonicalCatNames.has(normalizeName(c.name))) {
      standardCatMap.set(normalizeName(c.name), c)
    }
  })

  // Fallback padrão geral mais abrangente
  const defaultExpenseFallback =
    standardCatMap.get('compras') ||
    standardCatMap.get('lazer') ||
    currentCats.find((c) => c.type === 'expense' && canonicalCatNames.has(normalizeName(c.name))) ||
    currentCats[0]

  const defaultIncomeFallback =
    standardCatMap.get('outras receitas') ||
    currentCats.find((c) => c.type === 'income' && canonicalCatNames.has(normalizeName(c.name))) ||
    currentCats[0]

  let reassignedCount = 0

  // Passo 2: Identificar categorias customizadas
  const customCategories = currentCats.filter((c) => !canonicalCatNames.has(normalizeName(c.name)))

  for (const customCat of customCategories) {
    const normCustomName = normalizeName(customCat.name)

    // Tenta encontrar uma categoria padrão similar por inclusão parcial de palavras
    let bestMatchCategory: TransactionCategory | undefined
    for (const [canonName, catObj] of standardCatMap.entries()) {
      if (catObj.type === customCat.type) {
        if (normCustomName.includes(canonName) || canonName.includes(normCustomName)) {
          bestMatchCategory = catObj
          break
        }
      }
    }

    const fallbackCategory =
      bestMatchCategory ||
      (customCat.type === 'income' ? defaultIncomeFallback : defaultExpenseFallback)

    if (fallbackCategory && fallbackCategory.id !== customCat.id) {
      // Remaneja transações desta categoria para a padrão correspondente
      const { data: updated } = await supabase
        .from('transactions')
        .update({
          category_id: fallbackCategory.id,
          subcategory_id: null, // zera subcategoria órfã
        })
        .eq('category_id', customCat.id)
        .select('id')

      if (updated) reassignedCount += updated.length

      // Remove as subcategorias customizadas filhas desta categoria
      await supabase.from('transaction_subcategories').delete().eq('category_id', customCat.id)

      // Exclui a categoria customizada
      await supabase.from('transaction_categories').delete().eq('id', customCat.id)
    }
  }

  // Passo 3: Limpar subcategorias customizadas dentro de categorias padrão
  for (const cat of currentCats) {
    const normCatName = normalizeName(cat.name)
    const allowedSubs = canonicalSubNamesByCat.get(normCatName)
    if (!allowedSubs) continue

    const subsForCat = currentSubs.filter((s) => s.category_id === cat.id)
    for (const sub of subsForCat) {
      if (!allowedSubs.has(normalizeName(sub.name))) {
        // Encontra subcategoria padrão mais próxima na mesma categoria se houver similaridade
        const normSubName = normalizeName(sub.name)
        const standardAlt = subsForCat.find((s) => {
          if (!allowedSubs.has(normalizeName(s.name))) return false
          const n = normalizeName(s.name)
          return (
            normSubName.includes(n) ||
            n.includes(normSubName) ||
            n.includes('outro') ||
            n.includes('geral')
          )
        })

        // Remaneja transações dessa subcategoria
        const { data: updated } = await supabase
          .from('transactions')
          .update({
            subcategory_id: standardAlt ? standardAlt.id : null,
          })
          .eq('subcategory_id', sub.id)
          .select('id')

        if (updated) reassignedCount += updated.length

        // Remove subcategoria customizada
        await supabase.from('transaction_subcategories').delete().eq('id', sub.id)
      }
    }
  }

  return {
    categoriesAdded: restoreRes.categoriesAdded,
    subcategoriesAdded: restoreRes.subcategoriesAdded,
    reassignedTransactionsCount: reassignedCount,
  }
}
