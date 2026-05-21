BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.registros_entrada_re_number_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

CREATE TABLE IF NOT EXISTS public.registros_entrada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  re_number bigint NOT NULL UNIQUE DEFAULT nextval('public.registros_entrada_re_number_seq'::regclass),
  re_code text NOT NULL UNIQUE,
  entry_year smallint NOT NULL,
  client_id uuid NULL REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  client_snapshot jsonb,
  company_snapshot jsonb,
  reception_date date NOT NULL,
  device_title text,
  brand text,
  model text,
  serial_number text,
  accessories text,
  visible_damage text,
  expected_delivery_date date,
  preliminary_diagnosis text,
  internal_notes text,
  waives_prior_estimate boolean NOT NULL DEFAULT true,
  main_attachment_id uuid NULL REFERENCES public.attachments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  pdf_file_path text NULL,
  pdf_generated_at timestamptz NULL,
  status text NOT NULL DEFAULT 'open',
  legal_terms_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

ALTER TABLE public.registros_entrada
  ALTER COLUMN re_number SET DEFAULT nextval('public.registros_entrada_re_number_seq'::regclass);

ALTER SEQUENCE public.registros_entrada_re_number_seq OWNED BY public.registros_entrada.re_number;

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS registro_entrada_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attachments_registro_entrada_id_fkey'
      AND conrelid = 'public.attachments'::regclass
  ) THEN
    ALTER TABLE public.attachments
      ADD CONSTRAINT attachments_registro_entrada_id_fkey
      FOREIGN KEY (registro_entrada_id)
      REFERENCES public.registros_entrada(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_registros_entrada_re_number ON public.registros_entrada (re_number);
CREATE INDEX IF NOT EXISTS idx_registros_entrada_re_code ON public.registros_entrada (re_code);
CREATE INDEX IF NOT EXISTS idx_registros_entrada_client_id ON public.registros_entrada (client_id);
CREATE INDEX IF NOT EXISTS idx_registros_entrada_entry_year ON public.registros_entrada (entry_year);
CREATE INDEX IF NOT EXISTS idx_registros_entrada_reception_date ON public.registros_entrada (reception_date DESC);
CREATE INDEX IF NOT EXISTS idx_registros_entrada_deleted_at ON public.registros_entrada (deleted_at);
CREATE INDEX IF NOT EXISTS idx_attachments_registro_entrada_id ON public.attachments (registro_entrada_id);

CREATE OR REPLACE FUNCTION public.registros_entrada_set_identifiers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.re_number IS NULL OR NEW.re_number <= 0 THEN
    NEW.re_number := nextval('public.registros_entrada_re_number_seq'::regclass);
  END IF;

  NEW.entry_year := EXTRACT(YEAR FROM COALESCE(NEW.reception_date, now()::date))::smallint;
  NEW.re_code := 'RE-' || NEW.re_number::text || '-' || lpad((NEW.entry_year % 100)::text, 2, '0');

  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.registros_entrada_protect_identifiers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.re_number IS DISTINCT FROM OLD.re_number THEN
    NEW.re_number := OLD.re_number;
  END IF;

  IF NEW.re_code IS DISTINCT FROM OLD.re_code THEN
    NEW.re_code := OLD.re_code;
  END IF;

  IF NEW.entry_year IS DISTINCT FROM OLD.entry_year THEN
    NEW.entry_year := OLD.entry_year;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registros_entrada_set_identifiers ON public.registros_entrada;
CREATE TRIGGER trg_registros_entrada_set_identifiers
BEFORE INSERT ON public.registros_entrada
FOR EACH ROW
EXECUTE FUNCTION public.registros_entrada_set_identifiers();

DROP TRIGGER IF EXISTS trg_registros_entrada_protect_identifiers ON public.registros_entrada;
CREATE TRIGGER trg_registros_entrada_protect_identifiers
BEFORE UPDATE ON public.registros_entrada
FOR EACH ROW
EXECUTE FUNCTION public.registros_entrada_protect_identifiers();

ALTER TABLE public.registros_entrada ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'registros_entrada'
      AND policyname = 'registros_entrada_authenticated_all'
  ) THEN
    CREATE POLICY registros_entrada_authenticated_all
      ON public.registros_entrada
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'registros_entrada'
      AND policyname = 'registros_entrada_delete_authenticated'
  ) THEN
    CREATE POLICY registros_entrada_delete_authenticated
      ON public.registros_entrada
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END
$$;

COMMIT;
