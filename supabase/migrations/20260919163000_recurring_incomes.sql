-- Migração: Receitas fixas recorrentes mensais e vínculo com transações
-- Nomenclatura: 20260919163000_recurring_incomes.sql

-- 1. Tabela de receitas fixas recorrentes mensais
CREATE TABLE IF NOT EXISTS public.recurring_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.transaction_subcategories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de overrides/exceções pontuais por mês para receitas fixas
-- Permite alterar o valor apenas em determinado mês, ou marcar se foi pulado naquele mês
CREATE TABLE IF NOT EXISTS public.recurring_income_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_income_id UUID NOT NULL REFERENCES public.recurring_incomes(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- YYYY-MM-01
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_recurring_income_override_month UNIQUE (recurring_income_id, month)
);

-- 3. Adicionar campos na tabela transactions para rastrear lançamento automático e vínculo com receita fixa
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recurring_income_id UUID REFERENCES public.recurring_incomes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_month DATE; -- Mês de referência YYYY-MM-01 para garantir idempotência

-- 4. Índices para performance e idempotência
CREATE INDEX IF NOT EXISTS idx_recurring_incomes_family ON public.recurring_incomes(family_id);
CREATE INDEX IF NOT EXISTS idx_recurring_incomes_member ON public.recurring_incomes(member_id);
CREATE INDEX IF NOT EXISTS idx_recurring_overrides_family_month ON public.recurring_income_overrides(family_id, month);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring_income ON public.transactions(recurring_income_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring_month ON public.transactions(recurring_month);

-- Índice único condicional para garantir idempotência estrita no banco: 1 transação por receita fixa por mês
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_recurring_income_month
  ON public.transactions(recurring_income_id, recurring_month)
  WHERE recurring_income_id IS NOT NULL AND recurring_month IS NOT NULL;

-- 5. RLS Policies
ALTER TABLE public.recurring_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_income_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_recurring_incomes" ON public.recurring_incomes;
CREATE POLICY "auth_all_recurring_incomes" ON public.recurring_incomes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_recurring_income_overrides" ON public.recurring_income_overrides;
CREATE POLICY "auth_all_recurring_income_overrides" ON public.recurring_income_overrides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
