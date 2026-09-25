-- Migration: Garantir índice único para idempotência de categorias por família e colunas de suporte
ALTER TABLE public.families 
ADD COLUMN IF NOT EXISTS monthly_net_income_cents BIGINT DEFAULT 0;

-- Cria índice único parcial ou total para evitar categorias duplicadas com mesmo nome para uma mesma família
CREATE UNIQUE INDEX IF NOT EXISTS uq_transaction_categories_family_name
ON public.transaction_categories (family_id, name)
WHERE family_id IS NOT NULL;
