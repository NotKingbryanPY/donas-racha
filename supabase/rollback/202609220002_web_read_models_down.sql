begin;

drop function if exists public.api_public_ranking(text, integer);
drop index if exists public.customer_streaks_ranking_idx;
drop index if exists public.loyalty_accounts_redemption_ranking_idx;
drop index if exists public.loyalty_accounts_points_ranking_idx;
drop index if exists public.loyalty_accounts_purchase_ranking_idx;
alter table public.loyalty_accounts
  drop constraint if exists loyalty_accounts_redemption_count_nonnegative,
  drop constraint if exists loyalty_accounts_purchase_count_nonnegative,
  drop column if exists redemption_count,
  drop column if exists purchase_count;

commit;
