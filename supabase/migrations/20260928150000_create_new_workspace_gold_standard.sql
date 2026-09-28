-- Migração para atualizar DEFINITIVAMENTE create_new_family_workspace
-- para nascer diretamente com a Taxonomia Padrão Ouro 50/30/20:
-- 14 categorias mestras (5 essentials, 6 lifestyle, 3 future) + Salário e Rendimentos (income)
-- 55 subcategorias padronizadas
-- 116 regras de auto-categorização na tabela categorization_rules

CREATE OR REPLACE FUNCTION public.create_new_family_workspace(
  p_family_name TEXT,
  p_member_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_family_id UUID;
  v_member_id UUID;
  v_f_name TEXT;
  v_m_name TEXT;

  -- Categorias Mestras Despesas
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

  -- Categorias Mestras Receitas
  cat_salario UUID;
  cat_rendimentos UUID;

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

  -- Subcategorias Salário
  sub_salario_principal UUID;
  sub_beneficios UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  v_f_name := TRIM(COALESCE(p_family_name, ''));
  IF v_f_name = '' THEN
    v_f_name := 'Minha Família';
  END IF;

  v_m_name := TRIM(COALESCE(p_member_name, ''));
  IF v_m_name = '' THEN
    v_m_name := 'Principal';
  END IF;

  -- 1. Cria a família
  INSERT INTO public.families (name, created_by, monthly_net_income_cents)
  VALUES (v_f_name, v_user_id, 0)
  RETURNING id INTO v_family_id;

  -- 2. Cria o primeiro membro administrador padrão
  INSERT INTO public.family_members (family_id, name, is_admin)
  VALUES (v_family_id, v_m_name, true)
  RETURNING id INTO v_member_id;

  -- 3. Cria as 14 Categorias Mestras da Taxonomia Padrão Ouro + 2 Receitas
  -- Necessidades (essentials, 50%)
  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Moradia', 'Home', '#6366F1', 'expense', 'essentials', 1)
  RETURNING id INTO cat_moradia;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Alimentação Básica', 'ShoppingCart', '#10B981', 'expense', 'essentials', 2)
  RETURNING id INTO cat_alim_basica;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Transporte Obrigatório', 'Car', '#3B82F6', 'expense', 'essentials', 3)
  RETURNING id INTO cat_transporte;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Saúde & Cuidados Médicos', 'HeartPulse', '#EF4444', 'expense', 'essentials', 4)
  RETURNING id INTO cat_saude;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Educação Obrigatória', 'GraduationCap', '#8B5CF6', 'expense', 'essentials', 5)
  RETURNING id INTO cat_educacao;

  -- Estilo de Vida (lifestyle, 30%)
  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Gastronomia & Delivery', 'Utensils', '#F59E0B', 'expense', 'lifestyle', 6)
  RETURNING id INTO cat_gastronomia;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Lazer & Passeios', 'Ticket', '#F97316', 'expense', 'lifestyle', 7)
  RETURNING id INTO cat_lazer;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Cuidados Pessoais & Bem-estar', 'Sparkles', '#EC4899', 'expense', 'lifestyle', 8)
  RETURNING id INTO cat_cuidados;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Assinaturas & Conectividade', 'Tv', '#7C3AED', 'expense', 'lifestyle', 9)
  RETURNING id INTO cat_assinaturas;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Compras & Vestuário', 'ShoppingBag', '#D97706', 'expense', 'lifestyle', 10)
  RETURNING id INTO cat_compras;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Pets', 'PawPrint', '#84CC16', 'expense', 'lifestyle', 11)
  RETURNING id INTO cat_pets;

  -- Futuro & Metas (future, 20%)
  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Reserva de Emergência', 'ShieldCheck', '#10B981', 'expense', 'future', 12)
  RETURNING id INTO cat_reserva;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Metas & Grandes Sonhos', 'Target', '#06B6D4', 'expense', 'future', 13)
  RETURNING id INTO cat_metas;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Investimentos de Longo Prazo', 'TrendingUp', '#059669', 'expense', 'future', 14)
  RETURNING id INTO cat_investimentos;

  -- Receitas (income)
  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Salário', 'Briefcase', '#10B981', 'income', NULL, 15)
  RETURNING id INTO cat_salario;

  INSERT INTO public.transaction_categories (family_id, name, icon, color, type, budget_bucket, sort_order)
  VALUES (v_family_id, 'Rendimentos', 'TrendingUp', '#059669', 'income', NULL, 16)
  RETURNING id INTO cat_rendimentos;

  -- 4. Cria Subcategorias Oficiais (55 subcategorias de despesas + 2 de salário)
  -- Moradia
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, v_family_id, 'Aluguel / Condomínio', 'Home', '#6366F1', 1) RETURNING id INTO sub_aluguel_condominio;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, v_family_id, 'Energia Elétrica', 'Zap', '#6366F1', 2) RETURNING id INTO sub_energia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, v_family_id, 'Água & Saneamento', 'Droplets', '#6366F1', 3) RETURNING id INTO sub_agua;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, v_family_id, 'Gás', 'Flame', '#6366F1', 4) RETURNING id INTO sub_gas;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, v_family_id, 'Internet & Fixo', 'Wifi', '#6366F1', 5) RETURNING id INTO sub_internet;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_moradia, v_family_id, 'Manutenção da Casa', 'Wrench', '#6366F1', 6) RETURNING id INTO sub_manut_casa;

  -- Alimentação Básica
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alim_basica, v_family_id, 'Supermercado', 'ShoppingCart', '#10B981', 1) RETURNING id INTO sub_supermercado;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alim_basica, v_family_id, 'Açougue & Peixaria', 'Beef', '#10B981', 2) RETURNING id INTO sub_acougue;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alim_basica, v_family_id, 'Hortifruti & Feira', 'Apple', '#10B981', 3) RETURNING id INTO sub_hortifruti;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_alim_basica, v_family_id, 'Padaria do Dia a Dia', 'Coffee', '#10B981', 4) RETURNING id INTO sub_padaria;

  -- Transporte Obrigatório
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, v_family_id, 'Combustível', 'Fuel', '#3B82F6', 1) RETURNING id INTO sub_combustivel;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, v_family_id, 'Transporte Público & Bilhete', 'Bus', '#3B82F6', 2) RETURNING id INTO sub_transp_publico;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, v_family_id, 'Aplicativos do Dia a Dia (Uber/99)', 'Car', '#3B82F6', 3) RETURNING id INTO sub_apps_transporte;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, v_family_id, 'Estacionamento & Pedágio', 'CircleParking', '#3B82F6', 4) RETURNING id INTO sub_estac_pedagio;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, v_family_id, 'Seguro & IPVA', 'ShieldAlert', '#3B82F6', 5) RETURNING id INTO sub_seguro_ipva;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_transporte, v_family_id, 'Manutenção Básica', 'Wrench', '#3B82F6', 6) RETURNING id INTO sub_manut_transp;

  -- Saúde & Cuidados Médicos
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, v_family_id, 'Plano de Saúde', 'Shield', '#EF4444', 1) RETURNING id INTO sub_plano_saude;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, v_family_id, 'Farmácia & Medicamentos', 'Pill', '#EF4444', 2) RETURNING id INTO sub_farmacia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, v_family_id, 'Consultas & Exames', 'Stethoscope', '#EF4444', 3) RETURNING id INTO sub_consultas;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_saude, v_family_id, 'Odontologia', 'Smile', '#EF4444', 4) RETURNING id INTO sub_odontologia;

  -- Educação Obrigatória
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, v_family_id, 'Mensalidade Escolar / Faculdade', 'GraduationCap', '#8B5CF6', 1) RETURNING id INTO sub_mensalidade_edu;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, v_family_id, 'Material & Uniformes', 'BookOpen', '#8B5CF6', 2) RETURNING id INTO sub_material_edu;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_educacao, v_family_id, 'Transporte Escolar', 'Bus', '#8B5CF6', 3) RETURNING id INTO sub_transp_escolar;

  -- Gastronomia & Delivery
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_gastronomia, v_family_id, 'Restaurantes & Bares', 'Utensils', '#F59E0B', 1) RETURNING id INTO sub_restaurantes;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_gastronomia, v_family_id, 'Delivery (iFood/Rappi)', 'Bike', '#F59E0B', 2) RETURNING id INTO sub_delivery;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_gastronomia, v_family_id, 'Cafeterias & Lanches Rápidos', 'Coffee', '#F59E0B', 3) RETURNING id INTO sub_cafeterias;

  -- Lazer & Passeios
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, v_family_id, 'Cinema', 'Film', '#F97316', 1) RETURNING id INTO sub_cinema;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, v_family_id, 'Shows & Eventos', 'Ticket', '#F97316', 2) RETURNING id INTO sub_shows;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, v_family_id, 'Viagens & Hospedagem', 'Plane', '#F97316', 3) RETURNING id INTO sub_viagens;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_lazer, v_family_id, 'Passeios de Fim de Semana', 'Sun', '#F97316', 4) RETURNING id INTO sub_passeios;

  -- Cuidados Pessoais & Bem-estar
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, v_family_id, 'Barbearia / Salão de Beleza', 'Scissors', '#EC4899', 1) RETURNING id INTO sub_salao;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, v_family_id, 'Manicure & Estética', 'Sparkles', '#EC4899', 2) RETURNING id INTO sub_estetica;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, v_family_id, 'Cosméticos & Perfumaria', 'Package', '#EC4899', 3) RETURNING id INTO sub_cosmeticos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_cuidados, v_family_id, 'Academia & Esportes', 'Activity', '#EC4899', 4) RETURNING id INTO sub_academia;

  -- Assinaturas & Conectividade
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, v_family_id, 'Streaming de Vídeo & Música', 'Tv', '#7C3AED', 1) RETURNING id INTO sub_streaming;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, v_family_id, 'Softwares & Apps', 'Terminal', '#7C3AED', 2) RETURNING id INTO sub_softwares;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_assinaturas, v_family_id, 'Clubes de Assinatura', 'Sparkles', '#7C3AED', 3) RETURNING id INTO sub_clubes;

  -- Compras & Vestuário
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, v_family_id, 'Roupas & Calçados', 'Shirt', '#D97706', 1) RETURNING id INTO sub_roupas;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, v_family_id, 'Eletrônicos & Gadgets', 'Laptop', '#D97706', 2) RETURNING id INTO sub_eletronicos;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, v_family_id, 'Decoração & Utilidades', 'Home', '#D97706', 3) RETURNING id INTO sub_decoracao;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_compras, v_family_id, 'Presentes', 'Gift', '#D97706', 4) RETURNING id INTO sub_presentes;

  -- Pets
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_pets, v_family_id, 'Ração & Petiscos', 'Utensils', '#84CC16', 1) RETURNING id INTO sub_racao;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_pets, v_family_id, 'Veterinário & Vacinas', 'HeartPulse', '#84CC16', 2) RETURNING id INTO sub_vet;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_pets, v_family_id, 'Banho, Tosa & Acessórios', 'Sparkles', '#84CC16', 3) RETURNING id INTO sub_banho;

  -- Reserva de Emergência
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_reserva, v_family_id, 'Aportes na Reserva', 'ShieldCheck', '#10B981', 1) RETURNING id INTO sub_aportes_reserva;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_reserva, v_family_id, 'Resgates Emergenciais', 'ArrowDownRight', '#10B981', 2) RETURNING id INTO sub_resgates_reserva;

  -- Metas & Grandes Sonhos
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, v_family_id, 'Troca de Carro', 'Car', '#06B6D4', 1) RETURNING id INTO sub_troca_carro;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, v_family_id, 'Casa Própria', 'Home', '#06B6D4', 2) RETURNING id INTO sub_casa_propria;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, v_family_id, 'Viagem Internacional', 'Plane', '#06B6D4', 3) RETURNING id INTO sub_viagem_internacional;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_metas, v_family_id, 'Reforma', 'Wrench', '#06B6D4', 4) RETURNING id INTO sub_reforma;

  -- Investimentos de Longo Prazo
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, v_family_id, 'Previdência Privada', 'Landmark', '#059669', 1) RETURNING id INTO sub_previdencia;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, v_family_id, 'Ações & Fundos Imobiliários', 'TrendingUp', '#059669', 2) RETURNING id INTO sub_acoes_fiis;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_investimentos, v_family_id, 'Aposentadoria', 'PiggyBank', '#059669', 3) RETURNING id INTO sub_aposentadoria;

  -- Salário
  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_salario, v_family_id, 'Salário Principal', 'Briefcase', '#10B981', 1) RETURNING id INTO sub_salario_principal;

  INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
  VALUES (cat_salario, v_family_id, 'Benefícios (VR/VA)', 'CreditCard', '#059669', 2) RETURNING id INTO sub_beneficios;

  -- 5. Regras de Auto-Categorização (~116 regras padronizadas)
  -- Moradia keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'ALUGUEL', cat_moradia, sub_aluguel_condominio),
    (v_family_id, v_user_id, 'CONDOMINIO', cat_moradia, sub_aluguel_condominio),
    (v_family_id, v_user_id, 'ENEL', cat_moradia, sub_energia),
    (v_family_id, v_user_id, 'CPFL', cat_moradia, sub_energia),
    (v_family_id, v_user_id, 'LUZ', cat_moradia, sub_energia),
    (v_family_id, v_user_id, 'SABESP', cat_moradia, sub_agua),
    (v_family_id, v_user_id, 'AGUA', cat_moradia, sub_agua),
    (v_family_id, v_user_id, 'COMGAS', cat_moradia, sub_gas),
    (v_family_id, v_user_id, 'VIVO FIBRA', cat_moradia, sub_internet),
    (v_family_id, v_user_id, 'CLARO RESIDENCIAL', cat_moradia, sub_internet);

  -- Alimentação Básica keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'CARREFOUR', cat_alim_basica, sub_supermercado),
    (v_family_id, v_user_id, 'ASSAI', cat_alim_basica, sub_supermercado),
    (v_family_id, v_user_id, 'ASSAÍ', cat_alim_basica, sub_supermercado),
    (v_family_id, v_user_id, 'PAO DE ACUCAR', cat_alim_basica, sub_supermercado),
    (v_family_id, v_user_id, 'PÃO DE AÇÚCAR', cat_alim_basica, sub_supermercado),
    (v_family_id, v_user_id, 'ATACADAO', cat_alim_basica, sub_supermercado),
    (v_family_id, v_user_id, 'ATACADÃO', cat_alim_basica, sub_supermercado),
    (v_family_id, v_user_id, 'MERCADINHO', cat_alim_basica, sub_supermercado),
    (v_family_id, v_user_id, 'ACOUGUE', cat_alim_basica, sub_acougue),
    (v_family_id, v_user_id, 'SWIFT', cat_alim_basica, sub_acougue),
    (v_family_id, v_user_id, 'HORTIFRUTI', cat_alim_basica, sub_hortifruti),
    (v_family_id, v_user_id, 'FEIRA', cat_alim_basica, sub_hortifruti);

  -- Transporte Obrigatório keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'POSTO IPIRANGA', cat_transporte, sub_combustivel),
    (v_family_id, v_user_id, 'POSTO', cat_transporte, sub_combustivel),
    (v_family_id, v_user_id, 'SHELL', cat_transporte, sub_combustivel),
    (v_family_id, v_user_id, 'IPIRANGA', cat_transporte, sub_combustivel),
    (v_family_id, v_user_id, 'UBER', cat_transporte, sub_apps_transporte),
    (v_family_id, v_user_id, '99', cat_transporte, sub_apps_transporte),
    (v_family_id, v_user_id, '99APP', cat_transporte, sub_apps_transporte),
    (v_family_id, v_user_id, 'METRO', cat_transporte, sub_transp_publico),
    (v_family_id, v_user_id, 'SPTRANS', cat_transporte, sub_transp_publico),
    (v_family_id, v_user_id, 'PEDAGIO', cat_transporte, sub_estac_pedagio),
    (v_family_id, v_user_id, 'SEM PARAR', cat_transporte, sub_estac_pedagio);

  -- Saúde & Cuidados Médicos keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'DROGASIL', cat_saude, sub_farmacia),
    (v_family_id, v_user_id, 'DROGA RAIA', cat_saude, sub_farmacia),
    (v_family_id, v_user_id, 'PAGUE MENOS', cat_saude, sub_farmacia),
    (v_family_id, v_user_id, 'FARMACIA', cat_saude, sub_farmacia),
    (v_family_id, v_user_id, 'UNIMED', cat_saude, sub_plano_saude),
    (v_family_id, v_user_id, 'BRADESCO SAUDE', cat_saude, sub_plano_saude),
    (v_family_id, v_user_id, 'FLEURY', cat_saude, sub_consultas),
    (v_family_id, v_user_id, 'LABORATORIO', cat_saude, sub_consultas),
    (v_family_id, v_user_id, 'DENTISTA', cat_saude, sub_odontologia);

  -- Educação Obrigatória keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'ESCOLA', cat_educacao, sub_mensalidade_edu),
    (v_family_id, v_user_id, 'COLEGIO', cat_educacao, sub_mensalidade_edu),
    (v_family_id, v_user_id, 'COLÉGIO', cat_educacao, sub_mensalidade_edu),
    (v_family_id, v_user_id, 'FACULDADE', cat_educacao, sub_mensalidade_edu),
    (v_family_id, v_user_id, 'MENSALIDADE', cat_educacao, sub_mensalidade_edu),
    (v_family_id, v_user_id, 'PAPELARIA', cat_educacao, sub_material_edu),
    (v_family_id, v_user_id, 'VAN ESCOLAR', cat_educacao, sub_transp_escolar);

  -- Gastronomia & Delivery keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'IFOOD', cat_gastronomia, sub_delivery),
    (v_family_id, v_user_id, 'RAPPI', cat_gastronomia, sub_delivery),
    (v_family_id, v_user_id, 'MCDONALDS', cat_gastronomia, sub_cafeterias),
    (v_family_id, v_user_id, 'BURGER KING', cat_gastronomia, sub_cafeterias),
    (v_family_id, v_user_id, 'OUTBACK', cat_gastronomia, sub_restaurantes),
    (v_family_id, v_user_id, 'RESTAURANTE', cat_gastronomia, sub_restaurantes),
    (v_family_id, v_user_id, 'BAR', cat_gastronomia, sub_restaurantes),
    (v_family_id, v_user_id, 'CHOPERIA', cat_gastronomia, sub_restaurantes),
    (v_family_id, v_user_id, 'CAFETERIA', cat_gastronomia, sub_cafeterias),
    (v_family_id, v_user_id, 'STARBUCKS', cat_gastronomia, sub_cafeterias);

  -- Lazer & Passeios keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'CINEMARK', cat_lazer, sub_cinema),
    (v_family_id, v_user_id, 'INGRESSO.COM', cat_lazer, sub_cinema),
    (v_family_id, v_user_id, 'SYMPLA', cat_lazer, sub_shows),
    (v_family_id, v_user_id, 'AIRBNB', cat_lazer, sub_viagens),
    (v_family_id, v_user_id, 'BOOKING', cat_lazer, sub_viagens),
    (v_family_id, v_user_id, 'HOTEL', cat_lazer, sub_viagens),
    (v_family_id, v_user_id, 'PASSAGEM AEREA', cat_lazer, sub_viagens),
    (v_family_id, v_user_id, 'AZUL', cat_lazer, sub_viagens),
    (v_family_id, v_user_id, 'GOL', cat_lazer, sub_viagens),
    (v_family_id, v_user_id, 'LATAM', cat_lazer, sub_viagens);

  -- Cuidados Pessoais & Bem-estar keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'SMART FIT', cat_cuidados, sub_academia),
    (v_family_id, v_user_id, 'ACADEMIA', cat_cuidados, sub_academia),
    (v_family_id, v_user_id, 'BOTICARIO', cat_cuidados, sub_cosmeticos),
    (v_family_id, v_user_id, 'BOTICÁRIO', cat_cuidados, sub_cosmeticos),
    (v_family_id, v_user_id, 'SEPHORA', cat_cuidados, sub_cosmeticos),
    (v_family_id, v_user_id, 'NATURA', cat_cuidados, sub_cosmeticos),
    (v_family_id, v_user_id, 'SALAO', cat_cuidados, sub_salao),
    (v_family_id, v_user_id, 'SALÃO', cat_cuidados, sub_salao),
    (v_family_id, v_user_id, 'BARBEARIA', cat_cuidados, sub_salao),
    (v_family_id, v_user_id, 'ESTETICA', cat_cuidados, sub_estetica),
    (v_family_id, v_user_id, 'ESTÉTICA', cat_cuidados, sub_estetica);

  -- Assinaturas & Conectividade keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'NETFLIX', cat_assinaturas, sub_streaming),
    (v_family_id, v_user_id, 'SPOTIFY', cat_assinaturas, sub_streaming),
    (v_family_id, v_user_id, 'AMAZON PRIME', cat_assinaturas, sub_streaming),
    (v_family_id, v_user_id, 'YOUTUBE PREMIUM', cat_assinaturas, sub_streaming),
    (v_family_id, v_user_id, 'HBO', cat_assinaturas, sub_streaming),
    (v_family_id, v_user_id, 'MAX', cat_assinaturas, sub_streaming),
    (v_family_id, v_user_id, 'DISNEY', cat_assinaturas, sub_streaming),
    (v_family_id, v_user_id, 'APPLE', cat_assinaturas, sub_softwares),
    (v_family_id, v_user_id, 'GOOGLE ONE', cat_assinaturas, sub_softwares);

  -- Compras & Vestuário keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'ZARA', cat_compras, sub_roupas),
    (v_family_id, v_user_id, 'RENNER', cat_compras, sub_roupas),
    (v_family_id, v_user_id, 'RIACHUELO', cat_compras, sub_roupas),
    (v_family_id, v_user_id, 'SHEIN', cat_compras, sub_roupas),
    (v_family_id, v_user_id, 'SHOPEE', cat_compras, sub_roupas),
    (v_family_id, v_user_id, 'MERCADO LIVRE', cat_compras, sub_eletronicos),
    (v_family_id, v_user_id, 'AMAZON COMPRAS', cat_compras, sub_eletronicos);

  -- Pets keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'PETZ', cat_pets, sub_banho),
    (v_family_id, v_user_id, 'COBASI', cat_pets, sub_banho),
    (v_family_id, v_user_id, 'PET SHOP', cat_pets, sub_banho),
    (v_family_id, v_user_id, 'VETERINARIO', cat_pets, sub_vet),
    (v_family_id, v_user_id, 'VETERINÁRIO', cat_pets, sub_vet),
    (v_family_id, v_user_id, 'ROYAL CANIN', cat_pets, sub_racao),
    (v_family_id, v_user_id, 'PREMIER PET', cat_pets, sub_racao);

  -- Reserva de Emergência keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'TESOURO SELIC', cat_reserva, sub_aportes_reserva),
    (v_family_id, v_user_id, 'CDB LIQUIDEZ DIARIA', cat_reserva, sub_aportes_reserva),
    (v_family_id, v_user_id, 'RESERVA', cat_reserva, sub_aportes_reserva),
    (v_family_id, v_user_id, 'CAIXINHA NUBANK', cat_reserva, sub_aportes_reserva);

  -- Metas & Grandes Sonhos keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'FUNDO VIAGEM', cat_metas, sub_viagem_internacional),
    (v_family_id, v_user_id, 'ENTRADA APTO', cat_metas, sub_casa_propria),
    (v_family_id, v_user_id, 'CONSORCIO', cat_metas, sub_troca_carro),
    (v_family_id, v_user_id, 'META', cat_metas, sub_reforma);

  -- Investimentos de Longo Prazo keywords
  INSERT INTO public.categorization_rules (family_id, user_id, pattern, category_id, subcategory_id) VALUES
    (v_family_id, v_user_id, 'XP INVESTIMENTOS', cat_investimentos, sub_acoes_fiis),
    (v_family_id, v_user_id, 'BTG', cat_investimentos, sub_acoes_fiis),
    (v_family_id, v_user_id, 'INTER INVEST', cat_investimentos, sub_acoes_fiis),
    (v_family_id, v_user_id, 'PREVIDENCIA', cat_investimentos, sub_previdencia),
    (v_family_id, v_user_id, 'TESOURO IPCA', cat_investimentos, sub_acoes_fiis);

  RETURN v_family_id;
END;
$$;
