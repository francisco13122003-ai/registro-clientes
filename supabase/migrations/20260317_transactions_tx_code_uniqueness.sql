BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS tx_code text;

COMMENT ON COLUMN public.transactions.tx_code IS
  'Identificador único e inmutable del registro (formato esperado: PP-00000-AA).';

-- Normalización defensiva de códigos existentes.
UPDATE public.transactions
SET tx_code = upper(trim(tx_code))
WHERE tx_code IS NOT NULL
  AND tx_code <> upper(trim(tx_code));

-- Backfill conservador solo para filas sin código, sin renumerar las que ya tienen.
WITH existing_max AS (
  SELECT
    kind,
    to_char(COALESCE(tx_date, created_at::date), 'YY') AS year_suffix,
    COALESCE(
      MAX(
        NULLIF(
          (regexp_match(tx_code, '^[A-Z]{2}-(\d+)-\d{2}(-.*)?$'))[1],
          ''
        )::int
      ),
      0
    ) AS max_seq
  FROM public.transactions
  WHERE tx_code IS NOT NULL
  GROUP BY kind, to_char(COALESCE(tx_date, created_at::date), 'YY')
), missing AS (
  SELECT
    t.id,
    t.kind,
    to_char(COALESCE(t.tx_date, t.created_at::date), 'YY') AS year_suffix,
    row_number() OVER (
      PARTITION BY t.kind, to_char(COALESCE(t.tx_date, t.created_at::date), 'YY')
      ORDER BY COALESCE(t.tx_date, t.created_at::date), t.created_at, t.id
    ) AS rn
  FROM public.transactions t
  WHERE t.tx_code IS NULL
)
UPDATE public.transactions t
SET tx_code = (
  (CASE t.kind
    WHEN 'ticket' THEN 'TK'
    WHEN 'factura' THEN 'FC'
    WHEN 'otro' THEN 'OT'
    WHEN 'nico' THEN 'NC'
    ELSE 'RG'
  END)
  || '-' || lpad((COALESCE(e.max_seq, 0) + m.rn)::text, 5, '0')
  || '-' || m.year_suffix
)
FROM missing m
LEFT JOIN existing_max e
  ON e.kind = m.kind
 AND e.year_suffix = m.year_suffix
WHERE t.id = m.id;

-- Si existiesen duplicados históricos, conservar el primero y ajustar el resto de forma no destructiva.
WITH dup AS (
  SELECT
    id,
    tx_code,
    row_number() OVER (PARTITION BY tx_code ORDER BY created_at, id) AS rn
  FROM public.transactions
  WHERE tx_code IS NOT NULL
)
UPDATE public.transactions t
SET tx_code = t.tx_code || '-DUP-' || substr(t.id::text, 1, 8)
FROM dup
WHERE t.id = dup.id
  AND dup.rn > 1;

-- A partir de aquí, cada código debe ser único si no es null.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_tx_code_unique
  ON public.transactions (tx_code)
  WHERE tx_code IS NOT NULL;

-- Inmutabilidad: si el código ya existe, no puede cambiarse en ediciones.
CREATE OR REPLACE FUNCTION public.transactions_tx_code_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.tx_code IS NOT NULL AND NEW.tx_code IS DISTINCT FROM OLD.tx_code THEN
    NEW.tx_code := OLD.tx_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_tx_code_immutable ON public.transactions;
CREATE TRIGGER trg_transactions_tx_code_immutable
BEFORE UPDATE OF tx_code ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.transactions_tx_code_immutable();

COMMIT;
