'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const { normalizeOperations } = require('../api/sync/index.js')._test;

for (const type of ['SESSION_START', 'SESSION_CLOSE', 'REVERSAL', 'TRANSFER']) {
  const operation = normalizeOperations([{
    clientOperationId: '11111111-1111-4111-8111-111111111111', type,
    occurredAt: new Date().toISOString(), payload: { localEventId: 1 }
  }])[0];
  assert.equal(operation.type, type);
}
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202609230001_android_event_types.sql'), 'utf8');
for (const type of ['SESSION_START', 'SESSION_CLOSE', 'REVERSAL', 'TRANSFER']) assert.match(sql, new RegExp(type));
assert.match(sql, /sync_operations_type_check/);

const route = fs.readFileSync(path.join(root, 'api/auth/session.js'), 'utf8');
assert.match(route, /requireAdmin/);
assert.match(route, /enforceRateLimit/);
assert.match(route, /refresh_token/);
assert.doesNotMatch(route, /serviceRoleKey/);
assert.match(fs.readFileSync(path.join(root, 'api/admin/orders/[id]/status.js'), 'utf8'), /withApi\(\['PATCH', 'POST'\]/);
console.log('PASS phase 10 Android bridge: local event types, admin session, Android-compatible order transitions');
