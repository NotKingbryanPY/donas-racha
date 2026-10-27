-- Read-only; after applying 202610270001_weekly_ranking.sql.
select
  to_regclass('public.loyalty_transactions_weekly_purchases_idx') is not null as index_exists,
  not has_function_privilege('anon','public.api_staff_weekly_ranking(uuid,date,integer)','execute') as anon_blocked,
  not has_function_privilege('authenticated','public.api_staff_weekly_ranking(uuid,date,integer)','execute') as authenticated_blocked,
  has_function_privilege('service_role','public.api_staff_weekly_ranking(uuid,date,integer)','execute') as server_allowed,
  p.prosecdef as security_definer,
  p.provolatile='s' as read_only_snapshot,
  p.proconfig @> array['search_path=""'] as empty_search_path
from pg_proc p where p.oid='public.api_staff_weekly_ranking(uuid,date,integer)'::regprocedure;
-- Every column must be true. No grants or business records are modified here.
