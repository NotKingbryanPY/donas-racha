const assert = require('node:assert/strict');
const { ApiError } = require('../api/_lib/http');
let authorized = true, queries = [];
function replace(moduleName, exports) {
  const id = require.resolve(moduleName);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
replace('../api/_lib/auth', { requireStaff: async () => {
  if (!authorized) throw new ApiError(401, 'AUTH_REQUIRED', 'Sesión requerida');
  return { id: 'authorized-staff' };
} });
replace('../api/_lib/rate-limit', { enforceRateLimit: async () => {} });
replace('../api/_lib/supabase', { serviceRequest: async (table, {query}) => {
  assert.equal(table, 'orders'); queries.push(new URLSearchParams(query));
  return [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', public_code: 'DR-123456789A' }];
} });
const handler = require('../api/admin/orders');
async function request(query) {
  const result = { setHeader() {}, end(body) { this.body = JSON.parse(body); } };
  await handler({ method: 'GET', headers: {}, query, url: '/api/admin/orders' }, result);
  return result;
}
(async () => {
  const id = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
  const selected = await request({orderId: id, limit: 100});
  assert.equal(selected.statusCode, 200);
  assert.equal(queries[0].get('id'), 'eq.' + id.toLowerCase());
  assert.equal(queries[0].get('limit'), '1');
  assert.ok(queries[0].get('select').includes('product_variant_id'));
  assert.ok(queries[0].get('select').includes('sku_snapshot'));
  await request({limit: 100});
  assert.equal(queries[1].get('id'), null);
  assert.equal(queries[1].get('limit'), '100');
  const invalid = await request({orderId: 'invalid-id'});
  assert.equal(invalid.statusCode, 400);
  assert.equal(queries.length, 2, 'invalid identifiers never reach SQL');
  authorized = false;
  const denied = await request({orderId: id});
  assert.equal(denied.statusCode, 401);
  assert.equal(queries.length, 2, 'a notification never bypasses staff authorization');
  console.log('PASS notification lookup: exact UUID beyond latest page, stable flavor IDs and unauthorized/invalid requests denied');
})().catch(error => { console.error(error); process.exitCode = 1; });
