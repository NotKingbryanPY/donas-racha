const { requireAdmin } = require('../_lib/auth');
const { withApi } = require('../_lib/http');
const { enforceRateLimit } = require('../_lib/rate-limit');
const { rpc } = require('../_lib/supabase');

module.exports = withApi(['GET'], async req => {
  const admin = await requireAdmin(req);
  await enforceRateLimit(req, 'admin_health', 60, 60, admin.id);
  return { health:await rpc('api_operational_health', {}) };
});
