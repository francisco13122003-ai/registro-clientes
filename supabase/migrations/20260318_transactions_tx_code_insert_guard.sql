BEGIN;

-- Blindaje mínimo para nuevas altas:
-- - No toca históricos.
-- - No renumera.
-- - Respeta tx_code informado por frontend.
-- - Genera tx_code solo en INSERT cuando falta o viene vacío.

CREATE OR REPLACE FUNCTION public.transactions_generate_tx_code_if_missing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_kind_key text;
  v_prefix text;
  v_effective_date date;
  v_year_suffix text;
  v_next_seq bigint;
BEGIN
  -- Solo actuar cuando tx_code no viene realmente informado.
  IF NEW.tx_code IS NOT NULL AND btrim(NEW.tx_code) <> '' THEN
    RETURN NEW;
  END IF;

  v_kind_key := lower(COALESCE(NEW.kind, ''));
  v_prefix := CASE v_kind_key
    WHEN 'ticket' THEN 'TK'
    WHEN 'factura' THEN 'FC'
    WHEN 'otro' THEN 'OT'
    WHEN 'otros' THEN 'OT'
    WHEN 'nico' THEN 'NC'
    ELSE 'OT'
  END;

  -- Año real del registro: prioriza tx_date, luego created_at (si viene),
  -- y como última red de seguridad, fecha UTC actual.
  v_effective_date := COALESCE(
    NEW.tx_date,
    (NEW.created_at AT TIME ZONE 'UTC')::date,
    (now() AT TIME ZONE 'UTC')::date
  );
  v_year_suffix := to_char(v_effective_date, 'YY');

  -- Serialización por tipo+año para concurrencia razonable.
  PERFORM pg_advisory_xact_lock(hashtextextended('transactions:tx_code:' || v_prefix || ':' || v_year_suffix, 0));

  SELECT COALESCE(
           MAX((regexp_match(t.tx_code, ('^' || v_prefix || '-(\\d+)-' || v_year_suffix || '$')))[1]::bigint),
           0
         ) + 1
    INTO v_next_seq
  FROM public.transactions t
  WHERE t.tx_code ~ ('^' || v_prefix || '-\\d+-' || v_year_suffix || '$');

  NEW.tx_code := v_prefix || '-' || lpad(v_next_seq::text, 5, '0') || '-' || v_year_suffix;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_generate_tx_code_if_missing ON public.transactions;
CREATE TRIGGER trg_transactions_generate_tx_code_if_missing
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.transactions_generate_tx_code_if_missing();

-- Inmutabilidad en UPDATE:
-- Si ya existe tx_code, no se puede alterar ni regenerar.
CREATE OR REPLACE FUNCTION public.transactions_tx_code_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.tx_code IS NOT NULL
     AND btrim(OLD.tx_code) <> ''
     AND NEW.tx_code IS DISTINCT FROM OLD.tx_code THEN
    NEW.tx_code := OLD.tx_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_tx_code_immutable_guard ON public.transactions;
CREATE TRIGGER trg_transactions_tx_code_immutable_guard
BEFORE UPDATE OF tx_code ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.transactions_tx_code_immutable_guard();

COMMIT;
