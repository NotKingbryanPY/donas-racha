const { requireCustomer } = require('../_lib/auth');
const { withApi } = require('../_lib/http');
const { enforceRateLimit } = require('../_lib/rate-limit');

module.exports = withApi(['GET'], async req => {
  const { user, customer } = await requireCustomer(req);
  await enforceRateLimit(req, 'customer_profile', 120, 60, user.id);
  return { customer };
});
