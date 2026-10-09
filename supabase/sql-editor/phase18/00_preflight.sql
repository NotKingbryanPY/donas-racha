-- READ ONLY: execute before changes; do not paste private records or tokens.
select current_database() as database, current_user as operator, version();
select name,to_regclass('public.'||name) is not null as exists from unnest(array[
 'customers','app_user_roles','products','product_variants','orders','order_items','order_events','payments',
 'loyalty_accounts','loyalty_transactions','app_devices','sync_operations','inventory_manual_counts',
 'inventory_movements','inventory_revision','push_devices','order_push_jobs']) name;
select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns
where table_schema='public' and table_name in ('product_variants','orders','app_devices','push_devices','inventory_revision','loyalty_accounts')
order by table_name,ordinal_position;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p') order by c.relname;
select tablename,policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname;
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and (p.proname like 'api_%' or p.proname='set_updated_at') order by p.proname;
select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime';
select trigger_name,event_manipulation,event_object_table,action_statement from information_schema.triggers
where trigger_schema='public' order by event_object_table,trigger_name;
select to_regclass('supabase_migrations.schema_migrations') as migration_ledger;
-- If non-null, separately run: select version,name from supabase_migrations.schema_migrations order by version;
-- An empty/missing ledger may mean earlier scripts ran through SQL Editor. Inspect definitions, not only ledger.
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('api_inventory_snapshot','api_push_sync_operations','api_create_order_by_customer_id','api_complete_paid_order');

select c.conrelid::regclass as table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) as definition
from pg_constraint c join pg_namespace n on n.oid=c.connamespace
where n.nspname='public' and c.contype in ('f','p','u') order by c.conrelid::regclass::text,c.conname;
