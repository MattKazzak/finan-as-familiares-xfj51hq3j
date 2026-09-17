-- Migração inicial: Finanças da Família
-- Criação de enums, tabelas, índices, RLS e seed de usuário/família inicial

-- 1. ENUMS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_type') THEN
    CREATE TYPE public.asset_type AS ENUM ('stock', 'fii', 'fixed_income', 'crypto', 'treasury', 'other');
  END IF;
END $$;

-- 2. TABELAS
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  type public.transaction_type NOT NULL DEFAULT 'expense',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  type public.transaction_type NOT NULL,
  amount_cents BIGINT NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT budgets_family_category_month_key UNIQUE (family_id, category_id, month)
);

CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  target_amount_cents BIGINT NOT NULL,
  deadline DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ticker TEXT,
  asset_type public.asset_type NOT NULL DEFAULT 'other',
  quantity NUMERIC NOT NULL DEFAULT 1,
  avg_price_cents BIGINT NOT NULL DEFAULT 0,
  current_price_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_family_members_family ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_trans_cat_family ON public.transaction_categories(family_id);
CREATE INDEX IF NOT EXISTS idx_transactions_family_date ON public.transactions(family_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_member ON public.transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_family_month ON public.budgets(family_id, month);
CREATE INDEX IF NOT EXISTS idx_goals_family ON public.goals(family_id);
CREATE INDEX IF NOT EXISTS idx_investments_family ON public.investments(family_id);

-- 4. RLS EM TODAS AS TABELAS
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- Políticas para role authenticated
DROP POLICY IF EXISTS "auth_all_families" ON public.families;
CREATE POLICY "auth_all_families" ON public.families
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_family_members" ON public.family_members;
CREATE POLICY "auth_all_family_members" ON public.family_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_transaction_categories" ON public.transaction_categories;
CREATE POLICY "auth_all_transaction_categories" ON public.transaction_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_transactions" ON public.transactions;
CREATE POLICY "auth_all_transactions" ON public.transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_budgets" ON public.budgets;
CREATE POLICY "auth_all_budgets" ON public.budgets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_goals" ON public.goals;
CREATE POLICY "auth_all_goals" ON public.goals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_investments" ON public.investments;
CREATE POLICY "auth_all_investments" ON public.investments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. SEED: Usuário innexu1@gmail.com, Família, Membro Admin e Categorias Padrão
DO $$
DECLARE
  seed_user_id UUID;
  seed_family_id UUID;
  seed_admin_member_id UUID;
  cat_alimentacao_id UUID;
  cat_transporte_id UUID;
  cat_moradia_id UUID;
  cat_lazer_id UUID;
  cat_saude_id UUID;
  cat_educacao_id UUID;
  cat_vestuario_id UUID;
  cat_outros_id UUID;
  cat_salario_id UUID;
  cat_invest_id UUID;
  curr_month DATE;
  prev_month DATE;
BEGIN
  -- Se o usuário já existir, pega o ID; senão cria
  SELECT id INTO seed_user_id FROM auth.users WHERE email = 'innexu1@gmail.com';

  IF seed_user_id IS NULL THEN
    seed_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      seed_user_id,
      '00000000-0000-0000-0000-000000000000',
      'innexu1@gmail.com',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Família Silva"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL, '', '', ''
    );
  END IF;

  -- Verifica ou cria família para o usuário
  SELECT id INTO seed_family_id FROM public.families WHERE created_by = seed_user_id LIMIT 1;
  IF seed_family_id IS NULL THEN
    INSERT INTO public.families (name, created_by)
    VALUES ('Silva', seed_user_id)
    RETURNING id INTO seed_family_id;
  END IF;

  -- Membro Admin da família
  SELECT id INTO seed_admin_member_id FROM public.family_members WHERE family_id = seed_family_id AND is_admin = true LIMIT 1;
  IF seed_admin_member_id IS NULL THEN
    INSERT INTO public.family_members (family_id, name, is_admin)
    VALUES (seed_family_id, 'Admin', true)
    RETURNING id INTO seed_admin_member_id;

    -- Membro adicional comum para já demonstrar atribuição em família
    INSERT INTO public.family_members (family_id, name, is_admin)
    VALUES (seed_family_id, 'Camila', false);
  END IF;

  -- Categorias Padrão
  -- Despesas
  INSERT INTO public.transaction_categories (family_id, name, icon, color, type)
  VALUES
    (seed_family_id, 'Alimentação', 'Utensils', '#F59E0B', 'expense'),
    (seed_family_id, 'Transporte', 'Car', '#3B82F6', 'expense'),
    (seed_family_id, 'Moradia', 'Home', '#6366F1', 'expense'),
    (seed_family_id, 'Lazer', 'Film', '#EC4899', 'expense'),
    (seed_family_id, 'Saúde', 'HeartPulse', '#EF4444', 'expense'),
    (seed_family_id, 'Educação', 'GraduationCap', '#8B5CF6', 'expense'),
    (seed_family_id, 'Vestuário', 'Shirt', '#14B8A6', 'expense'),
    (seed_family_id, 'Outros', 'Tag', '#64748B', 'expense'),
    (seed_family_id, 'Salário', 'Briefcase', '#10B981', 'income'),
    (seed_family_id, 'Rendimentos', 'TrendingUp', '#059669', 'income')
  ON CONFLICT DO NOTHING;

  -- Capturar algumas categorias para sementes de demonstração
  SELECT id INTO cat_alimentacao_id FROM public.transaction_categories WHERE family_id = seed_family_id AND name = 'Alimentação' LIMIT 1;
  SELECT id INTO cat_transporte_id FROM public.transaction_categories WHERE family_id = seed_family_id AND name = 'Transporte' LIMIT 1;
  SELECT id INTO cat_moradia_id FROM public.transaction_categories WHERE family_id = seed_family_id AND name = 'Moradia' LIMIT 1;
  SELECT id INTO cat_lazer_id FROM public.transaction_categories WHERE family_id = seed_family_id AND name = 'Lazer' LIMIT 1;
  SELECT id INTO cat_salario_id FROM public.transaction_categories WHERE family_id = seed_family_id AND name = 'Salário' LIMIT 1;

  curr_month := date_trunc('month', CURRENT_DATE)::DATE;
  prev_month := (date_trunc('month', CURRENT_DATE) - interval '1 month')::DATE;

  -- Orçamentos do mês atual para categorias principais
  IF cat_alimentacao_id IS NOT NULL THEN
    INSERT INTO public.budgets (family_id, category_id, month, amount_cents)
    VALUES (seed_family_id, cat_alimentacao_id, curr_month, 180000)
    ON CONFLICT (family_id, category_id, month) DO NOTHING;
  END IF;

  IF cat_transporte_id IS NOT NULL THEN
    INSERT INTO public.budgets (family_id, category_id, month, amount_cents)
    VALUES (seed_family_id, cat_transporte_id, curr_month, 60000)
    ON CONFLICT (family_id, category_id, month) DO NOTHING;
  END IF;

  IF cat_moradia_id IS NOT NULL THEN
    INSERT INTO public.budgets (family_id, category_id, month, amount_cents)
    VALUES (seed_family_id, cat_moradia_id, curr_month, 250000)
    ON CONFLICT (family_id, category_id, month) DO NOTHING;
  END IF;

  -- Transações de demonstração para a família (se ainda não houver nenhuma)
  IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE family_id = seed_family_id) THEN
    -- Salário do mês
    IF cat_salario_id IS NOT NULL THEN
      INSERT INTO public.transactions (family_id, member_id, category_id, type, amount_cents, description, transaction_date)
      VALUES (seed_family_id, seed_admin_member_id, cat_salario_id, 'income', 850000, 'Salário mensal', CURRENT_DATE - 5);
    END IF;

    -- Despesas
    IF cat_alimentacao_id IS NOT NULL THEN
      INSERT INTO public.transactions (family_id, member_id, category_id, type, amount_cents, description, transaction_date)
      VALUES
        (seed_family_id, seed_admin_member_id, cat_alimentacao_id, 'expense', 45290, 'Supermercado da semana', CURRENT_DATE),
        (seed_family_id, seed_admin_member_id, cat_alimentacao_id, 'expense', 8950, 'Almoço em família', CURRENT_DATE - 2);
    END IF;

    IF cat_transporte_id IS NOT NULL THEN
      INSERT INTO public.transactions (family_id, member_id, category_id, type, amount_cents, description, transaction_date)
      VALUES (seed_family_id, seed_admin_member_id, cat_transporte_id, 'expense', 19000, 'Combustível posto Ipiranga', CURRENT_DATE - 3);
    END IF;

    IF cat_moradia_id IS NOT NULL THEN
      INSERT INTO public.transactions (family_id, member_id, category_id, type, amount_cents, description, transaction_date)
      VALUES (seed_family_id, seed_admin_member_id, cat_moradia_id, 'expense', 185000, 'Condomínio e energia', CURRENT_DATE - 7);
    END IF;

    -- Transação no mês anterior para calcular variação %
    IF cat_salario_id IS NOT NULL THEN
      INSERT INTO public.transactions (family_id, member_id, category_id, type, amount_cents, description, transaction_date)
      VALUES (seed_family_id, seed_admin_member_id, cat_salario_id, 'income', 800000, 'Salário mês passado', prev_month + 5);
    END IF;
  END IF;

  -- Metas de demonstração
  IF NOT EXISTS (SELECT 1 FROM public.goals WHERE family_id = seed_family_id) THEN
    INSERT INTO public.goals (family_id, name, category_id, target_amount_cents, deadline)
    VALUES
      (seed_family_id, 'Viagem de férias', cat_lazer_id, 1200000, CURRENT_DATE + interval '8 months'),
      (seed_family_id, 'Reserva de emergência', NULL, 3000000, CURRENT_DATE + interval '14 months');
  END IF;

  -- Investimentos de demonstração
  IF NOT EXISTS (SELECT 1 FROM public.investments WHERE family_id = seed_family_id) THEN
    INSERT INTO public.investments (family_id, name, ticker, asset_type, quantity, avg_price_cents, current_price_cents)
    VALUES
      (seed_family_id, 'Itaú Unibanco PN', 'ITUB4', 'stock', 200, 3150, 3520),
      (seed_family_id, 'Maxi Renda FII', 'MXRF11', 'fii', 500, 1020, 1045),
      (seed_family_id, 'Tesouro Selic 2029', 'LFT', 'treasury', 2.5, 1420000, 1465000),
      (seed_family_id, 'CDB 110% CDI', 'BANCO INTER', 'fixed_income', 1, 1000000, 1084000);
  END IF;

END $$;
