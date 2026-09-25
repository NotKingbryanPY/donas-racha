'use strict';

const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const customerId = '22222222-2222-4222-8222-222222222222';
let orderRpc = null;
global.fetch = async (url, options = {}) => {
  const path = new URL(url);
  const json = value => ({ ok: true, status: 200, text: async () => JSON.stringify(value), json: async () => value });
  if (path.pathname === '/rest/v1/customers') return json([{
    id: customerId, public_id: 'CABC123', display_name: 'Cliente Registrada',
    whatsapp_e164: '+50760001111', status: 'ACTIVE'
  }]);
  if (path.pathname === '/rest/v1/customer_web_access') return json([]);
  if (path.pathname === '/rest/v1/rpc/consume_api_rate_limit') return json({ allowed: true });
  if (path.pathname === '/rest/v1/rpc/api_create_order_by_customer_id') {
    orderRpc = JSON.parse(options.body);
    return json({ public_code: 'DR-1234567890', replayed: false });
  }
  throw new Error(`Unexpected URL: ${url}`);
};

const customerRoute = require('../api/customer/[route]');
const createOrder = require('../api/orders/index');
const res = () => ({ statusCode: 200, setHeader() {}, end(body) { this.body = JSON.parse(body); } });

(async () => {
  const login = res();
  await customerRoute({ method:'POST', url:'/api/customer/session', query:{route:'session'}, headers:{},
    body:{publicId:'CABC123'} }, login);
  assert.equal(login.statusCode, 200);
  assert.ok(login.body.data.accessToken.startsWith('dr1.'));

  const response = res();
  await createOrder({ method: 'POST', url: '/api/orders',
    headers: { authorization: `Bearer ${login.body.data.accessToken}` }, body: {
      idempotencyKey: '33333333-3333-4333-8333-333333333333',
      deliveryLocation: 'UTP, Edificio 4', paymentMethod: 'YAPPY',
      customerName: 'Nombre falso', customerPhone: '+50769999999',
      items: [{ productVariantId: '44444444-4444-4444-8444-444444444444', quantity: 2 }]
    } }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(orderRpc.p_customer_id, customerId);
  assert.equal(orderRpc.p_auth_user_id, undefined);
  assert.equal(orderRpc.p_customer_name, undefined);
  assert.equal(orderRpc.p_customer_phone, undefined);
  console.log('PASS ID-only session creates a registered-customer order without trusting submitted identity');
})().catch(error => { console.error(error); process.exitCode = 1; });
