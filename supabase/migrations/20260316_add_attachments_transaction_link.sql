BEGIN;

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS transaction_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_attachments_transaction_id
  ON public.attachments (transaction_id);

COMMENT ON COLUMN public.attachments.transaction_id IS
  'Optional link to transaction when attachment is an auto-generated transaction PDF.';

COMMIT;
