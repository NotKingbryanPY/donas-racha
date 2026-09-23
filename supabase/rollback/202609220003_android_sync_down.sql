begin;
drop function if exists public.api_pull_orders_for_device(timestamptz,uuid,integer);
drop function if exists public.api_push_sync_operations(uuid,uuid,text,text,jsonb);
drop table if exists public.sync_operations;
drop table if exists public.app_devices;
commit;
