const assert=require('node:assert/strict'),fs=require('node:fs');const {chromium}=require('playwright');
const base='http://127.0.0.1:8765';
const skus=['DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS'];
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try {for(const width of [360,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];let saves=0,revision=1,readFailure=false,conflict=false,catalogPosts=[],cancels=0;
  const enRoute={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',public_code:'DR-TEST',status:'OUT_FOR_DELIVERY',payment_status:'CONFIRMED',payment_method:'CASH',total_cents:100,customer_name_snapshot:'Prueba',created_at:'2026-10-13T12:00:00Z',order_items:[],delivery_location:'Edificio 4'};
  const flavors=skus.map((sku,i)=>({sku,name:sku,variant_id:`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${i}`,opening_quantity:i<2?20:0,purchased_quantity:0,sold_quantity:0,reserved_quantity:i===2?2:0,available_quantity:i<2?20:0,counted:i<2,has_count:i!==3}));
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.fulfill({body:''});
    const answer=data=>route.fulfill({json:{ok:true,data}}),failure=(code,status=500)=>route.fulfill({status,json:{ok:false,error:{code,message:'No se pudo completar la operación solicitada.'},correlationId:'test-reference-123'}});
    if(url.pathname==='/api/backend')return answer({ok:true,stats:{},config:{},ranking:[],clients:[]});
    if(url.pathname==='/api/admin/orders')return answer({orders:[enRoute]});
    if(url.pathname===`/api/admin/orders/${enRoute.id}/status`){assert.deepEqual(req.postDataJSON(),{status:'CANCELLED'});cancels++;enRoute.status='CANCELLED';return answer({order:enRoute});}
    if(url.pathname==='/api/admin/customers/inventory'){
      if(req.method()==='GET')return readFailure?failure('PGRST202'):answer({flavors,revision});
      saves++;const body=req.postDataJSON();assert.equal(body.expectedRevision,revision);assert.equal(Object.keys(body.counts).length,4);assert.equal(body.counts['DR-CHOCOLATE-CHISPAS'],0);
      if(saves===1)return failure('42703');if(conflict)return failure('INVENTORY_CONFLICT',409);
      for(const row of flavors){row.opening_quantity=body.counts[row.sku];row.has_count=true;row.counted=row.opening_quantity>=row.reserved_quantity;row.available_quantity=Math.max(0,row.opening_quantity-row.reserved_quantity);}revision++;readFailure=true;return answer({saved:true,revision});
    }
    if(url.pathname==='/api/admin/customers/catalog'){
      if(req.method()==='GET')return answer({flavors:flavors.map(row=>({id:row.variant_id,sku:row.sku,name:row.name,available:true,active:true,updated_at:'2026-10-12T10:00:00Z'}))});
      catalogPosts.push(req.postDataJSON());if(catalogPosts.length===1)return failure('TEMPORARY',503);
      assert.equal(catalogPosts[0].operationId,catalogPosts[1].operationId,'lost reply must reuse catalog operation');
      return answer({name:catalogPosts[1].name,available:false,updatedAt:'2026-10-12T10:01:00Z',replayed:true});
    }
    if(url.pathname.startsWith('/api/'))return answer({ranking:[],products:[],orders:[],redemptions:[]});
    return route.continue();
  });
  await page.goto(base);await page.evaluate(()=>{sessionStorage.setItem('donasAdminAccessToken','test-web-session');staffRole='ADMIN';return showAdmin()});
  await page.locator('#count-DR-CHOCOLATE').waitFor();
  assert.equal(await page.locator('#count-DR-CHOCOLATE-CHISPAS').inputValue(),'0','saved zero must not be only a placeholder');
  assert.match(await page.locator('#adminFlavorInventory').textContent(),/Faltan 2/);
  assert.equal(await page.locator('#count-DR-VAINILLA-CHISPAS').inputValue(),'','unrecorded count stays empty');
  assert.equal(await page.locator('#reviewInventoryButton').isVisible(),false);
  for(const sku of skus)await page.locator('#count-'+sku).fill(sku==='DR-CHOCOLATE'?'25':sku==='DR-VAINILLA'?'20':'0');
  await page.evaluate(()=>loadAdminInventory());assert.equal(await page.locator('#count-DR-CHOCOLATE').inputValue(),'25');assert.equal(await page.locator('#count-DR-CHOCOLATE-CHISPAS').inputValue(),'0');
  revision++;await page.evaluate(()=>loadAdminInventory());assert.equal(await page.locator('#saveInventoryButton').isDisabled(),true);
  assert.equal(await page.locator('#count-DR-CHOCOLATE').inputValue(),'25');await page.locator('#reviewInventoryButton').click();assert.equal(await page.locator('#saveInventoryButton').isDisabled(),false);
  await page.locator('#saveInventoryButton').click();await page.waitForFunction(()=>!adminInventorySaving);
  assert.match(await page.locator('#adminInventoryNotice').textContent(),/42703.*test-reference/);
  assert.equal(await page.locator('#count-DR-CHOCOLATE').inputValue(),'25','failed write preserves draft');
  await page.locator('#saveInventoryButton').evaluate(button=>{button.click();button.click()});await page.waitForFunction(()=>!adminInventorySaving);
  assert.equal(saves,2,'double click sends one count');assert.match(await page.locator('#adminInventoryNotice').textContent(),/servidor guardó/);
  assert.equal(await page.locator('#saveInventoryButton').isDisabled(),true,'after committed save plus failed refresh, stale revision cannot write');
  readFailure=false;await page.evaluate(()=>loadAdminInventory());assert.equal(await page.locator('#count-DR-CHOCOLATE-CHISPAS').inputValue(),'0','committed zero survives a fresh server read');for(const sku of skus)await page.locator('#count-'+sku).fill(sku==='DR-CHOCOLATE'?'25':sku==='DR-VAINILLA'?'20':'0');
  conflict=true;await page.locator('#saveInventoryButton').click();await page.waitForFunction(()=>!adminInventorySaving);
  assert.match(await page.locator('#adminInventoryNotice').textContent(),/Conservamos tus cantidades/);assert.equal(await page.locator('#count-DR-CHOCOLATE').inputValue(),'25');
  const cancel=page.locator('#adminOrdersList button[data-status=CANCELLED]');await cancel.click();await page.getByRole('dialog').getByRole('button',{name:'Volver',exact:true}).click();assert.equal(cancels,0);
  await cancel.click();assert.match(await page.getByRole('dialog').textContent(),/no reembolsa/);await page.getByRole('dialog').getByRole('button',{name:'Cancelar pedido',exact:true}).click();await page.waitForFunction(()=>adminOrders[0]?.status==='CANCELLED');assert.equal(cancels,1);assert.equal(enRoute.payment_status,'CONFIRMED');
  const form=page.locator('#adminFlavorCatalog form').first();await form.locator('input[name=name]').fill('Chocolate web');await form.locator('input[name=available]').uncheck();
  await form.locator('button').click();await page.waitForFunction(()=>!document.querySelector('#adminFlavorCatalog button').disabled);
  await form.locator('button').click();await form.getByText('✓ Sabor guardado.').waitFor();assert.equal(catalogPosts.length,2);assert.equal(catalogPosts[1].available,false);
  assert.equal(await page.locator('#staffDevicesPanel').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.reload();await page.evaluate(()=>{sessionStorage.setItem('donasAdminAccessToken','test-web-session');staffRole='ADMIN';return showAdmin()});await page.locator('#count-DR-CHOCOLATE').waitFor();assert.equal(await page.locator('#count-DR-CHOCOLATE-CHISPAS').inputValue(),'0','saved zero survives full reload');
  assert.deepEqual(errors,[]);fs.mkdirSync('test-output/web-only',{recursive:true});await page.screenshot({path:`test-output/web-only/admin-${width}.png`,fullPage:true});await page.close();
}}finally{await browser.close();}
console.log('PASS admin browser 360/768/1440: counts/errors/revisions, single submit, preserved draft, catalog retry and no mobile UI');
})().catch(e=>{console.error(e);process.exitCode=1});
