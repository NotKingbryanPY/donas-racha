'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'css', 'redesign.css'), 'utf8');
const products = fs.readFileSync(path.join(root, 'api', 'products.js'), 'utf8');

for (const fragment of ['id="sabores"', 'id="publicCatalog"', 'renderPublicCatalog', 'flattenCatalog', 'variant.available', 'Pago al recibir: efectivo o Yappy']) {
  assert.ok(html.includes(fragment), `missing phase 7 catalog behavior: ${fragment}`);
}
assert.match(products, /unit_price_cents,currency_code,available/);
assert.match(css, /\.catalog-grid/);
assert.match(css, /\.flavor-card\.sold-out/);
assert.match(css, /@media\(min-width:760px\)[\s\S]*\.catalog-grid\{grid-template-columns:repeat\(4/);

console.log('PASS phase 7 catalog: responsive live availability and payment information');
