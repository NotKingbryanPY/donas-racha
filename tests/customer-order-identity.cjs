'use strict';

const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';

const userId = '11111111-1111-4111-8111-111111111111';
const customerId = '22222222-2222-4222-8222-222222222222';
let orderRpc = null;
global.fetch = async (url, options = {}) => {
  const path = new URL(url);
  const json = value => ({ ok: true, status: 200, text: async () => JSON.stringify(value), json: async () => value });
  if (path.pathname === '/auth/v1/user') return json({ id: userId });
  if (path.pathname === '/rest/v1/customers') return json([{
    id: customerId, display_name: 'Cliente Registrada', whatsapp_e164: '+50760001111', status: 'ACTIVE'
  }]);
  if (path.pathname === '/rest/v1/rpc/consume_api_rate_limit') return json({ allowed: true });
  if (path.pathname === '/rest/v1/rpc/api_create_order') {
    orderRpc = JSON.parse(options.body);
    return json({ public_code: 'DR-1234567890', replayed: false });
  }
  throw new Error(`Unexpected URL: ${url}`);
};

const createOrder = require('../api/orders/index');
const res = () => ({ statusCode: 200, setHeader() {}, end(body) { this.body = JSON.parse(body); } });

(async () => {
  const response = res();
  await createOrder({ method: 'POST', url: '/api/orders', headers: { authorization: 'Bearer test-token' }, body: {
    idempotencyKey: '33333333-3333-4333-8333-333333333333',
    deliveryLocation: 'UTP, Edificio 4', paymentMethod: 'YAPPY',
    customerName: 'Nombre falso', customerPhone: '+50769999999',
    items: [{ productVariantId: '44444444-4444-4444-8444-444444444444', quantity: 2 }]
  } }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(orderRpc.p_auth_user_id, userId);
  assert.equal(orderRpc.p_customer_name, 'Cliente Registrada');
  assert.equal(orderRpc.p_customer_phone, '+50760001111');
  console.log('PASS registered identity overrides forged order name and phone');
})().catch(error => { console.error(error); process.exitCode = 1; });
