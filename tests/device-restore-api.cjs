'use strict';
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://restore.example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const operation = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let calls = 0, role = 'ADMIN';
global.fetch = async (raw, options = {}) => {
  const path = new URL(raw).pathname;
  const json = value => ({ ok: true, status: 200, text: async () => JSON.stringify(value) });
  if (path === '/auth/v1/user') return json({ id: admin });
  if (path === '/rest/v1/app_user_roles') return json([{ role }]);
  if (path === '/rest/v1/rpc/consume_api_rate_limit') return json({ allowed: true });
  if (path === '/rest/v1/rpc/api_restore_device_identity') {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(body.p_auth_user_id, admin);
    assert.equal(body.p_client_operation_id, operation);
    assert.equal(body.p_server_sequence, 7);
    return json({ deviceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
  }
  throw new Error(`Unexpected request ${path}`);
};
const handler = require('../api/sync');
const request = async body => {
  const res = { setHeader() {}, end(value) { this.body = JSON.parse(value); } };
  await handler({ method: 'POST', url: '/api/sync', headers: { authorization: 'Bearer test' }, body }, res);
  return res;
};
(async () => {
  const payload = { action: 'restore-device', clientOperationId: operation, serverSequence: 7 };
  assert.equal((await request(payload)).statusCode, 200);
  assert.equal(calls, 1);
  for (const invalid of [-1, '7', 1.5]) assert.equal((await request({ ...payload, serverSequence: invalid })).statusCode, 400);
  assert.equal((await request({ ...payload, clientOperationId: 'bad' })).statusCode, 400);
  role = 'SELLER';
  assert.equal((await request(payload)).statusCode, 403);
  assert.equal(calls, 1, 'invalid proofs and seller accounts cannot restore another ledger');
  console.log('PASS device restoration API validates proof and requires an administrator');
})().catch(error => { console.error(error); process.exitCode = 1; });
