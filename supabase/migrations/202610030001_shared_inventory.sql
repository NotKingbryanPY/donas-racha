-- Preserve today's physical balance; only new ledger rows create movements.
begin;
create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants(id),
  quantity_delta bigint not null,
  source_key text not null unique,
  created_at timestamptz not null default clock_timestamp()
);
create table public.inventory_revision (
  id boolean primary key default true check(id),
  revision bigint not null default 0,
  activated_at timestamptz not null default clock_timestamp()
);
insert into public.inventory_revision(id) values(true);
alter table public.inventory_manual_counts add column movement_sequence bigint not null default 0;
-- Remove deliveries already deducted by the previous view before changing it.
update public.inventory_manual_counts c set quantity=greatest(0,c.quantity-coalesce((
  select sum(fs.quantity) from public.flavor_sales fs where fs.variant_id=c.variant_id
  and fs.order_id is not null and fs.reversed_at is null and fs.created_at>c.counted_at),0));
alter table public.inventory_movements enable row level security;
alter table public.inventory_revision enable row level security;
revoke all on public.inventory_movements,public.inventory_revision from public,anon,authenticated;
grant select on public.inventory_movements,public.inventory_revision to service_role;

create function public.inventory_movement_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(26092601);
  update public.inventory_revision set revision=revision+1 where id;
  return new;
end; $$;
create trigger inventory_movement_revision after insert on public.inventory_movements
for each row execute function public.inventory_movement_changed();
create trigger inventory_gap_revision after insert on public.inventory_sync_gaps
for each row execute function public.inventory_movement_changed();

create function public.inventory_flavor_movement() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(26092601);
  if tg_op='INSERT' then
    insert into public.inventory_movements(variant_id,quantity_delta,source_key)
      values(new.variant_id,-new.quantity,'sale:'||new.id) on conflict(source_key) do nothing;
    if new.reversed_at is not null then
      insert into public.inventory_movements(variant_id,quantity_delta,source_key)
        values(new.variant_id,new.quantity,'reverse:'||new.id) on conflict(source_key) do nothing;
    end if;
  elsif old.reversed_at is null and new.reversed_at is not null then
    -- A historical sale excluded at cutover must not add fictitious units.
    if exists(select 1 from public.inventory_movements where source_key='sale:'||new.id) then
      insert into public.inventory_movements(variant_id,quantity_delta,source_key)
        values(new.variant_id,new.quantity,'reverse:'||new.id) on conflict(source_key) do nothing;
    else
      insert into public.inventory_sync_gaps(operation_id) values(new.source_operation_id) on conflict do nothing;
    end if;
  end if;
  return new;
end; $$;
create trigger flavor_shared_stock after insert or update of reversed_at on public.flavor_sales
for each row execute function public.inventory_flavor_movement();

create function public.inventory_box_movement() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_details jsonb; v_item record; v_variant record;
begin
  perform pg_advisory_xact_lock(26092601);
  select payload->'details' into v_details from public.sync_operations where id=new.source_operation_id;
  -- The existing Android box is 12 donuts: 4/4/2/2. Other mixes need reconciliation.
  if coalesce((v_details->>'donutsPerBox')::integer,12)<>12 then
    insert into public.inventory_sync_gaps(operation_id) values(new.source_operation_id) on conflict do nothing;
    return new;
  end if;
  for v_variant in select id,sku from public.product_variants
    where sku in ('DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS') loop
    insert into public.inventory_movements(variant_id,quantity_delta,source_key)
      values(v_variant.id,new.boxes*case when v_variant.sku in ('DR-CHOCOLATE','DR-VAINILLA') then 4 else 2 end,
        'purchase:'||new.id||':'||v_variant.sku) on conflict(source_key) do nothing;
  end loop;
  return new;
end; $$;
create trigger box_shared_stock after insert on public.box_purchases
for each row execute function public.inventory_box_movement();

create or replace view public.inventory_by_flavor with (security_invoker=true) as
select pv.id as variant_id,pv.sku,pv.name,pv.available as offered,
  coalesce(c.quantity,0) as opening_quantity,
  coalesce(m.added,0)::bigint as purchased_quantity,
  coalesce(m.removed,0)::bigint as sold_quantity,
  coalesce(r.quantity,0)::bigint as reserved_quantity,
  greatest(0,coalesce(c.quantity,0)+coalesce(m.added,0)-coalesce(m.removed,0)-coalesce(r.quantity,0))::bigint as available_quantity,
  (c.variant_id is not null and coalesce(c.quantity,0)+coalesce(m.added,0)-coalesce(m.removed,0)>=coalesce(r.quantity,0)
    and c.counted_at>=coalesce((select max(g.created_at)
    from public.inventory_sync_gaps g where g.created_at>(select activated_at from public.inventory_revision where id)),
    '1970-01-01'::timestamptz)) as counted
from public.product_variants pv
left join public.inventory_manual_counts c on c.variant_id=pv.id
left join lateral (
  select sum(greatest(0,quantity_delta)) as added,sum(greatest(0,-quantity_delta)) as removed
  from public.inventory_movements where variant_id=pv.id and id>c.movement_sequence
) m on true
left join lateral (
  select sum(oi.quantity) as quantity from public.order_items oi join public.orders o on o.id=oi.order_id
  where oi.product_variant_id=pv.id and o.status in ('PENDING','ACCEPTED','OUT_FOR_DELIVERY')
) r on true
where pv.sku in ('DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS');

alter function public.api_set_manual_inventory(uuid,jsonb) rename to api_set_manual_inventory_before_shared;
revoke execute on function public.api_set_manual_inventory_before_shared(uuid,jsonb) from service_role;
create function public.api_set_shared_inventory(p_auth_user_id uuid,p_counts jsonb,p_expected_revision bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_revision bigint;
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(26092601);
  select revision into v_revision from public.inventory_revision where id;
  if p_expected_revision is not null and p_expected_revision<>v_revision then
    raise exception 'INVENTORY_CONFLICT' using errcode='P0001'; end if;
  v_result:=public.api_set_manual_inventory_before_shared(p_auth_user_id,p_counts);
  update public.inventory_manual_counts set movement_sequence=(select coalesce(max(id),0) from public.inventory_movements);
  update public.inventory_revision set revision=revision+1 where id returning revision into v_revision;
  return v_result||jsonb_build_object('revision',v_revision);
end; $$;
create function public.api_set_manual_inventory(p_auth_user_id uuid,p_counts jsonb) returns jsonb
language sql security definer set search_path='' as $$
  select public.api_set_shared_inventory(p_auth_user_id,p_counts,null);
$$;
revoke execute on function public.api_set_shared_inventory(uuid,jsonb,bigint),public.api_set_manual_inventory(uuid,jsonb)
from public,anon,authenticated;
grant execute on function public.api_set_shared_inventory(uuid,jsonb,bigint),public.api_set_manual_inventory(uuid,jsonb) to service_role;

-- Reservation and cancellation also invalidate an open physical-count form.
create function public.inventory_order_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(26092601);
  update public.inventory_revision set revision=revision+1 where id;
  return new;
end; $$;
create trigger order_inventory_revision after insert or update of status on public.orders
for each row execute function public.inventory_order_revision();
create function public.api_inventory_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  perform pg_advisory_xact_lock(26092601);
  select jsonb_build_object('flavors',(select coalesce(jsonb_agg(to_jsonb(i) order by i.sku),'[]')
    from public.inventory_by_flavor i),'revision',r.revision,'serverTime',clock_timestamp(),
    'shared',true) into v_result from public.inventory_revision r where r.id;
  return v_result;
end; $$;
revoke execute on function public.api_inventory_snapshot() from public,anon,authenticated;
grant execute on function public.api_inventory_snapshot() to service_role;
notify pgrst,'reload schema';
-- Include flavor SKU in the mobile cursor so receipts can be reconciled locally.
create or replace function public.api_pull_orders_for_device(p_after_updated_at timestamptz,p_after_id uuid,p_limit integer)
returns table(id uuid,public_code text,status public.order_status,payment_method public.payment_method,
  payment_status public.payment_status,delivery_location text,customer_name text,customer_phone text,
  currency_code text,total_cents integer,created_at timestamptz,updated_at timestamptz,items jsonb)
language sql security definer set search_path='' stable as $$
  select o.id,o.public_code,o.status,o.payment_method,o.payment_status,o.delivery_location,
    o.customer_name_snapshot,o.customer_phone_snapshot,o.currency_code,o.total_cents,o.created_at,o.updated_at,
    coalesce((select jsonb_agg(jsonb_build_object('productVariantId',oi.product_variant_id,
      'productName',oi.product_name_snapshot,'variantName',oi.variant_name_snapshot,'quantity',oi.quantity,
      'sku',oi.sku_snapshot,'unitPriceCents',oi.unit_price_cents,'lineTotalCents',oi.line_total_cents) order by oi.id)
      from public.order_items oi where oi.order_id=o.id),'[]'::jsonb)
  from public.orders o where (o.updated_at,o.id)>(p_after_updated_at,p_after_id)
  order by o.updated_at,o.id limit greatest(1,least(p_limit,100));
$$;
commit;
