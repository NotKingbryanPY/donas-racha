-- Stop new notification delivery/registration, preserve orders, stock, daily ledger and push history.
begin;
update public.push_devices set active=false where auth_mode='SUPABASE_STAFF_V2';
revoke execute on function public.api_claim_staff_order_push(),public.api_staff_register_order_notifications(uuid,uuid,text,text) from service_role;
do $$ declare v_job bigint; begin
 if to_regclass('cron.job') is not null then
  for v_job in execute 'select jobid from cron.job where jobname=''donas-order-push-v2''' loop
   execute 'select cron.unschedule($1)' using v_job;
  end loop;
 end if;
end $$;
commit;
