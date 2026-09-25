begin;

create table public.customer_web_access (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  password_salt text,
  password_hash text,
  credential_version integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint customer_web_access_password_pair check ((password_salt is null) = (password_hash is null)),
  constraint customer_web_access_version check (credential_version > 0)
);
alter table public.customer_web_access enable row level security;
revoke all on public.customer_web_access from public, anon, authenticated;
grant select, insert, update on public.customer_web_access to service_role;

create table public.customer_password_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint customer_password_token_expiry check (expires_at > created_at)
);
create unique index customer_password_tokens_active_idx on public.customer_password_tokens(customer_id)
  where used_at is null;
alter table public.customer_password_tokens enable row level security;
revoke all on public.customer_password_tokens from public, anon, authenticated;

create function public.issue_customer_password_token(
  p_customer_id uuid, p_ttl interval default interval '30 minutes'
) returns text language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if not public.current_user_is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_ttl < interval '5 minutes' or p_ttl > interval '24 hours' then
    raise exception 'INVALID_TOKEN_LIFETIME' using errcode='22023';
  end if;
  if not exists(select 1 from public.customers where id=p_customer_id and status='ACTIVE') then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode='22023';
  end if;
  update public.customer_password_tokens set used_at=now()
    where customer_id=p_customer_id and used_at is null;
  v_token := substr(encode(extensions.gen_random_bytes(8),'hex'),1,8);
  insert into public.customer_password_tokens(customer_id,token_hash,created_by,expires_at)
    values(p_customer_id,extensions.digest(v_token,'sha256'),auth.uid(),now()+p_ttl);
  return v_token;
end;
$$;
revoke execute on function public.issue_customer_password_token(uuid,interval) from public, anon;
grant execute on function public.issue_customer_password_token(uuid,interval) to authenticated;

create function public.api_set_customer_password(
  p_customer_id uuid, p_token text, p_salt text, p_hash text
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_token public.customer_password_tokens%rowtype; v_version integer;
begin
  if p_token !~ '^[0-9a-f]{8}$' or p_salt !~ '^[0-9a-f]{32}$' or p_hash !~ '^[0-9a-f]{128}$' then
    raise exception 'INVALID_PASSWORD_REQUEST' using errcode='22023';
  end if;
  if not exists(select 1 from public.customers where id=p_customer_id and status='ACTIVE') then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode='22023';
  end if;
  select * into v_token from public.customer_password_tokens
    where customer_id=p_customer_id and token_hash=extensions.digest(p_token,'sha256')
      and used_at is null and expires_at>now() for update;
  if not found then raise exception 'INVALID_PASSWORD_TOKEN' using errcode='42501'; end if;
  insert into public.customer_web_access(customer_id,password_salt,password_hash,credential_version)
    values(p_customer_id,p_salt,p_hash,2)
    on conflict(customer_id) do update set password_salt=excluded.password_salt,
      password_hash=excluded.password_hash,credential_version=customer_web_access.credential_version+1,
      updated_at=now()
    returning credential_version into v_version;
  update public.customer_password_tokens set used_at=now() where id=v_token.id;
  return v_version;
end;
$$;
revoke execute on function public.api_set_customer_password(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.api_set_customer_password(uuid,text,text,text) to service_role;

create function public.api_create_order_by_customer_id(
  p_customer_id uuid, p_idempotency_key uuid, p_request_hash text,
  p_delivery_location text, p_payment_method public.payment_method,
  p_customer_notes text, p_items jsonb
) returns table (id uuid, public_code text, status public.order_status,
  payment_status public.payment_status, currency_code text, subtotal_cents integer,
  total_cents integer, created_at timestamptz, replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers%rowtype; v_result record; v_owner uuid;
begin
  select c.* into v_customer from public.customers c
    where c.id=p_customer_id and c.status='ACTIVE' for share;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='42501'; end if;
  if v_customer.whatsapp_e164 is null then
    raise exception 'CUSTOMER_PHONE_REQUIRED' using errcode='22023';
  end if;
  select * into v_result from public.api_create_order_with_guest_support(
    null,p_idempotency_key,p_request_hash,p_delivery_location,p_payment_method,
    v_customer.display_name,v_customer.whatsapp_e164,p_customer_notes,p_items);
  select o.customer_id into v_owner from public.orders o where o.id=v_result.id for update;
  if v_result.replayed then
    if v_owner is distinct from v_customer.id then
      raise exception 'ORDER_FORBIDDEN' using errcode='42501';
    end if;
  else
    if v_owner is not null then raise exception 'ORDER_FORBIDDEN' using errcode='42501'; end if;
    update public.orders set customer_id=v_customer.id where public.orders.id=v_result.id;
  end if;
  return query select v_result.id,v_result.public_code,v_result.status,
    v_result.payment_status,v_result.currency_code,v_result.subtotal_cents,
    v_result.total_cents,v_result.created_at,v_result.replayed;
end;
$$;
revoke execute on function public.api_create_order_by_customer_id(uuid,uuid,text,text,public.payment_method,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.api_create_order_by_customer_id(uuid,uuid,text,text,public.payment_method,text,jsonb)
  to service_role;

notify pgrst, 'reload schema';
commit;
