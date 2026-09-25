-- Supabase becomes the only operational store for registration and loyalty.
begin;

create table public.business_settings (
  id boolean primary key default true check (id),
  active boolean not null default true,
  streak_tolerance_days integer not null default 3 check (streak_tolerance_days between 0 and 30),
  donut_price_cents integer not null default 100 check (donut_price_cents between 1 and 100000),
  points_base integer not null default 10 check (points_base between 1 and 1000),
  points_streak_3 integer not null default 12 check (points_streak_3 between 1 and 1000),
  points_streak_7 integer not null default 15 check (points_streak_7 between 1 and 1000),
  points_streak_14 integer not null default 17 check (points_streak_14 between 1 and 1000),
  legacy_imported_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.business_settings (id) values (true) on conflict do nothing;
alter table public.business_settings enable row level security;
revoke all on public.business_settings from public, anon, authenticated;
grant select, update on public.business_settings to service_role;
create trigger business_settings_set_updated_at before update on public.business_settings
  for each row execute function public.set_updated_at();

create table public.customer_registration_requests (
  idempotency_key uuid primary key,
  customer_id uuid not null unique references public.customers(id) on delete restrict,
  requested_name text not null,
  requested_whatsapp text,
  created_at timestamptz not null default now()
);
alter table public.customer_registration_requests enable row level security;
revoke all on public.customer_registration_requests from public, anon, authenticated;

create function public.api_register_customer(p_public_id text, p_name text, p_whatsapp text, p_idempotency_key uuid)
returns public.customers language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers%rowtype; v_request public.customer_registration_requests%rowtype;
begin
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='22023'; end if;
  if p_public_id !~ '^C[0-9A-Z_-]{3,63}$' or
     char_length(btrim(p_name)) not between 1 and 120 or
     (p_whatsapp is not null and p_whatsapp !~ '^\+[1-9][0-9]{7,14}$') then
    raise exception 'INVALID_CUSTOMER' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  select * into v_request from public.customer_registration_requests where idempotency_key=p_idempotency_key;
  if found then
    if v_request.requested_name<>btrim(p_name) or v_request.requested_whatsapp is distinct from p_whatsapp then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    select * into v_customer from public.customers where id=v_request.customer_id;
    return v_customer;
  end if;
  if p_whatsapp is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_whatsapp,1));
    if exists(select 1 from public.customers where whatsapp_e164=p_whatsapp and status='ACTIVE') then
      raise exception 'PHONE_EXISTS' using errcode='23505';
    end if;
  end if;
  insert into public.customers(public_id,display_name,whatsapp_e164)
    values(p_public_id,btrim(p_name),p_whatsapp) returning * into v_customer;
  insert into public.loyalty_accounts(customer_id) values(v_customer.id);
  insert into public.customer_streaks(customer_id) values(v_customer.id);
  insert into public.customer_web_access(customer_id) values(v_customer.id);
  insert into public.customer_registration_requests(idempotency_key,customer_id,requested_name,requested_whatsapp)
    values(p_idempotency_key,v_customer.id,btrim(p_name),p_whatsapp);
  return v_customer;
end;
$$;

create function public.api_credit_purchase(
  p_customer_id uuid, p_idempotency_key uuid, p_source text default 'SELLER'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer public.customers%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_streak public.customer_streaks%rowtype;
  v_config public.business_settings%rowtype;
  v_existing public.loyalty_transactions%rowtype;
  v_now timestamptz := now();
  v_count integer;
  v_points integer;
  v_level text;
  v_completed boolean;
  v_milestones integer[];
  v_badges text[];
begin
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into v_existing from public.loyalty_transactions where idempotency_key=p_idempotency_key;
  if found then
    if v_existing.customer_id <> p_customer_id or v_existing.entry_type <> 'PURCHASE_EARN' then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    return jsonb_build_object('credited',true,'replayed',true,'pointsEarned',v_existing.points_delta);
  end if;
  select * into v_config from public.business_settings where id=true;
  if not v_config.active and p_source <> 'ORDER' then
    raise exception 'SYSTEM_INACTIVE' using errcode='P0001';
  end if;
  select * into v_customer from public.customers where id=p_customer_id and status='ACTIVE' for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_account from public.loyalty_accounts where customer_id=p_customer_id for update;
  select * into v_streak from public.customer_streaks where customer_id=p_customer_id for update;
  if v_account.customer_id is null or v_streak.customer_id is null then
    raise exception 'LOYALTY_ACCOUNT_MISSING' using errcode='P0002';
  end if;
  -- The legacy rule earns loyalty once per Panama calendar day, at settlement.
  if v_customer.last_purchase_at is not null and
     (v_customer.last_purchase_at at time zone 'America/Panama')::date =
       (v_now at time zone 'America/Panama')::date then
    return jsonb_build_object('credited',false,'replayed',false,'pointsEarned',0,'alreadyToday',true);
  end if;
  if v_customer.last_purchase_at is not null and
     (v_now at time zone 'America/Panama')::date -
       (v_customer.last_purchase_at at time zone 'America/Panama')::date <= v_config.streak_tolerance_days+1 then
    v_count := v_streak.current_count+1;
  else
    v_count := 1;
  end if;
  v_points := case when v_count >= 14 then v_config.points_streak_14
                   when v_count >= 7 then v_config.points_streak_7
                   when v_count >= 3 then v_config.points_streak_3
                   else v_config.points_base end;
  v_completed := v_count >= 30;
  select array_agg(n order by n) into v_milestones
    from unnest(array[3,7,14,21,30]) n where n <= v_count;
  select key into v_level from public.loyalty_levels
    where minimum_lifetime_points <= v_account.lifetime_points+v_points
    order by minimum_lifetime_points desc limit 1;
  update public.loyalty_accounts set
    available_points=available_points+v_points,
    lifetime_points=lifetime_points+v_points,
    purchase_points=purchase_points+v_points,
    purchase_count=purchase_count+1,
    level_key=v_level,
    version=version+1
    where customer_id=p_customer_id;
  update public.customer_streaks set
    current_count=case when v_completed then 0 else v_count end,
    best_count=greatest(best_count,v_count),
    current_season_number=current_season_number+case when v_completed then 1 else 0 end,
    last_qualified_at=v_now
    where customer_id=p_customer_id;
  update public.customers set last_purchase_at=v_now where id=p_customer_id;
  if v_completed then
    update public.streak_seasons set status='COMPLETED',ended_at=v_now,
      completed_streak=v_count,milestones=coalesce(v_milestones,'{}'::integer[]),
      preserved_points=v_account.lifetime_points+v_points,preserved_level_key=v_level
      where customer_id=p_customer_id and status='ACTIVE';
    if not found then
      insert into public.streak_seasons(customer_id,season_number,started_at,ended_at,
        completed_streak,milestones,preserved_points,preserved_level_key,status)
      values(p_customer_id,v_streak.current_season_number,
        coalesce(v_streak.last_qualified_at,v_customer.registered_at),v_now,
        v_count,coalesce(v_milestones,'{}'::integer[]),v_account.lifetime_points+v_points,v_level,'COMPLETED')
      on conflict(customer_id,season_number) do update set status='COMPLETED',ended_at=excluded.ended_at,
        completed_streak=excluded.completed_streak,milestones=excluded.milestones,
        preserved_points=excluded.preserved_points,preserved_level_key=excluded.preserved_level_key;
    end if;
  else
    insert into public.streak_seasons(customer_id,season_number,started_at,completed_streak,milestones,status)
      values(p_customer_id,v_streak.current_season_number,v_now,v_count,coalesce(v_milestones,'{}'::integer[]),'ACTIVE')
      on conflict (customer_id,season_number) do update set
        completed_streak=excluded.completed_streak,milestones=excluded.milestones;
  end if;
  insert into public.loyalty_transactions(customer_id,entry_type,points_delta,balance_after,
    idempotency_key,source_system,source_id,description,metadata,occurred_at)
  values(p_customer_id,'PURCHASE_EARN',v_points,v_account.available_points+v_points,
    p_idempotency_key,'SUPABASE',p_source||':'||p_idempotency_key::text,
    'Compra liquidada',jsonb_build_object('streak',v_count,'source',p_source),v_now);
  insert into public.customer_badges(customer_id,badge_id,source_system)
    select p_customer_id,b.id,'SUPABASE' from public.badges b
    where b.active and ((b.condition_type='PURCHASE_COUNT' and b.condition_threshold <= v_account.purchase_count+1)
      or (b.condition_type='STREAK_COUNT' and b.condition_threshold <= v_count))
    on conflict(customer_id,badge_id) do nothing;
  select array_agg(b.key order by b.display_order) into v_badges from public.customer_badges cb
    join public.badges b on b.id=cb.badge_id where cb.customer_id=p_customer_id and cb.awarded_at >= v_now;
  return jsonb_build_object('credited',true,'replayed',false,'pointsEarned',v_points,
    'newStreak',case when v_completed then 0 else v_count end,'completedSeason',v_completed,
    'badgesAssigned',coalesce(to_jsonb(v_badges),'[]'::jsonb));
end;
$$;

create function public.api_redeem_customer_reward(
  p_customer_id uuid,p_reward_key text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_account public.loyalty_accounts%rowtype; v_reward public.rewards%rowtype;
  v_existing public.reward_redemptions%rowtype; v_tx uuid; v_redemption public.reward_redemptions%rowtype;
begin
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  select * into v_existing from public.reward_redemptions where idempotency_key=p_idempotency_key;
  if found then
    if v_existing.customer_id<>p_customer_id or
       v_existing.reward_id<>(select id from public.rewards where key=p_reward_key) then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='P0001';
    end if;
    return jsonb_build_object('id',v_existing.id,'replayed',true,'pointsAvailable',
      (select available_points from public.loyalty_accounts where customer_id=p_customer_id));
  end if;
  select * into v_reward from public.rewards where key=p_reward_key and active=true;
  if not found then raise exception 'REWARD_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_account from public.loyalty_accounts where customer_id=p_customer_id for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode='P0002'; end if;
  if v_account.available_points < v_reward.points_cost then
    raise exception 'INSUFFICIENT_POINTS' using errcode='P0001';
  end if;
  update public.loyalty_accounts set available_points=available_points-v_reward.points_cost,
    redemption_count=redemption_count+1,version=version+1 where customer_id=p_customer_id;
  insert into public.loyalty_transactions(customer_id,entry_type,points_delta,balance_after,
    idempotency_key,source_system,source_id,description)
  values(p_customer_id,'REDEMPTION_SPEND',-v_reward.points_cost,
    v_account.available_points-v_reward.points_cost,p_idempotency_key,'SUPABASE',
    'REDEEM:'||p_idempotency_key::text,'Canje: '||v_reward.name) returning id into v_tx;
  insert into public.reward_redemptions(customer_id,reward_id,loyalty_transaction_id,
    points_cost_snapshot,reward_name_snapshot,idempotency_key)
  values(p_customer_id,v_reward.id,v_tx,v_reward.points_cost,v_reward.name,p_idempotency_key)
  returning * into v_redemption;
  return jsonb_build_object('id',v_redemption.id,'replayed',false,
    'pointsAvailable',v_account.available_points-v_reward.points_cost,'pointsSpent',v_reward.points_cost);
end;
$$;

create function public.api_business_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'today',(select count(*) from public.loyalty_transactions t where t.entry_type='PURCHASE_EARN'
      and (t.occurred_at at time zone 'America/Panama')::date=(now() at time zone 'America/Panama')::date),
    'week',(select count(*) from public.loyalty_transactions t where t.entry_type='PURCHASE_EARN'
      and t.occurred_at>=now()-interval '7 days'),
    'month',(select count(*) from public.loyalty_transactions t where t.entry_type='PURCHASE_EARN'
      and date_trunc('month',t.occurred_at at time zone 'America/Panama')=
        date_trunc('month',now() at time zone 'America/Panama')),
    'totalClients',(select count(*) from public.customers where status='ACTIVE'),
    'pointsDelivered',(select coalesce(sum(purchase_points),0) from public.loyalty_accounts),
    'rewardsDelivered',(select coalesce(sum(redemption_count),0) from public.loyalty_accounts),
    'migrationComplete',(select legacy_imported_at is not null from public.business_settings where id=true)
  );
$$;

create function public.credit_completed_order_loyalty() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status='COMPLETED' and old.status is distinct from 'COMPLETED' and
     new.payment_status='CONFIRMED' and new.customer_id is not null then
    perform public.api_credit_purchase(new.customer_id,new.id,'ORDER');
  end if;
  return new;
end;
$$;
create trigger orders_credit_loyalty_after_completion after update of status on public.orders
  for each row execute function public.credit_completed_order_loyalty();

revoke execute on function public.api_register_customer(text,text,text,uuid) from public,anon,authenticated;
revoke execute on function public.api_credit_purchase(uuid,uuid,text) from public,anon,authenticated;
revoke execute on function public.api_redeem_customer_reward(uuid,text,uuid) from public,anon,authenticated;
revoke execute on function public.api_business_stats() from public,anon,authenticated;
revoke execute on function public.credit_completed_order_loyalty() from public,anon,authenticated;
grant execute on function public.api_register_customer(text,text,text,uuid) to service_role;
grant execute on function public.api_credit_purchase(uuid,uuid,text) to service_role;
grant execute on function public.api_redeem_customer_reward(uuid,text,uuid) to service_role;
grant execute on function public.api_business_stats() to service_role;

commit;
