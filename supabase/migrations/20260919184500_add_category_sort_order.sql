-- Migration para adicionar sort_order em transaction_categories e inicializar valores existentes
ALTER TABLE public.transaction_categories
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Criar índice para performance de listagem ordenada
CREATE INDEX IF NOT EXISTS idx_trans_cat_sort_order ON public.transaction_categories(family_id, sort_order);

-- Inicializar o sort_order baseado na ordem alfabética de nome atual para categorias existentes
DO $$
DECLARE
  rec RECORD;
  idx INTEGER := 0;
  curr_family_id UUID := NULL;
BEGIN
  FOR rec IN (
    SELECT id, family_id, name 
    FROM public.transaction_categories 
    ORDER BY family_id NULLS FIRST, name ASC
  ) LOOP
    IF curr_family_id IS DISTINCT FROM rec.family_id THEN
      curr_family_id := rec.family_id;
      idx := 0;
    END IF;
    idx := idx + 1;
    UPDATE public.transaction_categories 
    SET sort_order = idx 
    WHERE id = rec.id AND (sort_order IS NULL OR sort_order = 0);
  END LOOP;
END $$;
