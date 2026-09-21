begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();
create trigger loyalty_accounts_set_updated_at before update on public.loyalty_accounts
for each row execute function public.set_updated_at();
create trigger customer_streaks_set_updated_at before update on public.customer_streaks
for each row execute function public.set_updated_at();
create trigger rewards_set_updated_at before update on public.rewards
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();
create trigger pickup_locations_set_updated_at before update on public.pickup_locations
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();
create trigger reward_redemptions_set_updated_at before update on public.reward_redemptions
for each row execute function public.set_updated_at();

insert into public.loyalty_levels (key, name, emoji, minimum_lifetime_points, display_order) values
  ('BRONCE', 'Bronce', '🥉', 0, 1),
  ('PLATA', 'Plata', '🥈', 200, 2),
  ('ORO', 'Oro', '🥇', 500, 3),
  ('DIAMANTE', 'Diamante', '💎', 1000, 4),
  ('MAESTRO', 'Maestro Donero', '👑', 2000, 5)
on conflict (key) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  minimum_lifetime_points = excluded.minimum_lifetime_points,
  display_order = excluded.display_order;

insert into public.badges
  (key, name, emoji, condition_type, condition_threshold, description, display_order) values
  ('PRIMER_MORDISCO', 'Primer Mordisco', '🥉', 'PURCHASE_COUNT', 1, 'Primera compra registrada.', 1),
  ('CLIENTE_FRECUENTE', 'Cliente Frecuente', '🥈', 'PURCHASE_COUNT', 5, '5 compras acumuladas.', 2),
  ('DONA_LOVER', 'Dona Lover', '🥇', 'PURCHASE_COUNT', 20, '20 compras acumuladas.', 3),
  ('REY_DONAS', 'Rey de las Donas', '👑', 'PURCHASE_COUNT', 50, '50 compras acumuladas.', 4),
  ('MAESTRO_RACHAS', 'Maestro de Rachas', '🔥', 'STREAK_COUNT', 30, 'Completar una temporada de racha de 30 compras.', 5),
  ('CLIENTE_VIP', 'Cliente VIP', '🎉', 'PURCHASE_COUNT', 100, '100 compras acumuladas.', 6)
on conflict (key) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  condition_type = excluded.condition_type,
  condition_threshold = excluded.condition_threshold,
  description = excluded.description,
  display_order = excluded.display_order;

insert into public.rewards
  (key, name, emoji, points_cost, reward_type, reward_value, description, display_order) values
  ('DONA_GRATIS', 'Dona gratis', '🍩', 150, 'PRODUCT', '1 dona', 'Canjeable por una dona gratis.', 1),
  ('DESC_10', '10% de descuento', '🏷️', 60, 'DISCOUNT', '10%', 'Descuento de 10% en una compra.', 2),
  ('DESC_25', '25% de descuento', '💸', 130, 'DISCOUNT', '25%', 'Descuento de 25% en una compra.', 3),
  ('DONA_PREMIUM', 'Dona especial', '✨', 220, 'PRODUCT', '1 dona premium', 'Canje por una dona especial o edición limitada.', 4),
  ('PACK_AMIGO', 'Pack amigo', '🎁', 300, 'PRODUCT', '2 donas', 'Canje por dos donas para compartir.', 5)
on conflict (key) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  points_cost = excluded.points_cost,
  reward_type = excluded.reward_type,
  reward_value = excluded.reward_value,
  description = excluded.description,
  display_order = excluded.display_order;

-- Closed by default. Phase 3 adds narrowly scoped policies after Auth is designed.
alter table public.customers enable row level security;
alter table public.customer_aliases enable row level security;
alter table public.loyalty_levels enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.customer_streaks enable row level security;
alter table public.streak_seasons enable row level security;
alter table public.badges enable row level security;
alter table public.customer_badges enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.pickup_locations enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.payments enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

commit;

