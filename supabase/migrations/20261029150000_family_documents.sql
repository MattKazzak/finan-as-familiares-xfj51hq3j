-- Migration: Pasta de Documentos Segura da Família (Multi-Tenant, Storage Privado e Links Temporários)
-- Versão: 20261029150000_family_documents.sql

-- 1. Criar bucket de storage PRIVADO 'family-documents' (caso a tabela storage.buckets exista)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'family-documents',
  'family-documents',
  false, -- NUNCA público: bucket privado isolado
  15728640, -- 15MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Tabela de documentos da família
CREATE TABLE IF NOT EXISTS public.family_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by_name TEXT NOT NULL DEFAULT 'Membro',
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outros', -- identidade, familia, residencia, saude, outros
  storage_path TEXT NOT NULL, -- {family_id}/{doc_id}.ext
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  expires_at DATE, -- Data opcional de validade do documento
  is_shared_with_family BOOLEAN NOT NULL DEFAULT true, -- true: visível para todos da família; false: privado de quem enviou
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_family_docs_family ON public.family_documents (family_id);
CREATE INDEX IF NOT EXISTS idx_family_docs_user ON public.family_documents (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_family_docs_category ON public.family_documents (category);
CREATE INDEX IF NOT EXISTS idx_family_docs_expires ON public.family_documents (expires_at);

-- Habilitar RLS
ALTER TABLE public.family_documents ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para family_documents
-- SELECT: Membro da família pode ver se is_shared_with_family = true OU se foi ele quem enviou (uploaded_by = auth.uid())
DROP POLICY IF EXISTS "family_documents_select_policy" ON public.family_documents;
CREATE POLICY "family_documents_select_policy" ON public.family_documents
  FOR SELECT TO authenticated
  USING (
    public.user_belongs_to_family(family_id)
    AND (is_shared_with_family = true OR uploaded_by = auth.uid())
  );

-- INSERT: Membro da família pode inserir para sua própria família, gravando uploaded_by = auth.uid()
DROP POLICY IF EXISTS "family_documents_insert_policy" ON public.family_documents;
CREATE POLICY "family_documents_insert_policy" ON public.family_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_belongs_to_family(family_id)
    AND uploaded_by = auth.uid()
  );

-- UPDATE: Dono do upload (ou quem enviou) ou admin da família pode atualizar metadados
DROP POLICY IF EXISTS "family_documents_update_policy" ON public.family_documents;
CREATE POLICY "family_documents_update_policy" ON public.family_documents
  FOR UPDATE TO authenticated
  USING (
    public.user_belongs_to_family(family_id)
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.families f
        WHERE f.id = family_documents.family_id AND f.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.family_id = family_documents.family_id AND fm.user_id = auth.uid() AND fm.is_admin = true
      )
    )
  )
  WITH CHECK (
    public.user_belongs_to_family(family_id)
  );

-- DELETE: Dono do upload ou admin da família pode excluir
DROP POLICY IF EXISTS "family_documents_delete_policy" ON public.family_documents;
CREATE POLICY "family_documents_delete_policy" ON public.family_documents
  FOR DELETE TO authenticated
  USING (
    public.user_belongs_to_family(family_id)
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.families f
        WHERE f.id = family_documents.family_id AND f.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.family_id = family_documents.family_id AND fm.user_id = auth.uid() AND fm.is_admin = true
      )
    )
  );

-- 3. Tabela de links temporários de compartilhamento seguro (fora da família ou para terceiros: banco, escola, etc.)
CREATE TABLE IF NOT EXISTS public.family_document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.family_documents(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  view_count INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_shares_token ON public.family_document_shares (token);
CREATE INDEX IF NOT EXISTS idx_doc_shares_doc ON public.family_document_shares (document_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_family ON public.family_document_shares (family_id);

ALTER TABLE public.family_document_shares ENABLE ROW LEVEL SECURITY;

-- RLS para family_document_shares:
-- Apenas membros da família geradores/pertencentes podem consultar, criar e revogar seus shares
DROP POLICY IF EXISTS "doc_shares_select_policy" ON public.family_document_shares;
CREATE POLICY "doc_shares_select_policy" ON public.family_document_shares
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_family(family_id));

DROP POLICY IF EXISTS "doc_shares_insert_policy" ON public.family_document_shares;
CREATE POLICY "doc_shares_insert_policy" ON public.family_document_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_belongs_to_family(family_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "doc_shares_update_policy" ON public.family_document_shares;
CREATE POLICY "doc_shares_update_policy" ON public.family_document_shares
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_family(family_id))
  WITH CHECK (public.user_belongs_to_family(family_id));

DROP POLICY IF EXISTS "doc_shares_delete_policy" ON public.family_document_shares;
CREATE POLICY "doc_shares_delete_policy" ON public.family_document_shares
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_family(family_id));

-- 4. Storage Policies para o bucket privado 'family-documents'
-- Caminho padronizado: '{family_id}/{document_id}.ext'
-- Primeiro segmento de storage.objects.name é o family_id
DROP POLICY IF EXISTS "Family Documents Storage Select" ON storage.objects;
CREATE POLICY "Family Documents Storage Select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'family-documents'
    AND public.user_belongs_to_family((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Family Documents Storage Insert" ON storage.objects;
CREATE POLICY "Family Documents Storage Insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'family-documents'
    AND public.user_belongs_to_family((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Family Documents Storage Update" ON storage.objects;
CREATE POLICY "Family Documents Storage Update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'family-documents'
    AND public.user_belongs_to_family((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Family Documents Storage Delete" ON storage.objects;
CREATE POLICY "Family Documents Storage Delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'family-documents'
    AND public.user_belongs_to_family((storage.foldername(name))[1]::uuid)
  );

-- 5. RPC Pública/Segura para abrir link temporário compartilhado em navegador limpo (sem login)
-- Retorna os dados do documento apenas se o token for válido e não expirado/revogado
CREATE OR REPLACE FUNCTION public.get_shared_document_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_share RECORD;
  v_doc RECORD;
  v_clean_token TEXT;
BEGIN
  v_clean_token := TRIM(COALESCE(p_token, ''));
  IF v_clean_token = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Token de compartilhamento não informado.');
  END IF;

  SELECT * INTO v_share
  FROM public.family_document_shares
  WHERE token = v_clean_token;

  IF v_share.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Link de compartilhamento não encontrado.');
  END IF;

  IF v_share.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este link foi revogado pelo proprietário.');
  END IF;

  IF v_share.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este link temporário expirou.');
  END IF;

  SELECT * INTO v_doc
  FROM public.family_documents
  WHERE id = v_share.document_id;

  IF v_doc.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'O documento original foi removido.');
  END IF;

  -- Registra a visualização
  UPDATE public.family_document_shares
  SET
    view_count = view_count + 1,
    last_viewed_at = NOW()
  WHERE id = v_share.id;

  RETURN jsonb_build_object(
    'valid', true,
    'share_id', v_share.id,
    'expires_at', v_share.expires_at,
    'document_id', v_doc.id,
    'title', v_doc.title,
    'category', v_doc.category,
    'file_name', v_doc.file_name,
    'mime_type', v_doc.mime_type,
    'file_size_bytes', v_doc.file_size_bytes,
    'storage_path', v_doc.storage_path,
    'doc_expires_at', v_doc.expires_at
  );
END;
$$;
