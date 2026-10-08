import { describe, it, expect } from 'vitest'
import { CANONICAL_CATEGORIES } from '@/types/finance'
import { STANDARDIZED_CATEGORIES_TREE } from '@/services/onboarding'

describe('Consistência do Catálogo Canônico Curiangoo (19 categorias / 116 subcategorias)', () => {
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

  it('garante que a soma total de subcategorias canônicas é exatamente 116', () => {
    const totalSubs = CANONICAL_CATEGORIES.reduce((acc, c) => acc + c.subcategories.length, 0)
    expect(totalSubs).toBe(116)

    // 96 subcategorias de despesas
    const expenseSubs = CANONICAL_CATEGORIES.filter((c) => c.type === 'expense').reduce(
      (acc, c) => acc + c.subcategories.length,
      0,
    )
    expect(expenseSubs).toBe(96)

    // 20 subcategorias de receitas
    const incomeSubs = CANONICAL_CATEGORIES.filter((c) => c.type === 'income').reduce(
      (acc, c) => acc + c.subcategories.length,
      0,
    )
    expect(incomeSubs).toBe(20)
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
})
