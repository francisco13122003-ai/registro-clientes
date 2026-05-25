BEGIN;

CREATE TABLE IF NOT EXISTS public.transaction_code_counters (
  code_prefix text NOT NULL,
  year_suffix text NOT NULL,
  last_number integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_code_counters_pkey PRIMARY KEY (code_prefix, year_suffix)
);

ALTER TABLE public.transaction_code_counters ENABLE ROW LEVEL SECURITY;

WITH historical_max AS (
  SELECT
    upper((regexp_match(t.tx_code, '^([A-Z]{2})-(\d+)-(\d{2})$'))[1]) AS code_prefix,
    (regexp_match(t.tx_code, '^([A-Z]{2})-(\d+)-(\d{2})$'))[3] AS year_suffix,
    MAX(((regexp_match(t.tx_code, '^([A-Z]{2})-(\d+)-(\d{2})$'))[2])::integer) AS last_number
  FROM public.transactions t
  WHERE t.tx_code ~ '^[A-Z]{2}-\d+-\d{2}$'
  GROUP BY 1, 2
)
INSERT INTO public.transaction_code_counters (code_prefix, year_suffix, last_number, updated_at)
SELECT hm.code_prefix, hm.year_suffix, hm.last_number, now()
FROM historical_max hm
ON CONFLICT (code_prefix, year_suffix)
DO UPDATE SET
  last_number = GREATEST(public.transaction_code_counters.last_number, EXCLUDED.last_number),
  updated_at = CASE
    WHEN GREATEST(public.transaction_code_counters.last_number, EXCLUDED.last_number)
         IS DISTINCT FROM public.transaction_code_counters.last_number
    THEN now()
    ELSE public.transaction_code_counters.updated_at
  END;

CREATE OR REPLACE FUNCTION public.transaction_code_prefix(p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text := lower(trim(coalesce(p_kind, '')));
BEGIN
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

CREATE OR REPLACE FUNCTION public.claim_transaction_tx_code(
  p_kind text,
  p_effective_date timestamptz,
  p_proposed_tx_code text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_year_suffix text;
  v_next_number integer;
  v_result text;
  v_proposed text := upper(trim(coalesce(p_proposed_tx_code, '')));
  v_match text[];
  v_proposed_prefix text;
  v_proposed_number integer;
  v_proposed_year text;
BEGIN
  v_prefix := public.transaction_code_prefix(p_kind);
  v_year_suffix := to_char(coalesce(p_effective_date, now()) AT TIME ZONE 'UTC', 'YY');

  IF v_proposed <> '' THEN
    v_match := regexp_match(v_proposed, '^([A-Z]{2})-(\d+)-(\d{2})$');

    IF v_match IS NOT NULL THEN
      v_proposed_prefix := v_match[1];
      v_proposed_number := v_match[2]::integer;
      v_proposed_year := v_match[3];

      IF v_proposed_prefix = v_prefix AND v_proposed_year = v_year_suffix THEN
        INSERT INTO public.transaction_code_counters (code_prefix, year_suffix, last_number, updated_at)
        VALUES (v_prefix, v_year_suffix, v_proposed_number, now())
        ON CONFLICT (code_prefix, year_suffix)
        DO UPDATE SET
          last_number = GREATEST(public.transaction_code_counters.last_number, EXCLUDED.last_number),
          updated_at = CASE
            WHEN GREATEST(public.transaction_code_counters.last_number, EXCLUDED.last_number)
                 IS DISTINCT FROM public.transaction_code_counters.last_number
            THEN now()
            ELSE public.transaction_code_counters.updated_at
          END;

        RETURN v_proposed;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.transaction_code_counters (code_prefix, year_suffix, last_number, updated_at)
  VALUES (v_prefix, v_year_suffix, 1, now())
  ON CONFLICT (code_prefix, year_suffix)
  DO UPDATE SET
    last_number = public.transaction_code_counters.last_number + 1,
    updated_at = now()
  RETURNING last_number INTO v_next_number;

  v_result := v_prefix || '-' || lpad(v_next_number::text, 5, '0') || '-' || v_year_suffix;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.transactions_generate_tx_code_if_missing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_ts timestamptz;
BEGIN
  v_effective_ts := COALESCE(
    NEW.tx_date::timestamptz,
    NEW.created_at,
    now()
  );

  IF NEW.tx_code IS NULL OR btrim(NEW.tx_code) = '' THEN
    NEW.tx_code := public.claim_transaction_tx_code(NEW.kind, v_effective_ts, NULL);
  ELSE
    NEW.tx_code := upper(trim(NEW.tx_code));
    PERFORM public.claim_transaction_tx_code(NEW.kind, v_effective_ts, NEW.tx_code);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_generate_tx_code_if_missing ON public.transactions;
DROP TRIGGER IF EXISTS trg_transactions_generate_tx_code_if_missing ON public.transactions;
CREATE TRIGGER transactions_generate_tx_code_if_missing
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.transactions_generate_tx_code_if_missing();

COMMIT;
