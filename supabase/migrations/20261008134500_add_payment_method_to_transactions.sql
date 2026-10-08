ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'other';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_transaction_payment_method'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT chk_transaction_payment_method
      CHECK (payment_method IS NULL OR payment_method IN ('pix', 'credit', 'debit', 'cash', 'voucher', 'other'));
  END IF;
END $$;
