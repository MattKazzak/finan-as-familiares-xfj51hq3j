// Motor de categorização automática por palavras-chave em extratos bancários brasileiros
// Cobre os principais bancos (Nubank, Inter, Itaú, Bradesco, Santander, Caixa, C6, etc.)

import type { TransactionCategory, TransactionType } from '@/types/finance'

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
      'EXTRA',
      'BIG',
      'ZONA SUL',
      'HORTIFRUTI',
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
      'POSTO',
      'GASOLINA',
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
  // 7. Moradia
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
      'COMGAS',
      'ULTRAGAZ',
      'SUPERGASBRAS',
      'BOTIJAO',
      'DIARISTA',
      'FAXINA',
    ],
  },
  // 8. Contas e Utilidades
  {
    categoryNames: ['Contas e Utilidades', 'Moradia'],
    type: 'expense',
    keywords: [
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
      'SABESP',
      'COPASA',
      'SANEPAR',
      'CEDAE',
      'AGUAS',
      'ÁGUAS',
      'CLARO',
      'VIVO',
      'TIM',
      'OI FIXO',
      'TELEFONICA',
      'INTERNET',
      'BANDA LARGA',
      'FIBRA',
    ],
  },
  // 9. Assinaturas e Serviços
  {
    categoryNames: ['Assinaturas e Serviços', 'Lazer'],
    type: 'expense',
    keywords: [
      'NETFLIX',
      'SPOTIFY',
      'AMAZON PRIME',
      'PRIME VIDEO',
      'DISNEY',
      'HBO',
      'MAX',
      'GLOBO',
      'GLOBOPLAY',
      'YOUTUBE',
      'APPLE.COM',
      'APPLE COM',
      'GOOGLE STORAGE',
      'GOOGLE ONE',
      'ICLOUD',
      'MICROSOFT',
      'CHATGPT',
      'OPENAI',
      'DEEZER',
      'CRUNCHYROLL',
      'PARAMOUNT',
      'DEEZER',
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
    categoryNames: ['Compras'],
    type: 'expense',
    keywords: [
      'MERCADO LIVRE',
      'MERCADOLIVRE',
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
export function predictCategory(
  description: string,
  type: TransactionType,
  categories: TransactionCategory[],
): TransactionCategory | null {
  const normDesc = normalizeText(description)
  if (!normDesc) return null

  // Filtra as categorias do tipo correto (income ou expense)
  const availableCategories = categories.filter((c) => c.type === type)
  if (availableCategories.length === 0) return null

  // Mapeia nome normalizado de cada categoria cadastrada
  const catByNameMap = new Map<string, TransactionCategory>()
  availableCategories.forEach((cat) => {
    catByNameMap.set(normalizeText(cat.name), cat)
  })

  // 1. Procura nas regras pré-configuradas de mercado
  for (const rule of AUTO_CATEGORIZATION_RULES) {
    if (rule.type && rule.type !== type) continue

    // Verifica se alguma palavra-chave bate com a descrição
    const matched = rule.keywords.some((kw) => {
      const normKw = normalizeText(kw)
      // Correspondência por palavra inteira ou substring relevante
      return normDesc.includes(normKw)
    })

    if (matched) {
      // Procura se a família tem alguma das categorias listadas na regra
      for (const targetName of rule.categoryNames) {
        const normTarget = normalizeText(targetName)
        const found = catByNameMap.get(normTarget)
        if (found) return found
      }
    }
  }

  // 2. Se nenhuma regra bater, verifica se o próprio nome de alguma categoria cadastrada está contido na descrição
  for (const cat of availableCategories) {
    const normCat = normalizeText(cat.name)
    if (normCat.length >= 3 && normDesc.includes(normCat)) {
      return cat
    }
  }

  return null
}
