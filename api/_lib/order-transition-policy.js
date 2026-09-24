const { ApiError } = require('./http');

function assertAccountingReady(status) {
  if (status === 'COMPLETED') {
    throw new ApiError(
      409,
      'ACCOUNTING_NOT_READY',
      'La entrega aún no puede completarse: falta registrar la venta, el inventario y los puntos en una sola operación.'
    );
  }
  return status;
}

module.exports = { assertAccountingReady };
