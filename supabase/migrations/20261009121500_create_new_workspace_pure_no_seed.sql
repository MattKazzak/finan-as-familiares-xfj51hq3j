-- Migração: Remover semeadura legada/duplicada de create_new_family_workspace
-- A criação de famílias passa a registrar estritamente a família e o membro administrador inicial.
-- Nenhuma categoria, subcategoria ou regra é criada aqui.
-- A única fonte de semeadura do catálogo canônico (19 categorias / 116 subcategorias) é a RPC activate_family_onboarding_plan.

CREATE OR REPLACE FUNCTION public.create_new_family_workspace(
  p_family_name TEXT,
  p_member_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_family_id UUID;
  v_member_id UUID;
  v_f_name TEXT;
  v_m_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_f_name := TRIM(COALESCE(p_family_name, ''));
  IF v_f_name = '' THEN
    v_f_name := 'Minha Família';
  END IF;

  v_m_name := TRIM(COALESCE(p_member_name, ''));
  IF v_m_name = '' THEN
    v_m_name := 'Principal';
  END IF;

  -- 1. Cria a família com valores padrão neutros
  INSERT INTO public.families (name, created_by, monthly_net_income_cents)
  VALUES (v_f_name, v_user_id, 0)
  RETURNING id INTO v_family_id;

  -- 2. Cria o primeiro membro administrador padrão com user_id vinculado
  INSERT INTO public.family_members (family_id, name, is_admin, user_id)
  VALUES (v_family_id, v_m_name, true, v_user_id)
  RETURNING id INTO v_member_id;

  -- Observação de arquitetura (Curiangoo v0.0.262):
  -- Categorias, subcategorias e regras de auto-categorização NÃO são semeadas aqui.
  -- A semeadura do catálogo canônico 19/116 ocorre exclusivamente na conclusão do onboarding
  -- através da RPC activate_family_onboarding_plan(p_family_id, p_monthly_net_income_cents, p_model_preset_id).

  RETURN v_family_id;
END;
$$;
