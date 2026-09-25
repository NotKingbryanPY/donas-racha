const { requireAdmin } = require('./_lib/auth');
const { withApi, ApiError } = require('./_lib/http');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { rpc, serviceRequest } = require('./_lib/supabase');

module.exports = withApi(['GET','PATCH'], async (req, context) => {
  if (req.method === 'GET') {
    await enforceRateLimit(req, 'sale_mode', 120, 60);
    const rows = await serviceRequest('sale_mode', { query:'select=orders_enabled,location,eta_minutes,updated_at&id=eq.true' });
    return { saleMode:rows[0] };
  }
  const admin = await requireAdmin(req);
  await enforceRateLimit(req, 'admin_sale_mode', 30, 60, admin.id);
  const body = context.parseJsonBody(req);
  if (typeof body.ordersEnabled !== 'boolean' || typeof body.location !== 'string' ||
      (body.etaMinutes != null && (!Number.isInteger(body.etaMinutes) || body.etaMinutes < 1 || body.etaMinutes > 240))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Modo de venta inválido.');
  }
  return { saleMode:await rpc('api_set_sale_mode', {
    p_orders_enabled:body.ordersEnabled,
    p_location:body.location,
    p_eta_minutes:body.etaMinutes ?? null
  }) };
});
