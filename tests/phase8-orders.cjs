'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const landing = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const redirect = fs.readFileSync(path.join(root, 'customer.html'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202609250002_customer_id_access.sql'), 'utf8');

assert.match(landing, /onclick="beginCustomerOrder\(\)">Pedir desde mi perfil/);
assert.match(landing, /id="userClientIdInput"/);
assert.match(landing, /id="customerPasswordGroup"[^>]*display:none/);
assert.match(landing, /id="client-tab-delivery"/);
assert.match(landing, /id="clientDeliverySection"/);
assert.match(landing, /function submitClientOrder\(/);
assert.doesNotMatch(landing, /id="orderName"|id="orderPhone"|href="\/customer\.html"/);
assert.match(redirect, /location\.replace\(home \+ '\?profile=1'/);
assert.match(sql, /create table public\.customer_web_access/);
assert.match(sql, /v_customer\.display_name,v_customer\.whatsapp_e164/);
assert.match(sql, /grant execute on function public\.api_create_order_by_customer_id/);
console.log('PASS ID profile delivery: existing design, optional password, registered identity');
