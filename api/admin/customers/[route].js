const { ApiError, withApi } = require('../../_lib/http');

const handlers = Object.freeze({
  lookup: require('../../_lib/admin_handlers/lookup'),
  'claim-token': require('../../_lib/admin_handlers/claim-token')
});
const unknown = withApi(['POST'], async () => {
  throw new ApiError(404, 'NOT_FOUND', 'La ruta no existe.');
});

module.exports = (req, res) => {
  const route = typeof req.query?.route === 'string' ? req.query.route : '';
  return (Object.hasOwn(handlers, route) ? handlers[route] : unknown)(req, res);
};
