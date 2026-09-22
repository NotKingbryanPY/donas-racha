-- Ajusta fase 4 al negocio real: donas prehechas, entrega y pago contra entrega.
-- ALTER TYPE debe confirmarse antes de utilizar el nuevo valor en funciones.
alter type public.order_status add value if not exists 'OUT_FOR_DELIVERY';

begin;

alter table public.product_variants
  add column if not exists available boolean not null default true;

create index if not exists product_variants_available_idx
  on public.product_variants (product_id, display_order)
  where active and available;

alter table public.orders alter column pickup_location_id drop not null;
alter table public.orders add column if not exists delivery_location text;

update public.orders o
set delivery_location = coalesce(
  (select l.name from public.pickup_locations l where l.id = o.pickup_location_id),
  'Ubicacion heredada'
)
where o.delivery_location is null;

alter table public.orders alter column delivery_location set not null;
alter table public.orders
  add constraint orders_delivery_location_length
  check (char_length(btrim(delivery_location)) between 3 and 300);

drop function if exists public.api_create_order(
  uuid, uuid, text, uuid, public.payment_method, text, text, text, jsonb
);

create function public.api_create_order(
  p_auth_user_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_delivery_location text,
  p_payment_method public.payment_method,
  p_customer_name text,
  p_customer_phone text,
  p_customer_notes text,
  p_items jsonb
)
returns table (
  id uuid,
  public_code text,
  status public.order_status,
  payment_status public.payment_status,
  currency_code text,
  subtotal_cents integer,
  total_cents integer,
  created_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.orders%rowtype;
  v_order public.orders%rowtype;
  v_customer_id uuid;
  v_item jsonb;
  v_variant record;
  v_quantity integer;
  v_subtotal bigint := 0;
  v_currency text;
begin
  if p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_REQUEST_HASH' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 25 then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;
  if char_length(btrim(p_customer_name)) not between 1 and 120 then
    raise exception 'INVALID_CUSTOMER_NAME' using errcode = '22023';
  end if;
  if char_length(btrim(p_delivery_location)) not between 3 and 300 then
    raise exception 'INVALID_DELIVERY_LOCATION' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select o.* into v_existing from public.orders o where o.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash is distinct from p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    return query select v_existing.id, v_existing.public_code, v_existing.status,
      v_existing.payment_status, v_existing.currency_code, v_existing.subtotal_cents,
      v_existing.total_cents, v_existing.created_at, true;
    return;
  end if;

  if p_auth_user_id is not null then
    select c.id into v_customer_id
    from public.customers c
    where c.auth_user_id = p_auth_user_id and c.status = 'ACTIVE';
    if v_customer_id is null then
      raise exception 'CUSTOMER_NOT_LINKED' using errcode = '42501';
    end if;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    group by item->>'product_variant_id'
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_VARIANT' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_quantity := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'INVALID_QUANTITY' using errcode = '22023';
    end;
    if v_quantity not between 1 and 100 then
      raise exception 'INVALID_QUANTITY' using errcode = '22023';
    end if;

    select pv.id, pv.product_id, pv.sku, pv.name as variant_name,
           pv.unit_price_cents, pv.currency_code, pv.available,
           p.name as product_name
    into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = (v_item->>'product_variant_id')::uuid
      and pv.active and p.active;
    if not found then
      raise exception 'INVALID_PRODUCT_VARIANT' using errcode = '22023';
    end if;
    if not v_variant.available then
      raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
    end if;
    if v_currency is null then v_currency := v_variant.currency_code;
    elsif v_currency <> v_variant.currency_code then
      raise exception 'MIXED_CURRENCIES' using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + (v_variant.unit_price_cents::bigint * v_quantity);
  end loop;

  if v_subtotal > 2147483647 then
    raise exception 'ORDER_TOTAL_TOO_LARGE' using errcode = '22003';
  end if;

  insert into public.orders (
    customer_id, pickup_location_id, delivery_location, payment_method,
    currency_code, subtotal_cents, discount_cents, total_cents,
    customer_name_snapshot, customer_phone_snapshot, customer_notes,
    idempotency_key, request_hash
  ) values (
    v_customer_id, null, btrim(p_delivery_location), p_payment_method,
    v_currency, v_subtotal::integer, 0, v_subtotal::integer,
    btrim(p_customer_name), p_customer_phone, nullif(btrim(p_customer_notes), ''),
    p_idempotency_key, p_request_hash
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    select pv.id, pv.product_id, pv.sku, pv.name as variant_name,
           pv.unit_price_cents, p.name as product_name
    into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = (v_item->>'product_variant_id')::uuid;

    insert into public.order_items (
      order_id, product_id, product_variant_id, product_name_snapshot,
      variant_name_snapshot, sku_snapshot, quantity, unit_price_cents
    ) values (
      v_order.id, v_variant.product_id, v_variant.id, v_variant.product_name,
      v_variant.variant_name, v_variant.sku, v_quantity, v_variant.unit_price_cents
    );
  end loop;

  insert into public.order_events (
    order_id, from_status, to_status, actor_type, actor_user_id, note
  ) values (
    v_order.id, null, 'PENDING',
    case when p_auth_user_id is null then 'SYSTEM'::public.order_actor_type else 'CUSTOMER'::public.order_actor_type end,
    p_auth_user_id, 'Pedido de entrega creado'
  );

  return query select v_order.id, v_order.public_code, v_order.status,
    v_order.payment_status, v_order.currency_code, v_order.subtotal_cents,
    v_order.total_cents, v_order.created_at, false;
end;
$$;

create or replace function public.api_transition_order(
  p_order_id uuid,
  p_to_status public.order_status,
  p_actor_user_id uuid,
  p_note text default null
)
returns table (
  id uuid,
  public_code text,
  status public.order_status,
  payment_status public.payment_status,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_from_status public.order_status;
begin
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_order.status = p_to_status then
    return query select v_order.id, v_order.public_code, v_order.status,
      v_order.payment_status, v_order.updated_at;
    return;
  end if;
  if not (
    (v_order.status = 'PENDING' and p_to_status in ('ACCEPTED', 'CANCELLED')) or
    (v_order.status = 'ACCEPTED' and p_to_status in ('OUT_FOR_DELIVERY', 'CANCELLED')) or
    (v_order.status = 'OUT_FOR_DELIVERY' and p_to_status in ('COMPLETED', 'CANCELLED'))
  ) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if p_to_status = 'COMPLETED' and v_order.payment_status <> 'CONFIRMED' then
    raise exception 'PAYMENT_REQUIRED' using errcode = 'P0001';
  end if;

  v_from_status := v_order.status;
  update public.orders o set
    status = p_to_status,
    completed_at = case when p_to_status = 'COMPLETED' then now() else null end,
    cancelled_at = case when p_to_status = 'CANCELLED' then now() else null end
  where o.id = p_order_id returning o.* into v_order;

  insert into public.order_events (
    order_id, from_status, to_status, actor_type, actor_user_id, note
  ) values (
    p_order_id, v_from_status, p_to_status, 'ADMIN', p_actor_user_id,
    nullif(btrim(p_note), '')
  );

  return query select v_order.id, v_order.public_code, v_order.status,
    v_order.payment_status, v_order.updated_at;
end;
$$;

revoke execute on function public.api_create_order(
  uuid, uuid, text, text, public.payment_method, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.api_create_order(
  uuid, uuid, text, text, public.payment_method, text, text, text, jsonb
) to service_role;

commit;
