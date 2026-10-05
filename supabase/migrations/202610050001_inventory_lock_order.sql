-- All public order writers acquire the inventory lock before locking an order.
-- Payment confirmation updates orders too, including the inventory revision trigger.
begin;
alter function public.api_transition_order(uuid,public.order_status,uuid,text)
  rename to api_transition_order_before_lock_order;
revoke execute on function public.api_transition_order_before_lock_order(uuid,public.order_status,uuid,text)
  from public,anon,authenticated,service_role;
create function public.api_transition_order(
  p_order_id uuid,p_to_status public.order_status,p_actor_user_id uuid,p_note text default null
) returns table(id uuid,public_code text,status public.order_status,payment_status public.payment_status,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(26092601);
  return query select * from public.api_transition_order_before_lock_order(p_order_id,p_to_status,p_actor_user_id,p_note);
end; $$;

alter function public.api_record_order_payment(uuid,uuid,public.payment_status,uuid,text)
  rename to api_record_order_payment_before_lock_order;
revoke execute on function public.api_record_order_payment_before_lock_order(uuid,uuid,public.payment_status,uuid,text)
  from public,anon,authenticated,service_role;
create function public.api_record_order_payment(
  p_order_id uuid,p_idempotency_key uuid,p_status public.payment_status,
  p_actor_user_id uuid,p_external_reference text default null
) returns table(id uuid,order_id uuid,status public.payment_status,amount_cents integer,currency_code text,confirmed_at timestamptz,replayed boolean)
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(26092601);
  return query select * from public.api_record_order_payment_before_lock_order(
    p_order_id,p_idempotency_key,p_status,p_actor_user_id,p_external_reference);
end; $$;

create or replace function public.api_complete_paid_order(
  p_order_id uuid,p_actor_user_id uuid,p_payment_method public.payment_method
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_result record;
begin
  if not exists(select 1 from public.app_user_roles
    where auth_user_id=p_actor_user_id and role in ('ADMIN','SELLER')) then
    raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;
  if p_payment_method is null or p_payment_method not in ('CASH','YAPPY') then
    raise exception 'INVALID_PAYMENT_METHOD' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(26092601);
  perform pg_advisory_xact_lock(hashtextextended(p_order_id::text,0));
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
  if v_order.status='COMPLETED' and v_order.payment_status='CONFIRMED' then
    return to_jsonb(v_order)||jsonb_build_object('replayed',true); end if;
  if v_order.status<>'OUT_FOR_DELIVERY' then raise exception 'INVALID_TRANSITION' using errcode='P0001'; end if;
  if v_order.payment_status='CONFIRMED' and v_order.payment_method<>p_payment_method then
    raise exception 'PAYMENT_METHOD_CONFLICT' using errcode='P0001'; end if;
  if v_order.payment_status<>'CONFIRMED' then
    update public.orders set payment_method=p_payment_method where id=p_order_id;
    perform public.api_record_order_payment(p_order_id,p_order_id,'CONFIRMED',p_actor_user_id,null);
  end if;
  select * into v_result from public.api_transition_order(p_order_id,'COMPLETED',p_actor_user_id,'Cobrado y entregado');
  return to_jsonb(v_result)||jsonb_build_object('replayed',false);
end; $$;
revoke execute on function public.api_transition_order(uuid,public.order_status,uuid,text),
  public.api_record_order_payment(uuid,uuid,public.payment_status,uuid,text),
  public.api_complete_paid_order(uuid,uuid,public.payment_method) from public,anon,authenticated;
grant execute on function public.api_transition_order(uuid,public.order_status,uuid,text),
  public.api_record_order_payment(uuid,uuid,public.payment_status,uuid,text),
  public.api_complete_paid_order(uuid,uuid,public.payment_method) to service_role;
commit;
