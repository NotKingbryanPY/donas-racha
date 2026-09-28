begin;

-- Three credited purchases per Panama calendar day, while the streak advances
-- only once. Locking the customer serializes simultaneous seller/order credits.
create or replace function public.api_credit_purchase(
  p_customer_id uuid, p_idempotency_key uuid, p_source text default 'SELLER'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer public.customers%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_streak public.customer_streaks%rowtype;
  v_config public.business_settings%rowtype;
  v_existing public.loyalty_transactions%rowtype;
  v_now timestamptz := now();
  v_day date := (v_now at time zone 'America/Panama')::date;
  v_today_count integer;
  v_today_streak integer;
  v_count integer;
  v_points integer;
  v_level text;
  v_qualifies boolean := false;
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

  select count(*)::integer,
    max(case when metadata->>'streak' ~ '^[0-9]+$' then (metadata->>'streak')::integer end)
    into v_today_count,v_today_streak
    from public.loyalty_transactions
    where customer_id=p_customer_id and entry_type='PURCHASE_EARN'
      and occurred_at >= (v_day::timestamp at time zone 'America/Panama')
      and occurred_at < ((v_day+1)::timestamp at time zone 'America/Panama');
  if v_today_count >= 3 then
    return jsonb_build_object('credited',false,'replayed',false,'pointsEarned',0,
      'limitReached',true,'purchasesToday',v_today_count,'dailyPurchaseLimit',3);
  end if;

  if v_today_count > 0 then
    -- Preserve the day's qualified streak, even after a 30-day season resets it.
    v_count := coalesce(v_today_streak,v_streak.current_count);
  elsif v_streak.last_qualified_at is not null and
        (v_streak.last_qualified_at at time zone 'America/Panama')::date = v_day then
    -- An administrative streak correction may have qualified today already.
    v_count := v_streak.current_count;
  else
    v_qualifies := true;
    if v_streak.last_qualified_at is not null and
       v_day-(v_streak.last_qualified_at at time zone 'America/Panama')::date <= v_config.streak_tolerance_days+1 then
      v_count := v_streak.current_count+1;
    else
      v_count := 1;
    end if;
  end if;
  v_points := case when v_count >= 14 then v_config.points_streak_14
                   when v_count >= 7 then v_config.points_streak_7
                   when v_count >= 3 then v_config.points_streak_3
                   else v_config.points_base end;
  v_completed := v_qualifies and v_count >= 30;
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
  if v_qualifies then
    update public.customer_streaks set
      current_count=case when v_completed then 0 else v_count end,
      best_count=greatest(best_count,v_count),
      current_season_number=current_season_number+case when v_completed then 1 else 0 end,
      last_qualified_at=v_now
      where customer_id=p_customer_id;
  end if;
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
  elsif v_qualifies then
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
    'purchasesToday',v_today_count+1,'dailyPurchaseLimit',3,
    'newStreak',case when v_completed then 0 when v_qualifies then v_count else v_streak.current_count end,
    'completedSeason',v_completed,'badgesAssigned',coalesce(to_jsonb(v_badges),'[]'::jsonb));
end;
$$;

revoke execute on function public.api_credit_purchase(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.api_credit_purchase(uuid,uuid,text) to service_role;

commit;
