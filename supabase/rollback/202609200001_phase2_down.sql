begin;

drop table if exists public.payments;
drop table if exists public.order_events;
drop table if exists public.order_items;
drop table if exists public.orders;
drop table if exists public.pickup_locations;
drop table if exists public.product_variants;
drop table if exists public.products;
drop table if exists public.reward_redemptions;
drop table if exists public.rewards;
drop table if exists public.customer_badges;
drop table if exists public.badges;
drop table if exists public.streak_seasons;
drop table if exists public.customer_streaks;
drop table if exists public.loyalty_transactions;
drop table if exists public.loyalty_accounts;
drop table if exists public.loyalty_levels;
drop table if exists public.customer_aliases;
drop table if exists public.customers;

drop function if exists public.set_updated_at();

drop type if exists public.order_actor_type;
drop type if exists public.payment_status;
drop type if exists public.payment_method;
drop type if exists public.order_status;
drop type if exists public.streak_season_status;
drop type if exists public.redemption_status;
drop type if exists public.loyalty_entry_type;
drop type if exists public.customer_status;

commit;

