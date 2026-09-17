-- Categorias Padrão de Mercado com Alta Proposta de Valor (Estilo Nubank / GuiaBolso / Open Finance)
-- Insere categorias ricas para todas as famílias existentes e garante que novas famílias também as recebam

DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN SELECT id FROM public.families LOOP
    -- Receitas Padrão
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type)
    VALUES
      (f.id, 'Salário', 'Briefcase', '#10B981', 'income'),
      (f.id, 'Investimentos', 'TrendingUp', '#059669', 'income'),
      (f.id, 'Renda Extra', 'Sparkles', '#14B8A6', 'income'),
      (f.id, 'Outras Receitas', 'PiggyBank', '#34D399', 'income')
    ON CONFLICT DO NOTHING;

    -- Se já existia 'Rendimentos', podemos manter ou garantir Investimentos
    -- Despesas Padrão de Mercado
    INSERT INTO public.transaction_categories (family_id, name, icon, color, type)
    VALUES
      (f.id, 'Mercado', 'ShoppingBag', '#F59E0B', 'expense'),
      (f.id, 'Restaurantes e Delivery', 'Utensils', '#EA580C', 'expense'),
      (f.id, 'Transporte', 'Car', '#3B82F6', 'expense'),
      (f.id, 'Moradia', 'Home', '#6366F1', 'expense'),
      (f.id, 'Saúde', 'HeartPulse', '#EF4444', 'expense'),
      (f.id, 'Educação', 'GraduationCap', '#8B5CF6', 'expense'),
      (f.id, 'Lazer', 'Film', '#EC4899', 'expense'),
      (f.id, 'Compras', 'Tag', '#06B6D4', 'expense'),
      (f.id, 'Assinaturas e Serviços', 'Smartphone', '#6366F1', 'expense'),
      (f.id, 'Viagens', 'Plane', '#F97316', 'expense'),
      (f.id, 'Pets', 'PawPrint', '#84CC16', 'expense'),
      (f.id, 'Vestuário', 'Shirt', '#14B8A6', 'expense'),
      (f.id, 'Contas e Utilidades', 'Zap', '#EAB308', 'expense'),
      (f.id, 'Serviços Financeiros', 'CreditCard', '#64748B', 'expense'),
      (f.id, 'Outros', 'Tag', '#94A3B8', 'expense')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
