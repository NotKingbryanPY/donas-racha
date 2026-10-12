-- Deploy the web-only API first. Revokes mobile access; archives without deleting data.
-- Keep this schema OUT of the Supabase exposed schemas. No DROP TABLE/CASCADE.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create schema if not exists donas_mobile_archive;
revoke all on schema donas_mobile_archive from public,anon,authenticated,service_role;
drop trigger if exists new_order_push on public.orders;
do $archive$
declare t text; f record;
begin
  if to_regclass('public.staff_device_credentials') is not null then
    update public.staff_device_credentials set revoked=true;
  end if;
  if to_regclass('public.staff_firebase_bindings') is not null then
    update public.staff_firebase_bindings set revoked=true;
  end if;
  if to_regclass('public.push_devices') is not null then
    update public.push_devices set active=false;
  end if;
  update public.app_devices set status='REVOKED' where status='ACTIVE';
  -- Functions are no longer exposed through public/PostgREST, even with old APK credentials.
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname=any(array[
      'api_pull_orders_for_device','api_restore_device_identity','api_register_push_device',
      'api_unregister_push_device','api_issue_staff_invitation','api_claim_staff_invitation',
      'api_revoke_staff_device','api_bind_firebase_device','api_resolve_firebase_device',
      'api_finish_order_push','queue_order_push']) or
      p.proname like 'api_push_sync%' or p.proname like 'api_claim_order_push%') loop
    execute format('revoke execute on function %s from public,anon,authenticated,service_role',f.oid::regprocedure);
    execute format('alter function %s set schema donas_mobile_archive',f.oid::regprocedure);
  end loop;
  foreach t in array array['order_push_jobs','push_devices','staff_firebase_bindings',
    'staff_device_credentials','staff_device_invitations'] loop
    if to_regclass('public.'||t) is not null then
      if to_regclass('donas_mobile_archive.'||t) is not null then raise exception 'ARCHIVE_CONFLICT: %',t; end if;
      execute format('alter table public.%I enable row level security',t);
      execute format('revoke all on table public.%I from public,anon,authenticated,service_role',t);
      execute format('alter table public.%I set schema donas_mobile_archive',t);
    end if;
  end loop;
end $archive$;
revoke all on all tables in schema donas_mobile_archive from public,anon,authenticated,service_role;
revoke all on all functions in schema donas_mobile_archive from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
select 'MOBILE_ARCHIVED_WEB_PRESERVED' as status,
  to_regclass('public.push_devices') is null as public_push_removed,
  to_regclass('public.staff_device_credentials') is null as public_devices_removed,
  to_regclass('public.orders') is not null as orders_preserved,
  to_regclass('public.inventory_movements') is not null as stock_history_preserved,
  to_regclass('public.catalog_change_receipts') is not null as web_catalog_preserved;
