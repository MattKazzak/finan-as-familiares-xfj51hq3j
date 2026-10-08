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
  // 1. Salário / Renda (income)
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
  // 2. Rendimentos / Dividendos (income)
  {
    categoryNames: ['Rendimentos', 'Investimentos'],
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
      'PROVENTOS',
      'AMORTIZACAO',
    ],
  },

  // 3. Trabalhos Extras & Autônomo (income)
  {
    categoryNames: ['Trabalhos Extras & Autônomo', 'Trabalhos Extras', 'Autônomo'],
    type: 'income',
    keywords: [
      'FREELANCE',
      'FREELANCER',
      'BICO',
      'MEI',
      'AUTONOMO',
      'AUTÔNOMO',
      'COMISSAO',
      'COMISSÃO',
      'GORJETA',
    ],
  },

  // 4. Outras Receitas (income)
  {
    categoryNames: ['Outras Receitas'],
    type: 'income',
    keywords: [
      'REEMBOLSO',
      'ESTORNO',
      'CASHBACK',
      'MILHAS',
      'PRESENTE RECEBIDO',
      'VENDA USADO',
      'ENJOEI',
      'OLX',
    ],
  },

  // 3. Moradia (essentials)
  // Keywords: aluguel, condominio, enel, sabesp, cpfl, luz, agua, comgas, vivo fibra, claro residencial
  {
    categoryNames: ['Moradia'],
    type: 'expense',
    keywords: [
      'ALUGUEL',
      'CONDOMINIO',
      'CONDOMÍNIO',
      'ENEL',
      'SABESP',
      'CPFL',
      'LUZ',
      'AGUA',
      'ÁGUA',
      'COMGAS',
      'COMGÁS',
      'VIVO FIBRA',
      'CLARO RESIDENCIAL',
      'QUINTOCANDAR',
      'QUINTO ANDAR',
      'IMOBILIARIA',
      'IMOBILIÁRIA',
      'GAS',
      'GÁS',
      'ULTRAGAZ',
      'SUPERGASBRAS',
      'COPASA',
      'SANEPAR',
      'CEDAE',
      'CEMIG',
      'COPEL',
      'LIGHT',
      'ENERGIA',
      'ELETRICIDADE',
      'INTERNET',
      'BANDA LARGA',
      'FIBRA',
    ],
  },

  // 4. Alimentação (essentials)
  // Keywords: carrefour, assai, pao de acucar, atacadao, mercadinho, feira, acougue, swift, hortifruti
  {
    categoryNames: ['Alimentação', 'Alimentação Básica', 'Mercado'],
    type: 'expense',
    keywords: [
      'CARREFOUR',
      'ASSAI',
      'ASSAÍ',
      'PAO DE ACUCAR',
      'PÃO DE AÇÚCAR',
      'ATACADAO',
      'ATACADÃO',
      'MERCADINHO',
      'FEIRA',
      'ACOUgue',
      'AÇOUGUE',
      'SWIFT',
      'HORTIFRUTI',
      'HORTEFRUTI',
      'SUPERMERCADO',
      'HIPERMERCADO',
      'MERCADO',
      'SACOLAO',
      'SACOLÃO',
      'PADARIA',
      'PANIFICADORA',
      'PEIXARIA',
      'SAMS CLUB',
      'SAM S CLUB',
      'DIA BRASIL',
      'QUITANDA',
    ],
  },

  // 5. Transporte (essentials)
  // Keywords: posto, shell, ipiranga, uber, 99, metro, sptrans, pedagio, sem parar, posto ipiranga
  {
    categoryNames: ['Transporte', 'Transporte Obrigatório'],
    type: 'expense',
    keywords: [
      'POSTO IPIRANGA',
      'POSTO',
      'SHELL',
      'IPIRANGA',
      'UBER',
      '99APP',
      '99 POP',
      '99 TÁXI',
      '99TAXI',
      '99',
      'METRO',
      'METRÔ',
      'SPTRANS',
      'PEDAGIO',
      'PEDÁGIO',
      'SEM PARAR',
      'CONECTCAR',
      'VELOE',
      'COMBUSTIVEL',
      'COMBUSTÍVEL',
      'GASOLINA',
      'ETANOL',
      'DIESEL',
      'BILHETE UNICO',
      'BILHETE ÚNICO',
      'CPTM',
      'ESTAPAR',
      'ESTACIONAMENTO',
    ],
  },

  // 6. Pets (lifestyle) - Precedência antes de Saúde para evitar falso positivo em clínicas/hospitais veterinários
  // Keywords: petz, cobasi, pet shop, veterinario, royal canin, premier pet, vet, animal
  {
    categoryNames: ['Pets'],
    type: 'expense',
    keywords: [
      'CLINICA VET',
      'HOSPITAL VET',
      'PET SHOP',
      'PETSHOP',
      'PETZ',
      'COBASI',
      'ZOOPLANET',
      'PETLOVE',
      'PREMIER PET',
      'ROYAL CANIN',
      'VETERINARIO',
      'VETERINÁRIO',
      'VETERINAR',
      'VET',
      'PET',
      'ANIMAL',
      'CANIL',
      'RACAO',
      'RAÇÃO',
      'BANHO E TOSA',
    ],
  },

  // 7. Saúde (essentials)
  // Keywords: drogasil, droga raia, pague menos, unimed, bradesco saude, laboratorio, fleury, dentista, farmacia
  {
    categoryNames: ['Saúde', 'Saúde & Cuidados Médicos'],
    type: 'expense',
    keywords: [
      'DROGASIL',
      'DROGA RAIA',
      'PAGUE MENOS',
      'UNIMED',
      'BRADESCO SAUDE',
      'LABORATORIO',
      'LABORATÓRIO',
      'FLEURY',
      'DENTISTA',
      'FARMACIA',
      'FARMÁCIA',
      'DROGARIA',
      'PANVEL',
      'ULTRAFARMA',
      'SULAMERICA SAUDE',
      'AMIL',
      'NOTREDAME',
      'HAPVIDA',
      'ODONTO',
      'CONSULTORIO',
      'CLINICA',
      'CLÍNICA',
      'HOSPITAL',
    ],
  },

  // 8. Educação (essentials)
  // Keywords: escola, colegio, faculdade, mensalidade, papelaria, van escolar
  {
    categoryNames: ['Educação', 'Educação Obrigatória'],
    type: 'expense',
    keywords: [
      'ESCOLA',
      'COLEGIO',
      'COLÉGIO',
      'FACULDADE',
      'MENSALIDADE',
      'PAPELARIA',
      'VAN ESCOLAR',
      'UNIVERSIDADE',
      'KALUNGA',
      'MENSALIDADE ESCOLAR',
      'LIVRARIA',
    ],
  },

  // 9. Dívidas & Empréstimos (essentials)
  {
    categoryNames: ['Dívidas & Empréstimos', 'Dívidas', 'Empréstimos'],
    type: 'expense',
    keywords: [
      'FATURA ANTERIOR',
      'PARCELAMENTO FATURA',
      'ROTATIVO',
      'EMPRESTIMO',
      'EMPRÉSTIMO',
      'EMPRESTIMO PESSOAL',
      'EMPRÉSTIMO PESSOAL',
      'CREDIARIO',
      'CREDIÁRIO',
      'FINANCIAMENTO',
      'CHEQUE ESPECIAL',
      'OVERDRAFT',
    ],
  },

  // 10. Restaurantes & Delivery (lifestyle)
  // Keywords: ifood, rappi, mcdonalds, outback, burger king, bar, choperia, cafeteria, starbucks, restaurante
  {
    categoryNames: [
      'Restaurantes & Delivery',
      'Gastronomia & Delivery',
      'Lazer & Gastronomia',
      'Restaurantes e Delivery',
    ],
    type: 'expense',
    keywords: [
      'IFOOD',
      'RAPPI',
      'MCDONALDS',
      'MC DONALD',
      'OUTBACK',
      'BURGER KING',
      'CHOPERIA',
      'CAFETERIA',
      'STARBUCKS',
      'RESTAURANTE',
      'REST',
      'PIZZARIA',
      'PIZZA',
      'HAMBURGUER',
      'BURGER',
      'LANCHONETE',
      'SUBWAY',
      'BAR',
      'BOTECO',
      'CHURRASCARIA',
      'AIQFOME',
      'UBER EATS',
      'SORVETE',
      'SORVETERIA',
      'ACAI',
      'AÇAÍ',
      'GELATO',
      'BACIO DI LATTE',
      'OAKBERRY',
      'CONVENIENCIA',
      'CONVENIÊNCIA',
    ],
  },

  // 11. Lazer (lifestyle)
  // Keywords: cinemark, ingresso.com, sympla, airbnb, hotel, booking, passagem aerea, azul, gol, latam
  {
    categoryNames: ['Lazer', 'Lazer & Passeios', 'Viagens'],
    type: 'expense',
    keywords: [
      'CINEMARK',
      'INGRESSO.COM',
      'SYMPLA',
      'AIRBNB',
      'HOTEL',
      'BOOKING',
      'PASSAGEM AEREA',
      'AZUL',
      'GOL',
      'LATAM',
      'CINEMA',
      'KINOPLEX',
      'UCI',
      'EVENTIM',
      'TEATRO',
      'SHOW',
      'POUSADA',
      'RESORT',
      'DECOLAR',
    ],
  },

  // 10. Cuidados Pessoais & Bem-estar (lifestyle)
  // Keywords: smart fit, academia, boticario, sephora, salao, barbearia, natura, estetica
  {
    categoryNames: ['Cuidados Pessoais & Bem-estar', 'Cuidados Pessoais & Estética'],
    type: 'expense',
    keywords: [
      'SMART FIT',
      'ACADEMIA',
      'BOTICARIO',
      'BOTICÁRIO',
      'SEPHORA',
      'SALAO',
      'SALÃO',
      'BARBEARIA',
      'NATURA',
      'ESTETICA',
      'ESTÉTICA',
      'BLUEFIT',
      'GYMPASS',
      'TOTALPASS',
      'MANICURE',
      'COSMETICOS',
      'COSMÉTICOS',
      'PERFUMARIA',
    ],
  },

  // 13. Assinaturas & Apps (lifestyle)
  // Keywords: netflix, spotify, amazon prime, youtube premium, hbo, max, disney, apple, google one
  {
    categoryNames: [
      'Assinaturas & Apps',
      'Assinaturas & Conectividade',
      'Assinaturas & Serviços',
      'Assinaturas e Serviços',
    ],
    type: 'expense',
    keywords: [
      'NETFLIX',
      'SPOTIFY',
      'AMAZON PRIME',
      'PRIME VIDEO',
      'YOUTUBE PREMIUM',
      'HBO',
      'MAX',
      'DISNEY',
      'APPLE',
      'GOOGLE ONE',
      'GOOGLE STORAGE',
      'ICLOUD',
      'CHATGPT',
      'OPENAI',
      'DEEZER',
      'GLOBOPLAY',
      'CANVA',
      'MICROSOFT',
    ],
  },

  // 14. Compras (lifestyle)
  // Keywords: zara, renner, riachuelo, shein, shopee, mercado livre, amazon compras
  {
    categoryNames: ['Compras', 'Compras & Vestuário', 'Compras & Desejos', 'Vestuário'],
    type: 'expense',
    keywords: [
      'ZARA',
      'RENNER',
      'RIACHUELO',
      'SHEIN',
      'SHOPEE',
      'MERCADO LIVRE',
      'MERCADOLIVRE',
      'AMAZON COMPRAS',
      'AMAZON BRASIL',
      'AMAZON',
      'C&A',
      'HERING',
      'CENTAURO',
      'DECATHLON',
      'MAGALU',
      'MAGAZINE LUIZA',
      'ROUPAS',
      'CALCADOS',
      'CALÇADOS',
    ],
  },

  // 14. Reserva de Emergência (future)
  // Keywords: tesouro selic, cdb liquidez diaria, reserva, caixinha nubank
  {
    categoryNames: ['Reserva de Emergência'],
    type: 'expense',
    keywords: [
      'TESOURO SELIC',
      'CDB LIQUIDEZ DIARIA',
      'RESERVA',
      'CAIXINHA NUBANK',
      'RESERVA DE EMERGENCIA',
      'RESERVA DE EMERGÊNCIA',
    ],
  },

  // 16. Metas (future)
  // Keywords: fundo viagem, entrada apto, consorcio, meta
  {
    categoryNames: ['Metas', 'Metas & Grandes Sonhos', 'Grandes Projetos'],
    type: 'expense',
    keywords: [
      'FUNDO VIAGEM',
      'ENTRADA APTO',
      'CONSORCIO',
      'CONSÓRCIO',
      'META',
      'METAS',
      'CASA PROPRIA',
      'CASA PRÓPRIA',
      'TROCA DE CARRO',
    ],
  },

  // 17. Investimentos (future)
  // Keywords: xp investimentos, btg, inter invest, previdencia, tesouro ipca
  {
    categoryNames: [
      'Investimentos',
      'Investimentos de Longo Prazo',
      'Investimentos & Aposentadoria',
    ],
    type: 'expense',
    keywords: [
      'XP INVESTIMENTOS',
      'BTG',
      'INTER INVEST',
      'PREVIDENCIA',
      'PREVIDÊNCIA',
      'TESOURO IPCA',
      'APOSENTADORIA',
      'RICO CTVM',
      'CLEAR CTVM',
      'B3',
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
/**
 * Extrai termo normalizado da descrição para regras contínuas de aprendizado.
 * Retorna até 3 palavras significativas da descrição limpa, lowercase, sem acentos,
 * sem stop words e números de transação.
 */
export function extractLearningPattern(desc: string): string {
  if (!desc) return ''

  // Remove acentos e converte para minúsculas
  const noAccents = desc
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  // Remove caracteres especiais, mantendo letras e números
  const sanitized = noAccents.replace(/[^a-z0-9\s]/g, ' ')

  // Stop words e ruídos típicos de extrato e pagamento
  const stopWords = new Set([
    'compra',
    'pagamento',
    'pagto',
    'pix',
    'transf',
    'transferencia',
    'ted',
    'doc',
    'cartao',
    'debito',
    'credito',
    'auto',
    'posto',
    'de',
    'do',
    'da',
    'dos',
    'das',
    'em',
    'no',
    'na',
    'nos',
    'nas',
    'para',
    'por',
    'com',
    'ltda',
    'sa',
    'me',
    'epp',
    'eireli',
  ])

  const tokens = sanitized
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => {
      if (!w || w.length < 2) return false
      if (/^\d+$/.test(w)) return false // remove números isolados
      if (stopWords.has(w)) return false
      return true
    })

  // Até 3 palavras significativas
  const selected = tokens.slice(0, 3)
  if (selected.length > 0) {
    return selected.join(' ')
  }

  // Fallback caso todos tenham sido filtrados
  const fallbackTokens = sanitized
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !/^\d+$/.test(w))

  return fallbackTokens.slice(0, 3).join(' ') || noAccents.trim().slice(0, 30)
}

export function extractPatternFromDescription(desc: string): string {
  const norm = normalizeText(desc)
  if (!norm) return ''

  // Remover termos de ruído comuns de extratos antes do padrão
  let clean = norm
    .replace(
      /\b(COMPRA|PAGAMENTO|PAGTO|PIX|TRANSF|TED|DOC|CARTAO|DEBITO|CREDITO|AUTO|POSTO)\b/g,
      ' ',
    )
    .replace(/\b\d{2,}\b/g, ' ') // remove blocos de números
    .replace(/\s+/g, ' ')
    .trim()

  // Se restaram múltiplos termos e inicia com prefixo genérico de tipo de estabelecimento
  // (ex.: "CLINICA VET ESPACO ANIMAL" -> "VET ESPACO ANIMAL"), remove o prefixo genérico
  // preservando a especificidade do estabelecimento e evitando capturar termos isolados como "CLINICA"
  const genericPrefixMatch = clean.match(/^(?:CLINICA|CLINICAS|HOSPITAL|CONSULTORIO)\s+(.+)$/i)
  if (genericPrefixMatch && genericPrefixMatch[1].trim().length >= 2) {
    clean = genericPrefixMatch[1].trim()
  }

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

    // Cláusula de desempate/exclusão (negative check) para Saúde & Cuidados Médicos:
    // Nunca pontuar nem categorizar como Saúde se a descrição contiver radicais de pet/veterinária
    const isHealthRule = rule.categoryNames.some((name) => {
      const norm = normalizeText(name)
      return norm.includes('SAUDE')
    })

    if (isHealthRule) {
      const hasPetKeyword =
        normDesc.includes('VET') || normDesc.includes('PET') || normDesc.includes('ANIMAL')
      if (hasPetKeyword) {
        continue
      }
    }

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
