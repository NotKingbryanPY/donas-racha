const { ApiError, withApi } = require('../_lib/http');

const handlers = Object.freeze({
  loyalty: require('../_lib/customer_handlers/loyalty'),
  orders: require('../_lib/customer_handlers/orders'),
  password: require('../_lib/customer_handlers/password'),
  profile: require('../_lib/customer_handlers/profile'),
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
