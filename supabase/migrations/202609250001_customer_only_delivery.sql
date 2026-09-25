begin;

-- Preserve the phase 8 implementation for the wrapper, but prevent direct
-- service-role calls from creating orders without a linked customer.
alter function public.api_create_order(uuid,uuid,text,text,public.payment_method,text,text,text,jsonb)
  rename to api_create_order_with_guest_support;
revoke execute on function public.api_create_order_with_guest_support(uuid,uuid,text,text,public.payment_method,text,text,text,jsonb)
  from public, anon, authenticated, service_role;

create function public.api_create_order(
  p_auth_user_id uuid, p_idempotency_key uuid, p_request_hash text,
  p_delivery_location text, p_payment_method public.payment_method,
  p_customer_name text, p_customer_phone text, p_customer_notes text, p_items jsonb
)
returns table (id uuid, public_code text, status public.order_status,
  payment_status public.payment_status, currency_code text, subtotal_cents integer,
  total_cents integer, created_at timestamptz, replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_customer public.customers%rowtype;
  v_result record;
  v_owner uuid;
begin
  if p_auth_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  select c.* into v_customer from public.customers c
  where c.auth_user_id=p_auth_user_id and c.status='ACTIVE'
  for share;
  if not found then
    raise exception 'CUSTOMER_NOT_LINKED' using errcode='42501';
  end if;
  if v_customer.whatsapp_e164 is null then
    raise exception 'CUSTOMER_PHONE_REQUIRED' using errcode='22023';
  end if;

  -- Ignore caller-supplied identity fields. The saved order always uses the
  -- registered customer's name and phone number.
  select * into v_result from public.api_create_order_with_guest_support(
    p_auth_user_id,p_idempotency_key,p_request_hash,p_delivery_location,
    p_payment_method,v_customer.display_name,v_customer.whatsapp_e164,
    p_customer_notes,p_items);
  select o.customer_id into v_owner from public.orders o where o.id=v_result.id;
  if v_owner is distinct from v_customer.id then
    raise exception 'ORDER_FORBIDDEN' using errcode='42501';
  end if;
  return query select v_result.id,v_result.public_code,v_result.status,
    v_result.payment_status,v_result.currency_code,v_result.subtotal_cents,
    v_result.total_cents,v_result.created_at,v_result.replayed;
end;
$$;

revoke execute on function public.api_create_order(uuid,uuid,text,text,public.payment_method,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.api_create_order(uuid,uuid,text,text,public.payment_method,text,text,text,jsonb)
  to service_role;

commit;
