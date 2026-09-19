-- Adicionar campo bank_transaction_id à tabela transactions para conciliação inteligente com extratos bancários (OFX FITID ou hash de CSV)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS bank_transaction_id TEXT;

-- Índice para busca rápida por bank_transaction_id
CREATE INDEX IF NOT EXISTS idx_transactions_bank_tx_id
  ON public.transactions(bank_transaction_id);

-- Índice composto para acelerar buscas de conciliação por família, tipo e valor
CREATE INDEX IF NOT EXISTS idx_transactions_reconcile_lookup
  ON public.transactions(family_id, type, amount_cents, transaction_date);
