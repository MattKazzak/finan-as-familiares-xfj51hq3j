-- Migration: 20261008123600_create_user_preferences.sql
-- Description: Criação da tabela user_preferences para consentimento LGPD de IA e preferências do usuário com RLS estrito

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_consent BOOLEAN NOT NULL DEFAULT false,
  ai_consent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- SELECT: o usuário autenticado lê apenas suas próprias preferências
DROP POLICY IF EXISTS "user_preferences_select_policy" ON public.user_preferences;
CREATE POLICY "user_preferences_select_policy" ON public.user_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT: o usuário autenticado insere apenas suas próprias preferências
DROP POLICY IF EXISTS "user_preferences_insert_policy" ON public.user_preferences;
CREATE POLICY "user_preferences_insert_policy" ON public.user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: o usuário autenticado atualiza apenas suas próprias preferências
DROP POLICY IF EXISTS "user_preferences_update_policy" ON public.user_preferences;
CREATE POLICY "user_preferences_update_policy" ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: o usuário autenticado pode deletar apenas seu próprio registro
DROP POLICY IF EXISTS "user_preferences_delete_policy" ON public.user_preferences;
CREATE POLICY "user_preferences_delete_policy" ON public.user_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
