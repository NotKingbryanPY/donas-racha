const { ApiError, withApi } = require('../../_lib/http');

const handlers = Object.freeze({
  lookup: require('../../_lib/admin_handlers/lookup'),
  catalog: require('../../_lib/admin_handlers/catalog'),
  inventory: require('../../_lib/admin_handlers/inventory'),
  daily: require('../../_lib/admin_handlers/daily'),
  'claim-token': require('../../_lib/admin_handlers/claim-token')
});
const retired = require('../../_lib/mobile-retired');
const unknown = withApi(['GET','POST','DELETE'], async () => {
  throw new ApiError(404, 'NOT_FOUND', 'La ruta no existe.');
});

module.exports = (req, res) => {
  const route = typeof req.query?.route === 'string' ? req.query.route : '';
  if (['provisioning','firebase-identity','devices'].includes(route)) return retired(req,res);
  return (Object.hasOwn(handlers, route) ? handlers[route] : unknown)(req, res);
};
