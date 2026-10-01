import { describe, it, expect, vi } from 'vitest'
import {
  STANDARDIZED_CATEGORIES_TREE,
  getCategoryWeightFactor,
  seedStandardizedCategoriesAndApplyPlan,
} from '@/services/onboarding'
import * as familyService from '@/services/family'

describe('Seed de Categorias Padronizadas e Onboarding', () => {
  it('contém todos os baldes e categorias requeridas pelo usuário', () => {
    const buckets = STANDARDIZED_CATEGORIES_TREE.map((c) => c.bucket)
    expect(buckets).toContain('essentials')
    expect(buckets).toContain('lifestyle')
    expect(buckets).toContain('future')

    const categoryNames = STANDARDIZED_CATEGORIES_TREE.map((c) => c.name)

    // Necessidades (5)
    expect(categoryNames).toContain('Moradia')
    expect(categoryNames).toContain('Alimentação Básica')
    expect(categoryNames).toContain('Transporte Obrigatório')
    expect(categoryNames).toContain('Saúde & Cuidados Médicos')
    expect(categoryNames).toContain('Educação Obrigatória')

    // Estilo de Vida (6)
    expect(categoryNames).toContain('Gastronomia & Delivery')
    expect(categoryNames).toContain('Lazer & Passeios')
    expect(categoryNames).toContain('Cuidados Pessoais & Bem-estar')
    expect(categoryNames).toContain('Assinaturas & Conectividade')
    expect(categoryNames).toContain('Compras & Vestuário')
    expect(categoryNames).toContain('Pets')

    // Futuro & Metas (3)
    expect(categoryNames).toContain('Reserva de Emergência')
    expect(categoryNames).toContain('Metas & Grandes Sonhos')
    expect(categoryNames).toContain('Investimentos de Longo Prazo')

    expect(categoryNames.length).toBe(14)
  })

  it('verifica que a árvore padronizada possui exatamente as subcategorias e keywords esperadas', () => {
    const categoriesWithSubs = STANDARDIZED_CATEGORIES_TREE.filter(
      (c) => c.subcategories.length > 0,
    )
    expect(categoriesWithSubs.length).toBe(14)
    const totalSubcategories = STANDARDIZED_CATEGORIES_TREE.reduce(
      (acc, c) => acc + c.subcategories.length,
      0,
    )
    expect(totalSubcategories).toBe(55)
  })

  it('verifica as subcategorias de moradia, transporte e alimentação', () => {
    const moradia = STANDARDIZED_CATEGORIES_TREE.find((c) => c.name === 'Moradia')
    expect(moradia).toBeDefined()
    const moradiaSubs = moradia?.subcategories.map((s) => s.name)
    expect(moradiaSubs).toEqual(
      expect.arrayContaining([
        'Aluguel / Condomínio',
        'Energia Elétrica',
        'Água & Saneamento',
        'Gás',
        'Internet & Fixo',
        'Manutenção da Casa',
      ]),
    )

    const alimentacao = STANDARDIZED_CATEGORIES_TREE.find((c) => c.name === 'Alimentação Básica')
    expect(alimentacao).toBeDefined()
    const alimSubs = alimentacao?.subcategories.map((s) => s.name)
    expect(alimSubs).toEqual(
      expect.arrayContaining([
        'Supermercado',
        'Açougue & Peixaria',
        'Hortifruti & Feira',
        'Padaria do Dia a Dia',
      ]),
    )

    const future = STANDARDIZED_CATEGORIES_TREE.find((c) => c.name === 'Reserva de Emergência')
    expect(future?.subcategories.map((s) => s.name)).toContain('Aportes na Reserva')
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

  it('chama activateFamilyOnboardingPlanRpc via seedStandardizedCategoriesAndApplyPlan com parâmetros corretos', async () => {
    const rpcSpy = vi
      .spyOn(familyService, 'activateFamilyOnboardingPlanRpc')
      .mockResolvedValueOnce({
        success: true,
        family_id: 'fam-123',
        monthly_net_income_cents: 500000,
        model_preset_id: '50_30_20',
        categories_count: 16,
        subcategories_count: 55,
        total_budget_cents: 500000,
      })

    const result = await seedStandardizedCategoriesAndApplyPlan({
      familyId: 'fam-123',
      monthlyNetIncomeCents: 500000,
      modelPresetId: '50_30_20',
    })

    expect(rpcSpy).toHaveBeenCalledWith({
      familyId: 'fam-123',
      monthlyNetIncomeCents: 500000,
      modelPresetId: '50_30_20',
    })

    expect(result).toEqual({
      createdCategoriesCount: 16,
      createdSubcategoriesCount: 55,
      totalBudgetCents: 500000,
    })

    rpcSpy.mockRestore()
  })

  it('quando modelo 60_25_15 é selecionado, activateFamilyOnboardingPlanRpc recebe modelPresetId="60_25_15"', async () => {
    const rpcSpy = vi
      .spyOn(familyService, 'activateFamilyOnboardingPlanRpc')
      .mockResolvedValueOnce({
        success: true,
        family_id: 'fam-60-25-15',
        monthly_net_income_cents: 600000,
        model_preset_id: '60_25_15',
        categories_count: 16,
        subcategories_count: 55,
        total_budget_cents: 600000,
      })

    const result = await seedStandardizedCategoriesAndApplyPlan({
      familyId: 'fam-60-25-15',
      monthlyNetIncomeCents: 600000,
      modelPresetId: '60_25_15',
    })

    expect(rpcSpy).toHaveBeenCalledWith({
      familyId: 'fam-60-25-15',
      monthlyNetIncomeCents: 600000,
      modelPresetId: '60_25_15',
    })

    expect(result).toEqual({
      createdCategoriesCount: 16,
      createdSubcategoriesCount: 55,
      totalBudgetCents: 600000,
    })

    rpcSpy.mockRestore()
  })
})
