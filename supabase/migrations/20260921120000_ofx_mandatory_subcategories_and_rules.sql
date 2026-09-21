-- Migration para auto-preenchimento completo no parser do OFX / extratos
-- 1. Garante que as subcategorias padrão essenciais existam em cada categoria:
--    - Alimentação > Supermercado
--    - Transporte > Combustível
--    - Transporte > App de transporte
--    - Saúde > Farmácia
--    - Gastronomia & Lazer > Delivery, Restaurante
--    - Pets > Ração, Veterinário & Medicamentos
-- 2. Popula categorization_rules vinculando OBRIGATORIAMENTE category_id E subcategory_id para todos os padrões solicitados.

DO $$
DECLARE
  f_rec RECORD;
  u_id UUID;
  r_pat RECORD;

  -- Categorias
  c_alim UUID;
  c_transp UUID;
  c_saude UUID;
  c_gastro UUID;
  c_pets UUID;
  c_assinat UUID;
  c_compras UUID;

  -- Subcategorias Alimentação
  s_supermercado UUID;
  s_acougue UUID;
  s_padaria UUID;
  s_hortifruti UUID;

  -- Subcategorias Transporte
  s_combustivel UUID;
  s_app_transp UUID;
  s_estacionamento UUID;

  -- Subcategorias Saúde
  s_farmacia UUID;
  s_consultas UUID;

  -- Subcategorias Gastronomia & Lazer
  s_delivery UUID;
  s_restaurante UUID;

  -- Subcategorias Pets
  s_pet_racao UUID;
  s_pet_vet UUID;
  s_pet_higiene UUID;

  -- Subcategorias Assinaturas & Serviços
  s_netflix UUID;
  s_spotify UUID;

  -- Subcategorias Compras & Desejos
  s_vestuario UUID;
BEGIN
  FOR f_rec IN SELECT id, created_by FROM public.families LOOP
    u_id := f_rec.created_by;
    IF u_id IS NULL THEN
      SELECT id INTO u_id FROM auth.users LIMIT 1;
    END IF;

    -- =========================================================================
    -- 1. LOCALIZAR OU CRIAR CATEGORIAS ESSENCIAIS
    -- =========================================================================
    SELECT id INTO c_alim FROM public.transaction_categories
      WHERE family_id = f_rec.id AND name ILIKE 'Alimentação' LIMIT 1;

    SELECT id INTO c_transp FROM public.transaction_categories
      WHERE family_id = f_rec.id AND name ILIKE 'Transporte' LIMIT 1;

    SELECT id INTO c_saude FROM public.transaction_categories
      WHERE family_id = f_rec.id AND name ILIKE 'Saúde' LIMIT 1;

    SELECT id INTO c_gastro FROM public.transaction_categories
      WHERE family_id = f_rec.id AND (name ILIKE 'Gastronomia & Lazer' OR name ILIKE 'Restaurantes e Delivery') LIMIT 1;

    SELECT id INTO c_pets FROM public.transaction_categories
      WHERE family_id = f_rec.id AND name ILIKE 'Pets' LIMIT 1;

    SELECT id INTO c_assinat FROM public.transaction_categories
      WHERE family_id = f_rec.id AND name ILIKE 'Assinaturas & Serviços' LIMIT 1;

    SELECT id INTO c_compras FROM public.transaction_categories
      WHERE family_id = f_rec.id AND (name ILIKE 'Compras & Desejos' OR name ILIKE 'Compras') LIMIT 1;

    -- =========================================================================
    -- 2. GARANTIR EXISTÊNCIA DAS SUBCATEGORIAS ALVO
    -- =========================================================================
    -- Alimentação -> Supermercado, Açougue, Padaria e Lanches, Hortifruti
    IF c_alim IS NOT NULL THEN
      SELECT id INTO s_supermercado FROM public.transaction_subcategories
        WHERE category_id = c_alim AND name ILIKE 'Supermercado' LIMIT 1;
      IF s_supermercado IS NULL THEN
        INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
        VALUES (c_alim, f_rec.id, 'Supermercado', 'ShoppingCart', '#10B981', 1)
        RETURNING id INTO s_supermercado;
      END IF;

      SELECT id INTO s_acougue FROM public.transaction_subcategories
        WHERE category_id = c_alim AND name ILIKE 'Açougue' LIMIT 1;
      SELECT id INTO s_padaria FROM public.transaction_subcategories
        WHERE category_id = c_alim AND (name ILIKE 'Padaria' OR name ILIKE 'Padaria e Lanches') LIMIT 1;
      SELECT id INTO s_hortifruti FROM public.transaction_subcategories
        WHERE category_id = c_alim AND (name ILIKE 'Hortifruti' OR name ILIKE 'Hortefruti') LIMIT 1;
    END IF;

    -- Transporte -> Combustível, App de transporte, Estacionamento
    IF c_transp IS NOT NULL THEN
      SELECT id INTO s_combustivel FROM public.transaction_subcategories
        WHERE category_id = c_transp AND (name ILIKE 'Combustível' OR name ILIKE 'Combustivel') LIMIT 1;
      IF s_combustivel IS NULL THEN
        INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
        VALUES (c_transp, f_rec.id, 'Combustível', 'Fuel', '#F59E0B', 1)
        RETURNING id INTO s_combustivel;
      END IF;

      SELECT id INTO s_app_transp FROM public.transaction_subcategories
        WHERE category_id = c_transp AND name ILIKE 'App de transporte' LIMIT 1;
      IF s_app_transp IS NULL THEN
        INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
        VALUES (c_transp, f_rec.id, 'App de transporte', 'Car', '#3B82F6', 2)
        RETURNING id INTO s_app_transp;
      END IF;

      SELECT id INTO s_estacionamento FROM public.transaction_subcategories
        WHERE category_id = c_transp AND name ILIKE 'Estacionamento' LIMIT 1;
    END IF;

    -- Saúde -> Farmácia
    IF c_saude IS NOT NULL THEN
      SELECT id INTO s_farmacia FROM public.transaction_subcategories
        WHERE category_id = c_saude AND (name ILIKE 'Farmácia' OR name ILIKE 'Farmacia') LIMIT 1;
      IF s_farmacia IS NULL THEN
        INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
        VALUES (c_saude, f_rec.id, 'Farmácia', 'Pill', '#EC4899', 1)
        RETURNING id INTO s_farmacia;
      END IF;

      SELECT id INTO s_consultas FROM public.transaction_subcategories
        WHERE category_id = c_saude AND name ILIKE 'Consultas' LIMIT 1;
    END IF;

    -- Gastronomia & Lazer -> Delivery, Restaurante
    IF c_gastro IS NOT NULL THEN
      SELECT id INTO s_delivery FROM public.transaction_subcategories
        WHERE category_id = c_gastro AND name ILIKE 'Delivery' LIMIT 1;
      IF s_delivery IS NULL THEN
        INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
        VALUES (c_gastro, f_rec.id, 'Delivery', 'Utensils', '#F97316', 1)
        RETURNING id INTO s_delivery;
      END IF;

      SELECT id INTO s_restaurante FROM public.transaction_subcategories
        WHERE category_id = c_gastro AND (name ILIKE 'Restaurante' OR name ILIKE 'Restaurantes') LIMIT 1;
      IF s_restaurante IS NULL THEN
        INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
        VALUES (c_gastro, f_rec.id, 'Restaurante', 'UtensilsCrossed', '#F97316', 2)
        RETURNING id INTO s_restaurante;
      END IF;
    END IF;

    -- Pets -> Ração, Veterinário & Medicamentos, Higiene & Acessórios
    IF c_pets IS NOT NULL THEN
      SELECT id INTO s_pet_racao FROM public.transaction_subcategories
        WHERE category_id = c_pets AND (name ILIKE 'Ração' OR name ILIKE 'Racao') LIMIT 1;
      IF s_pet_racao IS NULL THEN
        INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
        VALUES (c_pets, f_rec.id, 'Ração', 'HeartHandshake', '#8B5CF6', 1)
        RETURNING id INTO s_pet_racao;
      END IF;

      SELECT id INTO s_pet_vet FROM public.transaction_subcategories
        WHERE category_id = c_pets AND (name ILIKE 'Veterinário & Medicamentos' OR name ILIKE 'Veterinário' OR name ILIKE 'Veterinario') LIMIT 1;
      IF s_pet_vet IS NULL THEN
        INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
        VALUES (c_pets, f_rec.id, 'Veterinário & Medicamentos', 'Stethoscope', '#8B5CF6', 2)
        RETURNING id INTO s_pet_vet;
      END IF;

      SELECT id INTO s_pet_higiene FROM public.transaction_subcategories
        WHERE category_id = c_pets AND name ILIKE 'Higiene & Acessórios' LIMIT 1;
    END IF;

    -- Assinaturas & Serviços
    IF c_assinat IS NOT NULL THEN
      SELECT id INTO s_netflix FROM public.transaction_subcategories
        WHERE category_id = c_assinat AND name ILIKE 'Netflix' LIMIT 1;
      SELECT id INTO s_spotify FROM public.transaction_subcategories
        WHERE category_id = c_assinat AND name ILIKE 'Spotify' LIMIT 1;
    END IF;

    -- Compras & Desejos
    IF c_compras IS NOT NULL THEN
      SELECT id INTO s_vestuario FROM public.transaction_subcategories
        WHERE category_id = c_compras AND (name ILIKE 'Vestuário' OR name ILIKE 'Vestuário & Calçados') LIMIT 1;
    END IF;

    -- =========================================================================
    -- 3. INSERIR OU ATUALIZAR REGRAS OBRIGATÓRIAS (category_id E subcategory_id)
    -- =========================================================================

    -- 3.1 REDES DE SUPERMERCADO -> Alimentação > Supermercado
    IF c_alim IS NOT NULL AND s_supermercado IS NOT NULL THEN
      FOR r_pat IN SELECT pat FROM unnest(ARRAY[
        'CARREFOUR', 'PAO DE ACUCAR', 'PÃO DE AÇÚCAR', 'ASSAI', 'ASSAÍ',
        'ATACADAO', 'ATACADÃO', 'SAMS CLUB', 'SAM S CLUB', 'SUPERMERCADO',
        'MERCADO', 'HIPERMERCADO', 'EXTRA', 'BIG', 'ZONA SUL', 'SACOLAO',
        'SACOLÃO', 'DIA BRASIL', 'SONDA', 'ZAFFARI', 'PREZUNIC', 'GUANABARA',
        'MUNDIAL', 'SUPER NOSSO', 'COOP', 'MAMBO', 'ST MARCHE', 'HIROTA',
        'MERCEARIA'
      ]) AS pat LOOP
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, r_pat.pat, c_alim, s_supermercado)
        ON CONFLICT DO NOTHING;
        UPDATE public.categorization_rules
        SET category_id = c_alim, subcategory_id = s_supermercado
        WHERE family_id = f_rec.id AND UPPER(TRIM(pattern)) = UPPER(TRIM(r_pat.pat));
      END LOOP;
    END IF;

    -- Açougue, Padaria, Hortifruti
    IF c_alim IS NOT NULL AND s_acougue IS NOT NULL THEN
      INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
      VALUES (f_rec.id, u_id, 'ACOUQUE', c_alim, s_acougue) ON CONFLICT DO NOTHING;
      INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
      VALUES (f_rec.id, u_id, 'AÇOUGUE', c_alim, s_acougue) ON CONFLICT DO NOTHING;
    END IF;
    IF c_alim IS NOT NULL AND s_padaria IS NOT NULL THEN
      INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
      VALUES (f_rec.id, u_id, 'PADARIA', c_alim, s_padaria) ON CONFLICT DO NOTHING;
      INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
      VALUES (f_rec.id, u_id, 'PANIFICADORA', c_alim, s_padaria) ON CONFLICT DO NOTHING;
    END IF;
    IF c_alim IS NOT NULL AND s_hortifruti IS NOT NULL THEN
      INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
      VALUES (f_rec.id, u_id, 'HORTIFRUTI', c_alim, s_hortifruti) ON CONFLICT DO NOTHING;
      INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
      VALUES (f_rec.id, u_id, 'HORTEFRUTI', c_alim, s_hortifruti) ON CONFLICT DO NOTHING;
    END IF;

    -- 3.2 POSTOS DE COMBUSTÍVEL -> Transporte > Combustível
    IF c_transp IS NOT NULL AND s_combustivel IS NOT NULL THEN
      FOR r_pat IN SELECT pat FROM unnest(ARRAY[
        'POSTO', 'AUTO POSTO', 'SHELL', 'IPIRANGA', 'PETROBRAS',
        'POSTO IPIRANGA', 'POSTO SHELL', 'POSTO BR', 'ALE COMBUSTIVEIS',
        'GASOLINA', 'ETANOL', 'DIESEL', 'COMBUSTIVEL', 'COMBUSTÍVEL'
      ]) AS pat LOOP
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, r_pat.pat, c_transp, s_combustivel)
        ON CONFLICT DO NOTHING;
        UPDATE public.categorization_rules
        SET category_id = c_transp, subcategory_id = s_combustivel
        WHERE family_id = f_rec.id AND UPPER(TRIM(pattern)) = UPPER(TRIM(r_pat.pat));
      END LOOP;
    END IF;

    -- 3.3 APPS DE TRANSPORTE -> Transporte > App de transporte
    IF c_transp IS NOT NULL AND s_app_transp IS NOT NULL THEN
      FOR r_pat IN SELECT pat FROM unnest(ARRAY[
        'UBER', '99APP', '99 TECNOLOGIA', '99 POP', '99 TAXI', '99TAXI',
        'CABIFY', 'INDRIVE'
      ]) AS pat LOOP
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, r_pat.pat, c_transp, s_app_transp)
        ON CONFLICT DO NOTHING;
        UPDATE public.categorization_rules
        SET category_id = c_transp, subcategory_id = s_app_transp
        WHERE family_id = f_rec.id AND UPPER(TRIM(pattern)) = UPPER(TRIM(r_pat.pat));
      END LOOP;
    END IF;

    -- Estacionamentos
    IF c_transp IS NOT NULL AND s_estacionamento IS NOT NULL THEN
      FOR r_pat IN SELECT pat FROM unnest(ARRAY['SEM PARAR', 'VELOE', 'ESTAPAR', 'CONECTCAR', 'ESTACIONAMENTO']) AS pat LOOP
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, r_pat.pat, c_transp, s_estacionamento)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    -- 3.4 FARMÁCIAS -> Saúde > Farmácia
    IF c_saude IS NOT NULL AND s_farmacia IS NOT NULL THEN
      FOR r_pat IN SELECT pat FROM unnest(ARRAY[
        'DROGASIL', 'DROGA RAIA', 'PACHECO', 'PAGUE MENOS', 'PANVEL',
        'DROGARIA', 'FARMACIA', 'FARMÁCIA', 'ULTRAFARMA', 'DROGARIA ONOFRE',
        'FARMACIAS PAGUE MENOS', 'SAO PAULO'
      ]) AS pat LOOP
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, r_pat.pat, c_saude, s_farmacia)
        ON CONFLICT DO NOTHING;
        UPDATE public.categorization_rules
        SET category_id = c_saude, subcategory_id = s_farmacia
        WHERE family_id = f_rec.id AND UPPER(TRIM(pattern)) = UPPER(TRIM(r_pat.pat));
      END LOOP;
    END IF;

    -- 3.5 DELIVERY / RESTAURANTES -> Gastronomia & Lazer > Delivery ou Restaurante
    IF c_gastro IS NOT NULL AND s_delivery IS NOT NULL THEN
      FOR r_pat IN SELECT pat FROM unnest(ARRAY[
        'IFOOD', 'RAPPI', 'UBER EATS', 'AIQFOME', 'DELIVERY'
      ]) AS pat LOOP
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, r_pat.pat, c_gastro, s_delivery)
        ON CONFLICT DO NOTHING;
        UPDATE public.categorization_rules
        SET category_id = c_gastro, subcategory_id = s_delivery
        WHERE family_id = f_rec.id AND UPPER(TRIM(pattern)) = UPPER(TRIM(r_pat.pat));
      END LOOP;
    END IF;

    IF c_gastro IS NOT NULL AND s_restaurante IS NOT NULL THEN
      FOR r_pat IN SELECT pat FROM unnest(ARRAY[
        'MCDONALDS', 'BURGER KING', 'HABIB', 'SUBWAY', 'OUTBACK', 'MADERO',
        'SPOLETO', 'GIRAFFAS', 'RESTAURANTE', 'PIZZARIA', 'HAMBURGUER',
        'CHURRASCARIA', 'CHOPERIA', 'BOTECO', 'BAR '
      ]) AS pat LOOP
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, r_pat.pat, c_gastro, s_restaurante)
        ON CONFLICT DO NOTHING;
        UPDATE public.categorization_rules
        SET category_id = c_gastro, subcategory_id = s_restaurante
        WHERE family_id = f_rec.id AND UPPER(TRIM(pattern)) = UPPER(TRIM(r_pat.pat));
      END LOOP;
    END IF;

    -- 3.6 PET SHOPS -> Pets > Ração ou Veterinário & Medicamentos
    IF c_pets IS NOT NULL THEN
      -- Pet shops gerais e ração -> Ração (ou Higiene/Veterinário)
      IF s_pet_racao IS NOT NULL THEN
        FOR r_pat IN SELECT pat FROM unnest(ARRAY[
          'PETZ', 'COBASI', 'PETLOVE', 'PET SHOP', 'PETSHOP', 'RACAO', 'RAÇÃO'
        ]) AS pat LOOP
          INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
          VALUES (f_rec.id, u_id, r_pat.pat, c_pets, s_pet_racao)
          ON CONFLICT DO NOTHING;
          UPDATE public.categorization_rules
          SET category_id = c_pets, subcategory_id = s_pet_racao
          WHERE family_id = f_rec.id AND UPPER(TRIM(pattern)) = UPPER(TRIM(r_pat.pat));
        END LOOP;
      END IF;

      -- Veterinário específico
      IF s_pet_vet IS NOT NULL THEN
        FOR r_pat IN SELECT pat FROM unnest(ARRAY[
          'VETERINARIO', 'VETERINÁRIO', 'CLINICA VET', 'HOSPITAL VET'
        ]) AS pat LOOP
          INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
          VALUES (f_rec.id, u_id, r_pat.pat, c_pets, s_pet_vet)
          ON CONFLICT DO NOTHING;
          UPDATE public.categorization_rules
          SET category_id = c_pets, subcategory_id = s_pet_vet
          WHERE family_id = f_rec.id AND UPPER(TRIM(pattern)) = UPPER(TRIM(r_pat.pat));
        END LOOP;
      END IF;
    END IF;

    -- 3.7 Streaming / Assinaturas
    IF c_assinat IS NOT NULL THEN
      IF s_netflix IS NOT NULL THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'NETFLIX', c_assinat, s_netflix) ON CONFLICT DO NOTHING;
        UPDATE public.categorization_rules
        SET category_id = c_assinat, subcategory_id = s_netflix
        WHERE family_id = f_rec.id AND UPPER(TRIM(pattern)) = 'NETFLIX';
      END IF;
      IF s_spotify IS NOT NULL THEN
        INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
        VALUES (f_rec.id, u_id, 'SPOTIFY', c_assinat, s_spotify) ON CONFLICT DO NOTHING;
        UPDATE public.categorization_rules
        SET category_id = c_assinat, subcategory_id = s_spotify
        WHERE family_id = f_rec.id AND UPPER(TRIM(pattern)) = 'SPOTIFY';
      END IF;
    END IF;

  END LOOP;
END $$;
