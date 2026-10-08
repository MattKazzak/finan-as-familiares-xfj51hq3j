-- Migration: add_ai_confidence_to_transactions
-- Auditoria de sugestão aplicada pela IA ou regras determinísticas de categorização.
-- NULL = lançamento manual ou sem categorização assistida
-- 1.00 = regra exata do banco ou dicionário determinístico
-- 0.01 a 0.99 = confidence atribuído pelo modelo de IA (ex: GPT-4o-mini / batch-categorize)

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2) NULL;

COMMENT ON COLUMN public.transactions.ai_confidence IS 'Nível de confiança da categorização assistida (NULL = lançamento manual sem categorização automática; 1.00 = regra determinística/dicionário; 0.01-0.99 = escore do modelo de IA)';
