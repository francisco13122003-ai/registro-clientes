ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS quantity numeric(12,3),
  ADD COLUMN IF NOT EXISTS unit_price numeric(12,2);

UPDATE public.transaction_items
   SET quantity = 1
 WHERE quantity IS NULL;

UPDATE public.transaction_items
   SET unit_price = amount
 WHERE unit_price IS NULL;

ALTER TABLE public.transaction_items
  ALTER COLUMN quantity SET DEFAULT 1,
  ALTER COLUMN quantity SET NOT NULL;
