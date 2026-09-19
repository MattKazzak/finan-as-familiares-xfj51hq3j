-- Migration para suporte a Despesas Parceladas e Projeção Financeira Futura
-- Data: 2026-09-19
-- Adiciona colunas is_installment, installment_number, installment_total, installment_group_id e status na tabela transactions

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_installment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installment_total integer,
  ADD COLUMN IF NOT EXISTS installment_group_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';

-- Backfill seguro para garantir que transações existentes tenham status 'confirmed'
UPDATE public.transactions
SET status = 'confirmed'
WHERE status IS NULL;

-- Índices úteis para consultas de projeções futuras e grupos de parcelas
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_transactions_installment_group ON public.transactions USING btree (installment_group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_installment_lookup ON public.transactions USING btree (installment_group_id, installment_number);
