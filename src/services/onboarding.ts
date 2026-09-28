import { supabase } from '@/lib/supabase/client'
import { BudgetBucket } from '@/types/finance'
import { upsertDefaultBudget } from '@/services/transactions'
import { updateFamilyDetails } from '@/services/family'

export interface CategorySubcategorySeed {
  name: string
  icon?: string
  color?: string
  keywords?: string[]
}

export interface CategorySeedDefinition {
  name: string
  bucket: BudgetBucket
  icon: string
  color: string
  type: 'expense'
  suggestedPercent: number // Percentual padrão sugerido dentro da renda total para o modelo 50/30/20
  subcategories: CategorySubcategorySeed[]
}

/**
 * Taxonomia Padrão Ouro 50/30/20 Oficial do Curiangoo:
 * EXATAMENTE 14 categorias mestras distribuídas nos 3 baldes (5 essentials, 6 lifestyle, 3 future).
 *
 * Balde: Necessidades (50% - essentials):
 * 1. Moradia (Ícone: Home, Cor: Índigo #6366F1)
 *    Subcategorias: Aluguel / Condomínio, Energia Elétrica, Água & Saneamento, Gás, Internet & Fixo, Manutenção da Casa
 *    Keywords: aluguel, condominio, enel, sabesp, cpfl, luz, agua, comgas, vivo fibra, claro residencial
 * 2. Alimentação Básica (Ícone: ShoppingCart, Cor: Esmeralda #10B981)
 *    Subcategorias: Supermercado, Açougue & Peixaria, Hortifruti & Feira, Padaria do Dia a Dia
 *    Keywords: carrefour, assai, pao de acucar, atacadao, mercadinho, feira, acougue, swift, hortifruti
 * 3. Transporte Obrigatório (Ícone: Car, Cor: Azul #3B82F6)
 *    Subcategorias: Combustível, Transporte Público & Bilhete, Aplicativos do Dia a Dia (Uber/99), Estacionamento & Pedágio, Seguro & IPVA, Manutenção Básica
 *    Keywords: posto, shell, ipiranga, uber, 99, metro, sptrans, pedagio, sem parar, posto ipiranga
 * 4. Saúde & Cuidados Médicos (Ícone: HeartPulse, Cor: Vermelho/Rosa #EF4444)
 *    Subcategorias: Plano de Saúde, Farmácia & Medicamentos, Consultas & Exames, Odontologia
 *    Keywords: drogasil, droga raia, pague menos, unimed, bradesco saude, laboratorio, fleury, dentista, farmacia
 * 5. Educação Obrigatória (Ícone: GraduationCap, Cor: Violeta #8B5CF6)
 *    Subcategorias: Mensalidade Escolar / Faculdade, Material & Uniformes, Transporte Escolar
 *    Keywords: escola, colegio, faculdade, mensalidade, papelaria, van escolar
 *
 * Balde: Estilo de Vida (30% - lifestyle):
 * 6. Gastronomia & Delivery (Ícone: Utensils, Cor: Âmbar #F59E0B)
 *    Subcategorias: Restaurantes & Bares, Delivery (iFood/Rappi), Cafeterias & Lanches Rápidos
 *    Keywords: ifood, rappi, mcdonalds, outback, burger king, bar, choperia, cafeteria, starbucks, restaurante
 * 7. Lazer & Passeios (Ícone: Ticket, Cor: Laranja #F97316)
 *    Subcategorias: Cinema, Shows & Eventos, Viagens & Hospedagem, Passeios de Fim de Semana
 *    Keywords: cinemark, ingresso.com, sympla, airbnb, hotel, booking, passagem aerea, azul, gol, latam
 * 8. Cuidados Pessoais & Bem-estar (Ícone: Sparkles, Cor: Rosa #EC4899)
 *    Subcategorias: Barbearia / Salão de Beleza, Manicure & Estética, Cosméticos & Perfumaria, Academia & Esportes
 *    Keywords: smart fit, academia, boticario, sephora, salao, barbearia, natura, estetica
 * 9. Assinaturas & Conectividade (Ícone: Tv, Cor: Roxo #7C3AED)
 *    Subcategorias: Streaming de Vídeo & Música, Softwares & Apps, Clubes de Assinatura
 *    Keywords: netflix, spotify, amazon prime, youtube premium, hbo, max, disney, apple, google one
 * 10. Compras & Vestuário (Ícone: ShoppingBag, Cor: Amarelo escuro #D97706)
 *     Subcategorias: Roupas & Calçados, Eletrônicos & Gadgets, Decoração & Utilidades, Presentes
 *     Keywords: zara, renner, riachuelo, shein, shopee, mercado livre, amazon compras
 * 11. Pets (Ícone: PawPrint, Cor: Verde claro #84CC16)
 *     Subcategorias: Ração & Petiscos, Veterinário & Vacinas, Banho, Tosa & Acessórios
 *     Keywords: petz, cobasi, pet shop, veterinario, royal canin, premier pet
 *
 * Balde: Futuro & Metas (20% - future):
 * 12. Reserva de Emergência (Ícone: ShieldCheck, Cor: Esmeralda #10B981)
 *     Subcategorias: Aportes na Reserva, Resgates Emergenciais
 *     Keywords: tesouro selic, cdb liquidez diaria, reserva, caixinha nubank
 * 13. Metas & Grandes Sonhos (Ícone: Target, Cor: Ciano #06B6D4)
 *     Subcategorias: Troca de Carro, Casa Própria, Viagem Internacional, Reforma
 *     Keywords: fundo viagem, entrada apto, consorcio, meta
 * 14. Investimentos de Longo Prazo (Ícone: TrendingUp, Cor: Verde #059669)
 *     Subcategorias: Previdência Privada, Ações & Fundos Imobiliários, Aposentadoria
 *     Keywords: xp investimentos, btg, inter invest, previdencia, tesouro ipca
 */
export const STANDARDIZED_CATEGORIES_TREE: CategorySeedDefinition[] = [
  // Essentials (Necessidades - 50%)
  {
    name: 'Moradia',
    bucket: 'essentials',
    icon: 'Home',
    color: '#6366F1', // Índigo
    type: 'expense',
    suggestedPercent: 20,
    subcategories: [
      {
        name: 'Aluguel / Condomínio',
        icon: 'Home',
        keywords: ['aluguel', 'condominio', 'imobiliaria', 'quintoandar', 'quinto andar'],
      },
      {
        name: 'Energia Elétrica',
        icon: 'Zap',
        keywords: ['enel', 'cpfl', 'luz', 'energia', 'light', 'cemig', 'copel', 'eletricidade'],
      },
      {
        name: 'Água & Saneamento',
        icon: 'Droplets',
        keywords: ['sabesp', 'agua', 'copasa', 'sanepar', 'cedae', 'saneamento'],
      },
      {
        name: 'Gás',
        icon: 'Flame',
        keywords: ['comgas', 'gas', 'ultragaz', 'supergasbras', 'botijao'],
      },
      {
        name: 'Internet & Fixo',
        icon: 'Wifi',
        keywords: ['vivo fibra', 'claro residencial', 'internet', 'fibra', 'banda larga'],
      },
      {
        name: 'Manutenção da Casa',
        icon: 'Wrench',
        keywords: ['manutencao', 'reparo', 'encanador', 'eletricista', 'marcenaria', 'pintura'],
      },
    ],
  },
  {
    name: 'Alimentação Básica',
    bucket: 'essentials',
    icon: 'ShoppingCart',
    color: '#10B981', // Esmeralda
    type: 'expense',
    suggestedPercent: 14,
    subcategories: [
      {
        name: 'Supermercado',
        icon: 'ShoppingCart',
        keywords: [
          'carrefour',
          'assai',
          'pao de acucar',
          'atacadao',
          'mercadinho',
          'mercado',
          'supermercado',
          'sams club',
          'dia brasil',
        ],
      },
      {
        name: 'Açougue & Peixaria',
        icon: 'Beef',
        keywords: ['acougue', 'swift', 'peixaria', 'carnes'],
      },
      {
        name: 'Hortifruti & Feira',
        icon: 'Apple',
        keywords: ['hortifruti', 'feira', 'sacolao', 'quitanda', 'frutas'],
      },
      {
        name: 'Padaria do Dia a Dia',
        icon: 'Coffee',
        keywords: ['padaria', 'panificadora', 'pao do dia'],
      },
    ],
  },
  {
    name: 'Transporte Obrigatório',
    bucket: 'essentials',
    icon: 'Car',
    color: '#3B82F6', // Azul
    type: 'expense',
    suggestedPercent: 8,
    subcategories: [
      {
        name: 'Combustível',
        icon: 'Fuel',
        keywords: [
          'posto',
          'posto ipiranga',
          'shell',
          'ipiranga',
          'gasolina',
          'etanol',
          'diesel',
          'combustivel',
        ],
      },
      {
        name: 'Transporte Público & Bilhete',
        icon: 'Bus',
        keywords: ['metro', 'sptrans', 'bilhete unico', 'cptm', 'onibus'],
      },
      {
        name: 'Aplicativos do Dia a Dia (Uber/99)',
        icon: 'Car',
        keywords: ['uber', '99', '99app', '99 pop', '99 taxi', 'cabify', 'indrive'],
      },
      {
        name: 'Estacionamento & Pedágio',
        icon: 'CircleParking',
        keywords: ['pedagio', 'sem parar', 'conectcar', 'veloe', 'estapar', 'estacionamento'],
      },
      {
        name: 'Seguro & IPVA',
        icon: 'ShieldAlert',
        keywords: ['ipva', 'seguro auto', 'dpvat', 'licenciamento'],
      },
      {
        name: 'Manutenção Básica',
        icon: 'Wrench',
        keywords: ['oficina mecanica', 'auto pecas', 'pneu', 'troca de oleo', 'alinhamento'],
      },
    ],
  },
  {
    name: 'Saúde & Cuidados Médicos',
    bucket: 'essentials',
    icon: 'HeartPulse',
    color: '#EF4444', // Vermelho/Rosa
    type: 'expense',
    suggestedPercent: 5,
    subcategories: [
      {
        name: 'Plano de Saúde',
        icon: 'Shield',
        keywords: ['unimed', 'bradesco saude', 'sulamerica saude', 'amil', 'notredame', 'hapvida'],
      },
      {
        name: 'Farmácia & Medicamentos',
        icon: 'Pill',
        keywords: [
          'drogasil',
          'droga raia',
          'pague menos',
          'farmacia',
          'drogaria',
          'panvel',
          'ultrafarma',
        ],
      },
      {
        name: 'Consultas & Exames',
        icon: 'Stethoscope',
        keywords: ['laboratorio', 'fleury', 'dasa', 'lavoisier', 'consulta medica', 'clinica'],
      },
      {
        name: 'Odontologia',
        icon: 'Smile',
        keywords: ['dentista', 'odonto', 'ortodontia'],
      },
    ],
  },
  {
    name: 'Educação Obrigatória',
    bucket: 'essentials',
    icon: 'GraduationCap',
    color: '#8B5CF6', // Violeta
    type: 'expense',
    suggestedPercent: 3,
    subcategories: [
      {
        name: 'Mensalidade Escolar / Faculdade',
        icon: 'GraduationCap',
        keywords: ['escola', 'colegio', 'faculdade', 'mensalidade', 'universidade'],
      },
      {
        name: 'Material & Uniformes',
        icon: 'BookOpen',
        keywords: ['papelaria', 'kalunga', 'material escolar', 'uniforme', 'livros escolares'],
      },
      {
        name: 'Transporte Escolar',
        icon: 'Bus',
        keywords: ['van escolar', 'transporte escolar'],
      },
    ],
  },

  // Lifestyle (Estilo de Vida - 30%)
  {
    name: 'Gastronomia & Delivery',
    bucket: 'lifestyle',
    icon: 'Utensils',
    color: '#F59E0B', // Âmbar
    type: 'expense',
    suggestedPercent: 10,
    subcategories: [
      {
        name: 'Restaurantes & Bares',
        icon: 'Utensils',
        keywords: [
          'outback',
          'bar',
          'choperia',
          'restaurante',
          'churrascaria',
          'pizzaria',
          'boteco',
        ],
      },
      {
        name: 'Delivery (iFood/Rappi)',
        icon: 'Bike',
        keywords: ['ifood', 'rappi', 'aiqfome', 'uber eats'],
      },
      {
        name: 'Cafeterias & Lanches Rápidos',
        icon: 'Coffee',
        keywords: [
          'mcdonalds',
          'burger king',
          'cafeteria',
          'starbucks',
          'subway',
          'cacau show',
          'kopenhagen',
        ],
      },
    ],
  },
  {
    name: 'Lazer & Passeios',
    bucket: 'lifestyle',
    icon: 'Ticket',
    color: '#F97316', // Laranja
    type: 'expense',
    suggestedPercent: 5,
    subcategories: [
      {
        name: 'Cinema',
        icon: 'Film',
        keywords: ['cinemark', 'ingresso.com', 'kinoplex', 'uci', 'cinema'],
      },
      {
        name: 'Shows & Eventos',
        icon: 'Ticket',
        keywords: ['sympla', 'eventim', 'show', 'teatro', 'evento'],
      },
      {
        name: 'Viagens & Hospedagem',
        icon: 'Plane',
        keywords: [
          'airbnb',
          'hotel',
          'booking',
          'passagem aerea',
          'azul',
          'gol',
          'latam',
          'decolar',
          'pousada',
        ],
      },
      {
        name: 'Passeios de Fim de Semana',
        icon: 'Sun',
        keywords: ['passeio', 'parque', 'clube', 'resort'],
      },
    ],
  },
  {
    name: 'Cuidados Pessoais & Bem-estar',
    bucket: 'lifestyle',
    icon: 'Sparkles',
    color: '#EC4899', // Rosa
    type: 'expense',
    suggestedPercent: 5,
    subcategories: [
      {
        name: 'Barbearia / Salão de Beleza',
        icon: 'Scissors',
        keywords: ['salao', 'barbearia', 'cabelereiro'],
      },
      {
        name: 'Manicure & Estética',
        icon: 'Sparkles',
        keywords: ['estetica', 'manicure', 'pedicure', 'depilacao', 'spa'],
      },
      {
        name: 'Cosméticos & Perfumaria',
        icon: 'Package',
        keywords: ['boticario', 'sephora', 'natura', 'cosmeticos', 'perfumaria'],
      },
      {
        name: 'Academia & Esportes',
        icon: 'Activity',
        keywords: ['smart fit', 'academia', 'bluefit', 'gympass', 'totalpass', 'crossfit'],
      },
    ],
  },
  {
    name: 'Assinaturas & Conectividade',
    bucket: 'lifestyle',
    icon: 'Tv',
    color: '#7C3AED', // Roxo
    type: 'expense',
    suggestedPercent: 3,
    subcategories: [
      {
        name: 'Streaming de Vídeo & Música',
        icon: 'Tv',
        keywords: [
          'netflix',
          'spotify',
          'amazon prime',
          'youtube premium',
          'hbo',
          'max',
          'disney',
          'globoplay',
          'deezer',
          'prime video',
        ],
      },
      {
        name: 'Softwares & Apps',
        icon: 'Terminal',
        keywords: ['apple', 'google one', 'icloud', 'chatgpt', 'openai', 'canva', 'microsoft'],
      },
      {
        name: 'Clubes de Assinatura',
        icon: 'Sparkles',
        keywords: ['clube de assinatura', 'wine', 'tag livros'],
      },
    ],
  },
  {
    name: 'Compras & Vestuário',
    bucket: 'lifestyle',
    icon: 'ShoppingBag',
    color: '#D97706', // Amarelo escuro
    type: 'expense',
    suggestedPercent: 4,
    subcategories: [
      {
        name: 'Roupas & Calçados',
        icon: 'Shirt',
        keywords: [
          'zara',
          'renner',
          'riachuelo',
          'shein',
          'shopee',
          'c&a',
          'hering',
          'centauro',
          'calcados',
        ],
      },
      {
        name: 'Eletrônicos & Gadgets',
        icon: 'Laptop',
        keywords: [
          'mercado livre',
          'amazon compras',
          'magalu',
          'magazine luiza',
          'fast shop',
          'kabum',
        ],
      },
      {
        name: 'Decoração & Utilidades',
        icon: 'Home',
        keywords: ['camicado', 'tok&stok', 'leroy merlin', 'utilidades', 'decoracao'],
      },
      {
        name: 'Presentes',
        icon: 'Gift',
        keywords: ['presente', 'presentes', 'aniversario'],
      },
    ],
  },
  {
    name: 'Pets',
    bucket: 'lifestyle',
    icon: 'PawPrint',
    color: '#84CC16', // Verde claro
    type: 'expense',
    suggestedPercent: 3,
    subcategories: [
      {
        name: 'Ração & Petiscos',
        icon: 'Utensils',
        keywords: ['royal canin', 'premier pet', 'racao', 'petiscos'],
      },
      {
        name: 'Veterinário & Vacinas',
        icon: 'HeartPulse',
        keywords: ['veterinario', 'vacina pet', 'clinica vet'],
      },
      {
        name: 'Banho, Tosa & Acessórios',
        icon: 'Sparkles',
        keywords: ['petz', 'cobasi', 'pet shop', 'banho e tosa'],
      },
    ],
  },

  // Future & Metas (20% - future)
  {
    name: 'Reserva de Emergência',
    bucket: 'future',
    icon: 'ShieldCheck',
    color: '#10B981', // Esmeralda
    type: 'expense',
    suggestedPercent: 10,
    subcategories: [
      {
        name: 'Aportes na Reserva',
        icon: 'ShieldCheck',
        keywords: ['tesouro selic', 'cdb liquidez diaria', 'reserva', 'caixinha nubank'],
      },
      {
        name: 'Resgates Emergenciais',
        icon: 'ArrowDownRight',
        keywords: ['resgate reserva', 'emergencia resgate'],
      },
    ],
  },
  {
    name: 'Metas & Grandes Sonhos',
    bucket: 'future',
    icon: 'Target',
    color: '#06B6D4', // Ciano
    type: 'expense',
    suggestedPercent: 4,
    subcategories: [
      {
        name: 'Troca de Carro',
        icon: 'Car',
        keywords: ['consorcio', 'troca de carro', 'carro novo'],
      },
      {
        name: 'Casa Própria',
        icon: 'Home',
        keywords: ['entrada apto', 'casa propria', 'financiamento imovel'],
      },
      {
        name: 'Viagem Internacional',
        icon: 'Plane',
        keywords: ['fundo viagem', 'viagem internacional', 'euro', 'dolar'],
      },
      {
        name: 'Reforma',
        icon: 'Wrench',
        keywords: ['meta', 'reforma', 'obra da casa'],
      },
    ],
  },
  {
    name: 'Investimentos de Longo Prazo',
    bucket: 'future',
    icon: 'TrendingUp',
    color: '#059669', // Verde
    type: 'expense',
    suggestedPercent: 6,
    subcategories: [
      {
        name: 'Previdência Privada',
        icon: 'Landmark',
        keywords: ['previdencia', 'previdencia privada', 'pgbl', 'vgbl'],
      },
      {
        name: 'Ações & Fundos Imobiliários',
        icon: 'TrendingUp',
        keywords: [
          'xp investimentos',
          'btg',
          'inter invest',
          'tesouro ipca',
          'acoes',
          'fiis',
          'dividendos',
        ],
      },
      {
        name: 'Aposentadoria',
        icon: 'PiggyBank',
        keywords: ['aposentadoria', 'liberdade financeira', 'independencia financeira'],
      },
    ],
  },
]

export interface SeedCategoriesAndPlanOptions {
  familyId: string
  monthlyNetIncomeCents: number
  modelPresetId: '50_30_20' | '60_25_15' | '70_20_10'
}

/**
 * Fatores multiplicadores de reponderação dos percentuais das categorias para os modelos alternativos.
 * Base 50_30_20 = 50 / 30 / 20.
 * Modelo 60_25_15: balde essentials cresce 20% (60/50 = 1.2), lifestyle (25/30 = 0.833), future (15/20 = 0.75).
 * Modelo 70_20_10: balde essentials cresce 40% (70/50 = 1.4), lifestyle (20/30 = 0.667), future (10/20 = 0.5).
 */
export function getCategoryWeightFactor(
  bucket: BudgetBucket,
  presetId: '50_30_20' | '60_25_15' | '70_20_10',
): number {
  if (presetId === '60_25_15') {
    if (bucket === 'essentials') return 60 / 50 // 1.2
    if (bucket === 'lifestyle') return 25 / 30 // ~0.833
    if (bucket === 'future') return 15 / 20 // 0.75
  } else if (presetId === '70_20_10') {
    if (bucket === 'essentials') return 70 / 50 // 1.4
    if (bucket === 'lifestyle') return 20 / 30 // ~0.667
    if (bucket === 'future') return 10 / 20 // 0.5
  }
  return 1.0
}

/**
 * Cria a árvore padronizada completa com idempotência e aplica os tetos sugeridos com base na renda líquida
 */
export async function seedStandardizedCategoriesAndApplyPlan({
  familyId,
  monthlyNetIncomeCents,
  modelPresetId = '50_30_20',
}: SeedCategoriesAndPlanOptions): Promise<{
  createdCategoriesCount: number
  createdSubcategoriesCount: number
  totalBudgetCents: number
}> {
  if (!familyId) {
    throw new Error('familyId é obrigatório')
  }

  // 1. Atualiza renda líquida na tabela families
  await updateFamilyDetails(familyId, {
    monthly_net_income_cents: monthlyNetIncomeCents,
  })

  // 2. Busca categorias existentes da família para idempotência
  const { data: existingCategories, error: fetchCatError } = await (supabase as any)
    .from('transaction_categories')
    .select('id, name, budget_bucket, sort_order')
    .eq('family_id', familyId)

  if (fetchCatError) {
    throw fetchCatError
  }

  const existingCatMap = new Map<string, any>()
  let maxSortOrder = 0
  for (const c of existingCategories || []) {
    existingCatMap.set(c.name.trim().toLowerCase(), c)
    if (c.sort_order && c.sort_order > maxSortOrder) {
      maxSortOrder = c.sort_order
    }
  }

  // 3. Busca subcategorias existentes para idempotência
  const { data: existingSubcategories, error: fetchSubError } = await (supabase as any)
    .from('transaction_subcategories')
    .select('id, category_id, name')
    .eq('family_id', familyId)

  if (fetchSubError) {
    throw fetchSubError
  }

  const existingSubMap = new Set<string>()
  for (const s of existingSubcategories || []) {
    existingSubMap.add(`${s.category_id}::${s.name.trim().toLowerCase()}`)
  }

  let createdCategoriesCount = 0
  let createdSubcategoriesCount = 0
  let totalBudgetCents = 0

  // 4. Itera sobre a árvore padronizada
  for (let i = 0; i < STANDARDIZED_CATEGORIES_TREE.length; i++) {
    const catDef = STANDARDIZED_CATEGORIES_TREE[i]
    const catKey = catDef.name.trim().toLowerCase()

    let categoryRecord = existingCatMap.get(catKey)

    if (!categoryRecord) {
      maxSortOrder += 1
      const { data: newCat, error: insertCatError } = await (supabase as any)
        .from('transaction_categories')
        .insert({
          family_id: familyId,
          name: catDef.name,
          type: catDef.type,
          budget_bucket: catDef.bucket,
          icon: catDef.icon,
          color: catDef.color,
          sort_order: maxSortOrder,
        })
        .select()
        .single()

      if (insertCatError) {
        // Se bater no índice único por concorrência, faz fallback buscando
        const { data: fallbackCat } = await (supabase as any)
          .from('transaction_categories')
          .select('id, name, budget_bucket, sort_order')
          .eq('family_id', familyId)
          .eq('name', catDef.name)
          .single()

        if (fallbackCat) {
          categoryRecord = fallbackCat
        } else {
          console.error(`Erro ao criar categoria ${catDef.name}:`, insertCatError)
          throw insertCatError
        }
      } else {
        categoryRecord = newCat
        existingCatMap.set(catKey, newCat)
        createdCategoriesCount += 1
      }
    } else {
      // Se já existia mas não tinha bucket ou bucket diferente, atualiza
      if (!categoryRecord.budget_bucket || categoryRecord.budget_bucket !== catDef.bucket) {
        await (supabase as any)
          .from('transaction_categories')
          .update({ budget_bucket: catDef.bucket })
          .eq('id', categoryRecord.id)
      }
    }

    const categoryId = categoryRecord.id

    // 5. Inserir subcategorias com idempotência e cadastrar regras automáticas por keywords
    if (catDef.subcategories && catDef.subcategories.length > 0) {
      for (let sIdx = 0; sIdx < catDef.subcategories.length; sIdx++) {
        const subDef = catDef.subcategories[sIdx]
        const subKey = `${categoryId}::${subDef.name.trim().toLowerCase()}`
        let subcategoryId: string | null = null

        if (!existingSubMap.has(subKey)) {
          const { data: newSub, error: insertSubError } = await (supabase as any)
            .from('transaction_subcategories')
            .insert({
              category_id: categoryId,
              family_id: familyId,
              name: subDef.name,
              icon: subDef.icon || catDef.icon,
              color: subDef.color || catDef.color,
              sort_order: sIdx + 1,
            })
            .select('id')
            .single()

          if (!insertSubError && newSub) {
            existingSubMap.add(subKey)
            subcategoryId = newSub.id
            createdSubcategoriesCount += 1
          } else {
            console.warn(`Aviso ao criar subcategoria ${subDef.name}:`, insertSubError)
          }
        } else {
          const foundExisting = (existingSubcategories || []).find(
            (s: any) =>
              s.category_id === categoryId &&
              s.name.trim().toLowerCase() === subDef.name.trim().toLowerCase(),
          )
          subcategoryId = foundExisting?.id || null
        }

        // Se houver keywords para essa subcategoria, injetar em categorization_rules
        if (subDef.keywords && subDef.keywords.length > 0) {
          for (const kw of subDef.keywords) {
            const cleanPattern = kw.trim().toUpperCase()
            if (!cleanPattern) continue

            // Checa se já existe regra com o padrão para a família
            const { data: existingRule } = await (supabase as any)
              .from('categorization_rules')
              .select('id')
              .eq('family_id', familyId)
              .ilike('pattern', cleanPattern)
              .maybeSingle()

            if (!existingRule) {
              await (supabase as any).from('categorization_rules').insert({
                family_id: familyId,
                pattern: cleanPattern,
                category_id: categoryId,
                subcategory_id: subcategoryId,
              })
            }
          }
        }
      }
    }

    // 6. Calcular e definir o teto inicial sugerido em default_budgets
    const weightFactor = getCategoryWeightFactor(catDef.bucket, modelPresetId)
    const effectivePercent = catDef.suggestedPercent * weightFactor
    const targetAmountCents = Math.round((monthlyNetIncomeCents * effectivePercent) / 100)

    if (targetAmountCents > 0) {
      await upsertDefaultBudget(familyId, categoryId, targetAmountCents, null)
      totalBudgetCents += targetAmountCents
    }
  }

  return {
    createdCategoriesCount,
    createdSubcategoriesCount,
    totalBudgetCents,
  }
}
