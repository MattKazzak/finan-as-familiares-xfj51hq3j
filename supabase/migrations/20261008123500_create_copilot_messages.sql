-- Migration: 20261008123500_create_copilot_messages.sql
-- Description: Criação da tabela copilot_messages para histórico de conversas do Copilot com RLS multi-família

CREATE TABLE IF NOT EXISTS public.copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  card_type TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta otimizada por família e ordenação temporal decrescente
CREATE INDEX IF NOT EXISTS idx_copilot_messages_family_created
  ON public.copilot_messages (family_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_copilot_messages_user
  ON public.copilot_messages (user_id);

-- RLS
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: membros da família leem o histórico da própria família
DROP POLICY IF EXISTS "copilot_messages_select_policy" ON public.copilot_messages;
CREATE POLICY "copilot_messages_select_policy" ON public.copilot_messages
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- INSERT: usuário grava com a própria identidade e para uma família a qual pertence
DROP POLICY IF EXISTS "copilot_messages_insert_policy" ON public.copilot_messages;
CREATE POLICY "copilot_messages_insert_policy" ON public.copilot_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_belongs_to_family(family_id)
  );

-- UPDATE: apenas o próprio usuário pode atualizar suas mensagens se necessário
DROP POLICY IF EXISTS "copilot_messages_update_policy" ON public.copilot_messages;
CREATE POLICY "copilot_messages_update_policy" ON public.copilot_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.user_belongs_to_family(family_id))
  WITH CHECK (user_id = auth.uid() AND public.user_belongs_to_family(family_id));

-- DELETE: apenas o próprio usuário ou membro da família
DROP POLICY IF EXISTS "copilot_messages_delete_policy" ON public.copilot_messages;
CREATE POLICY "copilot_messages_delete_policy" ON public.copilot_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.user_belongs_to_family(family_id));
