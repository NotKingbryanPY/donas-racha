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
  return { products };
});
