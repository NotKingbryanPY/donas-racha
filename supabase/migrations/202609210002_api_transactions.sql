begin;

-- Phase 2 escaped `+` twice inside a standard PostgreSQL string, so valid
-- E.164 values were rejected. Character classes avoid string escaping.
alter table public.customers drop constraint customers_whatsapp_format;
alter table public.customers add constraint customers_whatsapp_format
  check (whatsapp_e164 is null or whatsapp_e164 ~ '^[+][1-9][0-9]{7,14}$');
alter table public.orders drop constraint orders_customer_phone_format;
alter table public.orders add constraint orders_customer_phone_format
  check (customer_phone_snapshot is null or customer_phone_snapshot ~ '^[+][1-9][0-9]{7,14}$');

alter table public.orders
  add column request_hash text;

alter table public.orders
  add constraint orders_request_hash_format
  check (request_hash is null or request_hash ~ '^[0-9a-f]{64}$');

create table public.api_rate_limits (
  key_hash text not null,
  bucket text not null,
  window_start timestamptz not null,
  request_count integer not null,
  updated_at timestamptz not null default now(),
  primary key (key_hash, bucket),
  constraint api_rate_limits_key_hash_format check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint api_rate_limits_bucket_format check (bucket ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint api_rate_limits_count_positive check (request_count > 0)
);

alter table public.api_rate_limits enable row level security;
create index api_rate_limits_updated_at_idx on public.api_rate_limits (updated_at);
revoke all on public.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_key_hash text,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.api_rate_limits%rowtype;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$'
     or p_bucket !~ '^[a-z][a-z0-9_]{1,63}$'
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'INVALID_RATE_LIMIT_ARGUMENTS' using errcode = '22023';
  end if;

  insert into public.api_rate_limits (key_hash, bucket, window_start, request_count, updated_at)
  values (p_key_hash, p_bucket, v_now, 1, v_now)
  on conflict (key_hash, bucket) do update set
    window_start = case
      when public.api_rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now then v_now
      else public.api_rate_limits.window_start
    end,
    request_count = case
      when public.api_rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now then 1
      else public.api_rate_limits.request_count + 1
    end,
    updated_at = v_now
  returning * into v_row;

  return query select
    v_row.request_count <= p_limit,
    greatest(0, p_limit - v_row.request_count),
    greatest(1, ceil(extract(epoch from (v_row.window_start + make_interval(secs => p_window_seconds) - v_now)))::integer);
end;
$$;

create or replace function public.api_create_order(
  p_auth_user_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_pickup_location_id uuid,
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

  if not exists (
    select 1 from public.pickup_locations l
    where l.id = p_pickup_location_id and l.active
  ) then
    raise exception 'INVALID_PICKUP_LOCATION' using errcode = '22023';
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
           pv.unit_price_cents, pv.currency_code, p.name as product_name
    into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = (v_item->>'product_variant_id')::uuid
      and pv.active and p.active;
    if not found then
      raise exception 'INVALID_PRODUCT_VARIANT' using errcode = '22023';
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
    customer_id, pickup_location_id, payment_method, currency_code,
    subtotal_cents, discount_cents, total_cents, customer_name_snapshot,
    customer_phone_snapshot, customer_notes, idempotency_key, request_hash
  ) values (
    v_customer_id, p_pickup_location_id, p_payment_method, v_currency,
    v_subtotal::integer, 0, v_subtotal::integer, btrim(p_customer_name),
    p_customer_phone, nullif(btrim(p_customer_notes), ''), p_idempotency_key, p_request_hash
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

  insert into public.order_events (order_id, from_status, to_status, actor_type, actor_user_id, note)
  values (v_order.id, null, 'PENDING', case when p_auth_user_id is null then 'SYSTEM'::public.order_actor_type else 'CUSTOMER'::public.order_actor_type end,
          p_auth_user_id, 'Pedido creado');

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
returns table (id uuid, public_code text, status public.order_status, payment_status public.payment_status, updated_at timestamptz)
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
    return query select v_order.id, v_order.public_code, v_order.status, v_order.payment_status, v_order.updated_at;
    return;
  end if;
  if not (
    (v_order.status = 'PENDING' and p_to_status in ('ACCEPTED', 'CANCELLED')) or
    (v_order.status = 'ACCEPTED' and p_to_status in ('PREPARING', 'CANCELLED')) or
    (v_order.status = 'PREPARING' and p_to_status in ('READY', 'CANCELLED')) or
    (v_order.status = 'READY' and p_to_status in ('COMPLETED', 'CANCELLED'))
  ) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  v_from_status := v_order.status;

  update public.orders o set
    status = p_to_status,
    completed_at = case when p_to_status = 'COMPLETED' then now() else null end,
    cancelled_at = case when p_to_status = 'CANCELLED' then now() else null end
  where o.id = p_order_id returning o.* into v_order;

  insert into public.order_events (order_id, from_status, to_status, actor_type, actor_user_id, note)
  values (p_order_id, v_from_status, p_to_status, 'ADMIN', p_actor_user_id, nullif(btrim(p_note), ''));

  return query select v_order.id, v_order.public_code, v_order.status, v_order.payment_status, v_order.updated_at;
end;
$$;

create or replace function public.api_record_order_payment(
  p_order_id uuid,
  p_idempotency_key uuid,
  p_status public.payment_status,
  p_actor_user_id uuid,
  p_external_reference text default null
)
returns table (id uuid, order_id uuid, status public.payment_status, amount_cents integer, currency_code text, confirmed_at timestamptz, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  if p_status not in ('CONFIRMED', 'FAILED') then
    raise exception 'INVALID_PAYMENT_STATUS' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select p.* into v_payment from public.payments p where p.idempotency_key = p_idempotency_key;
  if found then
    if v_payment.order_id <> p_order_id or v_payment.status <> p_status or
       v_payment.external_reference is distinct from nullif(btrim(p_external_reference), '') then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    return query select v_payment.id, v_payment.order_id, v_payment.status, v_payment.amount_cents,
      v_payment.currency_code, v_payment.confirmed_at, true;
    return;
  end if;

  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_order.status = 'CANCELLED' then raise exception 'ORDER_CANCELLED' using errcode = 'P0001'; end if;

  insert into public.payments (
    order_id, method, status, amount_cents, currency_code, external_reference,
    idempotency_key, confirmed_by, confirmed_at
  ) values (
    v_order.id, v_order.payment_method, p_status, v_order.total_cents, v_order.currency_code,
    nullif(btrim(p_external_reference), ''), p_idempotency_key,
    case when p_status = 'CONFIRMED' then p_actor_user_id else null end,
    case when p_status = 'CONFIRMED' then now() else null end
  ) returning * into v_payment;

  update public.orders o set payment_status = p_status where o.id = p_order_id;

  return query select v_payment.id, v_payment.order_id, v_payment.status, v_payment.amount_cents,
    v_payment.currency_code, v_payment.confirmed_at, false;
end;
$$;

revoke execute on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.api_create_order(uuid, uuid, text, uuid, public.payment_method, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.api_transition_order(uuid, public.order_status, uuid, text) from public, anon, authenticated;
revoke execute on function public.api_record_order_payment(uuid, uuid, public.payment_status, uuid, text) from public, anon, authenticated;

grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.api_create_order(uuid, uuid, text, uuid, public.payment_method, text, text, text, jsonb) to service_role;
grant execute on function public.api_transition_order(uuid, public.order_status, uuid, text) to service_role;
grant execute on function public.api_record_order_payment(uuid, uuid, public.payment_status, uuid, text) to service_role;

commit;
