'use strict';
const assert = require('node:assert/strict');
const { assertAccountingReady } = require('../api/_lib/order-transition-policy');

for (const status of ['ACCEPTED', 'OUT_FOR_DELIVERY', 'CANCELLED']) {
  assert.equal(assertAccountingReady(status), status);
}
assert.throws(
  () => assertAccountingReady('COMPLETED'),
  error => error.status === 409 && error.code === 'ACCOUNTING_NOT_READY'
);
console.log('PASS phase 10 accounting guard: incomplete settlement cannot mark delivered');
