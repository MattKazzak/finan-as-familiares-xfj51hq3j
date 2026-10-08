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
  /** Legenda explicativa com embasamento científico / especialista / literatura */
  sourceCaption?: string
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
    color: '#14213D', // slate-900 / navy oficial
    bgLight: 'bg-slate-100/90 text-slate-800 border-slate-200',
    borderColor: 'border-slate-800',
    textColor: 'text-slate-900',
    description: 'Moradia, alimentação básica, saúde, contas essenciais e transporte necessário.',
  },
  lifestyle: {
    name: 'Estilo de Vida (Desejos & Conforto)',
    shortLabel: 'Estilo de Vida',
    color: '#FCA311', // amber suave / ocre oficial
    bgLight: 'bg-amber-50/70 text-amber-900 border-amber-200/80',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-800',
    description: 'Lazer, restaurantes, compras, hobbies, streaming e conforto pessoal.',
  },
  future: {
    name: 'Futuro & Metas (Investimentos & Reserva)',
    shortLabel: 'Futuro & Metas',
    color: '#10B981', // esmeralda calmo
    bgLight: 'bg-emerald-50/70 text-emerald-900 border-emerald-200/80',
    borderColor: 'border-emerald-500',
    textColor: 'text-emerald-800',
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
    sourceCaption:
      "Baseada na regra popularizada por Elizabeth Warren (ex-professora de direito de falências de Harvard, livro 'All Your Worth', 2005) — referência mundial de equilíbrio financeiro familiar.",
    bucketDistribution: {
      essentials: 50,
      lifestyle: 30,
      future: 20,
    },
    categories: [
      {
        name: 'Moradia',
        matchKey: 'moradia',
        bucket: 'essentials',
        percent: 20,
        description: 'Aluguel, condomínio, luz, água, gás, internet, manutenção',
      },
      {
        name: 'Alimentação',
        matchKey: 'alimentacao',
        bucket: 'essentials',
        percent: 14,
        description: 'Supermercado, feira, açougue, padaria do dia a dia',
      },
      {
        name: 'Transporte',
        matchKey: 'transporte',
        bucket: 'essentials',
        percent: 8,
        description: 'Combustível, transporte público, Uber/99, pedágio, seguro',
      },
      {
        name: 'Saúde',
        matchKey: 'saude',
        bucket: 'essentials',
        percent: 5,
        description: 'Plano de saúde, farmácia, exames, dentista',
      },
      {
        name: 'Educação',
        matchKey: 'educacao',
        bucket: 'essentials',
        percent: 3,
        description: 'Mensalidade escolar/faculdade, materiais, transporte escolar',
      },
      {
        name: 'Dívidas & Empréstimos',
        matchKey: 'dividas',
        bucket: 'essentials',
        percent: 0,
        description: 'Fatura do cartão, empréstimos, financiamentos e cheque especial',
      },
      {
        name: 'Restaurantes & Delivery',
        matchKey: 'gastronomia',
        bucket: 'lifestyle',
        percent: 10,
        description: 'Restaurantes, bares, delivery iFood/Rappi, cafeterias, fast food',
      },
      {
        name: 'Lazer',
        matchKey: 'lazer',
        bucket: 'lifestyle',
        percent: 5,
        description: 'Cinema, shows, viagens, passeios de fim de semana',
      },
      {
        name: 'Cuidados Pessoais & Bem-estar',
        matchKey: 'cuidados',
        bucket: 'lifestyle',
        percent: 5,
        description: 'Barbearia/salão, estética, cosméticos, academia',
      },
      {
        name: 'Assinaturas & Apps',
        matchKey: 'servicos',
        bucket: 'lifestyle',
        percent: 3,
        description: 'Streaming, música, softwares e apps',
      },
      {
        name: 'Compras',
        matchKey: 'compras',
        bucket: 'lifestyle',
        percent: 4,
        description: 'Roupas, calçados, eletrônicos, utilidades, presentes',
      },
      {
        name: 'Pets',
        matchKey: 'pets',
        bucket: 'lifestyle',
        percent: 3,
        description: 'Ração, pet shop, veterinário, banho e tosa',
      },
      {
        name: 'Reserva de Emergência',
        matchKey: 'reserva',
        bucket: 'future',
        percent: 10,
        description: 'Aportes e manutenção da reserva de emergência',
      },
      {
        name: 'Metas',
        matchKey: 'metas',
        bucket: 'future',
        percent: 4,
        description: 'Troca de carro, casa própria, viagens internacionais',
      },
      {
        name: 'Investimentos',
        matchKey: 'investimentos',
        bucket: 'future',
        percent: 6,
        description: 'Previdência, ações, fundos imobiliários, aposentadoria',
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
    sourceCaption:
      'Variação da regra 50/30/20 adaptada para famílias com custos fixos elevados — abordagem recorrente em metodologias de organização financeira doméstica.',
    bucketDistribution: {
      essentials: 60,
      lifestyle: 20,
      future: 20,
    },
    categories: [
      {
        name: 'Moradia',
        matchKey: 'moradia',
        bucket: 'essentials',
        percent: 24,
        description: 'Habitação e contas essenciais da casa',
      },
      {
        name: 'Alimentação',
        matchKey: 'alimentacao',
        bucket: 'essentials',
        percent: 16,
        description: 'Supermercado e alimentação básica',
      },
      {
        name: 'Transporte',
        matchKey: 'transporte',
        bucket: 'essentials',
        percent: 10,
        description: 'Custos de deslocamento e manutenção',
      },
      {
        name: 'Saúde',
        matchKey: 'saude',
        bucket: 'essentials',
        percent: 6,
        description: 'Plano de saúde e medicamentos',
      },
      {
        name: 'Educação',
        matchKey: 'educacao',
        bucket: 'essentials',
        percent: 4,
        description: 'Mensalidades escolares e materiais',
      },
      {
        name: 'Dívidas & Empréstimos',
        matchKey: 'dividas',
        bucket: 'essentials',
        percent: 0,
        description: 'Fatura do cartão, empréstimos e financiamentos',
      },
      {
        name: 'Restaurantes & Delivery',
        matchKey: 'gastronomia',
        bucket: 'lifestyle',
        percent: 7,
        description: 'Refeições fora e delivery moderado',
      },
      {
        name: 'Lazer',
        matchKey: 'lazer',
        bucket: 'lifestyle',
        percent: 4,
        description: 'Momentos de lazer e passeios',
      },
      {
        name: 'Cuidados Pessoais & Bem-estar',
        matchKey: 'cuidados',
        bucket: 'lifestyle',
        percent: 3,
        description: 'Cuidados pessoais e bem-estar',
      },
      {
        name: 'Assinaturas & Apps',
        matchKey: 'servicos',
        bucket: 'lifestyle',
        percent: 2,
        description: 'Assinaturas essenciais de mídia e software',
      },
      {
        name: 'Compras',
        matchKey: 'compras',
        bucket: 'lifestyle',
        percent: 2,
        description: 'Vestuário e compras prioritárias',
      },
      {
        name: 'Pets',
        matchKey: 'pets',
        bucket: 'lifestyle',
        percent: 2,
        description: 'Cuidados essenciais com animais de estimação',
      },
      {
        name: 'Reserva de Emergência',
        matchKey: 'reserva',
        bucket: 'future',
        percent: 10,
        description: 'Blindagem financeira prioritária',
      },
      {
        name: 'Metas',
        matchKey: 'metas',
        bucket: 'future',
        percent: 4,
        description: 'Metas familiares',
      },
      {
        name: 'Investimentos',
        matchKey: 'investimentos',
        bucket: 'future',
        percent: 6,
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
    sourceCaption:
      'Modelo de transição usado por consultores financeiros como primeiro passo de reorganização: prioriza estabilizar essenciais antes de acelerar a reserva.',
    bucketDistribution: {
      essentials: 70,
      lifestyle: 20,
      future: 10,
    },
    categories: [
      {
        name: 'Moradia',
        matchKey: 'moradia',
        bucket: 'essentials',
        percent: 28,
        description: 'Custos de habitação e contas de consumo',
      },
      {
        name: 'Alimentação',
        matchKey: 'alimentacao',
        bucket: 'essentials',
        percent: 20,
        description: 'Alimentação doméstica completa',
      },
      {
        name: 'Transporte',
        matchKey: 'transporte',
        bucket: 'essentials',
        percent: 11,
        description: 'Mobilidade básica familiar',
      },
      {
        name: 'Saúde',
        matchKey: 'saude',
        bucket: 'essentials',
        percent: 7,
        description: 'Remédios e cuidados de saúde',
      },
      {
        name: 'Educação',
        matchKey: 'educacao',
        bucket: 'essentials',
        percent: 4,
        description: 'Educação básica e uniformes',
      },
      {
        name: 'Dívidas & Empréstimos',
        matchKey: 'dividas',
        bucket: 'essentials',
        percent: 0,
        description: 'Fatura do cartão, empréstimos e financiamentos',
      },
      {
        name: 'Restaurantes & Delivery',
        matchKey: 'gastronomia',
        bucket: 'lifestyle',
        percent: 7,
        description: 'Gastos com alimentação fora',
      },
      {
        name: 'Lazer',
        matchKey: 'lazer',
        bucket: 'lifestyle',
        percent: 4,
        description: 'Descanso e lazer familiar',
      },
      {
        name: 'Cuidados Pessoais & Bem-estar',
        matchKey: 'cuidados',
        bucket: 'lifestyle',
        percent: 3,
        description: 'Cuidados básicos de higiene e beleza',
      },
      {
        name: 'Assinaturas & Apps',
        matchKey: 'servicos',
        bucket: 'lifestyle',
        percent: 2,
        description: 'Streaming e aplicativos',
      },
      {
        name: 'Compras',
        matchKey: 'compras',
        bucket: 'lifestyle',
        percent: 2,
        description: 'Vestuário essencial',
      },
      {
        name: 'Pets',
        matchKey: 'pets',
        bucket: 'lifestyle',
        percent: 2,
        description: 'Alimentação e saúde dos pets',
      },
      {
        name: 'Reserva de Emergência',
        matchKey: 'reserva',
        bucket: 'future',
        percent: 5,
        description: 'Primeiros passos da reserva financeira',
      },
      {
        name: 'Metas',
        matchKey: 'metas',
        bucket: 'future',
        percent: 2,
        description: 'Pequenas metas financeiras',
      },
      {
        name: 'Investimentos',
        matchKey: 'investimentos',
        bucket: 'future',
        percent: 3,
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
    norm.includes('saude') ||
    norm.includes('medico') ||
    norm.includes('farmacia') ||
    norm.includes('hospital')
  ) {
    return 'saude'
  }
  if (
    norm.includes('educa') ||
    norm.includes('escola') ||
    norm.includes('faculdade') ||
    norm.includes('curso')
  ) {
    return 'educacao'
  }
  if (
    norm.includes('gastronomia') ||
    norm.includes('delivery') ||
    norm.includes('restaurante') ||
    norm.includes('ifood')
  ) {
    return 'gastronomia'
  }
  if (
    norm.includes('lazer') ||
    norm.includes('cinema') ||
    norm.includes('passeio') ||
    norm.includes('viagem')
  ) {
    return 'lazer'
  }
  if (
    norm.includes('cuidado') ||
    norm.includes('estetica') ||
    norm.includes('salao') ||
    norm.includes('beleza')
  ) {
    return 'cuidados'
  }
  if (
    norm.includes('servico') ||
    norm.includes('assinatura') ||
    norm.includes('stream') ||
    norm.includes('conectividade')
  ) {
    return 'servicos'
  }
  if (
    norm.includes('compra') ||
    norm.includes('vestu') ||
    norm.includes('roupa') ||
    norm.includes('eletr')
  ) {
    return 'compras'
  }
  if (
    norm.includes('divida') ||
    norm.includes('emprest') ||
    norm.includes('financi') ||
    norm.includes('cheque especial') ||
    norm.includes('overdraft')
  ) {
    return 'dividas'
  }
  if (norm.includes('pet') || norm.includes('racao') || norm.includes('veterinario')) {
    return 'pets'
  }
  if (norm.includes('reserva') || norm.includes('emergenc') || norm.includes('poupanca')) {
    return 'reserva'
  }
  if (norm.includes('meta') || norm.includes('sonho') || norm.includes('projeto')) {
    return 'metas'
  }
  if (
    norm.includes('invest') ||
    norm.includes('aporte') ||
    norm.includes('aposentadoria') ||
    norm.includes('longo prazo')
  ) {
    return 'investimentos'
  }

  return null
}
