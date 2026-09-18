-- Migration: Fundir "Contas e Utilidades" em "Moradia"
-- 1. Garante que todas as famílias que possuem "Moradia" tenham o conjunto completo de subcategorias:
--    Aluguel, Condomínio, Água, Luz, Internet, Gás, Telefone, Reparos.
-- 2. Reatribui qualquer eventual transação, orçamento (budgets e default_budgets) ou metas apontando para
--    "Contas e Utilidades" ou suas subcategorias para a respectiva "Moradia" e sua subcategoria correspondente.
-- 3. Remove a categoria "Contas e Utilidades" e suas subcategorias.

DO $$
DECLARE
  f_rec RECORD;
  moradia_id UUID;
  contas_id UUID;
  sub_agua_moradia UUID;
  sub_luz_moradia UUID;
  sub_internet_moradia UUID;
  sub_gas_moradia UUID;
  sub_tel_moradia UUID;
  sub_rec RECORD;
BEGIN
  -- Percorre todas as famílias cadastradas
  FOR f_rec IN SELECT id FROM public.families LOOP
    -- Busca categoria Moradia e Contas e Utilidades da família
    SELECT id INTO moradia_id FROM public.transaction_categories WHERE family_id = f_rec.id AND name = 'Moradia' LIMIT 1;
    SELECT id INTO contas_id FROM public.transaction_categories WHERE family_id = f_rec.id AND name = 'Contas e Utilidades' LIMIT 1;

    -- Se não existir Moradia mas existir Contas e Utilidades, renomeia Contas e Utilidades para Moradia
    IF moradia_id IS NULL AND contas_id IS NOT NULL THEN
      UPDATE public.transaction_categories
      SET name = 'Moradia', icon = 'Home', color = '#6366F1'
      WHERE id = contas_id;
      moradia_id := contas_id;
      contas_id := NULL;
    END IF;

    -- Se tiver Moradia, garante todas as subcategorias completas
    IF moradia_id IS NOT NULL THEN
      -- Inserir / garantir Aluguel (1)
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES (moradia_id, f_rec.id, 'Aluguel', 'Home', 1)
      ON CONFLICT (category_id, name) DO NOTHING;

      -- Inserir / garantir Condomínio (2)
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES (moradia_id, f_rec.id, 'Condomínio', 'Building', 2)
      ON CONFLICT (category_id, name) DO NOTHING;

      -- Inserir / garantir Água (3)
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES (moradia_id, f_rec.id, 'Água', 'Droplet', 3)
      ON CONFLICT (category_id, name) DO NOTHING;

      -- Inserir / garantir Luz (4)
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES (moradia_id, f_rec.id, 'Luz', 'Zap', 4)
      ON CONFLICT (category_id, name) DO NOTHING;

      -- Inserir / garantir Internet (5)
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES (moradia_id, f_rec.id, 'Internet', 'Wifi', 5)
      ON CONFLICT (category_id, name) DO NOTHING;

      -- Inserir / garantir Gás (6)
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES (moradia_id, f_rec.id, 'Gás', 'Flame', 6)
      ON CONFLICT (category_id, name) DO NOTHING;

      -- Inserir / garantir Telefone (7)
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES (moradia_id, f_rec.id, 'Telefone', 'Phone', 7)
      ON CONFLICT (category_id, name) DO NOTHING;

      -- Inserir / garantir Reparos (8)
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, sort_order)
      VALUES (moradia_id, f_rec.id, 'Reparos', 'Wrench', 8)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 8;

      -- Obter IDs das subcategorias de Moradia para mapeamento de segurança
      SELECT id INTO sub_agua_moradia FROM public.transaction_subcategories WHERE category_id = moradia_id AND name = 'Água' LIMIT 1;
      SELECT id INTO sub_luz_moradia FROM public.transaction_subcategories WHERE category_id = moradia_id AND name = 'Luz' LIMIT 1;
      SELECT id INTO sub_internet_moradia FROM public.transaction_subcategories WHERE category_id = moradia_id AND name = 'Internet' LIMIT 1;
      SELECT id INTO sub_gas_moradia FROM public.transaction_subcategories WHERE category_id = moradia_id AND name = 'Gás' LIMIT 1;
      SELECT id INTO sub_tel_moradia FROM public.transaction_subcategories WHERE category_id = moradia_id AND name = 'Telefone' LIMIT 1;

      -- Se a categoria Contas e Utilidades existir para a família, reatribui e remove
      IF contas_id IS NOT NULL THEN
        -- Reatribuir transações de subcategorias específicas de Contas e Utilidades
        FOR sub_rec IN SELECT id, name FROM public.transaction_subcategories WHERE category_id = contas_id LOOP
          IF sub_rec.name = 'Água' THEN
            UPDATE public.transactions SET category_id = moradia_id, subcategory_id = sub_agua_moradia WHERE subcategory_id = sub_rec.id;
            UPDATE public.budgets SET category_id = moradia_id, subcategory_id = sub_agua_moradia WHERE subcategory_id = sub_rec.id;
            UPDATE public.default_budgets SET category_id = moradia_id, subcategory_id = sub_agua_moradia WHERE subcategory_id = sub_rec.id;
          ELSIF sub_rec.name = 'Luz' THEN
            UPDATE public.transactions SET category_id = moradia_id, subcategory_id = sub_luz_moradia WHERE subcategory_id = sub_rec.id;
            UPDATE public.budgets SET category_id = moradia_id, subcategory_id = sub_luz_moradia WHERE subcategory_id = sub_rec.id;
            UPDATE public.default_budgets SET category_id = moradia_id, subcategory_id = sub_luz_moradia WHERE subcategory_id = sub_rec.id;
          ELSIF sub_rec.name = 'Internet' THEN
            UPDATE public.transactions SET category_id = moradia_id, subcategory_id = sub_internet_moradia WHERE subcategory_id = sub_rec.id;
            UPDATE public.budgets SET category_id = moradia_id, subcategory_id = sub_internet_moradia WHERE subcategory_id = sub_rec.id;
            UPDATE public.default_budgets SET category_id = moradia_id, subcategory_id = sub_internet_moradia WHERE subcategory_id = sub_rec.id;
          ELSIF sub_rec.name = 'Gás' THEN
            UPDATE public.transactions SET category_id = moradia_id, subcategory_id = sub_gas_moradia WHERE subcategory_id = sub_rec.id;
            UPDATE public.budgets SET category_id = moradia_id, subcategory_id = sub_gas_moradia WHERE subcategory_id = sub_rec.id;
            UPDATE public.default_budgets SET category_id = moradia_id, subcategory_id = sub_gas_moradia WHERE subcategory_id = sub_rec.id;
          ELSIF sub_rec.name = 'Telefone' THEN
            UPDATE public.transactions SET category_id = moradia_id, subcategory_id = sub_tel_moradia WHERE subcategory_id = sub_rec.id;
            UPDATE public.budgets SET category_id = moradia_id, subcategory_id = sub_tel_moradia WHERE subcategory_id = sub_rec.id;
            UPDATE public.default_budgets SET category_id = moradia_id, subcategory_id = sub_tel_moradia WHERE subcategory_id = sub_rec.id;
          ELSE
            UPDATE public.transactions SET category_id = moradia_id, subcategory_id = NULL WHERE subcategory_id = sub_rec.id;
            UPDATE public.budgets SET category_id = moradia_id, subcategory_id = NULL WHERE subcategory_id = sub_rec.id;
            UPDATE public.default_budgets SET category_id = moradia_id, subcategory_id = NULL WHERE subcategory_id = sub_rec.id;
          END IF;
        END LOOP;

        -- Qualquer transação restante na categoria pai Contas e Utilidades vai para Moradia
        UPDATE public.transactions SET category_id = moradia_id WHERE category_id = contas_id;
        UPDATE public.goals SET category_id = moradia_id WHERE category_id = contas_id;

        -- Budgets remanescentes sem subcategoria: se já existir budget em Moradia no mesmo mês, ignora para não violar constraint única
        DELETE FROM public.budgets b1
        WHERE b1.category_id = contas_id
          AND EXISTS (SELECT 1 FROM public.budgets b2 WHERE b2.family_id = b1.family_id AND b2.category_id = moradia_id AND b2.month = b1.month AND b2.subcategory_id IS NOT DISTINCT FROM b1.subcategory_id);

        UPDATE public.budgets SET category_id = moradia_id WHERE category_id = contas_id;

        DELETE FROM public.default_budgets d1
        WHERE d1.category_id = contas_id
          AND EXISTS (SELECT 1 FROM public.default_budgets d2 WHERE d2.family_id = d1.family_id AND d2.category_id = moradia_id AND d2.subcategory_id IS NOT DISTINCT FROM d1.subcategory_id);

        UPDATE public.default_budgets SET category_id = moradia_id WHERE category_id = contas_id;

        -- Exclui subcategorias de Contas e Utilidades
        DELETE FROM public.transaction_subcategories WHERE category_id = contas_id;

        -- Exclui a categoria Contas e Utilidades
        DELETE FROM public.transaction_categories WHERE id = contas_id;
      END IF;
    END IF;
  END LOOP;
END $$;
