-- Migração: Atualização canônica de activate_family_onboarding_plan com catálogo 19/116 completo e regras de auto-categorização
-- Substitui a taxonomia legada (16/55) pela taxonomia canônica oficial Curiangoo (19 categorias / 116 subcategorias)
-- e inclui a semeadura das regras de auto-categorização (categorization_rules) condizentes com o dicionário de onboarding/brazilian-seeds.

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

  -- Categoria IDs (19 categorias)
  cat_moradia UUID;
  cat_alimentacao UUID;
  cat_transporte UUID;
  cat_saude UUID;
  cat_educacao UUID;
  cat_dividas UUID;
  cat_restaurantes UUID;
  cat_lazer UUID;
  cat_cuidados UUID;
  cat_assinaturas UUID;
  cat_compras UUID;
  cat_pets UUID;
  cat_reserva UUID;
  cat_metas UUID;
  cat_investimentos UUID;
  cat_salario UUID;
  cat_trab_extras UUID;
  cat_outras_rec UUID;
  cat_rendimentos UUID;

  -- Subcategoria IDs necessárias para amarração de regras
  sub_aluguel_condominio UUID;
  sub_energia UUID;
  sub_agua UUID;
  sub_gas UUID;
  sub_internet UUID;
  sub_celular UUID;
  sub_iptu UUID;
  sub_manut_casa UUID;
  sub_servicos_domesticos UUID;
  sub_mudanca UUID;

  sub_supermercado UUID;
  sub_acougue UUID;
  sub_hortifruti UUID;
  sub_padaria UUID;
  sub_agua_bebidas UUID;
  sub_limpeza_higiene UUID;

  sub_combustivel UUID;
  sub_transp_publico UUID;
  sub_apps_transporte UUID;
  sub_estac_pedagio UUID;
  sub_oficina UUID;
  sub_ipva UUID;
  sub_seguro_auto UUID;

  sub_plano_saude UUID;
  sub_coparticipacao UUID;
  sub_consultas UUID;
  sub_farmacia UUID;
  sub_odontologia UUID;
  sub_terapias UUID;
  sub_oculos UUID;

  sub_escola UUID;
  sub_faculdade UUID;
  sub_cursos UUID;
  sub_material_edu UUID;
  sub_uniformes UUID;
  sub_transp_escolar UUID;

  sub_fatura_cartao UUID;
  sub_emp_pessoais UUID;
  sub_fin_imob UUID;
  sub_fin_veic UUID;
  sub_cheque_especial UUID;
  sub_renegociacoes UUID;
  sub_juros_multas UUID;

  sub_restaurantes UUID;
  sub_delivery UUID;
  sub_fast_food UUID;
  sub_cafeterias UUID;
  sub_sorvete UUID;
  sub_conveniencia UUID;
  sub_marmitas UUID;

  sub_cinema UUID;
  sub_shows UUID;
  sub_passeios UUID;
  sub_viagens_passagens UUID;
  sub_viagens_pacotes UUID;
  sub_hobbies UUID;
  sub_livros UUID;

  sub_salao UUID;
  sub_estetica UUID;
  sub_cosmeticos UUID;
  sub_academia UUID;
  sub_spa UUID;

  sub_streaming_video UUID;
  sub_musica UUID;
  sub_softwares UUID;
  sub_jogos UUID;
  sub_jornais UUID;
  sub_nuvem UUID;
  sub_clubes UUID;

  sub_roupas UUID;
  sub_calcados UUID;
  sub_eletronicos UUID;
  sub_eletrodomesticos UUID;
  sub_moveis UUID;
  sub_utilidades UUID;
  sub_presentes UUID;
  sub_bebes UUID;

  sub_racao UUID;
  sub_vet UUID;
  sub_banho UUID;

  sub_aportes_reserva UUID;
  sub_resgates_reserva UUID;

  sub_troca_carro UUID;
  sub_casa_propria UUID;
  sub_viagem_internacional UUID;
  sub_reforma UUID;
  sub_educacao_futura UUID;
  sub_meta_livre UUID;

  sub_tesouro UUID;
  sub_renda_fixa UUID;
  sub_acoes UUID;
  sub_fiis UUID;
  sub_cripto UUID;
  sub_previdencia UUID;
  sub_aposentadoria UUID;

  sub_salario_principal UUID;
  sub_salario_13 UUID;
  sub_bonus UUID;
  sub_horas_extras UUID;
  sub_beneficios UUID;

  sub_freelances UUID;
  sub_venda_produtos UUID;
  sub_mei UUID;
  sub_comissoes UUID;
  sub_cursos_aulas UUID;
  sub_infoprodutos UUID;

  sub_reembolsos UUID;
  sub_cashback UUID;
  sub_presentes_rec UUID;
  sub_vendas_usados UUID;
  sub_restituicao_ir UUID;

  sub_juros_aplicacoes UUID;
  sub_dividendos UUID;
  sub_aluguel_rec UUID;
  sub_aposentadoria_rec UUID;

  v_total_budget_cents BIGINT := 0;
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

  -- 2. Configura fatores do modelo orçamentário
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

  -- 3. Atualiza a renda mensal e o budget_model na tabela families
  UPDATE public.families
  SET monthly_net_income_cents = GREATEST(0, COALESCE(p_monthly_net_income_cents, 0)),
      budget_model = v_preset
  WHERE id = p_family_id;

  -- 4. Criação/Busca idempotente das 19 Categorias Mestras Canônicas
  -- 1. Moradia (essentials, sort_order 1)
  SELECT id INTO cat_moradia FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Moradia') LIMIT 1;
  IF cat_moradia IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Moradia', 'Home', '#6366F1', 'expense', 'essentials', 1)
    RETURNING id INTO cat_moradia;
  ELSE
    UPDATE public.transaction_categories SET icon = 'Home', color = '#6366F1', budget_bucket = 'essentials', sort_order = 1, type = 'expense' WHERE id = cat_moradia;
  END IF;

  -- 2. Alimentação (essentials, sort_order 2)
  SELECT id INTO cat_alimentacao FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Alimentação') LIMIT 1;
  IF cat_alimentacao IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Alimentação', 'ShoppingCart', '#10B981', 'expense', 'essentials', 2)
    RETURNING id INTO cat_alimentacao;
  ELSE
    UPDATE public.transaction_categories SET icon = 'ShoppingCart', color = '#10B981', budget_bucket = 'essentials', sort_order = 2, type = 'expense' WHERE id = cat_alimentacao;
  END IF;

  -- 3. Transporte (essentials, sort_order 3)
  SELECT id INTO cat_transporte FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Transporte') LIMIT 1;
  IF cat_transporte IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Transporte', 'Car', '#3B82F6', 'expense', 'essentials', 3)
    RETURNING id INTO cat_transporte;
  ELSE
    UPDATE public.transaction_categories SET icon = 'Car', color = '#3B82F6', budget_bucket = 'essentials', sort_order = 3, type = 'expense' WHERE id = cat_transporte;
  END IF;

  -- 4. Saúde (essentials, sort_order 4)
  SELECT id INTO cat_saude FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Saúde') LIMIT 1;
  IF cat_saude IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Saúde', 'HeartPulse', '#EF4444', 'expense', 'essentials', 4)
    RETURNING id INTO cat_saude;
  ELSE
    UPDATE public.transaction_categories SET icon = 'HeartPulse', color = '#EF4444', budget_bucket = 'essentials', sort_order = 4, type = 'expense' WHERE id = cat_saude;
  END IF;

  -- 5. Educação (essentials, sort_order 5)
  SELECT id INTO cat_educacao FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Educação') LIMIT 1;
  IF cat_educacao IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Educação', 'GraduationCap', '#8B5CF6', 'expense', 'essentials', 5)
    RETURNING id INTO cat_educacao;
  ELSE
    UPDATE public.transaction_categories SET icon = 'GraduationCap', color = '#8B5CF6', budget_bucket = 'essentials', sort_order = 5, type = 'expense' WHERE id = cat_educacao;
  END IF;

  -- 6. Dívidas & Empréstimos (essentials, sort_order 6)
  SELECT id INTO cat_dividas FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Dívidas & Empréstimos') LIMIT 1;
  IF cat_dividas IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Dívidas & Empréstimos', 'CreditCard', '#DC2626', 'expense', 'essentials', 6)
    RETURNING id INTO cat_dividas;
  ELSE
    UPDATE public.transaction_categories SET icon = 'CreditCard', color = '#DC2626', budget_bucket = 'essentials', sort_order = 6, type = 'expense' WHERE id = cat_dividas;
  END IF;

  -- 7. Restaurantes & Delivery (lifestyle, sort_order 7)
  SELECT id INTO cat_restaurantes FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Restaurantes & Delivery') LIMIT 1;
  IF cat_restaurantes IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Restaurantes & Delivery', 'Utensils', '#F59E0B', 'expense', 'lifestyle', 7)
    RETURNING id INTO cat_restaurantes;
  ELSE
    UPDATE public.transaction_categories SET icon = 'Utensils', color = '#F59E0B', budget_bucket = 'lifestyle', sort_order = 7, type = 'expense' WHERE id = cat_restaurantes;
  END IF;

  -- 8. Lazer (lifestyle, sort_order 8)
  SELECT id INTO cat_lazer FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Lazer') LIMIT 1;
  IF cat_lazer IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Lazer', 'Ticket', '#F97316', 'expense', 'lifestyle', 8)
    RETURNING id INTO cat_lazer;
  ELSE
    UPDATE public.transaction_categories SET icon = 'Ticket', color = '#F97316', budget_bucket = 'lifestyle', sort_order = 8, type = 'expense' WHERE id = cat_lazer;
  END IF;

  -- 9. Cuidados Pessoais & Bem-estar (lifestyle, sort_order 9)
  SELECT id INTO cat_cuidados FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Cuidados Pessoais & Bem-estar') LIMIT 1;
  IF cat_cuidados IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Cuidados Pessoais & Bem-estar', 'Sparkles', '#EC4899', 'expense', 'lifestyle', 9)
    RETURNING id INTO cat_cuidados;
  ELSE
    UPDATE public.transaction_categories SET icon = 'Sparkles', color = '#EC4899', budget_bucket = 'lifestyle', sort_order = 9, type = 'expense' WHERE id = cat_cuidados;
  END IF;

  -- 10. Assinaturas & Apps (lifestyle, sort_order 10)
  SELECT id INTO cat_assinaturas FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Assinaturas & Apps') LIMIT 1;
  IF cat_assinaturas IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Assinaturas & Apps', 'Tv', '#7C3AED', 'expense', 'lifestyle', 10)
    RETURNING id INTO cat_assinaturas;
  ELSE
    UPDATE public.transaction_categories SET icon = 'Tv', color = '#7C3AED', budget_bucket = 'lifestyle', sort_order = 10, type = 'expense' WHERE id = cat_assinaturas;
  END IF;

  -- 11. Compras (lifestyle, sort_order 11)
  SELECT id INTO cat_compras FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Compras') LIMIT 1;
  IF cat_compras IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Compras', 'ShoppingBag', '#D97706', 'expense', 'lifestyle', 11)
    RETURNING id INTO cat_compras;
  ELSE
    UPDATE public.transaction_categories SET icon = 'ShoppingBag', color = '#D97706', budget_bucket = 'lifestyle', sort_order = 11, type = 'expense' WHERE id = cat_compras;
  END IF;

  -- 12. Pets (lifestyle, sort_order 12)
  SELECT id INTO cat_pets FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Pets') LIMIT 1;
  IF cat_pets IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Pets', 'PawPrint', '#84CC16', 'expense', 'lifestyle', 12)
    RETURNING id INTO cat_pets;
  ELSE
    UPDATE public.transaction_categories SET icon = 'PawPrint', color = '#84CC16', budget_bucket = 'lifestyle', sort_order = 12, type = 'expense' WHERE id = cat_pets;
  END IF;

  -- 13. Reserva de Emergência (future, sort_order 13)
  SELECT id INTO cat_reserva FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Reserva de Emergência') LIMIT 1;
  IF cat_reserva IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Reserva de Emergência', 'ShieldCheck', '#10B981', 'expense', 'future', 13)
    RETURNING id INTO cat_reserva;
  ELSE
    UPDATE public.transaction_categories SET icon = 'ShieldCheck', color = '#10B981', budget_bucket = 'future', sort_order = 13, type = 'expense' WHERE id = cat_reserva;
  END IF;

  -- 14. Metas (future, sort_order 14)
  SELECT id INTO cat_metas FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Metas') LIMIT 1;
  IF cat_metas IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Metas', 'Target', '#06B6D4', 'expense', 'future', 14)
    RETURNING id INTO cat_metas;
  ELSE
    UPDATE public.transaction_categories SET icon = 'Target', color = '#06B6D4', budget_bucket = 'future', sort_order = 14, type = 'expense' WHERE id = cat_metas;
  END IF;

  -- 15. Investimentos (future, sort_order 15)
  SELECT id INTO cat_investimentos FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Investimentos') LIMIT 1;
  IF cat_investimentos IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Investimentos', 'TrendingUp', '#059669', 'expense', 'future', 15)
    RETURNING id INTO cat_investimentos;
  ELSE
    UPDATE public.transaction_categories SET icon = 'TrendingUp', color = '#059669', budget_bucket = 'future', sort_order = 15, type = 'expense' WHERE id = cat_investimentos;
  END IF;

  -- 16. Salário (income, sort_order 16)
  SELECT id INTO cat_salario FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Salário') LIMIT 1;
  IF cat_salario IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Salário', 'Briefcase', '#10B981', 'income', NULL, 16)
    RETURNING id INTO cat_salario;
  ELSE
    UPDATE public.transaction_categories SET icon = 'Briefcase', color = '#10B981', budget_bucket = NULL, sort_order = 16, type = 'income' WHERE id = cat_salario;
  END IF;

  -- 17. Rendimentos (income, sort_order 17)
  SELECT id INTO cat_rendimentos FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Rendimentos') LIMIT 1;
  IF cat_rendimentos IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Rendimentos', 'TrendingUp', '#059669', 'income', NULL, 17)
    RETURNING id INTO cat_rendimentos;
  ELSE
    UPDATE public.transaction_categories SET icon = 'TrendingUp', color = '#059669', budget_bucket = NULL, sort_order = 17, type = 'income' WHERE id = cat_rendimentos;
  END IF;

  -- 18. Trabalhos Extras & Autônomo (income, sort_order 18)
  SELECT id INTO cat_trab_extras FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Trabalhos Extras & Autônomo') LIMIT 1;
  IF cat_trab_extras IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Trabalhos Extras & Autônomo', 'Hammer', '#0EA5E9', 'income', NULL, 18)
    RETURNING id INTO cat_trab_extras;
  ELSE
    UPDATE public.transaction_categories SET icon = 'Hammer', color = '#0EA5E9', budget_bucket = NULL, sort_order = 18, type = 'income' WHERE id = cat_trab_extras;
  END IF;

  -- 19. Outras Receitas (income, sort_order 19)
  SELECT id INTO cat_outras_rec FROM public.transaction_categories WHERE family_id = p_family_id AND LOWER(TRIM(name)) = LOWER('Outras Receitas') LIMIT 1;
  IF cat_outras_rec IS NULL THEN
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
    VALUES (p_family_id, 'Outras Receitas', 'Undo2', '#64748B', 'income', NULL, 19)
    RETURNING id INTO cat_outras_rec;
  ELSE
    UPDATE public.transaction_categories SET icon = 'Undo2', color = '#64748B', budget_bucket = NULL, sort_order = 19, type = 'income' WHERE id = cat_outras_rec;
  END IF;

  -- 5. Criação/Busca idempotente das 116 Subcategorias Canônicas
  -- =========================================================================
  -- 1. MORADIA (11 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Aluguel & Condomínio', 'Home', '#6366F1', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_aluguel_condominio;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Energia Elétrica', 'Zap', '#6366F1', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_energia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Água & Saneamento', 'Droplets', '#6366F1', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_agua;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Gás', 'Flame', '#6366F1', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_gas;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Internet & Fixo', 'Wifi', '#6366F1', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_internet;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Celular & Telefonia', 'Smartphone', '#6366F1', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_celular;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'IPTU & Taxas do Imóvel', 'Landmark', '#6366F1', 7)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_iptu;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Seguro Residencial', 'Shield', '#6366F1', 8)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_manut_casa;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Manutenção & Reparos', 'Wrench', '#6366F1', 9)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_manut_casa;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Serviços Domésticos', 'Sparkles', '#6366F1', 10)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_servicos_domesticos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, p_family_id, 'Mudança', 'Truck', '#6366F1', 11)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_mudanca;

  -- =========================================================================
  -- 2. ALIMENTAÇÃO (6 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alimentacao, p_family_id, 'Supermercado & Atacado', 'ShoppingCart', '#10B981', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_supermercado;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alimentacao, p_family_id, 'Açougue & Peixaria', 'Beef', '#10B981', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_acougue;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alimentacao, p_family_id, 'Hortifruti & Feira', 'Apple', '#10B981', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_hortifruti;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alimentacao, p_family_id, 'Padaria & Mercearia', 'Coffee', '#10B981', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_padaria;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alimentacao, p_family_id, 'Água & Bebidas para Casa', 'Droplets', '#10B981', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_agua_bebidas;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alimentacao, p_family_id, 'Limpeza & Higiene da Casa', 'Sparkles', '#10B981', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_limpeza_higiene;

  -- =========================================================================
  -- 3. TRANSPORTE (7 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Combustível', 'Fuel', '#3B82F6', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_combustivel;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Transporte Público', 'Bus', '#3B82F6', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_transp_publico;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Apps & Táxi (Uber/99)', 'Car', '#3B82F6', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_apps_transporte;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Estacionamento & Pedágio', 'CircleParking', '#3B82F6', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_estac_pedagio;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Oficina & Manutenção', 'Wrench', '#3B82F6', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_oficina;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'IPVA & Licenciamento', 'ShieldAlert', '#3B82F6', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_ipva;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, p_family_id, 'Seguro do Veículo', 'ShieldCheck', '#3B82F6', 7)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_seguro_auto;

  -- =========================================================================
  -- 4. SAÚDE (7 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, p_family_id, 'Plano de Saúde & Convênio', 'Shield', '#EF4444', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_plano_saude;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, p_family_id, 'Coparticipação', 'CreditCard', '#EF4444', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_coparticipacao;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, p_family_id, 'Consultas & Exames', 'Stethoscope', '#EF4444', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_consultas;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, p_family_id, 'Farmácia & Medicamentos', 'Pill', '#EF4444', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_farmacia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, p_family_id, 'Odontologia', 'Smile', '#EF4444', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_odontologia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, p_family_id, 'Terapias & Psicologia', 'HeartHandshake', '#EF4444', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_terapias;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, p_family_id, 'Óculos & Aparelhos', 'Eye', '#EF4444', 7)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_oculos;

  -- =========================================================================
  -- 5. EDUCAÇÃO (6 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, p_family_id, 'Escola & Creche', 'GraduationCap', '#8B5CF6', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_escola;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, p_family_id, 'Faculdade', 'BookOpen', '#8B5CF6', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_faculdade;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, p_family_id, 'Cursos & Idiomas', 'Languages', '#8B5CF6', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_cursos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, p_family_id, 'Material & Livros Didáticos', 'Book', '#8B5CF6', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_material_edu;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, p_family_id, 'Uniformes', 'Shirt', '#8B5CF6', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_uniformes;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, p_family_id, 'Transporte Escolar', 'Bus', '#8B5CF6', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_transp_escolar;

  -- =========================================================================
  -- 6. DÍVIDAS & EMPRÉSTIMOS (7 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_dividas, p_family_id, 'Fatura do Cartão (Rotativo & Parcelado)', 'CreditCard', '#DC2626', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_fatura_cartao;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_dividas, p_family_id, 'Empréstimos Pessoais', 'Banknote', '#DC2626', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_emp_pessoais;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_dividas, p_family_id, 'Financiamento Imobiliário', 'Home', '#DC2626', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_fin_imob;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_dividas, p_family_id, 'Financiamento de Veículo', 'Car', '#DC2626', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_fin_veic;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_dividas, p_family_id, 'Cheque Especial & Overdraft', 'AlertCircle', '#DC2626', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_cheque_especial;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_dividas, p_family_id, 'Renegociações & Parcelamentos', 'Scale', '#DC2626', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_renegociacoes;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_dividas, p_family_id, 'Juros & Multas', 'AlertTriangle', '#DC2626', 7)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_juros_multas;

  -- =========================================================================
  -- 7. RESTAURANTES & DELIVERY (7 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_restaurantes, p_family_id, 'Restaurantes & Bares', 'Utensils', '#F59E0B', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_restaurantes;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_restaurantes, p_family_id, 'Delivery (iFood/Rappi)', 'Bike', '#F59E0B', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_delivery;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_restaurantes, p_family_id, 'Fast Food & Lanches', 'Coffee', '#F59E0B', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_fast_food;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_restaurantes, p_family_id, 'Cafeterias', 'Coffee', '#F59E0B', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_cafeterias;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_restaurantes, p_family_id, 'Sorvete & Açaí', 'IceCream', '#F59E0B', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_sorvete;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_restaurantes, p_family_id, 'Conveniência & Lanchonetes de Posto', 'Store', '#F59E0B', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_conveniencia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_restaurantes, p_family_id, 'Marmitas & Refeições no Trabalho', 'Salad', '#F59E0B', 7)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_marmitas;

  -- =========================================================================
  -- 8. LAZER (7 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, p_family_id, 'Cinema', 'Film', '#F97316', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_cinema;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, p_family_id, 'Shows & Eventos', 'Ticket', '#F97316', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_shows;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, p_family_id, 'Passeios & Parques', 'Sun', '#F97316', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_passeios;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, p_family_id, 'Viagens: Passagens & Hospedagem', 'Plane', '#F97316', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_viagens_passagens;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, p_family_id, 'Viagens: Passeios & Pacotes', 'Compass', '#F97316', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_viagens_pacotes;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, p_family_id, 'Hobbies & Jogos', 'Gamepad2', '#F97316', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_hobbies;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, p_family_id, 'Livros & Cultura', 'Book', '#F97316', 7)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_livros;

  -- =========================================================================
  -- 9. CUIDADOS PESSOAIS & BEM-ESTAR (5 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, p_family_id, 'Barbearia/Salão', 'Scissors', '#EC4899', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_salao;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, p_family_id, 'Manicure & Estética', 'Sparkles', '#EC4899', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_estetica;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, p_family_id, 'Cosméticos & Perfumaria', 'Package', '#EC4899', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_cosmeticos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, p_family_id, 'Academia & Esportes', 'Activity', '#EC4899', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_academia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, p_family_id, 'Spa & Bem-estar', 'HeartPulse', '#EC4899', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_spa;

  -- =========================================================================
  -- 10. ASSINATURAS & APPS (7 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, p_family_id, 'Streaming de Vídeo', 'Tv', '#7C3AED', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_streaming_video;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, p_family_id, 'Música & Podcasts', 'Music', '#7C3AED', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_musica;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, p_family_id, 'Softwares & Apps', 'Terminal', '#7C3AED', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_softwares;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, p_family_id, 'Jogos & Gaming', 'Gamepad', '#7C3AED', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_jogos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, p_family_id, 'Jornais & Revistas Digitais', 'Newspaper', '#7C3AED', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_jornais;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, p_family_id, 'Armazenamento & Nuvem', 'Cloud', '#7C3AED', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_nuvem;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, p_family_id, 'Clubes de Assinatura', 'Sparkles', '#7C3AED', 7)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_clubes;

  -- =========================================================================
  -- 11. COMPRAS (8 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Roupas', 'Shirt', '#D97706', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_roupas;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Calçados', 'ShoppingBag', '#D97706', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_calcados;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Eletrônicos & Gadgets', 'Laptop', '#D97706', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_eletronicos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Eletrodomésticos', 'Tv', '#D97706', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_eletrodomesticos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Móveis & Decoração', 'Home', '#D97706', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_moveis;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Utilidades & Casa', 'Package', '#D97706', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_utilidades;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Presentes', 'Gift', '#D97706', 7)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_presentes;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, p_family_id, 'Bebês & Crianças', 'Smile', '#D97706', 8)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_bebes;

  -- =========================================================================
  -- 12. PETS (3 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_pets, p_family_id, 'Ração & Petiscos', 'Utensils', '#84CC16', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_racao;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_pets, p_family_id, 'Veterinário & Vacinas', 'HeartPulse', '#84CC16', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_vet;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_pets, p_family_id, 'Banho, Tosa & Acessórios', 'Sparkles', '#84CC16', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_banho;

  -- =========================================================================
  -- 13. RESERVA DE EMERGÊNCIA (2 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_reserva, p_family_id, 'Aportes na Reserva', 'ShieldCheck', '#10B981', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_aportes_reserva;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_reserva, p_family_id, 'Resgates Emergenciais', 'ArrowDownRight', '#10B981', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_resgates_reserva;

  -- =========================================================================
  -- 14. METAS (6 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, p_family_id, 'Troca de Carro', 'Car', '#06B6D4', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_troca_carro;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, p_family_id, 'Casa Própria', 'Home', '#06B6D4', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_casa_propria;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, p_family_id, 'Viagem Internacional', 'Plane', '#06B6D4', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_viagem_internacional;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, p_family_id, 'Reforma', 'Wrench', '#06B6D4', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_reforma;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, p_family_id, 'Educação Futura (dos Filhos)', 'GraduationCap', '#06B6D4', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_educacao_futura;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, p_family_id, 'Meta Livre', 'Target', '#06B6D4', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_meta_livre;

  -- =========================================================================
  -- 15. INVESTIMENTOS (7 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, p_family_id, 'Tesouro Direto', 'Landmark', '#059669', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_tesouro;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, p_family_id, 'Renda Fixa (CDB/LCI/LCA)', 'Banknote', '#059669', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_renda_fixa;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, p_family_id, 'Ações & ETFs', 'TrendingUp', '#059669', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_acoes;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, p_family_id, 'Fundos Imobiliários (FIIs)', 'Building', '#059669', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_fiis;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, p_family_id, 'Criptomoedas', 'Coins', '#059669', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_cripto;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, p_family_id, 'Previdência Privada', 'Landmark', '#059669', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_previdencia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, p_family_id, 'Aposentadoria', 'PiggyBank', '#059669', 7)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_aposentadoria;

  -- =========================================================================
  -- 16. SALÁRIO (5 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_salario, p_family_id, 'Salário Principal', 'Briefcase', '#10B981', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_salario_principal;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_salario, p_family_id, '13º & Férias', 'Gift', '#10B981', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_salario_13;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_salario, p_family_id, 'Bônus & PLR', 'Coins', '#10B981', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_bonus;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_salario, p_family_id, 'Horas Extras & Comissões', 'Clock', '#10B981', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_horas_extras;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_salario, p_family_id, 'Benefícios (VR/VA)', 'CreditCard', '#10B981', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_beneficios;

  -- =========================================================================
  -- 17. RENDIMENTOS (4 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_rendimentos, p_family_id, 'Juros & Rendimento de Aplicações', 'Landmark', '#059669', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_juros_aplicacoes;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_rendimentos, p_family_id, 'Dividendos & JCP', 'TrendingUp', '#059669', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_dividendos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_rendimentos, p_family_id, 'Aluguel Recebido', 'Home', '#059669', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_aluguel_rec;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_rendimentos, p_family_id, 'Aposentadoria & Pensão', 'PiggyBank', '#059669', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_aposentadoria_rec;

  -- =========================================================================
  -- 18. TRABALHOS EXTRAS & AUTÔNOMO (6 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_trab_extras, p_family_id, 'Freelances & Bicos', 'Hammer', '#0EA5E9', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_freelances;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_trab_extras, p_family_id, 'Venda de Produtos', 'ShoppingBag', '#0EA5E9', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_venda_produtos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_trab_extras, p_family_id, 'MEI & Autônomo', 'Briefcase', '#0EA5E9', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_mei;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_trab_extras, p_family_id, 'Comissões & Gorjetas', 'Coins', '#0EA5E9', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_comissoes;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_trab_extras, p_family_id, 'Cursos & Aulas Particulares', 'GraduationCap', '#0EA5E9', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_cursos_aulas;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_trab_extras, p_family_id, 'Infoprodutos & Conteúdo', 'Laptop', '#0EA5E9', 6)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_infoprodutos;

  -- =========================================================================
  -- 19. OUTRAS RECEITAS (5 subcategorias)
  -- =========================================================================
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_outras_rec, p_family_id, 'Reembolsos & Estornos', 'Undo2', '#64748B', 1)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_reembolsos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_outras_rec, p_family_id, 'Cashback & Milhas', 'Coins', '#64748B', 2)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_cashback;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_outras_rec, p_family_id, 'Presentes Recebidos', 'Gift', '#64748B', 3)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_presentes_rec;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_outras_rec, p_family_id, 'Vendas de Itens Usados', 'Tag', '#64748B', 4)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_vendas_usados;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_outras_rec, p_family_id, 'Restituição de Imposto de Renda', 'FileText', '#64748B', 5)
  ON CONFLICT (category_id, name) DO UPDATE SET color = EXCLUDED.color, sort_order = EXCLUDED.sort_order RETURNING id INTO sub_restituicao_ir;

  -- 6. Define os Tetos Padrão em default_budgets para as categorias de despesa do modelo
  IF p_monthly_net_income_cents > 0 THEN
    -- Moradia: 20%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_moradia, NULL, ROUND((p_monthly_net_income_cents * 20.0 * v_f_essentials) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Alimentação: 14%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_alimentacao, NULL, ROUND((p_monthly_net_income_cents * 14.0 * v_f_essentials) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Transporte: 8%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_transporte, NULL, ROUND((p_monthly_net_income_cents * 8.0 * v_f_essentials) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Saúde: 5%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_saude, NULL, ROUND((p_monthly_net_income_cents * 5.0 * v_f_essentials) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Educação: 3%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_educacao, NULL, ROUND((p_monthly_net_income_cents * 3.0 * v_f_essentials) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Dívidas & Empréstimos: 0% base (ou reserva livre para quem tiver)
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_dividas, NULL, 0)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Restaurantes & Delivery: 10%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_restaurantes, NULL, ROUND((p_monthly_net_income_cents * 10.0 * v_f_lifestyle) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Lazer: 5%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_lazer, NULL, ROUND((p_monthly_net_income_cents * 5.0 * v_f_lifestyle) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Cuidados Pessoais & Bem-estar: 5%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_cuidados, NULL, ROUND((p_monthly_net_income_cents * 5.0 * v_f_lifestyle) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Assinaturas & Apps: 3%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_assinaturas, NULL, ROUND((p_monthly_net_income_cents * 3.0 * v_f_lifestyle) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Compras: 4%
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

    -- Metas: 4%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_metas, NULL, ROUND((p_monthly_net_income_cents * 4.0 * v_f_future) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    -- Investimentos: 6%
    INSERT INTO public.default_budgets (family_id, category_id, subcategory_id, amount_cents)
    VALUES (p_family_id, cat_investimentos, NULL, ROUND((p_monthly_net_income_cents * 6.0 * v_f_future) / 100.0)::BIGINT)
    ON CONFLICT (family_id, category_id, COALESCE(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

    SELECT COALESCE(SUM(amount_cents), 0) INTO v_total_budget_cents
    FROM public.default_budgets
    WHERE family_id = p_family_id;
  END IF;

  -- 7. Semeadura de Regras de Auto-categorização (categorization_rules)
  -- Padrões brasileiros determinísticos cobrindo intenções canônicas
  -- Dívidas, Rotativo, Empréstimos, Consignado, Crediário
  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'ROTATIVO') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'ROTATIVO', cat_dividas, sub_fatura_cartao);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'FATURA ANTERIOR') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'FATURA ANTERIOR', cat_dividas, sub_fatura_cartao);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'EMPRESTIMO') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'EMPRESTIMO', cat_dividas, sub_emp_pessoais);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'CONSIGNADO') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'CONSIGNADO', cat_dividas, sub_emp_pessoais);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'CREDIARIO') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'CREDIARIO', cat_dividas, sub_emp_pessoais);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'FINANCIAMENTO IMOBILIARIO') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'FINANCIAMENTO IMOBILIARIO', cat_dividas, sub_fin_imob);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'CHEQUE ESPECIAL') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'CHEQUE ESPECIAL', cat_dividas, sub_cheque_especial);
  END IF;

  -- Bebês & Crianças (Fralda, Enxoval, Bebê, Ri Happy)
  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'FRALDA') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'FRALDA', cat_compras, sub_bebes);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'ENXOVAL') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'ENXOVAL', cat_compras, sub_bebes);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'BEBE') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'BEBE', cat_compras, sub_bebes);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'RI HAPPY') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'RI HAPPY', cat_compras, sub_bebes);
  END IF;

  -- Marmitas & Refeições no Trabalho
  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'MARMITA') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'MARMITA', cat_restaurantes, sub_marmitas);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'QUENTINHA') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'QUENTINHA', cat_restaurantes, sub_marmitas);
  END IF;

  -- Coparticipação
  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'COPARTICIPACAO') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'COPARTICIPACAO', cat_saude, sub_coparticipacao);
  END IF;

  -- 13º e Férias
  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = '13O') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, '13O', cat_salario, sub_salario_13);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = '13º') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, '13º', cat_salario, sub_salario_13);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'FERIAS') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'FERIAS', cat_salario, sub_salario_13);
  END IF;

  -- Investimentos: Tesouro Direto, CDB / LCI / LCA
  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'TESOURO DIRETO') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'TESOURO DIRETO', cat_investimentos, sub_tesouro);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'TESOURO SELIC') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'TESOURO SELIC', cat_investimentos, sub_tesouro);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'CDB') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'CDB', cat_investimentos, sub_renda_fixa);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'LCI') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'LCI', cat_investimentos, sub_renda_fixa);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'LCA') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'LCA', cat_investimentos, sub_renda_fixa);
  END IF;

  -- Rendimentos: Dividendos, JCP, Aposentadoria, Pensão
  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'DIVIDENDO') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'DIVIDENDO', cat_rendimentos, sub_dividendos);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'JCP') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'JCP', cat_rendimentos, sub_dividendos);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'PENSAO') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'PENSAO', cat_rendimentos, sub_aposentadoria_rec);
  END IF;

  -- Outras Receitas: Restituição IR
  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'RESTITUICAO IR') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'RESTITUICAO IR', cat_outras_rec, sub_restituicao_ir);
  END IF;

  -- Grandes padrões do dia a dia (Mercado, Alimentação, Mobilidade, Assinaturas, Farmácia, Pets)
  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'IFOOD') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'IFOOD', cat_restaurantes, sub_delivery);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'RAPPI') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'RAPPI', cat_restaurantes, sub_delivery);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'UBER') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'UBER', cat_transporte, sub_apps_transporte);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = '99APP') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, '99APP', cat_transporte, sub_apps_transporte);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'POSTO') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'POSTO', cat_transporte, sub_combustivel);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'SHELL') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'SHELL', cat_transporte, sub_combustivel);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'IPIRANGA') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'IPIRANGA', cat_transporte, sub_combustivel);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'NETFLIX') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'NETFLIX', cat_assinaturas, sub_streaming_video);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'SPOTIFY') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'SPOTIFY', cat_assinaturas, sub_musica);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'DROGASIL') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'DROGASIL', cat_saude, sub_farmacia);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'DROGA RAIA') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'DROGA RAIA', cat_saude, sub_farmacia);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'PETZ') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'PETZ', cat_pets, sub_racao);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'COBASI') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'COBASI', cat_pets, sub_racao);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'CARREFOUR') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'CARREFOUR', cat_alimentacao, sub_supermercado);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorization_rules WHERE family_id = p_family_id AND pattern = 'ASSAI') THEN
    INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id)
    VALUES (p_family_id, v_user_id, 'ASSAI', cat_alimentacao, sub_supermercado);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'family_id', p_family_id,
    'monthly_net_income_cents', p_monthly_net_income_cents,
    'model_preset_id', v_preset,
    'categories_count', 19,
    'subcategories_count', 116,
    'total_budget_cents', v_total_budget_cents
  );
END;
$$;
