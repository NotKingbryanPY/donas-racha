const { requireAdmin } = require('../../_lib/auth');
const { ApiError, withApi } = require('../../_lib/http');
const { enforceRateLimit } = require('../../_lib/rate-limit');
const { serviceRequest } = require('../../_lib/supabase');

module.exports = withApi(['GET'], async req => {
  const user = await requireAdmin(req);
  await enforceRateLimit(req, 'admin_orders', 300, 60, user.id);
  const allowedStatuses = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
  const status = req.query.status ? String(req.query.status).toUpperCase() : null;
  if (status && !allowedStatuses.includes(status)) throw new ApiError(400, 'VALIDATION_ERROR', 'El estado solicitado no es válido.');
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  const params = {
    select: 'id,public_code,status,payment_method,payment_status,currency_code,total_cents,customer_name_snapshot,customer_phone_snapshot,customer_notes,created_at,updated_at,pickup_locations(code,name),order_items(product_name_snapshot,variant_name_snapshot,sku_snapshot,quantity,unit_price_cents,line_total_cents)',
    order: 'created_at.desc',
    limit: String(Number.isFinite(limit) ? Math.trunc(limit) : 50)
  };
  if (status) params.status = `eq.${status}`;
  return { orders: await serviceRequest('orders', { query: new URLSearchParams(params).toString() }) };
});
