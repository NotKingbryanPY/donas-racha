begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('CUSTOMER', 'ADMIN');

alter table public.customers
  add constraint customers_auth_user_fk
  foreign key (auth_user_id) references auth.users(id) on delete set null;

alter table public.order_events
  add constraint order_events_actor_user_fk
  foreign key (actor_user_id) references auth.users(id) on delete set null;

alter table public.payments
  add constraint payments_confirmed_by_fk
  foreign key (confirmed_by) references auth.users(id) on delete set null;

create table public.app_user_roles (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (auth_user_id, role)
);

create index app_user_roles_role_idx on public.app_user_roles (role, auth_user_id);

create table public.customer_claim_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint customer_claim_tokens_expiry_check check (expires_at > created_at),
  constraint customer_claim_tokens_usage_check check (
    (used_at is null and used_by is null) or
    (used_at is not null and used_by is not null)
  )
);

create unique index customer_claim_tokens_one_active_uq
  on public.customer_claim_tokens (customer_id)
  where used_at is null;
create index customer_claim_tokens_expiry_idx
  on public.customer_claim_tokens (expires_at)
  where used_at is null;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_user_roles
    where auth_user_id = auth.uid()
      and role = 'ADMIN'
  );
$$;

create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.customers
  where auth_user_id = auth.uid()
    and status = 'ACTIVE'
  limit 1;
$$;

create or replace function public.issue_customer_claim_token(
  p_customer_id uuid,
  p_ttl interval default interval '30 minutes'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  if p_ttl < interval '5 minutes' or p_ttl > interval '24 hours' then
    raise exception 'Claim token lifetime must be between 5 minutes and 24 hours'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.customers
    where id = p_customer_id and auth_user_id is null
  ) then
    raise exception 'Customer is missing or already linked' using errcode = '22023';
  end if;

  update public.customer_claim_tokens
  set used_at = now(), used_by = auth.uid()
  where customer_id = p_customer_id and used_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.customer_claim_tokens
    (customer_id, token_hash, expires_at, created_by)
  values
    (p_customer_id, extensions.digest(v_token, 'sha256'), now() + p_ttl, auth.uid());

  return v_token;
end;
$$;

create or replace function public.claim_customer_account(p_claim_token text)
returns table (customer_id uuid, public_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_claim public.customer_claim_tokens%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_claim_token is null or char_length(p_claim_token) < 32 then
    raise exception 'Invalid or expired claim token' using errcode = '22023';
  end if;

  if exists (select 1 from public.customers c where c.auth_user_id = v_user_id) then
    raise exception 'Account already linked' using errcode = '23505';
  end if;

  select * into v_claim
  from public.customer_claim_tokens
  where token_hash = extensions.digest(p_claim_token, 'sha256')
    and used_at is null
    and expires_at > now()
  for update;

  if v_claim.id is null then
    raise exception 'Invalid or expired claim token' using errcode = '22023';
  end if;

  update public.customers
  set auth_user_id = v_user_id
  where id = v_claim.customer_id
    and auth_user_id is null;

  if not found then
    raise exception 'Customer is already linked' using errcode = '23505';
  end if;

  update public.customer_claim_tokens
  set used_at = now(), used_by = v_user_id
  where id = v_claim.id;

  insert into public.app_user_roles (auth_user_id, role)
  values (v_user_id, 'CUSTOMER')
  on conflict do nothing;

  return query
  select c.id, c.public_id
  from public.customers c
  where c.id = v_claim.customer_id;
end;
$$;

alter table public.app_user_roles enable row level security;
alter table public.customer_claim_tokens enable row level security;

revoke all on public.app_user_roles, public.customer_claim_tokens from anon, authenticated;
revoke execute on function public.current_user_is_admin() from public, anon;
revoke execute on function public.current_customer_id() from public, anon;
revoke execute on function public.issue_customer_claim_token(uuid, interval) from public, anon;
revoke execute on function public.claim_customer_account(text) from public, anon;

grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.current_customer_id() to authenticated;
grant execute on function public.issue_customer_claim_token(uuid, interval) to authenticated;
grant execute on function public.claim_customer_account(text) to authenticated;

grant select on public.loyalty_levels, public.badges, public.rewards,
  public.products, public.product_variants, public.pickup_locations to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on sequence public.order_events_id_seq to authenticated;

create policy public_read_active_levels on public.loyalty_levels
  for select to anon, authenticated using (active);
create policy public_read_active_badges on public.badges
  for select to anon, authenticated using (active);
create policy public_read_active_rewards on public.rewards
  for select to anon, authenticated using (active);
create policy public_read_active_products on public.products
  for select to anon, authenticated using (active);
create policy public_read_active_variants on public.product_variants
  for select to anon, authenticated using (
    active and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.active
    )
  );
create policy public_read_active_pickup_locations on public.pickup_locations
  for select to anon, authenticated using (active);

create policy customer_read_own_profile on public.customers
  for select to authenticated using (auth_user_id = auth.uid());
create policy customer_read_own_loyalty_account on public.loyalty_accounts
  for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_read_own_loyalty_transactions on public.loyalty_transactions
  for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_read_own_streak on public.customer_streaks
  for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_read_own_streak_seasons on public.streak_seasons
  for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_read_own_badges on public.customer_badges
  for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_read_own_redemptions on public.reward_redemptions
  for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_read_own_orders on public.orders
  for select to authenticated using (customer_id = public.current_customer_id());
create policy customer_read_own_order_items on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.customer_id = public.current_customer_id()
    )
  );
create policy customer_read_own_order_events on public.order_events
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and o.customer_id = public.current_customer_id()
    )
  );
create policy customer_read_own_payments on public.payments
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.customer_id = public.current_customer_id()
    )
  );
create policy user_read_own_roles on public.app_user_roles
  for select to authenticated using (auth_user_id = auth.uid());

create policy admin_manage_customers on public.customers
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_customer_aliases on public.customer_aliases
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_loyalty_levels on public.loyalty_levels
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_loyalty_accounts on public.loyalty_accounts
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_loyalty_transactions on public.loyalty_transactions
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_customer_streaks on public.customer_streaks
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_streak_seasons on public.streak_seasons
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_badges on public.badges
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_customer_badges on public.customer_badges
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_rewards on public.rewards
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_reward_redemptions on public.reward_redemptions
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_products on public.products
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_product_variants on public.product_variants
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_pickup_locations on public.pickup_locations
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_orders on public.orders
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_order_items on public.order_items
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_order_events on public.order_events
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_payments on public.payments
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_user_roles on public.app_user_roles
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy admin_manage_claim_tokens on public.customer_claim_tokens
  for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

commit;

