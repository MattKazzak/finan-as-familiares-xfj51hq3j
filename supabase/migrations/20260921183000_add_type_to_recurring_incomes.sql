-- Migração: Adicionar suporte a Despesas Fixas na tabela de recorrências
-- Data: 2026-09-21
-- Adiciona a coluna type (income | expense) em recurring_incomes com default 'income'

ALTER TABLE public.recurring_incomes
  ADD COLUMN IF NOT EXISTS type public.transaction_type NOT NULL DEFAULT 'income'::public.transaction_type;

-- Atualizar registros existentes (se houver) para garantir 'income'
UPDATE public.recurring_incomes
SET type = 'income'
WHERE type IS NULL;

-- Índice para buscas filtradas por família e tipo de recorrência
CREATE INDEX IF NOT EXISTS idx_recurring_incomes_family_type
  ON public.recurring_incomes (family_id, type);
