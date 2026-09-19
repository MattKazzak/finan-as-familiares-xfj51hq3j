-- Migration: Add monthly net income to families and percentage budget fields to transaction_categories
-- Migration version: 20260919200000_budget_percentage_model.sql

-- 1. Coluna de Renda Líquida Mensal da Família (em centavos)
ALTER TABLE public.families 
ADD COLUMN IF NOT EXISTS monthly_net_income_cents BIGINT DEFAULT 0;

-- 2. Colunas para o modelo orçamentário baseado em percentuais nas categorias
ALTER TABLE public.transaction_categories
ADD COLUMN IF NOT EXISTS percent_default NUMERIC(5, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS percent_alert NUMERIC(5, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS budget_bucket TEXT DEFAULT NULL; -- 'essentials' | 'lifestyle' | 'future'

-- 3. Inserir ou garantir as categorias de Futuro e Metas caso não existam como despesa
-- 'Reserva & Investimentos' e 'Metas & Projetos'
DO $$
DECLARE
  fam_rec RECORD;
BEGIN
  FOR fam_rec IN SELECT id FROM public.families LOOP
    -- Garantir categoria 'Reserva & Investimentos' (despesa/aporte)
    IF NOT EXISTS (
      SELECT 1 FROM public.transaction_categories 
      WHERE family_id = fam_rec.id AND name = 'Reserva & Investimentos' AND type = 'expense'
    ) THEN
      INSERT INTO public.transaction_categories (
        id, family_id, name, type, icon, color, sort_order, budget_bucket, percent_default, percent_alert
      ) VALUES (
        gen_random_uuid(),
        fam_rec.id,
        'Reserva & Investimentos',
        'expense',
        'TrendingUp',
        '#059669',
        16,
        'future',
        15.0,
        10.0
      );
    END IF;

    -- Garantir categoria 'Metas & Projetos' (despesa/planejamento futuro)
    IF NOT EXISTS (
      SELECT 1 FROM public.transaction_categories 
      WHERE family_id = fam_rec.id AND name = 'Metas & Projetos' AND type = 'expense'
    ) THEN
      INSERT INTO public.transaction_categories (
        id, family_id, name, type, icon, color, sort_order, budget_bucket, percent_default, percent_alert
      ) VALUES (
        gen_random_uuid(),
        fam_rec.id,
        'Metas & Projetos',
        'expense',
        'Target',
        '#0D9488',
        17,
        'future',
        7.0,
        NULL
      );
    END IF;
  END LOOP;
END $$;
