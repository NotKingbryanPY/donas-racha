begin;

create or replace function public.api_transition_order(
  p_order_id uuid,
  p_to_status public.order_status,
  p_actor_user_id uuid,
  p_note text default null
)
returns table (
  id uuid,
  public_code text,
  status public.order_status,
  payment_status public.payment_status,
  updated_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_from_status public.order_status;
  v_actor_type public.order_actor_type;
begin
  select case when exists(
    select 1 from public.app_user_roles where auth_user_id=p_actor_user_id and role='ADMIN'
  ) then 'ADMIN'::public.order_actor_type when exists(
    select 1 from public.app_user_roles where auth_user_id=p_actor_user_id and role='SELLER'
  ) then 'SELLER'::public.order_actor_type end into v_actor_type;
  if v_actor_type is null then raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;

  select o.* into v_order from public.orders o where o.id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
  if v_order.status=p_to_status then
    return query select v_order.id,v_order.public_code,v_order.status,v_order.payment_status,v_order.updated_at;
    return;
  end if;
  if not (
    (v_order.status='PENDING' and p_to_status in ('ACCEPTED','CANCELLED')) or
    (v_order.status='ACCEPTED' and p_to_status in ('OUT_FOR_DELIVERY','CANCELLED')) or
    (v_order.status='OUT_FOR_DELIVERY' and p_to_status in ('COMPLETED','CANCELLED'))
  ) then raise exception 'INVALID_TRANSITION' using errcode='P0001'; end if;
  if p_to_status='COMPLETED' and v_order.payment_status<>'CONFIRMED' then
    raise exception 'PAYMENT_REQUIRED' using errcode='P0001'; end if;

  v_from_status := v_order.status;
  update public.orders o set status=p_to_status,
    completed_at=case when p_to_status='COMPLETED' then now() else null end,
    cancelled_at=case when p_to_status='CANCELLED' then now() else null end
    where o.id=p_order_id returning o.* into v_order;
  insert into public.order_events(order_id,from_status,to_status,actor_type,actor_user_id,note)
    values(p_order_id,v_from_status,p_to_status,v_actor_type,p_actor_user_id,nullif(btrim(p_note),''));
  return query select v_order.id,v_order.public_code,v_order.status,v_order.payment_status,v_order.updated_at;
end;
$$;

create or replace function public.api_complete_paid_order(
  p_order_id uuid,p_actor_user_id uuid,p_payment_method public.payment_method
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_result record;
begin
  if not exists(select 1 from public.app_user_roles
    where auth_user_id=p_actor_user_id and role in ('ADMIN','SELLER')) then
    raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;
  if p_payment_method is null or p_payment_method not in ('CASH','YAPPY') then
    raise exception 'INVALID_PAYMENT_METHOD' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_order_id::text,0));
  perform pg_advisory_xact_lock(26092601);
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

revoke execute on function public.api_transition_order(uuid,public.order_status,uuid,text)
  from public,anon,authenticated;
grant execute on function public.api_transition_order(uuid,public.order_status,uuid,text) to service_role;
revoke execute on function public.api_complete_paid_order(uuid,uuid,public.payment_method)
  from public,anon,authenticated;
grant execute on function public.api_complete_paid_order(uuid,uuid,public.payment_method) to service_role;

commit;
