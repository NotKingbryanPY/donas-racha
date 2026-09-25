const { requireAdmin } = require('../../../_lib/auth');
const { withApi } = require('../../../_lib/http');
const { enforceRateLimit } = require('../../../_lib/rate-limit');
const { rpc } = require('../../../_lib/supabase');
const { enumValue, uuid } = require('../../../_lib/validation');

module.exports = withApi(['PATCH', 'POST'], async (req, context) => {
  const user = await requireAdmin(req);
  await enforceRateLimit(req, 'admin_order_status', 120, 60, user.id);
  const body = context.parseJsonBody(req);
  const orderId = uuid(req.query.id, 'id');
  const status = enumValue(String(body.status || '').toUpperCase(), ['ACCEPTED', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'], 'status');
  if (status === 'COMPLETED') {
    const settlement = await rpc('api_complete_order', {
      p_order_id:orderId,
      p_idempotency_key:uuid(body.idempotencyKey, 'idempotencyKey'),
      p_actor_user_id:user.id
    });
    return { settlement };
  }
  const result = await rpc('api_transition_order', {
    p_order_id: orderId,
    p_to_status: status,
    p_actor_user_id: user.id,
    p_note: body.note == null ? null : String(body.note).trim().slice(0, 500)
  });
  return { order: Array.isArray(result) ? result[0] : result };
});
