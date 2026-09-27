const { withApi } = require('./_lib/http');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { serviceRequest } = require('./_lib/supabase');

module.exports = withApi(['GET'], async req => {
  await enforceRateLimit(req, 'products', 120, 60);
  const products = await serviceRequest('products', {
    query: new URLSearchParams({
      select: 'id,slug,name,description,image_url,display_order,product_variants(id,sku,name,unit_price_cents,currency_code,available,display_order)',
      active: 'eq.true',
      order: 'display_order.asc,name.asc',
      'product_variants.active': 'eq.true',
      'product_variants.order': 'display_order.asc,name.asc'
    }).toString()
  });
  let inventory = [];
  try { inventory = await serviceRequest('inventory_by_flavor', { query:'select=variant_id,available_quantity,counted' }); }
  catch (_) { /* The catalog still loads while the additive migration is pending. */ }
  const byId = new Map(inventory.map(row => [row.variant_id, row]));
  for (const product of products) for (const variant of product.product_variants || []) {
    const row = byId.get(variant.id);
    variant.remaining = row ? Number(row.available_quantity) : null;
    variant.stockCounted = !!row?.counted;
  }
  return { products };
});
