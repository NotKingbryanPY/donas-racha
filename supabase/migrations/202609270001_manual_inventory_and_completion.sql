-- Manual web inventory is independent from the Android offline ledger.
begin;
create table public.inventory_manual_counts (
  variant_id uuid primary key references public.product_variants(id),
  quantity integer not null check (quantity between 0 and 100000),
  counted_at timestamptz not null default clock_timestamp(),
  counted_by uuid references auth.users(id)
);
alter table public.inventory_manual_counts enable row level security;
revoke all on public.inventory_manual_counts from public,anon,authenticated;
grant select on public.inventory_manual_counts to service_role;

-- Preserve only established physical counts; do not invent stock for uncounted flavors.
insert into public.inventory_manual_counts(variant_id,quantity)
select variant_id,greatest(0,opening_quantity+purchased_quantity-sold_quantity)::integer
from public.inventory_by_flavor where counted;

create or replace view public.inventory_by_flavor with (security_invoker=true) as
select pv.id as variant_id,pv.sku,pv.name,pv.available as offered,
  coalesce(c.quantity,0) as opening_quantity,0::bigint as purchased_quantity,
  coalesce(s.quantity,0) as sold_quantity,coalesce(r.quantity,0) as reserved_quantity,
  greatest(0,coalesce(c.quantity,0)-coalesce(s.quantity,0)-coalesce(r.quantity,0)) as available_quantity,
  c.variant_id is not null as counted
from public.product_variants pv
left join public.inventory_manual_counts c on c.variant_id=pv.id
left join lateral (
  select sum(fs.quantity) as quantity from public.flavor_sales fs
  where fs.variant_id=pv.id and fs.order_id is not null and fs.reversed_at is null
    and fs.created_at>c.counted_at
) s on true
left join lateral (
  select sum(oi.quantity) as quantity from public.order_items oi join public.orders o on o.id=oi.order_id
  where oi.product_variant_id=pv.id and o.status in ('PENDING','ACCEPTED','OUT_FOR_DELIVERY')
) r on true
where pv.sku in ('DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS');

create function public.api_set_manual_inventory(p_auth_user_id uuid,p_counts jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_count record; v_variant uuid; v_time timestamptz;
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_counts) is distinct from 'object' or
    (select count(*) from jsonb_object_keys(p_counts))<>4 then
    raise exception 'FOUR_FLAVORS_REQUIRED' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(26092601);
  v_time:=clock_timestamp();
  for v_count in select key,value from jsonb_each_text(p_counts) loop
    if v_count.key not in ('DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS')
      or v_count.value is null or v_count.value !~ '^[0-9]{1,6}$' or v_count.value::integer>100000 then
      raise exception 'INVALID_QUANTITY' using errcode='22023'; end if;
    select id into strict v_variant from public.product_variants where sku=v_count.key;
    insert into public.inventory_manual_counts(variant_id,quantity,counted_at,counted_by)
      values(v_variant,v_count.value::integer,v_time,p_auth_user_id)
      on conflict(variant_id) do update set quantity=excluded.quantity,counted_at=excluded.counted_at,counted_by=excluded.counted_by;
  end loop;
  update public.inventory_control set enforce_orders=true,updated_at=v_time where id;
  return jsonb_build_object('saved',true,'countedAt',v_time);
end; $$;
revoke execute on function public.api_set_manual_inventory(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.api_set_manual_inventory(uuid,jsonb) to service_role;

create or replace function public.api_create_order_by_customer_id(
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
  if not v_result.replayed and (select ctl.enforce_orders from public.inventory_control ctl where ctl.id) then
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

-- Keep the existing status rules but acquire inventory lock before order lock.
alter function public.api_transition_order(uuid,public.order_status,uuid,text) rename to api_transition_order_before_manual;
revoke execute on function public.api_transition_order_before_manual(uuid,public.order_status,uuid,text) from public,anon,authenticated,service_role;
create function public.api_transition_order(p_order_id uuid,p_to_status public.order_status,p_actor_user_id uuid,p_note text default null)
returns table(id uuid,public_code text,status public.order_status,payment_status public.payment_status,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(26092601);
  return query select * from public.api_transition_order_before_manual(p_order_id,p_to_status,p_actor_user_id,p_note);
end; $$;
revoke execute on function public.api_transition_order(uuid,public.order_status,uuid,text) from public,anon,authenticated;
grant execute on function public.api_transition_order(uuid,public.order_status,uuid,text) to service_role;

-- Timestamp after acquiring the lock, so a count concurrent with completion is unambiguous.
create or replace function public.record_completed_order_flavors() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='COMPLETED' and old.status is distinct from 'COMPLETED' then
    perform pg_advisory_xact_lock(26092601);
    insert into public.flavor_sales(variant_id,quantity,order_id,created_at)
      select oi.product_variant_id,oi.quantity,new.id,clock_timestamp() from public.order_items oi where oi.order_id=new.id
      on conflict(order_id,variant_id) do nothing;
  end if;
  return new;
end; $$;

create function public.api_complete_paid_order(p_order_id uuid,p_actor_user_id uuid,p_payment_method public.payment_method)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_result record;
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_actor_user_id and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_payment_method is null or p_payment_method not in ('CASH','YAPPY') then
    raise exception 'INVALID_PAYMENT_METHOD' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_order_id::text,0));
  perform pg_advisory_xact_lock(26092601);
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
  if v_order.status='COMPLETED' and v_order.payment_status='CONFIRMED' then
    return to_jsonb(v_order)||jsonb_build_object('replayed',true); end if;
  if v_order.status<>'OUT_FOR_DELIVERY' then raise exception 'INVALID_TRANSITION' using errcode='P0001'; end if;
  if v_order.payment_status='CONFIRMED' and v_order.payment_method<>p_payment_method then
    raise exception 'PAYMENT_METHOD_CONFLICT' using errcode='P0001'; end if;
  if v_order.payment_status<>'CONFIRMED' then
    update public.orders set payment_method=p_payment_method where id=p_order_id;
    perform public.api_record_order_payment(p_order_id,p_order_id,'CONFIRMED',p_actor_user_id,null);
  end if;
  select * into v_result from public.api_transition_order(p_order_id,'COMPLETED',p_actor_user_id,'Cobrado y entregado');
  return to_jsonb(v_result)||jsonb_build_object('replayed',false);
end; $$;
revoke execute on function public.api_complete_paid_order(uuid,uuid,public.payment_method) from public,anon,authenticated;
grant execute on function public.api_complete_paid_order(uuid,uuid,public.payment_method) to service_role;
commit;
