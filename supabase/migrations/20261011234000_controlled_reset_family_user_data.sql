-- =============================================================================
-- Migration: 20261011234000_controlled_reset_family_user_data.sql
-- Rodada 53: Reset controlado de dados de famílias e usuários
--
-- GARANTIA PRÉVIA: O backup foi realizado na migração 20261011233000_backup_before_reset
-- e confirmado contendo cópia de todas as tabelas.
--
-- ORDEM ESTRITA DE FOREIGN KEYS (filhos antes de pais):
-- 1. copilot_messages
-- 2. categorization_rules
-- 3. recurring_income_overrides
-- 4. transactions
-- 5. recurring_incomes
-- 6. budgets
-- 7. default_budgets
-- 8. goals
-- 9. investments
-- 10. transaction_subcategories (subcategorias criadas por famílias)
-- 11. transaction_categories (categorias criadas por famílias)
-- 12. family_invites
-- 13. family_members
-- 14. families
-- 15. user_preferences
-- 16. auth.users
--
-- O QUE NUNCA É APAGADO:
-- - A estrutura de tabelas, índices, enums e políticas RLS.
-- - As funções do banco (activate_family_onboarding_plan, cleanup_abandoned_families, create_new_family_workspace, etc.).
-- - As tabelas de backup recém-criadas (backup_20261011_*).
-- =============================================================================

DO $$
BEGIN
  -- 1. copilot_messages
  DELETE FROM public.copilot_messages;

  -- 2. categorization_rules
  DELETE FROM public.categorization_rules;

  -- 3. recurring_income_overrides
  DELETE FROM public.recurring_income_overrides;

  -- 4. transactions
  DELETE FROM public.transactions;

  -- 5. recurring_incomes
  DELETE FROM public.recurring_incomes;

  -- 6. budgets
  DELETE FROM public.budgets;

  -- 7. default_budgets
  DELETE FROM public.default_budgets;

  -- 8. goals
  DELETE FROM public.goals;

  -- 9. investments
  DELETE FROM public.investments;

  -- 10. transaction_subcategories
  DELETE FROM public.transaction_subcategories;

  -- 11. transaction_categories
  DELETE FROM public.transaction_categories;

  -- 12. family_invites
  DELETE FROM public.family_invites;

  -- 13. family_members
  DELETE FROM public.family_members;

  -- 14. families
  DELETE FROM public.families;

  -- 15. user_preferences
  DELETE FROM public.user_preferences;

  -- 16. auth.users (Supabase GoTrue)
  DELETE FROM auth.users;
END $$;
