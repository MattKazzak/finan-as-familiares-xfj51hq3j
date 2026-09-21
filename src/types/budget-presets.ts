/**
 * Finanças Familiares - Types para Modelos/Presets de Orçamento
 *
 * Presets de orçamento com base em metodologias consagradas de finanças pessoais:
 * 1. 50/30/20 (Equilibrado / Elizabeth Warren)
 * 2. 60/20/20 (Foco no Futuro / Construção de Patrimônio)
 * 3. 70/20/10 (Vida Confortável / Família em Crescimento)
 */

import { BudgetBucket } from './finance'

export interface CategoryPresetConfig {
  /** Nome amigável / rótulo da categoria no modelo */
  name: string
  /** Chave normalizada para match resiliente (minúsculo, sem acentos) */
  matchKey: string
  /** Balde ao qual a categoria pertence */
  bucket: BudgetBucket
  /** Percentual sugerido sobre a renda líquida */
  percent: number
  /** Descrição explicativa do porquê desse valor no modelo */
  description?: string
}

export interface BudgetPreset {
  id: string
  name: string
  shortDescription: string
  fullDescription: string
  recommendedFor: string
  badgeText?: string
  /** Divisão por baldes: Essenciais, Estilo de Vida, Futuro & Metas */
  bucketDistribution: {
    essentials: number // %
    lifestyle: number // %
    future: number // %
  }
  /** Categorias com percentuais padrão */
  categories: CategoryPresetConfig[]
}

export type BudgetPresetId = '50_30_20' | '60_20_20' | '70_20_10'

export const BUCKET_METADATA: Record<
  BudgetBucket,
  {
    name: string
    shortLabel: string
    color: string
    bgLight: string
    borderColor: string
    textColor: string
    description: string
  }
> = {
  essentials: {
    name: 'Essenciais (Necessidades)',
    shortLabel: 'Essenciais',
    color: '#0284C7', // sky-600
    bgLight: 'bg-sky-50 text-sky-800 border-sky-200',
    borderColor: 'border-sky-500',
    textColor: 'text-sky-700',
    description: 'Moradia, alimentação básica, saúde, contas essenciais e transporte necessário.',
  },
  lifestyle: {
    name: 'Estilo de Vida (Desejos & Conforto)',
    shortLabel: 'Estilo de Vida',
    color: '#D97706', // amber-600
    bgLight: 'bg-amber-50 text-amber-800 border-amber-200',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-700',
    description: 'Lazer, restaurantes, compras, hobbies, streaming e conforto pessoal.',
  },
  future: {
    name: 'Futuro & Metas (Investimentos & Reserva)',
    shortLabel: 'Futuro & Metas',
    color: '#059669', // emerald-600
    bgLight: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    borderColor: 'border-emerald-500',
    textColor: 'text-emerald-700',
    description: 'Reserva de emergência, aposentadoria, investimentos e objetivos de longo prazo.',
  },
}

export const BUDGET_PRESET_ITEMS: BudgetPreset[] = [
  {
    id: '50_30_20',
    name: 'Regra 50 / 30 / 20 (Equilibrado)',
    shortDescription:
      'O padrão de ouro das finanças: 50% necessidades, 30% estilo de vida, 20% futuro.',
    fullDescription:
      'Ideal para famílias que buscam equilíbrio entre viver bem no presente e construir segurança financeira para o futuro.',
    recommendedFor: 'Recomendado para a maioria das famílias com renda estável.',
    badgeText: 'Mais Popular',
    bucketDistribution: {
      essentials: 50,
      lifestyle: 30,
      future: 20,
    },
    categories: [
      {
        name: 'Moradia & Contas',
        matchKey: 'moradia',
        bucket: 'essentials',
        percent: 25,
        description: 'Aluguel/financiamento, condomínio, luz, água, internet',
      },
      {
        name: 'Alimentação & Mercado',
        matchKey: 'alimentacao',
        bucket: 'essentials',
        percent: 15,
        description: 'Supermercado, feira e alimentação básica em casa',
      },
      {
        name: 'Transporte',
        matchKey: 'transporte',
        bucket: 'essentials',
        percent: 10,
        description: 'Combustível, transporte público, manutenção essencial do veículo',
      },
      {
        name: 'Lazer & Restaurantes',
        matchKey: 'lazer',
        bucket: 'lifestyle',
        percent: 12,
        description: 'Passeios, refeições fora, cinema e entretenimento',
      },
      {
        name: 'Compras & Pessoais',
        matchKey: 'compras',
        bucket: 'lifestyle',
        percent: 10,
        description: 'Roupas, cuidados pessoais, tecnologia e conveniências',
      },
      {
        name: 'Assinaturas & Serviços',
        matchKey: 'servicos',
        bucket: 'lifestyle',
        percent: 8,
        description: 'Streaming, academias, clubes e assinaturas diversas',
      },
      {
        name: 'Reserva de Emergência & Aportes',
        matchKey: 'reserva',
        bucket: 'future',
        percent: 12,
        description: 'Construção ou manutenção da reserva de 6 meses',
      },
      {
        name: 'Investimentos & Projetos',
        matchKey: 'investimentos',
        bucket: 'future',
        percent: 8,
        description: 'Previdência, aposentadoria e metas familiares de longo prazo',
      },
    ],
  },
  {
    id: '60_20_20',
    name: 'Modelo 60 / 20 / 20 (Foco em Essenciais)',
    shortDescription:
      'Mais folga para custos fixos altos: 60% essenciais, 20% estilo de vida, 20% futuro.',
    fullDescription:
      'Projetado para famílias com custos fixos elevados (moradia em capitais, filhos em idade escolar, saúde).',
    recommendedFor:
      'Famílias com aluguel alto, despesas médicas contínuas ou mensalidades escolares.',
    badgeText: 'Custo Fixo Alto',
    bucketDistribution: {
      essentials: 60,
      lifestyle: 20,
      future: 20,
    },
    categories: [
      {
        name: 'Moradia & Contas',
        matchKey: 'moradia',
        bucket: 'essentials',
        percent: 30,
        description: 'Moradia, condomínio e serviços básicos',
      },
      {
        name: 'Alimentação & Mercado',
        matchKey: 'alimentacao',
        bucket: 'essentials',
        percent: 18,
        description: 'Compras de supermercado para toda a família',
      },
      {
        name: 'Transporte',
        matchKey: 'transporte',
        bucket: 'essentials',
        percent: 12,
        description: 'Custos de deslocamento e manutenção',
      },
      {
        name: 'Lazer & Restaurantes',
        matchKey: 'lazer',
        bucket: 'lifestyle',
        percent: 8,
        description: 'Momentos de descanso e lazer moderados',
      },
      {
        name: 'Compras & Pessoais',
        matchKey: 'compras',
        bucket: 'lifestyle',
        percent: 7,
        description: 'Gastos pessoais essenciais e vestuário',
      },
      {
        name: 'Assinaturas & Serviços',
        matchKey: 'servicos',
        bucket: 'lifestyle',
        percent: 5,
        description: 'Serviços digitais e assinaturas prioritárias',
      },
      {
        name: 'Reserva de Emergência & Aportes',
        matchKey: 'reserva',
        bucket: 'future',
        percent: 12,
        description: 'Blindagem financeira familiar prioritária',
      },
      {
        name: 'Investimentos & Projetos',
        matchKey: 'investimentos',
        bucket: 'future',
        percent: 8,
        description: 'Construção contínua de patrimônio',
      },
    ],
  },
  {
    id: '70_20_10',
    name: 'Modelo 70 / 20 / 10 (Transição & Organização)',
    shortDescription:
      'Passo a passo para quem está começando: 70% essenciais, 20% estilo de vida, 10% futuro.',
    fullDescription:
      'Excelente ponto de partida para famílias em fase de reestruturação de dívidas ou organização inicial das finanças.',
    recommendedFor: 'Iniciantes na organização financeira ou fase de transição de carreira.',
    badgeText: 'Iniciantes',
    bucketDistribution: {
      essentials: 70,
      lifestyle: 20,
      future: 10,
    },
    categories: [
      {
        name: 'Moradia & Contas',
        matchKey: 'moradia',
        bucket: 'essentials',
        percent: 35,
        description: 'Custos de habitação e contas de consumo',
      },
      {
        name: 'Alimentação & Mercado',
        matchKey: 'alimentacao',
        bucket: 'essentials',
        percent: 22,
        description: 'Alimentação doméstica completa',
      },
      {
        name: 'Transporte',
        matchKey: 'transporte',
        bucket: 'essentials',
        percent: 13,
        description: 'Mobilidade da família',
      },
      {
        name: 'Lazer & Restaurantes',
        matchKey: 'lazer',
        bucket: 'lifestyle',
        percent: 10,
        description: 'Conforto e descanso familiar',
      },
      {
        name: 'Compras & Pessoais',
        matchKey: 'compras',
        bucket: 'lifestyle',
        percent: 6,
        description: 'Necessidades pontuais',
      },
      {
        name: 'Assinaturas & Serviços',
        matchKey: 'servicos',
        bucket: 'lifestyle',
        percent: 4,
        description: 'Serviços básicos de entretenimento',
      },
      {
        name: 'Reserva de Emergência & Aportes',
        matchKey: 'reserva',
        bucket: 'future',
        percent: 6,
        description: 'Primeiros passos da reserva financeira',
      },
      {
        name: 'Investimentos & Projetos',
        matchKey: 'investimentos',
        bucket: 'future',
        percent: 4,
        description: 'Hábito de poupar consistentemente todo mês',
      },
    ],
  },
]

// Mantém suporte tanto a array quanto a Record para compatibilidade
export const BUDGET_PRESETS: any = Object.assign([...BUDGET_PRESET_ITEMS], {
  '50_30_20': BUDGET_PRESET_ITEMS[0],
  '60_20_20': BUDGET_PRESET_ITEMS[1],
  '70_20_10': BUDGET_PRESET_ITEMS[2],
})

/**
 * Normaliza uma string para matching resiliente (sem acentos, minúsculo, sem pontuação).
 */
export function normalizeCategoryMatchString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Associa uma categoria do banco a uma chave de preset através de correspondência flexível.
 */
export function matchCategoryToPresetKey(categoryName: string): string | null {
  const norm = normalizeCategoryMatchString(categoryName)

  if (
    norm.includes('moradia') ||
    norm.includes('habit') ||
    norm.includes('casa') ||
    norm.includes('conta')
  ) {
    return 'moradia'
  }
  if (
    norm.includes('alimenta') ||
    norm.includes('mercado') ||
    norm.includes('supermercado') ||
    norm.includes('feira')
  ) {
    return 'alimentacao'
  }
  if (
    norm.includes('transporte') ||
    norm.includes('carro') ||
    norm.includes('combust') ||
    norm.includes('uber')
  ) {
    return 'transporte'
  }
  if (
    norm.includes('lazer') ||
    norm.includes('restaurante') ||
    norm.includes('bar') ||
    norm.includes('viagem') ||
    norm.includes('passeio')
  ) {
    return 'lazer'
  }
  if (
    norm.includes('compra') ||
    norm.includes('vestu') ||
    norm.includes('roupa') ||
    norm.includes('eletr') ||
    norm.includes('pessoal')
  ) {
    return 'compras'
  }
  if (
    norm.includes('servico') ||
    norm.includes('assinatura') ||
    norm.includes('stream') ||
    norm.includes('academia') ||
    norm.includes('internet')
  ) {
    return 'servicos'
  }
  if (norm.includes('reserva') || norm.includes('emergenc') || norm.includes('poupanca')) {
    return 'reserva'
  }
  if (
    norm.includes('invest') ||
    norm.includes('aporte') ||
    norm.includes('meta') ||
    norm.includes('projeto') ||
    norm.includes('futuro')
  ) {
    return 'investimentos'
  }

  return null
}
