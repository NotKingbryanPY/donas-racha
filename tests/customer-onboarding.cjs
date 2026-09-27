'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-secret';

const { issueSession } = require('../api/_lib/customer-id-session');
const handler = require('../api/_lib/customer_handlers/onboarding');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const rows = new Map();
const writes = [];

global.fetch = async (url, options) => {
  const parsed = new URL(url);
  const table = parsed.pathname.split('/').at(-1);
  const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
  if (table === 'customers') {
    const id = parsed.searchParams.get('id')?.slice(3);
    return json([A, B].includes(id) ? [{ id, public_id: id === A ? 'CAAAA' : 'CBBBB', status: 'ACTIVE' }] : []);
  }
  if (table === 'customer_web_access') return json([{ credential_version: 1 }]);
  if (table === 'consume_api_rate_limit') return json({ allowed: true });
  if (table === 'customer_onboarding') {
    if (options.method === 'POST') {
      const body = JSON.parse(options.body); writes.push(body);
      const old = rows.get(body.customer_id);
      if (old?.status === 'COMPLETED') return json([old]);
      rows.set(body.customer_id, body); return json([body]);
    }
    const id = parsed.searchParams.get('customer_id')?.slice(3);
    return json(rows.has(id) ? [rows.get(id)] : []);
  }
  throw new Error(`Unexpected request: ${url}`);
};

async function call(method, accessToken, body) {
  let payload;
  const req = { method, url: '/api/customer/onboarding', headers: { authorization: `Bearer ${accessToken}` }, body };
  const res = { statusCode: 0, setHeader() {}, end(value) { payload = JSON.parse(value); } };
  await handler(req, res);
  return { status: res.statusCode, ...payload };
}

(async () => {
  const tokenA = issueSession(A, 1), tokenB = issueSession(B, 1);
  assert.equal((await call('GET', tokenA)).data.progress, null);
  assert.equal((await call('POST', tokenA, { status: 'NOT_STARTED', lastStep: 0 })).data.progress.started_at, null);
  const a = await call('POST', tokenA, { status: 'IN_PROGRESS', lastStep: 2, customerId: B });
  assert.equal(a.status, 200);
  assert.equal(writes.at(-1).customer_id, A, 'body cannot select another customer');
  assert.equal((await call('GET', tokenB)).data.progress, null);
  assert.equal((await call('GET', tokenA)).data.progress.last_step, 2);
  assert.equal((await call('POST', tokenA, { status: 'COMPLETED', lastStep: 7 })).data.progress.status, 'COMPLETED');
  assert.equal((await call('POST', tokenA, { status: 'IN_PROGRESS', lastStep: 0 })).data.progress.status, 'COMPLETED');
  assert.equal((await call('POST', tokenB, { status: 'POSTPONED', lastStep: 0 })).data.progress.status, 'POSTPONED');
  assert.equal((await call('POST', 'not-a-session', { status: 'COMPLETED', lastStep: 7 })).status, 401);
  assert.equal((await call('POST', tokenB, { status: 'COMPLETED', lastStep: 9 })).status, 400);

  const root = path.join(__dirname, '..');
  const tour = fs.readFileSync(path.join(root, 'assets/js/client-tour.js'), 'utf8');
  assert.doesNotMatch(tour, /submitClientOrder|registerPurchase|canjearRecompensa|saveCustomerPassword/);
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202609270003_customer_onboarding.sql'), 'utf8');
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.customer_onboarding from public, anon, authenticated/);
  console.log('PASS customer onboarding: session scope, versioned progress, completion and safe actions');
})().catch(error => { console.error(error); process.exitCode = 1; });
