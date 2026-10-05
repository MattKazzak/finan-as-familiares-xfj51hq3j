-- Correção RLS de public.family_invites: as policies de INSERT, UPDATE e DELETE
-- ativas continham a tautologia "fm.family_id = fm.family_id", degradando a
-- checagem para "admin de QUALQUER família". Esta migração NOVA restaura o
-- vínculo real, sem editar a migração 20260929213000 (aplicada com texto correto).
-- Autorização: criador/owner da família do convite OU admin registrado
-- (is_admin = true) DA MESMA FAMÍLIA. Sem permissões para anon.
-- Policy de SELECT intocada (já correta).

-- ---------- INSERT ----------
DROP POLICY IF EXISTS family_invites_insert_policy ON public.family_invites;
CREATE POLICY family_invites_insert_policy ON public.family_invites
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    -- Criador/owner da família do convite
    EXISTS (SELECT 1 FROM public.families f
            WHERE f.id = family_invites.family_id
              AND f.created_by = auth.uid())
    OR
    -- Admin registrado DA MESMA FAMÍLIA do convite
    -- (vínculo real substitui a tautologia "fm.family_id = fm.family_id")
    EXISTS (SELECT 1 FROM public.family_members fm
            WHERE fm.family_id = family_invites.family_id
              AND fm.user_id = auth.uid()
              AND fm.is_admin = true)
  );

-- ---------- UPDATE ----------
-- USING limita a linha EXISTENTE; WITH CHECK limita a linha RESULTANTE.
-- NOTA: isto NÃO torna family_id imutável — um usuário autorizado em ambas
-- as famílias ainda poderia transferir (fora do escopo desta etapa).
DROP POLICY IF EXISTS family_invites_update_policy ON public.family_invites;
CREATE POLICY family_invites_update_policy ON public.family_invites
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.families f
            WHERE f.id = family_invites.family_id
              AND f.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.family_members fm
            WHERE fm.family_id = family_invites.family_id
              AND fm.user_id = auth.uid()
              AND fm.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.families f
            WHERE f.id = family_invites.family_id
              AND f.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.family_members fm
            WHERE fm.family_id = family_invites.family_id
              AND fm.user_id = auth.uid()
              AND fm.is_admin = true)
  );

-- ---------- DELETE ----------
DROP POLICY IF EXISTS family_invites_delete_policy ON public.family_invites;
CREATE POLICY family_invites_delete_policy ON public.family_invites
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.families f
            WHERE f.id = family_invites.family_id
              AND f.created_by = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.family_members fm
            WHERE fm.family_id = family_invites.family_id
              AND fm.user_id = auth.uid()
              AND fm.is_admin = true)
  );
