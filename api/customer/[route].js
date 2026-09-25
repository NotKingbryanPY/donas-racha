const { ApiError, withApi } = require('../_lib/http');

const handlers = Object.freeze({
  claim: require('../_lib/customer_handlers/claim'),
  loyalty: require('../_lib/customer_handlers/loyalty'),
  orders: require('../_lib/customer_handlers/orders'),
  profile: require('../_lib/customer_handlers/profile'),
  register: require('../_lib/customer_handlers/register'),
  session: require('../_lib/customer_handlers/session')
});

const unknownRoute = withApi(['GET', 'POST'], async () => {
  throw new ApiError(404, 'NOT_FOUND', 'La ruta no existe.');
});

module.exports = (req, res) => {
  const route = typeof req.query?.route === 'string' ? req.query.route : '';
  const handler = Object.hasOwn(handlers, route) ? handlers[route] : unknownRoute;
  return handler(req, res);
};
