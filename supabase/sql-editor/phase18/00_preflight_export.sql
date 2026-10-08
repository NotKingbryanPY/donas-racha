-- READ ONLY. One result set: Export > CSV preserves every diagnostic section.
-- No customer records, device tokens, invitation hashes or credentials are read.
-- Run in the same Supabase project used by www.dracha.store.
with expected_tables(name) as (values
  ('customers'),('app_user_roles'),('products'),('product_variants'),('orders'),
  ('order_items'),('order_events'),('payments'),('loyalty_accounts'),('loyalty_transactions'),
  ('app_devices'),('sync_operations'),('inventory_manual_counts'),('inventory_control'),
  ('inventory_movements'),('inventory_revision'),('push_devices'),('order_push_jobs'),
  ('catalog_change_receipts'),('staff_device_invitations'),('staff_device_credentials')
), expected_functions(name) as (values
  ('api_inventory_snapshot'),('api_set_shared_inventory'),('api_set_manual_inventory'),
  ('api_set_manual_inventory_before_shared'),('api_push_sync_operations'),
  ('api_push_sync_before_device_ownership'),('api_restore_device_identity'),
  ('api_create_order_by_customer_id'),('api_complete_paid_order'),('api_pull_orders_for_device'),
  ('api_transition_order'),('api_transition_order_before_lock_order'),
  ('api_record_order_payment'),('api_record_order_payment_before_lock_order'),
  ('api_register_push_device'),('api_claim_order_push'),('api_finish_order_push'),
  ('api_claim_order_push_before_staff_devices'),('api_update_flavor'),
  ('api_issue_staff_invitation'),('api_claim_staff_invitation'),('api_revoke_staff_device')
), report as (
  select '00_server'::text as section, 'database'::text as object_name,
    jsonb_build_object('database',current_database(),'operator',current_user,
      'serverVersion',version(),'capturedAt',clock_timestamp(),
      'migrationLedger',to_regclass('supabase_migrations.schema_migrations')::text) as details
  union all
  select '01_expected_table',e.name,jsonb_build_object('exists',c.oid is not null,
    'kind',c.relkind,'rls',c.relrowsecurity)
  from expected_tables e left join pg_class c on c.oid=to_regclass('public.'||e.name)
  union all
  select '02_columns',table_name,jsonb_agg(jsonb_build_object(
    'name',column_name,'type',data_type,'udt',udt_name,'nullable',is_nullable,
    'default',column_default) order by ordinal_position)
  from information_schema.columns where table_schema='public'
    and table_name in (select name from expected_tables)
  group by table_name
  union all
  select '03_table_rls',c.relname,jsonb_build_object('rls',c.relrowsecurity,
    'forceRls',c.relforcerowsecurity,
    'anonSelect',has_table_privilege('anon',c.oid,'SELECT'),
    'authenticatedSelect',has_table_privilege('authenticated',c.oid,'SELECT'))
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
  union all
  select '04_policy',tablename||'.'||policyname,jsonb_build_object('command',cmd,
    'roles',roles,'using',qual,'check',with_check)
  from pg_policies where schemaname='public'
  union all
  select '05_expected_function',e.name,jsonb_build_object('exists',exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=e.name)) from expected_functions e
  union all
  select '06_function',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
    jsonb_build_object('securityDefiner',p.prosecdef,'settings',p.proconfig,
      'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),
      'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
      'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE'),
      'definition',pg_get_functiondef(p.oid))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (select name from expected_functions)
  union all
  select '07_view',viewname,jsonb_build_object('definition',definition)
  from pg_views where schemaname='public' and viewname='inventory_by_flavor'
  union all
  select '08_trigger',event_object_table||'.'||trigger_name||'.'||event_manipulation,
    jsonb_build_object('event',event_manipulation,'action',action_statement)
  from information_schema.triggers where trigger_schema='public'
  union all
  select '09_realtime',schemaname||'.'||tablename,jsonb_build_object('publication',pubname)
  from pg_publication_tables where pubname='supabase_realtime'
  union all
  select '10_constraint',c.conrelid::regclass::text||'.'||c.conname,
    jsonb_build_object('type',c.contype,'definition',pg_get_constraintdef(c.oid))
  from pg_constraint c join pg_namespace n on n.oid=c.connamespace
  where n.nspname='public' and c.contype in ('f','p','u')
)
select section,object_name,details from report order by section,object_name;
