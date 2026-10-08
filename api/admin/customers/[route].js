const { ApiError, withApi } = require('../../_lib/http');

const handlers = Object.freeze({
  lookup: require('../../_lib/admin_handlers/lookup'),
  catalog: require('../../_lib/admin_handlers/catalog'),
  provisioning: require('../../_lib/admin_handlers/provisioning'),
  'firebase-identity': require('../../_lib/admin_handlers/firebase-identity'),
  inventory: require('../../_lib/admin_handlers/inventory'),
  devices: require('../../_lib/admin_handlers/devices'),
  'claim-token': require('../../_lib/admin_handlers/claim-token')
});
const unknown = withApi(['POST'], async () => {
  throw new ApiError(404, 'NOT_FOUND', 'La ruta no existe.');
});

module.exports = (req, res) => {
  const route = typeof req.query?.route === 'string' ? req.query.route : '';
  return (Object.hasOwn(handlers, route) ? handlers[route] : unknown)(req, res);
};
