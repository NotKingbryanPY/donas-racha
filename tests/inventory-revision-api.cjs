'use strict';
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://inventory.example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
let writes = 0;
const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
global.fetch = async (raw, options = {}) => {
  const path = new URL(raw).pathname;
  const json = value => ({ ok: true, status: 200, text: async () => JSON.stringify(value) });
  if (path === '/auth/v1/user') return json({ id: admin });
  if (path === '/rest/v1/app_user_roles') return json([{ role: 'ADMIN' }]);
  if (path === '/rest/v1/rpc/consume_api_rate_limit') return json({ allowed: true });
  if (path === '/rest/v1/rpc/api_set_shared_inventory') {
    writes++;
    assert.equal(JSON.parse(options.body).p_expected_revision, 12);
    return json({ saved: true, revision: 13 });
  }
  throw new Error(`Unexpected request ${path}`);
};
const handler = require('../api/_lib/admin_handlers/inventory');
const counts = { 'DR-CHOCOLATE': 4, 'DR-VAINILLA': 4, 'DR-CHOCOLATE-CHISPAS': 2, 'DR-VAINILLA-CHISPAS': 2 };
const call = async body => {
  const res = { setHeader() {}, end(value) { this.body = JSON.parse(value); } };
  await handler({ method: 'POST', url: '/api/admin/customers/inventory', headers: { authorization: 'Bearer test-admin' }, body }, res);
  return res;
};
(async () => {
  for (const invalid of [undefined, null, -1, 1.5, '12']) {
    const response = await call({ counts, expectedRevision: invalid });
    assert.equal(response.statusCode, 400);
  }
  assert.equal(writes, 0, 'missing/invalid revisions must never overwrite another device count');
  assert.equal((await call({ counts, expectedRevision: 12 })).statusCode, 200);
  assert.equal(writes, 1);
  console.log('PASS inventory API requires a valid revision before writing a physical count');
})().catch(error => { console.error(error); process.exitCode = 1; });
