-- Staff-authenticated notification transport; no old provisioning/accounting restored.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table if not exists public.push_devices (
  device_public_id uuid primary key, auth_user_id uuid not null references auth.users(id),
  platform text not null check(platform in ('ANDROID','IOS')), token text not null unique,
  environment text not null default 'production' check(environment in ('production','sandbox')),
  app_version text not null, active boolean not null default true,
  updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.order_push_jobs (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
  device_public_id uuid not null references public.push_devices(device_public_id),
  attempts integer not null default 0, available_at timestamptz not null default clock_timestamp(),
  delivered_at timestamptz, lease_id uuid, last_error text, unique(order_id,device_public_id)
);
create index if not exists order_push_pending on public.order_push_jobs(available_at) where delivered_at is null;
alter table public.push_devices add column if not exists auth_mode text not null default 'LEGACY';
alter table public.push_devices add column if not exists revoked_at timestamptz;
alter table public.push_devices add column if not exists registered_at timestamptz;
alter table public.push_devices enable row level security;
alter table public.order_push_jobs enable row level security;
revoke all on public.push_devices,public.order_push_jobs from public,anon,authenticated;
grant select on public.push_devices,public.order_push_jobs to service_role;

create or replace function public.api_staff_register_order_notifications(
  p_auth_user_id uuid,p_device_public_id uuid,p_token text,p_app_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role in ('ADMIN','SELLER')) then
    raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;
  if p_device_public_id is null or p_token is null or length(p_token) not between 32 and 4096
    or p_app_version is null or length(p_app_version) not between 1 and 40 then
    raise exception 'INVALID_OPERATION' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('push:'||p_device_public_id::text,0));
  if exists(select 1 from public.push_devices where device_public_id=p_device_public_id
    and (auth_user_id<>p_auth_user_id or revoked_at is not null)) then
    raise exception 'DEVICE_REVOKED' using errcode='42501'; end if;
  if exists(select 1 from public.push_devices where token=p_token and device_public_id<>p_device_public_id
    and auth_user_id<>p_auth_user_id and active) then
    raise exception 'TOKEN_IN_USE' using errcode='42501'; end if;
  -- Replace a stale registration token, preserve its row/history and never activate legacy devices.
  update public.push_devices set active=false,token='retired:'||device_public_id||':'||gen_random_uuid(),updated_at=clock_timestamp()
    where token=p_token and device_public_id<>p_device_public_id;
  insert into public.push_devices(device_public_id,auth_user_id,platform,token,app_version,auth_mode,registered_at)
    values(p_device_public_id,p_auth_user_id,'ANDROID',p_token,p_app_version,'SUPABASE_STAFF_V2',clock_timestamp())
    on conflict(device_public_id) do update set token=excluded.token,app_version=excluded.app_version,
      active=true,auth_mode=excluded.auth_mode,registered_at=excluded.registered_at,updated_at=clock_timestamp();
  insert into public.order_push_jobs(order_id,device_public_id)
    select id,p_device_public_id from public.orders where status='PENDING' and created_at>clock_timestamp()-interval '24 hours'
    on conflict(order_id,device_public_id) do nothing;
  return jsonb_build_object('registered',true);
end $$;

create or replace function public.api_staff_stop_order_notifications(p_auth_user_id uuid,p_device_public_id uuid,p_revoke boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role in ('ADMIN','SELLER')) then
    raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;
  if p_revoke and not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  update public.push_devices set active=false,updated_at=clock_timestamp(),
    revoked_at=case when p_revoke then clock_timestamp() else revoked_at end
    where device_public_id=p_device_public_id and auth_mode='SUPABASE_STAFF_V2'
      and (auth_user_id=p_auth_user_id or p_revoke);
  return jsonb_build_object('unregistered',true);
end $$;

create or replace function public.queue_order_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='PENDING' then
    insert into public.order_push_jobs(order_id,device_public_id)
      select new.id,d.device_public_id from public.push_devices d where d.active
        and d.auth_mode='SUPABASE_STAFF_V2' and d.revoked_at is null
        and exists(select 1 from public.app_user_roles r where r.auth_user_id=d.auth_user_id and r.role in ('ADMIN','SELLER'))
      on conflict(order_id,device_public_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists new_order_push on public.orders;
create trigger new_order_push after insert on public.orders for each row execute function public.queue_order_push();

create or replace function public.api_claim_staff_order_push() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  with chosen as (
    select j.id from public.order_push_jobs j join public.push_devices d using(device_public_id)
      join public.orders o on o.id=j.order_id
    where j.delivered_at is null and j.attempts<10 and j.available_at<=clock_timestamp()
      and d.active and d.platform='ANDROID' and d.auth_mode='SUPABASE_STAFF_V2' and d.revoked_at is null
      and o.status='PENDING' and o.created_at>clock_timestamp()-interval '24 hours'
      and exists(select 1 from public.app_user_roles r where r.auth_user_id=d.auth_user_id and r.role in ('ADMIN','SELLER'))
    order by j.available_at,j.id limit 10 for update of j skip locked
  ), claimed as (
    update public.order_push_jobs j set lease_id=gen_random_uuid(),attempts=attempts+1,
      available_at=clock_timestamp()+interval '2 minutes' where j.id in(select id from chosen) returning j.*
  ) select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'leaseId',j.lease_id,'orderId',j.order_id,
    'publicCode',o.public_code,'ownerId',d.auth_user_id,'deviceId',d.device_public_id,'token',d.token)),'[]') into v_result
    from claimed j join public.push_devices d using(device_public_id) join public.orders o on o.id=j.order_id;
  return v_result;
end $$;

create or replace function public.api_finish_staff_order_push(
  p_id uuid,p_lease_id uuid,p_accepted boolean,p_invalid_token boolean,p_error text,p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_device uuid;
begin
  update public.order_push_jobs set delivered_at=case when p_accepted then clock_timestamp() else null end,
    last_error=left(p_error,80),lease_id=null,
    available_at=clock_timestamp()+make_interval(secs=>least(3600,30*(2^least(attempts,6))::integer))
    where id=p_id and lease_id=p_lease_id returning device_public_id into v_device;
  if p_invalid_token and v_device is not null then
    update public.push_devices set active=false,updated_at=clock_timestamp() where device_public_id=v_device and token=p_token;
  end if;
  return jsonb_build_object('saved',v_device is not null);
end $$;

create or replace function public.api_retry_staff_order_push(p_auth_user_id uuid,p_device_public_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role in ('ADMIN','SELLER')) then
    raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;
  update public.order_push_jobs j set attempts=0,available_at=clock_timestamp(),last_error=null,lease_id=null
    from public.push_devices d,public.orders o where j.device_public_id=d.device_public_id and j.order_id=o.id
    and d.auth_user_id=p_auth_user_id and d.device_public_id=p_device_public_id and d.auth_mode='SUPABASE_STAFF_V2'
    and d.active and d.revoked_at is null and j.delivered_at is null and j.attempts>=10
    and (j.lease_id is null or j.available_at<=clock_timestamp()) and o.status='PENDING' and o.created_at>clock_timestamp()-interval '24 hours';
  get diagnostics v_count=row_count;
  return jsonb_build_object('retried',v_count);
end $$;

create or replace function public.api_staff_order_notification_status(p_auth_user_id uuid,p_device_public_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_device public.push_devices%rowtype; v_retry boolean:=false;
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role in ('ADMIN','SELLER')) then
    raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;
  select * into v_device from public.push_devices where device_public_id=p_device_public_id
    and auth_user_id=p_auth_user_id and auth_mode='SUPABASE_STAFF_V2';
  if to_regclass('cron.job') is not null then
    execute 'select coalesce(bool_or(active),false) from cron.job where jobname=''donas-order-push-v2''' into v_retry;
  end if;
  return jsonb_build_object('registered',coalesce(v_device.active,false) and v_device.revoked_at is null,
    'revoked',v_device.revoked_at is not null,'registeredAt',v_device.registered_at,'retryScheduler',v_retry,
    'pending',(select count(*) from public.order_push_jobs where device_public_id=v_device.device_public_id and delivered_at is null),
    'lastAcceptedAt',(select max(delivered_at) from public.order_push_jobs where device_public_id=v_device.device_public_id));
end $$;
revoke execute on function public.queue_order_push(),public.api_staff_register_order_notifications(uuid,uuid,text,text),
 public.api_staff_stop_order_notifications(uuid,uuid,boolean),public.api_claim_staff_order_push(),
 public.api_finish_staff_order_push(uuid,uuid,boolean,boolean,text,text),public.api_staff_order_notification_status(uuid,uuid),public.api_retry_staff_order_push(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.api_staff_register_order_notifications(uuid,uuid,text,text),
 public.api_staff_stop_order_notifications(uuid,uuid,boolean),public.api_claim_staff_order_push(),
 public.api_finish_staff_order_push(uuid,uuid,boolean,boolean,text,text),public.api_staff_order_notification_status(uuid,uuid),public.api_retry_staff_order_push(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
-- END_STAFF_ORDER_NOTIFICATIONS_COMPLETE
