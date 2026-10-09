-- READ ONLY: projection before 202610030001_shared_inventory.sql, never a physical count.
-- Use only after inspecting 00_preflight_export.sql and the installed inventory view.
-- Returns no rows if the shared movement ledger already exists.
-- A zero availability delta preserves the current displayed units. counted_after can
-- become false when existing reservations exceed recorded physical units: reconcile
-- those orders/counts explicitly rather than inventing stock or cancelling orders.
with projection as (
  select pv.sku,pv.name,c.quantity as stored_count,c.counted_at,
    coalesce(s.quantity,0) as deliveries_after_count,
    coalesce(r.quantity,0) as reserved_quantity,
    greatest(0,coalesce(c.quantity,0)-coalesce(s.quantity,0)) as projected_physical,
    i.available_quantity as available_before,i.counted as counted_before,
    c.variant_id is not null as has_count
  from public.product_variants pv
  left join public.inventory_manual_counts c on c.variant_id=pv.id
  left join public.inventory_by_flavor i on i.variant_id=pv.id
  left join lateral (
    select sum(fs.quantity) as quantity from public.flavor_sales fs
    where fs.variant_id=pv.id and fs.order_id is not null and fs.reversed_at is null
      and fs.created_at>c.counted_at
  ) s on true
  left join lateral (
    select sum(oi.quantity) as quantity from public.order_items oi
    join public.orders o on o.id=oi.order_id
    where oi.product_variant_id=pv.id and o.status in ('PENDING','ACCEPTED','OUT_FOR_DELIVERY')
  ) r on true
  where pv.sku in ('DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS')
    and to_regclass('public.inventory_movements') is null
)
select sku,name,stored_count,counted_at,deliveries_after_count,reserved_quantity,
  projected_physical,greatest(0,projected_physical-reserved_quantity) as available_after,
  available_before,greatest(0,projected_physical-reserved_quantity)-available_before as availability_delta,
  counted_before,(has_count and projected_physical>=reserved_quantity) as counted_after,
  greatest(0,reserved_quantity-projected_physical) as units_to_reconcile
from projection order by sku;
