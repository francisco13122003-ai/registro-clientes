alter table public.transaction_items
add column if not exists line_order integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by transaction_id
      order by created_at asc, id asc
    ) - 1 as rn
  from public.transaction_items
)
update public.transaction_items ti
set line_order = ranked.rn
from ranked
where ti.id = ranked.id
  and ti.line_order is null;

create index if not exists transaction_items_transaction_line_order_idx
on public.transaction_items (transaction_id, line_order, created_at, id);
