-- Optional safe suspension. Does not delete operations or revert stock movements.
begin;
drop trigger if exists zz_daily_web_sale on public.orders;
revoke execute on function public.api_daily_apply(uuid,uuid,text,jsonb),public.api_daily_snapshot(uuid,bigint) from service_role;
notify pgrst,'reload schema';
commit;
-- Coordinate suspension with clients; pending Room entries remain for later retry.
-- 01_apply restores these grants/trigger without importing old mobile records.
