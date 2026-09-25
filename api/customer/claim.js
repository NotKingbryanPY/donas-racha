const { requireUser } = require('../_lib/auth');
const { ApiError, withApi } = require('../_lib/http');
const { enforceRateLimit } = require('../_lib/rate-limit');
const { userRpc } = require('../_lib/supabase');

module.exports = withApi(['POST'], async (req, context) => {
  const user = await requireUser(req);
  await enforceRateLimit(req, 'customer_claim', 5, 3600, user.id);
  const body = context.parseJsonBody(req, 4096);
  const token = typeof body.claimToken === 'string' ? body.claimToken.trim() : '';
  if (!/^[0-9a-f]{64}$/i.test(token)) throw new ApiError(400, 'VALIDATION_ERROR', 'Código de vinculación no válido.');
  const linked = await userRpc('claim_customer_account', { p_claim_token:token }, req.headers.authorization);
  return { customer:Array.isArray(linked)?linked[0]:linked };
});
