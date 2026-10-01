import { describe, it, expect } from 'vitest'
import { normalizeMerchantString } from '../brazilian-seeds'

/**
 * Testes de regressão da nova regra de fallback inteligente:
 * - Fim do Fallback Cego para `categories[0]` (Bug Crítico)
 * - Se a IA sugerir categoria inexistente ou tiver baixa confiança:
 *   * Procura categoria com semântica de "Outros / Diversos" ou "Estilo de Vida".
 *   * Se não existir, retorna `categoryId: null` com `needsReview: true`.
 *   * JAMAIS retorna categories[0] (Moradia/Alimentação).
 */

function resolveSafeFallbackCategory(categoriesList: any[]): {
  categoryId: string | null
  needsReview: boolean
} {
  if (!categoriesList || categoriesList.length === 0) {
    return { categoryId: null, needsReview: true }
  }

  // 1. Procura por nome com semântica de "Outros", "Diversos" ou "Outras Despesas"
  const outrosCat = categoriesList.find((c: any) => {
    if (c.type && c.type !== 'expense') return false
    const norm = normalizeMerchantString(c.name || '')
    return (
      norm.includes('outro') ||
      norm.includes('diverso') ||
      norm === 'outros' ||
      norm === 'diversos' ||
      norm.includes('despesas diversas')
    )
  })
  if (outrosCat?.id) {
    return { categoryId: outrosCat.id, needsReview: false }
  }

  // 2. Procura categoria no balde "lifestyle" (Estilo de Vida), exceto essenciais como Moradia/Alimentação
  const lifestyleCat = categoriesList.find((c: any) => {
    if (c.type && c.type !== 'expense') return false
    if (c.budget_bucket === 'lifestyle') {
      const norm = normalizeMerchantString(c.name || '')
      return (
        !norm.includes('moradia') &&
        !norm.includes('alimentacao') &&
        !norm.includes('aluguel') &&
        !norm.includes('supermercado')
      )
    }
    const norm = normalizeMerchantString(c.name || '')
    return norm.includes('estilo de vida')
  })
  if (lifestyleCat?.id) {
    return { categoryId: lifestyleCat.id, needsReview: false }
  }

  // 3. Se não existir categoria de Outros/Diversos nem Estilo de Vida:
  // Retorna categoryId: null com needsReview: true para que o usuário decida conscientemente
  return { categoryId: null, needsReview: true }
}

describe('Novo Fallback de Categorização sem Contaminação Cega', () => {
  it('quando a categoria sugerida não existe, mapeia para "Outros / Diversos" se disponível', () => {
    const categories = [
      { id: 'cat-moradia', name: 'Moradia', type: 'expense', budget_bucket: 'essentials' },
      { id: 'cat-alimentacao', name: 'Alimentação', type: 'expense', budget_bucket: 'essentials' },
      { id: 'cat-outros', name: 'Outros / Diversos', type: 'expense', budget_bucket: 'lifestyle' },
    ]

    const fallback = resolveSafeFallbackCategory(categories)
    expect(fallback.categoryId).toBe('cat-outros')
    expect(fallback.needsReview).toBe(false)
    expect(fallback.categoryId).not.toBe('cat-moradia')
    expect(fallback.categoryId).not.toBe(categories[0].id)
  })

  it('quando "Outros" não existe, mapeia para categoria de "Estilo de Vida" (lifestyle)', () => {
    const categories = [
      { id: 'cat-moradia', name: 'Moradia', type: 'expense', budget_bucket: 'essentials' },
      { id: 'cat-transporte', name: 'Transporte', type: 'expense', budget_bucket: 'essentials' },
      { id: 'cat-lazer', name: 'Lazer e Hobbies', type: 'expense', budget_bucket: 'lifestyle' },
    ]

    const fallback = resolveSafeFallbackCategory(categories)
    expect(fallback.categoryId).toBe('cat-lazer')
    expect(fallback.needsReview).toBe(false)
    expect(fallback.categoryId).not.toBe('cat-moradia')
    expect(fallback.categoryId).not.toBe(categories[0].id)
  })

  it('quando NÃO existe Outros nem Estilo de Vida, retorna categoryId: null e needsReview: true (NUNCA categories[0])', () => {
    const categories = [
      { id: 'cat-moradia', name: 'Moradia', type: 'expense', budget_bucket: 'essentials' },
      { id: 'cat-alimentacao', name: 'Alimentação', type: 'expense', budget_bucket: 'essentials' },
      { id: 'cat-saude', name: 'Saúde', type: 'expense', budget_bucket: 'essentials' },
    ]

    const fallback = resolveSafeFallbackCategory(categories)
    expect(fallback.categoryId).toBeNull()
    expect(fallback.needsReview).toBe(true)
    expect(fallback.categoryId).not.toBe(categories[0].id)
    expect(fallback.categoryId).not.toBe('cat-moradia')
  })

  it('lida com lista vazia de categorias retornando null e needsReview: true', () => {
    const fallback = resolveSafeFallbackCategory([])
    expect(fallback.categoryId).toBeNull()
    expect(fallback.needsReview).toBe(true)
  })
})
