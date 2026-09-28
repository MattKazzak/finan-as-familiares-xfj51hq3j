-- Migração da Taxonomia Padrão Ouro 50/30/20 do app Curiangoo
-- 14 categorias mestras (5 essentials, 6 lifestyle, 3 future)
-- Remapeamento seguro de dados para todas as famílias existentes
-- Cadastro de subcategorias oficiais e regras de auto-categorização por keywords

DO $$
DECLARE
  v_family RECORD;
  v_user_id UUID;

  -- Variáveis de IDs de categorias mestras para a família iterada
  cat_moradia UUID;
  cat_alim_basica UUID;
  cat_transporte UUID;
  cat_saude UUID;
  cat_educacao UUID;
  cat_gastronomia UUID;
  cat_lazer UUID;
  cat_cuidados UUID;
  cat_assinaturas UUID;
  cat_compras UUID;
  cat_pets UUID;
  cat_reserva UUID;
  cat_metas UUID;
  cat_investimentos UUID;

  -- Subcategorias Moradia
  sub_aluguel_condominio UUID;
  sub_energia UUID;
  sub_agua UUID;
  sub_gas UUID;
  sub_internet UUID;
  sub_manut_casa UUID;

  -- Subcategorias Alimentação Básica
  sub_supermercado UUID;
  sub_acougue UUID;
  sub_hortifruti UUID;
  sub_padaria UUID;

  -- Subcategorias Transporte Obrigatório
  sub_combustivel UUID;
  sub_transp_publico UUID;
  sub_apps_transporte UUID;
  sub_estac_pedagio UUID;
  sub_seguro_ipva UUID;
  sub_manut_transp UUID;

  -- Subcategorias Saúde & Cuidados Médicos
  sub_plano_saude UUID;
  sub_farmacia UUID;
  sub_consultas UUID;
  sub_odontologia UUID;

  -- Subcategorias Educação Obrigatória
  sub_mensalidade_edu UUID;
  sub_material_edu UUID;
  sub_transp_escolar UUID;

  -- Subcategorias Gastronomia & Delivery
  sub_restaurantes UUID;
  sub_delivery UUID;
  sub_cafeterias UUID;

  -- Subcategorias Lazer & Passeios
  sub_cinema UUID;
  sub_shows UUID;
  sub_viagens UUID;
  sub_passeios UUID;

  -- Subcategorias Cuidados Pessoais & Bem-estar
  sub_salao UUID;
  sub_estetica UUID;
  sub_cosmeticos UUID;
  sub_academia UUID;

  -- Subcategorias Assinaturas & Conectividade
  sub_streaming UUID;
  sub_softwares UUID;
  sub_clubes UUID;

  -- Subcategorias Compras & Vestuário
  sub_roupas UUID;
  sub_eletronicos UUID;
  sub_decoracao UUID;
  sub_presentes UUID;

  -- Subcategorias Pets
  sub_racao UUID;
  sub_vet UUID;
  sub_banho UUID;

  -- Subcategorias Reserva de Emergência
  sub_aportes_reserva UUID;
  sub_resgates_reserva UUID;

  -- Subcategorias Metas & Grandes Sonhos
  sub_troca_carro UUID;
  sub_casa_propria UUID;
  sub_viagem_internacional UUID;
  sub_reforma UUID;

  -- Subcategorias Investimentos de Longo Prazo
  sub_previdencia UUID;
  sub_acoes_fiis UUID;
  sub_aposentadoria UUID;

BEGIN
  -- Itera por cada família existente
  FOR v_family IN SELECT id, created_by FROM public.families LOOP
    v_user_id := v_family.created_by;

    -- 1. Inserir ou recuperar as 14 Categorias Mestras da Taxonomia Padrão Ouro
    -- Balde Essentials (Necessidades - 50%)
    -- Moradia
    SELECT id INTO cat_moradia FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Moradia' LIMIT 1;
    IF cat_moradia IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Moradia', 'Home', '#6366F1', 'expense', 'essentials', 1)
      RETURNING id INTO cat_moradia;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'Home', color = '#6366F1', type = 'expense', budget_bucket = 'essentials', sort_order = 1
      WHERE id = cat_moradia;
    END IF;

    -- Alimentação Básica
    SELECT id INTO cat_alim_basica FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Alimentação Básica' LIMIT 1;
    IF cat_alim_basica IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Alimentação Básica', 'ShoppingCart', '#10B981', 'expense', 'essentials', 2)
      RETURNING id INTO cat_alim_basica;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'ShoppingCart', color = '#10B981', type = 'expense', budget_bucket = 'essentials', sort_order = 2
      WHERE id = cat_alim_basica;
    END IF;

    -- Transporte Obrigatório
    SELECT id INTO cat_transporte FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Transporte Obrigatório' LIMIT 1;
    IF cat_transporte IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Transporte Obrigatório', 'Car', '#3B82F6', 'expense', 'essentials', 3)
      RETURNING id INTO cat_transporte;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'Car', color = '#3B82F6', type = 'expense', budget_bucket = 'essentials', sort_order = 3
      WHERE id = cat_transporte;
    END IF;

    -- Saúde & Cuidados Médicos
    SELECT id INTO cat_saude FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Saúde & Cuidados Médicos' LIMIT 1;
    IF cat_saude IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Saúde & Cuidados Médicos', 'HeartPulse', '#EF4444', 'expense', 'essentials', 4)
      RETURNING id INTO cat_saude;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'HeartPulse', color = '#EF4444', type = 'expense', budget_bucket = 'essentials', sort_order = 4
      WHERE id = cat_saude;
    END IF;

    -- Educação Obrigatória
    SELECT id INTO cat_educacao FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Educação Obrigatória' LIMIT 1;
    IF cat_educacao IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Educação Obrigatória', 'GraduationCap', '#8B5CF6', 'expense', 'essentials', 5)
      RETURNING id INTO cat_educacao;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'GraduationCap', color = '#8B5CF6', type = 'expense', budget_bucket = 'essentials', sort_order = 5
      WHERE id = cat_educacao;
    END IF;

    -- Balde Lifestyle (Estilo de Vida - 30%)
    -- Gastronomia & Delivery
    SELECT id INTO cat_gastronomia FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Gastronomia & Delivery' LIMIT 1;
    IF cat_gastronomia IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Gastronomia & Delivery', 'Utensils', '#F59E0B', 'expense', 'lifestyle', 6)
      RETURNING id INTO cat_gastronomia;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'Utensils', color = '#F59E0B', type = 'expense', budget_bucket = 'lifestyle', sort_order = 6
      WHERE id = cat_gastronomia;
    END IF;

    -- Lazer & Passeios
    SELECT id INTO cat_lazer FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Lazer & Passeios' LIMIT 1;
    IF cat_lazer IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Lazer & Passeios', 'Ticket', '#F97316', 'expense', 'lifestyle', 7)
      RETURNING id INTO cat_lazer;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'Ticket', color = '#F97316', type = 'expense', budget_bucket = 'lifestyle', sort_order = 7
      WHERE id = cat_lazer;
    END IF;

    -- Cuidados Pessoais & Bem-estar
    SELECT id INTO cat_cuidados FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Cuidados Pessoais & Bem-estar' LIMIT 1;
    IF cat_cuidados IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Cuidados Pessoais & Bem-estar', 'Sparkles', '#EC4899', 'expense', 'lifestyle', 8)
      RETURNING id INTO cat_cuidados;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'Sparkles', color = '#EC4899', type = 'expense', budget_bucket = 'lifestyle', sort_order = 8
      WHERE id = cat_cuidados;
    END IF;

    -- Assinaturas & Conectividade
    SELECT id INTO cat_assinaturas FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Assinaturas & Conectividade' LIMIT 1;
    IF cat_assinaturas IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Assinaturas & Conectividade', 'Tv', '#7C3AED', 'expense', 'lifestyle', 9)
      RETURNING id INTO cat_assinaturas;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'Tv', color = '#7C3AED', type = 'expense', budget_bucket = 'lifestyle', sort_order = 9
      WHERE id = cat_assinaturas;
    END IF;

    -- Compras & Vestuário
    SELECT id INTO cat_compras FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Compras & Vestuário' LIMIT 1;
    IF cat_compras IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Compras & Vestuário', 'ShoppingBag', '#D97706', 'expense', 'lifestyle', 10)
      RETURNING id INTO cat_compras;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'ShoppingBag', color = '#D97706', type = 'expense', budget_bucket = 'lifestyle', sort_order = 10
      WHERE id = cat_compras;
    END IF;

    -- Pets
    SELECT id INTO cat_pets FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Pets' LIMIT 1;
    IF cat_pets IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Pets', 'PawPrint', '#84CC16', 'expense', 'lifestyle', 11)
      RETURNING id INTO cat_pets;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'PawPrint', color = '#84CC16', type = 'expense', budget_bucket = 'lifestyle', sort_order = 11
      WHERE id = cat_pets;
    END IF;

    -- Balde Future & Metas (20% - future)
    -- Reserva de Emergência
    SELECT id INTO cat_reserva FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Reserva de Emergência' LIMIT 1;
    IF cat_reserva IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Reserva de Emergência', 'ShieldCheck', '#10B981', 'expense', 'future', 12)
      RETURNING id INTO cat_reserva;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'ShieldCheck', color = '#10B981', type = 'expense', budget_bucket = 'future', sort_order = 12
      WHERE id = cat_reserva;
    END IF;

    -- Metas & Grandes Sonhos
    SELECT id INTO cat_metas FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Metas & Grandes Sonhos' LIMIT 1;
    IF cat_metas IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Metas & Grandes Sonhos', 'Target', '#06B6D4', 'expense', 'future', 13)
      RETURNING id INTO cat_metas;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'Target', color = '#06B6D4', type = 'expense', budget_bucket = 'future', sort_order = 13
      WHERE id = cat_metas;
    END IF;

    -- Investimentos de Longo Prazo
    SELECT id INTO cat_investimentos FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Investimentos de Longo Prazo' LIMIT 1;
    IF cat_investimentos IS NULL THEN
      INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
      VALUES (v_family.id, 'Investimentos de Longo Prazo', 'TrendingUp', '#059669', 'expense', 'future', 14)
      RETURNING id INTO cat_investimentos;
    ELSE
      UPDATE public.transaction_categories 
      SET icon = 'TrendingUp', color = '#059669', type = 'expense', budget_bucket = 'future', sort_order = 14
      WHERE id = cat_investimentos;
    END IF;

    -- 2. Inserir Subcategorias de cada categoria mestra
    -- Moradia
    SELECT id INTO sub_aluguel_condominio FROM public.transaction_subcategories WHERE category_id = cat_moradia AND name = 'Aluguel / Condomínio' LIMIT 1;
    IF sub_aluguel_condominio IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_moradia, v_family.id, 'Aluguel / Condomínio', 'Home', '#6366F1', 1) RETURNING id INTO sub_aluguel_condominio;
    END IF;

    SELECT id INTO sub_energia FROM public.transaction_subcategories WHERE category_id = cat_moradia AND name = 'Energia Elétrica' LIMIT 1;
    IF sub_energia IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_moradia, v_family.id, 'Energia Elétrica', 'Zap', '#6366F1', 2) RETURNING id INTO sub_energia;
    END IF;

    SELECT id INTO sub_agua FROM public.transaction_subcategories WHERE category_id = cat_moradia AND name = 'Água & Saneamento' LIMIT 1;
    IF sub_agua IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_moradia, v_family.id, 'Água & Saneamento', 'Droplets', '#6366F1', 3) RETURNING id INTO sub_agua;
    END IF;

    SELECT id INTO sub_gas FROM public.transaction_subcategories WHERE category_id = cat_moradia AND name = 'Gás' LIMIT 1;
    IF sub_gas IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_moradia, v_family.id, 'Gás', 'Flame', '#6366F1', 4) RETURNING id INTO sub_gas;
    END IF;

    SELECT id INTO sub_internet FROM public.transaction_subcategories WHERE category_id = cat_moradia AND name = 'Internet & Fixo' LIMIT 1;
    IF sub_internet IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_moradia, v_family.id, 'Internet & Fixo', 'Wifi', '#6366F1', 5) RETURNING id INTO sub_internet;
    END IF;

    SELECT id INTO sub_manut_casa FROM public.transaction_subcategories WHERE category_id = cat_moradia AND name = 'Manutenção da Casa' LIMIT 1;
    IF sub_manut_casa IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_moradia, v_family.id, 'Manutenção da Casa', 'Wrench', '#6366F1', 6) RETURNING id INTO sub_manut_casa;
    END IF;

    -- Alimentação Básica
    SELECT id INTO sub_supermercado FROM public.transaction_subcategories WHERE category_id = cat_alim_basica AND name = 'Supermercado' LIMIT 1;
    IF sub_supermercado IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_alim_basica, v_family.id, 'Supermercado', 'ShoppingCart', '#10B981', 1) RETURNING id INTO sub_supermercado;
    END IF;

    SELECT id INTO sub_acougue FROM public.transaction_subcategories WHERE category_id = cat_alim_basica AND name = 'Açougue & Peixaria' LIMIT 1;
    IF sub_acougue IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_alim_basica, v_family.id, 'Açougue & Peixaria', 'Beef', '#10B981', 2) RETURNING id INTO sub_acougue;
    END IF;

    SELECT id INTO sub_hortifruti FROM public.transaction_subcategories WHERE category_id = cat_alim_basica AND name = 'Hortifruti & Feira' LIMIT 1;
    IF sub_hortifruti IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_alim_basica, v_family.id, 'Hortifruti & Feira', 'Apple', '#10B981', 3) RETURNING id INTO sub_hortifruti;
    END IF;

    SELECT id INTO sub_padaria FROM public.transaction_subcategories WHERE category_id = cat_alim_basica AND name = 'Padaria do Dia a Dia' LIMIT 1;
    IF sub_padaria IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_alim_basica, v_family.id, 'Padaria do Dia a Dia', 'Coffee', '#10B981', 4) RETURNING id INTO sub_padaria;
    END IF;

    -- Transporte Obrigatório
    SELECT id INTO sub_combustivel FROM public.transaction_subcategories WHERE category_id = cat_transporte AND name = 'Combustível' LIMIT 1;
    IF sub_combustivel IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_transporte, v_family.id, 'Combustível', 'Fuel', '#3B82F6', 1) RETURNING id INTO sub_combustivel;
    END IF;

    SELECT id INTO sub_transp_publico FROM public.transaction_subcategories WHERE category_id = cat_transporte AND name = 'Transporte Público & Bilhete' LIMIT 1;
    IF sub_transp_publico IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_transporte, v_family.id, 'Transporte Público & Bilhete', 'Bus', '#3B82F6', 2) RETURNING id INTO sub_transp_publico;
    END IF;

    SELECT id INTO sub_apps_transporte FROM public.transaction_subcategories WHERE category_id = cat_transporte AND name = 'Aplicativos do Dia a Dia (Uber/99)' LIMIT 1;
    IF sub_apps_transporte IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_transporte, v_family.id, 'Aplicativos do Dia a Dia (Uber/99)', 'Car', '#3B82F6', 3) RETURNING id INTO sub_apps_transporte;
    END IF;

    SELECT id INTO sub_estac_pedagio FROM public.transaction_subcategories WHERE category_id = cat_transporte AND name = 'Estacionamento & Pedágio' LIMIT 1;
    IF sub_estac_pedagio IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_transporte, v_family.id, 'Estacionamento & Pedágio', 'CircleParking', '#3B82F6', 4) RETURNING id INTO sub_estac_pedagio;
    END IF;

    SELECT id INTO sub_seguro_ipva FROM public.transaction_subcategories WHERE category_id = cat_transporte AND name = 'Seguro & IPVA' LIMIT 1;
    IF sub_seguro_ipva IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_transporte, v_family.id, 'Seguro & IPVA', 'ShieldAlert', '#3B82F6', 5) RETURNING id INTO sub_seguro_ipva;
    END IF;

    SELECT id INTO sub_manut_transp FROM public.transaction_subcategories WHERE category_id = cat_transporte AND name = 'Manutenção Básica' LIMIT 1;
    IF sub_manut_transp IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_transporte, v_family.id, 'Manutenção Básica', 'Wrench', '#3B82F6', 6) RETURNING id INTO sub_manut_transp;
    END IF;

    -- Saúde & Cuidados Médicos
    SELECT id INTO sub_plano_saude FROM public.transaction_subcategories WHERE category_id = cat_saude AND name = 'Plano de Saúde' LIMIT 1;
    IF sub_plano_saude IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_saude, v_family.id, 'Plano de Saúde', 'Shield', '#EF4444', 1) RETURNING id INTO sub_plano_saude;
    END IF;

    SELECT id INTO sub_farmacia FROM public.transaction_subcategories WHERE category_id = cat_saude AND name = 'Farmácia & Medicamentos' LIMIT 1;
    IF sub_farmacia IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_saude, v_family.id, 'Farmácia & Medicamentos', 'Pill', '#EF4444', 2) RETURNING id INTO sub_farmacia;
    END IF;

    SELECT id INTO sub_consultas FROM public.transaction_subcategories WHERE category_id = cat_saude AND name = 'Consultas & Exames' LIMIT 1;
    IF sub_consultas IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_saude, v_family.id, 'Consultas & Exames', 'Stethoscope', '#EF4444', 3) RETURNING id INTO sub_consultas;
    END IF;

    SELECT id INTO sub_odontologia FROM public.transaction_subcategories WHERE category_id = cat_saude AND name = 'Odontologia' LIMIT 1;
    IF sub_odontologia IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_saude, v_family.id, 'Odontologia', 'Smile', '#EF4444', 4) RETURNING id INTO sub_odontologia;
    END IF;

    -- Educação Obrigatória
    SELECT id INTO sub_mensalidade_edu FROM public.transaction_subcategories WHERE category_id = cat_educacao AND name = 'Mensalidade Escolar / Faculdade' LIMIT 1;
    IF sub_mensalidade_edu IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_educacao, v_family.id, 'Mensalidade Escolar / Faculdade', 'GraduationCap', '#8B5CF6', 1) RETURNING id INTO sub_mensalidade_edu;
    END IF;

    SELECT id INTO sub_material_edu FROM public.transaction_subcategories WHERE category_id = cat_educacao AND name = 'Material & Uniformes' LIMIT 1;
    IF sub_material_edu IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_educacao, v_family.id, 'Material & Uniformes', 'BookOpen', '#8B5CF6', 2) RETURNING id INTO sub_material_edu;
    END IF;

    SELECT id INTO sub_transp_escolar FROM public.transaction_subcategories WHERE category_id = cat_educacao AND name = 'Transporte Escolar' LIMIT 1;
    IF sub_transp_escolar IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_educacao, v_family.id, 'Transporte Escolar', 'Bus', '#8B5CF6', 3) RETURNING id INTO sub_transp_escolar;
    END IF;

    -- Gastronomia & Delivery
    SELECT id INTO sub_restaurantes FROM public.transaction_subcategories WHERE category_id = cat_gastronomia AND name = 'Restaurantes & Bares' LIMIT 1;
    IF sub_restaurantes IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_gastronomia, v_family.id, 'Restaurantes & Bares', 'Utensils', '#F59E0B', 1) RETURNING id INTO sub_restaurantes;
    END IF;

    SELECT id INTO sub_delivery FROM public.transaction_subcategories WHERE category_id = cat_gastronomia AND name = 'Delivery (iFood/Rappi)' LIMIT 1;
    IF sub_delivery IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_gastronomia, v_family.id, 'Delivery (iFood/Rappi)', 'Bike', '#F59E0B', 2) RETURNING id INTO sub_delivery;
    END IF;

    SELECT id INTO sub_cafeterias FROM public.transaction_subcategories WHERE category_id = cat_gastronomia AND name = 'Cafeterias & Lanches Rápidos' LIMIT 1;
    IF sub_cafeterias IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_gastronomia, v_family.id, 'Cafeterias & Lanches Rápidos', 'Coffee', '#F59E0B', 3) RETURNING id INTO sub_cafeterias;
    END IF;

    -- Lazer & Passeios
    SELECT id INTO sub_cinema FROM public.transaction_subcategories WHERE category_id = cat_lazer AND name = 'Cinema' LIMIT 1;
    IF sub_cinema IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_lazer, v_family.id, 'Cinema', 'Film', '#F97316', 1) RETURNING id INTO sub_cinema;
    END IF;

    SELECT id INTO sub_shows FROM public.transaction_subcategories WHERE category_id = cat_lazer AND name = 'Shows & Eventos' LIMIT 1;
    IF sub_shows IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_lazer, v_family.id, 'Shows & Eventos', 'Ticket', '#F97316', 2) RETURNING id INTO sub_shows;
    END IF;

    SELECT id INTO sub_viagens FROM public.transaction_subcategories WHERE category_id = cat_lazer AND name = 'Viagens & Hospedagem' LIMIT 1;
    IF sub_viagens IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_lazer, v_family.id, 'Viagens & Hospedagem', 'Plane', '#F97316', 3) RETURNING id INTO sub_viagens;
    END IF;

    SELECT id INTO sub_passeios FROM public.transaction_subcategories WHERE category_id = cat_lazer AND name = 'Passeios de Fim de Semana' LIMIT 1;
    IF sub_passeios IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_lazer, v_family.id, 'Passeios de Fim de Semana', 'Sun', '#F97316', 4) RETURNING id INTO sub_passeios;
    END IF;

    -- Cuidados Pessoais & Bem-estar
    SELECT id INTO sub_salao FROM public.transaction_subcategories WHERE category_id = cat_cuidados AND name = 'Barbearia / Salão de Beleza' LIMIT 1;
    IF sub_salao IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_cuidados, v_family.id, 'Barbearia / Salão de Beleza', 'Scissors', '#EC4899', 1) RETURNING id INTO sub_salao;
    END IF;

    SELECT id INTO sub_estetica FROM public.transaction_subcategories WHERE category_id = cat_cuidados AND name = 'Manicure & Estética' LIMIT 1;
    IF sub_estetica IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_cuidados, v_family.id, 'Manicure & Estética', 'Sparkles', '#EC4899', 2) RETURNING id INTO sub_estetica;
    END IF;

    SELECT id INTO sub_cosmeticos FROM public.transaction_subcategories WHERE category_id = cat_cuidados AND name = 'Cosméticos & Perfumaria' LIMIT 1;
    IF sub_cosmeticos IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_cuidados, v_family.id, 'Cosméticos & Perfumaria', 'Package', '#EC4899', 3) RETURNING id INTO sub_cosmeticos;
    END IF;

    SELECT id INTO sub_academia FROM public.transaction_subcategories WHERE category_id = cat_cuidados AND name = 'Academia & Esportes' LIMIT 1;
    IF sub_academia IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_cuidados, v_family.id, 'Academia & Esportes', 'Activity', '#EC4899', 4) RETURNING id INTO sub_academia;
    END IF;

    -- Assinaturas & Conectividade
    SELECT id INTO sub_streaming FROM public.transaction_subcategories WHERE category_id = cat_assinaturas AND name = 'Streaming de Vídeo & Música' LIMIT 1;
    IF sub_streaming IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_assinaturas, v_family.id, 'Streaming de Vídeo & Música', 'Tv', '#7C3AED', 1) RETURNING id INTO sub_streaming;
    END IF;

    SELECT id INTO sub_softwares FROM public.transaction_subcategories WHERE category_id = cat_assinaturas AND name = 'Softwares & Apps' LIMIT 1;
    IF sub_softwares IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_assinaturas, v_family.id, 'Softwares & Apps', 'Terminal', '#7C3AED', 2) RETURNING id INTO sub_softwares;
    END IF;

    SELECT id INTO sub_clubes FROM public.transaction_subcategories WHERE category_id = cat_assinaturas AND name = 'Clubes de Assinatura' LIMIT 1;
    IF sub_clubes IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_assinaturas, v_family.id, 'Clubes de Assinatura', 'Sparkles', '#7C3AED', 3) RETURNING id INTO sub_clubes;
    END IF;

    -- Compras & Vestuário
    SELECT id INTO sub_roupas FROM public.transaction_subcategories WHERE category_id = cat_compras AND name = 'Roupas & Calçados' LIMIT 1;
    IF sub_roupas IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_compras, v_family.id, 'Roupas & Calçados', 'Shirt', '#D97706', 1) RETURNING id INTO sub_roupas;
    END IF;

    SELECT id INTO sub_eletronicos FROM public.transaction_subcategories WHERE category_id = cat_compras AND name = 'Eletrônicos & Gadgets' LIMIT 1;
    IF sub_eletronicos IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_compras, v_family.id, 'Eletrônicos & Gadgets', 'Laptop', '#D97706', 2) RETURNING id INTO sub_eletronicos;
    END IF;

    SELECT id INTO sub_decoracao FROM public.transaction_subcategories WHERE category_id = cat_compras AND name = 'Decoração & Utilidades' LIMIT 1;
    IF sub_decoracao IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_compras, v_family.id, 'Decoração & Utilidades', 'Home', '#D97706', 3) RETURNING id INTO sub_decoracao;
    END IF;

    SELECT id INTO sub_presentes FROM public.transaction_subcategories WHERE category_id = cat_compras AND name = 'Presentes' LIMIT 1;
    IF sub_presentes IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_compras, v_family.id, 'Presentes', 'Gift', '#D97706', 4) RETURNING id INTO sub_presentes;
    END IF;

    -- Pets
    SELECT id INTO sub_racao FROM public.transaction_subcategories WHERE category_id = cat_pets AND name = 'Ração & Petiscos' LIMIT 1;
    IF sub_racao IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_pets, v_family.id, 'Ração & Petiscos', 'Utensils', '#84CC16', 1) RETURNING id INTO sub_racao;
    END IF;

    SELECT id INTO sub_vet FROM public.transaction_subcategories WHERE category_id = cat_pets AND name = 'Veterinário & Vacinas' LIMIT 1;
    IF sub_vet IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_pets, v_family.id, 'Veterinário & Vacinas', 'HeartPulse', '#84CC16', 2) RETURNING id INTO sub_vet;
    END IF;

    SELECT id INTO sub_banho FROM public.transaction_subcategories WHERE category_id = cat_pets AND name = 'Banho, Tosa & Acessórios' LIMIT 1;
    IF sub_banho IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_pets, v_family.id, 'Banho, Tosa & Acessórios', 'Sparkles', '#84CC16', 3) RETURNING id INTO sub_banho;
    END IF;

    -- Reserva de Emergência
    SELECT id INTO sub_aportes_reserva FROM public.transaction_subcategories WHERE category_id = cat_reserva AND name = 'Aportes na Reserva' LIMIT 1;
    IF sub_aportes_reserva IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_reserva, v_family.id, 'Aportes na Reserva', 'ShieldCheck', '#10B981', 1) RETURNING id INTO sub_aportes_reserva;
    END IF;

    SELECT id INTO sub_resgates_reserva FROM public.transaction_subcategories WHERE category_id = cat_reserva AND name = 'Resgates Emergenciais' LIMIT 1;
    IF sub_resgates_reserva IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_reserva, v_family.id, 'Resgates Emergenciais', 'ArrowDownRight', '#10B981', 2) RETURNING id INTO sub_resgates_reserva;
    END IF;

    -- Metas & Grandes Sonhos
    SELECT id INTO sub_troca_carro FROM public.transaction_subcategories WHERE category_id = cat_metas AND name = 'Troca de Carro' LIMIT 1;
    IF sub_troca_carro IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_metas, v_family.id, 'Troca de Carro', 'Car', '#06B6D4', 1) RETURNING id INTO sub_troca_carro;
    END IF;

    SELECT id INTO sub_casa_propria FROM public.transaction_subcategories WHERE category_id = cat_metas AND name = 'Casa Própria' LIMIT 1;
    IF sub_casa_propria IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_metas, v_family.id, 'Casa Própria', 'Home', '#06B6D4', 2) RETURNING id INTO sub_casa_propria;
    END IF;

    SELECT id INTO sub_viagem_internacional FROM public.transaction_subcategories WHERE category_id = cat_metas AND name = 'Viagem Internacional' LIMIT 1;
    IF sub_viagem_internacional IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_metas, v_family.id, 'Viagem Internacional', 'Plane', '#06B6D4', 3) RETURNING id INTO sub_viagem_internacional;
    END IF;

    SELECT id INTO sub_reforma FROM public.transaction_subcategories WHERE category_id = cat_metas AND name = 'Reforma' LIMIT 1;
    IF sub_reforma IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_metas, v_family.id, 'Reforma', 'Wrench', '#06B6D4', 4) RETURNING id INTO sub_reforma;
    END IF;

    -- Investimentos de Longo Prazo
    SELECT id INTO sub_previdencia FROM public.transaction_subcategories WHERE category_id = cat_investimentos AND name = 'Previdência Privada' LIMIT 1;
    IF sub_previdencia IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_investimentos, v_family.id, 'Previdência Privada', 'Landmark', '#059669', 1) RETURNING id INTO sub_previdencia;
    END IF;

    SELECT id INTO sub_acoes_fiis FROM public.transaction_subcategories WHERE category_id = cat_investimentos AND name = 'Ações & Fundos Imobiliários' LIMIT 1;
    IF sub_acoes_fiis IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_investimentos, v_family.id, 'Ações & Fundos Imobiliários', 'TrendingUp', '#059669', 2) RETURNING id INTO sub_acoes_fiis;
    END IF;

    SELECT id INTO sub_aposentadoria FROM public.transaction_subcategories WHERE category_id = cat_investimentos AND name = 'Aposentadoria' LIMIT 1;
    IF sub_aposentadoria IS NULL THEN
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (cat_investimentos, v_family.id, 'Aposentadoria', 'PiggyBank', '#059669', 3) RETURNING id INTO sub_aposentadoria;
    END IF;

    -- 3. Remapear transações, orçamentos, metas e regras existentes de categorias antigas para as novas
    -- 'Alimentação' -> 'Alimentação Básica' (cat_alim_basica)
    UPDATE public.transactions
    SET category_id = cat_alim_basica, subcategory_id = COALESCE(subcategory_id, sub_supermercado)
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Alimentação'
    );

    UPDATE public.default_budgets
    SET category_id = cat_alim_basica
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Alimentação'
    );

    UPDATE public.budgets
    SET category_id = cat_alim_basica
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Alimentação'
    );

    UPDATE public.goals
    SET category_id = cat_alim_basica
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Alimentação'
    );

    -- 'Transporte' -> 'Transporte Obrigatório' (cat_transporte)
    UPDATE public.transactions
    SET category_id = cat_transporte
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Transporte'
    );

    UPDATE public.default_budgets
    SET category_id = cat_transporte
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Transporte'
    );

    UPDATE public.budgets
    SET category_id = cat_transporte
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Transporte'
    );

    -- 'Saúde' -> 'Saúde & Cuidados Médicos' (cat_saude)
    UPDATE public.transactions
    SET category_id = cat_saude
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Saúde'
    );

    UPDATE public.default_budgets
    SET category_id = cat_saude
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Saúde'
    );

    -- 'Educação' -> 'Educação Obrigatória' (cat_educacao)
    UPDATE public.transactions
    SET category_id = cat_educacao
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Educação'
    );

    UPDATE public.default_budgets
    SET category_id = cat_educacao
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Educação'
    );

    -- 'Lazer' e 'Lazer & Gastronomia' -> 'Gastronomia & Delivery' ou 'Lazer & Passeios'
    UPDATE public.transactions
    SET category_id = cat_lazer
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name IN ('Lazer', 'Lazer & Gastronomia')
    );

    UPDATE public.default_budgets
    SET category_id = cat_lazer
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name IN ('Lazer', 'Lazer & Gastronomia')
    );

    -- 'Cuidados Pessoais & Estética' -> 'Cuidados Pessoais & Bem-estar' (cat_cuidados)
    UPDATE public.transactions
    SET category_id = cat_cuidados
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Cuidados Pessoais & Estética'
    );

    UPDATE public.default_budgets
    SET category_id = cat_cuidados
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Cuidados Pessoais & Estética'
    );

    -- 'Assinaturas & Serviços' -> 'Assinaturas & Conectividade' (cat_assinaturas)
    UPDATE public.transactions
    SET category_id = cat_assinaturas
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Assinaturas & Serviços'
    );

    UPDATE public.default_budgets
    SET category_id = cat_assinaturas
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Assinaturas & Serviços'
    );

    -- 'Vestuário' e 'Compras & Desejos' -> 'Compras & Vestuário' (cat_compras)
    UPDATE public.transactions
    SET category_id = cat_compras
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name IN ('Vestuário', 'Compras & Desejos')
    );

    UPDATE public.default_budgets
    SET category_id = cat_compras
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name IN ('Vestuário', 'Compras & Desejos')
    );

    -- 'Investimentos & Aposentadoria' -> 'Investimentos de Longo Prazo' (cat_investimentos)
    UPDATE public.transactions
    SET category_id = cat_investimentos
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Investimentos & Aposentadoria'
    );

    UPDATE public.default_budgets
    SET category_id = cat_investimentos
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Investimentos & Aposentadoria'
    );

    -- 'Grandes Projetos' -> 'Metas & Grandes Sonhos' (cat_metas)
    UPDATE public.transactions
    SET category_id = cat_metas
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Grandes Projetos'
    );

    UPDATE public.default_budgets
    SET category_id = cat_metas
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Grandes Projetos'
    );

    -- 'Outro' ou categorias desconhecidas antigas de despesa -> 'Compras & Vestuário'
    UPDATE public.transactions
    SET category_id = cat_compras
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories WHERE family_id = v_family.id AND name = 'Outro'
    );

    -- 4. Limpar subcategorias antigas órfãs que pertenciam a categorias legadas
    DELETE FROM public.transaction_subcategories
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories
      WHERE family_id = v_family.id
        AND name NOT IN (
          'Moradia', 'Alimentação Básica', 'Transporte Obrigatório', 'Saúde & Cuidados Médicos',
          'Educação Obrigatória', 'Gastronomia & Delivery', 'Lazer & Passeios',
          'Cuidados Pessoais & Bem-estar', 'Assinaturas & Conectividade', 'Compras & Vestuário',
          'Pets', 'Reserva de Emergência', 'Metas & Grandes Sonhos', 'Investimentos de Longo Prazo',
          'Salário', 'Rendimentos'
        )
    );

    -- 5. Limpar categorias legadas redundantes que não pertencem à lista oficial
    DELETE FROM public.default_budgets
    WHERE family_id = v_family.id AND category_id IN (
      SELECT id FROM public.transaction_categories
      WHERE family_id = v_family.id
        AND name NOT IN (
          'Moradia', 'Alimentação Básica', 'Transporte Obrigatório', 'Saúde & Cuidados Médicos',
          'Educação Obrigatória', 'Gastronomia & Delivery', 'Lazer & Passeios',
          'Cuidados Pessoais & Bem-estar', 'Assinaturas & Conectividade', 'Compras & Vestuário',
          'Pets', 'Reserva de Emergência', 'Metas & Grandes Sonhos', 'Investimentos de Longo Prazo',
          'Salário', 'Rendimentos'
        )
    );

    DELETE FROM public.transaction_categories
    WHERE family_id = v_family.id
      AND name NOT IN (
        'Moradia', 'Alimentação Básica', 'Transporte Obrigatório', 'Saúde & Cuidados Médicos',
        'Educação Obrigatória', 'Gastronomia & Delivery', 'Lazer & Passeios',
        'Cuidados Pessoais & Bem-estar', 'Assinaturas & Conectividade', 'Compras & Vestuário',
        'Pets', 'Reserva de Emergência', 'Metas & Grandes Sonhos', 'Investimentos de Longo Prazo',
        'Salário', 'Rendimentos'
      );

    -- 6. Atualizar / Inserir Categorization Rules com as Keywords Exatas da Taxonomia Padrão Ouro
    DELETE FROM public.categorization_rules WHERE family_id = v_family.id;

    -- Moradia keywords: aluguel, condominio, enel, sabesp, cpfl, luz, agua, comgas, vivo fibra, claro residencial
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'ALUGUEL', cat_moradia, sub_aluguel_condominio),
      (v_family.id, v_user_id, 'CONDOMINIO', cat_moradia, sub_aluguel_condominio),
      (v_family.id, v_user_id, 'ENEL', cat_moradia, sub_energia),
      (v_family.id, v_user_id, 'CPFL', cat_moradia, sub_energia),
      (v_family.id, v_user_id, 'LUZ', cat_moradia, sub_energia),
      (v_family.id, v_user_id, 'SABESP', cat_moradia, sub_agua),
      (v_family.id, v_user_id, 'AGUA', cat_moradia, sub_agua),
      (v_family.id, v_user_id, 'COMGAS', cat_moradia, sub_gas),
      (v_family.id, v_user_id, 'VIVO FIBRA', cat_moradia, sub_internet),
      (v_family.id, v_user_id, 'CLARO RESIDENCIAL', cat_moradia, sub_internet);

    -- Alimentação Básica keywords: carrefour, assai, pao de acucar, atacadao, mercadinho, feira, acougue, swift, hortifruti
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'CARREFOUR', cat_alim_basica, sub_supermercado),
      (v_family.id, v_user_id, 'ASSAI', cat_alim_basica, sub_supermercado),
      (v_family.id, v_user_id, 'ASSAÍ', cat_alim_basica, sub_supermercado),
      (v_family.id, v_user_id, 'PAO DE ACUCAR', cat_alim_basica, sub_supermercado),
      (v_family.id, v_user_id, 'PÃO DE AÇÚCAR', cat_alim_basica, sub_supermercado),
      (v_family.id, v_user_id, 'ATACADAO', cat_alim_basica, sub_supermercado),
      (v_family.id, v_user_id, 'ATACADÃO', cat_alim_basica, sub_supermercado),
      (v_family.id, v_user_id, 'MERCADINHO', cat_alim_basica, sub_supermercado),
      (v_family.id, v_user_id, 'ACOUGUE', cat_alim_basica, sub_acougue),
      (v_family.id, v_user_id, 'SWIFT', cat_alim_basica, sub_acougue),
      (v_family.id, v_user_id, 'HORTIFRUTI', cat_alim_basica, sub_hortifruti),
      (v_family.id, v_user_id, 'FEIRA', cat_alim_basica, sub_hortifruti);

    -- Transporte Obrigatório keywords: posto, shell, ipiranga, uber, 99, metro, sptrans, pedagio, sem parar, posto ipiranga
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'POSTO IPIRANGA', cat_transporte, sub_combustivel),
      (v_family.id, v_user_id, 'POSTO', cat_transporte, sub_combustivel),
      (v_family.id, v_user_id, 'SHELL', cat_transporte, sub_combustivel),
      (v_family.id, v_user_id, 'IPIRANGA', cat_transporte, sub_combustivel),
      (v_family.id, v_user_id, 'UBER', cat_transporte, sub_apps_transporte),
      (v_family.id, v_user_id, '99', cat_transporte, sub_apps_transporte),
      (v_family.id, v_user_id, '99APP', cat_transporte, sub_apps_transporte),
      (v_family.id, v_user_id, 'METRO', cat_transporte, sub_transp_publico),
      (v_family.id, v_user_id, 'SPTRANS', cat_transporte, sub_transp_publico),
      (v_family.id, v_user_id, 'PEDAGIO', cat_transporte, sub_estac_pedagio),
      (v_family.id, v_user_id, 'SEM PARAR', cat_transporte, sub_estac_pedagio);

    -- Saúde & Cuidados Médicos keywords: drogasil, droga raia, pague menos, unimed, bradesco saude, laboratorio, fleury, dentista, farmacia
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'DROGASIL', cat_saude, sub_farmacia),
      (v_family.id, v_user_id, 'DROGA RAIA', cat_saude, sub_farmacia),
      (v_family.id, v_user_id, 'PAGUE MENOS', cat_saude, sub_farmacia),
      (v_family.id, v_user_id, 'FARMACIA', cat_saude, sub_farmacia),
      (v_family.id, v_user_id, 'UNIMED', cat_saude, sub_plano_saude),
      (v_family.id, v_user_id, 'BRADESCO SAUDE', cat_saude, sub_plano_saude),
      (v_family.id, v_user_id, 'FLEURY', cat_saude, sub_consultas),
      (v_family.id, v_user_id, 'LABORATORIO', cat_saude, sub_consultas),
      (v_family.id, v_user_id, 'DENTISTA', cat_saude, sub_odontologia);

    -- Educação Obrigatória keywords: escola, colegio, faculdade, mensalidade, papelaria, van escolar
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'ESCOLA', cat_educacao, sub_mensalidade_edu),
      (v_family.id, v_user_id, 'COLEGIO', cat_educacao, sub_mensalidade_edu),
      (v_family.id, v_user_id, 'COLÉGIO', cat_educacao, sub_mensalidade_edu),
      (v_family.id, v_user_id, 'FACULDADE', cat_educacao, sub_mensalidade_edu),
      (v_family.id, v_user_id, 'MENSALIDADE', cat_educacao, sub_mensalidade_edu),
      (v_family.id, v_user_id, 'PAPELARIA', cat_educacao, sub_material_edu),
      (v_family.id, v_user_id, 'VAN ESCOLAR', cat_educacao, sub_transp_escolar);

    -- Gastronomia & Delivery keywords: ifood, rappi, mcdonalds, outback, burger king, bar, choperia, cafeteria, starbucks, restaurante
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'IFOOD', cat_gastronomia, sub_delivery),
      (v_family.id, v_user_id, 'RAPPI', cat_gastronomia, sub_delivery),
      (v_family.id, v_user_id, 'MCDONALDS', cat_gastronomia, sub_cafeterias),
      (v_family.id, v_user_id, 'BURGER KING', cat_gastronomia, sub_cafeterias),
      (v_family.id, v_user_id, 'OUTBACK', cat_gastronomia, sub_restaurantes),
      (v_family.id, v_user_id, 'RESTAURANTE', cat_gastronomia, sub_restaurantes),
      (v_family.id, v_user_id, 'BAR', cat_gastronomia, sub_restaurantes),
      (v_family.id, v_user_id, 'CHOPERIA', cat_gastronomia, sub_restaurantes),
      (v_family.id, v_user_id, 'CAFETERIA', cat_gastronomia, sub_cafeterias),
      (v_family.id, v_user_id, 'STARBUCKS', cat_gastronomia, sub_cafeterias);

    -- Lazer & Passeios keywords: cinemark, ingresso.com, sympla, airbnb, hotel, booking, passagem aerea, azul, gol, latam
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'CINEMARK', cat_lazer, sub_cinema),
      (v_family.id, v_user_id, 'INGRESSO.COM', cat_lazer, sub_cinema),
      (v_family.id, v_user_id, 'SYMPLA', cat_lazer, sub_shows),
      (v_family.id, v_user_id, 'AIRBNB', cat_lazer, sub_viagens),
      (v_family.id, v_user_id, 'BOOKING', cat_lazer, sub_viagens),
      (v_family.id, v_user_id, 'HOTEL', cat_lazer, sub_viagens),
      (v_family.id, v_user_id, 'PASSAGEM AEREA', cat_lazer, sub_viagens),
      (v_family.id, v_user_id, 'AZUL', cat_lazer, sub_viagens),
      (v_family.id, v_user_id, 'GOL', cat_lazer, sub_viagens),
      (v_family.id, v_user_id, 'LATAM', cat_lazer, sub_viagens);

    -- Cuidados Pessoais & Bem-estar keywords: smart fit, academia, boticario, sephora, salao, barbearia, natura, estetica
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'SMART FIT', cat_cuidados, sub_academia),
      (v_family.id, v_user_id, 'ACADEMIA', cat_cuidados, sub_academia),
      (v_family.id, v_user_id, 'BOTICARIO', cat_cuidados, sub_cosmeticos),
      (v_family.id, v_user_id, 'BOTICÁRIO', cat_cuidados, sub_cosmeticos),
      (v_family.id, v_user_id, 'SEPHORA', cat_cuidados, sub_cosmeticos),
      (v_family.id, v_user_id, 'NATURA', cat_cuidados, sub_cosmeticos),
      (v_family.id, v_user_id, 'SALAO', cat_cuidados, sub_salao),
      (v_family.id, v_user_id, 'SALÃO', cat_cuidados, sub_salao),
      (v_family.id, v_user_id, 'BARBEARIA', cat_cuidados, sub_salao),
      (v_family.id, v_user_id, 'ESTETICA', cat_cuidados, sub_estetica),
      (v_family.id, v_user_id, 'ESTÉTICA', cat_cuidados, sub_estetica);

    -- Assinaturas & Conectividade keywords: netflix, spotify, amazon prime, youtube premium, hbo, max, disney, apple, google one
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'NETFLIX', cat_assinaturas, sub_streaming),
      (v_family.id, v_user_id, 'SPOTIFY', cat_assinaturas, sub_streaming),
      (v_family.id, v_user_id, 'AMAZON PRIME', cat_assinaturas, sub_streaming),
      (v_family.id, v_user_id, 'YOUTUBE PREMIUM', cat_assinaturas, sub_streaming),
      (v_family.id, v_user_id, 'HBO', cat_assinaturas, sub_streaming),
      (v_family.id, v_user_id, 'MAX', cat_assinaturas, sub_streaming),
      (v_family.id, v_user_id, 'DISNEY', cat_assinaturas, sub_streaming),
      (v_family.id, v_user_id, 'APPLE', cat_assinaturas, sub_softwares),
      (v_family.id, v_user_id, 'GOOGLE ONE', cat_assinaturas, sub_softwares);

    -- Compras & Vestuário keywords: zara, renner, riachuelo, shein, shopee, mercado livre, amazon compras
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'ZARA', cat_compras, sub_roupas),
      (v_family.id, v_user_id, 'RENNER', cat_compras, sub_roupas),
      (v_family.id, v_user_id, 'RIACHUELO', cat_compras, sub_roupas),
      (v_family.id, v_user_id, 'SHEIN', cat_compras, sub_roupas),
      (v_family.id, v_user_id, 'SHOPEE', cat_compras, sub_roupas),
      (v_family.id, v_user_id, 'MERCADO LIVRE', cat_compras, sub_eletronicos),
      (v_family.id, v_user_id, 'AMAZON COMPRAS', cat_compras, sub_eletronicos);

    -- Pets keywords: petz, cobasi, pet shop, veterinario, royal canin, premier pet
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'PETZ', cat_pets, sub_banho),
      (v_family.id, v_user_id, 'COBASI', cat_pets, sub_banho),
      (v_family.id, v_user_id, 'PET SHOP', cat_pets, sub_banho),
      (v_family.id, v_user_id, 'VETERINARIO', cat_pets, sub_vet),
      (v_family.id, v_user_id, 'VETERINÁRIO', cat_pets, sub_vet),
      (v_family.id, v_user_id, 'ROYAL CANIN', cat_pets, sub_racao),
      (v_family.id, v_user_id, 'PREMIER PET', cat_pets, sub_racao);

    -- Reserva de Emergência keywords: tesouro selic, cdb liquidez diaria, reserva, caixinha nubank
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'TESOURO SELIC', cat_reserva, sub_aportes_reserva),
      (v_family.id, v_user_id, 'CDB LIQUIDEZ DIARIA', cat_reserva, sub_aportes_reserva),
      (v_family.id, v_user_id, 'RESERVA', cat_reserva, sub_aportes_reserva),
      (v_family.id, v_user_id, 'CAIXINHA NUBANK', cat_reserva, sub_aportes_reserva);

    -- Metas & Grandes Sonhos keywords: fundo viagem, entrada apto, consorcio, meta
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'FUNDO VIAGEM', cat_metas, sub_viagem_internacional),
      (v_family.id, v_user_id, 'ENTRADA APTO', cat_metas, sub_casa_propria),
      (v_family.id, v_user_id, 'CONSORCIO', cat_metas, sub_troca_carro),
      (v_family.id, v_user_id, 'META', cat_metas, sub_reforma);

    -- Investimentos de Longo Prazo keywords: xp investimentos, btg, inter invest, previdencia, tesouro ipca
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
      (v_family.id, v_user_id, 'XP INVESTIMENTOS', cat_investimentos, sub_acoes_fiis),
      (v_family.id, v_user_id, 'BTG', cat_investimentos, sub_acoes_fiis),
      (v_family.id, v_user_id, 'INTER INVEST', cat_investimentos, sub_acoes_fiis),
      (v_family.id, v_user_id, 'PREVIDENCIA', cat_investimentos, sub_previdencia),
      (v_family.id, v_user_id, 'TESOURO IPCA', cat_investimentos, sub_acoes_fiis);

    -- 7. Fixar tetos em default_budgets para as 14 categorias se houver renda líquida
    IF v_family.id = 'eed99680-c00d-4038-ae5f-c23d39a9079c'::uuid THEN
      -- Família atual do usuário (renda 860.000 centavos / R$ 8.600,00)
      -- 50% Essentials (R$ 4.300,00)
      DELETE FROM public.default_budgets WHERE family_id = v_family.id;

      INSERT INTO public.default_budgets (family_id, category_id, amount_cents) VALUES
        (v_family.id, cat_moradia, 172000),       -- 20% = R$ 1.720,00
        (v_family.id, cat_alim_basica, 120400),   -- 14% = R$ 1.204,00
        (v_family.id, cat_transporte, 68800),     -- 8% = R$ 688,00
        (v_family.id, cat_saude, 43000),          -- 5% = R$ 430,00
        (v_family.id, cat_educacao, 25800),       -- 3% = R$ 258,00
        (v_family.id, cat_gastronomia, 86000),    -- 10% = R$ 860,00
        (v_family.id, cat_lazer, 43000),          -- 5% = R$ 430,00
        (v_family.id, cat_cuidados, 43000),       -- 5% = R$ 430,00
        (v_family.id, cat_assinaturas, 25800),    -- 3% = R$ 258,00
        (v_family.id, cat_compras, 34400),        -- 4% = R$ 344,00
        (v_family.id, cat_pets, 25800),           -- 3% = R$ 258,00
        (v_family.id, cat_reserva, 86000),        -- 10% = R$ 860,00
        (v_family.id, cat_metas, 34400),          -- 4% = R$ 344,00
        (v_family.id, cat_investimentos, 51600);  -- 6% = R$ 516,00
    END IF;

  END LOOP;
END $$;
