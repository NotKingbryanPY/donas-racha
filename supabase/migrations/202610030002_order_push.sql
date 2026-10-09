begin;
create table public.push_devices (
  device_public_id uuid primary key,
  auth_user_id uuid not null references auth.users(id),
  platform text not null check(platform in ('ANDROID','IOS')),
  token text not null unique,
  environment text not null default 'production' check(environment in ('production','sandbox')),
  app_version text not null,
  active boolean not null default true,
  updated_at timestamptz not null default clock_timestamp()
);
create table public.order_push_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  device_public_id uuid not null references public.push_devices(device_public_id),
  attempts integer not null default 0,
  available_at timestamptz not null default clock_timestamp(),
  delivered_at timestamptz,
  lease_id uuid,
  last_error text,
  unique(order_id,device_public_id)
);
create index order_push_pending on public.order_push_jobs(available_at) where delivered_at is null;
alter table public.push_devices enable row level security;
alter table public.order_push_jobs enable row level security;
revoke all on public.push_devices,public.order_push_jobs from public,anon,authenticated;
grant select on public.push_devices,public.order_push_jobs to service_role;

create function public.api_register_push_device(p_auth_user_id uuid,p_device_public_id uuid,p_platform text,p_token text,p_environment text,p_app_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role in ('ADMIN','SELLER')) then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if exists(select 1 from public.push_devices where device_public_id=p_device_public_id and auth_user_id<>p_auth_user_id and active) then
    raise exception 'DEVICE_REVOKED' using errcode='42501'; end if;
  if p_platform not in ('ANDROID','IOS') or length(p_token) not between 32 and 4096
    or p_environment not in ('production','sandbox') then raise exception 'INVALID_OPERATION' using errcode='22023'; end if;
  insert into public.push_devices(device_public_id,auth_user_id,platform,token,environment,app_version)
    values(p_device_public_id,p_auth_user_id,p_platform,p_token,p_environment,p_app_version)
    on conflict(device_public_id) do update set auth_user_id=excluded.auth_user_id,platform=excluded.platform,
      token=excluded.token,environment=excluded.environment,app_version=excluded.app_version,active=true,updated_at=clock_timestamp();
  -- Catch up active pending orders on first registration without replaying history.
  insert into public.order_push_jobs(order_id,device_public_id)
    select id,p_device_public_id from public.orders where status='PENDING'
    on conflict(order_id,device_public_id) do nothing;
  return jsonb_build_object('registered',true);
end; $$;
create function public.api_unregister_push_device(p_auth_user_id uuid,p_device_public_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  update public.push_devices set active=false,updated_at=clock_timestamp()
    where device_public_id=p_device_public_id and auth_user_id=p_auth_user_id;
  return jsonb_build_object('unregistered',true);
end; $$;
create function public.queue_order_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='PENDING' then
    insert into public.order_push_jobs(order_id,device_public_id)
      select new.id,d.device_public_id from public.push_devices d
      where d.active and exists(select 1 from public.app_user_roles r where r.auth_user_id=d.auth_user_id and r.role in ('ADMIN','SELLER'))
      on conflict(order_id,device_public_id) do nothing;
  end if;
  return new;
end; $$;
create trigger new_order_push after insert on public.orders for each row execute function public.queue_order_push();

create function public.api_claim_order_push(p_platforms text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_jobs jsonb;
begin
  with chosen as (
    select j.id from public.order_push_jobs j join public.push_devices d using(device_public_id)
    join public.orders o on o.id=j.order_id
    where j.delivered_at is null and j.attempts<10 and j.available_at<=clock_timestamp()
      and d.active and d.platform=any(p_platforms) and o.status='PENDING'
      and exists(select 1 from public.app_user_roles r where r.auth_user_id=d.auth_user_id and r.role in ('ADMIN','SELLER'))
    order by j.available_at limit 20 for update of j skip locked
  ), claimed as (
    update public.order_push_jobs j set lease_id=gen_random_uuid(),attempts=attempts+1,
      available_at=clock_timestamp()+interval '2 minutes'
      where j.id in (select id from chosen) returning j.*
  ) select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'leaseId',j.lease_id,'orderId',j.order_id,
      'publicCode',o.public_code,'platform',d.platform,'token',d.token,'environment',d.environment)), '[]') into v_jobs
    from claimed j join public.push_devices d using(device_public_id) join public.orders o on o.id=j.order_id;
  return v_jobs;
end; $$;
create function public.api_finish_order_push(p_id uuid,p_lease_id uuid,p_delivered boolean,p_invalid_token boolean,p_error text,p_token text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_device uuid;
begin
  update public.order_push_jobs set delivered_at=case when p_delivered then clock_timestamp() else null end,
    last_error=left(p_error,80),lease_id=null,
    available_at=clock_timestamp()+make_interval(secs=>least(3600,30*(2^least(attempts,6))::integer))
    where id=p_id and lease_id=p_lease_id returning device_public_id into v_device;
  if p_invalid_token and v_device is not null then
    update public.push_devices set active=false where device_public_id=v_device and token=p_token;
  end if;
  return jsonb_build_object('saved',v_device is not null);
end; $$;
revoke execute on function public.api_register_push_device(uuid,uuid,text,text,text,text),public.api_unregister_push_device(uuid,uuid),
  public.api_claim_order_push(text[]),public.api_finish_order_push(uuid,uuid,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.api_register_push_device(uuid,uuid,text,text,text,text),public.api_unregister_push_device(uuid,uuid),
  public.api_claim_order_push(text[]),public.api_finish_order_push(uuid,uuid,boolean,boolean,text,text) to service_role;
notify pgrst,'reload schema';
commit;

