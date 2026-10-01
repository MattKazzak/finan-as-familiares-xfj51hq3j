import { describe, it, expect } from 'vitest'
import { cleanMerchantDescription, toTitleCase } from '../merchant-cleaner'
import {
  BRAZILIAN_MERCHANT_SEEDS,
  matchMerchantSeed,
  resolveCategoryForIntent,
  resolveBrazilianMerchantSeed,
  GenericCategoryInput,
} from '../brazilian-seeds'

describe('Higienizador Determinístico de Adquirentes Brasileiras (merchant-cleaner)', () => {
  it('remove prefixos de adquirentes conhecidas (PAG*, MP*, IFD*, UBR*, etc.)', () => {
    expect(cleanMerchantDescription('PAG*DROGASIL')).toBe('Drogasil')
    expect(cleanMerchantDescription('MP*MERCADOLIVRE')).toBe('Mercadolivre')
    expect(cleanMerchantDescription('IFD*RESTAURANTE SABOR')).toBe('Restaurante Sabor')
    expect(cleanMerchantDescription('UBR* TRIP HELP')).toBe('Trip Help')
    expect(cleanMerchantDescription('STONE*PADARIA')).toBe('Padaria')
    expect(cleanMerchantDescription('CIELO*POSTO SHELL')).toBe('Posto Shell')
    expect(cleanMerchantDescription('SUMUP*LOJA DO ZE')).toBe('Loja Do Ze')
    expect(cleanMerchantDescription('GETNET*FARMACIA')).toBe('Farmacia')
    expect(cleanMerchantDescription('REDE*MERCADO CENTRAL')).toBe('Mercado Central')
    expect(cleanMerchantDescription('PAGARME*CURSO ONLINE')).toBe('Curso Online')
    expect(cleanMerchantDescription('COMPRA IFOOD')).toBe('Ifood')
    expect(cleanMerchantDescription('DEB UBER')).toBe('Uber')
    expect(cleanMerchantDescription('CRED NETFLIX')).toBe('Netflix')
  })

  it('remove múltiplos prefixos encadeados', () => {
    expect(cleanMerchantDescription('COMPRA PAG*MP*DROGASIL')).toBe('Drogasil')
    expect(cleanMerchantDescription('PAG* IFD* HABIB S')).toBe('Habib S')
  })

  it('remove sufixos de parcelas e locais (02/03, PARC 2, SP, RJ, BR, SAO PAULO)', () => {
    // Exemplo solicitado verbatim no requisito: "PAG*DROGASIL 02/03 SP" -> "Drogasil"
    expect(cleanMerchantDescription('PAG*DROGASIL 02/03 SP')).toBe('Drogasil')
    expect(cleanMerchantDescription('DROGASIL 01/10')).toBe('Drogasil')
    expect(cleanMerchantDescription('POSTO IPIRANGA PARC 3 SP')).toBe('Posto Ipiranga')
    expect(cleanMerchantDescription('CARREFOUR BR')).toBe('Carrefour')
    expect(cleanMerchantDescription('RESTAURANTE MINEIRO RJ')).toBe('Restaurante Mineiro')
    expect(cleanMerchantDescription('LOJA EXEMPLO SAO PAULO')).toBe('Loja Exemplo')
  })

  it('preserva siglas bancárias conhecidas em maiúsculo (XP, C6, BTG, etc.)', () => {
    expect(cleanMerchantDescription('XP INVESTIMENTOS')).toBe('XP Investimentos')
    expect(cleanMerchantDescription('BANCO C6')).toBe('Banco C6')
    expect(cleanMerchantDescription('BTG PACTUAL')).toBe('BTG Pactual')
  })

  it('lida com entradas vazias ou nulas com segurança', () => {
    expect(cleanMerchantDescription('')).toBe('')
    expect(cleanMerchantDescription('   ')).toBe('')
    expect(cleanMerchantDescription(null as any)).toBe('')
  })
})

describe('Seed Brasileiro em Código (Camada Determinística Rápida)', () => {
  const familyCatalog: GenericCategoryInput[] = [
    {
      id: 'cat-moradia',
      name: 'Moradia',
      type: 'expense',
      budget_bucket: 'essentials',
      subcategories: [{ id: 'sub-aluguel', name: 'Aluguel' }],
    },
    {
      id: 'cat-alimentacao',
      name: 'Alimentação',
      type: 'expense',
      budget_bucket: 'essentials',
      subcategories: [
        { id: 'sub-mercado', name: 'Mercado' },
        { id: 'sub-delivery', name: 'Delivery' },
        { id: 'sub-restaurantes', name: 'Restaurantes' },
      ],
    },
    {
      id: 'cat-transporte',
      name: 'Transporte & Mobilidade',
      type: 'expense',
      budget_bucket: 'essentials',
      subcategories: [
        { id: 'sub-combustivel', name: 'Combustível' },
        { id: 'sub-apps', name: 'Aplicativos' },
      ],
    },
    {
      id: 'cat-saude',
      name: 'Saúde & Cuidados Médicos',
      type: 'expense',
      budget_bucket: 'essentials',
      subcategories: [
        { id: 'sub-farmacia', name: 'Farmácia' },
        { id: 'sub-consultas', name: 'Consultas' },
      ],
    },
    {
      id: 'cat-educacao',
      name: 'Educação & Desenvolvimento',
      type: 'expense',
      budget_bucket: 'lifestyle',
      subcategories: [{ id: 'sub-cursos', name: 'Cursos & Treinamentos' }],
    },
    {
      id: 'cat-estilo',
      name: 'Estilo de Vida',
      type: 'expense',
      budget_bucket: 'lifestyle',
      subcategories: [{ id: 'sub-lazer', name: 'Lazer' }],
    },
    {
      id: 'cat-outros',
      name: 'Outros / Diversos',
      type: 'expense',
      budget_bucket: 'lifestyle',
      subcategories: [],
    },
  ]

  it('reconhece estabelecimentos de Alimentação/Mercado solicitados verbatim', () => {
    const list = [
      'ifood',
      'ze delivery',
      'carrefour',
      'pao de acucar',
      'assai',
      'atacadao',
      'mcdonalds',
      'outback',
      'burger king',
      'spoleto',
    ]

    for (const merchant of list) {
      const match = matchMerchantSeed(merchant)
      expect(match).not.toBeNull()
      expect(match?.intent).toBe('alimentacao_mercado')

      const res = resolveBrazilianMerchantSeed(merchant, familyCatalog)
      expect(res).not.toBeNull()
      expect(res?.categoryId).toBe('cat-alimentacao')
      expect(res?.confidence).toBeGreaterThanOrEqual(0.95)
    }
  })

  it('reconhece estabelecimentos de Mobilidade solicitados verbatim', () => {
    const list = [
      'uber',
      '99app',
      '99 tecnologia',
      'sem parar',
      'veloe',
      'shell',
      'ipiranga',
      'posto',
    ]

    for (const merchant of list) {
      const match = matchMerchantSeed(merchant)
      expect(match).not.toBeNull()
      expect(match?.intent).toBe('mobilidade_transporte')

      const res = resolveBrazilianMerchantSeed(merchant, familyCatalog)
      expect(res).not.toBeNull()
      expect(res?.categoryId).toBe('cat-transporte')
    }
  })

  it('evita falsos positivos em "posto" (ex.: "imposto" não deve casar mobilidade)', () => {
    const match = matchMerchantSeed('PAGAMENTO IMPOSTO RENDA')
    expect(match).toBeNull()
  })

  it('reconhece assinaturas solicitadas verbatim', () => {
    const list = [
      'netflix',
      'spotify',
      'amazon prime',
      'max',
      'disney',
      'apple',
      'google',
      'openai',
      'chatgpt',
      'youtube',
    ]

    for (const merchant of list) {
      const match = matchMerchantSeed(merchant)
      expect(match).not.toBeNull()
      expect(match?.intent).toBe('assinaturas_streaming')
    }
  })

  it('reconhece farmácia/saúde solicitadas verbatim', () => {
    const list = [
      'droga raia',
      'drogasil',
      'pacheco',
      'panvel',
      'pague menos',
      'dpsp',
      'consulta',
      'clinica',
    ]

    for (const merchant of list) {
      const match = matchMerchantSeed(merchant)
      expect(match).not.toBeNull()
      expect(match?.intent).toBe('farmacia_saude')

      const res = resolveBrazilianMerchantSeed(merchant, familyCatalog)
      expect(res).not.toBeNull()
      expect(res?.categoryId).toBe('cat-saude')
      expect(res?.subcategoryId).toBe('sub-farmacia')
    }
  })

  it('reconhece educação/infoprodutos e NUNCA classifica como Moradia ou Alimentação', () => {
    const list = [
      'hotmart',
      'kiwify',
      'eduzz',
      'monetizze',
      'cpt',
      'alura',
      'udemy',
      'instagram milionario',
    ]

    for (const merchant of list) {
      const match = matchMerchantSeed(merchant)
      expect(match).not.toBeNull()
      expect(match?.intent).toBe('educacao_cursos')

      // No catálogo com Educação:
      const res = resolveBrazilianMerchantSeed(merchant, familyCatalog)
      expect(res).not.toBeNull()
      expect(res?.categoryId).toBe('cat-educacao')

      // No catálogo SEM Educação: deve mapear para Estilo de Vida (lifestyle) ou Outros, JAMAIS Moradia ou Alimentação!
      const catalogWithoutEducation: GenericCategoryInput[] = [
        { id: 'cat-moradia', name: 'Moradia', type: 'expense', budget_bucket: 'essentials' },
        {
          id: 'cat-alimentacao',
          name: 'Alimentação',
          type: 'expense',
          budget_bucket: 'essentials',
        },
        {
          id: 'cat-lifestyle',
          name: 'Estilo de Vida',
          type: 'expense',
          budget_bucket: 'lifestyle',
        },
        {
          id: 'cat-outros',
          name: 'Outros / Diversos',
          type: 'expense',
          budget_bucket: 'lifestyle',
        },
      ]

      const resFallback = resolveBrazilianMerchantSeed(merchant, catalogWithoutEducation)
      expect(resFallback).not.toBeNull()
      expect(resFallback?.categoryId).not.toBe('cat-moradia')
      expect(resFallback?.categoryId).not.toBe('cat-alimentacao')
      expect(['cat-lifestyle', 'cat-outros']).toContain(resFallback?.categoryId)
    }
  })
})
