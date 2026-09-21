const { requireAdmin } = require('../../../_lib/auth');
const { withApi } = require('../../../_lib/http');
const { enforceRateLimit } = require('../../../_lib/rate-limit');
const { rpc } = require('../../../_lib/supabase');
const { enumValue, requiredString, uuid } = require('../../../_lib/validation');

module.exports = withApi(['POST'], async (req, context) => {
  const user = await requireAdmin(req);
  await enforceRateLimit(req, 'admin_order_payment', 60, 60, user.id);
  const body = context.parseJsonBody(req);
  const reference = body.externalReference == null ? null : requiredString(body.externalReference, 'externalReference', 1, 120);
  const result = await rpc('api_record_order_payment', {
    p_order_id: uuid(req.query.id, 'id'),
    p_idempotency_key: uuid(body.idempotencyKey, 'idempotencyKey'),
    p_status: enumValue(String(body.status || '').toUpperCase(), ['CONFIRMED', 'FAILED'], 'status'),
    p_actor_user_id: user.id,
    p_external_reference: reference
  });
  const payment = Array.isArray(result) ? result[0] : result;
  return { payment, __status: payment && payment.replayed ? 200 : 201 };
});
