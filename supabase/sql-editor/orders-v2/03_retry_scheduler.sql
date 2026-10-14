-- Install protected recovery support; no FCM/private key or cron secret is pasted here.
-- Enable these hosted extensions first if the project disallows CREATE EXTENSION.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;
-- pg_net stores decrypted HTTP headers in its queue; keep client roles out of that schema.
revoke usage on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
revoke execute on all functions in schema net from public,anon,authenticated;
create or replace function public.staff_order_push_retry_tick() returns bigint
language plpgsql security definer set search_path='' as $$
declare v_secret text; v_request bigint;
begin
  if not exists(select 1 from public.order_push_jobs j join public.push_devices d using(device_public_id)
    join public.orders o on o.id=j.order_id where j.delivered_at is null and j.attempts<10
      and j.available_at<=clock_timestamp() and d.active and d.auth_mode='SUPABASE_STAFF_V2'
      and d.revoked_at is null and o.status='PENDING' and o.created_at>clock_timestamp()-interval '24 hours'
      and exists(select 1 from public.app_user_roles r where r.auth_user_id=d.auth_user_id and r.role in ('ADMIN','SELLER'))) then return null; end if;
  select decrypted_secret into strict v_secret from vault.decrypted_secrets where name='donas_order_push_cron_secret';
  select net.http_post(url:='https://www.dracha.store/api/admin/customers/order-notifications?dispatch=1',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),
    body:='{}'::jsonb,timeout_milliseconds:=10000) into v_request;
  return v_request;
end $$;
create or replace function public.api_staff_configure_notification_retry(p_auth_user_id uuid,p_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_job bigint;
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_secret is null or length(p_secret)<32 or length(p_secret)>256 then raise exception 'INVALID_OPERATION'; end if;
  perform pg_advisory_xact_lock(26101401);
  select id into v_id from vault.secrets where name='donas_order_push_cron_secret';
  if found then perform vault.update_secret(v_id,p_secret); else perform vault.create_secret(p_secret,'donas_order_push_cron_secret'); end if;
  for v_job in select jobid from cron.job where jobname='donas-order-push-v2' loop perform cron.unschedule(v_job); end loop;
  perform cron.schedule('donas-order-push-v2','* * * * *','select public.staff_order_push_retry_tick();');
  return jsonb_build_object('retryConfigured',true);
end $$;
revoke execute on function public.staff_order_push_retry_tick() from public,anon,authenticated,service_role;
revoke execute on function public.api_staff_configure_notification_retry(uuid,text) from public,anon,authenticated;
grant execute on function public.api_staff_configure_notification_retry(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
select 'ORDER_RETRY_SUPPORT_INSTALLED' as status;
