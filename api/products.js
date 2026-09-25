const { withApi } = require('./_lib/http');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { serviceRequest } = require('./_lib/supabase');

module.exports = withApi(['GET'], async req => {
  await enforceRateLimit(req, 'products', 120, 60);
  const [products, stock, modes] = await Promise.all([serviceRequest('products', {
    query: new URLSearchParams({
      select: 'id,slug,name,description,image_url,display_order,product_variants(id,sku,name,unit_price_cents,currency_code,available,display_order)',
      active: 'eq.true',
      order: 'display_order.asc,name.asc',
      'product_variants.active': 'eq.true',
      'product_variants.order': 'display_order.asc,name.asc'
    }).toString()
  }), serviceRequest('variant_stock', { query:'select=variant_id,on_hand,reserved,initialized' }),
    serviceRequest('sale_mode', { query:'select=orders_enabled,location,eta_minutes&id=eq.true' })]);
  const byVariant = new Map(stock.map(row => [row.variant_id, row]));
  const mode = modes[0] || { orders_enabled:false, location:'', eta_minutes:null };
  for (const product of products) for (const variant of product.product_variants || []) {
    const row = byVariant.get(variant.id);
    variant.remaining = row?.initialized ? Math.max(0, row.on_hand - row.reserved) : 0;
    variant.stock_initialized = !!row?.initialized;
    variant.available = !!(mode.orders_enabled && variant.available && variant.remaining > 0);
  }
  return { products, saleMode:{ ordersEnabled:mode.orders_enabled, location:mode.location, etaMinutes:mode.eta_minutes } };
});
