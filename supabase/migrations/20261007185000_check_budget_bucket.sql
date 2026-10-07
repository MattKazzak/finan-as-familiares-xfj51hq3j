-- Migration: add check constraint to transaction_categories.budget_bucket
-- Ensures budget_bucket is either NULL (for income categories) or one of 'essentials', 'lifestyle', 'future'

ALTER TABLE public.transaction_categories
  DROP CONSTRAINT IF EXISTS chk_budget_bucket;

ALTER TABLE public.transaction_categories
  ADD CONSTRAINT chk_budget_bucket
  CHECK (budget_bucket IS NULL OR budget_bucket IN ('essentials', 'lifestyle', 'future'));
