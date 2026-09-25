-- Stock starts at zero. Count each flavor before enabling online orders.
-- Run on a backed-up database; do not reconcile historical COMPLETED orders here.
begin;

create table public.sale_mode (
  id boolean primary key default true check (id),
  orders_enabled boolean not null default false,
  location text not null default '',
  eta_minutes integer,
  updated_at timestamptz not null default now(),
  constraint sale_mode_eta check (eta_minutes is null or eta_minutes between 1 and 240)
);
insert into public.sale_mode(id) values (true);

create table public.variant_stock (
  variant_id uuid primary key references public.product_variants(id) on delete restrict,
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= on_hand),
  initialized boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.variant_stock(variant_id) select id from public.product_variants;

create table public.stock_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.variant_stock(variant_id),
  on_hand_delta integer not null,
  reserved_delta integer not null,
  source_type text not null check (source_type in ('COUNT','RESERVE','RELEASE','ORDER_SALE','DEVICE_SALE','DEVICE_REVERSAL')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, variant_id),
  check (on_hand_delta <> 0 or reserved_delta <> 0)
);

create table public.stock_counts (
  idempotency_key uuid primary key,
  variant_id uuid not null references public.variant_stock(variant_id),
  counted_quantity integer not null check (counted_quantity >= 0),
  created_at timestamptz not null default now()
);

create table public.order_reservations (
  order_id uuid not null references public.orders(id) on delete restrict,
  variant_id uuid not null references public.variant_stock(variant_id),
  quantity integer not null check (quantity between 1 and 100),
  state text not null default 'RESERVED' check (state in ('RESERVED','RELEASED','CONSUMED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (order_id, variant_id)
);

create table public.central_sales (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references public.orders(id) on delete restrict,
  device_id uuid references public.app_devices(id) on delete restrict,
  client_operation_id uuid,
  payment_id uuid references public.payments(id) on delete restrict,
  payment_method public.payment_method not null,
  total_cents integer not null check (total_cents > 0),
  currency_code text not null default 'USD',
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_operation_id uuid unique references public.sync_operations(id) on delete restrict,
  constraint central_sales_source check (
    (order_id is not null and device_id is null and client_operation_id is null and payment_id is not null) or
    (order_id is null and device_id is not null and client_operation_id is not null and payment_id is null)
  ),
  unique (device_id, client_operation_id)
);
create table public.central_sale_items (
  sale_id uuid not null references public.central_sales(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 100),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  primary key (sale_id, variant_id)
);

alter table public.sync_operations drop constraint sync_operations_type_check;
alter table public.sync_operations add constraint sync_operations_type_check check (operation_type in (
  'SEED','OPENING_BALANCE','SALE','REVERSAL','PURCHASE','EXPENSE','LOAN',
  'LOAN_PAYMENT','PARTNER_PAYMENT','ADJUSTMENT','SESSION',
  'SESSION_START','SESSION_CLOSE','TRANSFER'
));

create table public.sync_operation_reconciliations (
  sync_operation_id uuid primary key references public.sync_operations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  created_at timestamptz not null default now()
);
alter table public.sync_operation_reconciliations enable row level security;
revoke all on public.sync_operation_reconciliations from public,anon,authenticated;

alter table public.sale_mode enable row level security;
alter table public.variant_stock enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_counts enable row level security;
alter table public.order_reservations enable row level security;
alter table public.central_sales enable row level security;
alter table public.central_sale_items enable row level security;
revoke all on public.sale_mode, public.variant_stock, public.stock_movements, public.stock_counts,
  public.order_reservations, public.central_sales, public.central_sale_items
  from public, anon, authenticated;

-- Keep the old order creator as an internal implementation. The wrapper reserves
-- stock in the same PostgreSQL transaction, or rolls the order back entirely.
alter function public.api_create_order(uuid,uuid,text,text,public.payment_method,text,text,text,jsonb)
  rename to api_create_order_unreserved;
revoke execute on function public.api_create_order_unreserved(uuid,uuid,text,text,public.payment_method,text,text,text,jsonb)
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
declare v_order record; v_item record; v_stock public.variant_stock%rowtype;
begin
  -- A retry of an existing request must work while the sale mode is off.
  select * into v_order from public.api_create_order_unreserved(
    p_auth_user_id,p_idempotency_key,p_request_hash,p_delivery_location,
    p_payment_method,p_customer_name,p_customer_phone,p_customer_notes,p_items);
  if not v_order.replayed then
    if not exists (select 1 from public.sale_mode m where m.id and m.orders_enabled) then
      raise exception 'ORDERS_CLOSED' using errcode = 'P0001';
    end if;
    for v_item in
      select oi.product_variant_id as variant_id, oi.quantity
      from public.order_items oi where oi.order_id = v_order.id
      order by oi.product_variant_id
    loop
      select * into v_stock from public.variant_stock s where s.variant_id = v_item.variant_id for update;
      if not found or not v_stock.initialized or v_stock.on_hand - v_stock.reserved < v_item.quantity then
        raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
      end if;
      update public.variant_stock set reserved = reserved + v_item.quantity, updated_at = now()
        where variant_id = v_item.variant_id;
      insert into public.order_reservations(order_id,variant_id,quantity)
        values (v_order.id,v_item.variant_id,v_item.quantity);
      insert into public.stock_movements(variant_id,on_hand_delta,reserved_delta,source_type,source_id)
        values (v_item.variant_id,0,v_item.quantity,'RESERVE',v_order.id);
    end loop;
  end if;
  return query select v_order.id,v_order.public_code,v_order.status,v_order.payment_status,
    v_order.currency_code,v_order.subtotal_cents,v_order.total_cents,v_order.created_at,v_order.replayed;
end; $$;

-- Retire the legacy direct transition to COMPLETED, including for service_role.
alter function public.api_transition_order(uuid,public.order_status,uuid,text)
  rename to api_transition_order_unsettled;
revoke execute on function public.api_transition_order_unsettled(uuid,public.order_status,uuid,text)
  from public, anon, authenticated, service_role;

create function public.api_transition_order(
  p_order_id uuid, p_to_status public.order_status,
  p_actor_user_id uuid, p_note text default null
)
returns table (id uuid, public_code text, status public.order_status,
  payment_status public.payment_status, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_result record; v_reservation record;
begin
  if p_to_status = 'COMPLETED' then
    raise exception 'USE_SETTLEMENT' using errcode = 'P0001';
  end if;
  if p_to_status = 'CANCELLED' and exists (
    select 1 from public.orders o where o.id=p_order_id and o.payment_status='CONFIRMED' for update
  ) then
    raise exception 'PAYMENT_REFUND_REQUIRED' using errcode='P0001';
  end if;
  select * into v_result from public.api_transition_order_unsettled(
    p_order_id,p_to_status,p_actor_user_id,p_note);
  if p_to_status = 'CANCELLED' then
    for v_reservation in
      select * from public.order_reservations r
      where r.order_id = p_order_id and r.state = 'RESERVED' order by r.variant_id for update
    loop
      update public.variant_stock set reserved = reserved - v_reservation.quantity, updated_at = now()
        where variant_id = v_reservation.variant_id;
      update public.order_reservations set state = 'RELEASED', updated_at = now()
        where order_id = p_order_id and variant_id = v_reservation.variant_id;
      insert into public.stock_movements(variant_id,on_hand_delta,reserved_delta,source_type,source_id)
        values (v_reservation.variant_id,0,-v_reservation.quantity,'RELEASE',p_order_id);
    end loop;
  end if;
  return query select v_result.id,v_result.public_code,v_result.status,
    v_result.payment_status,v_result.updated_at;
end; $$;

create function public.api_set_sale_mode(p_orders_enabled boolean,p_location text,p_eta_minutes integer)
returns public.sale_mode language plpgsql security definer set search_path = '' as $$
declare v_mode public.sale_mode%rowtype;
begin
  if char_length(btrim(coalesce(p_location,''))) > 200 or
     (p_orders_enabled and (char_length(btrim(coalesce(p_location,''))) < 3 or p_eta_minutes not between 1 and 240)) then
    raise exception 'INVALID_SALE_MODE' using errcode = '22023';
  end if;
  if p_orders_enabled then
    if exists (select 1 from public.product_variants pv left join public.variant_stock s on s.variant_id=pv.id
      where pv.active and (s.variant_id is null or not s.initialized)) then
      raise exception 'STOCK_NOT_READY' using errcode='P0001';
    end if;
    if exists (select 1 from public.sync_operations s
      where s.operation_type='SALE' and s.status in ('RECEIVED','REJECTED')
        and not exists (select 1 from public.sync_operation_reconciliations r
          where r.sync_operation_id=s.id)) then
      raise exception 'SALES_RECONCILIATION_REQUIRED' using errcode='P0001';
    end if;
    if exists (select 1 from public.orders o where o.status in ('PENDING','ACCEPTED','OUT_FOR_DELIVERY')
      and (select count(*) from public.order_reservations r where r.order_id=o.id and r.state='RESERVED') <>
          (select count(*) from public.order_items oi where oi.order_id=o.id)) then
      raise exception 'UNRESERVED_ORDERS' using errcode='P0001';
    end if;
  end if;
  update public.sale_mode set orders_enabled=p_orders_enabled,
    location=btrim(coalesce(p_location,'')),eta_minutes=p_eta_minutes,updated_at=now()
    where id returning * into v_mode;
  return v_mode;
end; $$;

create function public.api_reconcile_device_sale(
  p_sync_operation_id uuid,p_actor_user_id uuid,p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_operation public.sync_operations%rowtype;
begin
  if not exists (select 1 from public.app_user_roles r
    where r.auth_user_id=p_actor_user_id and r.role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 10 and 500 then
    raise exception 'INVALID_REASON' using errcode='22023';
  end if;
  select * into v_operation from public.sync_operations where id=p_sync_operation_id for update;
  if not found or v_operation.operation_type<>'SALE' or v_operation.status not in ('RECEIVED','REJECTED') then
    raise exception 'INVALID_OPERATION' using errcode='22023';
  end if;
  if exists (select 1 from public.sync_operation_reconciliations r
    where r.sync_operation_id=v_operation.id) then
    return jsonb_build_object('operationId',v_operation.id,'replayed',true);
  end if;
  if exists (select 1 from public.product_variants pv
    where pv.active and not exists (select 1 from public.stock_counts c
      where c.variant_id=pv.id and c.created_at>v_operation.received_at)) then
    raise exception 'STOCK_RECOUNT_REQUIRED' using errcode='P0001';
  end if;
  insert into public.sync_operation_reconciliations(sync_operation_id,actor_user_id,reason)
    values(v_operation.id,p_actor_user_id,btrim(p_reason));
  if v_operation.status='RECEIVED' then
    update public.sync_operations set status='REJECTED',attempts=attempts+1,
      error_code='MANUALLY_RECONCILED' where id=v_operation.id;
  end if;
  return jsonb_build_object('operationId',v_operation.id,'replayed',false);
end; $$;

create function public.api_unreconciled_device_sales()
returns table(id uuid,device_id uuid,client_operation_id uuid,status text,
  error_code text,received_at timestamptz,payload jsonb)
language sql stable security definer set search_path = '' as $$
  select s.id,s.device_id,s.client_operation_id,s.status,s.error_code,s.received_at,s.payload
  from public.sync_operations s
  left join public.sync_operation_reconciliations r on r.sync_operation_id=s.id
  where s.operation_type='SALE' and s.status in ('RECEIVED','REJECTED')
    and r.sync_operation_id is null
  order by s.received_at desc,s.server_sequence desc limit 200;
$$;

create function public.api_count_stock(p_variant_id uuid,p_quantity integer,p_idempotency_key uuid)
returns public.variant_stock language plpgsql security definer set search_path = '' as $$
declare v_stock public.variant_stock%rowtype; v_prior public.stock_counts%rowtype; v_delta integer;
begin
  if p_quantity is null or p_quantity < 0 then raise exception 'INVALID_QUANTITY' using errcode='22023'; end if;
  insert into public.variant_stock(variant_id) values(p_variant_id) on conflict do nothing;
  select * into v_stock from public.variant_stock where variant_id=p_variant_id for update;
  if not found then raise exception 'INVALID_PRODUCT_VARIANT' using errcode='22023'; end if;
  select * into v_prior from public.stock_counts where idempotency_key=p_idempotency_key;
  if found then
    if v_prior.variant_id <> p_variant_id or v_prior.counted_quantity <> p_quantity then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    return v_stock;
  end if;
  if p_quantity < v_stock.reserved then raise exception 'STOCK_BELOW_RESERVATIONS' using errcode='P0001'; end if;
  v_delta := p_quantity-v_stock.on_hand;
  insert into public.stock_counts(idempotency_key,variant_id,counted_quantity)
    values(p_idempotency_key,p_variant_id,p_quantity);
  if v_delta <> 0 then
    insert into public.stock_movements(variant_id,on_hand_delta,reserved_delta,source_type,source_id)
      values(p_variant_id,v_delta,0,'COUNT',p_idempotency_key);
  end if;
  update public.variant_stock set on_hand=p_quantity,initialized=true,updated_at=now()
    where variant_id=p_variant_id returning * into v_stock;
  return v_stock;
end; $$;

-- One function owns the order, payment, stock, sale and loyalty commit.
-- Row locks plus the unique order_id make retries and double taps harmless.
create function public.api_complete_order(p_order_id uuid,p_idempotency_key uuid,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_sale public.central_sales%rowtype;
  v_item record;
  v_reserved public.order_reservations%rowtype;
  v_customer public.customers%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_streak public.customer_streaks%rowtype;
  v_next_streak integer;
  v_points integer;
  v_level text;
  v_today date;
  v_last_day date;
  v_badge record;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_sale from public.central_sales where order_id=p_order_id;
  if found then
    return jsonb_build_object('orderId',p_order_id,'saleId',v_sale.id,'status','COMPLETED','replayed',true);
  end if;
  if v_order.status <> 'OUT_FOR_DELIVERY' then raise exception 'INVALID_TRANSITION' using errcode='P0001'; end if;
  if v_order.payment_status <> 'CONFIRMED' then raise exception 'PAYMENT_REQUIRED' using errcode='P0001'; end if;
  select * into v_payment from public.payments
    where order_id=p_order_id and status='CONFIRMED'
      and amount_cents=v_order.total_cents and method=v_order.payment_method
    order by confirmed_at desc,id desc limit 1;
  if not found then raise exception 'PAYMENT_REQUIRED' using errcode='P0001'; end if;
  if (select count(*) from public.order_reservations where order_id=p_order_id and state='RESERVED') <>
     (select count(*) from public.order_items where order_id=p_order_id) then
    raise exception 'RESERVATION_REQUIRED' using errcode='P0001';
  end if;
  insert into public.central_sales(order_id,payment_id,payment_method,total_cents,currency_code,idempotency_key)
    values(p_order_id,v_payment.id,v_order.payment_method,v_order.total_cents,v_order.currency_code,p_idempotency_key)
    returning * into v_sale;
  for v_item in select * from public.order_items where order_id=p_order_id order by product_variant_id loop
    select * into v_reserved from public.order_reservations
      where order_id=p_order_id and variant_id=v_item.product_variant_id for update;
    if not found or v_reserved.state <> 'RESERVED' or v_reserved.quantity <> v_item.quantity then
      raise exception 'RESERVATION_REQUIRED' using errcode='P0001';
    end if;
    update public.variant_stock set on_hand=on_hand-v_item.quantity,
      reserved=reserved-v_item.quantity,updated_at=now()
      where variant_id=v_item.product_variant_id and on_hand>=v_item.quantity
        and reserved>=v_item.quantity;
    if not found then raise exception 'OUT_OF_STOCK' using errcode='P0001'; end if;
    update public.order_reservations set state='CONSUMED',updated_at=now()
      where order_id=p_order_id and variant_id=v_item.product_variant_id;
    insert into public.stock_movements(variant_id,on_hand_delta,reserved_delta,source_type,source_id)
      values(v_item.product_variant_id,-v_item.quantity,-v_item.quantity,'ORDER_SALE',p_order_id);
    insert into public.central_sale_items(sale_id,variant_id,quantity,unit_price_cents)
      values(v_sale.id,v_item.product_variant_id,v_item.quantity,v_item.unit_price_cents);
  end loop;
  if v_order.customer_id is not null then
    select * into v_customer from public.customers where id=v_order.customer_id and status='ACTIVE' for update;
    if not found then raise exception 'CUSTOMER_NOT_LINKED' using errcode='P0001'; end if;
    insert into public.loyalty_accounts(customer_id) values(v_customer.id) on conflict do nothing;
    insert into public.customer_streaks(customer_id) values(v_customer.id) on conflict do nothing;
    select * into v_account from public.loyalty_accounts where customer_id=v_customer.id for update;
    select * into v_streak from public.customer_streaks where customer_id=v_customer.id for update;
    -- Match the legacy daily rule in the business timezone. Additional orders
    -- still settle, but only the first one today qualifies for streak points.
    v_today := (now() at time zone 'America/Bogota')::date;
    v_last_day := (v_streak.last_qualified_at at time zone 'America/Bogota')::date;
    v_points := 0;
    if v_last_day is null or v_last_day < v_today then
      v_next_streak := case
        when v_last_day is not null and v_today-v_last_day <= 4 then v_streak.current_count+1
        else 1 end;
      v_points := case when v_next_streak>=14 then 17 when v_next_streak>=7 then 15
        when v_next_streak>=3 then 12 else 10 end;
      select key into v_level from public.loyalty_levels
        where active and minimum_lifetime_points<=v_account.lifetime_points+v_points
        order by minimum_lifetime_points desc limit 1;
      update public.loyalty_accounts set available_points=available_points+v_points,
        lifetime_points=lifetime_points+v_points,purchase_points=purchase_points+v_points,
        purchase_count=purchase_count+1,version=version+1,
        level_key=coalesce(v_level,level_key),updated_at=now()
        where customer_id=v_customer.id returning * into v_account;
      insert into public.loyalty_transactions(customer_id,entry_type,points_delta,balance_after,
        source_system,source_id,description)
        values(v_customer.id,'PURCHASE_EARN',v_points,v_account.available_points,
          'SUPABASE',p_order_id::text,'Pedido entregado');
      update public.customer_streaks set current_count=case when v_next_streak>=30 then 0 else v_next_streak end,
        best_count=greatest(best_count,v_next_streak),
        current_season_number=current_season_number+case when v_next_streak>=30 then 1 else 0 end,
        last_qualified_at=now(),updated_at=now() where customer_id=v_customer.id;
      insert into public.streak_seasons(customer_id,season_number,started_at)
        values(v_customer.id,v_streak.current_season_number,now())
        on conflict (customer_id,season_number) do nothing;
      update public.streak_seasons set completed_streak=greatest(completed_streak,v_next_streak),
        milestones=coalesce((select array_agg(distinct h order by h) from unnest(
          milestones || array(select m from unnest(array[3,7,14,21,30]) m where m<=v_next_streak)) h),'{}'::integer[]),
        preserved_points=v_account.lifetime_points,preserved_level_key=v_account.level_key,
        ended_at=case when v_next_streak>=30 then now() else ended_at end,
        status=case when v_next_streak>=30 then 'COMPLETED'::public.streak_season_status else status end
        where customer_id=v_customer.id and season_number=v_streak.current_season_number and status='ACTIVE';
      for v_badge in select id,key from public.badges where active and
        ((condition_type='PURCHASE_COUNT' and condition_threshold<=v_account.purchase_count)
          or (condition_type='STREAK_COUNT' and condition_threshold<=v_next_streak)) loop
        insert into public.customer_badges(customer_id,badge_id,source_system,source_id)
          values(v_customer.id,v_badge.id,'SUPABASE',p_order_id::text||':'||v_badge.key)
          on conflict (customer_id,badge_id) do nothing;
      end loop;
    end if;
    update public.customers set last_purchase_at=now() where id=v_customer.id;
  end if;
  update public.orders set status='COMPLETED',completed_at=now() where id=p_order_id;
  insert into public.order_events(order_id,from_status,to_status,actor_type,actor_user_id,note)
    values(p_order_id,'OUT_FOR_DELIVERY','COMPLETED','ADMIN',p_actor_user_id,'Entrega y venta conciliadas');
  return jsonb_build_object('orderId',p_order_id,'saleId',v_sale.id,'status','COMPLETED',
    'pointsEarned',coalesce(v_points,0),'replayed',false);
end; $$;

-- The existing outbox receiver only stored audit events. Apply flavored sales
-- before acknowledging them, using the same device/operation identity forever.
alter function public.api_push_sync_operations(uuid,uuid,text,text,jsonb)
  rename to api_push_sync_operations_unapplied;
revoke execute on function public.api_push_sync_operations_unapplied(uuid,uuid,text,text,jsonb)
  from public,anon,authenticated,service_role;

create function public.api_apply_device_sale(p_sync_operation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_operation public.sync_operations%rowtype;
  v_sale public.central_sales%rowtype;
  v_item record;
  v_total bigint := 0;
  v_item_quantity bigint := 0;
  v_quantity integer;
  v_price integer;
  v_variant_id uuid;
  v_method public.payment_method;
  v_items jsonb;
  v_remote_order_id uuid;
begin
  select * into v_operation from public.sync_operations where id=p_sync_operation_id for update;
  if not found or v_operation.operation_type <> 'SALE' then raise exception 'INVALID_OPERATION' using errcode='22023'; end if;
  if v_operation.status <> 'RECEIVED' then return; end if;
  if v_operation.payload->'details' ? 'remoteOrderId' then
    v_remote_order_id := (v_operation.payload->'details'->>'remoteOrderId')::uuid;
    perform 1 from public.central_sales s join public.orders o on o.id=s.order_id
      where o.id=v_remote_order_id and o.status='COMPLETED'
        and s.total_cents=(v_operation.payload->>'amountCents')::integer
        and s.payment_method=(v_operation.payload->>'accountCode')::public.payment_method;
    if not found then raise exception 'ORDER_SALE_NOT_FOUND' using errcode='P0001'; end if;
    update public.sync_operations set status='APPLIED',attempts=attempts+1,applied_at=now(),error_code=null
      where id=v_operation.id;
    return;
  end if;
  v_items := v_operation.payload->'details'->'items';
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) not between 1 and 4 then
    raise exception 'FLAVOR_REQUIRED' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(v_items) x group by x->>'sku' having count(*)>1) then
    raise exception 'DUPLICATE_VARIANT' using errcode='22023';
  end if;
  v_method := case v_operation.payload->>'accountCode'
    when 'CASH' then 'CASH'::public.payment_method
    when 'YAPPY' then 'YAPPY'::public.payment_method
    else null end;
  if v_method is null then raise exception 'INVALID_PAYMENT_METHOD' using errcode='22023'; end if;
  -- Use the same UUID lock order as web reservations and order settlement.
  for v_item in select x.value from jsonb_array_elements(v_items) x
    left join public.product_variants pv on pv.sku=x.value->>'sku'
    order by pv.id nulls first loop
    begin v_quantity := (v_item.value->>'quantity')::integer;
    exception when others then raise exception 'INVALID_QUANTITY' using errcode='22023'; end;
    if v_quantity not between 1 and 99 then raise exception 'INVALID_QUANTITY' using errcode='22023'; end if;
    v_item_quantity := v_item_quantity+v_quantity;
    select pv.id,pv.unit_price_cents into v_variant_id,v_price from public.product_variants pv
      where pv.sku=v_item.value->>'sku' and pv.active and pv.available;
    if not found then raise exception 'INVALID_PRODUCT_VARIANT' using errcode='22023'; end if;
    perform 1 from public.variant_stock where variant_id=v_variant_id and initialized
      and on_hand-reserved>=v_quantity for update;
    if not found then raise exception 'OUT_OF_STOCK' using errcode='P0001'; end if;
    v_total := v_total+v_quantity::bigint*v_price;
  end loop;
  if v_item_quantity <> (v_operation.payload->'details'->>'quantity')::bigint then
    raise exception 'SALE_QUANTITY_MISMATCH' using errcode='22023';
  end if;
  if v_total <= 0 or v_total > 2147483647 or
     v_total <> (v_operation.payload->>'amountCents')::bigint then
    raise exception 'SALE_TOTAL_MISMATCH' using errcode='22023';
  end if;
  insert into public.central_sales(device_id,client_operation_id,payment_method,total_cents,idempotency_key)
    values(v_operation.device_id,v_operation.client_operation_id,v_method,v_total::integer,v_operation.client_operation_id)
    returning * into v_sale;
  for v_item in select x.value from jsonb_array_elements(v_items) x
    join public.product_variants pv on pv.sku=x.value->>'sku' order by pv.id loop
    v_quantity := (v_item.value->>'quantity')::integer;
    select pv.id,pv.unit_price_cents into v_variant_id,v_price from public.product_variants pv
      where pv.sku=v_item.value->>'sku';
    update public.variant_stock set on_hand=on_hand-v_quantity,updated_at=now()
      where variant_id=v_variant_id and on_hand-reserved>=v_quantity;
    if not found then raise exception 'OUT_OF_STOCK' using errcode='P0001'; end if;
    insert into public.central_sale_items(sale_id,variant_id,quantity,unit_price_cents)
      values(v_sale.id,v_variant_id,v_quantity,v_price);
    insert into public.stock_movements(variant_id,on_hand_delta,reserved_delta,source_type,source_id)
      values(v_variant_id,-v_quantity,0,'DEVICE_SALE',v_sale.id);
  end loop;
  update public.sync_operations set status='APPLIED',attempts=attempts+1,applied_at=now(),error_code=null
    where id=v_operation.id;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'INVALID_SALE_PAYLOAD' using errcode='22023';
end; $$;

create function public.api_apply_device_reversal(p_sync_operation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_operation public.sync_operations%rowtype;
  v_original public.sync_operations%rowtype;
  v_sale public.central_sales%rowtype;
  v_item record;
  v_original_event_id bigint;
begin
  select * into v_operation from public.sync_operations where id=p_sync_operation_id for update;
  if not found or v_operation.operation_type <> 'REVERSAL' then
    raise exception 'INVALID_OPERATION' using errcode='22023';
  end if;
  if v_operation.status <> 'RECEIVED' then return; end if;
  begin
    v_original_event_id := (v_operation.payload->>'reversedEventId')::bigint;
  exception when others then
    raise exception 'INVALID_REVERSAL' using errcode='22023';
  end;
  if v_original_event_id is null then raise exception 'INVALID_REVERSAL' using errcode='22023'; end if;
  select * into v_original from public.sync_operations s
    where s.device_id=v_operation.device_id and s.operation_type='SALE'
      and (s.payload->>'localEventId')::bigint=v_original_event_id
    order by s.server_sequence limit 1 for update;
  if not found then raise exception 'ORIGINAL_SALE_NOT_FOUND' using errcode='P0003'; end if;
  if v_original.status='RECEIVED' then raise exception 'ORIGINAL_SALE_PENDING' using errcode='P0003'; end if;
  if v_original.status='APPLIED' and v_original.payload->'details' ? 'remoteOrderId' then
    raise exception 'ORDER_REVERSAL_FORBIDDEN' using errcode='P0001';
  end if;
  select * into v_sale from public.central_sales
    where device_id=v_operation.device_id and client_operation_id=v_original.client_operation_id for update;
  if found then
    if v_sale.reversal_operation_id is not null and v_sale.reversal_operation_id<>v_operation.id then
      raise exception 'SALE_ALREADY_REVERSED' using errcode='P0001';
    end if;
    if v_sale.reversal_operation_id is null then
      for v_item in select * from public.central_sale_items where sale_id=v_sale.id order by variant_id loop
        update public.variant_stock set on_hand=on_hand+v_item.quantity,updated_at=now()
          where variant_id=v_item.variant_id;
        insert into public.stock_movements(variant_id,on_hand_delta,reserved_delta,source_type,source_id)
          values(v_item.variant_id,v_item.quantity,0,'DEVICE_REVERSAL',v_operation.id);
      end loop;
      update public.central_sales set reversed_at=now(),reversal_operation_id=v_operation.id where id=v_sale.id;
    end if;
  end if;
  update public.sync_operations set status='APPLIED',attempts=attempts+1,applied_at=now(),error_code=null
    where id=v_operation.id;
end; $$;

create function public.api_push_sync_operations(
  p_auth_user_id uuid,p_device_public_id uuid,p_device_name text,p_app_version text,p_operations jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_received jsonb; v_device public.app_devices%rowtype; v_op jsonb;
  v_row public.sync_operations%rowtype; v_ack jsonb := '[]'::jsonb; v_error text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_device_public_id::text,0));
  if exists (select 1 from public.app_devices d where d.device_public_id=p_device_public_id
    and d.auth_user_id<>p_auth_user_id) then
    raise exception 'DEVICE_OWNERSHIP' using errcode='42501';
  end if;
  v_received := public.api_push_sync_operations_unapplied(
    p_auth_user_id,p_device_public_id,p_device_name,p_app_version,p_operations);
  select * into v_device from public.app_devices where device_public_id=p_device_public_id;
  for v_op in select value from jsonb_array_elements(p_operations) loop
    select * into v_row from public.sync_operations
      where device_id=v_device.id and client_operation_id=(v_op->>'clientOperationId')::uuid;
    if v_row.operation_type in ('SALE','REVERSAL') and v_row.status='RECEIVED' then
      begin
        if v_row.operation_type='SALE' then
          perform public.api_apply_device_sale(v_row.id);
        else
          perform public.api_apply_device_reversal(v_row.id);
        end if;
      exception when sqlstate '22023' or sqlstate 'P0001' then
        v_error := left(sqlerrm,80);
        update public.sync_operations set status='REJECTED',attempts=attempts+1,error_code=v_error
          where id=v_row.id;
        if v_row.operation_type='SALE' then
          update public.sale_mode set orders_enabled=false,updated_at=now()
            where id and orders_enabled;
        end if;
      end;
    end if;
    select * into v_row from public.sync_operations where id=v_row.id;
    v_ack := v_ack || jsonb_build_array(jsonb_build_object(
      'clientOperationId',v_row.client_operation_id,'status',v_row.status,
      'serverSequence',v_row.server_sequence,'errorCode',v_row.error_code,
      'replayed',coalesce((select (x->>'replayed')::boolean from jsonb_array_elements(v_received->'acknowledgements') x
        where x->>'clientOperationId'=v_row.client_operation_id::text),false)));
  end loop;
  return jsonb_build_object('deviceId',p_device_public_id,'acknowledgements',v_ack);
end; $$;

revoke execute on function public.api_create_order(uuid,uuid,text,text,public.payment_method,text,text,text,jsonb)
  from public, anon, authenticated;
revoke execute on function public.api_transition_order(uuid,public.order_status,uuid,text)
  from public, anon, authenticated;
revoke execute on function public.api_set_sale_mode(boolean,text,integer) from public,anon,authenticated;
revoke execute on function public.api_count_stock(uuid,integer,uuid) from public,anon,authenticated;
revoke execute on function public.api_complete_order(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.api_apply_device_sale(uuid) from public,anon,authenticated,service_role;
revoke execute on function public.api_apply_device_reversal(uuid) from public,anon,authenticated,service_role;
revoke execute on function public.api_reconcile_device_sale(uuid,uuid,text) from public,anon,authenticated;
revoke execute on function public.api_unreconciled_device_sales() from public,anon,authenticated;
revoke execute on function public.api_push_sync_operations(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.api_create_order(uuid,uuid,text,text,public.payment_method,text,text,text,jsonb) to service_role;
grant execute on function public.api_transition_order(uuid,public.order_status,uuid,text) to service_role;
grant execute on function public.api_set_sale_mode(boolean,text,integer) to service_role;
grant execute on function public.api_count_stock(uuid,integer,uuid) to service_role;
grant execute on function public.api_reconcile_device_sale(uuid,uuid,text) to service_role;
grant execute on function public.api_unreconciled_device_sales() to service_role;
grant execute on function public.api_complete_order(uuid,uuid,uuid) to service_role;
grant execute on function public.api_push_sync_operations(uuid,uuid,text,text,jsonb) to service_role;
commit;
