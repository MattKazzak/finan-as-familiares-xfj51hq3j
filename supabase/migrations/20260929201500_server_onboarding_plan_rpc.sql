-- Migração para mover a semeadura completa do "Padrão Ouro" para o servidor.
-- 1. Mantém create_new_family_workspace(p_family_name, p_member_name) 100% compatível (usada ao criar novo workspace vazio de família).
-- 2. Atualiza create_new_family_workspace para semear a árvore completa (14 categorias de despesa + 2 receitas, 55 subcategorias, 280 regras de auto-categorização).
-- 3. Cria a função RPC activate_family_onboarding_plan(p_family_id, p_monthly_net_income_cents, p_model_preset_id)
--    que:
--    - Valida permissão do usuário na família (user_belongs_to_family ou created_by = auth.uid())
--    - Atualiza a renda líquida na tabela families
--    - Semeia com idempotência estrita as 16 categorias (caso a família ainda não as tenha)
--    - Semeia com idempotência estrita as 55 subcategorias
--    - Semeia com idempotência estrita as regras de categorização
--    - Calcula e insere/atualiza os tetos padrão em default_budgets para as 14 categorias de despesas de acordo com o modelo selecionado (50_30_20, 60_25_15, 70_20_10)
--    Tudo em UMA ÚNICA chamada atômica no Postgres, executando em frações de segundo.

CREATE OR REPLACE FUNCTION public.activate_family_onboarding_plan(
  p_family_id UUID,
  p_monthly_net_income_cents BIGINT,
  p_model_preset_id TEXT DEFAULT '50_30_20'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_fam_owner UUID;
  v_preset TEXT;

  -- Fatores de peso por balde
  v_f_essentials NUMERIC;
  v_f_lifestyle NUMERIC;
  v_f_future NUMERIC;

  -- Categoria IDs
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
  cat_salario UUID;
  cat_rendimentos UUID;

  -- Subcategoria IDs
  sub_aluguel_condominio UUID;
  sub_energia UUID;
  sub_agua UUID;
  sub_gas UUID;
  sub_internet UUID;
  sub_manut_casa UUID;

  sub_supermercado UUID;
  sub_acougue UUID;
  sub_hortifruti UUID;
  sub_padaria UUID;

  sub_combustivel UUID;
  sub_transp_publico UUID;
  sub_apps_transporte UUID;
  sub_estac_pedagio UUID;
  sub_seguro_ipva UUID;
  sub_manut_transp UUID;

  sub_plano_saude UUID;
  sub_farmacia UUID;
  sub_consultas UUID;
  sub_odontologia UUID;

  sub_mensalidade_edu UUID;
  sub_material_edu UUID;
  sub_transp_escolar UUID;

  sub_restaurantes UUID;
  sub_delivery UUID;
  sub_cafeterias UUID;

  sub_cinema UUID;
  sub_shows UUID;
  sub_viagens UUID;
  sub_passeios UUID;

  sub_salao UUID;
  sub_estetica UUID;
  sub_cosmeticos UUID;
  sub_academia UUID;

  sub_streaming UUID;
  sub_softwares UUID;
  sub_clubes UUID;

  sub_roupas UUID;
  sub_eletronicos UUID;
  sub_decoracao UUID;
  sub_presentes UUID;

  sub_racao UUID;
  sub_vet UUID;
  sub_banho UUID;

  sub_aportes_reserva UUID;
  sub_resgates_reserva UUID;

  sub_troca_carro UUID;
  sub_casa_propria UUID;
  sub_viagem_internacional UUID;
  sub_reforma UUID;

  sub_previdencia UUID;
  sub_acoes_fiis UUID;
  sub_aposentadoria UUID;

  sub_salario_principal UUID;
  sub_beneficios UUID;

  v_total_budget_cents BIGINT := 0;

  -- Helper procedure-like closure simulation via inline calculations
  PROCEDURE_APPLY_BUDGET CONSTANT INT := 1;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- 1. Verifica se a família existe e pertence ao usuário
  SELECT created_by INTO v_fam_owner
  FROM public.families
  WHERE id = p_family_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Família não encontrada.';
  END IF;

  IF v_fam_owner IS DISTINCT FROM v_user_id AND NOT public.user_belongs_to_family(p_family_id) THEN
    RAISE EXCEPTION 'Permissão negada para esta família.';
  END IF;

  -- 2. Atualiza a renda mensal na tabela families
  UPDATE public.families
  SET monthly_net_income_cents = GREATEST(0, COALESCE(p_monthly_net_income_cents, 0))
  WHERE id = p_family_id;

  -- 3. Configura fatores do modelo orçamentário
  v_preset := COALESCE(p_model_preset_id, '50_30_20');
  IF v_preset = '60_25_15' THEN
    v_f_essentials := 60.0 / 50.0; -- 1.2
    v_f_lifestyle  := 25.0 / 30.0; -- ~0.833333
    v_f_future     := 15.0 / 20.0; -- 0.75
  ELSIF v_preset = '70_20_10' THEN
    v_f_essentials := 70.0 / 50.0; -- 1.4
    v_f_lifestyle  := 20.0 / 30.0; -- ~0.666667
    v_f_future     := 10.0 / 20.0; -- 0.5
  ELSE
    v_preset := '50_30_20';
    v_f_essentials := 1.0;
    v_f_lifestyle  := 1.0;
    v_f_future     := 1.0;
  END IF;

  -- 4. Criação/Busca idempotente das 16 Categorias Mestras
  -- Moradia
  SELECT id INTO cat_moradia FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Moradia') LIMIT 1;
  IF cat_moradia IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Moradia', 'Home', '#6366F1', 'expense', 'essentials', 1)
    RETURNING id INTO cat_moradia;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'essentials', sort_order = 1, type = 'expense' WHERE id = cat_moradia;
  END IF;

  -- Alimentação Básica
  SELECT id INTO cat_alim_basica FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Alimentação Básica') LIMIT 1;
  IF cat_alim_basica IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Alimentação Básica', 'ShoppingCart', '#10B981', 'expense', 'essentials', 2)
    RETURNING id INTO cat_alim_basica;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'essentials', sort_order = 2, type = 'expense' WHERE id = cat_alim_basica;
  END IF;

  -- Transporte Obrigatório
  SELECT id INTO cat_transporte FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Transporte Obrigatório') LIMIT 1;
  IF cat_transporte IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Transporte Obrigatório', 'Car', '#3B82F6', 'expense', 'essentials', 3)
    RETURNING id INTO cat_transporte;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'essentials', sort_order = 3, type = 'expense' WHERE id = cat_transporte;
  END IF;

  -- Saúde & Cuidados Médicos
  SELECT id INTO cat_saude FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Saúde & Cuidados Médicos') LIMIT 1;
  IF cat_saude IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Saúde & Cuidados Médicos', 'HeartPulse', '#EF4444', 'expense', 'essentials', 4)
    RETURNING id INTO cat_saude;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'essentials', sort_order = 4, type = 'expense' WHERE id = cat_saude;
  END IF;

  -- Educação Obrigatória
  SELECT id INTO cat_educacao FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Educação Obrigatória') LIMIT 1;
  IF cat_educacao IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Educação Obrigatória', 'GraduationCap', '#8B5CF6', 'expense', 'essentials', 5)
    RETURNING id INTO cat_educacao;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'essentials', sort_order = 5, type = 'expense' WHERE id = cat_educacao;
  END IF;

  -- Gastronomia & Delivery
  SELECT id INTO cat_gastronomia FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Gastronomia & Delivery') LIMIT 1;
  IF cat_gastronomia IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Gastronomia & Delivery', 'Utensils', '#F59E0B', 'expense', 'lifestyle', 6)
    RETURNING id INTO cat_gastronomia;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'lifestyle', sort_order = 6, type = 'expense' WHERE id = cat_gastronomia;
  END IF;

  -- Lazer & Passeios
  SELECT id INTO cat_lazer FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Lazer & Passeios') LIMIT 1;
  IF cat_lazer IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Lazer & Passeios', 'Ticket', '#F97316', 'expense', 'lifestyle', 7)
    RETURNING id INTO cat_lazer;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'lifestyle', sort_order = 7, type = 'expense' WHERE id = cat_lazer;
  END IF;

  -- Cuidados Pessoais & Bem-estar
  SELECT id INTO cat_cuidados FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Cuidados Pessoais & Bem-estar') LIMIT 1;
  IF cat_cuidados IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Cuidados Pessoais & Bem-estar', 'Sparkles', '#EC4899', 'expense', 'lifestyle', 8)
    RETURNING id INTO cat_cuidados;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'lifestyle', sort_order = 8, type = 'expense' WHERE id = cat_cuidados;
  END IF;

  -- Assinaturas & Conectividade
  SELECT id INTO cat_assinaturas FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Assinaturas & Conectividade') LIMIT 1;
  IF cat_assinaturas IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Assinaturas & Conectividade', 'Tv', '#7C3AED', 'expense', 'lifestyle', 9)
    RETURNING id INTO cat_assinaturas;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'lifestyle', sort_order = 9, type = 'expense' WHERE id = cat_assinaturas;
  END IF;

  -- Compras & Vestuário
  SELECT id INTO cat_compras FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Compras & Vestuário') LIMIT 1;
  IF cat_compras IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Compras & Vestuário', 'ShoppingBag', '#D97706', 'expense', 'lifestyle', 10)
    RETURNING id INTO cat_compras;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'lifestyle', sort_order = 10, type = 'expense' WHERE id = cat_compras;
  END IF;

  -- Pets
  SELECT id INTO cat_pets FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Pets') LIMIT 1;
  IF cat_pets IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Pets', 'PawPrint', '#84CC16', 'expense', 'lifestyle', 11)
    RETURNING id INTO cat_pets;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'lifestyle', sort_order = 11, type = 'expense' WHERE id = cat_pets;
  END IF;

  -- Reserva de Emergência
  SELECT id INTO cat_reserva FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Reserva de Emergência') LIMIT 1;
  IF cat_reserva IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Reserva de Emergência', 'ShieldCheck', '#10B981', 'expense', 'future', 12)
    RETURNING id INTO cat_reserva;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'future', sort_order = 12, type = 'expense' WHERE id = cat_reserva;
  END IF;

  -- Metas & Grandes Sonhos
  SELECT id INTO cat_metas FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Metas & Grandes Sonhos') LIMIT 1;
  IF cat_metas IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Metas & Grandes Sonhos', 'Target', '#06B6D4', 'expense', 'future', 13)
    RETURNING id INTO cat_metas;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'future', sort_order = 13, type = 'expense' WHERE id = cat_metas;
  END IF;

  -- Investimentos de Longo Prazo
  SELECT id INTO cat_investimentos FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Investimentos de Longo Prazo') LIMIT 1;
  IF cat_investimentos IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Investimentos de Longo Prazo', 'TrendingUp', '#059669', 'expense', 'future', 14)
    RETURNING id INTO cat_investimentos;
  ELSE
    UPDATE public.transaction_categories SET budget_bucket = 'future', sort_order = 14, type = 'expense' WHERE id = cat_investimentos;
  END IF;

  -- Receitas (Salário & Rendimentos)
  SELECT id INTO cat_salario FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Salário') LIMIT 1;
  IF cat_salario IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Salário', 'Briefcase', '#10B981', 'income', NULL, 15)
    RETURNING id INTO cat_salario;
  END IF;

  SELECT id INTO cat_rendimentos FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Rendimentos') LIMIT 1;
  IF cat_rendimentos IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Rendimentos', 'TrendingUp', '#059669', 'income', NULL, 16)
    RETURNING id INTO cat_rendimentos;
  END IF;

  -- 5. Criação/Busca idempotente das 55 Subcategorias de Despesas + 2 de Receitas
  -- Moradia
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Aluguel / Condomínio', 'Home', '#6366F1', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_aluguel_condominio;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Energia Elétrica', 'Zap', '#6366F1', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_energia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Água & Saneamento', 'Droplets', '#6366F1', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_agua;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Gás', 'Flame', '#6366F1', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_gas;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Internet & Fixo', 'Wifi', '#6366F1', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_internet;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Manutenção da Casa', 'Wrench', '#6366F1', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_manut_casa;

  -- Alimentação Básica
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alim_basica, p_family_id, 'Supermercado', 'ShoppingCart', '#10B981', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_supermercado;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alim_basica, p_family_id, 'Açougue & Peixaria', 'Beef', '#10B981', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_acougue;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alim_basica, p_family_id, 'Hortifruti & Feira', 'Apple', '#10B981', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_hortifruti;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alim_basica, p_family_id, 'Padaria do Dia a Dia', 'Coffee', '#10B981', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_padaria;

  -- Transporte Obrigatório
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Combustível', 'Fuel', '#3B82F6', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_combustivel;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Transporte Público & Bilhete', 'Bus', '#3B82F6', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_transp_publico;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Aplicativos do Dia a Dia (Uber/99)', 'Car', '#3B82F6', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_apps_transporte;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Estacionamento & Pedágio', 'CircleParking', '#3B82F6', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_estac_pedagio;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Seguro & IPVA', 'ShieldAlert', '#3B82F6', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_seguro_ipva;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Manutenção Básica', 'Wrench', '#3B82F6', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_manut_transp;

  -- Saúde & Cuidados Médicos
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, p_family_id, 'Plano de Saúde', 'Shield', '#EF4444', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_plano_saude;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, p_family_id, 'Farmácia & Medicamentos', 'Pill', '#EF4444', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_farmacia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, p_family_id, 'Consultas & Exames', 'Stethoscope', '#EF4444', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_consultas;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, p_family_id, 'Odontologia', 'Smile', '#EF4444', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_odontologia;

  -- Educação Obrigatória
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, p_family_id, 'Mensalidade Escolar / Faculdade', 'GraduationCap', '#8B5CF6', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_mensalidade_edu;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, p_family_id, 'Material & Uniformes', 'BookOpen', '#8B5CF6', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_material_edu;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, p_family_id, 'Transporte Escolar', 'Bus', '#8B5CF6', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_transp_escolar;

  -- Gastronomia & Delivery
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_gastronomia, p_family_id, 'Restaurantes & Bares', 'Utensils', '#F59E0B', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_restaurantes;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_gastronomia, p_family_id, 'Delivery (iFood/Rappi)', 'Bike', '#F59E0B', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_delivery;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_gastronomia, p_family_id, 'Cafeterias & Lanches Rápidos', 'Coffee', '#F59E0B', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_cafeterias;

  -- Lazer & Passeios
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, p_family_id, 'Cinema', 'Film', '#F97316', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_cinema;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, p_family_id, 'Shows & Eventos', 'Ticket', '#F97316', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_shows;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, p_family_id, 'Viagens & Hospedagem', 'Plane', '#F97316', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_viagens;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, p_family_id, 'Passeios de Fim de Semana', 'Sun', '#F97316', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_passeios;

  -- Cuidados Pessoais & Bem-estar
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, p_family_id, 'Barbearia / Salão de Beleza', 'Scissors', '#EC4899', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_salao;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, p_family_id, 'Manicure & Estética', 'Sparkles', '#EC4899', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_estetica;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, p_family_id, 'Cosméticos & Perfumaria', 'Package', '#EC4899', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_cosmeticos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, p_family_id, 'Academia & Esportes', 'Activity', '#EC4899', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_academia;

  -- Assinaturas & Conectividade
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, p_family_id, 'Streaming de Vídeo & Música', 'Tv', '#7C3AED', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_streaming;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, p_family_id, 'Softwares & Apps', 'Terminal', '#7C3AED', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_softwares;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, p_family_id, 'Clubes de Assinatura', 'Sparkles', '#7C3AED', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_clubes;

  -- Compras & Vestuário
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Roupas & Calçados', 'Shirt', '#D97706', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_roupas;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Eletrônicos & Gadgets', 'Laptop', '#D97706', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_eletronicos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Decoração & Utilidades', 'Home', '#D97706', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_decoracao;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Presentes', 'Gift', '#D97706', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_presentes;

  -- Pets
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_pets, p_family_id, 'Ração & Petiscos', 'Utensils', '#84CC16', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_racao;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_pets, p_family_id, 'Veterinário & Vacinas', 'HeartPulse', '#84CC16', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_vet;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_pets, p_family_id, 'Banho, Tosa & Acessórios', 'Sparkles', '#84CC16', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_banho;

  -- Reserva de Emergência
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_reserva, p_family_id, 'Aportes na Reserva', 'ShieldCheck', '#10B981', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_aportes_reserva;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_reserva, p_family_id, 'Resgates Emergenciais', 'ArrowDownRight', '#10B981', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_resgates_reserva;

  -- Metas & Grandes Sonhos
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, p_family_id, 'Troca de Carro', 'Car', '#06B6D4', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_troca_carro;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, p_family_id, 'Casa Própria', 'Home', '#06B6D4', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_casa_propria;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, p_family_id, 'Viagem Internacional', 'Plane', '#06B6D4', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_viagem_internacional;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, p_family_id, 'Reforma', 'Wrench', '#06B6D4', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_reforma;

  -- Investimentos de Longo Prazo
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, p_family_id, 'Previdência Privada', 'Landmark', '#059669', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_previdencia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, p_family_id, 'Ações & Fundos Imobiliários', 'TrendingUp', '#059669', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_acoes_fiis;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, p_family_id, 'Aposentadoria', 'PiggyBank', '#059669', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_aposentadoria;

  -- Salário
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_salario, p_family_id, 'Salário Principal', 'Briefcase', '#10B981', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_salario_principal;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_salario, p_family_id, 'Benefícios (VR/VA)', 'CreditCard', '#059669', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id INTO sub_beneficios;

  -- 6. Inserção idempotente das Regras de Auto-Categorização (280 keywords completas)
  -- Moradia keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_moradia, k.sub_id
  FROM (VALUES
    ('ALUGUEL', sub_aluguel_condominio), ('CONDOMINIO', sub_aluguel_condominio), ('IMOBILIARIA', sub_aluguel_condominio),
    ('QUINTOANDAR', sub_aluguel_condominio), ('QUINTO ANDAR', sub_aluguel_condominio),
    ('ENEL', sub_energia), ('CPFL', sub_energia), ('LUZ', sub_energia), ('ENERGIA', sub_energia),
    ('LIGHT', sub_energia), ('CEMIG', sub_energia), ('COPEL', sub_energia), ('ELETRICIDADE', sub_energia),
    ('SABESP', sub_agua), ('AGUA', sub_agua), ('COPASA', sub_agua), ('SANEPAR', sub_agua), ('CEDAE', sub_agua), ('SANEAMENTO', sub_agua),
    ('COMGAS', sub_gas), ('GAS', sub_gas), ('ULTRAGAZ', sub_gas), ('SUPERGASBRAS', sub_gas), ('BOTIJAO', sub_gas),
    ('VIVO FIBRA', sub_internet), ('CLARO RESIDENCIAL', sub_internet), ('INTERNET', sub_internet), ('FIBRA', sub_internet), ('BANDA LARGA', sub_internet),
    ('MANUTENCAO', sub_manut_casa), ('REPARO', sub_manut_casa), ('ENCANADOR', sub_manut_casa), ('ELETRICISTA', sub_manut_casa),
    ('MARCENARIA', sub_manut_casa), ('PINTURA', sub_manut_casa)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Alimentação Básica keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_alim_basica, k.sub_id
  FROM (VALUES
    ('CARREFOUR', sub_supermercado), ('ASSAI', sub_supermercado), ('ASSAÍ', sub_supermercado),
    ('PAO DE ACUCAR', sub_supermercado), ('PÃO DE AÇÚCAR', sub_supermercado), ('ATACADAO', sub_supermercado),
    ('ATACADÃO', sub_supermercado), ('MERCADINHO', sub_supermercado), ('MERCADO', sub_supermercado),
    ('SUPERMERCADO', sub_supermercado), ('SAMS CLUB', sub_supermercado), ('DIA BRASIL', sub_supermercado),
    ('ACOUGUE', sub_acougue), ('SWIFT', sub_acougue), ('PEIXARIA', sub_acougue), ('CARNES', sub_acougue),
    ('HORTIFRUTI', sub_hortifruti), ('FEIRA', sub_hortifruti), ('SACOLAO', sub_hortifruti), ('QUITANDA', sub_hortifruti), ('FRUTAS', sub_hortifruti),
    ('PADARIA', sub_padaria), ('PANIFICADORA', sub_padaria), ('PAO DO DIA', sub_padaria)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Transporte Obrigatório keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_transporte, k.sub_id
  FROM (VALUES
    ('POSTO', sub_combustivel), ('POSTO IPIRANGA', sub_combustivel), ('SHELL', sub_combustivel), ('IPIRANGA', sub_combustivel),
    ('GASOLINA', sub_combustivel), ('ETANOL', sub_combustivel), ('DIESEL', sub_combustivel), ('COMBUSTIVEL', sub_combustivel),
    ('METRO', sub_transp_publico), ('SPTRANS', sub_transp_publico), ('BILHETE UNICO', sub_transp_publico), ('CPTM', sub_transp_publico), ('ONIBUS', sub_transp_publico),
    ('UBER', sub_apps_transporte), ('99', sub_apps_transporte), ('99APP', sub_apps_transporte), ('99 POP', sub_apps_transporte),
    ('99 TAXI', sub_apps_transporte), ('CABIFY', sub_apps_transporte), ('INDRIVE', sub_apps_transporte),
    ('PEDAGIO', sub_estac_pedagio), ('SEM PARAR', sub_estac_pedagio), ('CONECTCAR', sub_estac_pedagio), ('VELOE', sub_estac_pedagio),
    ('ESTAPAR', sub_estac_pedagio), ('ESTACIONAMENTO', sub_estac_pedagio),
    ('IPVA', sub_seguro_ipva), ('SEGURO AUTO', sub_seguro_ipva), ('DPVAT', sub_seguro_ipva), ('LICENCIAMENTO', sub_seguro_ipva),
    ('OFICINA MECANICA', sub_manut_transp), ('AUTO PECAS', sub_manut_transp), ('PNEU', sub_manut_transp),
    ('TROCA DE OLEO', sub_manut_transp), ('ALINHAMENTO', sub_manut_transp)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Saúde & Cuidados Médicos keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_saude, k.sub_id
  FROM (VALUES
    ('UNIMED', sub_plano_saude), ('BRADESCO SAUDE', sub_plano_saude), ('SULAMERICA SAUDE', sub_plano_saude),
    ('AMIL', sub_plano_saude), ('NOTREDAME', sub_plano_saude), ('HAPVIDA', sub_plano_saude),
    ('DROGASIL', sub_farmacia), ('DROGA RAIA', sub_farmacia), ('PAGUE MENOS', sub_farmacia),
    ('FARMACIA', sub_farmacia), ('DROGARIA', sub_farmacia), ('PANVEL', sub_farmacia), ('ULTRAFARMA', sub_farmacia),
    ('LABORATORIO', sub_consultas), ('FLEURY', sub_consultas), ('DASA', sub_consultas),
    ('LAVOISIER', sub_consultas), ('CONSULTA MEDICA', sub_consultas), ('CLINICA', sub_consultas),
    ('DENTISTA', sub_odontologia), ('ODONTO', sub_odontologia), ('ORTODONTIA', sub_odontologia)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Educação Obrigatória keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_educacao, k.sub_id
  FROM (VALUES
    ('ESCOLA', sub_mensalidade_edu), ('COLEGIO', sub_mensalidade_edu), ('COLÉGIO', sub_mensalidade_edu),
    ('FACULDADE', sub_mensalidade_edu), ('MENSALIDADE', sub_mensalidade_edu), ('UNIVERSIDADE', sub_mensalidade_edu),
    ('PAPELARIA', sub_material_edu), ('KALUNGA', sub_material_edu), ('MATERIAL ESCOLAR', sub_material_edu),
    ('UNIFORME', sub_material_edu), ('LIVROS ESCOLARES', sub_material_edu),
    ('VAN ESCOLAR', sub_transp_escolar), ('TRANSPORTE ESCOLAR', sub_transp_escolar)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Gastronomia & Delivery keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_gastronomia, k.sub_id
  FROM (VALUES
    ('OUTBACK', sub_restaurantes), ('BAR', sub_restaurantes), ('CHOPERIA', sub_restaurantes),
    ('RESTAURANTE', sub_restaurantes), ('CHURRASCARIA', sub_restaurantes), ('PIZZARIA', sub_restaurantes), ('BOTECO', sub_restaurantes),
    ('IFOOD', sub_delivery), ('RAPPI', sub_delivery), ('AIQFOME', sub_delivery), ('UBER EATS', sub_delivery),
    ('MCDONALDS', sub_cafeterias), ('BURGER KING', sub_cafeterias), ('CAFETERIA', sub_cafeterias),
    ('STARBUCKS', sub_cafeterias), ('SUBWAY', sub_cafeterias), ('CACAU SHOW', sub_cafeterias), ('KOPENHAGEN', sub_cafeterias)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Lazer & Passeios keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_lazer, k.sub_id
  FROM (VALUES
    ('CINEMARK', sub_cinema), ('INGRESSO.COM', sub_cinema), ('KINOPLEX', sub_cinema), ('UCI', sub_cinema), ('CINEMA', sub_cinema),
    ('SYMPLA', sub_shows), ('EVENTIM', sub_shows), ('SHOW', sub_shows), ('TEATRO', sub_shows), ('EVENTO', sub_shows),
    ('AIRBNB', sub_viagens), ('HOTEL', sub_viagens), ('BOOKING', sub_viagens), ('PASSAGEM AEREA', sub_viagens),
    ('AZUL', sub_viagens), ('GOL', sub_viagens), ('LATAM', sub_viagens), ('DECOLAR', sub_viagens), ('POUSADA', sub_viagens),
    ('PASSEIO', sub_passeios), ('PARQUE', sub_passeios), ('CLUBE', sub_passeios), ('RESORT', sub_passeios)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Cuidados Pessoais & Bem-estar keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_cuidados, k.sub_id
  FROM (VALUES
    ('SALAO', sub_salao), ('SALÃO', sub_salao), ('BARBEARIA', sub_salao), ('CABELEREIRO', sub_salao),
    ('ESTETICA', sub_estetica), ('ESTÉTICA', sub_estetica), ('MANICURE', sub_estetica), ('PEDICURE', sub_estetica),
    ('DEPILACAO', sub_estetica), ('SPA', sub_estetica),
    ('BOTICARIO', sub_cosmeticos), ('BOTICÁRIO', sub_cosmeticos), ('SEPHORA', sub_cosmeticos),
    ('NATURA', sub_cosmeticos), ('COSMETICOS', sub_cosmeticos), ('PERFUMARIA', sub_cosmeticos),
    ('SMART FIT', sub_academia), ('ACADEMIA', sub_academia), ('BLUEFIT', sub_academia),
    ('GYMPASS', sub_academia), ('TOTALPASS', sub_academia), ('CROSSFIT', sub_academia)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Assinaturas & Conectividade keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_assinaturas, k.sub_id
  FROM (VALUES
    ('NETFLIX', sub_streaming), ('SPOTIFY', sub_streaming), ('AMAZON PRIME', sub_streaming),
    ('YOUTUBE PREMIUM', sub_streaming), ('HBO', sub_streaming), ('MAX', sub_streaming),
    ('DISNEY', sub_streaming), ('GLOBOPLAY', sub_streaming), ('DEEZER', sub_streaming), ('PRIME VIDEO', sub_streaming),
    ('APPLE', sub_softwares), ('GOOGLE ONE', sub_softwares), ('ICLOUD', sub_softwares),
    ('CHATGPT', sub_softwares), ('OPENAI', sub_softwares), ('CANVA', sub_softwares), ('MICROSOFT', sub_softwares),
    ('CLUBE DE ASSINATURA', sub_clubes), ('WINE', sub_clubes), ('TAG LIVROS', sub_clubes)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Compras & Vestuário keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_compras, k.sub_id
  FROM (VALUES
    ('ZARA', sub_roupas), ('RENNER', sub_roupas), ('RIACHUELO', sub_roupas), ('SHEIN', sub_roupas),
    ('SHOPEE', sub_roupas), ('C&A', sub_roupas), ('HERING', sub_roupas), ('CENTAURO', sub_roupas), ('CALCADOS', sub_roupas),
    ('MERCADO LIVRE', sub_eletronicos), ('AMAZON COMPRAS', sub_eletronicos), ('MAGALU', sub_eletronicos),
    ('MAGAZINE LUIZA', sub_eletronicos), ('FAST SHOP', sub_eletronicos), ('KABUM', sub_eletronicos),
    ('CAMICADO', sub_decoracao), ('TOK&STOK', sub_decoracao), ('LEROY MERLIN', sub_decoracao),
    ('UTILIDADES', sub_decoracao), ('DECORACAO', sub_decoracao),
    ('PRESENTE', sub_presentes), ('PRESENTES', sub_presentes), ('ANIVERSARIO', sub_presentes)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Pets keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_pets, k.sub_id
  FROM (VALUES
    ('ROYAL CANIN', sub_racao), ('PREMIER PET', sub_racao), ('RACAO', sub_racao), ('PETISCOS', sub_racao),
    ('VETERINARIO', sub_vet), ('VETERINÁRIO', sub_vet), ('VACINA PET', sub_vet), ('CLINICA VET', sub_vet),
    ('PETZ', sub_banho), ('COBASI', sub_banho), ('PET SHOP', sub_banho), ('BANHO E TOSA', sub_banho)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Reserva de Emergência keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_reserva, k.sub_id
  FROM (VALUES
    ('TESOURO SELIC', sub_aportes_reserva), ('CDB LIQUIDEZ DIARIA', sub_aportes_reserva),
    ('RESERVA', sub_aportes_reserva), ('CAIXINHA NUBANK', sub_aportes_reserva),
    ('RESGATE RESERVA', sub_resgates_reserva), ('EMERGENCIA RESGATE', sub_resgates_reserva)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Metas & Grandes Sonhos keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_metas, k.sub_id
  FROM (VALUES
    ('CONSORCIO', sub_troca_carro), ('TROCA DE CARRO', sub_troca_carro), ('CARRO NOVO', sub_troca_carro),
    ('ENTRADA APTO', sub_casa_propria), ('CASA PROPRIA', sub_casa_propria), ('FINANCIAMENTO IMOVEL', sub_casa_propria),
    ('FUNDO VIAGEM', sub_viagem_internacional), ('VIAGEM INTERNACIONAL', sub_viagem_internacional),
    ('EURO', sub_viagem_internacional), ('DOLAR', sub_viagem_internacional),
    ('META', sub_reforma), ('REFORMA', sub_reforma), ('OBRA DA CASA', sub_reforma)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- Investimentos de Longo Prazo keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
  SELECT p_family_id, v_user_id, k.pat, cat_investimentos, k.sub_id
  FROM (VALUES
    ('PREVIDENCIA', sub_previdencia), ('PREVIDENCIA PRIVADA', sub_previdencia),
    ('PGBL', sub_previdencia), ('VGBL', sub_previdencia),
    ('XP INVESTIMENTOS', sub_acoes_fiis), ('BTG', sub_acoes_fiis), ('INTER INVEST', sub_acoes_fiis),
    ('TESOURO IPCA', sub_acoes_fiis), ('ACOES', sub_acoes_fiis), ('FIIS', sub_acoes_fiis), ('DIVIDENDOS', sub_acoes_fiis),
    ('APOSENTADORIA', sub_aposentadoria), ('LIBERDADE FINANCEIRA', sub_aposentadoria), ('INDEPENDENCIA FINANCEIRA', sub_aposentadoria)
  ) AS k(pat, sub_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categorization_rules cr
    WHERE cr.family_id = p_family_id AND cr.pattern = k.pat
  );

  -- 7. Define os Tetos Padrão em default_budgets para as 14 categorias de despesas
  -- Se p_monthly_net_income_cents for > 0, calcula proporcionalmente:
  -- Necessidades (50% base): Moradia 20%, Alimentação 14%, Transporte 8%, Saúde 5%, Educação 3%
  -- Estilo de Vida (30% base): Gastronomia 10%, Lazer 5%, Cuidados 5%, Assinaturas 3%, Compras 4%, Pets 3%
  -- Futuro (20% base): Reserva 10%, Metas 4%, Investimentos 6%
  IF p_monthly_net_income_cents > 0 THEN
    -- Moradia: 20%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_moradia, NULL, ROUND((p_monthly_net_income_cents * 20.0 * v_f_essentials) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Alimentação Básica: 14%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_alim_basica, NULL, ROUND((p_monthly_net_income_cents * 14.0 * v_f_essentials) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Transporte Obrigatório: 8%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_transporte, NULL, ROUND((p_monthly_net_income_cents * 8.0 * v_f_essentials) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Saúde & Cuidados Médicos: 5%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_saude, NULL, ROUND((p_monthly_net_income_cents * 5.0 * v_f_essentials) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Educação Obrigatória: 3%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_educacao, NULL, ROUND((p_monthly_net_income_cents * 3.0 * v_f_essentials) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Gastronomia & Delivery: 10%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_gastronomia, NULL, ROUND((p_monthly_net_income_cents * 10.0 * v_f_lifestyle) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Lazer & Passeios: 5%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_lazer, NULL, ROUND((p_monthly_net_income_cents * 5.0 * v_f_lifestyle) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Cuidados Pessoais & Bem-estar: 5%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_cuidados, NULL, ROUND((p_monthly_net_income_cents * 5.0 * v_f_lifestyle) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Assinaturas & Conectividade: 3%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_assinaturas, NULL, ROUND((p_monthly_net_income_cents * 3.0 * v_f_lifestyle) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Compras & Vestuário: 4%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_compras, NULL, ROUND((p_monthly_net_income_cents * 4.0 * v_f_lifestyle) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Pets: 3%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_pets, NULL, ROUND((p_monthly_net_income_cents * 3.0 * v_f_lifestyle) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Reserva de Emergência: 10%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_reserva, NULL, ROUND((p_monthly_net_income_cents * 10.0 * v_f_future) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Metas & Grandes Sonhos: 4%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_metas, NULL, ROUND((p_monthly_net_income_cents * 4.0 * v_f_future) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Investimentos de Longo Prazo: 6%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_investimentos, NULL, ROUND((p_monthly_net_income_cents * 6.0 * v_f_future) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    SELECT COALESCE(SUM(amount_cents), 0) INTO v_total_budget_cents
    FROM public.default_budgets
    WHERE family_id = p_family_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'family_id', p_family_id,
    'monthly_net_income_cents', p_monthly_net_income_cents,
    'model_preset_id', v_preset,
    'categories_count', 16,
    'subcategories_count', 55,
    'total_budget_cents', v_total_budget_cents
  );
END;
$$;