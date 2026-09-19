-- Criar tabela categorization_rules para auto-categorização inteligente de importações (OFX, CSV, PDF)
-- Suporta user_id (para compatibilidade estrita com a spec) e family_id (para o modelo de finanças compartilhadas)

CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  category_id UUID REFERENCES public.transaction_categories(id) ON DELETE CASCADE NOT NULL,
  subcategory_id UUID REFERENCES public.transaction_subcategories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_cat_rules_family ON public.categorization_rules(family_id);
CREATE INDEX IF NOT EXISTS idx_cat_rules_user ON public.categorization_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_cat_rules_pattern ON public.categorization_rules(pattern);

-- Habilitar RLS
ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "auth_all_categorization_rules" ON public.categorization_rules;
CREATE POLICY "auth_all_categorization_rules" ON public.categorization_rules
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed de regras universais brasileiras:
-- IFOOD, UBER EATS -> Gastronomia & Lazer (Delivery)
-- UBER, 99APP -> Transporte (App de transporte)
-- POSTO, SHELL, IPIRANGA -> Transporte (Combustível)
-- NETFLIX -> Assinaturas & Serviços (Netflix)
-- SPOTIFY -> Assinaturas & Serviços (Spotify)
-- DROGASIL, DROGA RAIA, PACHECO -> Saúde (Farmácia)
-- PETZ, COBASI -> Pets (Higiene & Acessórios ou geral)

DO $$
DECLARE
  f_rec RECORD;
  u_id UUID;
  c_gastro UUID;
  s_delivery UUID;
  c_transp UUID;
  s_app UUID;
  s_combustivel UUID;
  c_assinat UUID;
  s_netflix UUID;
  s_spotify UUID;
  c_saude UUID;
  s_farmacia UUID;
  c_pets UUID;
BEGIN
  -- Percorrer todas as famílias existentes para popular as regras padrão
  FOR f_rec IN SELECT id, created_by FROM public.families LOOP
    u_id := f_rec.created_by;
    IF u_id IS NULL THEN
      SELECT id INTO u_id FROM auth.users LIMIT 1;
    END IF;

    -- Localizar categorias e subcategorias correspondentes da família
    SELECT id INTO c_gastro FROM public.transaction_categories WHERE family_id = f_rec.id AND name = 'Gastronomia & Lazer' LIMIT 1;
    IF c_gastro IS NOT NULL THEN
      SELECT id INTO s_delivery FROM public.transaction_subcategories WHERE category_id = c_gastro AND name = 'Delivery' LIMIT 1;
    END IF;

    SELECT id INTO c_transp FROM public.transaction_categories WHERE family_id = f_rec.id AND name = 'Transporte' LIMIT 1;
    IF c_transp IS NOT NULL THEN
      SELECT id INTO s_app FROM public.transaction_subcategories WHERE category_id = c_transp AND name = 'App de transporte' LIMIT 1;
      SELECT id INTO s_combustivel FROM public.transaction_subcategories WHERE category_id = c_transp AND name = 'Combustível' LIMIT 1;
    END IF;

    SELECT id INTO c_assinat FROM public.transaction_categories WHERE family_id = f_rec.id AND name = 'Assinaturas & Serviços' LIMIT 1;
    IF c_assinat IS NOT NULL THEN
      SELECT id INTO s_netflix FROM public.transaction_subcategories WHERE category_id = c_assinat AND name = 'Netflix' LIMIT 1;
      SELECT id INTO s_spotify FROM public.transaction_subcategories WHERE category_id = c_assinat AND name = 'Spotify' LIMIT 1;
    END IF;

    SELECT id INTO c_saude FROM public.transaction_categories WHERE family_id = f_rec.id AND name = 'Saúde' LIMIT 1;
    IF c_saude IS NOT NULL THEN
      SELECT id INTO s_farmacia FROM public.transaction_subcategories WHERE category_id = c_saude AND name = 'Farmácia' LIMIT 1;
    END IF;

    SELECT id INTO c_pets FROM public.transaction_categories WHERE family_id = f_rec.id AND name = 'Pets' LIMIT 1;

    -- Inserir regras se a categoria existir
    -- 1. IFOOD, UBER EATS -> Gastronomia & Lazer (Delivery)
    IF c_gastro IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'IFOOD') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'IFOOD', c_gastro, s_delivery);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'UBER EATS') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'UBER EATS', c_gastro, s_delivery);
      END IF;
    END IF;

    -- 2. UBER, 99APP -> Transporte (App de transporte)
    IF c_transp IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'UBER') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'UBER', c_transp, s_app);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = '99APP') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, '99APP', c_transp, s_app);
      END IF;

      -- POSTO, SHELL, IPIRANGA -> Transporte (Combustível)
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'POSTO') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'POSTO', c_transp, s_combustivel);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'SHELL') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'SHELL', c_transp, s_combustivel);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'IPIRANGA') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'IPIRANGA', c_transp, s_combustivel);
      END IF;
    END IF;

    -- 3. NETFLIX, SPOTIFY -> Assinaturas & Serviços
    IF c_assinat IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'NETFLIX') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'NETFLIX', c_assinat, s_netflix);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'SPOTIFY') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'SPOTIFY', c_assinat, s_spotify);
      END IF;
    END IF;

    -- 4. DROGASIL, DROGA RAIA, PACHECO -> Saúde (Farmácia)
    IF c_saude IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'DROGASIL') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'DROGASIL', c_saude, s_farmacia);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'DROGA RAIA') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'DROGA RAIA', c_saude, s_farmacia);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'PACHECO') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'PACHECO', c_saude, s_farmacia);
      END IF;
    END IF;

    -- 5. PETZ, COBASI -> Pets
    IF c_pets IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'PETZ') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'PETZ', c_pets, NULL);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = f_rec.id AND pattern = 'COBASI') THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'COBASI', c_pets, NULL);
      END IF;
    END IF;

  END LOOP;
END $$;
