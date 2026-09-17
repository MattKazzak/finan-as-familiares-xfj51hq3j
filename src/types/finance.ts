// Tipos da aplicação Finanças da Família

export type TransactionType = 'income' | 'expense'

export type AssetType = 'stock' | 'fii' | 'fixed_income' | 'crypto' | 'treasury' | 'other'

export interface Family {
  id: string
  name: string
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
}

export interface Transaction {
  id: string
  family_id: string
  member_id: string
  category_id: string | null
  type: TransactionType
  amount_cents: number
  description: string | null
  transaction_date: string // YYYY-MM-DD
  created_at: string
  // Relações resolvidas
  member?: FamilyMember
  category?: TransactionCategory
}

export interface Budget {
  id: string
  family_id: string
  category_id: string
  month: string // YYYY-MM-01
  amount_cents: number
  created_at: string
  category?: TransactionCategory
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
