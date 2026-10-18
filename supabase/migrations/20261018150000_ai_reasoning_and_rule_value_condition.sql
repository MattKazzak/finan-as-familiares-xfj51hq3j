-- P2 (18/10): Curiango explica + regra com condição por valor
-- 1) ai_reasoning em transactions: o reasoning que a edge já retorna passa a ser
--    persistido no auto-aplicar — o detail mostra o pássaro explicando a categoria.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ai_reasoning text;

-- 2) max_amount_cents em categorization_rules (padrão Simplifi):
--    "no posto, até R$ 10 = Café; acima = Combustível". Regra só se aplica
--    quando amount_cents <= max_amount_cents (null = todos os valores).
ALTER TABLE public.categorization_rules ADD COLUMN IF NOT EXISTS max_amount_cents integer;