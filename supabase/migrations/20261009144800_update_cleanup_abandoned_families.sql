-- Migração: update_cleanup_abandoned_families (Regularização da função cleanup_abandoned_families)
-- Validação do caller: auth.uid() ou request.jwt.claim.sub, permitindo postgres e service_role
-- Idempotente: CREATE OR REPLACE FUNCTION

CREATE OR REPLACE FUNCTION public.cleanup_abandoned_families(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller UUID;
  v_caller_role TEXT;
  v_most_recent_incomplete_id UUID;
  v_fam RECORD;
  v_deleted_count INT := 0;
  v_deleted_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- 0. Identificar o caller e role atual
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    BEGIN
      v_caller := NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_caller := NULL;
    END;
  END IF;

  v_caller_role := CURRENT_USER;

  -- Permite se for o próprio usuário OU postgres OU service_role
  IF v_caller_role NOT IN ('postgres', 'service_role') THEN
    IF v_caller IS NULL OR v_caller <> p_user_id THEN
      RAISE EXCEPTION 'Acesso negado: operação permitida apenas para o próprio usuário autenticado.';
    END IF;
  END IF;

  -- 1. Identificar a família incompleta mais recente do usuário (para preservá-la para retomada)
  -- Critério incompleta: 0 categorias OU (categorias != 19 OU subcategorias != 116) OU regras = 0
  SELECT f.id INTO v_most_recent_incomplete_id
  FROM public.families f
  WHERE f.created_by = p_user_id
    AND (
      (SELECT COUNT(*) FROM public.transaction_categories c WHERE c.family_id = f.id) = 0
      OR (SELECT COUNT(*) FROM public.transaction_categories c WHERE c.family_id = f.id) <> 19
      OR (SELECT COUNT(*) FROM public.transaction_subcategories s WHERE s.family_id = f.id) <> 116
      OR (SELECT COUNT(*) FROM public.categorization_rules r WHERE r.family_id = f.id) = 0
    )
  ORDER BY f.created_at DESC
  LIMIT 1;

  -- 2. Loop sobre as famílias abandonadas elegíveis para exclusão:
  -- - Pertencem ao usuário (created_by = p_user_id)
  -- - Criadas há mais de 14 dias (created_at < NOW() - INTERVAL '14 days')
  -- - Incompletas (0 cats OU != 19 cats OU != 116 subs OU 0 regras)
  -- - EXCLUI a família incompleta mais recente (v_most_recent_incomplete_id)
  FOR v_fam IN
    SELECT f.id, f.name, f.created_at
    FROM public.families f
    WHERE f.created_by = p_user_id
      AND f.created_at < (NOW() - INTERVAL '14 days')
      AND (v_most_recent_incomplete_id IS NULL OR f.id <> v_most_recent_incomplete_id)
      AND (
        (SELECT COUNT(*) FROM public.transaction_categories c WHERE c.family_id = f.id) = 0
        OR (SELECT COUNT(*) FROM public.transaction_categories c WHERE c.family_id = f.id) <> 19
        OR (SELECT COUNT(*) FROM public.transaction_subcategories s WHERE s.family_id = f.id) <> 116
        OR (SELECT COUNT(*) FROM public.categorization_rules r WHERE r.family_id = f.id) = 0
      )
  LOOP
    -- Ordem segura de deleção de dependências (FKs):
    -- orçamentos e substituições
    DELETE FROM public.recurring_income_overrides WHERE family_id = v_fam.id;
    DELETE FROM public.budgets WHERE family_id = v_fam.id;
    DELETE FROM public.default_budgets WHERE family_id = v_fam.id;
    DELETE FROM public.transactions WHERE family_id = v_fam.id;
    DELETE FROM public.recurring_incomes WHERE family_id = v_fam.id;
    DELETE FROM public.goals WHERE family_id = v_fam.id;
    DELETE FROM public.investments WHERE family_id = v_fam.id;
    DELETE FROM public.copilot_messages WHERE family_id = v_fam.id;

    -- regras de categorização
    DELETE FROM public.categorization_rules WHERE family_id = v_fam.id;

    -- subcategorias e categorias
    DELETE FROM public.transaction_subcategories WHERE family_id = v_fam.id;
    DELETE FROM public.transaction_categories WHERE family_id = v_fam.id;

    -- convites e membros
    DELETE FROM public.family_invites WHERE family_id = v_fam.id;
    DELETE FROM public.family_members WHERE family_id = v_fam.id;

    -- finalmente a própria família
    DELETE FROM public.families WHERE id = v_fam.id;

    v_deleted_count := v_deleted_count + 1;
    v_deleted_ids := array_append(v_deleted_ids, v_fam.id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'deleted_family_ids', to_jsonb(v_deleted_ids),
    'preserved_incomplete_id', v_most_recent_incomplete_id
  );
END;
$$;
