-- One read-only result. No tokens, credentials or customer data.
select jsonb_build_object(
 'orders',to_regclass('public.orders') is not null,
 'roles',to_regclass('public.app_user_roles') is not null,
 'pushDevices',to_regclass('public.push_devices') is not null,
 'pushJobs',to_regclass('public.order_push_jobs') is not null,
 'legacyArchive',to_regnamespace('donas_mobile_archive') is not null,
 'alreadyInstalled',to_regprocedure('public.api_claim_staff_order_push()') is not null,
 'pushColumns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type) order by ordinal_position)
   from information_schema.columns where table_schema='public' and table_name='push_devices'),
 'orderTriggers',(select jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) order by tgname)
   from pg_trigger where tgrelid='public.orders'::regclass and not tgisinternal)
) as notification_preflight;
