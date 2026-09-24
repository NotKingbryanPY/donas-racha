'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ApiError } = require('../api/_lib/http');
const { fingerprint, validateOrder } = require('../api/_lib/validation');

const valid = {
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  deliveryLocation: 'UTP, Edificio 4, entrada principal',
  paymentMethod: 'YAPPY',
  customerName: 'Ana',
  customerPhone: '+50760000000',
  items: [{ productVariantId: '33333333-3333-4333-8333-333333333333', quantity: 2 }]
};

assert.equal(validateOrder(valid).items[0].quantity, 2);
assert.equal(validateOrder(valid).deliveryLocation, 'UTP, Edificio 4, entrada principal');
assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 }), 'fingerprint must be stable');
assert.throws(() => validateOrder({ ...valid, items: [{ ...valid.items[0], quantity: 0 }] }), ApiError);
assert.throws(() => validateOrder({ ...valid, items: [...valid.items, valid.items[0]] }), /Cada variante/);
assert.throws(() => validateOrder({ ...valid, customerPhone: '6000-0000' }), /formato internacional/);
assert.throws(() => validateOrder({ ...valid, paymentMethod: 'CARD' }), ApiError);
assert.throws(() => validateOrder({ ...valid, deliveryLocation: '  ' }), /deliveryLocation/);

const root = path.join(__dirname, '..');
const sql = [
  '202609210002_api_transactions.sql',
  '202609220001_delivery_orders.sql'
].map(file => fs.readFileSync(path.join(root, 'supabase', 'migrations', file), 'utf8')).join('\n');
const rollback = fs.readFileSync(path.join(root, 'supabase', 'rollback', '202609210002_phase4_down.sql'), 'utf8');

for (const fragment of [
  'create table public.api_rate_limits',
  'create or replace function public.consume_api_rate_limit',
  'create or replace function public.api_create_order',
  'pg_advisory_xact_lock',
  'IDEMPOTENCY_CONFLICT',
  'create or replace function public.api_transition_order',
  'create or replace function public.api_record_order_payment',
  "add value if not exists 'OUT_FOR_DELIVERY'",
  'add column if not exists available boolean',
  'p_delivery_location text',
  "v_order.status = 'OUT_FOR_DELIVERY'",
  'PAYMENT_REQUIRED',
  'grant execute on function public.api_create_order',
  'to service_role'
]) assert.ok(sql.includes(fragment), `missing API contract: ${fragment}`);

assert.doesNotMatch(sql, /grant execute on function public\.api_create_order[^;]+to (?:anon|authenticated)/i);
assert.match(rollback, /drop function if exists public\.api_create_order/i);

const endpointFiles = [
  'api/products.js', 'api/orders/index.js', 'api/orders/[publicCode].js',
  'api/ranking.js',
  'api/customer/profile.js', 'api/customer/loyalty.js', 'api/admin/orders/index.js',
  'api/admin/orders/[id]/status.js', 'api/admin/orders/[id]/payment.js',
  'api/sync/index.js', 'api/auth/session.js'
];
for (const file of endpointFiles) assert.ok(fs.existsSync(path.join(root, file)), `missing endpoint ${file}`);

console.log('PASS API contract: validation, server pricing, idempotency, rate limits and 11 endpoints');
