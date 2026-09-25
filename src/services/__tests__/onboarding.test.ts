import { describe, it, expect, vi } from 'vitest'
import { STANDARDIZED_CATEGORIES_TREE, getCategoryWeightFactor } from '@/services/onboarding'

describe('Seed de Categorias Padronizadas e Onboarding', () => {
  it('contém todos os baldes e categorias requeridas pelo usuário', () => {
    const buckets = STANDARDIZED_CATEGORIES_TREE.map((c) => c.bucket)
    expect(buckets).toContain('essentials')
    expect(buckets).toContain('lifestyle')
    expect(buckets).toContain('future')

    const categoryNames = STANDARDIZED_CATEGORIES_TREE.map((c) => c.name)

    // Necessidades
    expect(categoryNames).toContain('Moradia')
    expect(categoryNames).toContain('Alimentação Básica')
    expect(categoryNames).toContain('Transporte')
    expect(categoryNames).toContain('Saúde')
    expect(categoryNames).toContain('Educação')

    // Estilo de Vida
    expect(categoryNames).toContain('Lazer & Gastronomia')
    expect(categoryNames).toContain('Cuidados Pessoais & Estética')
    expect(categoryNames).toContain('Compras & Desejos')
    expect(categoryNames).toContain('Assinaturas & Serviços')
    expect(categoryNames).toContain('Pets')

    // Futuro & Metas
    expect(categoryNames).toContain('Reserva de Emergência')
    expect(categoryNames).toContain('Investimentos & Aposentadoria')
    expect(categoryNames).toContain('Grandes Projetos')
  })

  it('verifica as subcategorias de moradia, transporte e alimentação', () => {
    const moradia = STANDARDIZED_CATEGORIES_TREE.find((c) => c.name === 'Moradia')
    expect(moradia).toBeDefined()
    const moradiaSubs = moradia?.subcategories.map((s) => s.name)
    expect(moradiaSubs).toEqual(
      expect.arrayContaining([
        'Aluguel/Financiamento',
        'Condomínio',
        'Energia',
        'Água',
        'Gás',
        'Internet/Telefone',
        'Manutenção',
      ]),
    )

    const alimentacao = STANDARDIZED_CATEGORIES_TREE.find((c) => c.name === 'Alimentação Básica')
    expect(alimentacao).toBeDefined()
    const alimSubs = alimentacao?.subcategories.map((s) => s.name)
    expect(alimSubs).toEqual(
      expect.arrayContaining(['Supermercado', 'Hortifruti & Feira', 'Açougue', 'Padaria']),
    )

    const future = STANDARDIZED_CATEGORIES_TREE.find((c) => c.name === 'Reserva de Emergência')
    expect(future?.subcategories.map((s) => s.name)).toContain('Aporte da Reserva')
  })

  it('calcula o fator de ponderação correto por modelo orçamentário', () => {
    // 50/30/20 base = 1.0
    expect(getCategoryWeightFactor('essentials', '50_30_20')).toBe(1.0)
    expect(getCategoryWeightFactor('lifestyle', '50_30_20')).toBe(1.0)
    expect(getCategoryWeightFactor('future', '50_30_20')).toBe(1.0)

    // 60/25/15
    expect(getCategoryWeightFactor('essentials', '60_25_15')).toBeCloseTo(1.2)
    expect(getCategoryWeightFactor('lifestyle', '60_25_15')).toBeCloseTo(25 / 30)
    expect(getCategoryWeightFactor('future', '60_25_15')).toBeCloseTo(0.75)

    // 70/20/10
    expect(getCategoryWeightFactor('essentials', '70_20_10')).toBeCloseTo(1.4)
    expect(getCategoryWeightFactor('lifestyle', '70_20_10')).toBeCloseTo(20 / 30)
    expect(getCategoryWeightFactor('future', '70_20_10')).toBeCloseTo(0.5)
  })
})
