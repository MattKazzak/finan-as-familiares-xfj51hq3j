-- Migração Rodada 14: Atualização da Taxonomia Oficial Curiangoo (Decisões D0 a D4)
-- Preserva IDs existentes, renomeia categorias, insere Dívidas & Empréstimos e novas categorias de receita,
-- insere novas subcategorias de Restaurantes & Delivery, reponta transações de Lanches Rápidos para Fast Food & Lanches,
-- e limpa redundâncias legadas de subcategorias em Gastronomia.

DO $$
DECLARE
  fam RECORD;
  v_fam_id UUID;
  v_restaurantes_id UUID;
  v_fast_food_id UUID;
  v_lanches_rapidos_id UUID;
  v_cafeterias_id UUID;
  v_dividas_id UUID;
  v_trab_extras_id UUID;
  v_outras_rec_id UUID;
BEGIN
  -- 1. [D0 — Renomeações de Categorias Mestras preservando IDs]
  -- Executado em todas as famílias existentes
  UPDATE public.transaction_categories
  SET name = 'Alimentação'
  WHERE name = 'Alimentação Básica';

  UPDATE public.transaction_categories
  SET name = 'Transporte'
  WHERE name = 'Transporte Obrigatório';

  UPDATE public.transaction_categories
  SET name = 'Saúde'
  WHERE name = 'Saúde & Cuidados Médicos';

  UPDATE public.transaction_categories
  SET name = 'Educação'
  WHERE name = 'Educação Obrigatória';

  UPDATE public.transaction_categories
  SET name = 'Restaurantes & Delivery'
  WHERE name = 'Gastronomia & Delivery';

  UPDATE public.transaction_categories
  SET name = 'Lazer'
  WHERE name = 'Lazer & Passeios';

  UPDATE public.transaction_categories
  SET name = 'Assinaturas & Apps'
  WHERE name = 'Assinaturas & Conectividade';

  UPDATE public.transaction_categories
  SET name = 'Compras'
  WHERE name = 'Compras & Vestuário';

  UPDATE public.transaction_categories
  SET name = 'Metas'
  WHERE name = 'Metas & Grandes Sonhos';

  UPDATE public.transaction_categories
  SET name = 'Investimentos'
  WHERE name = 'Investimentos de Longo Prazo';

  -- 2. Processamento por família ativa
  FOR fam IN SELECT id FROM public.families LOOP
    v_fam_id := fam.id;

    -- Reordenação preventiva para abrir espaço para sort_order 6 (Dívidas & Empréstimos)
    -- As categorias com sort_order >= 6 têm seu sort_order incrementado em 1
    UPDATE public.transaction_categories
    SET sort_order = sort_order + 1
    WHERE family_id = v_fam_id AND sort_order >= 6;

    -- [D1 — Nova Categoria: Dívidas & Empréstimos]
    -- essentials, #DC2626, CreditCard, sort_order 6
    SELECT id INTO v_dividas_id
    FROM public.transaction_categories
    WHERE family_id = v_fam_id AND name = 'Dívidas & Empréstimos';

    IF v_dividas_id IS NULL THEN
      INSERT INTO public.transaction_categories (
        family_id, name, icon, color, type, budget_bucket, sort_order
      ) VALUES (
        v_fam_id, 'Dívidas & Empréstimos', 'CreditCard', '#DC2626', 'expense', 'essentials', 6
      ) RETURNING id INTO v_dividas_id;
    ELSE
      UPDATE public.transaction_categories
      SET icon = 'CreditCard', color = '#DC2626', type = 'expense', budget_bucket = 'essentials', sort_order = 6
      WHERE id = v_dividas_id;
    END IF;

    -- Subcategorias de Dívidas & Empréstimos
    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_dividas_id, v_fam_id, 'Fatura do Cartão (Rotativo & Parcelado)', 'CreditCard', '#DC2626', 1)
    ON CONFLICT (category_id, name) DO NOTHING;

    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_dividas_id, v_fam_id, 'Empréstimos Pessoais', 'Banknote', '#DC2626', 2)
    ON CONFLICT (category_id, name) DO NOTHING;

    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_dividas_id, v_fam_id, 'Financiamentos (Casa/Auto)', 'Home', '#DC2626', 3)
    ON CONFLICT (category_id, name) DO NOTHING;

    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_dividas_id, v_fam_id, 'Cheque Especial & Overdraft', 'AlertCircle', '#DC2626', 4)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- [D2 — Nova Categoria de Receita: Trabalhos Extras & Autônomo]
    -- #0EA5E9, Hammer, após Salário
    SELECT id INTO v_trab_extras_id
    FROM public.transaction_categories
    WHERE family_id = v_fam_id AND name = 'Trabalhos Extras & Autônomo';

    IF v_trab_extras_id IS NULL THEN
      INSERT INTO public.transaction_categories (
        family_id, name, icon, color, type, budget_bucket, sort_order
      ) VALUES (
        v_fam_id, 'Trabalhos Extras & Autônomo', 'Hammer', '#0EA5E9', 'income', NULL, 18
      ) RETURNING id INTO v_trab_extras_id;
    END IF;

    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_trab_extras_id, v_fam_id, 'Freelances & Bicos', 'Hammer', '#0EA5E9', 1)
    ON CONFLICT (category_id, name) DO NOTHING;

    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_trab_extras_id, v_fam_id, 'Venda de Produtos', 'ShoppingBag', '#0EA5E9', 2)
    ON CONFLICT (category_id, name) DO NOTHING;

    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_trab_extras_id, v_fam_id, 'MEI & Autônomo', 'Briefcase', '#0EA5E9', 3)
    ON CONFLICT (category_id, name) DO NOTHING;

    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_trab_extras_id, v_fam_id, 'Comissões & Gorjetas', 'Coins', '#0EA5E9', 4)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- [D3 — Nova Categoria de Receita: Outras Receitas]
    -- #64748B, Undo2, após Trabalhos Extras & Autônomo
    SELECT id INTO v_outras_rec_id
    FROM public.transaction_categories
    WHERE family_id = v_fam_id AND name = 'Outras Receitas';

    IF v_outras_rec_id IS NULL THEN
      INSERT INTO public.transaction_categories (
        family_id, name, icon, color, type, budget_bucket, sort_order
      ) VALUES (
        v_fam_id, 'Outras Receitas', 'Undo2', '#64748B', 'income', NULL, 19
      ) RETURNING id INTO v_outras_rec_id;
    END IF;

    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_outras_rec_id, v_fam_id, 'Reembolsos & Estornos', 'Undo2', '#64748B', 1)
    ON CONFLICT (category_id, name) DO NOTHING;

    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_outras_rec_id, v_fam_id, 'Cashback & Milhas', 'Coins', '#64748B', 2)
    ON CONFLICT (category_id, name) DO NOTHING;

    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_outras_rec_id, v_fam_id, 'Presentes Recebidos', 'Gift', '#64748B', 3)
    ON CONFLICT (category_id, name) DO NOTHING;

    INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
    VALUES (v_outras_rec_id, v_fam_id, 'Vendas de Itens Usados', 'Tag', '#64748B', 4)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- [D4 — Subcategorias de Restaurantes & Delivery]
    -- Identifica o ID da categoria Restaurantes & Delivery na família
    SELECT id INTO v_restaurantes_id
    FROM public.transaction_categories
    WHERE family_id = v_fam_id AND name = 'Restaurantes & Delivery';

    IF v_restaurantes_id IS NOT NULL THEN
      -- Garante Restaurantes & Bares
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_restaurantes_id, v_fam_id, 'Restaurantes & Bares', 'Utensils', '#F59E0B', 1)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 1;

      -- Garante Delivery (iFood/Rappi)
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_restaurantes_id, v_fam_id, 'Delivery (iFood/Rappi)', 'Package', '#F59E0B', 2)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 2;

      -- Cria ou renomeia "Cafeterias & Lanches Rápidos" para "Fast Food & Lanches"
      SELECT id INTO v_fast_food_id
      FROM public.transaction_subcategories
      WHERE category_id = v_restaurantes_id AND name = 'Fast Food & Lanches';

      IF v_fast_food_id IS NULL THEN
        -- Se existir "Cafeterias & Lanches Rápidos", renomeia para "Fast Food & Lanches"
        UPDATE public.transaction_subcategories
        SET name = 'Fast Food & Lanches', sort_order = 3
        WHERE category_id = v_restaurantes_id AND name = 'Cafeterias & Lanches Rápidos'
        RETURNING id INTO v_fast_food_id;

        -- Se não existia a anterior para renomear, insere
        IF v_fast_food_id IS NULL THEN
          INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
          VALUES (v_restaurantes_id, v_fam_id, 'Fast Food & Lanches', 'Coffee', '#F59E0B', 3)
          ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 3
          RETURNING id INTO v_fast_food_id;
        END IF;
      ELSE
        UPDATE public.transaction_subcategories SET sort_order = 3 WHERE id = v_fast_food_id;
      END IF;

      -- Reponta transações da subcategoria legada "Lanches Rápidos" para "Fast Food & Lanches"
      SELECT id INTO v_lanches_rapidos_id
      FROM public.transaction_subcategories
      WHERE category_id = v_restaurantes_id AND name = 'Lanches Rápidos';

      IF v_lanches_rapidos_id IS NOT NULL AND v_fast_food_id IS NOT NULL THEN
        UPDATE public.transactions
        SET subcategory_id = v_fast_food_id
        WHERE subcategory_id = v_lanches_rapidos_id;

        -- Deleta subcategoria legada redundante "Lanches Rápidos"
        DELETE FROM public.transaction_subcategories
        WHERE id = v_lanches_rapidos_id;
      END IF;

      -- Garante subcategoria isolada "Cafeterias"
      SELECT id INTO v_cafeterias_id
      FROM public.transaction_subcategories
      WHERE category_id = v_restaurantes_id AND name = 'Cafeterias';

      IF v_cafeterias_id IS NULL THEN
        -- Se houver "Cafeterias, Doces & Lanches", renomeia para "Cafeterias"
        UPDATE public.transaction_subcategories
        SET name = 'Cafeterias', sort_order = 4
        WHERE category_id = v_restaurantes_id AND name = 'Cafeterias, Doces & Lanches'
        RETURNING id INTO v_cafeterias_id;

        IF v_cafeterias_id IS NULL THEN
          INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
          VALUES (v_restaurantes_id, v_fam_id, 'Cafeterias', 'Coffee', '#F59E0B', 4)
          ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 4
          RETURNING id INTO v_cafeterias_id;
        END IF;
      ELSE
        UPDATE public.transaction_subcategories SET sort_order = 4 WHERE id = v_cafeterias_id;
      END IF;

      -- Limpa redundância legada "Delivery & Fast-food (iFood/Rappi)" caso ainda exista
      -- Reponta transações para "Delivery (iFood/Rappi)" se houver
      UPDATE public.transactions
      SET subcategory_id = (
        SELECT id FROM public.transaction_subcategories
        WHERE category_id = v_restaurantes_id AND name = 'Delivery (iFood/Rappi)' LIMIT 1
      )
      WHERE subcategory_id IN (
        SELECT id FROM public.transaction_subcategories
        WHERE category_id = v_restaurantes_id AND name = 'Delivery & Fast-food (iFood/Rappi)'
      );

      DELETE FROM public.transaction_subcategories
      WHERE category_id = v_restaurantes_id AND name = 'Delivery & Fast-food (iFood/Rappi)';

      -- Limpa "Cafeterias, Doces & Lanches" caso ainda tenha sobrado após termos "Cafeterias"
      DELETE FROM public.transaction_subcategories
      WHERE category_id = v_restaurantes_id AND name = 'Cafeterias, Doces & Lanches';

      -- Novas subcategorias de Restaurantes & Delivery:
      -- "Sorvete & Açaí"
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_restaurantes_id, v_fam_id, 'Sorvete & Açaí', 'IceCream', '#F59E0B', 5)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 5;

      -- "Conveniência & Lanchonetes de Posto"
      INSERT INTO public.transaction_subcategories (category_id, family_id, name, icon, color, sort_order)
      VALUES (v_restaurantes_id, v_fam_id, 'Conveniência & Lanchonetes de Posto', 'Store', '#F59E0B', 6)
      ON CONFLICT (category_id, name) DO UPDATE SET sort_order = 6;
    END IF;
  END LOOP;
END $$;
