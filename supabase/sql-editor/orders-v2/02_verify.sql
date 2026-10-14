-- One read-only result, no notification tokens.
with checks as (
 select
   (select count(*)=2 and bool_and(c.relrowsecurity and not has_table_privilege('anon',c.oid,'SELECT')
     and not has_table_privilege('authenticated',c.oid,'SELECT')) from pg_class c
     join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
     and c.relname in ('push_devices','order_push_jobs')) as private_tables_protected,
   (select bool_and(has_function_privilege('service_role',name,'EXECUTE')
     and not has_function_privilege('anon',name,'EXECUTE')
     and not has_function_privilege('authenticated',name,'EXECUTE')) from (values
      ('public.api_staff_register_order_notifications(uuid,uuid,text,text)'),
      ('public.api_staff_stop_order_notifications(uuid,uuid,boolean)'),
      ('public.api_claim_staff_order_push()'),
      ('public.api_finish_staff_order_push(uuid,uuid,boolean,boolean,text,text)'),
      ('public.api_staff_order_notification_status(uuid,uuid)'),
      ('public.api_retry_staff_order_push(uuid,uuid)')) f(name)) as private_rpc_ready,
   exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='new_order_push'
     and tgenabled in ('O','A') and not tgisinternal and tgfoid='public.queue_order_push()'::regprocedure) as order_queue_trigger_ready,
   not exists(select 1 from public.push_devices where auth_mode='SUPABASE_STAFF_V2' and active and revoked_at is not null) as no_active_revoked_devices
)
select case when private_tables_protected and private_rpc_ready and order_queue_trigger_ready and no_active_revoked_devices
 then 'ORDER_NOTIFICATIONS_SQL_READY' else 'REVIEW_REQUIRED' end as status,checks.*,
 (select count(*) from public.push_devices where auth_mode='SUPABASE_STAFF_V2' and active) as registered_v2_devices
from checks;
