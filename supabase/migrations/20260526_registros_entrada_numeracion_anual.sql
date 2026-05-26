BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.registros_entrada
    GROUP BY entry_year, re_number
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply annual numbering migration: duplicate (entry_year, re_number) values exist in public.registros_entrada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registros_entrada
    WHERE re_code IS NULL OR btrim(re_code) = ''
  ) THEN
    RAISE EXCEPTION 'Cannot apply annual numbering migration: NULL or empty re_code values exist in public.registros_entrada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registros_entrada
    WHERE re_code !~ '^RE-[0-9]+-[0-9]{2}$'
  ) THEN
    RAISE EXCEPTION 'Cannot apply annual numbering migration: unexpected re_code format found in public.registros_entrada';
  END IF;
END
$$;

ALTER TABLE public.registros_entrada
  ALTER COLUMN re_number DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.registros_entrada'::regclass
      AND conname = 'registros_entrada_re_number_key'
  ) THEN
    ALTER TABLE public.registros_entrada
      DROP CONSTRAINT registros_entrada_re_number_key;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.registros_entrada'::regclass
      AND conname = 'registros_entrada_entry_year_re_number_key'
  ) THEN
    ALTER TABLE public.registros_entrada
      ADD CONSTRAINT registros_entrada_entry_year_re_number_key UNIQUE (entry_year, re_number);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trg_registros_entrada_set_identifiers_fn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  yy text;
BEGIN
  NEW.entry_year := EXTRACT(
    YEAR FROM COALESCE(NEW.reception_date, timezone('Europe/Madrid', now())::date)
  )::smallint;

  IF NEW.re_number IS NULL OR NEW.re_number <= 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('registros_entrada_re_number'), NEW.entry_year::integer);

    SELECT COALESCE(MAX(re.re_number), 0) + 1
      INTO NEW.re_number
    FROM public.registros_entrada re
    WHERE re.entry_year = NEW.entry_year;
  END IF;

  yy := lpad((NEW.entry_year % 100)::text, 2, '0');

  IF NEW.re_code IS NULL OR btrim(NEW.re_code) = '' THEN
    NEW.re_code := 'RE-' || NEW.re_number::text || '-' || yy;
  END IF;

  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_registros_entrada_protect_identifiers_fn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.re_number := OLD.re_number;
  NEW.re_code := OLD.re_code;
  NEW.entry_year := OLD.entry_year;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMIT;
