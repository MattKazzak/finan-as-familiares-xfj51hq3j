-- FIX NOME NÃO PROPAGA (12/11): a edição de nome em "Minha conta" (/perfil) só
-- gravava em auth.user_metadata.name — as demais telas (saudação da Home, chips
-- de membros, Layout, Copilot) leem family_members.name. Esta RPC self-service
-- atualiza a linha do PRÓPRIO usuário (family_members.user_id = auth.uid()),
-- em todas as famílias em que ele é membro, sem depender de ser admin.
-- O isolation multi-família é garantido pelo filtro user_id = auth.uid() (a
-- RPC é SECURITY DEFINER mas só toca nas linhas do próprio chamador).

CREATE OR REPLACE FUNCTION public.update_my_member_name(p_new_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_user_id UUID;
  v_clean_name TEXT;
  v_updated INT := 0;
  v_first_family_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_clean_name := TRIM(COALESCE(p_new_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'O novo nome é obrigatório.';
  END IF;
  IF CHAR_LENGTH(v_clean_name) > 60 THEN
    RAISE EXCEPTION 'O nome deve ter no máximo 60 caracteres.';
  END IF;

  -- Atualiza o membro logado em TODAS as famílias de que ele participa
  -- (o mesmo usuário pode ter workspace legado + convites aceitos).
  WITH updated AS (
    UPDATE public.family_members
    SET name = v_clean_name
    WHERE user_id = v_user_id
    RETURNING family_id
  )
  SELECT
    COUNT(*)::INT,
    MIN(family_id)::UUID
  INTO v_updated, v_first_family_id
  FROM updated;

  RETURN jsonb_build_object(
    'success', v_updated > 0,
    'members_updated', v_updated,
    'family_id', v_first_family_id,
    'name', v_clean_name
  );
END;
$function$;

-- Nenhum anon: só usuários autenticados renomeiam a si mesmos.
REVOKE EXECUTE ON FUNCTION public.update_my_member_name(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_member_name(text) TO authenticated;
