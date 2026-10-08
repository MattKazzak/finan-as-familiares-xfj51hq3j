-- Migração Rodada 15: Subcategorias Definitivas do Onboarding (116 subcategorias por família)
-- 1. Renomeia com preservação de IDs em ambas as famílias
-- 2. Trata os Splits: renomeia a subcategoria existente e cria a subcategoria irmã
-- 3. Insere todas as novas subcategorias com ON CONFLICT (category_id, name) DO NOTHING / DO UPDATE
-- 4. Reponta transações legadas caso existam (ex: "Geral" em Rendimentos para "Juros & Rendimento de Aplicações")

DO $$
DECLARE
  fam RECORD;
  v_fam_id UUID;
  v_cat_id UUID;
BEGIN
  FOR fam IN SELECT id FROM public.families LOOP
    v_fam_id := fam.id;

    -- =========================================================================
    -- 1. MORADIA (11 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Moradia' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      -- [RENAME] "Aluguel/Condomínio" / "Aluguel / Condomínio" -> "Aluguel & Condomínio"
      UPDATE public.transaction_subcategories
      SET name = 'Aluguel & Condomínio', sort_order = 1
      WHERE category_id = v_cat_id AND (name = 'Aluguel/Condomínio' OR name = 'Aluguel / Condomínio');

      -- [INALTERADAS 2..5]
      UPDATE public.transaction_subcategories SET sort_order = 2 WHERE category_id = v_cat_id AND name = 'Energia Elétrica';
      UPDATE public.transaction_subcategories SET sort_order = 3 WHERE category_id = v_cat_id AND name = 'Água & Saneamento';
      UPDATE public.transaction_subcategories SET sort_order = 4 WHERE category_id = v_cat_id AND name = 'Gás';
      UPDATE public.transaction_subcategories SET sort_order = 5 WHERE category_id = v_cat_id AND name = 'Internet & Fixo';

      -- [RENAME] "Manutenção da Casa" -> "Manutenção & Reparos"
      UPDATE public.transaction_subcategories
      SET name = 'Manutenção & Reparos', sort_order = 9
      WHERE category_id = v_cat_id AND name = 'Manutenção da Casa';

      -- [NOVAS]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Celular & Telefonia', 'Smartphone', '#6366F1', 6)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 6;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'IPTU & Taxas do Imóvel', 'Landmark', '#6366F1', 7)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 7;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Seguro Residencial', 'Shield', '#6366F1', 8)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 8;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Serviços Domésticos', 'Sparkles', '#6366F1', 10)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 10;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Mudança', 'Truck', '#6366F1', 11)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 11;
    END IF;

    -- =========================================================================
    -- 2. ALIMENTAÇÃO (6 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Alimentação' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      -- [RENAME] "Supermercado" -> "Supermercado & Atacado"
      UPDATE public.transaction_subcategories
      SET name = 'Supermercado & Atacado', sort_order = 1
      WHERE category_id = v_cat_id AND name = 'Supermercado';

      -- [INALTERADAS]
      UPDATE public.transaction_subcategories SET sort_order = 2 WHERE category_id = v_cat_id AND name = 'Açougue & Peixaria';
      UPDATE public.transaction_subcategories SET sort_order = 3 WHERE category_id = v_cat_id AND name = 'Hortifruti & Feira';

      -- [RENAME] "Padaria do Dia a Dia" -> "Padaria & Mercearia"
      UPDATE public.transaction_subcategories
      SET name = 'Padaria & Mercearia', sort_order = 4
      WHERE category_id = v_cat_id AND name = 'Padaria do Dia a Dia';

      -- [NOVAS]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Água & Bebidas para Casa', 'Droplets', '#10B981', 5)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 5;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Limpeza & Higiene da Casa', 'Sparkles', '#10B981', 6)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 6;
    END IF;

    -- =========================================================================
    -- 3. TRANSPORTE (7 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Transporte' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      -- [INALTERADA]
      UPDATE public.transaction_subcategories SET sort_order = 1 WHERE category_id = v_cat_id AND name = 'Combustível';

      -- [RENAME] "Transporte Público & Bilhete" -> "Transporte Público"
      UPDATE public.transaction_subcategories
      SET name = 'Transporte Público', sort_order = 2
      WHERE category_id = v_cat_id AND (name = 'Transporte Público & Bilhete' OR name = 'Transporte Público');

      -- [RENAME] "Aplicativos do Dia a Dia (Uber/99)" -> "Apps & Táxi (Uber/99)"
      UPDATE public.transaction_subcategories
      SET name = 'Apps & Táxi (Uber/99)', sort_order = 3
      WHERE category_id = v_cat_id AND (name = 'Aplicativos do Dia a Dia (Uber/99)' OR name = 'Apps & Táxi (Uber/99)');

      -- [INALTERADA]
      UPDATE public.transaction_subcategories SET sort_order = 4 WHERE category_id = v_cat_id AND name = 'Estacionamento & Pedágio';

      -- [RENAME] "Manutenção Básica" -> "Oficina & Manutenção"
      UPDATE public.transaction_subcategories
      SET name = 'Oficina & Manutenção', sort_order = 5
      WHERE category_id = v_cat_id AND name = 'Manutenção Básica';

      -- [RENAME] "Seguro & IPVA" -> "IPVA & Licenciamento"
      UPDATE public.transaction_subcategories
      SET name = 'IPVA & Licenciamento', sort_order = 6
      WHERE category_id = v_cat_id AND name = 'Seguro & IPVA';

      -- [NOVA]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Seguro do Veículo', 'ShieldCheck', '#3B82F6', 7)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 7;
    END IF;

    -- =========================================================================
    -- 4. SAÚDE (7 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Saúde' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      -- [RENAME] "Plano de Saúde" -> "Plano de Saúde & Convênio"
      UPDATE public.transaction_subcategories
      SET name = 'Plano de Saúde & Convênio', sort_order = 1
      WHERE category_id = v_cat_id AND name = 'Plano de Saúde';

      -- [NOVAS / INALTERADAS]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Coparticipação', 'CreditCard', '#EF4444', 2)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 2;

      UPDATE public.transaction_subcategories SET sort_order = 3 WHERE category_id = v_cat_id AND name = 'Consultas & Exames';
      UPDATE public.transaction_subcategories SET sort_order = 4 WHERE category_id = v_cat_id AND name = 'Farmácia & Medicamentos';
      UPDATE public.transaction_subcategories SET sort_order = 5 WHERE category_id = v_cat_id AND name = 'Odontologia';

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Terapias & Psicologia', 'HeartHandshake', '#EF4444', 6)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 6;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Óculos & Aparelhos', 'Eye', '#EF4444', 7)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 7;
    END IF;

    -- =========================================================================
    -- 5. EDUCAÇÃO (6 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Educação' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      -- Mensalidade Escolar / Faculdade pode ser renomeada para "Escola & Creche"
      -- (as transações existentes nela permanecem nela)
      UPDATE public.transaction_subcategories
      SET name = 'Escola & Creche', sort_order = 1
      WHERE category_id = v_cat_id AND name = 'Mensalidade Escolar / Faculdade';

      -- Se não existia "Escola & Creche", insere
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Escola & Creche', 'GraduationCap', '#8B5CF6', 1)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 1;

      -- [NOVA] Faculdade
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Faculdade', 'BookOpen', '#8B5CF6', 2)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 2;

      -- [NOVA] Cursos & Idiomas
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Cursos & Idiomas', 'Languages', '#8B5CF6', 3)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 3;

      -- [RENAME] "Material & Uniformes" -> "Material & Livros Didáticos"
      UPDATE public.transaction_subcategories
      SET name = 'Material & Livros Didáticos', sort_order = 4
      WHERE category_id = v_cat_id AND name = 'Material & Uniformes';

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Material & Livros Didáticos', 'Book', '#8B5CF6', 4)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 4;

      -- [NOVA] Uniformes
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Uniformes', 'Shirt', '#8B5CF6', 5)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 5;

      -- [INALTERADA] Transporte Escolar
      UPDATE public.transaction_subcategories SET sort_order = 6 WHERE category_id = v_cat_id AND name = 'Transporte Escolar';
    END IF;

    -- =========================================================================
    -- 6. DÍVIDAS & EMPRÉSTIMOS (7 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Dívidas & Empréstimos' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      -- [INALTERADA 1]
      UPDATE public.transaction_subcategories SET sort_order = 1 WHERE category_id = v_cat_id AND name = 'Fatura do Cartão (Rotativo & Parcelado)';
      -- [INALTERADA 2]
      UPDATE public.transaction_subcategories SET sort_order = 2 WHERE category_id = v_cat_id AND name = 'Empréstimos Pessoais';

      -- [SPLIT-RENAME] "Financiamentos (Casa/Auto)" -> "Financiamento Imobiliário"
      UPDATE public.transaction_subcategories
      SET name = 'Financiamento Imobiliário', sort_order = 3
      WHERE category_id = v_cat_id AND name = 'Financiamentos (Casa/Auto)';

      -- Se não existia, insere Financiamento Imobiliário
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Financiamento Imobiliário', 'Home', '#DC2626', 3)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 3;

      -- [SPLIT-NOVA] Financiamento de Veículo
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Financiamento de Veículo', 'Car', '#DC2626', 4)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 4;

      -- [INALTERADA 5]
      UPDATE public.transaction_subcategories SET sort_order = 5 WHERE category_id = v_cat_id AND name = 'Cheque Especial & Overdraft';

      -- [NOVAS]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Renegociações & Parcelamentos', 'Scale', '#DC2626', 6)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 6;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Juros & Multas', 'AlertTriangle', '#DC2626', 7)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 7;
    END IF;

    -- =========================================================================
    -- 7. RESTAURANTES & DELIVERY (7 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Restaurantes & Delivery' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      UPDATE public.transaction_subcategories SET sort_order = 1 WHERE category_id = v_cat_id AND name = 'Restaurantes & Bares';
      UPDATE public.transaction_subcategories SET sort_order = 2 WHERE category_id = v_cat_id AND name = 'Delivery (iFood/Rappi)';
      UPDATE public.transaction_subcategories SET sort_order = 3 WHERE category_id = v_cat_id AND name = 'Fast Food & Lanches';
      UPDATE public.transaction_subcategories SET sort_order = 4 WHERE category_id = v_cat_id AND name = 'Cafeterias';
      UPDATE public.transaction_subcategories SET sort_order = 5 WHERE category_id = v_cat_id AND name = 'Sorvete & Açaí';
      UPDATE public.transaction_subcategories SET sort_order = 6 WHERE category_id = v_cat_id AND name = 'Conveniência & Lanchonetes de Posto';

      -- [NOVA] Marmitas & Refeições no Trabalho
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Marmitas & Refeições no Trabalho', 'Salad', '#F59E0B', 7)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 7;
    END IF;

    -- =========================================================================
    -- 8. LAZER (7 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Lazer' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      UPDATE public.transaction_subcategories SET sort_order = 1 WHERE category_id = v_cat_id AND name = 'Cinema';
      UPDATE public.transaction_subcategories SET sort_order = 2 WHERE category_id = v_cat_id AND name = 'Shows & Eventos';

      -- [RENAME] "Passeios de Fim de Semana" -> "Passeios & Parques"
      UPDATE public.transaction_subcategories
      SET name = 'Passeios & Parques', sort_order = 3
      WHERE category_id = v_cat_id AND name = 'Passeios de Fim de Semana';

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Passeios & Parques', 'Sun', '#F97316', 3)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 3;

      -- [SPLIT-RENAME] "Viagens & Hospedagem" -> "Viagens: Passagens & Hospedagem"
      UPDATE public.transaction_subcategories
      SET name = 'Viagens: Passagens & Hospedagem', sort_order = 4
      WHERE category_id = v_cat_id AND name = 'Viagens & Hospedagem';

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Viagens: Passagens & Hospedagem', 'Plane', '#F97316', 4)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 4;

      -- [SPLIT-NOVA] Viagens: Passeios & Pacotes
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Viagens: Passeios & Pacotes', 'Compass', '#F97316', 5)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 5;

      -- [NOVAS]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Hobbies & Jogos', 'Gamepad2', '#F97316', 6)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 6;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Livros & Cultura', 'Book', '#F97316', 7)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 7;
    END IF;

    -- =========================================================================
    -- 9. CUIDADOS PESSOAIS & BEM-ESTAR (5 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Cuidados Pessoais & Bem-estar' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      -- [RENAME / NORMALIZAÇÃO] Barbearia / Salão de Beleza -> Barbearia/Salão
      UPDATE public.transaction_subcategories
      SET name = 'Barbearia/Salão', sort_order = 1
      WHERE category_id = v_cat_id AND name = 'Barbearia / Salão de Beleza';

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Barbearia/Salão', 'Scissors', '#EC4899', 1)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 1;

      UPDATE public.transaction_subcategories SET sort_order = 2 WHERE category_id = v_cat_id AND name = 'Manicure & Estética';
      UPDATE public.transaction_subcategories SET sort_order = 3 WHERE category_id = v_cat_id AND name = 'Cosméticos & Perfumaria';
      UPDATE public.transaction_subcategories SET sort_order = 4 WHERE category_id = v_cat_id AND name = 'Academia & Esportes';

      -- [NOVA]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Spa & Bem-estar', 'HeartPulse', '#EC4899', 5)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 5;
    END IF;

    -- =========================================================================
    -- 10. ASSINATURAS & APPS (7 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Assinaturas & Apps' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      -- [SPLIT-RENAME] "Streaming de Vídeo & Música" -> "Streaming de Vídeo"
      UPDATE public.transaction_subcategories
      SET name = 'Streaming de Vídeo', sort_order = 1
      WHERE category_id = v_cat_id AND name = 'Streaming de Vídeo & Música';

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Streaming de Vídeo', 'Tv', '#7C3AED', 1)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 1;

      -- [SPLIT-NOVA] Música & Podcasts
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Música & Podcasts', 'Music', '#7C3AED', 2)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 2;

      -- [INALTERADA 3]
      UPDATE public.transaction_subcategories SET sort_order = 3 WHERE category_id = v_cat_id AND name = 'Softwares & Apps';

      -- [NOVAS]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Jogos & Gaming', 'Gamepad', '#7C3AED', 4)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 4;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Jornais & Revistas Digitais', 'Newspaper', '#7C3AED', 5)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 5;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Armazenamento & Nuvem', 'Cloud', '#7C3AED', 6)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 6;

      -- [INALTERADA 7]
      UPDATE public.transaction_subcategories SET sort_order = 7 WHERE category_id = v_cat_id AND name = 'Clubes de Assinatura';
    END IF;

    -- =========================================================================
    -- 11. COMPRAS (8 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Compras' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      -- [SPLIT-RENAME] "Roupas & Calçados" -> "Roupas"
      UPDATE public.transaction_subcategories
      SET name = 'Roupas', sort_order = 1
      WHERE category_id = v_cat_id AND name = 'Roupas & Calçados';

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Roupas', 'Shirt', '#D97706', 1)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 1;

      -- [SPLIT-NOVA] Calçados
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Calçados', 'ShoppingBag', '#D97706', 2)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 2;

      -- [INALTERADA] Eletrônicos & Gadgets
      UPDATE public.transaction_subcategories SET sort_order = 3 WHERE category_id = v_cat_id AND name = 'Eletrônicos & Gadgets';

      -- [NOVA] Eletrodomésticos
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Eletrodomésticos', 'Tv', '#D97706', 4)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 4;

      -- [RENAME] "Decoração & Utilidades" -> "Móveis & Decoração"
      UPDATE public.transaction_subcategories
      SET name = 'Móveis & Decoração', sort_order = 5
      WHERE category_id = v_cat_id AND name = 'Decoração & Utilidades';

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Móveis & Decoração', 'Home', '#D97706', 5)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 5;

      -- [NOVA] Utilidades & Casa
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Utilidades & Casa', 'Package', '#D97706', 6)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 6;

      -- [INALTERADA] Presentes
      UPDATE public.transaction_subcategories SET sort_order = 7 WHERE category_id = v_cat_id AND name = 'Presentes';

      -- [NOVA] Bebês & Crianças
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Bebês & Crianças', 'Smile', '#D97706', 8)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 8;
    END IF;

    -- =========================================================================
    -- 12. PETS (3 subcategorias - todas inalteradas)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Pets' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      UPDATE public.transaction_subcategories SET sort_order = 1 WHERE category_id = v_cat_id AND name = 'Ração & Petiscos';
      UPDATE public.transaction_subcategories SET sort_order = 2 WHERE category_id = v_cat_id AND name = 'Veterinário & Vacinas';
      UPDATE public.transaction_subcategories SET sort_order = 3 WHERE category_id = v_cat_id AND name = 'Banho, Tosa & Acessórios';
    END IF;

    -- =========================================================================
    -- 13. RESERVA DE EMERGÊNCIA (2 subcategorias - inalteradas)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Reserva de Emergência' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      UPDATE public.transaction_subcategories SET sort_order = 1 WHERE category_id = v_cat_id AND name = 'Aportes na Reserva';
      UPDATE public.transaction_subcategories SET sort_order = 2 WHERE category_id = v_cat_id AND name = 'Resgates Emergenciais';
    END IF;

    -- =========================================================================
    -- 14. METAS (6 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Metas' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      UPDATE public.transaction_subcategories SET sort_order = 1 WHERE category_id = v_cat_id AND name = 'Troca de Carro';
      UPDATE public.transaction_subcategories SET sort_order = 2 WHERE category_id = v_cat_id AND name = 'Casa Própria';
      UPDATE public.transaction_subcategories SET sort_order = 3 WHERE category_id = v_cat_id AND name = 'Viagem Internacional';
      UPDATE public.transaction_subcategories SET sort_order = 4 WHERE category_id = v_cat_id AND name = 'Reforma';

      -- [NOVAS]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Educação Futura (dos Filhos)', 'GraduationCap', '#06B6D4', 5)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 5;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Meta Livre', 'Target', '#06B6D4', 6)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 6;
    END IF;

    -- =========================================================================
    -- 15. INVESTIMENTOS (7 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Investimentos' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      -- [NOVAS 1 & 2]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Tesouro Direto', 'Landmark', '#059669', 1)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 1;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Renda Fixa (CDB/LCI/LCA)', 'Banknote', '#059669', 2)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 2;

      -- [RENAME] "Ações & Fundos Imobiliários" -> "Ações & ETFs"
      UPDATE public.transaction_subcategories
      SET name = 'Ações & ETFs', sort_order = 3
      WHERE category_id = v_cat_id AND name = 'Ações & Fundos Imobiliários';

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Ações & ETFs', 'TrendingUp', '#059669', 3)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 3;

      -- [NOVAS 4 & 5]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Fundos Imobiliários (FIIs)', 'Building', '#059669', 4)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 4;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Criptomoedas', 'Coins', '#059669', 5)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 5;

      -- [INALTERADAS 6 & 7]
      UPDATE public.transaction_subcategories SET sort_order = 6 WHERE category_id = v_cat_id AND name = 'Previdência Privada';
      UPDATE public.transaction_subcategories SET sort_order = 7 WHERE category_id = v_cat_id AND name = 'Aposentadoria';
    END IF;

    -- =========================================================================
    -- 16. SALÁRIO (5 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Salário' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      UPDATE public.transaction_subcategories SET sort_order = 1 WHERE category_id = v_cat_id AND name = 'Salário Principal';

      -- [NOVAS]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, '13º & Férias', 'Gift', '#10B981', 2)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 2;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Bônus & PLR', 'Coins', '#10B981', 3)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 3;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Horas Extras & Comissões', 'Clock', '#10B981', 4)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 4;

      UPDATE public.transaction_subcategories SET sort_order = 5 WHERE category_id = v_cat_id AND name = 'Benefícios (VR/VA)';
    END IF;

    -- =========================================================================
    -- 17. TRABALHOS EXTRAS & AUTÔNOMO (6 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Trabalhos Extras & Autônomo' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      UPDATE public.transaction_subcategories SET sort_order = 1 WHERE category_id = v_cat_id AND name = 'Freelances & Bicos';
      UPDATE public.transaction_subcategories SET sort_order = 2 WHERE category_id = v_cat_id AND name = 'Venda de Produtos';
      UPDATE public.transaction_subcategories SET sort_order = 3 WHERE category_id = v_cat_id AND name = 'MEI & Autônomo';
      UPDATE public.transaction_subcategories SET sort_order = 4 WHERE category_id = v_cat_id AND name = 'Comissões & Gorjetas';

      -- [NOVAS]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Cursos & Aulas Particulares', 'GraduationCap', '#0EA5E9', 5)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 5;

      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Infoprodutos & Conteúdo', 'Laptop', '#0EA5E9', 6)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 6;
    END IF;

    -- =========================================================================
    -- 18. OUTRAS RECEITAS (5 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Outras Receitas' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      UPDATE public.transaction_subcategories SET sort_order = 1 WHERE category_id = v_cat_id AND name = 'Reembolsos & Estornos';
      UPDATE public.transaction_subcategories SET sort_order = 2 WHERE category_id = v_cat_id AND name = 'Cashback & Milhas';
      UPDATE public.transaction_subcategories SET sort_order = 3 WHERE category_id = v_cat_id AND name = 'Presentes Recebidos';
      UPDATE public.transaction_subcategories SET sort_order = 4 WHERE category_id = v_cat_id AND name = 'Vendas de Itens Usados';

      -- [NOVA]
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Restituição de Imposto de Renda', 'FileText', '#64748B', 5)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 5;
    END IF;

    -- =========================================================================
    -- 19. RENDIMENTOS (4 subcategorias)
    -- =========================================================================
    SELECT id INTO v_cat_id FROM public.transaction_categories WHERE family_id = v_fam_id AND name = 'Rendimentos' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      -- Se houver subcategoria legada "Geral", renomeia para "Juros & Rendimento de Aplicações"
      -- para manter transações existentes nela
      UPDATE public.transaction_subcategories
      SET name = 'Juros & Rendimento de Aplicações', sort_order = 1
      WHERE category_id = v_cat_id AND (name = 'Geral' OR name = 'Rendimentos de Aplicações');

      -- Se não existia, insere
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Juros & Rendimento de Aplicações', 'Landmark', '#059669', 1)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 1;

      -- [NOVA] Dividendos & JCP
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Dividendos & JCP', 'TrendingUp', '#059669', 2)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 2;

      -- [NOVA] Aluguel Recebido
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Aluguel Recebido', 'Home', '#059669', 3)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 3;

      -- [NOVA] Aposentadoria & Pensão
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_cat_id, v_fam_id, 'Aposentadoria & Pensão', 'PiggyBank', '#059669', 4)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 4;
    END IF;

  END LOOP;
END $$;
