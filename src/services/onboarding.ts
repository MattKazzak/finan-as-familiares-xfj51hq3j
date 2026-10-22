import { supabase } from '@/lib/supabase/client'
import { BudgetBucket, CANONICAL_CATEGORIES } from '@/types/finance'
import { upsertDefaultBudget } from '@/services/transactions'
import {
  updateFamilyDetails,
  activateFamilyOnboardingPlanRpc,
  type ActivateFamilyOnboardingPlanResult,
} from '@/services/family'
import { toast } from '@/hooks/use-toast'

export interface CategorySubcategorySeed {
  name: string
  icon?: string
  color?: string
  keywords?: string[]
}

/**
 * Percentuais canônicos de referência para o modelo base 50/30/20 (apenas despesas).
 */
export const CANONICAL_BUDGET_PERCENTAGES: Record<string, number> = {
  Moradia: 20,
  Alimentação: 14,
  Transporte: 8,
  Saúde: 5,
  Educação: 3,
  'Dívidas & Empréstimos': 0,
  'Restaurantes & Delivery': 10,
  Lazer: 5,
  'Cuidados Pessoais & Bem-estar': 5,
  'Assinaturas & Apps': 3,
  Compras: 4,
  Pets: 3,
  'Reserva de Emergência': 10,
  Metas: 4,
  Investimentos: 6,
}

/**
 * Regras canônicas de IA determinísticas para semeadura no banco (41 regras).
 * Espelho exato da semeadura atômica da RPC activate_family_onboarding_plan.
 */
export const CANONICAL_AI_RULES: ReadonlyArray<{
  pattern: string
  categoryName: string
  subcategoryName: string
}> = [
  // Dívidas & Empréstimos
  {
    pattern: 'ROTATIVO',
    categoryName: 'Dívidas & Empréstimos',
    subcategoryName: 'Dívida do Cartão (juros e parcelas em atraso)',
  },
  {
    pattern: 'FATURA ANTERIOR',
    categoryName: 'Dívidas & Empréstimos',
    subcategoryName: 'Fatura do Cartão (Rotativo & Parcelado)',
  },
  {
    pattern: 'EMPRESTIMO',
    categoryName: 'Dívidas & Empréstimos',
    subcategoryName: 'Empréstimos Pessoais',
  },
  {
    pattern: 'CONSIGNADO',
    categoryName: 'Dívidas & Empréstimos',
    subcategoryName: 'Empréstimos Pessoais',
  },
  {
    pattern: 'CREDIARIO',
    categoryName: 'Dívidas & Empréstimos',
    subcategoryName: 'Empréstimos Pessoais',
  },
  {
    pattern: 'FINANCIAMENTO IMOBILIARIO',
    categoryName: 'Dívidas & Empréstimos',
    subcategoryName: 'Financiamento Imobiliário',
  },
  {
    pattern: 'CHEQUE ESPECIAL',
    categoryName: 'Dívidas & Empréstimos',
    subcategoryName: 'Cheque Especial & Overdraft',
  },

  // Bebês & Crianças (Compras)
  { pattern: 'FRALDA', categoryName: 'Compras', subcategoryName: 'Bebês & Crianças' },
  { pattern: 'ENXOVAL', categoryName: 'Compras', subcategoryName: 'Bebês & Crianças' },
  { pattern: 'BEBE', categoryName: 'Compras', subcategoryName: 'Bebês & Crianças' },
  { pattern: 'RI HAPPY', categoryName: 'Compras', subcategoryName: 'Bebês & Crianças' },

  // Marmitas & Refeições no Trabalho (Restaurantes & Delivery)
  {
    pattern: 'MARMITA',
    categoryName: 'Restaurantes & Delivery',
    subcategoryName: 'Marmitas & Refeições no Trabalho',
  },
  {
    pattern: 'QUENTINHA',
    categoryName: 'Restaurantes & Delivery',
    subcategoryName: 'Marmitas & Refeições no Trabalho',
  },

  // Coparticipação (Saúde)
  {
    pattern: 'COPARTICIPACAO',
    categoryName: 'Saúde',
    subcategoryName: 'Plano de Saúde (mensalidade e coparticipação)',
  },

  // 13º e Férias (Salário)
  { pattern: '13O', categoryName: 'Salário', subcategoryName: '13º & Férias' },
  { pattern: '13º', categoryName: 'Salário', subcategoryName: '13º & Férias' },
  { pattern: 'FERIAS', categoryName: 'Salário', subcategoryName: '13º & Férias' },

  // Investimentos
  { pattern: 'TESOURO DIRETO', categoryName: 'Investimentos', subcategoryName: 'Tesouro Direto' },
  { pattern: 'TESOURO SELIC', categoryName: 'Investimentos', subcategoryName: 'Tesouro Direto' },
  { pattern: 'CDB', categoryName: 'Investimentos', subcategoryName: 'Renda Fixa (CDB/LCI/LCA)' },
  { pattern: 'LCI', categoryName: 'Investimentos', subcategoryName: 'Renda Fixa (CDB/LCI/LCA)' },
  { pattern: 'LCA', categoryName: 'Investimentos', subcategoryName: 'Renda Fixa (CDB/LCI/LCA)' },

  // Rendimentos
  { pattern: 'DIVIDENDO', categoryName: 'Rendimentos', subcategoryName: 'Dividendos & JCP' },
  { pattern: 'JCP', categoryName: 'Rendimentos', subcategoryName: 'Dividendos & JCP' },
  { pattern: 'PENSAO', categoryName: 'Rendimentos', subcategoryName: 'Aposentadoria & Pensão' },

  // Outras Receitas
  {
    pattern: 'RESTITUICAO IR',
    categoryName: 'Outras Receitas',
    subcategoryName: 'Restituição de Imposto de Renda',
  },

  // Padrões do dia a dia
  {
    pattern: 'IFOOD',
    categoryName: 'Restaurantes & Delivery',
    subcategoryName: 'Delivery (iFood/Rappi)',
  },
  {
    pattern: 'RAPPI',
    categoryName: 'Restaurantes & Delivery',
    subcategoryName: 'Delivery (iFood/Rappi)',
  },
  { pattern: 'UBER', categoryName: 'Transporte', subcategoryName: 'Apps & Táxi (Uber/99)' },
  { pattern: '99APP', categoryName: 'Transporte', subcategoryName: 'Apps & Táxi (Uber/99)' },
  { pattern: 'POSTO', categoryName: 'Transporte', subcategoryName: 'Combustível' },
  { pattern: 'SHELL', categoryName: 'Transporte', subcategoryName: 'Combustível' },
  { pattern: 'IPIRANGA', categoryName: 'Transporte', subcategoryName: 'Combustível' },
  { pattern: 'NETFLIX', categoryName: 'Assinaturas & Apps', subcategoryName: 'Streaming de Vídeo' },
  { pattern: 'SPOTIFY', categoryName: 'Assinaturas & Apps', subcategoryName: 'Música & Podcasts' },
  { pattern: 'DROGASIL', categoryName: 'Saúde', subcategoryName: 'Farmácia & Medicamentos' },
  { pattern: 'DROGA RAIA', categoryName: 'Saúde', subcategoryName: 'Farmácia & Medicamentos' },
  { pattern: 'PETZ', categoryName: 'Pets', subcategoryName: 'Ração & Petiscos' },
  { pattern: 'COBASI', categoryName: 'Pets', subcategoryName: 'Ração & Petiscos' },
  { pattern: 'CARREFOUR', categoryName: 'Alimentação', subcategoryName: 'Supermercado & Atacado' },
  { pattern: 'ASSAI', categoryName: 'Alimentação', subcategoryName: 'Supermercado & Atacado' },
]

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
 * Taxonomia Canônica Oficial do Curiangoo:
 * 19 categorias mestras (15 despesas nos 3 baldes + 4 receitas) e 117 subcategorias.
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
        name: 'Aluguel & Condomínio',
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
        name: 'Celular & Telefonia',
        icon: 'Smartphone',
        keywords: [
          'celular',
          'tim',
          'claro celular',
          'vivo celular',
          'telefonia',
          'recarga celular',
        ],
      },
      {
        name: 'IPTU & Taxas do Imóvel',
        icon: 'Landmark',
        keywords: ['iptu', 'taxa de lixo', 'foro', 'taxa condominial extraordinária'],
      },
      {
        name: 'Seguro Residencial',
        icon: 'Shield',
        keywords: ['seguro residencial', 'porto seguro residencia', 'tokio marine residencial'],
      },
      {
        name: 'Manutenção & Reparos',
        icon: 'Wrench',
        keywords: ['manutencao', 'reparo', 'encanador', 'eletricista', 'marcenaria', 'pintura'],
      },
      {
        name: 'Serviços Domésticos',
        icon: 'Sparkles',
        keywords: ['diarista', 'faxineira', 'passadeira', 'limpeza domestica'],
      },
      {
        name: 'Mudança',
        icon: 'Truck',
        keywords: ['mudanca', 'frete mudanca', 'carreto', 'embalagem mudanca'],
      },
      {
        name: 'Limpeza & Higiene da Casa',
        icon: 'Sparkles',
        keywords: [
          'produtos de limpeza',
          'sabao em po',
          'detergente',
          'desinfetante',
          'papel higienico',
          'amaciante',
          'esponja',
          'limpeza da casa',
        ],
      },
    ],
  },
  {
    name: 'Alimentação',
    bucket: 'essentials',
    icon: 'ShoppingCart',
    color: '#10B981', // Esmeralda
    type: 'expense',
    suggestedPercent: 14,
    subcategories: [
      {
        name: 'Supermercado & Atacado',
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
          'tenda atacado',
          'roldao',
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
        name: 'Padaria & Mercearia',
        icon: 'Coffee',
        keywords: ['padaria', 'panificadora', 'pao do dia', 'mercearia'],
      },
      {
        name: 'Água & Bebidas para Casa',
        icon: 'Droplets',
        keywords: ['galao de agua', 'agua mineral', 'distribuidora de bebidas', 'bebidas em casa'],
      },
    ],
  },
  {
    name: 'Transporte',
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
        name: 'Transporte Público',
        icon: 'Bus',
        keywords: ['metro', 'sptrans', 'bilhete unico', 'cptm', 'onibus'],
      },
      {
        name: 'Apps & Táxi (Uber/99)',
        icon: 'Car',
        keywords: ['uber', '99', '99app', '99 pop', '99 taxi', 'cabify', 'indrive', 'taxi'],
      },
      {
        name: 'Estacionamento & Pedágio',
        icon: 'CircleParking',
        keywords: ['pedagio', 'sem parar', 'conectcar', 'veloe', 'estapar', 'estacionamento'],
      },
      {
        name: 'Oficina & Manutenção',
        icon: 'Wrench',
        keywords: [
          'oficina mecanica',
          'auto pecas',
          'pneu',
          'troca de oleo',
          'alinhamento',
          'balanceamento',
        ],
      },
      {
        name: 'IPVA & Licenciamento',
        icon: 'ShieldAlert',
        keywords: ['ipva', 'dpvat', 'licenciamento', 'detran taxas'],
      },
      {
        name: 'Seguro do Veículo',
        icon: 'ShieldCheck',
        keywords: ['seguro auto', 'porto seguro auto', 'azul seguros', 'tokio marine auto'],
      },
    ],
  },
  {
    name: 'Saúde',
    bucket: 'essentials',
    icon: 'HeartPulse',
    color: '#EF4444', // Vermelho/Rosa
    type: 'expense',
    suggestedPercent: 5,
    subcategories: [
      {
        name: 'Plano de Saúde & Convênio',
        icon: 'Shield',
        keywords: [
          'unimed',
          'bradesco saude',
          'sulamerica saude',
          'amil',
          'notredame',
          'hapvida',
          'convenio medico',
        ],
      },
      {
        name: 'Plano de Saúde (mensalidade e coparticipação)',
        icon: 'HeartPulse',
        keywords: ['coparticipacao', 'coparticipacao unimed', 'coparticipacao plano'],
      },
      {
        name: 'Consultas & Exames',
        icon: 'Stethoscope',
        keywords: ['laboratorio', 'fleury', 'dasa', 'lavoisier', 'consulta medica', 'clinica'],
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
        name: 'Odontologia',
        icon: 'Smile',
        keywords: ['dentista', 'odonto', 'ortodontia'],
      },
      {
        name: 'Terapias & Psicologia',
        icon: 'HeartHandshake',
        keywords: [
          'psicologo',
          'psicologa',
          'terapia',
          'sessao de terapia',
          'psicanalise',
          'fonoaudiologo',
        ],
      },
      {
        name: 'Óculos & Aparelhos',
        icon: 'Eye',
        keywords: [
          'otica',
          'lente de contato',
          'oculos de grau',
          'chilli beans grau',
          'aparelho auditivo',
        ],
      },
    ],
  },
  {
    name: 'Educação',
    bucket: 'essentials',
    icon: 'GraduationCap',
    color: '#8B5CF6', // Violeta
    type: 'expense',
    suggestedPercent: 3,
    subcategories: [
      {
        name: 'Escola & Creche',
        icon: 'GraduationCap',
        keywords: ['escola', 'colegio', 'creche', 'bercario', 'mensalidade escolar'],
      },
      {
        name: 'Faculdade',
        icon: 'BookOpen',
        keywords: ['faculdade', 'universidade', 'pos graduacao', 'mba', 'mensalidade faculdade'],
      },
      {
        name: 'Cursos & Idiomas',
        icon: 'Languages',
        keywords: [
          'curso de ingles',
          'wizard',
          'cultura inglesa',
          'curso online',
          'alura',
          'udemy',
        ],
      },
      {
        name: 'Material & Livros Didáticos',
        icon: 'Book',
        keywords: ['papelaria', 'kalunga', 'material escolar', 'livro didatico', 'apostila'],
      },
      {
        name: 'Uniformes',
        icon: 'Shirt',
        keywords: ['uniforme escolar', 'uniformes'],
      },
      {
        name: 'Transporte Escolar',
        icon: 'Bus',
        keywords: ['van escolar', 'transporte escolar'],
      },
    ],
  },
  {
    name: 'Dívidas & Empréstimos',
    bucket: 'essentials',
    icon: 'CreditCard',
    color: '#DC2626',
    type: 'expense',
    suggestedPercent: 0,
    subcategories: [
      {
        name: 'Dívida do Cartão (juros e parcelas em atraso)',
        icon: 'CreditCard',
        keywords: ['fatura anterior', 'parcelamento fatura', 'rotativo cartao', 'juros cartao'],
      },
      {
        name: 'Empréstimos Pessoais',
        icon: 'Banknote',
        keywords: ['emprestimo', 'emprestimo pessoal', 'consignado', 'crediario'],
      },
      {
        name: 'Financiamento Imobiliário',
        icon: 'Home',
        keywords: [
          'financiamento habitacional',
          'prestacao casa',
          'caixa hab',
          'credito imobiliario',
        ],
      },
      {
        name: 'Financiamento de Veículo',
        icon: 'Car',
        keywords: [
          'financiamento veiculo',
          'prestacao carro',
          'financiamento auto',
          'parcela moto',
        ],
      },
      {
        name: 'Cheque Especial & Overdraft',
        icon: 'AlertCircle',
        keywords: ['cheque especial', 'juros cheque especial', 'overdraft', 'encargos conta'],
      },
      {
        name: 'Renegociações & Parcelamentos',
        icon: 'Scale',
        keywords: ['renegociacao', 'acordo divida', 'serasa limpa nome', 'acordo banco'],
      },
      {
        name: 'Juros & Multas',
        icon: 'AlertTriangle',
        keywords: ['juros de mora', 'multa por atraso', 'juros e encargos'],
      },
    ],
  },

  // Lifestyle (Estilo de Vida - 30%)
  {
    name: 'Restaurantes & Delivery',
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
        name: 'Lanches & Cafeterias',
        icon: 'Coffee',
        keywords: [
          'cafeteria',
          'starbucks',
          'cacau show',
          'kopenhagen',
          'casa do pao de queijo',
          'mcdonalds',
          'burger king',
          'subway',
          'habibs',
          'bobs',
          'pastel',
          'lanches rapido',
        ],
      },
      {
        name: 'Sorvete & Açaí',
        icon: 'IceCream',
        keywords: ['sorvete', 'sorveteria', 'acai', 'açaí', 'gelato', 'bacio di latte', 'oakberry'],
      },
      {
        name: 'Conveniência & Lanchonetes de Posto',
        icon: 'Store',
        keywords: ['conveniencia', 'am/pm', 'ampm', 'shell select', 'br mania'],
      },
      {
        name: 'Marmitas & Refeições no Trabalho',
        icon: 'Salad',
        keywords: ['marmita', 'marmitaria', 'quentinha', 'almoco executivo'],
      },
    ],
  },
  {
    name: 'Lazer',
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
        name: 'Passeios & Parques',
        icon: 'Sun',
        keywords: ['passeio', 'parque', 'clube', 'resort', 'zoologico', 'aquario'],
      },
      {
        name: 'Viagens (passagens, hospedagem e passeios)',
        icon: 'Plane',
        keywords: [
          'airbnb',
          'hotel',
          'booking',
          'passagem aerea',
          'azul',
          'gol',
          'latam',
          'pousada',
        ],
      },

      {
        name: 'Hobbies',
        icon: 'Gamepad2',
        keywords: ['boardgame', 'hobby', 'aeromodelismo', 'colecionaveis', 'steam games'],
      },
      {
        name: 'Livros & Cultura',
        icon: 'Book',
        keywords: ['livraria', 'livro', 'saraiva', 'panini', 'museu', 'exposicao'],
      },
      {
        name: 'Encontros & Festas',
        icon: 'PartyPopper',
        keywords: [
          'festa',
          'churrasco',
          'reuniao',
          'reunião',
          'evento social',
          'aniversario',
          'aniversário',
          'encontro',
          'show',
          'ingresso',
          'happy hour',
          'sympla',
          'eventim',
          'teatro',
          'evento',
        ],
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
        name: 'Barbearia/Salão',
        icon: 'Scissors',
        keywords: ['salao', 'barbearia', 'cabelereiro', 'corte cabelo'],
      },
      {
        name: 'Manicure & Estética',
        icon: 'Sparkles',
        keywords: ['estetica', 'manicure', 'pedicure', 'depilacao', 'sobrancelha'],
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
      {
        name: 'Spa & Massagem',
        icon: 'HeartPulse',
        keywords: ['spa', 'massagem', 'drenagem', 'ofuro', 'relaxamento'],
      },
    ],
  },
  {
    name: 'Assinaturas & Apps',
    bucket: 'lifestyle',
    icon: 'Tv',
    color: '#7C3AED', // Roxo
    type: 'expense',
    suggestedPercent: 3,
    subcategories: [
      {
        name: 'Streaming de Vídeo',
        icon: 'Tv',
        keywords: [
          'netflix',
          'amazon prime',
          'youtube premium',
          'hbo',
          'max',
          'disney',
          'globoplay',
          'prime video',
        ],
      },
      {
        name: 'Música & Podcasts',
        icon: 'Music',
        keywords: ['spotify', 'deezer', 'apple music', 'amazon music', 'podcast'],
      },
      {
        name: 'Softwares & Apps',
        icon: 'Terminal',
        keywords: ['apple', 'chatgpt', 'openai', 'canva', 'microsoft 365', 'adobe'],
      },
      {
        name: 'Jogos & Gaming',
        icon: 'Gamepad',
        keywords: ['playstation plus', 'psn', 'xbox game pass', 'nintendo switch online'],
      },
      {
        name: 'Jornais & Revistas Digitais',
        icon: 'Newspaper',
        keywords: ['folha', 'estadao', 'valor economico', 'globo digital', 'revista'],
      },
      {
        name: 'Armazenamento & Nuvem',
        icon: 'Cloud',
        keywords: ['google one', 'icloud', 'dropbox', 'onedrive'],
      },
      {
        name: 'Clubes de Assinatura',
        icon: 'Sparkles',
        keywords: ['clube de assinatura', 'wine', 'tag livros', 'clube do cafe'],
      },
    ],
  },
  {
    name: 'Compras',
    bucket: 'lifestyle',
    icon: 'ShoppingBag',
    color: '#D97706', // Amarelo escuro
    type: 'expense',
    suggestedPercent: 4,
    subcategories: [
      {
        name: 'Roupas',
        icon: 'Shirt',
        keywords: ['zara', 'renner', 'riachuelo', 'shein', 'c&a', 'hering', 'roupas', 'vestuario'],
      },
      {
        name: 'Calçados',
        icon: 'ShoppingBag',
        keywords: [
          'centauro',
          'calcados',
          'tenis',
          'shoes',
          'arezzo',
          'anacapri',
          'authentic feet',
        ],
      },
      {
        name: 'Eletrônicos & Gadgets',
        icon: 'Laptop',
        keywords: ['mercado livre', 'amazon compras', 'fast shop', 'kabum', 'smartphone compra'],
      },
      {
        name: 'Eletrodomésticos',
        icon: 'Tv',
        keywords: ['magalu', 'magazine luiza', 'casas bahia', 'geladeira', 'fogao', 'microondas'],
      },
      {
        name: 'Móveis & Decoração',
        icon: 'Home',
        keywords: ['camicado', 'tok&stok', 'leroy merlin', 'moveis', 'sofa', 'decoracao'],
      },
      {
        name: 'Utilidades & Casa',
        icon: 'Package',
        keywords: ['daiso', 'utilidades', 'panelas', 'pratos', 'copos', 'bazar'],
      },
      {
        name: 'Presentes',
        icon: 'Gift',
        keywords: ['presente', 'presentes', 'aniversario'],
      },
      {
        name: 'Bebês & Crianças',
        icon: 'Smile',
        keywords: ['fralda', 'enxoval', 'bebe', 'ri happy', 'brinquedo', 'alo bebe'],
      },
      {
        name: 'Tabaco & Cigarros',
        icon: 'Flame',
        keywords: ['cigarro', 'tabaco', 'tabacaria', 'vape', 'charuto', 'pod'],
      },
      {
        name: 'Doações & Caridade',
        icon: 'HeartHandshake',
        keywords: [
          'doacao',
          'doar',
          'caridade',
          'doacao para o catador',
          'catador',
          'ajuda social',
        ],
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
    name: 'Metas',
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
      {
        name: 'Educação Futura (dos Filhos)',
        icon: 'GraduationCap',
        keywords: ['faculdade filhos', 'educacao futura', 'poupanca filhos'],
      },
      {
        name: 'Meta Livre',
        icon: 'Target',
        keywords: ['meta livre', 'sonho pessoal', 'poupanca meta'],
      },
    ],
  },
  {
    name: 'Investimentos',
    bucket: 'future',
    icon: 'TrendingUp',
    color: '#059669', // Verde
    type: 'expense',
    suggestedPercent: 6,
    subcategories: [
      {
        name: 'Tesouro Direto',
        icon: 'Landmark',
        keywords: ['tesouro direto', 'tesouro selic', 'tesouro ipca', 'tesouro prefixado'],
      },
      {
        name: 'Renda Fixa (CDB/LCI/LCA)',
        icon: 'Banknote',
        keywords: ['cdb', 'lci', 'lca', 'cri', 'cra', 'renda fixa', 'debêntures'],
      },
      {
        name: 'Ações & ETFs',
        icon: 'TrendingUp',
        keywords: ['acoes', 'etf', 'bova11', 'ivvb11', 'bolsa de valores'],
      },
      {
        name: 'Fundos Imobiliários (FIIs)',
        icon: 'Building',
        keywords: ['fiis', 'fundo imobiliario', 'proventos fiis', 'rendimentos fii'],
      },
      {
        name: 'Criptomoedas',
        icon: 'Coins',
        keywords: ['bitcoin', 'btc', 'ethereum', 'crypto', 'criptomoeda', 'binance'],
      },
      {
        name: 'Previdência Privada',
        icon: 'Landmark',
        keywords: ['previdencia', 'previdencia privada', 'pgbl', 'vgbl'],
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
/**
 * Ativa o planejamento familiar e semeia a árvore "Padrão Ouro" no servidor via RPC atômica rápida.
 * Elimina ~300 requisições sequenciais do cliente HTTP, respondendo em frações de segundo.
 * Possui fallback gracioso caso a RPC falhe por incompatibilidade temporária.
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

  // 1. Tentativa de chamada à RPC atômica com retry e backoff curto (2 tentativas extras: ~500ms e ~1500ms)
  let rpcResult: ActivateFamilyOnboardingPlanResult | null = null
  let lastRpcError: any = null
  const retryDelays = [500, 1500]

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      rpcResult = await activateFamilyOnboardingPlanRpc({
        familyId,
        monthlyNetIncomeCents,
        modelPresetId,
      })
      break
    } catch (err: any) {
      lastRpcError = err
      if (attempt < retryDelays.length) {
        const delayMs = retryDelays[attempt]
        console.warn(
          `[onboarding] Tentativa ${attempt + 1} da RPC activate_family_onboarding_plan falhou. Repetindo em ${delayMs}ms...`,
          err,
        )
        await new Promise((res) => setTimeout(res, delayMs))
      }
    }
  }

  if (rpcResult) {
    return {
      createdCategoriesCount: rpcResult.categories_count,
      createdSubcategoriesCount: rpcResult.subcategories_count,
      totalBudgetCents: rpcResult.total_budget_cents,
    }
  }

  // 2. Fallback somente após esgotar todas as tentativas de retry
  console.error(
    '[onboarding] RPC activate_family_onboarding_plan falhou após retries. Acionando fallback canônico completo (19/117 + regras):',
    {
      familyId,
      monthlyNetIncomeCents,
      modelPresetId,
      error: lastRpcError?.message || lastRpcError,
    },
  )

  // Aviso visível discreto ao usuário
  try {
    toast({
      title: 'Conexão instável',
      description: 'Seu catálogo foi preparado, alguns ajustes podem ser solicitados.',
      variant: 'default',
    })
  } catch (toastErr) {
    console.warn('[onboarding] Não foi possível exibir toast de fallback:', toastErr)
  }

  // Fallback canônico completo (19 categorias / 117 subcategorias + regras de IA):
  // NUNCA mais semear árvores parciais ou degradadas (ex: 15/96).
  await updateFamilyDetails(familyId, {
    monthly_net_income_cents: monthlyNetIncomeCents,
    budget_model: modelPresetId,
  })

  // Obtém o usuário atual para vincular às regras de IA
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()
  const userId = currentUser?.id || null

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

  const { data: existingSubcategories, error: fetchSubError } = await (supabase as any)
    .from('transaction_subcategories')
    .select('id, category_id, name')
    .eq('family_id', familyId)

  if (fetchSubError) {
    throw fetchSubError
  }

  const existingSubMap = new Map<string, string>() // key -> id
  for (const s of existingSubcategories || []) {
    existingSubMap.set(`${s.category_id}::${s.name.trim().toLowerCase()}`, s.id)
  }

  let createdCategoriesCount = 0
  let createdSubcategoriesCount = 0
  let totalBudgetCents = 0

  // 1. Semeia as 19 categorias e 117 subcategorias de CANONICAL_CATEGORIES
  for (let i = 0; i < CANONICAL_CATEGORIES.length; i++) {
    const catDef = CANONICAL_CATEGORIES[i]
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
          sort_order: catDef.sort_order || i + 1,
        })
        .select()
        .single()

      if (insertCatError) {
        const { data: fallbackCat } = await (supabase as any)
          .from('transaction_categories')
          .select('id, name, budget_bucket, sort_order')
          .eq('family_id', familyId)
          .eq('name', catDef.name)
          .single()

        if (fallbackCat) {
          categoryRecord = fallbackCat
        } else {
          throw insertCatError
        }
      } else {
        categoryRecord = newCat
        existingCatMap.set(catKey, newCat)
        createdCategoriesCount += 1
      }
    }

    const categoryId = categoryRecord.id

    if (catDef.subcategories && catDef.subcategories.length > 0) {
      for (let sIdx = 0; sIdx < catDef.subcategories.length; sIdx++) {
        const subDef = catDef.subcategories[sIdx]
        const subKey = `${categoryId}::${subDef.name.trim().toLowerCase()}`
        let subcategoryId = existingSubMap.get(subKey) || null

        if (!subcategoryId) {
          const { data: newSub, error: insertSubError } = await (supabase as any)
            .from('transaction_subcategories')
            .insert({
              category_id: categoryId,
              family_id: familyId,
              name: subDef.name,
              icon: subDef.icon || catDef.icon,
              color: catDef.color,
              sort_order: sIdx + 1,
            })
            .select('id')
            .single()

          if (!insertSubError && newSub) {
            existingSubMap.set(subKey, newSub.id)
            createdSubcategoriesCount += 1
          } else {
            // Tenta recuperar se já inserido em conflito
            const { data: fallbackSub } = await (supabase as any)
              .from('transaction_subcategories')
              .select('id')
              .eq('category_id', categoryId)
              .eq('name', subDef.name)
              .single()
            if (fallbackSub?.id) {
              existingSubMap.set(subKey, fallbackSub.id)
            }
          }
        }
      }
    }

    // Aplicação de default_budgets para despesas se houver renda informada
    if (catDef.type === 'expense' && catDef.bucket && monthlyNetIncomeCents > 0) {
      const suggestedPercent = CANONICAL_BUDGET_PERCENTAGES[catDef.name] ?? 0
      const weightFactor = getCategoryWeightFactor(catDef.bucket, modelPresetId)
      const effectivePercent = suggestedPercent * weightFactor
      const targetAmountCents = Math.round((monthlyNetIncomeCents * effectivePercent) / 100)

      if (targetAmountCents > 0) {
        await upsertDefaultBudget(familyId, categoryId, targetAmountCents, null)
        totalBudgetCents += targetAmountCents
      }
    }
  }

  // 2. Semeia as ~41 regras de IA canônicas (categorization_rules)
  try {
    const { data: existingRules } = await (supabase as any)
      .from('categorization_rules')
      .select('pattern')
      .eq('family_id', familyId)

    const existingRulePatterns = new Set(
      (existingRules || []).map((r: any) => (r.pattern || '').trim().toUpperCase()),
    )

    const rulesToInsert: Array<{
      family_id: string
      user_id: string | null
      pattern: string
      category_id: string
      subcategory_id: string | null
    }> = []

    for (const ruleDef of CANONICAL_AI_RULES) {
      const patternKey = ruleDef.pattern.trim().toUpperCase()
      if (existingRulePatterns.has(patternKey)) {
        continue
      }

      const catRecord = existingCatMap.get(ruleDef.categoryName.trim().toLowerCase())
      if (!catRecord) continue

      const subKey = `${catRecord.id}::${ruleDef.subcategoryName.trim().toLowerCase()}`
      const subId = existingSubMap.get(subKey) || null

      rulesToInsert.push({
        family_id: familyId,
        user_id: userId,
        pattern: ruleDef.pattern,
        category_id: catRecord.id,
        subcategory_id: subId,
      })
    }

    if (rulesToInsert.length > 0) {
      await (supabase as any).from('categorization_rules').insert(rulesToInsert)
    }
  } catch (rulesErr) {
    console.warn('[onboarding] Aviso ao semear regras de categorização no fallback:', rulesErr)
  }

  return {
    createdCategoriesCount,
    createdSubcategoriesCount,
    totalBudgetCents,
  }
}
