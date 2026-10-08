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
