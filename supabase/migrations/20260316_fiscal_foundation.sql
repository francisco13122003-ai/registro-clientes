-- Fiscal foundation (non-destructive)
-- 1) Expands existing transactions with fiscal fields.
-- 2) Creates a dedicated expenses table.
-- 3) Performs conservative backfill for historical rows, preserving existing data.

BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS subtotal_sin_iva numeric(12,2),
  ADD COLUMN IF NOT EXISTS iva_porcentaje numeric(5,2),
  ADD COLUMN IF NOT EXISTS iva_importe numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_con_iva numeric(12,2),
  ADD COLUMN IF NOT EXISTS computa_fiscalmente boolean;

COMMENT ON COLUMN public.transactions.subtotal_sin_iva IS 'Base imponible de la operación. Backfill conservador: total_amount en legacy.';
COMMENT ON COLUMN public.transactions.iva_porcentaje IS 'Porcentaje de IVA aplicado. Backfill conservador: 0 en legacy.';
COMMENT ON COLUMN public.transactions.iva_importe IS 'Importe del IVA aplicado. Backfill conservador: 0 en legacy.';
COMMENT ON COLUMN public.transactions.total_con_iva IS 'Total fiscal (base + IVA). Backfill conservador: total_amount en legacy.';
COMMENT ON COLUMN public.transactions.computa_fiscalmente IS 'true solo para ticket/factura; false para otro/nico.';

-- Keep nullable while backfilling, then enforce not null.
ALTER TABLE public.transactions
  ALTER COLUMN computa_fiscalmente SET DEFAULT false;

-- Enforce business rule for future writes without changing UI code.
CREATE OR REPLACE FUNCTION public.set_transaction_computa_fiscalmente()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.computa_fiscalmente := (NEW.kind IN ('ticket', 'factura'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_transaction_computa_fiscalmente ON public.transactions;
CREATE TRIGGER trg_set_transaction_computa_fiscalmente
BEFORE INSERT OR UPDATE OF kind, computa_fiscalmente
ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_transaction_computa_fiscalmente();

CREATE TABLE IF NOT EXISTS public.expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha date NOT NULL,
  concepto text NOT NULL,
  categoria text,
  proveedor text,
  base_imponible numeric(12,2),
  iva_porcentaje numeric(5,2),
  iva_importe numeric(12,2),
  total numeric(12,2),
  deducible boolean NOT NULL DEFAULT false,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_fecha ON public.expenses (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_categoria ON public.expenses (categoria);

COMMENT ON TABLE public.expenses IS 'Gastos operativos separados de ventas/reparaciones.';

DO $$
DECLARE
  v_missing_total_count bigint := 0;
  v_updated_rows bigint := 0;
BEGIN
  -- Traceability log: historical rows without total_amount are not force-filled.
  SELECT count(*)
    INTO v_missing_total_count
  FROM public.transactions t
  WHERE t.total_amount IS NULL;

  IF v_missing_total_count > 0 THEN
    RAISE NOTICE '[fiscal-backfill] transactions with NULL total_amount (left conservative NULL in derived fiscal totals): %', v_missing_total_count;
  END IF;

  -- Conservative backfill:
  -- - Keep existing values if already populated.
  -- - Derive from total_amount only when possible.
  -- - IVA defaults to 0 when unknown.
  -- - computa_fiscalmente follows mandatory business rule.
  UPDATE public.transactions t
     SET subtotal_sin_iva   = COALESCE(t.subtotal_sin_iva, t.total_amount),
         iva_porcentaje     = COALESCE(t.iva_porcentaje, 0),
         iva_importe        = COALESCE(t.iva_importe, 0),
         total_con_iva      = COALESCE(t.total_con_iva, t.total_amount),
         computa_fiscalmente = CASE WHEN t.kind IN ('ticket', 'factura') THEN true ELSE false END
   WHERE t.subtotal_sin_iva IS NULL
      OR t.iva_porcentaje IS NULL
      OR t.iva_importe IS NULL
      OR t.total_con_iva IS NULL
      OR t.computa_fiscalmente IS DISTINCT FROM CASE WHEN t.kind IN ('ticket', 'factura') THEN true ELSE false END;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  RAISE NOTICE '[fiscal-backfill] rows updated: %', v_updated_rows;
END $$;

ALTER TABLE public.transactions
  ALTER COLUMN computa_fiscalmente SET NOT NULL;

COMMIT;
