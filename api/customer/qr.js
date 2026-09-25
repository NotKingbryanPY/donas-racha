const { requireCustomer } = require('../_lib/auth');
const { withApi } = require('../_lib/http');
const { enforceRateLimit } = require('../_lib/rate-limit');
const { rpc } = require('../_lib/supabase');

module.exports = withApi(['POST'], async req => {
  const { user } = await requireCustomer(req);
  await enforceRateLimit(req, 'customer_qr', 12, 3600, user.id);
  const result = await rpc('api_issue_customer_qr', { p_auth_user_id:user.id });
  return { qr:Array.isArray(result) ? result[0] : result };
});
