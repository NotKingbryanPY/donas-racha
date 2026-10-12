-- Read-only. Export/share this result if script 01 reports a schema problem.
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('api_inventory_snapshot','api_set_shared_inventory','api_set_manual_inventory_before_shared');
select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and table_name in
 ('inventory_manual_counts','inventory_revision','inventory_movements') order by table_name,ordinal_position;
select sku,name,counted,reserved_quantity,available_quantity from public.inventory_by_flavor order by sku;
