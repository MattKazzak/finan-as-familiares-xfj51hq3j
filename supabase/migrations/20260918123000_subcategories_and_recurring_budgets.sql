-- Migration: Subcategorias de Verdade e Orçamento Padrão Recorrente Mensal
-- Data: 2026-09-18

-- 1. TABELA DE SUBCATEGORIAS (transaction_subcategories)
CREATE TABLE IF NOT EXISTS public.transaction_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint para não duplicar nome de subcategoria dentro da mesma categoria
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_subcat_category_name'
  ) THEN
    ALTER TABLE public.transaction_subcategories 
      ADD CONSTRAINT uq_subcat_category_name UNIQUE (category_id, name);
  END IF;
END $$;

-- 2. ADICIONAR SUBCATEGORY_ID NA TABELA DE TRANSAÇÕES
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.transaction_subcategories(id) ON DELETE SET NULL;

-- 3. TABELA DE ORÇAMENTOS PADRÃO RECORRENTES (default_budgets)
-- Define o teto mensal padrão por categoria e opcionalmente subcategoria.
-- Repete-se automaticamente para todos os meses futuros sem necessidade de recriar.
CREATE TABLE IF NOT EXISTS public.default_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
  subcategory_id UUID REFERENCES public.transaction_subcategories(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adicionar subcategory_id na tabela budgets (que funciona como tabela de orçamentos por mês / overrides pontuais)
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.transaction_subcategories(id) ON DELETE CASCADE;

-- Atualizar ou recriar constraint única de budgets para suportar subcategorias por mês
DO $$
BEGIN
  -- Se existir a constraint anterior (family_id, category_id, month), recriamos com subcategory_id seguro
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_family_category_month_key') THEN
    ALTER TABLE public.budgets DROP CONSTRAINT budgets_family_category_month_key;
  END IF;
END $$;

-- Criamos um índice único que trata subcategory_id NULL (categoria pai) e não-NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_unique_override 
  ON public.budgets (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid), month);

-- Índice único para default_budgets
CREATE UNIQUE INDEX IF NOT EXISTS idx_default_budgets_unique 
  ON public.default_budgets (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 4. ÍNDICES ADICIONAIS
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON public.transaction_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_family ON public.transaction_subcategories(family_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subcategory ON public.transactions(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_default_budgets_family ON public.default_budgets(family_id);
CREATE INDEX IF NOT EXISTS idx_budgets_subcategory ON public.budgets(subcategory_id);

-- 5. RLS NAS NOVAS TABELAS
ALTER TABLE public.transaction_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_transaction_subcategories" ON public.transaction_subcategories;
CREATE POLICY "auth_all_transaction_subcategories" ON public.transaction_subcategories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_default_budgets" ON public.default_budgets;
CREATE POLICY "auth_all_default_budgets" ON public.default_budgets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. SEED DE SUBCATEGORIAS PADRÃO PARA AS CATEGORIAS PRINCIPAIS
DO $$
DECLARE
  cat_rec RECORD;
BEGIN
  -- Para cada categoria existente, se corresponder a uma das categorias-chave, insere as subcategorias
  FOR cat_rec IN SELECT id, name, family_id FROM public.transaction_categories LOOP
    -- Moradia: Aluguel, Condomínio, Água, Luz, Internet, Reparos
    IF cat_rec.name = 'Moradia' THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES
        (cat_rec.id, cat_rec.family_id, 'Aluguel', 'Home', 1),
        (cat_rec.id, cat_rec.family_id, 'Condomínio', 'Building', 2),
        (cat_rec.id, cat_rec.family_id, 'Água', 'Droplet', 3),
        (cat_rec.id, cat_rec.family_id, 'Luz', 'Zap', 4),
        (cat_rec.id, cat_rec.family_id, 'Internet', 'Wifi', 5),
        (cat_rec.id, cat_rec.family_id, 'Reparos', 'Wrench', 6)
      ON CONFLICT (category_id, name) DO NOTHING;
    END IF;

    -- Contas e Utilidades: Água, Luz, Internet, Gás, Telefone
    IF cat_rec.name = 'Contas e Utilidades' THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES
        (cat_rec.id, cat_rec.family_id, 'Água', 'Droplet', 1),
        (cat_rec.id, cat_rec.family_id, 'Luz', 'Zap', 2),
        (cat_rec.id, cat_rec.family_id, 'Internet', 'Wifi', 3),
        (cat_rec.id, cat_rec.family_id, 'Gás', 'Flame', 4),
        (cat_rec.id, cat_rec.family_id, 'Telefone', 'Phone', 5)
      ON CONFLICT (category_id, name) DO NOTHING;
    END IF;

    -- Transporte: Combustível, App de transporte, Transporte público, Estacionamento
    IF cat_rec.name = 'Transporte' THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES
        (cat_rec.id, cat_rec.family_id, 'Combustível', 'Fuel', 1),
        (cat_rec.id, cat_rec.family_id, 'App de transporte', 'Car', 2),
        (cat_rec.id, cat_rec.family_id, 'Transporte público', 'Bus', 3),
        (cat_rec.id, cat_rec.family_id, 'Estacionamento', 'SquareParking', 4)
      ON CONFLICT (category_id, name) DO NOTHING;
    END IF;

    -- Mercado: Supermercado, Açougue, Hortifruti
    IF cat_rec.name = 'Mercado' THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES
        (cat_rec.id, cat_rec.family_id, 'Supermercado', 'ShoppingCart', 1),
        (cat_rec.id, cat_rec.family_id, 'Açougue', 'Beef', 2),
        (cat_rec.id, cat_rec.family_id, 'Hortifruti', 'Apple', 3)
      ON CONFLICT (category_id, name) DO NOTHING;
    END IF;

    -- Saúde: Farmácia, Consultas, Exames
    IF cat_rec.name = 'Saúde' THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES
        (cat_rec.id, cat_rec.family_id, 'Farmácia', 'Pill', 1),
        (cat_rec.id, cat_rec.family_id, 'Consultas', 'Stethoscope', 2),
        (cat_rec.id, cat_rec.family_id, 'Exames', 'Activity', 3)
      ON CONFLICT (category_id, name) DO NOTHING;
    END IF;

    -- Educação: Mensalidade, Cursos, Material escolar
    IF cat_rec.name = 'Educação' THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES
        (cat_rec.id, cat_rec.family_id, 'Mensalidade', 'GraduationCap', 1),
        (cat_rec.id, cat_rec.family_id, 'Cursos', 'BookOpen', 2),
        (cat_rec.id, cat_rec.family_id, 'Material escolar', 'PenTool', 3)
      ON CONFLICT (category_id, name) DO NOTHING;
    END IF;

    -- Lazer: Saídas, Streaming, Filmes
    IF cat_rec.name = 'Lazer' THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES
        (cat_rec.id, cat_rec.family_id, 'Saídas', 'Sparkles', 1),
        (cat_rec.id, cat_rec.family_id, 'Streaming', 'Tv', 2),
        (cat_rec.id, cat_rec.family_id, 'Filmes', 'Film', 3)
      ON CONFLICT (category_id, name) DO NOTHING;
    END IF;

    -- Pets: Ração, Veterinário
    IF cat_rec.name = 'Pets' THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES
        (cat_rec.id, cat_rec.family_id, 'Ração', 'Bone', 1),
        (cat_rec.id, cat_rec.family_id, 'Veterinário', 'HeartPulse', 2)
      ON CONFLICT (category_id, name) DO NOTHING;
    END IF;

    -- Alimentação (se existir em separado de Mercado): Almoço, Jantar, Lanches, Padaria
    IF cat_rec.name = 'Alimentação' THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES
        (cat_rec.id, cat_rec.family_id, 'Almoço e Jantar', 'Utensils', 1),
        (cat_rec.id, cat_rec.family_id, 'Padaria e Lanches', 'Coffee', 2)
      ON CONFLICT (category_id, name) DO NOTHING;
    END IF;

    -- Restaurantes e Delivery: Delivery/iFood, Restaurantes
    IF cat_rec.name = 'Restaurantes e Delivery' THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES
        (cat_rec.id, cat_rec.family_id, 'Delivery e Apps', 'ShoppingBag', 1),
        (cat_rec.id, cat_rec.family_id, 'Restaurantes', 'Utensils', 2)
      ON CONFLICT (category_id, name) DO NOTHING;
    END IF;

  END LOOP;

  -- Se existir orçamento na tabela budgets antigo de Moradia, migra para default_budgets para não perder
  INSERT INTO public.default_budgets (family_id, category_id, amount_cents)
  SELECT family_id, category_id, amount_cents
  FROM public.budgets
  ON CONFLICT DO NOTHING;

END $$;
