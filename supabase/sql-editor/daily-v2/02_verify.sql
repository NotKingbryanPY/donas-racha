-- Read only after 01_apply.sql. This does not create purchases or change stock.
select 'DAILY_V2_READY' as status,
 (select count(*) from public.daily_sessions where closed_at is null)=1 as single_open_session,
 has_function_privilege('service_role','public.api_daily_apply(uuid,uuid,text,jsonb)','EXECUTE') as server_can_apply,
 has_function_privilege('anon','public.api_daily_apply(uuid,uuid,text,jsonb)','EXECUTE') as anon_can_apply,
 has_function_privilege('authenticated','public.api_daily_apply(uuid,uuid,text,jsonb)','EXECUTE') as authenticated_can_apply;
select c.relname,c.relrowsecurity as rls,
 has_table_privilege('anon',c.oid,'SELECT') as anon_can_read,
 has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_can_read
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 and c.relname in ('daily_sessions','daily_operations','daily_operation_items','daily_cost_lots') order by c.relname;
select 'duplicate_operation_ids' as check_name,count(*) as anomalies from (
 select id from public.daily_operations group by id having count(*)>1) x;
select 'negative_cost_lots' as check_name,count(*) as anomalies from public.daily_cost_lots where remaining_quantity<0;
select * from public.inventory_by_flavor order by sku;
