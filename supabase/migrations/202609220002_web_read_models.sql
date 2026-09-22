begin;

alter table public.loyalty_accounts
  add column if not exists purchase_count integer not null default 0,
  add column if not exists redemption_count integer not null default 0;

alter table public.loyalty_accounts
  add constraint loyalty_accounts_purchase_count_nonnegative check (purchase_count >= 0),
  add constraint loyalty_accounts_redemption_count_nonnegative check (redemption_count >= 0);

create index if not exists loyalty_accounts_purchase_ranking_idx
  on public.loyalty_accounts (purchase_count desc, lifetime_points desc, customer_id);
create index if not exists loyalty_accounts_points_ranking_idx
  on public.loyalty_accounts (lifetime_points desc, purchase_count desc, customer_id);
create index if not exists loyalty_accounts_redemption_ranking_idx
  on public.loyalty_accounts (redemption_count desc, lifetime_points desc, customer_id);
create index if not exists customer_streaks_ranking_idx
  on public.customer_streaks (current_count desc, best_count desc, customer_id);

create or replace function public.api_public_ranking(
  p_type text default 'racha',
  p_limit integer default 10
)
returns table (
  public_id text,
  display_name text,
  level_key text,
  level_name text,
  level_emoji text,
  lifetime_points integer,
  available_points integer,
  purchase_count integer,
  redemption_count integer,
  current_streak integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_type not in ('compras', 'puntos', 'racha', 'nivel', 'canjes') then
    raise exception 'INVALID_RANKING_TYPE' using errcode = '22023';
  end if;
  if p_limit not between 1 and 100 then
    raise exception 'INVALID_RANKING_LIMIT' using errcode = '22023';
  end if;

  return query
  select
    c.public_id,
    c.display_name,
    a.level_key,
    l.name,
    l.emoji,
    a.lifetime_points,
    a.available_points,
    a.purchase_count,
    a.redemption_count,
    coalesce(s.current_count, 0)
  from public.customers c
  join public.loyalty_accounts a on a.customer_id = c.id
  join public.loyalty_levels l on l.key = a.level_key
  left join public.customer_streaks s on s.customer_id = c.id
  where c.status = 'ACTIVE'
  order by
    case when p_type = 'compras' then a.purchase_count end desc nulls last,
    case when p_type = 'puntos' then a.lifetime_points end desc nulls last,
    case when p_type = 'racha' then coalesce(s.current_count, 0) end desc nulls last,
    case when p_type = 'nivel' then l.minimum_lifetime_points end desc nulls last,
    case when p_type = 'canjes' then a.redemption_count end desc nulls last,
    a.lifetime_points desc,
    c.display_name asc,
    c.id asc
  limit p_limit;
end;
$$;

revoke execute on function public.api_public_ranking(text, integer) from public, anon, authenticated;
grant execute on function public.api_public_ranking(text, integer) to service_role;

commit;
