-- Migration: Correção de Autorização RLS para family_members e family_invites
-- Versão: 20261005234500_harden_family_members_and_invites_rls.sql
--
-- Objetivos de Segurança:
-- 1. family_members:
--    - Fechar escrita direta do cliente (DROP policies INSERT, UPDATE, DELETE).
--    - SELECT mantido para membros da família poderem visualizar a lista.
--    - Criar RPCs SECURITY DEFINER para mutações controladas:
--      * add_family_member_without_account: valida admin/criador, força is_admin = false e user_id = NULL.
--      * rename_family_member: valida admin/criador da mesma família, atualiza somente o nome.
--    - Reutilização da RPC remove_family_member existente para deleção.
--    - Criar UNIQUE INDEX parcial em (family_id, user_id) WHERE user_id IS NOT NULL.
--      (Nota: caso haja duplicatas em bases existentes, a criação do índice falhará com segurança).
--    - Permissões explícitas: REVOKE de PUBLIC/anon e GRANT EXECUTE para authenticated.
--
-- 2. family_invites:
--    - Substituir a policy SELECT por critério criador-OU-admin da própria família.
--    - Membros comuns deixam de ler linhas e códigos portadores de convite.
--    - Alinhamento total com as policies de escrita corrigidas em 20261005232000.

-- ============================================================================
-- PARTE A: family_members
-- ============================================================================

-- 1. Fechar escrita direta do cliente em public.family_members
DROP POLICY IF EXISTS "family_members_insert_policy" ON public.family_members;
DROP POLICY IF EXISTS "family_members_update_policy" ON public.family_members;
DROP POLICY IF EXISTS "family_members_delete_policy" ON public.family_members;

-- 2. Garantir que a policy de SELECT exista de forma idempotente (mantendo a regra existente)
DROP POLICY IF EXISTS "family_members_select_policy" ON public.family_members;
CREATE POLICY "family_members_select_policy" ON public.family_members
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- 3. Índice Único Parcial para impedir duplicidade de contas na mesma família
-- Nota: se existirem duplicatas prévias na base, a execução falhará de forma segura (falha segura).
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_members_family_user_unique
  ON public.family_members (family_id, user_id)
  WHERE user_id IS NOT NULL;

-- 4. RPC: add_family_member_without_account
-- Valida que o chamador é criador ou admin registrado da família;
-- Força is_admin = false e user_id = NULL (membro sem conta de login);
-- Valida nome não-vazio e limite de 5 membros;
-- Retorna o membro criado (id, name, is_admin).
CREATE OR REPLACE FUNCTION public.add_family_member_without_account(
  p_family_id UUID,
  p_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_is_authorized BOOLEAN := false;
  v_clean_name TEXT;
  v_member_count INT;
  v_new_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_clean_name := TRIM(COALESCE(p_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'O nome do membro é obrigatório.';
  END IF;

  -- Valida se o chamador é criador da família OU admin registrado da MESMA família
  SELECT (
    f.created_by = v_user_id OR EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = p_family_id
        AND fm.user_id = v_user_id
        AND fm.is_admin = true
    )
  ) INTO v_is_authorized
  FROM public.families f
  WHERE f.id = p_family_id;

  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Apenas o administrador da família pode adicionar membros.';
  END IF;

  -- Valida limite máximo de 5 membros
  SELECT COUNT(*) INTO v_member_count
  FROM public.family_members
  WHERE family_id = p_family_id;

  IF v_member_count >= 5 THEN
    RAISE EXCEPTION 'Esta família já atingiu o limite máximo de 5 membros.';
  END IF;

  -- Insere o membro sem conta: user_id IS NULL e is_admin fixo em false
  INSERT INTO public.family_members (
    family_id,
    name,
    is_admin,
    user_id
  ) VALUES (
    p_family_id,
    v_clean_name,
    false,
    NULL
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'id', v_new_id,
    'family_id', p_family_id,
    'name', v_clean_name,
    'is_admin', false,
    'user_id', NULL
  );
END;
$$;

-- 5. RPC: rename_family_member
-- Valida que o chamador é criador ou admin registrado da mesma família do membro alvo;
-- Atualiza unicamente a coluna name.
CREATE OR REPLACE FUNCTION public.rename_family_member(
  p_member_id UUID,
  p_new_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_member RECORD;
  v_is_authorized BOOLEAN := false;
  v_clean_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_clean_name := TRIM(COALESCE(p_new_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'O novo nome do membro é obrigatório.';
  END IF;

  -- Busca o membro alvo
  SELECT fm.* INTO v_member
  FROM public.family_members fm
  WHERE fm.id = p_member_id;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado.';
  END IF;

  -- Valida se o chamador é criador ou admin registrado DA MESMA FAMÍLIA do membro alvo
  SELECT (
    f.created_by = v_user_id OR EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = v_member.family_id
        AND fm.user_id = v_user_id
        AND fm.is_admin = true
    )
  ) INTO v_is_authorized
  FROM public.families f
  WHERE f.id = v_member.family_id;

  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Apenas o administrador da família pode renomear membros.';
  END IF;

  UPDATE public.family_members
  SET name = v_clean_name
  WHERE id = p_member_id;

  RETURN jsonb_build_object(
    'id', p_member_id,
    'family_id', v_member.family_id,
    'name', v_clean_name,
    'is_admin', v_member.is_admin,
    'user_id', v_member.user_id
  );
END;
$$;

-- 6. Garantir permissões de execução para as novas RPCs
REVOKE EXECUTE ON FUNCTION public.add_family_member_without_account(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_family_member_without_account(UUID, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.rename_family_member(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_family_member(UUID, TEXT) TO authenticated;

-- ============================================================================
-- PARTE B: family_invites
-- ============================================================================

-- 1. Substituir a policy SELECT de family_invites para criador-OU-admin da própria família
DROP POLICY IF EXISTS "family_invites_select_policy" ON public.family_invites;
CREATE POLICY "family_invites_select_policy" ON public.family_invites
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    -- Criador/owner da família do convite
    EXISTS (
      SELECT 1 FROM public.families f
      WHERE f.id = family_invites.family_id
        AND f.created_by = auth.uid()
    )
    OR
    -- Admin registrado DA MESMA FAMÍLIA do convite (vínculo real qualificado)
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = family_invites.family_id
        AND fm.user_id = auth.uid()
        AND fm.is_admin = true
    )
  );
