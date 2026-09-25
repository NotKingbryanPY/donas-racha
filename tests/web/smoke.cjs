const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const base = 'http://127.0.0.1:8765';
  const variantId = '11111111-1111-4111-8111-111111111111';
  let stock = 6, enabled = false, placed = false;
  const product = {id:'22222222-2222-4222-8222-222222222222',name:'Donas',product_variants:[
    {id:variantId,sku:'DR-CHOCOLATE',name:'Chocolate',unit_price_cents:100,currency_code:'USD',available:true,remaining:stock,stock_initialized:true}
  ]};
  const ok = data => ({ok:true,data});
  const context = await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const body = route.request().postDataJSON?.() || {};
    let data;
    if(path==='/api/products') data={products:[{...product,product_variants:product.product_variants.map(v=>({...v,remaining:stock,available:enabled&&stock>0}))}],saleMode:{ordersEnabled:enabled,location:'UTP',etaMinutes:15}};
    else if(path==='/api/auth/session') data={accessToken:'test-admin-token',refreshToken:'test-refresh-token',expiresAt:new Date(Date.now()+3600000).toISOString()};
    else if(path==='/api/admin/stock'&&route.request().method()==='POST') {stock=body.quantity;data={stock:{variant_id:variantId,on_hand:stock,reserved:0,initialized:true}};}
    else if(path==='/api/admin/stock') data={stock:[{variant_id:variantId,on_hand:stock,reserved:0,initialized:true}]};
    else if(path==='/api/sale-mode'&&route.request().method()==='PATCH') {enabled=body.ordersEnabled;data={saleMode:{orders_enabled:enabled,location:body.location,eta_minutes:body.etaMinutes}};}
    else if(path==='/api/sale-mode') data={saleMode:{orders_enabled:enabled,location:'UTP',eta_minutes:15}};
    else if(path==='/api/admin/orders') data={orders:[]};
    else if(path==='/api/admin/health') data={health:{historicalCompletedWithoutSale:0,rejectedDeviceOperations:0,rejectedOtherOperations:0,receivedDeviceSales:0,activeReservations:0,uninitializedFlavors:0}};
    else if(path==='/api/admin/sync-operations') data={operations:[]};
    else if(path==='/api/customer/session') data={accessToken:'test-customer-token',linked:body.email!=='nuevo@example.test',expiresAt:new Date(Date.now()+3600000).toISOString()};
    else if(path==='/api/customer/register') data={message:'Revisa tu correo y vincula tu cliente.'};
    else if(path==='/api/customer/claim') {assert.equal(body.claimToken,'a'.repeat(64));data={customer:{public_id:'CTEST001'}};}
    else if(path==='/api/customer/profile') data={customer:{display_name:'Cliente de prueba'}};
    else if(path==='/api/customer/loyalty') data={account:{available_points:42,purchase_count:3}};
    else if(path==='/api/customer/orders') data={orders:placed?[{public_code:'DR-1234567890',status:'PENDING',payment_status:'PENDING',payment_method:'CASH',total_cents:100,created_at:new Date().toISOString()}]:[]};
    else if(path==='/api/orders'&&route.request().method()==='POST') {
      assert.equal(route.request().headers().authorization,'Bearer test-customer-token');
      assert.equal(body.items[0].productVariantId,variantId);
      placed=true;stock--;data={public_code:'DR-1234567890',status:'PENDING'};
    }
    else if(path==='/api/orders/DR-1234567890') data={order:{public_code:'DR-1234567890',status:'PENDING',payment_status:'PENDING'}};
    else if(path==='/api/customer/qr') data={qr:{token:'a'.repeat(64),expires_at:new Date(Date.now()+300000).toISOString()}};
    else data={};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(ok(data))});
  });
  const errors=[];
  const admin=await context.newPage(); admin.on('pageerror',e=>errors.push(`admin: ${e.message}`));
  await admin.goto(`${base}/admin.html`);
  await admin.locator('#email').fill('admin@example.test');
  await admin.locator('#password').fill('test-password');
  await admin.getByRole('button',{name:'Entrar'}).click();
  await admin.getByText('Chocolate · 6 libres').waitFor();
  await admin.locator('#stock input').fill('7');
  await admin.getByRole('button',{name:'Guardar conteo'}).click();
  await admin.getByText('Chocolate · 7 libres').waitFor();
  await admin.locator('#ordersEnabled').check();
  await admin.getByRole('button',{name:'Guardar modo'}).click();
  await admin.getByText('Modo venta actualizado.').waitFor();
  assert(enabled && stock===7);

  const customer=await context.newPage(); customer.on('pageerror',e=>errors.push(`customer: ${e.message}`));
  await customer.goto(`${base}/customer.html`);
  await customer.locator('#email').fill('customer@example.test');
  await customer.locator('#password').fill('test-password');
  await customer.getByRole('button',{name:'Iniciar sesión'}).click();
  await customer.getByText('42 puntos disponibles').waitFor();
  await customer.getByRole('button',{name:'Generar QR'}).click();
  await customer.locator('#qr svg').waitFor();
  await customer.locator('#qty-'+variantId).fill('1');
  await customer.locator('#deliveryPhone').fill('60150927');
  await customer.locator('#deliveryLocation').fill('UTP, Edificio 4');
  await customer.getByRole('button',{name:'Confirmar pedido'}).click();
  await customer.getByText('Pedido DR-1234567890 recibido.').waitFor();
  assert(placed);

  const catalog=await context.newPage(); catalog.on('pageerror',e=>errors.push(`catalog: ${e.message}`));
  await catalog.goto(`${base}/index.html`);
  await catalog.getByText('6 restantes').waitFor({timeout:10000});
  await catalog.getByRole('link',{name:/Pedir desde mi cuenta/}).click();
  await catalog.waitForURL('**/customer.html#delivery');
  const unlinked=await context.newPage();unlinked.on('pageerror',e=>errors.push(`unlinked: ${e.message}`));
  await unlinked.goto(`${base}/customer.html`);
  await unlinked.locator('#email').fill('nuevo@example.test');
  await unlinked.locator('#password').fill('test-password');
  await unlinked.getByRole('button',{name:'Iniciar sesión'}).click();
  await unlinked.getByText('Vincular mi cliente').waitFor();
  await unlinked.locator('#claimToken').fill('a'.repeat(64));
  await unlinked.getByRole('button',{name:'Vincular cuenta'}).click();
  await unlinked.getByRole('heading',{name:'Cliente de prueba'}).waitFor();
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS web smoke: admin stock/mode, authenticated delivery, account claim, customer points/QR, catalog remaining');
  await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1});
