begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- The persistent purchase ledger is the archive. Select a new date range each
-- Monday instead of clearing counters or relying on a scheduler.
create index if not exists loyalty_transactions_weekly_purchases_idx
  on public.loyalty_transactions (occurred_at, customer_id)
  where entry_type = 'PURCHASE_EARN';

create or replace function public.api_staff_weekly_ranking(
  p_auth_user_id uuid, p_week date default null, p_limit integer default 100
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_current date := date_trunc('week', now() at time zone 'America/Panama')::date;
  v_week date := coalesce(p_week, v_current);
  v_ranking jsonb;
  v_weeks jsonb;
begin
  if not exists (select 1 from public.app_user_roles
    where auth_user_id=p_auth_user_id and role in ('ADMIN','SELLER')) then
    raise exception 'STAFF_REQUIRED' using errcode='42501';
  end if;
  if v_week > v_current or extract(isodow from v_week) <> 1 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'INVALID_RANKING_PERIOD' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.position), '[]'::jsonb) into v_ranking
  from (
    select row_number() over (order by count(*) desc, sum(t.points_delta) desc, c.id) as position,
      c.public_id as id, c.display_name as name,
      count(*)::integer as "weeklyPurchases", sum(t.points_delta)::integer as "weeklyPoints"
    from public.loyalty_transactions t join public.customers c on c.id=t.customer_id
    where t.entry_type='PURCHASE_EARN'
      and t.occurred_at >= (v_week::timestamp at time zone 'America/Panama')
      and t.occurred_at < ((v_week+7)::timestamp at time zone 'America/Panama')
    group by c.id, c.public_id, c.display_name
    order by position limit p_limit
  ) r;

  select coalesce(jsonb_agg(w.week order by w.week desc), '[]'::jsonb) into v_weeks
  from (
    select distinct date_trunc('week',occurred_at at time zone 'America/Panama')::date as week
    from public.loyalty_transactions where entry_type='PURCHASE_EARN'
      and occurred_at < ((v_current+7)::timestamp at time zone 'America/Panama')
    union select v_current
    union select v_week
  ) w;

  return jsonb_build_object('weekStart',v_week,'weekEnd',v_week+7,
    'currentWeek',v_current,'timezone','America/Panama','weeks',v_weeks,'ranking',v_ranking);
end;
$$;

revoke all on function public.api_staff_weekly_ranking(uuid,date,integer) from public,anon,authenticated;
grant execute on function public.api_staff_weekly_ranking(uuid,date,integer) to service_role;

commit;
