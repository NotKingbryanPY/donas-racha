const {withApi, ApiError} = require('./http');
module.exports = withApi(['GET','POST','DELETE'], async () => {
  throw new ApiError(410, 'MOBILE_INTEGRATION_RETIRED', 'La integración con Donas Control se retiró. Gestiona pedidos y sabores desde la página web.');
});
