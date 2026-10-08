// Tipos da aplicação Finanças da Família

export type TransactionType = 'income' | 'expense'
export const TRANSACTION_TYPES = ['income', 'expense'] as const

export type AssetType = 'stock' | 'fii' | 'fixed_income' | 'crypto' | 'treasury' | 'other'
export const ASSET_TYPES = ['stock', 'fii', 'fixed_income', 'crypto', 'treasury', 'other'] as const

export interface Family {
  id: string
  name: string
  avatar_url?: string | null
  monthly_net_income_cents?: number | null
  budget_model?: string | null
  created_by: string | null
  created_at: string
}

export interface FamilyMember {
  id: string
  family_id: string
  name: string
  is_admin: boolean
  user_id?: string | null
  created_at: string
}

export type FamilyRole = 'admin' | 'member'
export const FAMILY_ROLES = ['admin', 'member'] as const

export type FamilyInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired'
export const FAMILY_INVITE_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const

export interface FamilyInvite {
  id: string
  code: string
  family_id: string
  created_by: string
  role: FamilyRole | string
  status: FamilyInviteStatus
  max_uses: number
  uses_count: number
  expires_at: string
  created_at: string
  accepted_by?: string | null
  accepted_at?: string | null
}

export interface FamilyInvitePreview {
  valid: boolean
  code?: string
  family_id?: string
  family_name?: string
  expires_at?: string
  error?: string
}

export type BudgetBucket = 'essentials' | 'lifestyle' | 'future'
export const BUDGET_BUCKETS = ['essentials', 'lifestyle', 'future'] as const

export interface CanonicalCategoryDefinition {
  name: string
  bucket: BudgetBucket | null
  icon: string
  color: string
  type: TransactionType
  sort_order: number
  subcategories: Array<{
    name: string
    icon?: string
    color?: string
    sort_order?: number
  }>
}

/**
 * Taxonomia Canônica Oficial Curiangoo (D0 a D4 - 19 categorias / ~62 subcategorias)
 */
export const CANONICAL_CATEGORIES: readonly CanonicalCategoryDefinition[] = [
  // 1. Moradia (essentials)
  {
    name: 'Moradia',
    bucket: 'essentials',
    icon: 'Home',
    color: '#6366F1',
    type: 'expense',
    sort_order: 1,
    subcategories: [
      { name: 'Aluguel / Condomínio', icon: 'Home' },
      { name: 'Energia Elétrica', icon: 'Zap' },
      { name: 'Água & Saneamento', icon: 'Droplets' },
      { name: 'Gás', icon: 'Flame' },
      { name: 'Internet & Fixo', icon: 'Wifi' },
      { name: 'Manutenção da Casa', icon: 'Wrench' },
    ],
  },
  // 2. Alimentação (essentials, renomeada de Alimentação Básica)
  {
    name: 'Alimentação',
    bucket: 'essentials',
    icon: 'ShoppingCart',
    color: '#10B981',
    type: 'expense',
    sort_order: 2,
    subcategories: [
      { name: 'Supermercado', icon: 'ShoppingCart' },
      { name: 'Açougue & Peixaria', icon: 'Beef' },
      { name: 'Hortifruti & Feira', icon: 'Apple' },
      { name: 'Padaria do Dia a Dia', icon: 'Coffee' },
    ],
  },
  // 3. Transporte (essentials, renomeada de Transporte Obrigatório)
  {
    name: 'Transporte',
    bucket: 'essentials',
    icon: 'Car',
    color: '#3B82F6',
    type: 'expense',
    sort_order: 3,
    subcategories: [
      { name: 'Combustível', icon: 'Fuel' },
      { name: 'Transporte Público & Bilhete', icon: 'Bus' },
      { name: 'Aplicativos do Dia a Dia (Uber/99)', icon: 'Car' },
      { name: 'Estacionamento & Pedágio', icon: 'CircleParking' },
      { name: 'Seguro & IPVA', icon: 'ShieldAlert' },
      { name: 'Manutenção Básica', icon: 'Wrench' },
    ],
  },
  // 4. Saúde (essentials, renomeada de Saúde & Cuidados Médicos)
  {
    name: 'Saúde',
    bucket: 'essentials',
    icon: 'HeartPulse',
    color: '#EF4444',
    type: 'expense',
    sort_order: 4,
    subcategories: [
      { name: 'Plano de Saúde', icon: 'Shield' },
      { name: 'Farmácia & Medicamentos', icon: 'Pill' },
      { name: 'Consultas & Exames', icon: 'Stethoscope' },
      { name: 'Odontologia', icon: 'Smile' },
    ],
  },
  // 5. Educação (essentials, renomeada de Educação Obrigatória)
  {
    name: 'Educação',
    bucket: 'essentials',
    icon: 'GraduationCap',
    color: '#8B5CF6',
    type: 'expense',
    sort_order: 5,
    subcategories: [
      { name: 'Mensalidade Escolar / Faculdade', icon: 'GraduationCap' },
      { name: 'Material & Uniformes', icon: 'BookOpen' },
      { name: 'Transporte Escolar', icon: 'Bus' },
    ],
  },
  // 6. Dívidas & Empréstimos (essentials - NOVA CATEGORIA D1)
  {
    name: 'Dívidas & Empréstimos',
    bucket: 'essentials',
    icon: 'CreditCard',
    color: '#DC2626',
    type: 'expense',
    sort_order: 6,
    subcategories: [
      { name: 'Fatura do Cartão (Rotativo & Parcelado)', icon: 'CreditCard' },
      { name: 'Empréstimos Pessoais', icon: 'Banknote' },
      { name: 'Financiamentos (Casa/Auto)', icon: 'Home' },
      { name: 'Cheque Especial & Overdraft', icon: 'AlertCircle' },
    ],
  },
  // 7. Restaurantes & Delivery (lifestyle, renomeada de Gastronomia & Delivery)
  {
    name: 'Restaurantes & Delivery',
    bucket: 'lifestyle',
    icon: 'Utensils',
    color: '#F59E0B',
    type: 'expense',
    sort_order: 7,
    subcategories: [
      { name: 'Restaurantes & Bares', icon: 'Utensils' },
      { name: 'Delivery (iFood/Rappi)', icon: 'Bike' },
      { name: 'Fast Food & Lanches', icon: 'Coffee' },
      { name: 'Cafeterias', icon: 'Coffee' },
      { name: 'Sorvete & Açaí', icon: 'IceCream' },
      { name: 'Conveniência & Lanchonetes de Posto', icon: 'Store' },
    ],
  },
  // 8. Lazer (lifestyle, renomeada de Lazer & Passeios)
  {
    name: 'Lazer',
    bucket: 'lifestyle',
    icon: 'Ticket',
    color: '#F97316',
    type: 'expense',
    sort_order: 8,
    subcategories: [
      { name: 'Cinema', icon: 'Film' },
      { name: 'Shows & Eventos', icon: 'Ticket' },
      { name: 'Viagens & Hospedagem', icon: 'Plane' },
      { name: 'Passeios de Fim de Semana', icon: 'Sun' },
    ],
  },
  // 9. Cuidados Pessoais & Bem-estar (lifestyle)
  {
    name: 'Cuidados Pessoais & Bem-estar',
    bucket: 'lifestyle',
    icon: 'Sparkles',
    color: '#EC4899',
    type: 'expense',
    sort_order: 9,
    subcategories: [
      { name: 'Barbearia / Salão de Beleza', icon: 'Scissors' },
      { name: 'Manicure & Estética', icon: 'Sparkles' },
      { name: 'Cosméticos & Perfumaria', icon: 'Package' },
      { name: 'Academia & Esportes', icon: 'Activity' },
    ],
  },
  // 10. Assinaturas & Apps (lifestyle, renomeada de Assinaturas & Conectividade)
  {
    name: 'Assinaturas & Apps',
    bucket: 'lifestyle',
    icon: 'Tv',
    color: '#7C3AED',
    type: 'expense',
    sort_order: 10,
    subcategories: [
      { name: 'Streaming de Vídeo & Música', icon: 'Tv' },
      { name: 'Softwares & Apps', icon: 'Terminal' },
      { name: 'Clubes de Assinatura', icon: 'Sparkles' },
    ],
  },
  // 11. Compras (lifestyle, renomeada de Compras & Vestuário)
  {
    name: 'Compras',
    bucket: 'lifestyle',
    icon: 'ShoppingBag',
    color: '#D97706',
    type: 'expense',
    sort_order: 11,
    subcategories: [
      { name: 'Roupas & Calçados', icon: 'Shirt' },
      { name: 'Eletrônicos & Gadgets', icon: 'Laptop' },
      { name: 'Decoração & Utilidades', icon: 'Home' },
      { name: 'Presentes', icon: 'Gift' },
    ],
  },
  // 12. Pets (lifestyle)
  {
    name: 'Pets',
    bucket: 'lifestyle',
    icon: 'PawPrint',
    color: '#84CC16',
    type: 'expense',
    sort_order: 12,
    subcategories: [
      { name: 'Ração & Petiscos', icon: 'Utensils' },
      { name: 'Veterinário & Vacinas', icon: 'HeartPulse' },
      { name: 'Banho, Tosa & Acessórios', icon: 'Sparkles' },
    ],
  },
  // 13. Reserva de Emergência (future)
  {
    name: 'Reserva de Emergência',
    bucket: 'future',
    icon: 'ShieldCheck',
    color: '#10B981',
    type: 'expense',
    sort_order: 13,
    subcategories: [
      { name: 'Aportes na Reserva', icon: 'ShieldCheck' },
      { name: 'Resgates Emergenciais', icon: 'ArrowDownRight' },
    ],
  },
  // 14. Metas (future, renomeada de Metas & Grandes Sonhos)
  {
    name: 'Metas',
    bucket: 'future',
    icon: 'Target',
    color: '#06B6D4',
    type: 'expense',
    sort_order: 14,
    subcategories: [
      { name: 'Troca de Carro', icon: 'Car' },
      { name: 'Casa Própria', icon: 'Home' },
      { name: 'Viagem Internacional', icon: 'Plane' },
      { name: 'Reforma', icon: 'Wrench' },
    ],
  },
  // 15. Investimentos (future, renomeada de Investimentos de Longo Prazo)
  {
    name: 'Investimentos',
    bucket: 'future',
    icon: 'TrendingUp',
    color: '#059669',
    type: 'expense',
    sort_order: 15,
    subcategories: [
      { name: 'Previdência Privada', icon: 'Landmark' },
      { name: 'Ações & Fundos Imobiliários', icon: 'TrendingUp' },
      { name: 'Aposentadoria', icon: 'PiggyBank' },
    ],
  },
  // 16. Salário (income)
  {
    name: 'Salário',
    bucket: null,
    icon: 'Briefcase',
    color: '#10B981',
    type: 'income',
    sort_order: 16,
    subcategories: [
      { name: 'Salário Principal', icon: 'Briefcase' },
      { name: 'Benefícios (VR/VA)', icon: 'CreditCard' },
    ],
  },
  // 17. Rendimentos (income)
  {
    name: 'Rendimentos',
    bucket: null,
    icon: 'TrendingUp',
    color: '#059669',
    type: 'income',
    sort_order: 17,
    subcategories: [
      { name: 'Dividendos & JCP', icon: 'TrendingUp' },
      { name: 'Rendimentos de Aplicações', icon: 'Landmark' },
    ],
  },
  // 18. Trabalhos Extras & Autônomo (income - NOVA CATEGORIA D2)
  {
    name: 'Trabalhos Extras & Autônomo',
    bucket: null,
    icon: 'Hammer',
    color: '#0EA5E9',
    type: 'income',
    sort_order: 18,
    subcategories: [
      { name: 'Freelances & Bicos', icon: 'Hammer' },
      { name: 'Venda de Produtos', icon: 'ShoppingBag' },
      { name: 'MEI & Autônomo', icon: 'Briefcase' },
      { name: 'Comissões & Gorjetas', icon: 'Coins' },
    ],
  },
  // 19. Outras Receitas (income - NOVA CATEGORIA D3)
  {
    name: 'Outras Receitas',
    bucket: null,
    icon: 'Undo2',
    color: '#64748B',
    type: 'income',
    sort_order: 19,
    subcategories: [
      { name: 'Reembolsos & Estornos', icon: 'Undo2' },
      { name: 'Cashback & Milhas', icon: 'Coins' },
      { name: 'Presentes Recebidos', icon: 'Gift' },
      { name: 'Vendas de Itens Usados', icon: 'Tag' },
    ],
  },
] as const

export interface TransactionCategory {
  id: string
  family_id: string | null
  name: string
  icon: string | null
  color: string | null
  type: TransactionType
  sort_order?: number
  percent_default?: number | null
  percent_alert?: number | null
  budget_bucket?: BudgetBucket | null
  created_at: string
  subcategories?: TransactionSubcategory[]
}

export interface TransactionSubcategory {
  id: string
  category_id: string
  family_id: string | null
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  created_at: string
}

export interface RecurringIncome {
  id: string
  family_id: string
  member_id: string
  category_id: string | null
  subcategory_id?: string | null
  name: string
  type?: TransactionType
  amount_cents: number
  day_of_month: number // 1..31
  active: boolean
  created_at: string
  // Relações resolvidas
  member?: FamilyMember
  category?: TransactionCategory
  subcategory?: TransactionSubcategory
}

export interface RecurringIncomeOverride {
  id: string
  recurring_income_id: string
  family_id: string
  month: string // YYYY-MM-01
  amount_cents: number
  created_at: string
}

export interface EffectiveRecurringIncome {
  recurringIncome: RecurringIncome
  effectiveAmountCents: number
  defaultAmountCents: number
  isOverridden: boolean
  overrideId?: string
  hasGeneratedThisMonth: boolean
  generatedTransactionId?: string
  scheduledDate: string // YYYY-MM-DD
}

export type TransactionStatus = 'confirmed' | 'projected'
export const TRANSACTION_STATUSES = ['confirmed', 'projected'] as const

export type PaymentMethod = 'pix' | 'credit' | 'debit' | 'cash' | 'voucher' | 'other'
export const PAYMENT_METHODS = ['pix', 'credit', 'debit', 'cash', 'voucher', 'other'] as const

export interface Transaction {
  id: string
  family_id: string
  member_id: string
  category_id: string | null
  subcategory_id?: string | null
  type: TransactionType
  amount_cents: number
  description: string | null
  transaction_date: string // YYYY-MM-DD
  created_at: string
  recurring_income_id?: string | null
  is_recurring?: boolean
  recurring_month?: string | null
  is_installment?: boolean
  installment_number?: number | null
  installment_total?: number | null
  installment_group_id?: string | null
  status?: TransactionStatus
  bank_transaction_id?: string | null
  payment_method?: PaymentMethod | null
  // Relações resolvidas
  member?: FamilyMember
  category?: TransactionCategory
  subcategory?: TransactionSubcategory
  recurring_income?: RecurringIncome
}

export interface DefaultBudget {
  id: string
  family_id: string
  category_id: string
  subcategory_id: string | null
  amount_cents: number
  created_at: string
  category?: TransactionCategory
  subcategory?: TransactionSubcategory
}

export interface Budget {
  id: string
  family_id: string
  category_id: string
  subcategory_id?: string | null
  month: string // YYYY-MM-01
  amount_cents: number
  created_at: string
  category?: TransactionCategory
  subcategory?: TransactionSubcategory
}

// Representação de orçamento efetivo do mês (com indicação se é override pontual ou padrão recorrente)
export interface EffectiveBudget {
  categoryId: string
  subcategoryId?: string | null
  amountCents: number
  isOverridden: boolean // true se o mês atual foi modificado pontualmente
  defaultAmountCents?: number // valor padrão se houver
  monthBudgetId?: string // id do registro na tabela budgets (se for override)
  defaultBudgetId?: string // id do registro na tabela default_budgets
}

export interface CategorizationRule {
  id: string
  user_id?: string | null
  family_id?: string | null
  pattern: string
  category_id: string
  subcategory_id?: string | null
  created_at: string
  category?: TransactionCategory
  subcategory?: TransactionSubcategory
}

export interface Goal {
  id: string
  family_id: string
  name: string
  category_id: string | null
  target_amount_cents: number
  deadline: string // YYYY-MM-DD
  created_at: string
  category?: TransactionCategory
}

export interface Investment {
  id: string
  family_id: string
  name: string
  ticker: string | null
  asset_type: AssetType
  quantity: number
  avg_price_cents: number
  current_price_cents: number
  created_at: string
}
