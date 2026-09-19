-- Migration: 20260919204000_assign_budget_buckets.sql
-- Vincula categorias existentes sem balde aos 3 baldes metodológicos:
-- Pets -> 'lifestyle' (Estilo de Vida)
-- Serviços Financeiros -> 'essentials' (Essenciais)
-- Outras despesas existentes ou futuras com fallback adequado

-- 1. Atualizar explicitamente Pets para 'lifestyle'
UPDATE public.transaction_categories
SET budget_bucket = 'lifestyle'
WHERE name ILIKE '%pet%' AND type = 'expense';

-- 2. Atualizar explicitamente Serviços Financeiros para 'essentials'
UPDATE public.transaction_categories
SET budget_bucket = 'essentials'
WHERE (name ILIKE '%serviço%financeiro%' OR name ILIKE '%servico%financeiro%') AND type = 'expense';

-- 3. Caso exista qualquer outra categoria de despesa com budget_bucket NULL:
-- Atribuir a 'essentials' ou 'lifestyle' dependendo da natureza
UPDATE public.transaction_categories
SET budget_bucket = CASE
  WHEN name ILIKE '%moradia%' OR name ILIKE '%habita%' OR name ILIKE '%alimenta%' OR name ILIKE '%mercado%'
       OR name ILIKE '%transporte%' OR name ILIKE '%saúde%' OR name ILIKE '%saude%' OR name ILIKE '%educa%' THEN 'essentials'
  WHEN name ILIKE '%reserva%' OR name ILIKE '%invest%' OR name ILIKE '%meta%' OR name ILIKE '%projeto%' OR name ILIKE '%sonho%' THEN 'future'
  ELSE 'lifestyle'
END
WHERE budget_bucket IS NULL AND type = 'expense';
