begin;

create table public.app_devices (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  device_public_id uuid not null unique,
  name text not null,
  platform text not null default 'ANDROID',
  app_version text not null,
  status text not null default 'ACTIVE',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_devices_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint app_devices_version_length check (char_length(btrim(app_version)) between 1 and 40),
  constraint app_devices_platform_check check (platform = 'ANDROID'),
  constraint app_devices_status_check check (status in ('ACTIVE','REVOKED'))
);

create index app_devices_auth_user_idx on public.app_devices(auth_user_id, status);

create table public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  server_sequence bigint generated always as identity unique,
  device_id uuid not null references public.app_devices(id) on delete restrict,
  client_operation_id uuid not null,
  operation_type text not null,
  request_hash text not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  status text not null default 'RECEIVED',
  attempts integer not null default 0,
  error_code text,
  received_at timestamptz not null default now(),
  applied_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint sync_operations_device_client_unique unique(device_id, client_operation_id),
  constraint sync_operations_hash_format check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint sync_operations_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint sync_operations_type_check check (operation_type in (
    'SEED','OPENING_BALANCE','SALE','PURCHASE','EXPENSE','LOAN',
    'LOAN_PAYMENT','PARTNER_PAYMENT','ADJUSTMENT','SESSION'
  )),
  constraint sync_operations_status_check check (status in ('RECEIVED','APPLIED','REJECTED')),
  constraint sync_operations_attempts_nonnegative check (attempts >= 0)
);

create index sync_operations_pending_idx
  on public.sync_operations(status, server_sequence) where status = 'RECEIVED';
create index sync_operations_device_received_idx
  on public.sync_operations(device_id, received_at desc);

create trigger app_devices_set_updated_at before update on public.app_devices
for each row execute function public.set_updated_at();
create trigger sync_operations_set_updated_at before update on public.sync_operations
for each row execute function public.set_updated_at();

alter table public.app_devices enable row level security;
alter table public.sync_operations enable row level security;

create or replace function public.api_push_sync_operations(
  p_auth_user_id uuid,
  p_device_public_id uuid,
  p_device_name text,
  p_app_version text,
  p_operations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.app_devices%rowtype;
  v_operation jsonb;
  v_existing public.sync_operations%rowtype;
  v_operation_id uuid;
  v_type text;
  v_hash text;
  v_payload jsonb;
  v_occurred_at timestamptz;
  v_acks jsonb := '[]'::jsonb;
begin
  if not exists (
    select 1 from public.app_user_roles r
    where r.auth_user_id = p_auth_user_id and r.role = 'ADMIN'
  ) then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if jsonb_typeof(p_operations) <> 'array' or jsonb_array_length(p_operations) not between 1 and 50 then
    raise exception 'INVALID_OPERATIONS' using errcode = '22023';
  end if;

  insert into public.app_devices(auth_user_id, device_public_id, name, app_version)
  values (p_auth_user_id, p_device_public_id, btrim(p_device_name), btrim(p_app_version))
  on conflict (device_public_id) do update set
    auth_user_id = excluded.auth_user_id,
    name = excluded.name,
    app_version = excluded.app_version,
    last_seen_at = now()
  where public.app_devices.status = 'ACTIVE'
  returning * into v_device;
  if v_device.id is null then raise exception 'DEVICE_REVOKED' using errcode = '42501'; end if;

  for v_operation in select value from jsonb_array_elements(p_operations) loop
    v_operation_id := (v_operation->>'clientOperationId')::uuid;
    v_type := v_operation->>'type';
    v_hash := v_operation->>'requestHash';
    v_payload := v_operation->'payload';
    v_occurred_at := (v_operation->>'occurredAt')::timestamptz;

    select * into v_existing from public.sync_operations s
    where s.device_id = v_device.id and s.client_operation_id = v_operation_id;
    if found then
      if v_existing.request_hash <> v_hash then
        raise exception 'SYNC_IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
      end if;
      v_acks := v_acks || jsonb_build_array(jsonb_build_object(
        'clientOperationId', v_operation_id, 'status', v_existing.status,
        'serverSequence', v_existing.server_sequence, 'replayed', true
      ));
    else
      insert into public.sync_operations(
        device_id, client_operation_id, operation_type, request_hash, payload, occurred_at
      ) values (v_device.id, v_operation_id, v_type, v_hash, v_payload, v_occurred_at)
      returning * into v_existing;
      v_acks := v_acks || jsonb_build_array(jsonb_build_object(
        'clientOperationId', v_operation_id, 'status', v_existing.status,
        'serverSequence', v_existing.server_sequence, 'replayed', false
      ));
    end if;
  end loop;
  return jsonb_build_object('deviceId', v_device.device_public_id, 'acknowledgements', v_acks);
exception when invalid_text_representation or datetime_field_overflow then
  raise exception 'INVALID_OPERATION_FORMAT' using errcode = '22023';
end;
$$;

create or replace function public.api_pull_orders_for_device(
  p_after_updated_at timestamptz,
  p_after_id uuid,
  p_limit integer
)
returns table (
  id uuid, public_code text, status public.order_status,
  payment_method public.payment_method, payment_status public.payment_status,
  delivery_location text, customer_name text, customer_phone text,
  currency_code text, total_cents integer, created_at timestamptz,
  updated_at timestamptz, items jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select o.id, o.public_code, o.status, o.payment_method, o.payment_status,
    o.delivery_location, o.customer_name_snapshot, o.customer_phone_snapshot,
    o.currency_code, o.total_cents, o.created_at, o.updated_at,
    coalesce((select jsonb_agg(jsonb_build_object(
      'productVariantId', oi.product_variant_id, 'productName', oi.product_name_snapshot,
      'variantName', oi.variant_name_snapshot, 'quantity', oi.quantity,
      'unitPriceCents', oi.unit_price_cents, 'lineTotalCents', oi.line_total_cents
    ) order by oi.id) from public.order_items oi where oi.order_id = o.id), '[]'::jsonb)
  from public.orders o
  where (o.updated_at, o.id) > (p_after_updated_at, p_after_id)
  order by o.updated_at, o.id
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on public.app_devices, public.sync_operations from public, anon, authenticated;
revoke execute on function public.api_push_sync_operations(uuid,uuid,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.api_pull_orders_for_device(timestamptz,uuid,integer) from public, anon, authenticated;
grant execute on function public.api_push_sync_operations(uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.api_pull_orders_for_device(timestamptz,uuid,integer) to service_role;

commit;
