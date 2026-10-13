const { requireAdmin, requireStaff } = require('../auth');
const { ApiError, withApi } = require('../http');
const { enforceRateLimit } = require('../rate-limit');
const { serviceRequest, rpc } = require('../supabase');

module.exports = withApi(['GET','POST'], async (req, context) => {
  const admin = await (req.method === 'GET' ? requireStaff(req) : requireAdmin(req));
  await enforceRateLimit(req, 'admin_inventory', 60, 60, admin.id);
  if (req.method === 'GET') {
    const snapshot = await rpc('api_inventory_snapshot', {});
    // counted also depends on reservations/gaps; it is not proof that no count exists.
    const counts = await serviceRequest('inventory_manual_counts', {query:'select=variant_id'});
    const recorded = new Set(counts.map(row=>row.variant_id));
    return {...snapshot,flavors:snapshot.flavors.map(row=>({...row,has_count:row.counted || recorded.has(row.variant_id)}))};
  }
  const body = context.parseJsonBody(req);
  const skus = ['DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS'];
  const counts = body.counts;
  if (!counts || Array.isArray(counts) || typeof counts !== 'object' || Object.keys(counts).length !== 4 ||
      skus.some(sku => !Object.hasOwn(counts, sku) || !Number.isSafeInteger(counts[sku]) || counts[sku] < 0 || counts[sku] > 100000)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Escribe las cantidades actuales de los cuatro sabores. Usa 0 si no quedan.');
  }
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Vuelve a consultar el inventario antes de guardar el conteo. Falta una revisión válida.');
  }
  return rpc('api_set_shared_inventory', { p_auth_user_id: admin.id, p_counts: counts, p_expected_revision: body.expectedRevision });
});
