const { requireCustomer } = require('../auth');
const { withApi } = require('../http');
const { enforceRateLimit } = require('../rate-limit');

module.exports = withApi(['GET'], async req => {
  const { user, customer } = await requireCustomer(req);
  await enforceRateLimit(req, 'customer_profile', 120, 60, user.id);
  return { customer };
});
