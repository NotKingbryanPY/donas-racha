const { requireCustomer } = require('../auth');
const { withApi } = require('../http');
const { enforceRateLimit } = require('../rate-limit');
const { serviceRequest } = require('../supabase');

module.exports = withApi(['GET'], async req => {
  const { user, customer } = await requireCustomer(req);
  await enforceRateLimit(req, 'customer_orders', 60, 60, user.id);
  const query = new URLSearchParams({
    select: 'public_code,status,payment_method,payment_status,currency_code,total_cents,created_at,completed_at,order_items(variant_name_snapshot,quantity)',
    customer_id: `eq.${customer.id}`,
    order: 'created_at.desc',
    limit: '20'
  }).toString();
  return { orders: await serviceRequest('orders', { query }) };
});
