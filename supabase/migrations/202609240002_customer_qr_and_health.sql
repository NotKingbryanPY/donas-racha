begin;

-- Physical payment may be retried with a different client key. The order row
-- serializes both attempts, and a second confirmed payment returns the first.
alter function public.api_record_order_payment(uuid,uuid,public.payment_status,uuid,text)
  rename to api_record_order_payment_unsettled;
revoke execute on function public.api_record_order_payment_unsettled(uuid,uuid,public.payment_status,uuid,text)
  from public,anon,authenticated,service_role;
create function public.api_record_order_payment(
  p_order_id uuid,p_idempotency_key uuid,p_status public.payment_status,
  p_actor_user_id uuid,p_external_reference text default null
)
returns table(id uuid,order_id uuid,status public.payment_status,amount_cents integer,
  currency_code text,confirmed_at timestamptz,replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_payment public.payments%rowtype;
begin
  select o.* into v_order from public.orders o where o.id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
  if v_order.payment_status='CONFIRMED' and p_status<>'CONFIRMED' then
    raise exception 'PAYMENT_ALREADY_CONFIRMED' using errcode='P0001';
  end if;
  select * into v_payment from public.payments p where p.idempotency_key=p_idempotency_key;
  if found and (v_payment.order_id<>p_order_id or v_payment.status<>p_status or
      v_payment.external_reference is distinct from nullif(btrim(p_external_reference),'')) then
    raise exception 'IDEMPOTENCY_CONFLICT' using errcode='P0001';
  end if;
  if p_status='CONFIRMED' then
    select * into v_payment from public.payments p
      where p.order_id=p_order_id and p.status='CONFIRMED'
      order by p.confirmed_at,p.id limit 1;
    if found then
      if v_payment.external_reference is distinct from nullif(btrim(p_external_reference),'') then
        raise exception 'PAYMENT_ALREADY_CONFIRMED' using errcode='P0001';
      end if;
      return query select v_payment.id,v_payment.order_id,v_payment.status,v_payment.amount_cents,
        v_payment.currency_code,v_payment.confirmed_at,true;
      return;
    end if;
  end if;
  return query select * from public.api_record_order_payment_unsettled(
    p_order_id,p_idempotency_key,p_status,p_actor_user_id,p_external_reference);
end; $$;
revoke execute on function public.api_record_order_payment(uuid,uuid,public.payment_status,uuid,text)
  from public,anon,authenticated;
grant execute on function public.api_record_order_payment(uuid,uuid,public.payment_status,uuid,text)
  to service_role;

create table public.customer_qr_tokens (
  token_hash bytea primary key,
  customer_id uuid not null references public.customers(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > issued_at)
);
create index customer_qr_tokens_customer_idx on public.customer_qr_tokens(customer_id,expires_at desc);
alter table public.customer_qr_tokens enable row level security;
revoke all on public.customer_qr_tokens from public,anon,authenticated;

create function public.api_issue_customer_qr(p_auth_user_id uuid)
returns table(token text,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_customer_id uuid; v_token text; v_expires_at timestamptz := now()+interval '5 minutes';
begin
  select c.id into v_customer_id from public.customers c
    where c.auth_user_id=p_auth_user_id and c.status='ACTIVE' for update;
  if not found then raise exception 'CUSTOMER_NOT_LINKED' using errcode='42501'; end if;
  update public.customer_qr_tokens t set revoked_at=now()
    where t.customer_id=v_customer_id and t.revoked_at is null and t.expires_at>now();
  v_token := encode(extensions.gen_random_bytes(32),'hex');
  insert into public.customer_qr_tokens(token_hash,customer_id,expires_at)
    values(extensions.digest(v_token,'sha256'),v_customer_id,v_expires_at);
  return query select v_token,v_expires_at;
end; $$;

create function public.api_validate_customer_qr(p_token text)
returns table(customer_id uuid,public_id text,display_name text,available_points integer,
  lifetime_points integer,purchase_count integer)
language plpgsql security definer set search_path = '' as $$
begin
  if p_token !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_QR_TOKEN' using errcode='22023'; end if;
  return query select c.id,c.public_id,c.display_name,
    coalesce(a.available_points,0),coalesce(a.lifetime_points,0),coalesce(a.purchase_count,0)
  from public.customer_qr_tokens t
  join public.customers c on c.id=t.customer_id and c.status='ACTIVE'
  left join public.loyalty_accounts a on a.customer_id=c.id
  where t.token_hash=extensions.digest(p_token,'sha256')
    and t.revoked_at is null and t.expires_at>now();
end; $$;

create function public.api_operational_health()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'historicalCompletedWithoutSale',(
      select count(*) from public.orders o left join public.central_sales s on s.order_id=o.id
      where o.status='COMPLETED' and s.id is null),
    'rejectedDeviceOperations',(
      select count(*) from public.sync_operations s where status='REJECTED' and operation_type='SALE'
        and not exists (select 1 from public.sync_operation_reconciliations r
          where r.sync_operation_id=s.id)),
    'rejectedOtherOperations',(
      select count(*) from public.sync_operations s where status='REJECTED' and operation_type<>'SALE'),
    'receivedDeviceSales',(
      select count(*) from public.sync_operations where status='RECEIVED' and operation_type='SALE'),
    'activeReservations',(
      select count(*) from public.order_reservations where state='RESERVED'),
    'uninitializedFlavors',(
      select count(*) from public.product_variants pv left join public.variant_stock s on s.variant_id=pv.id
      where pv.active and (s.variant_id is null or not s.initialized)),
    'ordersEnabled',(select orders_enabled from public.sale_mode where id),
    'checkedAt',now()
  );
$$;

revoke execute on function public.api_issue_customer_qr(uuid) from public,anon,authenticated;
revoke execute on function public.api_validate_customer_qr(text) from public,anon,authenticated;
revoke execute on function public.api_operational_health() from public,anon,authenticated;
grant execute on function public.api_issue_customer_qr(uuid) to service_role;
grant execute on function public.api_validate_customer_qr(text) to service_role;
grant execute on function public.api_operational_health() to service_role;
commit;
