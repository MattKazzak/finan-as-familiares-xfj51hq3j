-- =============================================================================
-- Migration: 20261011233000_backup_before_reset.sql
-- Rodada 53: Backup integral antes do reset de dados de família/usuário
-- Cria tabelas com prefixo backup_20261011_ preservando todas as colunas e dados.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.backup_20261011_families AS
SELECT * FROM public.families;

CREATE TABLE IF NOT EXISTS public.backup_20261011_family_members AS
SELECT * FROM public.family_members;

CREATE TABLE IF NOT EXISTS public.backup_20261011_family_invites AS
SELECT * FROM public.family_invites;

CREATE TABLE IF NOT EXISTS public.backup_20261011_transactions AS
SELECT * FROM public.transactions;

CREATE TABLE IF NOT EXISTS public.backup_20261011_budgets AS
SELECT * FROM public.budgets;

CREATE TABLE IF NOT EXISTS public.backup_20261011_default_budgets AS
SELECT * FROM public.default_budgets;

CREATE TABLE IF NOT EXISTS public.backup_20261011_recurring_incomes AS
SELECT * FROM public.recurring_incomes;

CREATE TABLE IF NOT EXISTS public.backup_20261011_recurring_income_overrides AS
SELECT * FROM public.recurring_income_overrides;

CREATE TABLE IF NOT EXISTS public.backup_20261011_goals AS
SELECT * FROM public.goals;

CREATE TABLE IF NOT EXISTS public.backup_20261011_investments AS
SELECT * FROM public.investments;

CREATE TABLE IF NOT EXISTS public.backup_20261011_copilot_messages AS
SELECT * FROM public.copilot_messages;

CREATE TABLE IF NOT EXISTS public.backup_20261011_user_preferences AS
SELECT * FROM public.user_preferences;

CREATE TABLE IF NOT EXISTS public.backup_20261011_categorization_rules AS
SELECT * FROM public.categorization_rules;

CREATE TABLE IF NOT EXISTS public.backup_20261011_transaction_categories AS
SELECT * FROM public.transaction_categories;

CREATE TABLE IF NOT EXISTS public.backup_20261011_transaction_subcategories AS
SELECT * FROM public.transaction_subcategories;

CREATE TABLE IF NOT EXISTS public.backup_20261011_users AS
SELECT
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  confirmed_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at,
  is_anonymous
FROM auth.users;
