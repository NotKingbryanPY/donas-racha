-- READ ONLY. Single result set after activation; no private records or tokens.
with anomalies as (
  select 'negative_balances' as name,count(*) as anomalies from public.loyalty_accounts
    where available_points<0 or lifetime_points<available_points
  union all select 'duplicate_operations',count(*) from (
    select device_id,client_operation_id from public.sync_operations group by 1,2 having count(*)>1) x
  union all select 'orphan_push_jobs',count(*) from public.order_push_jobs j
    left join public.orders o on o.id=j.order_id where o.id is null
  union all select 'duplicate_push_jobs',count(*) from (
    select order_id,device_public_id from public.order_push_jobs group by 1,2 having count(*)>1) x
  union all select 'active_revoked_push',count(*) from public.push_devices d
    join public.staff_device_credentials c using(device_public_id) where d.active and c.revoked
  union all select 'invalid_completed',count(*) from public.orders
    where status='COMPLETED' and payment_status<>'CONFIRMED'
), report as (
  select '01_integrity'::text as section,name as object_name,jsonb_build_object('anomalies',anomalies) as details from anomalies
  union all
  select '02_flavor',pv.sku,jsonb_build_object('name',pv.name,'commercialOffer',pv.available,
    'active',pv.active,'availableQuantity',i.available_quantity,'reservedQuantity',i.reserved_quantity,
    'counted',i.counted,'updatedAt',pv.updated_at)
  from public.product_variants pv left join public.inventory_by_flavor i on i.variant_id=pv.id
  union all
  select '03_private_table',c.relname,jsonb_build_object('rls',c.relrowsecurity,
    'anonSelect',has_table_privilege('anon',c.oid,'SELECT'),
    'authenticatedSelect',has_table_privilege('authenticated',c.oid,'SELECT'))
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname in ('inventory_movements','inventory_revision','push_devices','order_push_jobs',
      'catalog_change_receipts','staff_device_invitations','staff_device_credentials','staff_firebase_bindings')
  union all
  select '04_rpc',p.proname,jsonb_build_object('arguments',pg_get_function_identity_arguments(p.oid),
    'securityDefiner',p.prosecdef,'settings',p.proconfig,
    'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),
    'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
    'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE'))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('api_update_flavor','api_issue_staff_invitation','api_claim_staff_invitation',
      'api_revoke_staff_device','api_claim_order_push','api_claim_order_push_before_staff_devices',
      'api_inventory_snapshot','api_restore_device_identity','api_complete_paid_order','api_bind_firebase_device','api_resolve_firebase_device')
  union all
  select '05_trigger',t.tgname,jsonb_build_object('enabled',t.tgenabled,
    'definition',pg_get_triggerdef(t.oid)) from pg_trigger t
  where t.tgrelid='public.product_variants'::regclass and t.tgname='zz_product_variants_catalog_version'
)
select section,object_name,details from report order by section,object_name;
