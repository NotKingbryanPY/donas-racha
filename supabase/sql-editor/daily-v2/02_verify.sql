-- Read only, after 01_apply.sql. One result so Studio does not hide earlier checks.
with checks as (
  select
    (select count(*) from public.daily_sessions where closed_at is null)=1 as single_open_session,
    has_function_privilege('service_role','public.api_daily_apply(uuid,uuid,text,jsonb)','EXECUTE')
      and has_function_privilege('service_role','public.api_daily_snapshot(uuid,bigint)','EXECUTE') as server_can_execute,
    has_function_privilege('anon','public.api_daily_apply(uuid,uuid,text,jsonb)','EXECUTE')
      or has_function_privilege('anon','public.api_daily_snapshot(uuid,bigint)','EXECUTE') as anon_can_execute,
    has_function_privilege('authenticated','public.api_daily_apply(uuid,uuid,text,jsonb)','EXECUTE')
      or has_function_privilege('authenticated','public.api_daily_snapshot(uuid,bigint)','EXECUTE') as authenticated_can_execute,
    (select count(*)=4 and bool_and(c.relrowsecurity
      and not has_table_privilege('anon',c.oid,'SELECT')
      and not has_table_privilege('authenticated',c.oid,'SELECT'))
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in
        ('daily_sessions','daily_operations','daily_operation_items','daily_cost_lots')) as private_tables_protected,
    exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass
      and tgname='zz_daily_web_sale' and not tgisinternal and tgenabled in ('O','A')
      and tgfoid='public.daily_record_web_sale()'::regprocedure) as web_sale_trigger_ready,
    not exists(select id from public.daily_operations group by id having count(*)>1) as no_duplicate_operations,
    not exists(select 1 from public.daily_cost_lots where remaining_quantity<0) as cost_lots_valid
)
select case when single_open_session and server_can_execute
    and not anon_can_execute and not authenticated_can_execute
    and private_tables_protected and web_sale_trigger_ready
    and no_duplicate_operations and cost_lots_valid
  then 'DAILY_V2_READY' else 'REVIEW_REQUIRED' end as status,
  checks.*,
  (select count(*) from pg_trigger where tgrelid='public.orders'::regclass
    and tgname='order_inventory_revision' and not tgisinternal) as inventory_revision_trigger_count,
  exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass
    and tgname='new_order_push' and not tgisinternal) as legacy_push_trigger_present,
  (select jsonb_agg(to_jsonb(i) order by i.sku) from public.inventory_by_flavor i) as inventory
from checks;
