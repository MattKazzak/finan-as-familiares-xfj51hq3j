-- Deduplicação de categorias padrão por família
DO $$
DECLARE
  f RECORD;
BEGIN
  -- Reatribui transações e orçamentos vinculados a categorias duplicadas para a categoria mais antiga
  FOR f IN (
    SELECT family_id, name, type, array_agg(id ORDER BY created_at ASC) as ids
    FROM public.transaction_categories
    GROUP BY family_id, name, type
    HAVING count(*) > 1
  ) LOOP
    -- f.ids[1] é a primeira (permanece), os demais serão mesclados e removidos
    UPDATE public.transactions
    SET category_id = f.ids[1]
    WHERE category_id = ANY(f.ids[2:]);

    UPDATE public.goals
    SET category_id = f.ids[1]
    WHERE category_id = ANY(f.ids[2:]);

    DELETE FROM public.budgets
    WHERE category_id = ANY(f.ids[2:]);

    DELETE FROM public.transaction_categories
    WHERE id = ANY(f.ids[2:]);
  END LOOP;
END $$;
