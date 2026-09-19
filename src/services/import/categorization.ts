// Motor de categorização automática por palavras-chave em extratos bancários brasileiros
// Cobre os principais bancos (Nubank, Inter, Itaú, Bradesco, Santander, Caixa, C6, etc.)

import type {
  CategorizationRule,
  TransactionCategory,
  TransactionSubcategory,
  TransactionType,
} from '@/types/finance'

export interface CategoryMatchResult {
  category: TransactionCategory
  subcategory: TransactionSubcategory | null
  matchedRulePattern?: string
  source: 'database_rule' | 'fallback_rule' | 'name_match'
}

export interface KeywordRule {
  categoryNames: string[] // Nome(s) preferidos para essa categoria no banco de dados
  type?: TransactionType
  keywords: string[]
}

export const AUTO_CATEGORIZATION_RULES: KeywordRule[] = [
  // 1. Salário / Renda
  {
    categoryNames: ['Salário'],
    type: 'income',
    keywords: [
      'SALARIO',
      'SALÁRIO',
      'REMUNERACAO',
      'REMUNERAÇÃO',
      'TED SALARIO',
      'FOLHA',
      'PAGTO SALARIO',
      'PAGAMENTO SALARIO',
      'CREDITO DE VENCIMENTO',
      'ORDEM BANCARIA',
      'VENCIMENTOS',
      'PRO-LABORE',
      'PRO LABORE',
      'HOLERITE',
    ],
  },
  // 2. Investimentos / Rendimentos
  {
    categoryNames: ['Investimentos', 'Rendimentos'],
    type: 'income',
    keywords: [
      'DIVIDENDOS',
      'JCP',
      'JUROS SOBRE CAPITAL',
      'RENDIMENTO',
      'APLICACAO RESGATE',
      'RESGATE INVEST',
      'TESOURO DIRETO',
      'NU INVEST',
      'XP INVESTIMENTOS',
      'BTG PACTUAL',
      'RICO CTVM',
      'CLEAR CTVM',
      'INTER DTVM',
      'B3',
      'PROVENTOS',
      'AMORTIZACAO',
    ],
  },
  // 3. Renda Extra / Vendas
  {
    categoryNames: ['Renda Extra', 'Outras Receitas'],
    type: 'income',
    keywords: [
      'REEMBOLSO',
      'CASHBACK',
      'VENDA',
      'HOTMART',
      'MERCADO PAGO RECEB',
      'STRIPE',
      'PAGSEGURO RECEB',
    ],
  },
  // 4. Mercado / Supermercado
  {
    categoryNames: ['Mercado', 'Alimentação'],
    type: 'expense',
    keywords: [
      'MERCADO',
      'SUPERMERCADO',
      'HIPERMERCADO',
      'CARREFOUR',
      'ASSAI',
      'ASSAÍ',
      'ATACADAO',
      'ATACADÃO',
      'PAO DE ACUCAR',
      'PÃO DE AÇÚCAR',
      'SAMS CLUB',
      'SAM S CLUB',
      'EXTRA',
      'BIG',
      'HORTIFRUTI',
      'HORTEFRUTI',
      'ZONA SUL',
      'SACOLAO',
      'SACOLÃO',
      'DIA BRASIL',
      'OBRAMAX',
      'MAKRO',
      'SONDA',
      'ZAFFARI',
      'PREZUNIC',
      'GUANABARA',
      'MUNDIAL',
      'SUPER NOSSO',
      'COOP',
      'MAMBO',
      'ST MARCHE',
      'HIROTA',
      'MERCEARIA',
      'ACOUGUE',
      'AÇOUGUE',
      'QUITANDA',
      'PEIXARIA',
      'PADARIA',
      'PANIFICADORA',
    ],
  },
  // 5. Restaurantes e Delivery
  {
    categoryNames: ['Restaurantes e Delivery', 'Alimentação'],
    type: 'expense',
    keywords: [
      'IFOOD',
      'RAPPI',
      'UBER EATS',
      'AIQFOME',
      'RESTAURANTE',
      'REST',
      'PIZZARIA',
      'PIZZA',
      'HAMBURGUER',
      'BURGER',
      'LANCHONETE',
      'MCDONALDS',
      'MC DONALD',
      'BURGER KING',
      'SUBWAY',
      'HABIB',
      'OUTBACK',
      'MADERO',
      'SPOLETO',
      'GIRAFFAS',
      'SUSHI',
      'BAR',
      'BOTECO',
      'CHOPERIA',
      'CHURRASCARIA',
      'CAFETERIA',
      'STARBUCKS',
      'CACAU SHOW',
      'KOPENHAGEN',
      'SORVETE',
      'DOCERIA',
      'CONFEITARIA',
    ],
  },
  // 6. Transporte & Combustível
  {
    categoryNames: ['Transporte'],
    type: 'expense',
    keywords: [
      'UBER',
      '99APP',
      '99 POP',
      '99 TÁXI',
      '99TAXI',
      'CABIFY',
      'INDRIVE',
      'POSTO DE COMBUSTIVEL',
      'POSTO IPIRANGA',
      'POSTO SHELL',
      'POSTO BR',
      'GASOLINA',
      'ETANOL',
      'DIESEL',
      'COMBUSTIVEL',
      'COMBUSTÍVEL',
      'IPIRANGA',
      'SHELL',
      'PETROBRAS',
      'BR DISTRIBUIDORA',
      'ALE COMBUSTIVEIS',
      'ESTAPAR',
      'ESTACIONAMENTO',
      'SEM PARAR',
      'CONECTCAR',
      'VELOE',
      'TAGGY',
      'PEDAGIO',
      'PEDÁGIO',
      'METRO',
      'METRÔ',
      'CPTM',
      'BILHETE UNICO',
      'BILHETE ÚNICO',
      'AUTO POSTO',
      'LUBRIFICANTES',
      'OFICINA MECANICA',
      'AUTO PEÇAS',
      'AUTO PECAS',
      'PNEU',
    ],
  },
  // 7. Moradia (inclui Aluguel, Condomínio, Água, Luz, Internet, Gás, Telefone, Reparos)
  {
    categoryNames: ['Moradia'],
    type: 'expense',
    keywords: [
      'ALUGUEL',
      'CONDOMINIO',
      'CONDOMÍNIO',
      'IMOBILIARIA',
      'IMOBILIÁRIA',
      'QUINTOCANDAR',
      'QUINTO ANDAR',
      'LEROY MERLIN',
      'TELHANORTE',
      'C&C',
      'CEC CASA',
      'TOC&STOK',
      'TOK&STOK',
      'CAMICADO',
      'ETNA',
      'IPTU',
      'GAS NATURAL',
      'GAS',
      'GÁS',
      'COMGAS',
      'ULTRAGAZ',
      'SUPERGASBRAS',
      'BOTIJAO',
      'BOTIJÃO',
      'DIARISTA',
      'FAXINA',
      'ENEL',
      'CPFL',
      'LIGHT',
      'CEMIG',
      'COPEL',
      'CELESC',
      'ENERGISA',
      'EQUATORIAL',
      'ELEKTRO',
      'ENERGIA',
      'LUZ',
      'ELETRICIDADE',
      'SABESP',
      'COPASA',
      'SANEPAR',
      'CEDAE',
      'AGUAS',
      'ÁGUAS',
      'AGUA',
      'ÁGUA',
      'CLARO',
      'VIVO',
      'TIM',
      'OI FIXO',
      'TELEFONICA',
      'TELEFONE',
      'INTERNET',
      'BANDA LARGA',
      'FIBRA',
      'REPARO',
      'REPAROS',
      'MARCENARIA',
      'ENCANADOR',
      'ELETRICISTA',
      'PINTURA',
    ],
  },
  // 9. Assinaturas e Serviços
  {
    categoryNames: ['Assinaturas & Serviços', 'Assinaturas e Serviços', 'Lazer'],
    type: 'expense',
    keywords: [
      'NETFLIX',
      'SPOTIFY',
      'AMAZON PRIME',
      'PRIME VIDEO',
      'DISNEY PLUS',
      'DISNEY+',
      'DISNEY',
      'HBO',
      'MAX',
      'GLOBO',
      'GLOBOPLAY',
      'YOUTUBE PREMIUM',
      'YOUTUBE',
      'APPLE.COM/BILL',
      'APPLE.COM',
      'APPLE COM',
      'SMART FIT',
      'GOOGLE STORAGE',
      'GOOGLE ONE',
      'ICLOUD',
      'MICROSOFT',
      'CHATGPT',
      'OPENAI',
      'DEEZER',
      'CRUNCHYROLL',
      'PARAMOUNT',
      'CANVA',
      'ADOBE',
    ],
  },
  // 10. Saúde e Farmácia
  {
    categoryNames: ['Saúde'],
    type: 'expense',
    keywords: [
      'DROGARIA',
      'FARMACIA',
      'FARMÁCIA',
      'DROGASIL',
      'DROGA RAIA',
      'PACHECO',
      'SAO PAULO',
      'PANVEL',
      'PAGUE MENOS',
      'DROGARIA ONOFRE',
      'ULTRAFARMA',
      'HOSPITAL',
      'CLINICA',
      'CLÍNICA',
      'CONSULTORIO',
      'LABORATORIO',
      'LABORATÓRIO',
      'FLEURY',
      'DASA',
      'LAVOISIER',
      'NOTREDAME',
      'AMIL',
      'UNIMED',
      'BRADESCO SAUDE',
      'SULAMERICA SAUDE',
      'HAPVIDA',
      'DENTISTA',
      'ODONTO',
      'MEDICO',
      'MÉDICO',
      'PSICOLOG',
      'FISIOTERAP',
      'EXAME',
      'OTICA',
      'ÓTICA',
    ],
  },
  // 11. Educação
  {
    categoryNames: ['Educação'],
    type: 'expense',
    keywords: [
      'FACULDADE',
      'UNIVERSIDADE',
      'COLEGIO',
      'COLÉGIO',
      'ESCOLA',
      'CURSO',
      'UDEMY',
      'ALURA',
      'HOTMART',
      'ROCKETSEAT',
      'IDIOMAS',
      'INGLES',
      'INGLÊS',
      'WIZARD',
      'CNA',
      'CCAA',
      'KUMON',
      'LIVRARIA',
      'SARAIVA',
      'LEITURA',
      'PAPELARIA',
      'KALUNGA',
      'MENSALIDADE ESCOLAR',
    ],
  },
  // 12. Pets
  {
    categoryNames: ['Pets'],
    type: 'expense',
    keywords: [
      'PETZ',
      'COBASI',
      'PETLOVE',
      'PET SHOP',
      'PETSHOP',
      'VETERINARIO',
      'VETERINÁRIO',
      'CLINICA VET',
      'RACAO',
      'RAÇÃO',
      'BANHO E TOSA',
      'DOG',
      'CAT',
    ],
  },
  // 13. Vestuário / Roupas
  {
    categoryNames: ['Vestuário', 'Compras'],
    type: 'expense',
    keywords: [
      'RENNER',
      'C&A',
      'RIACHUELO',
      'ZARA',
      'CENTAURO',
      'DECATHLON',
      'HERING',
      'MARISA',
      'AREZZO',
      'ANACAPRI',
      'SCHUTZ',
      'HAVAIANAS',
      'ROUPAS',
      'CALCADOS',
      'CALÇADOS',
      'SAPATARIA',
      'MODA',
    ],
  },
  // 14. Compras gerais / E-commerce
  {
    categoryNames: ['Compras & Desejos', 'Compras', 'Vestuário'],
    type: 'expense',
    keywords: [
      'MERCADO LIVRE',
      'MERCADOLIVRE',
      'AMAZON BRASIL',
      'AMAZON',
      'SHOPEE',
      'SHEIN',
      'ALIEXPRESS',
      'MAGALU',
      'MAGAZINE LUIZA',
      'CASAS BAHIA',
      'PONTO FRIO',
      'FAST SHOP',
      'AMERICANAS',
      'SUBMARINO',
      'SHOPTIME',
    ],
  },
  // 15. Lazer & Entretenimento
  {
    categoryNames: ['Lazer'],
    type: 'expense',
    keywords: [
      'CINEMA',
      'CINEMARK',
      'KINOPLEX',
      'UCI',
      'INGRESSO',
      'SYMPLA',
      'EVENTIM',
      'TEATRO',
      'SHOW',
      'PARQUE',
      'SMART FIT',
      'BLUEFIT',
      'ACADEMIA',
      'GYMPASS',
      'TOTALPASS',
      'CLUBE',
      'STEAM',
      'PLAYSTATION',
      'XBOX',
      'NINTENDO',
    ],
  },
  // 16. Viagens
  {
    categoryNames: ['Viagens', 'Lazer'],
    type: 'expense',
    keywords: [
      'AIRBNB',
      'BOOKING',
      'HOTEL',
      'POUSADA',
      'RESORT',
      'LATAM',
      'GOL LINHAS',
      'AZUL LINHAS',
      'DECOLAR',
      '123MILHAS',
      'MAXMILHAS',
      'CVC',
      'HOSTEL',
      'RODOVIARIA',
      'AUTO VIACAO',
    ],
  },
  // 17. Serviços Financeiros / Tarifas
  {
    categoryNames: ['Serviços Financeiros', 'Outros'],
    type: 'expense',
    keywords: [
      'IOF',
      'TARIFA',
      'ANUIDADE',
      'JUROS',
      'ENCARGOS',
      'MULTA',
      'TAXA',
      'MANUTENCAO CONTA',
      'PACOTE SERVICOS',
      'SEGURO CARTAO',
    ],
  },
]

/**
 * Remove acentos e normaliza para caixa alta e espaços únicos
 */
export function normalizeText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Encontra a categoria correspondente para a descrição dada
 */
/**
 * Extrai um padrão limpo (keyword) da descrição para salvar em regras contínuas
 * Remove números isolados, datas, códigos bancários comuns e pontuações
 */
export function extractPatternFromDescription(desc: string): string {
  const norm = normalizeText(desc)
  if (!norm) return ''

  // Remover termos de ruído comuns de extratos antes do padrão
  const clean = norm
    .replace(
      /\b(COMPRA|PAGAMENTO|PAGTO|PIX|TRANSF|TED|DOC|CARTAO|DEBITO|CREDITO|AUTO|POSTO)\b/g,
      ' ',
    )
    .replace(/\b\d{2,}\b/g, ' ') // remove blocos de números
    .replace(/\s+/g, ' ')
    .trim()

  return clean || norm
}

/**
 * Encontra a categoria e subcategoria com base nas regras do banco (categorization_rules)
 * e, caso não dê match, recorre às regras auxiliares de vocabulário de mercado.
 */
export function matchCategorization(
  description: string,
  type: TransactionType,
  categories: TransactionCategory[],
  dbRules: CategorizationRule[] = [],
): CategoryMatchResult | null {
  const normDesc = normalizeText(description)
  if (!normDesc) return null

  // 1. Prioridade máxima: regras aprendidas ou seeded salvas no banco de dados
  // Ordenadas pelas mais específicas/longas primeiro
  const sortedRules = [...dbRules].sort(
    (a, b) => (b.pattern?.length || 0) - (a.pattern?.length || 0),
  )

  for (const rule of sortedRules) {
    const rawPattern = rule.pattern || ''
    const normPattern = normalizeText(rawPattern)
    if (!normPattern || normPattern.length < 2) continue

    // Checagem de correspondência:
    // Padrões curtos ou sensíveis a falsos positivos usam word-boundary:
    // - 'MAX' (evita colisão com "MAXIMA", "MAXIMO", "OBRAMAX", "MAXMILHAS")
    // - 'BAR' (quando pattern é 'BAR ' ou 'BAR', evita colisão com "BARATO", "BARALHO", "BARRA")
    // - 'C&A' (normalizado fica 'C A')
    let isMatch = false
    const trimmedPattern = rawPattern.trim().toUpperCase()

    if (
      normPattern === 'MAX' ||
      normPattern === 'BAR' ||
      normPattern === 'C A' ||
      trimmedPattern === 'C&A'
    ) {
      // Word boundary regex no texto normalizado por espaços
      const escaped = normPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`)
      isMatch = regex.test(normDesc)
    } else {
      isMatch = normDesc.includes(normPattern)
    }

    if (isMatch) {
      // Verificar se a categoria da regra existe na família
      const category = categories.find((c) => c.id === rule.category_id)
      if (category) {
        // Encontra subcategoria associada se houver
        let subcategory: TransactionSubcategory | null = null
        if (rule.subcategory_id && category.subcategories) {
          subcategory = category.subcategories.find((s) => s.id === rule.subcategory_id) || null
        }
        return {
          category,
          subcategory,
          matchedRulePattern: rule.pattern,
          source: 'database_rule',
        }
      }
    }
  }

  // 2. Se nenhuma regra do banco bater, recorre às regras universais de fallback
  const availableCategories = categories.filter((c) => c.type === type)
  if (availableCategories.length === 0) return null

  const catByNameMap = new Map<string, TransactionCategory>()
  availableCategories.forEach((cat) => {
    catByNameMap.set(normalizeText(cat.name), cat)
  })

  // Prioridade Salário
  if (
    normDesc.includes('SALARIO') ||
    normDesc.includes('REMUNERACAO') ||
    normDesc.includes('FOLHA DE PAGAMENTO')
  ) {
    const salaryCat = catByNameMap.get(normalizeText('Salário'))
    if (salaryCat) {
      return {
        category: salaryCat,
        subcategory: null,
        source: 'fallback_rule',
      }
    }
  }

  for (const rule of AUTO_CATEGORIZATION_RULES) {
    if (rule.type && rule.type !== type) continue

    const matchedKw = rule.keywords.find((kw) => {
      const normKw = normalizeText(kw)
      if (!normKw) return false
      if (normKw === 'POSTO' && (normDesc.includes('SALARIO') || normDesc.includes('PAGAMENTO'))) {
        return false
      }
      return normDesc.includes(normKw)
    })

    if (matchedKw) {
      for (const targetName of rule.categoryNames) {
        const normTarget = normalizeText(targetName)
        const found = catByNameMap.get(normTarget)
        if (found) {
          return {
            category: found,
            subcategory: null,
            matchedRulePattern: matchedKw,
            source: 'fallback_rule',
          }
        }
      }
    }
  }

  // 3. Checar se o próprio nome da categoria está contido na descrição
  for (const cat of availableCategories) {
    const normCat = normalizeText(cat.name)
    if (normCat.length >= 3 && normDesc.includes(normCat)) {
      return {
        category: cat,
        subcategory: null,
        source: 'name_match',
      }
    }
  }

  return null
}

/**
 * Encontra a categoria correspondente para a descrição dada (compatibilidade retroativa)
 */
export function predictCategory(
  description: string,
  type: TransactionType,
  categories: TransactionCategory[],
  dbRules: CategorizationRule[] = [],
): TransactionCategory | null {
  const result = matchCategorization(description, type, categories, dbRules)
  return result ? result.category : null
}
