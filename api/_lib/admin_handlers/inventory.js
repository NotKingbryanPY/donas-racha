const { requireAdmin } = require('../auth');
const { ApiError, withApi } = require('../http');
const { enforceRateLimit } = require('../rate-limit');
const { serviceRequest, rpc } = require('../supabase');

module.exports = withApi(['GET','POST'], async (req, context) => {
  const admin = await requireAdmin(req);
  await enforceRateLimit(req, 'admin_inventory', 60, 60, admin.id);
  if (req.method === 'GET') return { flavors: await serviceRequest('inventory_by_flavor', { query: 'select=*&order=sku.asc' }) };
  const body = context.parseJsonBody(req);
  const skus = ['DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS'];
  const counts = body.counts;
  if (!counts || Array.isArray(counts) || typeof counts !== 'object' || Object.keys(counts).length !== 4 ||
      skus.some(sku => !Object.hasOwn(counts, sku) || !Number.isSafeInteger(counts[sku]) || counts[sku] < 0 || counts[sku] > 100000)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Escribe las cantidades actuales de los cuatro sabores. Usa 0 si no quedan.');
  }
  return rpc('api_set_manual_inventory', { p_auth_user_id: admin.id, p_counts: counts });
});
