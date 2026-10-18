-- Push quando chega transação pendente de categoria (padrão Monarch, P1)
-- O trigger enqueue_family_push já enfileira push p/ os OUTROS membros em TODO INSERT.
-- Esta migração atualiza a função pra marcar no texto quando a transação está SEM
-- categoria — a edge push-dispatcher monta título/body de "revisar" com esse marcador.
CREATE OR REPLACE FUNCTION public.enqueue_family_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user uuid; v_name text;
BEGIN
  SELECT fm.user_id, fm.name INTO v_user, v_name
  FROM public.family_members fm WHERE fm.id = NEW.member_id LIMIT 1;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  -- Pendente de categoria: marca no texto pra edge push-dispatcher montar
  -- título/body de "revisar" (Karine vê que Matheus lançou algo sem categoria).
  INSERT INTO public.push_queue (family_id, author_user_id, author_member_name, transaction_id, description, amount_cents, tx_type)
  VALUES (
    NEW.family_id, v_user, v_name, NEW.id,
    CASE WHEN NEW.category_id IS NULL THEN '[sem categoria] ' ELSE '' END || COALESCE(NEW.description, ''),
    NEW.amount_cents, NEW.type::text
  );
  RETURN NEW;
END $function$;