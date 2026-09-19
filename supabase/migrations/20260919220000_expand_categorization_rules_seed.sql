-- Expansão do seed de categorization_rules com marcas e palavras-chave do mercado brasileiro
-- Mapeia os padrões para as categorias e subcategorias reais existentes no app
-- Garante idempotência: se o padrão já existir para a família, atualiza subcategoria/categoria ou não duplica.

-- Função auxiliar temporária de upsert para evitar repetição de código
CREATE OR REPLACE FUNCTION public.categorization_rule_seed_upsert(
  p_family_id UUID,
  p_user_id UUID,
  p_pattern TEXT,
  p_category_id UUID,
  p_subcategory_id UUID
) RETURNS VOID AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- Verificar se já existe a regra com o mesmo pattern para esta família
  SELECT id INTO v_existing_id
  FROM public.categorization_rules
  WHERE family_id = p_family_id AND UPPER(TRIM(pattern)) = UPPER(TRIM(p_pattern))
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.categorization_rules
    SET category_id = p_category_id,
        subcategory_id = p_subcategory_id,
        pattern = p_pattern
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, p_user_id, p_pattern, p_category_id, p_subcategory_id);
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  f_rec RECORD;
  u_id UUID;

  -- Categorias
  c_alim UUID;
  c_gastro UUID;
  c_transp UUID;
  c_assinat UUID;
  c_saude UUID;
  c_pets UUID;
  c_compras UUID;

  -- Subcategorias Alimentação
  s_supermercado UUID;
  s_acougue UUID;
  s_padaria UUID;
  s_hortifruti UUID;

  -- Subcategorias Gastronomia & Lazer
  s_delivery UUID;
  s_restaurante UUID;

  -- Subcategorias Transporte
  s_combustivel UUID;
  s_app_transp UUID;
  s_estacionamento UUID;

  -- Subcategorias Assinaturas & Serviços
  s_netflix UUID;
  s_spotify UUID;

  -- Subcategorias Saúde
  s_farmacia UUID;

  -- Subcategorias Pets
  s_pet_vet UUID;
  s_pet_geral UUID;

  -- Subcategorias Compras & Desejos
  s_vestuario UUID;
BEGIN
  -- Percorrer todas as famílias cadastradas
  FOR f_rec IN SELECT id, created_by FROM public.families LOOP
    u_id := f_rec.created_by;
    IF u_id IS NULL THEN
      SELECT id INTO u_id FROM auth.users LIMIT 1;
    END IF;

    -- =========================================================================
    -- 1. IDENTIFICAR CATEGORIAS DA FAMÍLIA
    -- =========================================================================
    SELECT id INTO c_alim FROM public.transaction_categories 
      WHERE family_id = f_rec.id AND name = 'Alimentação' LIMIT 1;
    IF c_alim IS NULL THEN
      SELECT id INTO c_alim FROM public.transaction_categories 
        WHERE family_id = f_rec.id AND name = 'Mercado' LIMIT 1;
    END IF;

    SELECT id INTO c_gastro FROM public.transaction_categories 
      WHERE family_id = f_rec.id AND name = 'Gastronomia & Lazer' LIMIT 1;
    IF c_gastro IS NULL THEN
      SELECT id INTO c_gastro FROM public.transaction_categories 
        WHERE family_id = f_rec.id AND name = 'Restaurantes e Delivery' LIMIT 1;
    END IF;

    SELECT id INTO c_transp FROM public.transaction_categories 
      WHERE family_id = f_rec.id AND name = 'Transporte' LIMIT 1;

    SELECT id INTO c_assinat FROM public.transaction_categories 
      WHERE family_id = f_rec.id AND name = 'Assinaturas & Serviços' LIMIT 1;
    IF c_assinat IS NULL THEN
      SELECT id INTO c_assinat FROM public.transaction_categories 
        WHERE family_id = f_rec.id AND name = 'Assinaturas e Serviços' LIMIT 1;
    END IF;

    SELECT id INTO c_saude FROM public.transaction_categories 
      WHERE family_id = f_rec.id AND name = 'Saúde' LIMIT 1;

    SELECT id INTO c_pets FROM public.transaction_categories 
      WHERE family_id = f_rec.id AND name = 'Pets' LIMIT 1;

    SELECT id INTO c_compras FROM public.transaction_categories 
      WHERE family_id = f_rec.id AND name = 'Compras & Desejos' LIMIT 1;
    IF c_compras IS NULL THEN
      SELECT id INTO c_compras FROM public.transaction_categories 
        WHERE family_id = f_rec.id AND name = 'Compras' LIMIT 1;
    END IF;

    -- =========================================================================
    -- 2. IDENTIFICAR SUBCATEGORIAS
    -- =========================================================================
    IF c_alim IS NOT NULL THEN
      SELECT id INTO s_supermercado FROM public.transaction_subcategories 
        WHERE category_id = c_alim AND name = 'Supermercado' LIMIT 1;
      SELECT id INTO s_acougue FROM public.transaction_subcategories 
        WHERE category_id = c_alim AND name = 'Açougue' LIMIT 1;
      SELECT id INTO s_padaria FROM public.transaction_subcategories 
        WHERE category_id = c_alim AND (name = 'Padaria' OR name = 'Padaria e Lanches') LIMIT 1;
      SELECT id INTO s_hortifruti FROM public.transaction_subcategories 
        WHERE category_id = c_alim AND name = 'Hortifruti' LIMIT 1;
    END IF;

    IF c_gastro IS NOT NULL THEN
      SELECT id INTO s_delivery FROM public.transaction_subcategories 
        WHERE category_id = c_gastro AND (name = 'Delivery' OR name = 'Delivery e Apps') LIMIT 1;
      SELECT id INTO s_restaurante FROM public.transaction_subcategories 
        WHERE category_id = c_gastro AND (name = 'Restaurante' OR name = 'Restaurantes') LIMIT 1;
    END IF;

    IF c_transp IS NOT NULL THEN
      SELECT id INTO s_combustivel FROM public.transaction_subcategories 
        WHERE category_id = c_transp AND name = 'Combustível' LIMIT 1;
      SELECT id INTO s_app_transp FROM public.transaction_subcategories 
        WHERE category_id = c_transp AND (name = 'App de transporte' OR name = 'App de Transporte') LIMIT 1;
      SELECT id INTO s_estacionamento FROM public.transaction_subcategories 
        WHERE category_id = c_transp AND name = 'Estacionamento' LIMIT 1;
    END IF;

    IF c_assinat IS NOT NULL THEN
      SELECT id INTO s_netflix FROM public.transaction_subcategories 
        WHERE category_id = c_assinat AND name = 'Netflix' LIMIT 1;
      SELECT id INTO s_spotify FROM public.transaction_subcategories 
        WHERE category_id = c_assinat AND name = 'Spotify' LIMIT 1;
    END IF;

    IF c_saude IS NOT NULL THEN
      SELECT id INTO s_farmacia FROM public.transaction_subcategories 
        WHERE category_id = c_saude AND name = 'Farmácia' LIMIT 1;
    END IF;

    IF c_pets IS NOT NULL THEN
      SELECT id INTO s_pet_vet FROM public.transaction_subcategories 
        WHERE category_id = c_pets AND (name = 'Veterinário & Medicamentos' OR name = 'Veterinário') LIMIT 1;
      SELECT id INTO s_pet_geral FROM public.transaction_subcategories 
        WHERE category_id = c_pets AND name = 'Higiene & Acessórios' LIMIT 1;
    END IF;

    IF c_compras IS NOT NULL THEN
      SELECT id INTO s_vestuario FROM public.transaction_subcategories 
        WHERE category_id = c_compras AND name = 'Vestuário' LIMIT 1;
    END IF;

    -- =========================================================================
    -- 3. SEED DOS PADRÕES SOLICITADOS (Idempotente)
    -- =========================================================================

    -- 1. Alimentação → Supermercado / Açougue / Padaria / Hortifruti
    -- CARREFOUR, PAO DE ACUCAR, ASSAI, ATACADAO, SAMS CLUB, SUPERMERCADO
    IF c_alim IS NOT NULL THEN
      -- Supermercado
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'CARREFOUR', c_alim, s_supermercado);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'PAO DE ACUCAR', c_alim, s_supermercado);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'ASSAI', c_alim, s_supermercado);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'ATACADAO', c_alim, s_supermercado);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'SAMS CLUB', c_alim, s_supermercado);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'SUPERMERCADO', c_alim, s_supermercado);

      -- Açougue
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'ACOUQUE', c_alim, s_acougue);

      -- Padaria
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'PADARIA', c_alim, s_padaria);

      -- Hortifruti
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'HORTEFRUTI', c_alim, s_hortifruti);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'HORTIFRUTI', c_alim, s_hortifruti);
    END IF;

    -- 2. Gastronomia & Lazer → Delivery / Restaurante
    IF c_gastro IS NOT NULL THEN
      -- Delivery: IFOOD, RAPPI, UBER EATS
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'IFOOD', c_gastro, s_delivery);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'RAPPI', c_gastro, s_delivery);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'UBER EATS', c_gastro, s_delivery);

      -- Restaurante / Redes: MCDONALDS, BURGER KING, HABIB, SUBWAY, OUTBACK, RESTAURANTE, PIZZARIA, BAR
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'MCDONALDS', c_gastro, s_restaurante);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'BURGER KING', c_gastro, s_restaurante);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'HABIB', c_gastro, s_restaurante);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'SUBWAY', c_gastro, s_restaurante);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'OUTBACK', c_gastro, s_restaurante);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'RESTAURANTE', c_gastro, s_restaurante);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'PIZZARIA', c_gastro, s_restaurante);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'BAR ', c_gastro, s_restaurante);
    END IF;

    -- 3. Transporte → Combustível / App de transporte / Estacionamento
    IF c_transp IS NOT NULL THEN
      -- App de transporte: UBER, 99APP, 99 TECNOLOGIA
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'UBER', c_transp, s_app_transp);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, '99APP', c_transp, s_app_transp);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, '99 TECNOLOGIA', c_transp, s_app_transp);

      -- Combustível: POSTO, SHELL, IPIRANGA, PETROBRAS
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'POSTO', c_transp, s_combustivel);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'SHELL', c_transp, s_combustivel);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'IPIRANGA', c_transp, s_combustivel);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'PETROBRAS', c_transp, s_combustivel);

      -- Estacionamento / Pedágio / Tags: SEM PARAR, VELOE, ESTAPAR
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'SEM PARAR', c_transp, s_estacionamento);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'VELOE', c_transp, s_estacionamento);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'ESTAPAR', c_transp, s_estacionamento);
    END IF;

    -- 4. Assinaturas & Serviços
    IF c_assinat IS NOT NULL THEN
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'NETFLIX', c_assinat, s_netflix);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'SPOTIFY', c_assinat, s_spotify);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'PRIME VIDEO', c_assinat, NULL);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'DISNEY PLUS', c_assinat, NULL);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'HBO', c_assinat, NULL);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'MAX', c_assinat, NULL);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'APPLE.COM/BILL', c_assinat, NULL);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'YOUTUBE PREMIUM', c_assinat, NULL);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'SMART FIT', c_assinat, NULL);
    END IF;

    -- 5. Saúde → Farmácia
    IF c_saude IS NOT NULL THEN
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'DROGASIL', c_saude, s_farmacia);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'DROGA RAIA', c_saude, s_farmacia);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'PACHECO', c_saude, s_farmacia);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'PAGUE MENOS', c_saude, s_farmacia);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'PANVEL', c_saude, s_farmacia);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'DROGARIA', c_saude, s_farmacia);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'FARMACIA', c_saude, s_farmacia);
    END IF;

    -- 6. Pets → Veterinário & Medicamentos / Geral
    IF c_pets IS NOT NULL THEN
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'PETZ', c_pets, s_pet_geral);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'COBASI', c_pets, s_pet_geral);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'PETLOVE', c_pets, s_pet_geral);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'VETERINARIO', c_pets, s_pet_vet);
    END IF;

    -- 7. Compras & Desejos → Vestuário / E-commerce
    IF c_compras IS NOT NULL THEN
      -- Vestuário
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'ZARA', c_compras, s_vestuario);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'RENNER', c_compras, s_vestuario);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'RIACHUELO', c_compras, s_vestuario);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'C&A', c_compras, s_vestuario);

      -- E-commerce / Compras gerais
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'MERCADO LIVRE', c_compras, NULL);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'AMAZON BRASIL', c_compras, NULL);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'SHOPEE', c_compras, NULL);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'SHEIN', c_compras, NULL);
      PERFORM public.categorization_rule_seed_upsert(f_rec.id, u_id, 'MAGALU', c_compras, NULL);
    END IF;

  END LOOP;
END $$;

-- Limpar função auxiliar do schema público
DROP FUNCTION IF EXISTS public.categorization_rule_seed_upsert(UUID, UUID, TEXT, UUID, UUID);
