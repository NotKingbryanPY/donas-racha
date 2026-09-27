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
assert.match(css, /\.donut-order-card/);
assert.match(html, /id="catalogOrderBtn"[^>]*onclick="beginCustomerOrder\(\)"/);
assert.equal((html.match(/Entrar a mi perfil/g) || []).length, 1);

// Keep the compact price accurate when availability or catalog pricing changes.
const vm = require('node:vm');
const elements = { publicCatalog:{setAttribute(){},textContent:'',innerHTML:''}, catalogOrderBtn:{disabled:false} };
const context = vm.createContext({document:{getElementById:id=>elements[id]},safe:String,Intl});
for (const name of ['flattenCatalog','formatMoney','renderPublicCatalog']) {
  const start = html.indexOf(`function ${name}(`);
  const end = html.indexOf('\n}',start)+2;
  vm.runInContext(html.slice(start,end),context);
}
const render = variants => context.renderPublicCatalog([{name:'Donas',product_variants:variants}]);
const flavor = (price, available=true) => ({unit_price_cents:price,currency_code:'USD',available});
render([flavor(100),flavor(100)]);
assert.match(elements.publicCatalog.innerHTML,/B\/\.1\.00/);
assert.doesNotMatch(elements.publicCatalog.innerHTML,/Desde/);
render([flavor(100),flavor(150)]);
assert.match(elements.publicCatalog.innerHTML,/Desde B\/\.1\.00/);
render([flavor(50,false),flavor(150)]);
assert.match(elements.publicCatalog.innerHTML,/B\/\.1\.50/);
render([flavor(100,false)]);
assert.equal(elements.catalogOrderBtn.disabled,true);
context.renderPublicCatalog(null);
assert.equal(elements.catalogOrderBtn.disabled,false);
assert.match(elements.publicCatalog.textContent,/Consulta el precio/);

console.log('PASS phase 7 catalog: responsive live availability and payment information');
