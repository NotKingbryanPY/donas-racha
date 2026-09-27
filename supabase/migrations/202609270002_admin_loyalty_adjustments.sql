begin;

-- One auditable operation changes related loyalty rows in one transaction.
create table public.loyalty_admin_adjustments (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  admin_user_id uuid not null,
  kind text not null check (kind in ('HISTORICAL_PURCHASES','POINTS','STREAK')),
  amount integer not null,
  qualified_on date,
  reason text not null check (char_length(btrim(reason)) between 5 and 300),
  before_state jsonb not null,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);
create index loyalty_admin_adjustments_customer_created_idx
  on public.loyalty_admin_adjustments(customer_id,created_at desc);
alter table public.loyalty_admin_adjustments enable row level security;
revoke all on public.loyalty_admin_adjustments from public,anon,authenticated;
grant select,insert on public.loyalty_admin_adjustments to service_role;

create function public.api_admin_adjust_loyalty(
  p_admin_user_id uuid, p_customer_id uuid, p_kind text, p_amount integer,
  p_qualified_on date, p_reason text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.loyalty_admin_adjustments%rowtype;
  v_customer public.customers%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_streak public.customer_streaks%rowtype;
  v_config public.business_settings%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_delta integer := 0;
  v_available integer;
  v_lifetime integer;
  v_purchase_points integer;
  v_purchase_count integer;
  v_level text;
  v_qualified_at timestamptz;
begin
  if not exists(select 1 from public.app_user_roles where auth_user_id=p_admin_user_id and role='ADMIN') then
    raise exception 'ADMIN_REQUIRED' using errcode='P0001';
  end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='22023'; end if;
  if p_kind is null or p_kind not in ('HISTORICAL_PURCHASES','POINTS','STREAK') or p_amount is null or
      p_reason is null or char_length(btrim(p_reason)) not between 5 and 300 then
    raise exception 'INVALID_ADJUSTMENT' using errcode='22023';
  end if;
  if (p_kind='HISTORICAL_PURCHASES' and (p_amount not between 1 and 100 or p_qualified_on is not null)) or
     (p_kind='POINTS' and (p_amount=0 or abs(p_amount)>10000 or p_qualified_on is not null)) or
     (p_kind='STREAK' and (p_amount not between 0 and 29 or (p_amount>0 and p_qualified_on is null) or
       (p_amount=0 and p_qualified_on is not null))) then
    raise exception 'INVALID_ADJUSTMENT' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  select * into v_existing from public.loyalty_admin_adjustments where idempotency_key=p_idempotency_key;
  if found then
    if v_existing.customer_id<>p_customer_id or v_existing.admin_user_id<>p_admin_user_id or
       v_existing.kind<>p_kind or v_existing.amount<>p_amount or
       v_existing.qualified_on is distinct from p_qualified_on or
       v_existing.reason<>btrim(p_reason) then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    return jsonb_build_object('replayed',true,'adjustmentId',v_existing.id,
      'before',v_existing.before_state,'after',v_existing.after_state);
  end if;
  select * into v_customer from public.customers where id=p_customer_id and status='ACTIVE' for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_account from public.loyalty_accounts where customer_id=p_customer_id for update;
  select * into v_streak from public.customer_streaks where customer_id=p_customer_id for update;
  if v_account.customer_id is null or v_streak.customer_id is null then
    raise exception 'LOYALTY_ACCOUNT_MISSING' using errcode='P0002';
  end if;
  select * into v_config from public.business_settings where id=true;
  if v_config.id is null then raise exception 'SETTINGS_MISSING' using errcode='P0002'; end if;
  v_before := jsonb_build_object('availablePoints',v_account.available_points,
    'lifetimePoints',v_account.lifetime_points,'purchasePoints',v_account.purchase_points,
    'purchaseCount',v_account.purchase_count,'streak',v_streak.current_count,
    'lastPurchaseAt',v_customer.last_purchase_at);
  v_available := v_account.available_points;
  v_lifetime := v_account.lifetime_points;
  v_purchase_points := v_account.purchase_points;
  v_purchase_count := v_account.purchase_count;

  if p_kind='HISTORICAL_PURCHASES' then
    -- Without dates, do not invent daily streaks or today's sales statistics.
    v_delta := p_amount * v_config.points_base;
    v_available := v_available+v_delta;
    v_lifetime := v_lifetime+v_delta;
    v_purchase_points := v_purchase_points+v_delta;
    v_purchase_count := v_purchase_count+p_amount;
  elsif p_kind='POINTS' then
    v_delta := p_amount;
    v_available := v_available+v_delta;
    if v_available<0 then raise exception 'INSUFFICIENT_POINTS' using errcode='P0001'; end if;
    -- Lifetime points record earned points; spending/corrections never erase purchase earnings.
    if v_delta>0 then v_lifetime := v_lifetime+v_delta; end if;
    if v_available>v_lifetime then raise exception 'INVALID_ADJUSTMENT' using errcode='P0001'; end if;
  else
    if p_amount>0 then
      if p_qualified_on>(now() at time zone 'America/Panama')::date then
        raise exception 'FUTURE_PURCHASE_DATE' using errcode='22023';
      end if;
      v_qualified_at := least(now(),(p_qualified_on::timestamp + interval '12 hours') at time zone 'America/Panama');
      if (v_customer.registered_at at time zone 'America/Panama')::date=p_qualified_on then
        v_qualified_at := greatest(v_qualified_at,v_customer.registered_at);
      end if;
      if v_qualified_at<v_customer.registered_at then
        raise exception 'PURCHASE_BEFORE_REGISTRATION' using errcode='22023';
      end if;
      if v_customer.last_purchase_at is not null and
         (v_customer.last_purchase_at at time zone 'America/Panama')::date>p_qualified_on then
        raise exception 'STREAK_DATE_BEFORE_LAST_PURCHASE' using errcode='22023';
      end if;
      update public.customers set last_purchase_at=v_qualified_at where id=p_customer_id;
      update public.customer_streaks set current_count=p_amount,
        best_count=greatest(best_count,p_amount),last_qualified_at=v_qualified_at
        where customer_id=p_customer_id;
      insert into public.streak_seasons(customer_id,season_number,started_at,completed_streak,milestones,status)
        values(p_customer_id,v_streak.current_season_number,v_qualified_at,p_amount,
          array(select n from unnest(array[3,7,14,21]) n where n<=p_amount),'ACTIVE')
        on conflict(customer_id,season_number) do update set
          completed_streak=excluded.completed_streak,milestones=excluded.milestones,
          status='ACTIVE',ended_at=null,
          started_at=least(public.streak_seasons.started_at,excluded.started_at);
      insert into public.customer_badges(customer_id,badge_id,source_system)
        select p_customer_id,b.id,'SUPABASE' from public.badges b
        where b.active and b.condition_type='STREAK_COUNT' and b.condition_threshold<=p_amount
        on conflict(customer_id,badge_id) do nothing;
    else
      update public.customer_streaks set current_count=0 where customer_id=p_customer_id;
      update public.streak_seasons set completed_streak=0,milestones='{}'::integer[]
        where customer_id=p_customer_id and season_number=v_streak.current_season_number and status='ACTIVE';
    end if;
  end if;

  if p_kind in ('HISTORICAL_PURCHASES','POINTS') then
    select key into v_level from public.loyalty_levels
      where minimum_lifetime_points<=v_lifetime order by minimum_lifetime_points desc limit 1;
    update public.loyalty_accounts set available_points=v_available,lifetime_points=v_lifetime,
      purchase_points=v_purchase_points,purchase_count=v_purchase_count,level_key=v_level,
      version=version+1 where customer_id=p_customer_id;
    insert into public.loyalty_transactions(customer_id,entry_type,points_delta,balance_after,
      idempotency_key,source_system,source_id,description,metadata)
    values(p_customer_id,'ADJUSTMENT',v_delta,v_available,p_idempotency_key,'SUPABASE',
      'ADMIN:'||p_idempotency_key::text,
      case when p_kind='HISTORICAL_PURCHASES' then
        p_amount||' compras anteriores reconocidas: '||btrim(p_reason)
      else 'Ajuste administrativo: '||btrim(p_reason) end,
      jsonb_build_object('kind',p_kind,'purchaseCount',case when p_kind='HISTORICAL_PURCHASES' then p_amount else 0 end,
        'adminUserId',p_admin_user_id));
    if p_kind='HISTORICAL_PURCHASES' then
      insert into public.customer_badges(customer_id,badge_id,source_system)
        select p_customer_id,b.id,'SUPABASE' from public.badges b
        where b.active and b.condition_type='PURCHASE_COUNT' and b.condition_threshold<=v_purchase_count
        on conflict(customer_id,badge_id) do nothing;
    end if;
  end if;
  v_after := jsonb_build_object('availablePoints',v_available,'lifetimePoints',v_lifetime,
    'purchasePoints',v_purchase_points,'purchaseCount',v_purchase_count,
    'streak',case when p_kind='STREAK' then p_amount else v_streak.current_count end,
    'lastPurchaseAt',case when p_kind='STREAK' and p_amount>0 then v_qualified_at else v_customer.last_purchase_at end);
  insert into public.loyalty_admin_adjustments(idempotency_key,customer_id,admin_user_id,
    kind,amount,qualified_on,reason,before_state,after_state)
  values(p_idempotency_key,p_customer_id,p_admin_user_id,p_kind,p_amount,p_qualified_on,
    btrim(p_reason),v_before,v_after) returning id into v_existing.id;
  return jsonb_build_object('replayed',false,'adjustmentId',v_existing.id,'before',v_before,'after',v_after);
end;
$$;
revoke execute on function public.api_admin_adjust_loyalty(uuid,uuid,text,integer,date,text,uuid)
  from public,anon,authenticated;
grant execute on function public.api_admin_adjust_loyalty(uuid,uuid,text,integer,date,text,uuid)
  to service_role;

commit;
