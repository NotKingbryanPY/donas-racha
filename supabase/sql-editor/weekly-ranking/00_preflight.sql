-- Read-only metadata. Does not return customer or credential records.
select
  to_regclass('public.loyalty_transactions') is not null as ledger_exists,
  to_regclass('public.customers') is not null as customers_exist,
  to_regclass('public.app_user_roles') is not null as roles_exist,
  exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='app_role' and e.enumlabel='SELLER') as seller_role_exists,
  to_regprocedure('public.api_staff_weekly_ranking(uuid,date,integer)') is not null as weekly_installed;
-- Required: first four true. If weekly_installed=true, inspect verification first.
