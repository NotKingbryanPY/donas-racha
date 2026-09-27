const { requireAdmin } = require('../_lib/auth');
const { ApiError, withApi } = require('../_lib/http');
const { enforceRateLimit } = require('../_lib/rate-limit');
const { serviceRequest, rpc } = require('../_lib/supabase');

module.exports = withApi(['GET','POST'], async (req, context) => {
  const admin = await requireAdmin(req);
  await enforceRateLimit(req, 'admin_inventory', 60, 60, admin.id);
  if (req.method === 'GET') return { flavors: await serviceRequest('inventory_by_flavor', { query: 'select=*&order=sku.asc' }) };
  const body = context.parseJsonBody(req);
  const sku = String(body.sku || '');
  const quantity = Number(body.quantity);
  if (!['DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS'].includes(sku) ||
      !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 100000) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Indica un sabor y un conteo físico válido.');
  }
  const rows = await serviceRequest('inventory_by_flavor', { query: `select=variant_id,sku&sku=eq.${encodeURIComponent(sku)}` });
  if (rows.length !== 1) throw new ApiError(404, 'NOT_FOUND', 'No se encontró el sabor.');
  await rpc('api_set_physical_inventory_count', {
    p_auth_user_id:admin.id, p_variant_id:rows[0].variant_id, p_physical_quantity:quantity
  });
  return { sku, quantity };
});
