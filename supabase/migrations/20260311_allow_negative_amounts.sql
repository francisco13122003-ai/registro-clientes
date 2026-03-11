-- Permite cantidades negativas, positivas y cero en importes.
-- Elimina checks heredados de "nonnegative" en tablas de transacciones.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'c'
      AND n.nspname = 'public'
      AND c.relname IN ('transactions', 'transaction_items')
      AND (
        con.conname ILIKE '%nonnegative%'
        OR pg_get_constraintdef(con.oid) ILIKE '%>= 0%'
        OR pg_get_constraintdef(con.oid) ILIKE '%>=(0)%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      rec.schema_name,
      rec.table_name,
      rec.constraint_name
    );
  END LOOP;
END $$;
