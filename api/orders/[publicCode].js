const { optionalUser } = require('../_lib/auth');
const { ApiError, withApi } = require('../_lib/http');
const { enforceRateLimit } = require('../_lib/rate-limit');
const { serviceRequest } = require('../_lib/supabase');
const { PUBLIC_CODE } = require('../_lib/validation');

module.exports = withApi(['GET'], async req => {
  const publicCode = String(req.query.publicCode || '').toUpperCase();
  if (!PUBLIC_CODE.test(publicCode)) throw new ApiError(400, 'VALIDATION_ERROR', 'El código de pedido no es válido.');
  const user = await optionalUser(req);
  await enforceRateLimit(req, 'read_order', 60, 60, user ? user.id : undefined);
  const query = new URLSearchParams({
    select: 'id,public_code,customer_id,status,payment_method,payment_status,currency_code,subtotal_cents,discount_cents,total_cents,created_at,updated_at,completed_at,cancelled_at,pickup_locations(code,name,instructions),order_items(product_name_snapshot,variant_name_snapshot,sku_snapshot,quantity,unit_price_cents,line_total_cents),order_events(from_status,to_status,actor_type,note,created_at)',
    public_code: `eq.${publicCode}`,
    limit: '1'
  }).toString();
  const rows = await serviceRequest('orders', { query });
  const order = rows && rows[0];
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'No se encontró el pedido.');
  if (order.customer_id) {
    if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Este pedido requiere una sesión válida.');
    const customers = await serviceRequest('customers', { query: new URLSearchParams({ select: 'id', id: `eq.${order.customer_id}`, auth_user_id: `eq.${user.id}`, limit: '1' }).toString() });
    const roles = await serviceRequest('app_user_roles', { query: new URLSearchParams({ select: 'auth_user_id', auth_user_id: `eq.${user.id}`, role: 'eq.ADMIN', limit: '1' }).toString() });
    if ((!customers || !customers[0]) && (!roles || !roles[0])) throw new ApiError(403, 'ORDER_FORBIDDEN', 'No puedes consultar este pedido.');
  }
  delete order.customer_id;
  return { order };
});
