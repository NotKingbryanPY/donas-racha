'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const landing = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'customer.html'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202609250001_customer_only_delivery.sql'), 'utf8');

assert.match(landing, /href="\/customer\.html">Pedir desde mi perfil/);
assert.match(landing, /\/customer\.html\?flavor=/);
assert.doesNotMatch(landing, /id="orderName"|id="orderPhone"|vercelPost\('\/api\/orders'/);
assert.match(profile, /id="profile"/);
assert.match(profile, /id="delivery"/);
assert.match(profile, /id="orders"/);
assert.match(profile, /api\/customer\/profile/);
assert.match(profile, /api\/orders/);
assert.doesNotMatch(profile, /id="orderName"|id="orderPhone"/);
assert.match(sql, /if p_auth_user_id is null then/);
assert.match(sql, /v_customer\.display_name,v_customer\.whatsapp_e164/);
assert.match(sql, /revoke execute on function public\.api_create_order_with_guest_support/);
console.log('PASS registered delivery: profile ordering and anonymous form removed');
