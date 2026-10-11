import { describe, it, expect } from 'vitest'
import { CANONICAL_CATEGORIES } from '@/types/finance'
import { STANDARDIZED_CATEGORIES_TREE } from '@/services/onboarding'

describe('Consistência do Catálogo Canônico Curiangoo (19 categorias / 118 subcategorias)', () => {
  it('garante que CANONICAL_CATEGORIES possui 19 categorias (15 despesa + 4 receita)', () => {
    expect(CANONICAL_CATEGORIES.length).toBe(19)

    const expenseCats = CANONICAL_CATEGORIES.filter((c) => c.type === 'expense')
    const incomeCats = CANONICAL_CATEGORIES.filter((c) => c.type === 'income')
    expect(expenseCats.length).toBe(15)
    expect(incomeCats.length).toBe(4)

    // Baldes
    const essentials = expenseCats.filter((c) => c.bucket === 'essentials')
    const lifestyle = expenseCats.filter((c) => c.bucket === 'lifestyle')
    const future = expenseCats.filter((c) => c.bucket === 'future')
    expect(essentials.length).toBe(6)
    expect(lifestyle.length).toBe(6)
    expect(future.length).toBe(3)
  })

  it('garante que a soma total de subcategorias canônicas é exatamente 118 (Alimentação: 5, Moradia: 12, Compras: 10)', () => {
    const totalSubs = CANONICAL_CATEGORIES.reduce((acc, c) => acc + c.subcategories.length, 0)
    expect(totalSubs).toBe(118)

    // 98 subcategorias de despesas
    const expenseSubs = CANONICAL_CATEGORIES.filter((c) => c.type === 'expense').reduce(
      (acc, c) => acc + c.subcategories.length,
      0,
    )
    expect(expenseSubs).toBe(98)

    // 20 subcategorias de receitas
    const incomeSubs = CANONICAL_CATEGORIES.filter((c) => c.type === 'income').reduce(
      (acc, c) => acc + c.subcategories.length,
      0,
    )
    expect(incomeSubs).toBe(20)

    // Composição específica R49
    const moradia = CANONICAL_CATEGORIES.find((c) => c.name === 'Moradia')
    const alimentacao = CANONICAL_CATEGORIES.find((c) => c.name === 'Alimentação')
    const compras = CANONICAL_CATEGORIES.find((c) => c.name === 'Compras')

    expect(moradia?.subcategories.length).toBe(12)
    expect(moradia?.subcategories.some((s) => s.name === 'Limpeza & Higiene da Casa')).toBe(true)

    expect(alimentacao?.subcategories.length).toBe(5)
    expect(alimentacao?.subcategories.some((s) => s.name === 'Limpeza & Higiene da Casa')).toBe(
      false,
    )

    expect(compras?.subcategories.length).toBe(10)
    expect(compras?.subcategories.some((s) => s.name === 'Doações & Caridade')).toBe(true)
  })

  it('garante paridade exata entre STANDARDIZED_CATEGORIES_TREE (despesas) e CANONICAL_CATEGORIES', () => {
    // STANDARDIZED_CATEGORIES_TREE contém as 15 categorias de despesa do plano de gastos
    expect(STANDARDIZED_CATEGORIES_TREE.length).toBe(15)

    const canonicalExpenses = CANONICAL_CATEGORIES.filter((c) => c.type === 'expense')
    expect(canonicalExpenses.length).toBe(STANDARDIZED_CATEGORIES_TREE.length)

    for (const seedCat of STANDARDIZED_CATEGORIES_TREE) {
      const match = canonicalExpenses.find((c) => c.name === seedCat.name)
      expect(match, `Categoria ${seedCat.name} deve existir no catálogo canônico`).toBeDefined()
      expect(match?.bucket).toBe(seedCat.bucket)
      expect(match?.subcategories.length).toBe(seedCat.subcategories.length)

      // Compara nomes das subcategorias
      const seedSubNames = seedCat.subcategories.map((s) => s.name)
      const canonicalSubNames = match?.subcategories.map((s) => s.name) || []
      expect(canonicalSubNames).toEqual(expect.arrayContaining(seedSubNames))
    }
  })

  it('proíbe expressamente termos legados no catálogo canônico', () => {
    const allNames = [
      ...CANONICAL_CATEGORIES.map((c) => c.name),
      ...CANONICAL_CATEGORIES.flatMap((c) => c.subcategories.map((s) => s.name)),
      ...STANDARDIZED_CATEGORIES_TREE.map((c) => c.name),
      ...STANDARDIZED_CATEGORIES_TREE.flatMap((c) => c.subcategories.map((s) => s.name)),
    ]

    expect(allNames).not.toContain('Alimentação Básica')
    expect(allNames).not.toContain('Gastronomia & Delivery')
    expect(allNames).not.toContain('Transporte Obrigatório')
    expect(allNames).not.toContain('Saúde & Cuidados Médicos')
    expect(allNames).not.toContain('Educação Obrigatória')
    expect(allNames).not.toContain('Assinaturas & Conectividade')
    expect(allNames).not.toContain('Compras & Vestuário')
    expect(allNames).not.toContain('Metas & Grandes Sonhos')
    expect(allNames).not.toContain('Investimentos de Longo Prazo')

    // Nomes canônicos oficiais presentes
    expect(allNames).toContain('Alimentação')
    expect(allNames).toContain('Restaurantes & Delivery')
    expect(allNames).toContain('Dívidas & Empréstimos')
    expect(allNames).toContain('Bebês & Crianças')
    expect(allNames).toContain('Tesouro Direto')
  })

  it('garante presença da subcategoria "Eventos & Reuniões" em Lazer com ícone PartyPopper e ausência de "Shows & Eventos"', () => {
    const lazer = CANONICAL_CATEGORIES.find((c) => c.name === 'Lazer')
    expect(lazer).toBeDefined()
    const lazerSubs = lazer!.subcategories.map((s) => s.name)
    expect(lazerSubs).toContain('Eventos & Reuniões')
    expect(lazerSubs).not.toContain('Shows & Eventos')
    const eventos = lazer!.subcategories.find((s) => s.name === 'Eventos & Reuniões')
    expect(eventos?.icon).toBe('PartyPopper')
  })

  it('proíbe expressamente que STANDARDIZED_CATEGORIES_TREE seja usada como fonte de semeadura do fallback de onboarding', async () => {
    // Carrega o arquivo de serviço de onboarding como texto
    const onboardingSource = await import('../onboarding?raw')
    const sourceContent = onboardingSource.default || ''

    expect(sourceContent.length).toBeGreaterThan(0)

    // O fallback de onboarding DEVE usar CANONICAL_CATEGORIES e NÃO pode iterar sobre STANDARDIZED_CATEGORIES_TREE para INSERT
    // Verifica que o bloco do fallback referencia CANONICAL_CATEGORIES
    expect(sourceContent).toContain('for (let i = 0; i < CANONICAL_CATEGORIES.length; i++)')

    // Verifica que STANDARDIZED_CATEGORIES_TREE NÃO é iterada no fluxo de inserção/fallback
    expect(sourceContent).not.toMatch(
      /for\s*\(.*STANDARDIZED_CATEGORIES_TREE.*\)\s*\{[\s\S]*?insert\(/i,
    )
    expect(sourceContent).not.toMatch(/STANDARDIZED_CATEGORIES_TREE\.forEach\([\s\S]*?insert\(/i)
    expect(sourceContent).not.toMatch(/STANDARDIZED_CATEGORIES_TREE\.map\([\s\S]*?insert\(/i)
  })

  it('verifica que CANONICAL_CATEGORIES contém exatamente as 4 categorias de renda oficiais', () => {
    const incomeCategories = CANONICAL_CATEGORIES.filter((c) => c.type === 'income')
    expect(incomeCategories.length).toBe(4)

    const incomeCategoryNames = incomeCategories.map((c) => c.name)
    const expectedIncomeNames = [
      'Salário',
      'Rendimentos',
      'Trabalhos Extras & Autônomo',
      'Outras Receitas',
    ]

    expect(incomeCategoryNames).toEqual(expect.arrayContaining(expectedIncomeNames))
    expect(expectedIncomeNames).toEqual(expect.arrayContaining(incomeCategoryNames))

    // Baldes de renda devem ser estritamente null
    for (const incCat of incomeCategories) {
      expect(incCat.bucket).toBeNull()
      expect(incCat.subcategories.length).toBeGreaterThan(0)
    }
  })

  it('garante que as migrações SQL mais recentes ativas no banco (create_new_family_workspace e activate_family_onboarding_plan) não contêm termos legados nem inserções incorretas', () => {
    // Carrega todas as migrações SQL via Vite glob com query ?raw (100% tipado no frontend sem depender de types de node)
    const migrationModules = import.meta.glob('../../../supabase/migrations/*.sql', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>

    const filePaths = Object.keys(migrationModules).sort()
    expect(filePaths.length).toBeGreaterThan(0)

    // 1. Encontra a migração mais recente que redefine create_new_family_workspace
    const createWorkspacePaths = filePaths.filter((p) => {
      const content = migrationModules[p]
      return content.includes('CREATE OR REPLACE FUNCTION public.create_new_family_workspace')
    })
    const latestCreateWorkspacePath = createWorkspacePaths[createWorkspacePaths.length - 1]
    expect(latestCreateWorkspacePath).toBeDefined()
    const latestCreateWorkspaceContent = migrationModules[latestCreateWorkspacePath]

    // A definição ativa mais recente de create_new_family_workspace NÃO pode inserir nenhuma categoria ou subcategoria
    expect(latestCreateWorkspaceContent).not.toMatch(/INSERT INTO public\.transaction_categories/i)
    expect(latestCreateWorkspaceContent).not.toMatch(
      /INSERT INTO public\.transaction_subcategories/i,
    )
    expect(latestCreateWorkspaceContent).not.toMatch(/INSERT INTO public\.categorization_rules/i)

    // 2. Encontra a migração mais recente que redefine activate_family_onboarding_plan
    const activatePlanPaths = filePaths.filter((p) => {
      const content = migrationModules[p]
      return content.includes('CREATE OR REPLACE FUNCTION public.activate_family_onboarding_plan')
    })
    const latestActivatePlanPath = activatePlanPaths[activatePlanPaths.length - 1]
    expect(latestActivatePlanPath).toBeDefined()
    const latestActivatePlanContent = migrationModules[latestActivatePlanPath]

    // Lista de termos legados estritamente proibidos
    const legacyTerms = [
      'Alimentação Básica',
      'Transporte Obrigatório',
      'Gastronomia & Delivery',
      'Compras & Vestuário',
      'Lazer & Passeios',
      'Metas & Grandes Sonhos',
      'Investimentos de Longo Prazo',
    ]

    for (const legacyTerm of legacyTerms) {
      expect(
        latestCreateWorkspaceContent,
        `create_new_family_workspace (${latestCreateWorkspacePath}) não deve conter termo legado: ${legacyTerm}`,
      ).not.toContain(legacyTerm)

      expect(
        latestActivatePlanContent,
        `activate_family_onboarding_plan (${latestActivatePlanPath}) não deve conter termo legado: ${legacyTerm}`,
      ).not.toContain(legacyTerm)
    }
  })
})
