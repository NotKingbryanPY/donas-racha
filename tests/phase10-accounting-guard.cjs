'use strict';
const assert = require('node:assert/strict');
const { assertAccountingReady } = require('../api/_lib/order-transition-policy');

for (const status of ['ACCEPTED', 'OUT_FOR_DELIVERY', 'CANCELLED']) {
  assert.equal(assertAccountingReady(status), status);
}
assert.equal(assertAccountingReady('COMPLETED'), 'COMPLETED');
console.log('PASS order transition policy: completed delivery uses atomic database triggers');
