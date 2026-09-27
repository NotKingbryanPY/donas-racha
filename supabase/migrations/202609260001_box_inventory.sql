-- Additive inventory ledger. Historical sales without flavors remain outside this
-- ledger: count physical opening stock before relying on displayed availability.
begin;

create table public.box_purchases (
  id uuid primary key default gen_random_uuid(),
  boxes integer not null check (boxes between 1 and 10000),
  purchased_at timestamptz not null default now(),
  source_operation_id uuid unique references public.sync_operations(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.flavor_sales (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id),
  quantity integer not null check (quantity between 1 and 10000),
  source_operation_id uuid references public.sync_operations(id),
  order_id uuid references public.orders(id),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  check ((source_operation_id is null) <> (order_id is null)),
  unique(source_operation_id,variant_id),
  unique(order_id,variant_id)
);
create table public.inventory_opening_counts (
  variant_id uuid primary key references public.product_variants(id),
  quantity integer not null check (quantity >= 0),
  counted_at timestamptz not null default now()
);
create table public.inventory_sync_gaps (
  operation_id uuid primary key references public.sync_operations(id),
  created_at timestamptz not null default now()
);
alter table public.box_purchases enable row level security;
alter table public.flavor_sales enable row level security;
alter table public.inventory_opening_counts enable row level security;
alter table public.inventory_sync_gaps enable row level security;
revoke all on public.box_purchases,public.flavor_sales,public.inventory_opening_counts,public.inventory_sync_gaps from public,anon,authenticated;
grant select,insert on public.box_purchases,public.flavor_sales to service_role;
grant select,insert,update on public.inventory_opening_counts to service_role;
grant select,insert on public.inventory_sync_gaps to service_role;

create view public.inventory_by_flavor with (security_invoker = true) as
select pv.id as variant_id,pv.sku,pv.name,pv.available as offered,
  coalesce(c.quantity,0) as opening_quantity,
  coalesce((select sum(bp.boxes) from public.box_purchases bp),0) *
    case pv.sku when 'DR-CHOCOLATE' then 4 when 'DR-VAINILLA' then 4
      when 'DR-CHOCOLATE-CHISPAS' then 2 when 'DR-VAINILLA-CHISPAS' then 2 else 0 end
    as purchased_quantity,
  coalesce((select sum(fs.quantity) from public.flavor_sales fs where fs.variant_id=pv.id and fs.reversed_at is null),0) as sold_quantity,
  coalesce((select sum(oi.quantity) from public.order_items oi join public.orders o on o.id=oi.order_id
    where oi.product_variant_id=pv.id and o.status in ('PENDING','ACCEPTED','OUT_FOR_DELIVERY')),0) as reserved_quantity,
  greatest(0,coalesce(c.quantity,0) + coalesce((select sum(bp.boxes) from public.box_purchases bp),0) *
    case pv.sku when 'DR-CHOCOLATE' then 4 when 'DR-VAINILLA' then 4
      when 'DR-CHOCOLATE-CHISPAS' then 2 when 'DR-VAINILLA-CHISPAS' then 2 else 0 end
    - coalesce((select sum(fs.quantity) from public.flavor_sales fs where fs.variant_id=pv.id and fs.reversed_at is null),0)
    - coalesce((select sum(oi.quantity) from public.order_items oi join public.orders o on o.id=oi.order_id
      where oi.product_variant_id=pv.id and o.status in ('PENDING','ACCEPTED','OUT_FOR_DELIVERY')),0)) as available_quantity,
  (c.variant_id is not null and c.counted_at >= coalesce(
    (select max(g.created_at) from public.inventory_sync_gaps g),'1970-01-01'::timestamptz)) as counted
from public.product_variants pv left join public.inventory_opening_counts c on c.variant_id=pv.id
where pv.sku in ('DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS');
revoke all on public.inventory_by_flavor from public,anon,authenticated;
grant select on public.inventory_by_flavor to service_role;

create function public.record_completed_order_flavors() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status='COMPLETED' and old.status is distinct from 'COMPLETED' then
    perform pg_advisory_xact_lock(26092601);
    insert into public.flavor_sales(variant_id,quantity,order_id)
      select oi.product_variant_id,oi.quantity,new.id from public.order_items oi where oi.order_id=new.id
      on conflict(order_id,variant_id) do nothing;
  end if;
  return new;
end; $$;
create trigger orders_record_flavor_sales after update of status on public.orders
  for each row execute function public.record_completed_order_flavors();

create function public.api_set_physical_inventory_count(
  p_auth_user_id uuid,p_variant_id uuid,p_physical_quantity integer
) returns public.inventory_opening_counts
language plpgsql security definer set search_path = '' as $$
declare v_row record; v_opening integer; v_result public.inventory_opening_counts%rowtype;
begin
  if not exists(select 1 from public.app_user_roles r where r.auth_user_id=p_auth_user_id and r.role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_physical_quantity not between 0 and 100000 then
    raise exception 'INVALID_QUANTITY' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(26092601);
  select * into v_row from public.inventory_by_flavor where variant_id=p_variant_id;
  if not found then raise exception 'INVALID_PRODUCT_VARIANT' using errcode='22023'; end if;
  v_opening := p_physical_quantity-v_row.purchased_quantity+v_row.sold_quantity+v_row.reserved_quantity;
  if v_opening<0 then raise exception 'COUNT_CONFLICT' using errcode='P0001'; end if;
  insert into public.inventory_opening_counts(variant_id,quantity,counted_at)
    values(p_variant_id,v_opening,now())
    on conflict(variant_id) do update set quantity=excluded.quantity,counted_at=excluded.counted_at
    returning * into v_result;
  return v_result;
end; $$;
revoke execute on function public.api_set_physical_inventory_count(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.api_set_physical_inventory_count(uuid,uuid,integer) to service_role;

-- Serialize web reservations. A retry of an existing order remains idempotent.
alter function public.api_create_order_by_customer_id(uuid,uuid,text,text,public.payment_method,text,jsonb)
  rename to api_create_order_by_customer_id_unstocked;
revoke execute on function public.api_create_order_by_customer_id_unstocked(uuid,uuid,text,text,public.payment_method,text,jsonb)
  from public,anon,authenticated,service_role;
create function public.api_create_order_by_customer_id(
  p_customer_id uuid,p_idempotency_key uuid,p_request_hash text,p_delivery_location text,
  p_payment_method public.payment_method,p_customer_notes text,p_items jsonb
) returns table (id uuid, public_code text, status public.order_status,
  payment_status public.payment_status, currency_code text, subtotal_cents integer,
  total_cents integer, created_at timestamptz, replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare v_result record; v_item record;
begin
  perform pg_advisory_xact_lock(26092601);
  select * into v_result from public.api_create_order_by_customer_id_unstocked(
    p_customer_id,p_idempotency_key,p_request_hash,p_delivery_location,
    p_payment_method,p_customer_notes,p_items);
  if not v_result.replayed then
    for v_item in select oi.product_variant_id,oi.quantity from public.order_items oi
      where oi.order_id=v_result.id loop
      if not exists(select 1 from public.inventory_by_flavor i
        where i.variant_id=v_item.product_variant_id and i.counted and i.available_quantity >= 0
          and i.opening_quantity+i.purchased_quantity-i.sold_quantity-i.reserved_quantity >= 0) then
        raise exception 'OUT_OF_STOCK' using errcode='P0001';
      end if;
    end loop;
  end if;
  return query select v_result.id,v_result.public_code,v_result.status,v_result.payment_status,
    v_result.currency_code,v_result.subtotal_cents,v_result.total_cents,v_result.created_at,v_result.replayed;
end; $$;
revoke execute on function public.api_create_order_by_customer_id(uuid,uuid,text,text,public.payment_method,text,jsonb) from public,anon,authenticated;
grant execute on function public.api_create_order_by_customer_id(uuid,uuid,text,text,public.payment_method,text,jsonb) to service_role;

alter function public.api_push_sync_operations(uuid,uuid,text,text,jsonb) rename to api_push_sync_operations_unrecorded;
revoke execute on function public.api_push_sync_operations_unrecorded(uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
create function public.api_push_sync_operations(
 p_auth_user_id uuid,p_device_public_id uuid,p_device_name text,p_app_version text,p_operations jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_acks jsonb := '[]'::jsonb; v_op jsonb; v_row public.sync_operations%rowtype;
  v_item jsonb; v_variant uuid; v_boxes integer; v_qty integer; v_sum integer; v_reversed_event bigint;
begin
  perform pg_advisory_xact_lock(26092601);
  v_result := public.api_push_sync_operations_unrecorded(p_auth_user_id,p_device_public_id,p_device_name,p_app_version,p_operations);
  for v_op in select value from jsonb_array_elements(p_operations) loop
    select s.* into v_row from public.sync_operations s join public.app_devices d on d.id=s.device_id
      where d.device_public_id=p_device_public_id and s.client_operation_id=(v_op->>'clientOperationId')::uuid;
    if v_row.operation_type='PURCHASE' and v_row.payload->'details' ? 'boxes' then
      v_boxes := (v_row.payload->'details'->>'boxes')::integer;
      if v_boxes not between 1 and 10000 then raise exception 'INVALID_BOX_COUNT' using errcode='22023'; end if;
      insert into public.box_purchases(boxes,purchased_at,source_operation_id,created_by)
        values(v_boxes,v_row.occurred_at,v_row.id,p_auth_user_id) on conflict(source_operation_id) do nothing;
    elsif v_row.operation_type='SALE' and jsonb_typeof(v_row.payload->'details'->'items')='array'
      and not (v_row.payload->'details' ? 'remoteOrderId') then
      v_sum := 0;
      for v_item in select value from jsonb_array_elements(v_row.payload->'details'->'items') loop
        v_qty := (v_item->>'quantity')::integer;
        if v_qty not between 1 and 99 then raise exception 'INVALID_QUANTITY' using errcode='22023'; end if;
        select id into v_variant from public.product_variants where sku=v_item->>'sku';
        if v_variant is null then raise exception 'INVALID_PRODUCT_VARIANT' using errcode='22023'; end if;
        v_sum := v_sum+v_qty;
        insert into public.flavor_sales(variant_id,quantity,source_operation_id)
          values(v_variant,v_qty,v_row.id) on conflict(source_operation_id,variant_id) do nothing;
      end loop;
      if v_sum<>(v_row.payload->'details'->>'quantity')::integer then
        raise exception 'SALE_QUANTITY_MISMATCH' using errcode='22023'; end if;
    elsif v_row.operation_type='REVERSAL' then
      v_reversed_event := (v_row.payload->>'reversedEventId')::bigint;
      update public.flavor_sales fs set reversed_at=coalesce(fs.reversed_at,v_row.occurred_at)
        where fs.source_operation_id in (select s.id from public.sync_operations s
          where s.device_id=v_row.device_id and s.operation_type='SALE'
            and (s.payload->>'localEventId')::bigint=v_reversed_event);
    end if;
    if (v_row.operation_type='PURCHASE' and not (v_row.payload->'details' ? 'boxes')) or
       (v_row.operation_type='SALE' and not (v_row.payload->'details' ? 'items')
         and not (v_row.payload->'details' ? 'remoteOrderId')) then
      insert into public.inventory_sync_gaps(operation_id) values(v_row.id) on conflict do nothing;
    end if;
    if v_row.operation_type in ('PURCHASE','SALE','REVERSAL') then
      update public.sync_operations set status='APPLIED',applied_at=coalesce(applied_at,now()),
        attempts=attempts+case when status='RECEIVED' then 1 else 0 end
        where id=v_row.id and status in ('RECEIVED','APPLIED');
    end if;
    select * into v_row from public.sync_operations where id=v_row.id;
    v_acks := v_acks || jsonb_build_array(jsonb_build_object(
      'clientOperationId',v_row.client_operation_id,'status',v_row.status,
      'serverSequence',v_row.server_sequence,'replayed',
      coalesce((select (x->>'replayed')::boolean from jsonb_array_elements(v_result->'acknowledgements') x
        where x->>'clientOperationId'=v_row.client_operation_id::text),false)));
  end loop;
  return jsonb_set(v_result,'{acknowledgements}',v_acks);
end; $$;
revoke execute on function public.api_push_sync_operations(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.api_push_sync_operations(uuid,uuid,text,text,jsonb) to service_role;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and
     not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='box_purchases') then
    alter publication supabase_realtime add table public.box_purchases;
  end if;
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and
     not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='flavor_sales') then
    alter publication supabase_realtime add table public.flavor_sales;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
