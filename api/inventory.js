const { withApi } = require('./_lib/http');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { serviceRequest } = require('./_lib/supabase');

module.exports = withApi(['GET'], async req => {
  await enforceRateLimit(req, 'inventory', 120, 60);
  const rows = await serviceRequest('inventory_by_flavor', { query: 'select=variant_id,sku,name,offered,opening_quantity,purchased_quantity,sold_quantity,reserved_quantity,available_quantity,counted&order=sku.asc' });
  return { flavors: rows, updatedAt: new Date().toISOString() };
});
