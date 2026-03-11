create table if not exists devoluciones (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  fecha_devolucion text not null,
  monto_devolucion numeric not null,
  razon text,
  status text not null check (status in ('pendiente', 'procesada'))
);

create index if not exists idx_devoluciones_transaction_id on devoluciones(transaction_id);
