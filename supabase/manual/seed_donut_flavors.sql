-- Catálogo inicial de Donas Racha.
-- Ejecutar después de 202609220001_delivery_orders.sql.
-- Sustituye cada NULL por el precio de venta de UNA dona en centavos.
-- Ejemplo: B/.1.50 se escribe 150. El script se detiene si falta un precio.

do $$
declare
  v_chocolate_cents integer := null;
  v_vanilla_cents integer := null;
  v_vanilla_sprinkles_cents integer := null;
  v_chocolate_sprinkles_cents integer := null;
  v_product_id uuid;
begin
  if v_chocolate_cents is null or v_chocolate_cents <= 0
     or v_vanilla_cents is null or v_vanilla_cents <= 0
     or v_vanilla_sprinkles_cents is null or v_vanilla_sprinkles_cents <= 0
     or v_chocolate_sprinkles_cents is null or v_chocolate_sprinkles_cents <= 0 then
    raise exception 'PRICE_REQUIRED: reemplaza los cuatro NULL por precios positivos en centavos';
  end if;

  insert into public.products (slug, name, description, active, display_order)
  values (
    'donas-glaseadas',
    'Donas glaseadas',
    'Donas surtidas ya preparadas, disponibles para entrega.',
    true,
    1
  )
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    active = excluded.active,
    display_order = excluded.display_order
  returning id into v_product_id;

  insert into public.product_variants
    (product_id, sku, name, unit_price_cents, currency_code, active, available, display_order)
  values
    (v_product_id, 'DR-CHOCOLATE', 'Glaseado de chocolate', v_chocolate_cents, 'USD', true, true, 1),
    (v_product_id, 'DR-VAINILLA', 'Glaseado de vainilla', v_vanilla_cents, 'USD', true, true, 2),
    (v_product_id, 'DR-VAINILLA-CHISPAS', 'Glaseado de vainilla con chispas', v_vanilla_sprinkles_cents, 'USD', true, true, 3),
    (v_product_id, 'DR-CHOCOLATE-CHISPAS', 'Glaseado de chocolate con chispas', v_chocolate_sprinkles_cents, 'USD', true, true, 4)
  on conflict (sku) do update set
    product_id = excluded.product_id,
    name = excluded.name,
    unit_price_cents = excluded.unit_price_cents,
    currency_code = excluded.currency_code,
    active = excluded.active,
    available = excluded.available,
    display_order = excluded.display_order;
end;
$$;

select
  p.name as product,
  pv.sku,
  pv.name as flavor,
  pv.unit_price_cents,
  pv.currency_code,
  pv.available
from public.product_variants pv
join public.products p on p.id = pv.product_id
where p.slug = 'donas-glaseadas'
order by pv.display_order;
