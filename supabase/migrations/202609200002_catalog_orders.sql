begin;

create type public.order_status as enum ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');
create type public.payment_method as enum ('CASH', 'YAPPY');
create type public.payment_status as enum ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED', 'CANCELLED');
create type public.order_actor_type as enum ('CUSTOMER', 'ADMIN', 'SELLER', 'SYSTEM');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  image_url text,
  active boolean not null default true,
  display_order smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint products_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint products_order_positive check (display_order > 0)
);

create index products_active_order_idx on public.products (display_order, name) where active;

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  sku text not null unique,
  name text not null,
  unit_price_cents integer not null,
  currency_code text not null default 'USD',
  active boolean not null default true,
  display_order smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_sku_format check (sku ~ '^[A-Z0-9][A-Z0-9_-]{1,63}$'),
  constraint product_variants_price_nonnegative check (unit_price_cents >= 0),
  constraint product_variants_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint product_variants_order_positive check (display_order > 0),
  constraint product_variants_product_name_unique unique (product_id, name),
  constraint product_variants_product_id_pair_unique unique (product_id, id)
);

create index product_variants_product_active_idx on public.product_variants (product_id, display_order) where active;

create table public.pickup_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  instructions text not null default '',
  active boolean not null default true,
  display_order smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pickup_locations_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  constraint pickup_locations_order_positive check (display_order > 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique default ('DR-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8))),
  customer_id uuid references public.customers(id) on delete restrict,
  pickup_location_id uuid not null references public.pickup_locations(id) on delete restrict,
  status public.order_status not null default 'PENDING',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'PENDING',
  currency_code text not null default 'USD',
  subtotal_cents integer not null,
  discount_cents integer not null default 0,
  total_cents integer not null,
  customer_name_snapshot text not null,
  customer_phone_snapshot text,
  customer_notes text,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint orders_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint orders_amounts_nonnegative check (
    subtotal_cents >= 0 and discount_cents >= 0 and total_cents >= 0
  ),
  constraint orders_total_formula check (total_cents = subtotal_cents - discount_cents),
  constraint orders_discount_within_subtotal check (discount_cents <= subtotal_cents),
  constraint orders_customer_name_length check (char_length(btrim(customer_name_snapshot)) between 1 and 120),
  constraint orders_customer_phone_format check (
    customer_phone_snapshot is null or customer_phone_snapshot ~ '^\\+[1-9][0-9]{7,14}$'
  ),
  constraint orders_terminal_timestamps check (
    (status = 'COMPLETED' and completed_at is not null and cancelled_at is null) or
    (status = 'CANCELLED' and cancelled_at is not null and completed_at is null) or
    (status not in ('COMPLETED', 'CANCELLED') and completed_at is null and cancelled_at is null)
  )
);

create index orders_customer_time_idx on public.orders (customer_id, created_at desc);
create index orders_status_time_idx on public.orders (status, created_at);
create index orders_created_at_idx on public.orders (created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null,
  product_variant_id uuid not null,
  product_name_snapshot text not null,
  variant_name_snapshot text not null,
  sku_snapshot text not null,
  quantity integer not null,
  unit_price_cents integer not null,
  line_total_cents integer generated always as (quantity * unit_price_cents) stored,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity between 1 and 100),
  constraint order_items_price_nonnegative check (unit_price_cents >= 0),
  constraint order_items_variant_belongs_to_product foreign key (product_id, product_variant_id)
    references public.product_variants(product_id, id) on delete restrict,
  constraint order_items_order_variant_unique unique (order_id, product_variant_id)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id, product_variant_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_type public.order_actor_type not null,
  actor_user_id uuid,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_events_transition_changes check (from_status is null or from_status <> to_status),
  constraint order_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index order_events_order_time_idx on public.order_events (order_id, created_at, id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  method public.payment_method not null,
  status public.payment_status not null default 'PENDING',
  amount_cents integer not null,
  currency_code text not null default 'USD',
  external_reference text,
  idempotency_key uuid not null unique,
  confirmed_by uuid,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount_cents > 0),
  constraint payments_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint payments_confirmation_state check (
    (status = 'CONFIRMED' and confirmed_at is not null) or
    (status <> 'CONFIRMED' and confirmed_at is null)
  ),
  constraint payments_external_reference_unique unique (external_reference)
);

create index payments_order_time_idx on public.payments (order_id, created_at desc);
create index payments_status_time_idx on public.payments (status, created_at);

commit;

