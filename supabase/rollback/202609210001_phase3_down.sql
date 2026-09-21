begin;

drop policy if exists admin_manage_claim_tokens on public.customer_claim_tokens;
drop policy if exists admin_manage_user_roles on public.app_user_roles;
drop policy if exists user_read_own_roles on public.app_user_roles;

drop policy if exists customer_read_own_payments on public.payments;
drop policy if exists customer_read_own_order_events on public.order_events;
drop policy if exists customer_read_own_order_items on public.order_items;
drop policy if exists customer_read_own_orders on public.orders;
drop policy if exists customer_read_own_redemptions on public.reward_redemptions;
drop policy if exists customer_read_own_badges on public.customer_badges;
drop policy if exists customer_read_own_streak_seasons on public.streak_seasons;
drop policy if exists customer_read_own_streak on public.customer_streaks;
drop policy if exists customer_read_own_loyalty_transactions on public.loyalty_transactions;
drop policy if exists customer_read_own_loyalty_account on public.loyalty_accounts;
drop policy if exists customer_read_own_profile on public.customers;

drop policy if exists public_read_active_pickup_locations on public.pickup_locations;
drop policy if exists public_read_active_variants on public.product_variants;
drop policy if exists public_read_active_products on public.products;
drop policy if exists public_read_active_rewards on public.rewards;
drop policy if exists public_read_active_badges on public.badges;
drop policy if exists public_read_active_levels on public.loyalty_levels;

drop policy if exists admin_manage_payments on public.payments;
drop policy if exists admin_manage_order_events on public.order_events;
drop policy if exists admin_manage_order_items on public.order_items;
drop policy if exists admin_manage_orders on public.orders;
drop policy if exists admin_manage_pickup_locations on public.pickup_locations;
drop policy if exists admin_manage_product_variants on public.product_variants;
drop policy if exists admin_manage_products on public.products;
drop policy if exists admin_manage_reward_redemptions on public.reward_redemptions;
drop policy if exists admin_manage_rewards on public.rewards;
drop policy if exists admin_manage_customer_badges on public.customer_badges;
drop policy if exists admin_manage_badges on public.badges;
drop policy if exists admin_manage_streak_seasons on public.streak_seasons;
drop policy if exists admin_manage_customer_streaks on public.customer_streaks;
drop policy if exists admin_manage_loyalty_transactions on public.loyalty_transactions;
drop policy if exists admin_manage_loyalty_accounts on public.loyalty_accounts;
drop policy if exists admin_manage_loyalty_levels on public.loyalty_levels;
drop policy if exists admin_manage_customer_aliases on public.customer_aliases;
drop policy if exists admin_manage_customers on public.customers;

revoke select, insert, update, delete on all tables in schema public from authenticated;
revoke select on public.loyalty_levels, public.badges, public.rewards,
  public.products, public.product_variants, public.pickup_locations from anon;
revoke usage, select on sequence public.order_events_id_seq from authenticated;

drop function if exists public.claim_customer_account(text);
drop function if exists public.issue_customer_claim_token(uuid, interval);
drop function if exists public.current_customer_id();
drop function if exists public.current_user_is_admin();

drop table if exists public.customer_claim_tokens;
drop table if exists public.app_user_roles;

alter table public.payments drop constraint if exists payments_confirmed_by_fk;
alter table public.order_events drop constraint if exists order_events_actor_user_fk;
alter table public.customers drop constraint if exists customers_auth_user_fk;

drop type if exists public.app_role;

commit;

