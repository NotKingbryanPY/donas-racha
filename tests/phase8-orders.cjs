'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'css', 'redesign.css'), 'utf8');

for (const fragment of [
  'id="orderOverlay"', 'Pago al recibir', '6015-0927', "vercelPost('/api/orders'",
  "vercelApi('/api/orders/'", 'crypto.randomUUID', "PENDING:'Pedido pendiente'",
  "ACCEPTED:'Pedido aceptado'", "OUT_FOR_DELIVERY:'En camino'", "COMPLETED:'Entregado'",
  "PREPARING:'Pedido aceptado'", 'localStorage.setItem(\'donasLastOrder\''
]) assert.ok(html.includes(fragment), `missing phase 8 order behavior: ${fragment}`);

assert.doesNotMatch(html, /PREPARING:'Preparando'/);
assert.match(html, /return 'B\/\.' \+ amount\.toFixed\(2\)/);
assert.match(css, /\.order-overlay/);
assert.match(css, /\.status-timeline/);
assert.match(css, /\.last-order-button\[hidden\]\{display:none!important\}/);
console.log('PASS phase 8 orders: cart, delivery, pay-on-delivery and public tracking');
