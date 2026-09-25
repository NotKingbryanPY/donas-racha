-- Emergency rollback only: this restores the former anonymous-order SQL path.
-- Use together with a rollback of the API and website deployment.
begin;

drop function public.api_create_order(uuid,uuid,text,text,public.payment_method,text,text,text,jsonb);
alter function public.api_create_order_with_guest_support(uuid,uuid,text,text,public.payment_method,text,text,text,jsonb)
  rename to api_create_order;
grant execute on function public.api_create_order(uuid,uuid,text,text,public.payment_method,text,text,text,jsonb)
  to service_role;

commit;
