// Tipos da aplicação Finanças da Família

export type TransactionType = 'income' | 'expense'

export type AssetType = 'stock' | 'fii' | 'fixed_income' | 'crypto' | 'treasury' | 'other'

export interface Family {
  id: string
  name: string
  avatar_url?: string | null
  created_by: string | null
  created_at: string
}

export interface FamilyMember {
  id: string
  family_id: string
  name: string
  is_admin: boolean
  created_at: string
}

export interface TransactionCategory {
  id: string
  family_id: string | null
  name: string
  icon: string | null
  color: string | null
  type: TransactionType
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
  // Relações resolvidas
  member?: FamilyMember
  category?: TransactionCategory
  subcategory?: TransactionSubcategory
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
