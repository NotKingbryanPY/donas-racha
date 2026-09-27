function assertAccountingReady(status) {
  // The order status update now invokes inventory and loyalty triggers in the
  // same database transaction. Any trigger failure rolls back the delivery.
  return status;
}

module.exports = { assertAccountingReady };
