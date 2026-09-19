import type { BudgetBucket } from '@/types/finance'

export interface CategoryPresetConfig {
  key: string
  name: string
  bucket: BudgetBucket
  percent: number
  percentAlert?: number
  // Flag especial para categorias de investimento/reserva onde o alerta é ficar ABAIXO do mínimo
  isInvestmentTarget?: boolean
  description: string
}

export interface BudgetPreset {
  id: 'equilibrado' | 'enxuto' | 'acelerador'
  title: string
  subtitle: string
  description: string
  distributionText: string
  bucketDistribution: {
    essentials: number
    lifestyle: number
    future: number
  }
  categories: CategoryPresetConfig[]
}

// 1. Preset Equilibrado Familiar (57% Essenciais / 21% Estilo de Vida / 22% Futuro)
// Matriz sugerida pelo consultor financeiro
const EQUILIBRADO_CATEGORIES: CategoryPresetConfig[] = [
  // Essenciais (57%)
  {
    key: 'moradia',
    name: 'Moradia',
    bucket: 'essentials',
    percent: 25,
    percentAlert: 30,
    description: 'Aluguel, condomínio, luz, água, gás, internet e reparos',
  },
  {
    key: 'alimentacao',
    name: 'Alimentação',
    bucket: 'essentials',
    percent: 12,
    percentAlert: 15,
    description: 'Alimentação básica, supermercado, feira e açougue',
  },
  {
    key: 'transporte',
    name: 'Transporte',
    bucket: 'essentials',
    percent: 10,
    percentAlert: 13,
    description: 'Combustível, transporte público, seguro, IPVA e apps',
  },
  {
    key: 'saude',
    name: 'Saúde',
    bucket: 'essentials',
    percent: 5,
    percentAlert: 8,
    description: 'Plano de saúde, consultas, farmácia e exames',
  },
  {
    key: 'educacao',
    name: 'Educação',
    bucket: 'essentials',
    percent: 5,
    percentAlert: 8,
    description: 'Mensalidades, cursos, material escolar e livros',
  },

  // Estilo de Vida (21%)
  {
    key: 'lazer',
    name: 'Gastronomia & Lazer',
    bucket: 'lifestyle',
    percent: 12,
    percentAlert: 15,
    description: 'Restaurantes, delivery, saídas de fim de semana e passeios',
  },
  {
    key: 'compras',
    name: 'Compras & Desejos',
    bucket: 'lifestyle',
    percent: 6,
    percentAlert: 10,
    description: 'Vestuário, eletrônicos, cuidados pessoais e compras pessoais',
  },
  {
    key: 'assinaturas',
    name: 'Assinaturas & Serviços',
    bucket: 'lifestyle',
    percent: 3,
    percentAlert: 5,
    description: 'Streaming, aplicativos, clubes de assinatura e serviços',
  },

  // Futuro e Metas (22%)
  {
    key: 'reserva',
    name: 'Reserva & Investimentos',
    bucket: 'future',
    percent: 15,
    percentAlert: 10, // Mínimo 10%: alerta por ficar ABAIXO
    isInvestmentTarget: true,
    description: 'Reserva de emergência e investimentos de longo prazo',
  },
  {
    key: 'metas',
    name: 'Metas & Projetos',
    bucket: 'future',
    percent: 7,
    percentAlert: undefined,
    isInvestmentTarget: true,
    description: 'Projetos familiares, viagens, troca de carro e compras planejadas',
  },
]

// 2. Preset Enxuto / Ajuste de Contas (65% Essenciais / 20% Estilo de Vida / 15% Futuro)
// Foco em quitar pendências ou fases de custos essenciais mais elevados
const ENXUTO_CATEGORIES: CategoryPresetConfig[] = [
  // Essenciais (65%)
  {
    key: 'moradia',
    name: 'Moradia',
    bucket: 'essentials',
    percent: 28,
    percentAlert: 33,
    description: 'Custos básicos de habitação e manutenção',
  },
  {
    key: 'alimentacao',
    name: 'Alimentação',
    bucket: 'essentials',
    percent: 14,
    percentAlert: 17,
    description: 'Alimentação básica focada em preparo em casa',
  },
  {
    key: 'transporte',
    name: 'Transporte',
    bucket: 'essentials',
    percent: 11,
    percentAlert: 14,
    description: 'Mobilidade essencial do dia a dia',
  },
  {
    key: 'saude',
    name: 'Saúde',
    bucket: 'essentials',
    percent: 6,
    percentAlert: 9,
    description: 'Cuidados essenciais de saúde e remédios',
  },
  {
    key: 'educacao',
    name: 'Educação',
    bucket: 'essentials',
    percent: 6,
    percentAlert: 9,
    description: 'Educação e formação prioritária',
  },

  // Estilo de Vida (20%)
  {
    key: 'lazer',
    name: 'Gastronomia & Lazer',
    bucket: 'lifestyle',
    percent: 11,
    percentAlert: 14,
    description: 'Lazer controlado para preservar o orçamento',
  },
  {
    key: 'compras',
    name: 'Compras & Desejos',
    bucket: 'lifestyle',
    percent: 6,
    percentAlert: 9,
    description: 'Compras estritamente necessárias',
  },
  {
    key: 'assinaturas',
    name: 'Assinaturas & Serviços',
    bucket: 'lifestyle',
    percent: 3,
    percentAlert: 5,
    description: 'Apenas serviços e assinaturas indispensáveis',
  },

  // Futuro e Metas (15%)
  {
    key: 'reserva',
    name: 'Reserva & Investimentos',
    bucket: 'future',
    percent: 10,
    percentAlert: 8,
    isInvestmentTarget: true,
    description: 'Formação básica de reserva de segurança',
  },
  {
    key: 'metas',
    name: 'Metas & Projetos',
    bucket: 'future',
    percent: 5,
    percentAlert: undefined,
    isInvestmentTarget: true,
    description: 'Fundo para imprevistos e projetos essenciais',
  },
]

// 3. Preset Acelerador Patrimonial (45% Essenciais / 25% Estilo de Vida / 30% Futuro)
// Foco em liberdade financeira, acumulação patrimonial rápida e renda passiva
const ACELERADOR_CATEGORIES: CategoryPresetConfig[] = [
  // Essenciais (45%)
  {
    key: 'moradia',
    name: 'Moradia',
    bucket: 'essentials',
    percent: 20,
    percentAlert: 24,
    description: 'Habitação enxuta e otimizada',
  },
  {
    key: 'alimentacao',
    name: 'Alimentação',
    bucket: 'essentials',
    percent: 10,
    percentAlert: 13,
    description: 'Alimentação básica balanceada',
  },
  {
    key: 'transporte',
    name: 'Transporte',
    bucket: 'essentials',
    percent: 7,
    percentAlert: 10,
    description: 'Custos de locomoção enxutos',
  },
  {
    key: 'saude',
    name: 'Saúde',
    bucket: 'essentials',
    percent: 4,
    percentAlert: 7,
    description: 'Prevenção e cuidados médicos essenciais',
  },
  {
    key: 'educacao',
    name: 'Educação',
    bucket: 'essentials',
    percent: 4,
    percentAlert: 7,
    description: 'Qualificação e livros de alto retorno',
  },

  // Estilo de Vida (25%)
  {
    key: 'lazer',
    name: 'Gastronomia & Lazer',
    bucket: 'lifestyle',
    percent: 14,
    percentAlert: 17,
    description: 'Gastronomia e momentos em família com folga',
  },
  {
    key: 'compras',
    name: 'Compras & Desejos',
    bucket: 'lifestyle',
    percent: 7,
    percentAlert: 10,
    description: 'Conforto e qualidade de vida',
  },
  {
    key: 'assinaturas',
    name: 'Assinaturas & Serviços',
    bucket: 'lifestyle',
    percent: 4,
    percentAlert: 6,
    description: 'Serviços que agregam conveniência e tempo',
  },

  // Futuro e Metas (30%)
  {
    key: 'reserva',
    name: 'Reserva & Investimentos',
    bucket: 'future',
    percent: 20,
    percentAlert: 15,
    isInvestmentTarget: true,
    description: 'Aporte massivo em ativos geradores de renda',
  },
  {
    key: 'metas',
    name: 'Metas & Projetos',
    bucket: 'future',
    percent: 10,
    percentAlert: undefined,
    isInvestmentTarget: true,
    description: 'Grandes conquistas patrimoniais e liberdade financeira',
  },
]

export const BUDGET_PRESETS: BudgetPreset[] = [
  {
    id: 'equilibrado',
    title: 'Equilibrado Familiar',
    subtitle: 'Recomendação de consultores e estudos de finanças',
    description:
      'Ideal para quem busca equilíbrio saudável entre conforto no presente e construção sólida de patrimônio no futuro.',
    distributionText: '57% Essenciais · 21% Estilo de Vida · 22% Futuro',
    bucketDistribution: {
      essentials: 57,
      lifestyle: 21,
      future: 22,
    },
    categories: EQUILIBRADO_CATEGORIES,
  },
  {
    id: 'enxuto',
    title: 'Enxuto / Ajuste de Contas',
    subtitle: 'Para reestruturação ou fases de contas mais apertadas',
    description:
      'Aumenta o espaço para despesas fixas e de subsistência, mantendo a disciplina de poupança mínima de 15%.',
    distributionText: '65% Essenciais · 20% Estilo de Vida · 15% Futuro',
    bucketDistribution: {
      essentials: 65,
      lifestyle: 20,
      future: 15,
    },
    categories: ENXUTO_CATEGORIES,
  },
  {
    id: 'acelerador',
    title: 'Acelerador Patrimonial',
    subtitle: 'Foco total em liberdade financeira e aposentadoria precoce',
    description:
      'Comprime os custos essenciais para permitir 30% da renda líquida destinados a reservas, investimentos e metas.',
    distributionText: '45% Essenciais · 25% Estilo de Vida · 30% Futuro',
    bucketDistribution: {
      essentials: 45,
      lifestyle: 25,
      future: 30,
    },
    categories: ACELERADOR_CATEGORIES,
  },
]

export const BUCKET_METADATA: Record<
  BudgetBucket,
  {
    label: string
    shortLabel: string
    color: string
    bgLight: string
    textColor: string
    icon: string
  }
> = {
  essentials: {
    label: 'Gastos Essenciais',
    shortLabel: 'Essenciais',
    color: '#0284C7', // sky-600
    bgLight: 'bg-sky-50 text-sky-800 border-sky-200',
    textColor: 'text-sky-700',
    icon: 'Home',
  },
  lifestyle: {
    label: 'Estilo de Vida',
    shortLabel: 'Estilo de Vida',
    color: '#D97706', // amber-600
    bgLight: 'bg-amber-50 text-amber-800 border-amber-200',
    textColor: 'text-amber-700',
    icon: 'Coffee',
  },
  future: {
    label: 'Futuro e Metas',
    shortLabel: 'Futuro & Metas',
    color: '#059669', // emerald-600
    bgLight: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    textColor: 'text-emerald-700',
    icon: 'TrendingUp',
  },
}

/**
 * Função utilitária para mapear categoria do banco para a chave da matriz
 * Moradia, Alimentação, Transporte, Saúde, Educação, Gastronomia & Lazer, Compras & Desejos,
 * Assinaturas & Serviços, Reserva & Investimentos, Metas & Projetos
 */
export function matchCategoryToPresetKey(categoryName: string): string | null {
  const norm = categoryName.trim().toLowerCase()

  if (norm.includes('moradia') || norm.includes('habita')) return 'moradia'
  if (norm.includes('alimenta') || norm === 'mercado') return 'alimentacao'
  if (
    norm.includes('transporte') ||
    norm.includes('veículo') ||
    norm.includes('veiculo') ||
    norm.includes('carro')
  )
    return 'transporte'
  if (
    norm.includes('saúde') ||
    norm.includes('saude') ||
    norm.includes('farmácia') ||
    norm.includes('farmacia')
  )
    return 'saude'
  if (norm.includes('educa') || norm.includes('estudo') || norm.includes('escola'))
    return 'educacao'
  if (
    norm.includes('gastronomia') ||
    norm.includes('lazer') ||
    norm.includes('restaurante') ||
    norm.includes('delivery')
  )
    return 'lazer'
  if (
    norm.includes('compras') ||
    norm.includes('desejos') ||
    norm.includes('vestuário') ||
    norm.includes('vestuario')
  )
    return 'compras'
  if (
    norm.includes('assinatura') ||
    norm.includes('serviços') ||
    norm.includes('servicos') ||
    norm.includes('streaming')
  )
    return 'assinaturas'
  if (
    norm.includes('reserva') ||
    norm.includes('investimento') ||
    norm.includes('poupança') ||
    norm.includes('poupanca') ||
    norm.includes('patrimônio') ||
    norm.includes('patrimonio')
  )
    return 'reserva'
  if (norm.includes('meta') || norm.includes('projeto') || norm.includes('sonho')) return 'metas'

  return null
}
