const { requireCustomer } = require('../auth');
const { ApiError, withApi } = require('../http');
const { enforceRateLimit } = require('../rate-limit');
const { serviceRequest } = require('../supabase');

module.exports = withApi(['GET'], async req => {
  const { user, customer } = await requireCustomer(req);
  await enforceRateLimit(req, 'customer_orders', 60, 60, user.id);
  const offset = key => {
    const raw = String(req.query?.[key] ?? '0');
    if (!/^\d{1,5}$/.test(raw)) throw new ApiError(400, 'VALIDATION_ERROR', 'La página de pedidos no es válida.');
    return Number(raw);
  };
  const activeOffset = offset('activeOffset');
  const historyOffset = offset('historyOffset');
  const activeOnly = req.query?.view === 'active';
  const select = 'id,public_code,status,payment_method,payment_status,currency_code,total_cents,created_at,updated_at,completed_at,cancelled_at,delivery_location,order_items(variant_name_snapshot,quantity,unit_price_cents,line_total_cents)';
  const read = (status, start, size) => serviceRequest('orders', { query:new URLSearchParams({
    select, customer_id:`eq.${customer.id}`, status, order:'created_at.desc,id.desc',
    offset:String(start), limit:String(size + 1)
  }).toString() });
  const [active, history] = await Promise.all([
    read('in.(PENDING,ACCEPTED,OUT_FOR_DELIVERY)', activeOffset, 50),
    activeOnly ? Promise.resolve([]) : read('in.(COMPLETED,CANCELLED)', historyOffset, 10)
  ]);
  const activeOrders = active.slice(0,50);
  const historyOrders = history.slice(0,10);
  return { orders:[...activeOrders,...historyOrders], activeOrders, historyOrders,
    activeOffset, historyOffset, hasMoreActive:active.length > 50,
    hasMoreHistory:history.length > 10, historyIncluded:!activeOnly };
});
