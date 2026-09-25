const { requireAdmin } = require('../../_lib/auth');
const { ApiError, withApi } = require('../../_lib/http');
const { enforceRateLimit } = require('../../_lib/rate-limit');
const { userRpc } = require('../../_lib/supabase');
const { uuid } = require('../../_lib/validation');

module.exports = withApi(['POST'], async (req, context) => {
  const admin = await requireAdmin(req);
  await enforceRateLimit(req, 'issue_customer_claim', 20, 3600, admin.id);
  const body = context.parseJsonBody(req, 4096);
  const customerId = uuid(body.customerId, 'customerId');
  const token = await userRpc('issue_customer_password_token', {
    p_customer_id:customerId,p_ttl:'00:30:00'
  }, req.headers.authorization);
  if (typeof token !== 'string') throw new ApiError(502, 'CLAIM_INVALID_RESPONSE', 'No se generó el código de contraseña.');
  return { token, expiresInMinutes:30 };
});
