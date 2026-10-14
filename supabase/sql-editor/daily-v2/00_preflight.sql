-- Read only: metadata and stock; never tokens, accounts or customer records.
select 'daily_v2_preflight' as section,
  to_regclass('public.inventory_movements') is not null as shared_movements,
  to_regclass('public.inventory_revision') is not null as shared_revision,
  to_regprocedure('public.api_inventory_snapshot()') is not null as snapshot_rpc,
  to_regclass('public.daily_sessions') is not null as daily_already_installed,
  to_regnamespace('donas_mobile_archive') is not null as legacy_archive_exists;
select * from public.inventory_by_flavor order by sku;
select c.relname,c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('inventory_manual_counts','inventory_movements','inventory_revision','product_variants','orders');
select trigger_name,action_statement from information_schema.triggers
 where event_object_schema='public' and event_object_table='orders' order by trigger_name;
