begin;

create type public.customer_status as enum ('ACTIVE', 'INACTIVE');
create type public.loyalty_entry_type as enum (
  'OPENING_BALANCE', 'PURCHASE_EARN', 'REDEMPTION_SPEND', 'ADJUSTMENT', 'EXPIRATION', 'REVERSAL'
);
create type public.redemption_status as enum ('PENDING', 'FULFILLED', 'CANCELLED');
create type public.streak_season_status as enum ('ACTIVE', 'COMPLETED', 'BROKEN');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  public_id text not null,
  auth_user_id uuid unique,
  display_name text not null,
  whatsapp_e164 text,
  status public.customer_status not null default 'ACTIVE',
  registered_at timestamptz not null default now(),
  last_purchase_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_public_id_format check (public_id ~ '^C[0-9A-Z_-]{3,63}$'),
  constraint customers_display_name_length check (char_length(btrim(display_name)) between 1 and 120),
  constraint customers_whatsapp_format check (whatsapp_e164 is null or whatsapp_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  constraint customers_purchase_after_registration check (last_purchase_at is null or last_purchase_at >= registered_at)
);

create unique index customers_public_id_uq on public.customers (upper(public_id));

create table public.customer_aliases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  alias_type text not null,
  alias_value text not null,
  created_at timestamptz not null default now(),
  constraint customer_aliases_type_check check (alias_type in ('LEGACY_ID', 'QR_TOKEN', 'PHONE')),
  constraint customer_aliases_value_check check (char_length(btrim(alias_value)) between 1 and 255),
  constraint customer_aliases_unique unique (alias_type, alias_value)
);

create index customer_aliases_customer_idx on public.customer_aliases (customer_id);

create table public.loyalty_levels (
  key text primary key,
  name text not null,
  emoji text not null,
  minimum_lifetime_points integer not null unique,
  display_order smallint not null unique,
  active boolean not null default true,
  constraint loyalty_levels_key_format check (key ~ '^[A-Z][A-Z0-9_]{1,31}$'),
  constraint loyalty_levels_points_nonnegative check (minimum_lifetime_points >= 0),
  constraint loyalty_levels_order_positive check (display_order > 0)
);

create table public.loyalty_accounts (
  customer_id uuid primary key references public.customers(id) on delete restrict,
  available_points integer not null default 0,
  lifetime_points integer not null default 0,
  purchase_points integer not null default 0,
  level_key text not null default 'BRONCE' references public.loyalty_levels(key) on update cascade,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_accounts_available_nonnegative check (available_points >= 0),
  constraint loyalty_accounts_lifetime_nonnegative check (lifetime_points >= 0),
  constraint loyalty_accounts_purchase_nonnegative check (purchase_points >= 0),
  constraint loyalty_accounts_lifetime_covers_available check (lifetime_points >= available_points),
  constraint loyalty_accounts_lifetime_covers_purchase check (lifetime_points >= purchase_points)
);

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  entry_type public.loyalty_entry_type not null,
  points_delta integer not null,
  balance_after integer not null,
  idempotency_key uuid,
  source_system text not null default 'SUPABASE',
  source_id text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint loyalty_transactions_delta_nonzero check (points_delta <> 0),
  constraint loyalty_transactions_balance_nonnegative check (balance_after >= 0),
  constraint loyalty_transactions_source_system check (source_system in ('SUPABASE', 'GOOGLE_SHEETS', 'ANDROID')),
  constraint loyalty_transactions_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint loyalty_transactions_source_unique unique (source_system, source_id),
  constraint loyalty_transactions_idempotency_unique unique (idempotency_key)
);

create index loyalty_transactions_customer_time_idx
  on public.loyalty_transactions (customer_id, occurred_at desc, id desc);
create index loyalty_transactions_occurred_at_idx on public.loyalty_transactions (occurred_at desc);

create table public.customer_streaks (
  customer_id uuid primary key references public.customers(id) on delete restrict,
  current_count integer not null default 0,
  best_count integer not null default 0,
  current_season_number integer not null default 1,
  last_qualified_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint customer_streaks_counts_nonnegative check (current_count >= 0 and best_count >= 0),
  constraint customer_streaks_best_covers_current check (best_count >= current_count),
  constraint customer_streaks_season_positive check (current_season_number > 0)
);

create table public.streak_seasons (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  season_number integer not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  completed_streak integer not null default 0,
  milestones integer[] not null default '{}',
  preserved_points integer not null default 0,
  preserved_level_key text references public.loyalty_levels(key) on update cascade,
  status public.streak_season_status not null default 'ACTIVE',
  source_system text not null default 'SUPABASE',
  source_id text,
  created_at timestamptz not null default now(),
  constraint streak_seasons_number_positive check (season_number > 0),
  constraint streak_seasons_count_nonnegative check (completed_streak >= 0),
  constraint streak_seasons_preserved_points_nonnegative check (preserved_points >= 0),
  constraint streak_seasons_dates check (ended_at is null or ended_at >= started_at),
  constraint streak_seasons_milestones check (milestones <@ array[3,7,14,21,30]),
  constraint streak_seasons_customer_number_unique unique (customer_id, season_number),
  constraint streak_seasons_source_unique unique (source_system, source_id)
);

create unique index streak_seasons_one_active_per_customer_uq
  on public.streak_seasons (customer_id) where status = 'ACTIVE';

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  emoji text not null,
  condition_type text not null,
  condition_threshold integer not null,
  description text not null default '',
  display_order smallint not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint badges_key_format check (key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint badges_condition_type check (condition_type in ('PURCHASE_COUNT', 'STREAK_COUNT')),
  constraint badges_threshold_positive check (condition_threshold > 0),
  constraint badges_order_positive check (display_order > 0)
);

create table public.customer_badges (
  customer_id uuid not null references public.customers(id) on delete restrict,
  badge_id uuid not null references public.badges(id) on delete restrict,
  awarded_at timestamptz not null default now(),
  source_system text not null default 'SUPABASE',
  source_id text,
  primary key (customer_id, badge_id),
  constraint customer_badges_source_unique unique (source_system, source_id)
);

create index customer_badges_awarded_at_idx on public.customer_badges (awarded_at desc);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  emoji text not null,
  points_cost integer not null,
  reward_type text not null,
  reward_value text not null,
  description text not null default '',
  display_order smallint not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rewards_key_format check (key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint rewards_cost_positive check (points_cost > 0),
  constraint rewards_type_check check (reward_type in ('PRODUCT', 'DISCOUNT')),
  constraint rewards_order_positive check (display_order > 0)
);

create index rewards_active_order_idx on public.rewards (display_order) where active;

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  customer_id uuid not null references public.customers(id) on delete restrict,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  loyalty_transaction_id uuid unique references public.loyalty_transactions(id) on delete restrict,
  points_cost_snapshot integer not null,
  reward_name_snapshot text not null,
  status public.redemption_status not null default 'PENDING',
  idempotency_key uuid not null unique,
  source_system text not null default 'SUPABASE',
  source_id text,
  notes text,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint reward_redemptions_cost_positive check (points_cost_snapshot > 0),
  constraint reward_redemptions_fulfilled_state check (
    (status = 'FULFILLED' and fulfilled_at is not null) or
    (status <> 'FULFILLED' and fulfilled_at is null)
  ),
  constraint reward_redemptions_source_unique unique (source_system, source_id)
);

create index reward_redemptions_customer_time_idx
  on public.reward_redemptions (customer_id, created_at desc);
create index reward_redemptions_status_time_idx
  on public.reward_redemptions (status, created_at);

commit;

