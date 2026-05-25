BEGIN;

-- Contador persistente por prefijo+año para evitar reutilización tras borrados.
CREATE TABLE IF NOT EXISTS public.transaction_code_counters (
  code_prefix text NOT NULL,
  year_suffix text NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code_prefix, year_suffix)
);

ALTER TABLE public.transaction_code_counters ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_transaction_code_counters_prefix_year
  ON public.transaction_code_counters (code_prefix, year_suffix);

-- Inicialización idempotente desde históricos compatibles con PREFIX-00001-YY.
INSERT INTO public.transaction_code_counters (code_prefix, year_suffix, last_number, updated_at)
SELECT
  m[1] AS code_prefix,
  m[3] AS year_suffix,
  MAX((m[2])::integer) AS last_number,
  now() AS updated_at
FROM (
  SELECT regexp_match(upper(btrim(t.tx_code)), '^([A-Z]{2})-(\d{1,})-(\d{2})$') AS m
  FROM public.transactions t
  WHERE t.tx_code IS NOT NULL
) parsed
WHERE parsed.m IS NOT NULL
GROUP BY m[1], m[3]
ON CONFLICT (code_prefix, year_suffix)
DO UPDATE SET
  last_number = GREATEST(public.transaction_code_counters.last_number, EXCLUDED.last_number),
  updated_at = now();

CREATE OR REPLACE FUNCTION public.transactions_kind_to_prefix(p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
BEGIN
  v_kind := lower(COALESCE(p_kind, ''));
  RETURN CASE v_kind
    WHEN 'ticket' THEN 'TK'
    WHEN 'factura' THEN 'FC'
    WHEN 'otro' THEN 'OT'
    WHEN 'otros' THEN 'OT'
    WHEN 'nico' THEN 'NC'
    ELSE 'OT'
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_transaction_tx_code(p_kind text, p_effective_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_year_suffix text;
  v_next_number integer;
BEGIN
  v_prefix := public.transactions_kind_to_prefix(p_kind);
  v_year_suffix := to_char(COALESCE(p_effective_date, (now() AT TIME ZONE 'UTC')::date), 'YY');

  INSERT INTO public.transaction_code_counters (code_prefix, year_suffix, last_number, updated_at)
  VALUES (v_prefix, v_year_suffix, 1, now())
  ON CONFLICT (code_prefix, year_suffix)
  DO UPDATE SET
    last_number = public.transaction_code_counters.last_number + 1,
    updated_at = now()
  RETURNING last_number INTO v_next_number;

  RETURN v_prefix || '-' || lpad(v_next_number::text, 5, '0') || '-' || v_year_suffix;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_transaction_tx_code_counter(p_tx_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match text[];
  v_prefix text;
  v_number integer;
  v_year_suffix text;
BEGIN
  IF p_tx_code IS NULL OR btrim(p_tx_code) = '' THEN
    RETURN;
  END IF;

  v_match := regexp_match(upper(btrim(p_tx_code)), '^([A-Z]{2})-(\d{1,})-(\d{2})$');
  IF v_match IS NULL THEN
    RETURN;
  END IF;

  v_prefix := v_match[1];
  v_number := v_match[2]::integer;
  v_year_suffix := v_match[3];

  INSERT INTO public.transaction_code_counters (code_prefix, year_suffix, last_number, updated_at)
  VALUES (v_prefix, v_year_suffix, v_number, now())
  ON CONFLICT (code_prefix, year_suffix)
  DO UPDATE SET
    last_number = GREATEST(public.transaction_code_counters.last_number, EXCLUDED.last_number),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.transactions_generate_tx_code_if_missing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_date date;
BEGIN
  v_effective_date := COALESCE(
    NEW.tx_date,
    (NEW.created_at AT TIME ZONE 'UTC')::date,
    (now() AT TIME ZONE 'UTC')::date
  );

  IF NEW.tx_code IS NULL OR btrim(NEW.tx_code) = '' THEN
    NEW.tx_code := public.next_transaction_tx_code(NEW.kind, v_effective_date);
  ELSE
    NEW.tx_code := upper(btrim(NEW.tx_code));
    PERFORM public.sync_transaction_tx_code_counter(NEW.tx_code);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_generate_tx_code_if_missing ON public.transactions;
CREATE TRIGGER trg_transactions_generate_tx_code_if_missing
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.transactions_generate_tx_code_if_missing();

COMMIT;
