-- Migration: Multi-Família (Multi-Tenant) com RLS e Isolamento Completo
-- Versão: 20260921203000_multi_family_tenant_rls.sql

-- 1. Helper function para verificar se o usuário autenticado pertence à família
CREATE OR REPLACE FUNCTION public.user_belongs_to_family(f_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = f_id AND f.created_by = auth.uid()
  );
$$;

-- 2. Atualizar RLS de todas as tabelas principais

-- FAMILIES
DROP POLICY IF EXISTS "auth_all_families" ON public.families;
CREATE POLICY "families_select_policy" ON public.families
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "families_insert_policy" ON public.families
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY "families_update_policy" ON public.families
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "families_delete_policy" ON public.families
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- FAMILY MEMBERS
DROP POLICY IF EXISTS "auth_all_family_members" ON public.family_members;
CREATE POLICY "family_members_select_policy" ON public.family_members
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_family(family_id));

CREATE POLICY "family_members_insert_policy" ON public.family_members
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "family_members_update_policy" ON public.family_members
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_family(family_id))
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "family_members_delete_policy" ON public.family_members
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- TRANSACTION CATEGORIES
DROP POLICY IF EXISTS "auth_all_transaction_categories" ON public.transaction_categories;
CREATE POLICY "transaction_categories_select_policy" ON public.transaction_categories
  FOR SELECT TO authenticated
  USING (family_id IS NULL OR public.user_belongs_to_family(family_id));

CREATE POLICY "transaction_categories_insert_policy" ON public.transaction_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "transaction_categories_update_policy" ON public.transaction_categories
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_family(family_id))
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "transaction_categories_delete_policy" ON public.transaction_categories
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- TRANSACTION SUBCATEGORIES
DROP POLICY IF EXISTS "auth_all_transaction_subcategories" ON public.transaction_subcategories;
CREATE POLICY "transaction_subcategories_select_policy" ON public.transaction_subcategories
  FOR SELECT TO authenticated
  USING (family_id IS NULL OR public.user_belongs_to_family(family_id));

CREATE POLICY "transaction_subcategories_insert_policy" ON public.transaction_subcategories
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "transaction_subcategories_update_policy" ON public.transaction_subcategories
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_family(family_id))
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "transaction_subcategories_delete_policy" ON public.transaction_subcategories
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- TRANSACTIONS
DROP POLICY IF EXISTS "auth_all_transactions" ON public.transactions;
CREATE POLICY "transactions_select_policy" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_family(family_id));

CREATE POLICY "transactions_insert_policy" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "transactions_update_policy" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_family(family_id))
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "transactions_delete_policy" ON public.transactions
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- BUDGETS
DROP POLICY IF EXISTS "auth_all_budgets" ON public.budgets;
CREATE POLICY "budgets_select_policy" ON public.budgets
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_family(family_id));

CREATE POLICY "budgets_insert_policy" ON public.budgets
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "budgets_update_policy" ON public.budgets
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_family(family_id))
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "budgets_delete_policy" ON public.budgets
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- DEFAULT BUDGETS
DROP POLICY IF EXISTS "auth_all_default_budgets" ON public.default_budgets;
CREATE POLICY "default_budgets_select_policy" ON public.default_budgets
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_family(family_id));

CREATE POLICY "default_budgets_insert_policy" ON public.default_budgets
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "default_budgets_update_policy" ON public.default_budgets
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_family(family_id))
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "default_budgets_delete_policy" ON public.default_budgets
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- GOALS
DROP POLICY IF EXISTS "auth_all_goals" ON public.goals;
CREATE POLICY "goals_select_policy" ON public.goals
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_family(family_id));

CREATE POLICY "goals_insert_policy" ON public.goals
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "goals_update_policy" ON public.goals
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_family(family_id))
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "goals_delete_policy" ON public.goals
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- INVESTMENTS
DROP POLICY IF EXISTS "auth_all_investments" ON public.investments;
CREATE POLICY "investments_select_policy" ON public.investments
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_family(family_id));

CREATE POLICY "investments_insert_policy" ON public.investments
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "investments_update_policy" ON public.investments
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_family(family_id))
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "investments_delete_policy" ON public.investments
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- RECURRING INCOMES
DROP POLICY IF EXISTS "auth_all_recurring_incomes" ON public.recurring_incomes;
CREATE POLICY "recurring_incomes_select_policy" ON public.recurring_incomes
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_family(family_id));

CREATE POLICY "recurring_incomes_insert_policy" ON public.recurring_incomes
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "recurring_incomes_update_policy" ON public.recurring_incomes
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_family(family_id))
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "recurring_incomes_delete_policy" ON public.recurring_incomes
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- RECURRING INCOME OVERRIDES
DROP POLICY IF EXISTS "auth_all_recurring_income_overrides" ON public.recurring_income_overrides;
CREATE POLICY "recurring_income_overrides_select_policy" ON public.recurring_income_overrides
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_family(family_id));

CREATE POLICY "recurring_income_overrides_insert_policy" ON public.recurring_income_overrides
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "recurring_income_overrides_update_policy" ON public.recurring_income_overrides
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_family(family_id))
  WITH CHECK (public.user_belongs_to_family(family_id));

CREATE POLICY "recurring_income_overrides_delete_policy" ON public.recurring_income_overrides
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- CATEGORIZATION RULES
DROP POLICY IF EXISTS "auth_all_categorization_rules" ON public.categorization_rules;
CREATE POLICY "categorization_rules_select_policy" ON public.categorization_rules
  FOR SELECT TO authenticated
  USING (
    (family_id IS NOT NULL AND public.user_belongs_to_family(family_id))
    OR user_id = auth.uid()
  );

CREATE POLICY "categorization_rules_insert_policy" ON public.categorization_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    (family_id IS NOT NULL AND public.user_belongs_to_family(family_id))
    OR user_id = auth.uid()
  );

CREATE POLICY "categorization_rules_update_policy" ON public.categorization_rules
  FOR UPDATE TO authenticated
  USING (
    (family_id IS NOT NULL AND public.user_belongs_to_family(family_id))
    OR user_id = auth.uid()
  )
  WITH CHECK (
    (family_id IS NOT NULL AND public.user_belongs_to_family(family_id))
    OR user_id = auth.uid()
  );

CREATE POLICY "categorization_rules_delete_policy" ON public.categorization_rules
  FOR DELETE TO authenticated
  USING (
    (family_id IS NOT NULL AND public.user_belongs_to_family(family_id))
    OR user_id = auth.uid()
  );

-- 3. Função RPC para criação atômica e confiável de nova família com membro inicial e categorias padrão
CREATE OR REPLACE FUNCTION public.create_new_family_workspace(
  p_family_name TEXT,
  p_member_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_family_id UUID;
  v_member_id UUID;
  v_f_name TEXT;
  v_m_name TEXT;
  v_cat_alim UUID;
  v_cat_mora UUID;
  v_cat_tran UUID;
  v_cat_laze UUID;
  v_cat_saud UUID;
  v_cat_educ UUID;
  v_cat_vest UUID;
  v_cat_outr UUID;
  v_cat_sala UUID;
  v_cat_rend UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_f_name := TRIM(COALESCE(p_family_name, ''));
  IF v_f_name = '' THEN
    v_f_name := 'Minha Família';
  END IF;

  v_m_name := TRIM(COALESCE(p_member_name, ''));
  IF v_m_name = '' THEN
    v_m_name := 'Principal';
  END IF;

  -- 1. Cria a família
  INSERT INTO public.families (name, created_by, monthly_net_income_cents)
  VALUES (v_f_name, v_user_id, 0)
  RETURNING id INTO v_family_id;

  -- 2. Cria o primeiro membro administrador padrão
  INSERT INTO public.family_members (family_id, name, is_admin)
  VALUES (v_family_id, v_m_name, true)
  RETURNING id INTO v_member_id;

  -- 3. Cria as categorias padrão de Despesas e Receitas
  -- Despesas Essenciais (essentials)
  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Moradia', 'Home', '#6366F1', 'expense', 'essentials', 1)
  RETURNING id INTO v_cat_mora;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Alimentação', 'Utensils', '#F59E0B', 'expense', 'essentials', 2)
  RETURNING id INTO v_cat_alim;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Transporte', 'Car', '#3B82F6', 'expense', 'essentials', 3)
  RETURNING id INTO v_cat_tran;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Saúde', 'HeartPulse', '#EF4444', 'expense', 'essentials', 4)
  RETURNING id INTO v_cat_saud;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Educação', 'GraduationCap', '#8B5CF6', 'expense', 'essentials', 5)
  RETURNING id INTO v_cat_educ;

  -- Despesas Estilo de Vida (lifestyle)
  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Lazer', 'Film', '#EC4899', 'expense', 'lifestyle', 6)
  RETURNING id INTO v_cat_laze;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Vestuário', 'Shirt', '#14B8A6', 'expense', 'lifestyle', 7)
  RETURNING id INTO v_cat_vest;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Outros', 'Tag', '#64748B', 'expense', 'lifestyle', 8)
  RETURNING id INTO v_cat_outr;

  -- Receitas (income)
  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Salário', 'Briefcase', '#10B981', 'income', NULL, 9)
  RETURNING id INTO v_cat_sala;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Rendimentos', 'TrendingUp', '#059669', 'income', NULL, 10)
  RETURNING id INTO v_cat_rend;

  -- 4. Cria subcategorias padrão essenciais
  -- Moradia
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES 
    (v_cat_mora, v_family_id, 'Aluguel / Condomínio', 'Home', '#6366F1', 1),
    (v_cat_mora, v_family_id, 'Energia / Luz', 'Zap', '#F59E0B', 2),
    (v_cat_mora, v_family_id, 'Água / Saneamento', 'Droplets', '#06B6D4', 3),
    (v_cat_mora, v_family_id, 'Internet / Telefonia', 'Wifi', '#3B82F6', 4);

  -- Alimentação
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES 
    (v_cat_alim, v_family_id, 'Supermercado', 'ShoppingCart', '#F59E0B', 1),
    (v_cat_alim, v_family_id, 'Restaurantes & Lanches', 'UtensilsCrossed', '#F97316', 2),
    (v_cat_alim, v_family_id, 'Delivery & Padaria', 'Coffee', '#D97706', 3);

  -- Transporte
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES 
    (v_cat_tran, v_family_id, 'Combustível', 'Fuel', '#3B82F6', 1),
    (v_cat_tran, v_family_id, 'Aplicativos (Uber/99)', 'Car', '#2563EB', 2),
    (v_cat_tran, v_family_id, 'Manutenção & Seguro', 'Wrench', '#1D4ED8', 3);

  -- Saúde
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES 
    (v_cat_saud, v_family_id, 'Farmácia', 'Pill', '#EF4444', 1),
    (v_cat_saud, v_family_id, 'Plano de Saúde & Consultas', 'HeartPulse', '#DC2626', 2);

  -- Lazer
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES 
    (v_cat_laze, v_family_id, 'Streaming & Assinaturas', 'Tv', '#EC4899', 1),
    (v_cat_laze, v_family_id, 'Passeios & Viagens', 'Plane', '#DB2777', 2);

  -- Salário
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES 
    (v_cat_sala, v_family_id, 'Salário Principal', 'Briefcase', '#10B981', 1),
    (v_cat_sala, v_family_id, 'Benefícios (VR/VA)', 'CreditCard', '#059669', 2);

  -- 5. Regras básicas de categorização padrão para a nova família
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id)
  VALUES
    (v_family_id, v_user_id, 'CARREFOUR', v_cat_alim),
    (v_family_id, v_user_id, 'PÃO DE AÇÚCAR', v_cat_alim),
    (v_family_id, v_user_id, 'PAO DE ACUCAR', v_cat_alim),
    (v_family_id, v_user_id, 'ASSAI', v_cat_alim),
    (v_family_id, v_user_id, 'ASSAÍ', v_cat_alim),
    (v_family_id, v_user_id, 'UBER', v_cat_tran),
    (v_family_id, v_user_id, '99APP', v_cat_tran),
    (v_family_id, v_user_id, 'POSTO', v_cat_tran),
    (v_family_id, v_user_id, 'IPIRANGA', v_cat_tran),
    (v_family_id, v_user_id, 'SHELL', v_cat_tran),
    (v_family_id, v_user_id, 'FARMACIA', v_cat_saud),
    (v_family_id, v_user_id, 'DROGASIL', v_cat_saud),
    (v_family_id, v_user_id, 'DROGA RAIA', v_cat_saud),
    (v_family_id, v_user_id, 'NETFLIX', v_cat_laze),
    (v_family_id, v_user_id, 'SPOTIFY', v_cat_laze)
  ON CONFLICT DO NOTHING;

  RETURN v_family_id;
END;
$$;
