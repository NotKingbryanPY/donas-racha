-- New daily business ledger. Independent from archived mobile provisioning/sync.
-- Install is additive: no reseed, no stock/history rewrites, no old outbox import.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
  if to_regclass('public.inventory_movements') is null or
     to_regclass('public.inventory_revision') is null or
     to_regclass('public.inventory_manual_counts') is null then
    raise exception 'SHARED_INVENTORY_REQUIRED';
  end if;
end $$;

create table if not exists public.daily_sessions (
  id uuid primary key default gen_random_uuid(),
  business_date date not null default (clock_timestamp() at time zone 'America/Panama')::date,
  opened_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  closing_operation_id uuid unique,
  closing_summary jsonb
);
create unique index if not exists daily_one_open_session on public.daily_sessions((true)) where closed_at is null;
create table if not exists public.daily_operations (
  id uuid primary key,
  server_sequence bigint generated always as identity unique,
  session_id uuid not null references public.daily_sessions(id),
  actor_user_id uuid references auth.users(id),
  kind text not null check(kind in ('PURCHASE','SALE','CONSUMPTION','CORRECTION','WEB_SALE','CLOSE')),
  request_hash text not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  investment_cents bigint not null default 0 check(investment_cents>=0),
  revenue_cents bigint not null default 0 check(revenue_cents>=0),
  cash_cents bigint not null default 0 check(cash_cents>=0),
  yappy_cents bigint not null default 0 check(yappy_cents>=0),
  cost_cents numeric(24,8) not null default 0 check(cost_cents>=0),
  unknown_cost_units bigint not null default 0 check(unknown_cost_units>=0),
  order_id uuid unique references public.orders(id)
);
create index if not exists daily_operations_session_sequence on public.daily_operations(session_id,server_sequence);
create table if not exists public.daily_operation_items (
  operation_id uuid not null references public.daily_operations(id),
  variant_id uuid not null references public.product_variants(id),
  name_snapshot text not null,
  sku_snapshot text not null,
  quantity bigint not null,
  per_box_quantity integer,
  unit_price_cents bigint,
  cost_cents numeric(24,8) not null default 0,
  unknown_cost_units bigint not null default 0,
  primary key(operation_id,variant_id)
);
create table if not exists public.daily_cost_lots (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants(id),
  source_operation_id uuid references public.daily_operations(id),
  remaining_quantity bigint not null check(remaining_quantity>=0),
  unit_cost_cents numeric(24,8),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists daily_cost_lots_fifo on public.daily_cost_lots(variant_id,id) where remaining_quantity>0;
alter table public.daily_sessions enable row level security;
alter table public.daily_operations enable row level security;
alter table public.daily_operation_items enable row level security;
alter table public.daily_cost_lots enable row level security;
revoke all on public.daily_sessions,public.daily_operations,public.daily_operation_items,public.daily_cost_lots from public,anon,authenticated;
grant select on public.daily_sessions,public.daily_operations,public.daily_operation_items,public.daily_cost_lots to service_role;
insert into public.daily_sessions(id) select gen_random_uuid() where not exists(select 1 from public.daily_sessions where closed_at is null);

-- Internal helper: match cost coverage to real shared stock, never change units.
create or replace function public.daily_take_cost(p_variant uuid,p_quantity bigint,p_physical_before bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_covered bigint; v_excess bigint; v_left bigint:=p_quantity; v_take bigint;
  v_cost numeric:=0; v_unknown bigint:=0; v_lot record;
begin
  select coalesce(sum(remaining_quantity),0) into v_covered from public.daily_cost_lots where variant_id=p_variant;
  if v_covered<greatest(0,p_physical_before) then
    insert into public.daily_cost_lots(variant_id,remaining_quantity,unit_cost_cents)
      values(p_variant,greatest(0,p_physical_before)-v_covered,null);
  elsif v_covered>greatest(0,p_physical_before) then
    v_excess:=v_covered-greatest(0,p_physical_before);
    for v_lot in select * from public.daily_cost_lots where variant_id=p_variant and remaining_quantity>0 order by id for update loop
      v_take:=least(v_excess,v_lot.remaining_quantity);
      update public.daily_cost_lots set remaining_quantity=remaining_quantity-v_take where id=v_lot.id;
      v_excess:=v_excess-v_take; exit when v_excess=0;
    end loop;
  end if;
  for v_lot in select * from public.daily_cost_lots where variant_id=p_variant and remaining_quantity>0
      order by id for update loop
    exit when v_left=0;
    v_take:=least(v_left,v_lot.remaining_quantity);
    update public.daily_cost_lots set remaining_quantity=remaining_quantity-v_take where id=v_lot.id;
    if v_lot.unit_cost_cents is null then v_unknown:=v_unknown+v_take;
    else v_cost:=v_cost+v_take*v_lot.unit_cost_cents; end if;
    v_left:=v_left-v_take;
  end loop;
  if v_left<>0 then raise exception 'COST_STOCK_MISMATCH'; end if;
  return jsonb_build_object('costCents',v_cost,'unknownCostUnits',v_unknown);
end $$;

create or replace function public.daily_session_summary(p_session uuid)
returns jsonb language sql security definer set search_path='' stable as $$
  select jsonb_build_object(
    'investmentCents',coalesce(sum(o.investment_cents),0),
    'revenueCents',coalesce(sum(o.revenue_cents),0),
    'cashCents',coalesce(sum(o.cash_cents),0),'yappyCents',coalesce(sum(o.yappy_cents),0),
    'costOfSalesCents',round(coalesce(sum(o.cost_cents) filter(where o.kind in ('SALE','WEB_SALE')),0)),
    'consumptionCostCents',round(coalesce(sum(o.cost_cents) filter(where o.kind='CONSUMPTION'),0)),
    'correctionCostCents',round(coalesce(sum(o.cost_cents) filter(where o.kind='CORRECTION'),0)),
    'unknownCostUnits',coalesce(sum(o.unknown_cost_units),0),
    'profitCents',case when coalesce(sum(o.unknown_cost_units) filter(where o.kind in ('SALE','WEB_SALE')),0)=0
      then coalesce(sum(o.revenue_cents),0)-round(coalesce(sum(o.cost_cents) filter(where o.kind in ('SALE','WEB_SALE')),0)) else null end,
    'netCashCents',coalesce(sum(o.revenue_cents),0)-coalesce(sum(o.investment_cents),0),
    'purchasedUnits',coalesce((select sum(i.quantity) from public.daily_operation_items i join public.daily_operations d on d.id=i.operation_id where d.session_id=p_session and d.kind='PURCHASE'),0),
    'soldUnits',coalesce((select sum(i.quantity) from public.daily_operation_items i join public.daily_operations d on d.id=i.operation_id where d.session_id=p_session and d.kind in ('SALE','WEB_SALE')),0),
    'consumedUnits',coalesce((select sum(i.quantity) from public.daily_operation_items i join public.daily_operations d on d.id=i.operation_id where d.session_id=p_session and d.kind='CONSUMPTION'),0),
    'lastSequence',coalesce(max(o.server_sequence),0)
  ) from public.daily_operations o where o.session_id=p_session;
$$;

create or replace function public.api_daily_snapshot(p_auth_user_id uuid,p_before_sequence bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.daily_sessions%rowtype; v_inventory jsonb; v_ops jsonb; v_sessions jsonb;
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role in ('ADMIN','SELLER')) then
    raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(26092601);
  select * into strict v_session from public.daily_sessions where closed_at is null;
  v_inventory:=public.api_inventory_snapshot();
  select coalesce(jsonb_agg(to_jsonb(q) order by q.server_sequence desc),'[]') into v_ops from (
    select o.id,o.server_sequence,o.session_id,o.kind,o.occurred_at,o.created_at,o.investment_cents,o.revenue_cents,
      o.cash_cents,o.yappy_cents,round(o.cost_cents) as cost_cents,o.unknown_cost_units,o.order_id,o.payload,
      (select coalesce(jsonb_agg(to_jsonb(i) order by i.sku_snapshot),'[]') from public.daily_operation_items i where i.operation_id=o.id) as items
    from public.daily_operations o where p_before_sequence is null or o.server_sequence<p_before_sequence
    order by o.server_sequence desc limit 50
  ) q;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.opened_at desc),'[]') into v_sessions from (
    select id,business_date,opened_at,closed_at,closing_summary from public.daily_sessions order by opened_at desc limit 30
  ) q;
  return jsonb_build_object('schemaVersion',2,'session',to_jsonb(v_session),'summary',public.daily_session_summary(v_session.id),
    'inventory',v_inventory,'operations',v_ops,'sessions',v_sessions,'serverTime',clock_timestamp(),
    'flavors',(select coalesce(jsonb_agg(jsonb_build_object('id',pv.id,'sku',pv.sku,'name',pv.name,'active',pv.active,
      'available',pv.available and exists(select 1 from public.products p where p.id=pv.product_id and p.active),'unitPriceCents',pv.unit_price_cents,'updatedAt',pv.updated_at) order by pv.display_order,pv.sku),'[]')
      from public.product_variants pv where exists(select 1 from public.inventory_by_flavor i where i.variant_id=pv.id)));
end $$;

create or replace function public.api_daily_apply(p_auth_user_id uuid,p_operation_id uuid,p_request_hash text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_existing public.daily_operations%rowtype; v_session public.daily_sessions%rowtype;
  v_kind text:=p_payload->>'kind'; v_item jsonb; v_variant public.product_variants%rowtype; v_stock record;
  v_qty bigint; v_boxes integer; v_total bigint:=0; v_units bigint:=0; v_cash bigint; v_yappy bigint;
  v_cost jsonb; v_cost_total numeric:=0; v_unknown bigint:=0; v_sequence bigint; v_revision bigint;
  v_summary jsonb; v_next uuid; v_time timestamptz; v_seen uuid[]:='{}';
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role in ('ADMIN','SELLER')) then
    raise exception 'STAFF_REQUIRED' using errcode='42501'; end if;
  if p_operation_id is null or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' or p_payload is null or
    v_kind is null or v_kind not in ('PURCHASE','SALE','CONSUMPTION','CORRECTION','CLOSE') then raise exception 'INVALID_DAILY_OPERATION'; end if;
  perform pg_advisory_xact_lock(26092601);
  select * into v_existing from public.daily_operations where id=p_operation_id;
  if found then
    if v_existing.request_hash<>p_request_hash or v_existing.actor_user_id is distinct from p_auth_user_id then
      raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('operationId',v_existing.id,'serverSequence',v_existing.server_sequence,'replayed',true);
  end if;
  select * into v_session from public.daily_sessions where id=(p_payload->>'sessionId')::uuid and closed_at is null;
  if not found then raise exception 'SESSION_CLOSED'; end if;
  v_time:=(p_payload->>'occurredAt')::timestamptz;
  if v_time is null or v_time>clock_timestamp()+interval '5 minutes' or v_time<v_session.opened_at-interval '5 minutes' then
    raise exception 'INVALID_OPERATION_TIME'; end if;
  if v_kind in ('CORRECTION','CLOSE') then
    if v_kind='CORRECTION' and not exists(select 1 from public.app_user_roles where auth_user_id=p_auth_user_id and role='ADMIN') then
      raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
    select revision into v_revision from public.inventory_revision where id;
    if (p_payload->>'expectedRevision') is null or (p_payload->>'expectedRevision')::bigint<>v_revision then raise exception 'INVENTORY_CONFLICT'; end if;
  end if;
  if v_kind='CLOSE' then
    v_summary:=public.daily_session_summary(v_session.id);
    if (p_payload->>'expectedSequence') is null or (p_payload->>'expectedSequence')::bigint<>(v_summary->>'lastSequence')::bigint then
      raise exception 'DAILY_SUMMARY_CONFLICT'; end if;
    v_next:=(p_payload->>'nextSessionId')::uuid;
    if v_next is null or exists(select 1 from public.daily_sessions where id=v_next) then raise exception 'INVALID_DAILY_OPERATION'; end if;
    v_summary:=v_summary||jsonb_build_object('inventory',public.api_inventory_snapshot());
    insert into public.daily_operations(id,session_id,actor_user_id,kind,request_hash,payload,occurred_at)
      values(p_operation_id,v_session.id,p_auth_user_id,v_kind,p_request_hash,p_payload,v_time) returning server_sequence into v_sequence;
    update public.daily_sessions set closed_at=clock_timestamp(),closed_by=p_auth_user_id,closing_operation_id=p_operation_id,closing_summary=v_summary where id=v_session.id;
    insert into public.daily_sessions(id) values(v_next);
    return jsonb_build_object('operationId',p_operation_id,'serverSequence',v_sequence,'replayed',false,'nextSessionId',v_next);
  end if;
  if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 25 then
    raise exception 'INVALID_DAILY_OPERATION'; end if;
  if v_kind='CORRECTION' and length(btrim(coalesce(p_payload->>'note','')))<5 then raise exception 'CORRECTION_REASON_REQUIRED'; end if;
  if v_kind='PURCHASE' then
    v_boxes:=(p_payload->>'boxes')::integer; v_total:=(p_payload->>'totalCostCents')::bigint;
    if v_boxes is null or v_boxes not between 1 and 10000 or v_total is null or v_total not between 0 and 100000000 then raise exception 'INVALID_DAILY_OPERATION'; end if;
  end if;
  -- Validate all rows and payment before any side effects. Actual writes are still atomic.
  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    select * into v_variant from public.product_variants where id=(v_item->>'variantId')::uuid;
    if not found or not exists(select 1 from public.inventory_by_flavor where variant_id=v_variant.id) or v_variant.id=any(v_seen) then
      raise exception 'INVALID_PRODUCT_VARIANT'; end if;
    if not exists(select 1 from public.inventory_manual_counts where variant_id=v_variant.id) then
      raise exception 'INVENTORY_COUNT_REQUIRED'; end if;
    v_seen:=array_append(v_seen,v_variant.id); v_qty:=(v_item->>'quantity')::bigint;
    if v_qty is null or v_qty=0 or abs(v_qty)>100000 or (v_kind<>'CORRECTION' and v_qty<0) then raise exception 'INVALID_QUANTITY'; end if;
    if v_kind='PURCHASE' then v_units:=v_units+v_qty*v_boxes;
    else v_units:=v_units+abs(v_qty); end if;
    if v_units>100000 then raise exception 'INVALID_QUANTITY'; end if;
    if v_kind='SALE' then
      if not v_variant.active or not v_variant.available or not exists(select 1 from public.products where id=v_variant.product_id and active) then raise exception 'OUT_OF_STOCK'; end if;
      if (v_item->>'unitPriceCents') is null or (v_item->>'unitPriceCents')::bigint not between 0 and 1000000 then raise exception 'INVALID_DAILY_OPERATION'; end if;
      v_total:=v_total+v_qty*(v_item->>'unitPriceCents')::bigint;
    end if;
  end loop;
  if v_kind='SALE' then
    v_cash:=(p_payload->'payment'->>'cashCents')::bigint; v_yappy:=(p_payload->'payment'->>'yappyCents')::bigint;
    if v_cash is null or v_yappy is null or v_cash<0 or v_yappy<0 or v_cash+v_yappy<>v_total then raise exception 'PAYMENT_SPLIT_MISMATCH'; end if;
    if v_total>100000000 then raise exception 'INVALID_DAILY_OPERATION'; end if;
  end if;
  insert into public.daily_operations(id,session_id,actor_user_id,kind,request_hash,payload,occurred_at,investment_cents,revenue_cents,cash_cents,yappy_cents)
    values(p_operation_id,v_session.id,p_auth_user_id,v_kind,p_request_hash,p_payload,v_time,
      case when v_kind='PURCHASE' then v_total else 0 end,case when v_kind='SALE' then v_total else 0 end,coalesce(v_cash,0),coalesce(v_yappy,0))
    returning server_sequence into v_sequence;
  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    select * into strict v_variant from public.product_variants where id=(v_item->>'variantId')::uuid;
    select i.*,i.opening_quantity+i.purchased_quantity-i.sold_quantity as physical into strict v_stock
      from public.inventory_by_flavor i where variant_id=v_variant.id;
    v_qty:=(v_item->>'quantity')::bigint;
    if v_kind='PURCHASE' then v_qty:=v_qty*v_boxes; end if;
    if v_kind in ('SALE','CONSUMPTION') or (v_kind='CORRECTION' and v_qty<0) then
      if not v_stock.counted or abs(v_qty)>v_stock.available_quantity then raise exception 'OUT_OF_STOCK'; end if;
      v_cost:=public.daily_take_cost(v_variant.id,abs(v_qty),v_stock.physical);
      v_cost_total:=v_cost_total+(v_cost->>'costCents')::numeric; v_unknown:=v_unknown+(v_cost->>'unknownCostUnits')::bigint;
    else
      perform public.daily_take_cost(v_variant.id,0,v_stock.physical);
      insert into public.daily_cost_lots(variant_id,source_operation_id,remaining_quantity,unit_cost_cents)
        values(v_variant.id,p_operation_id,v_qty,case when v_kind='PURCHASE' then v_total::numeric/v_units else null end);
      v_cost:=jsonb_build_object('costCents',0,'unknownCostUnits',0);
    end if;
    -- A missing baseline requires a real physical count; never initialize unknown stock to zero.
    insert into public.daily_operation_items(operation_id,variant_id,name_snapshot,sku_snapshot,quantity,per_box_quantity,unit_price_cents,cost_cents,unknown_cost_units)
      values(p_operation_id,v_variant.id,v_variant.name,v_variant.sku,v_qty,
        case when v_kind='PURCHASE' then (v_item->>'quantity')::integer else null end,
        case when v_kind='SALE' then (v_item->>'unitPriceCents')::bigint else null end,(v_cost->>'costCents')::numeric,(v_cost->>'unknownCostUnits')::bigint);
    insert into public.inventory_movements(variant_id,quantity_delta,source_key)
      values(v_variant.id,case when v_kind in ('SALE','CONSUMPTION') then -v_qty else v_qty end,'daily:'||p_operation_id||':'||v_variant.id);
  end loop;
  update public.daily_operations set cost_cents=v_cost_total,unknown_cost_units=v_unknown where id=p_operation_id;
  return jsonb_build_object('operationId',p_operation_id,'serverSequence',v_sequence,'replayed',false);
end $$;

-- Web fulfillment already deducts units/credits loyalty. Only record revenue/cost here.
create or replace function public.daily_record_web_sale() returns trigger language plpgsql security definer set search_path='' as $$
declare v_session uuid; v_item record; v_stock record; v_cost jsonb; v_total numeric:=0; v_unknown bigint:=0;
begin
  if new.status<>'COMPLETED' or new.payment_status<>'CONFIRMED' or old.status='COMPLETED' then return new; end if;
  perform pg_advisory_xact_lock(26092601);
  select id into strict v_session from public.daily_sessions where closed_at is null;
  insert into public.daily_operations(id,session_id,actor_user_id,kind,request_hash,payload,occurred_at,revenue_cents,cash_cents,yappy_cents,order_id)
    values(new.id,v_session,null,'WEB_SALE',repeat('0',64),jsonb_build_object('publicCode',new.public_code),clock_timestamp(),new.total_cents,
      case when new.payment_method='CASH' then new.total_cents else 0 end,case when new.payment_method='YAPPY' then new.total_cents else 0 end,new.id)
    on conflict(order_id) do nothing;
  if not found then return new; end if;
  for v_item in select * from public.order_items where order_id=new.id loop
    select i.*,i.opening_quantity+i.purchased_quantity-i.sold_quantity+v_item.quantity as physical_before into v_stock
      from public.inventory_by_flavor i where variant_id=v_item.product_variant_id;
    v_cost:=public.daily_take_cost(v_item.product_variant_id,v_item.quantity,greatest(v_item.quantity,coalesce(v_stock.physical_before,v_item.quantity)));
    v_total:=v_total+(v_cost->>'costCents')::numeric; v_unknown:=v_unknown+(v_cost->>'unknownCostUnits')::bigint;
    insert into public.daily_operation_items(operation_id,variant_id,name_snapshot,sku_snapshot,quantity,unit_price_cents,cost_cents,unknown_cost_units)
      values(new.id,v_item.product_variant_id,v_item.variant_name_snapshot,v_item.sku_snapshot,v_item.quantity,v_item.unit_price_cents,
        (v_cost->>'costCents')::numeric,(v_cost->>'unknownCostUnits')::bigint);
  end loop;
  update public.daily_operations set cost_cents=v_total,unknown_cost_units=v_unknown where id=new.id;
  return new;
end $$;
drop trigger if exists zz_daily_web_sale on public.orders;
create trigger zz_daily_web_sale after update of status on public.orders for each row execute function public.daily_record_web_sale();
revoke execute on function public.daily_take_cost(uuid,bigint,bigint),public.daily_session_summary(uuid),public.daily_record_web_sale() from public,anon,authenticated,service_role;
revoke execute on function public.api_daily_snapshot(uuid,bigint),public.api_daily_apply(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.api_daily_snapshot(uuid,bigint),public.api_daily_apply(uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
-- END_DONAS_DAILY_V2_COMPLETE
