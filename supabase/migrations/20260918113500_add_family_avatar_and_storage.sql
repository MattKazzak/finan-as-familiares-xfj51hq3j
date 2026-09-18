-- Adiciona avatar_url à tabela public.families
-- e configura bucket público 'family-avatars' com políticas RLS se aplicável

ALTER TABLE public.families
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Criação do bucket de storage público para avatares se a tabela storage.buckets existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'family-avatars',
  'family-avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para o bucket family-avatars
DROP POLICY IF EXISTS "Public Family Avatar Access" ON storage.objects;
CREATE POLICY "Public Family Avatar Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'family-avatars');

DROP POLICY IF EXISTS "Auth Family Avatar Insert" ON storage.objects;
CREATE POLICY "Auth Family Avatar Insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'family-avatars');

DROP POLICY IF EXISTS "Auth Family Avatar Update" ON storage.objects;
CREATE POLICY "Auth Family Avatar Update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'family-avatars');

DROP POLICY IF EXISTS "Auth Family Avatar Delete" ON storage.objects;
CREATE POLICY "Auth Family Avatar Delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'family-avatars');
