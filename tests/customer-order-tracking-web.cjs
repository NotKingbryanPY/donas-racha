// Real DOM and timers, simulated providers. No production orders or notifications.
const assert=require('node:assert/strict');const fs=require('node:fs');const {chromium}=require('playwright');
const base=process.env.TEST_URL || 'http://127.0.0.1:8765';
const variant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',A='DR-A12BC34DE5',B='DR-B12BC34DE5',C='DR-C12BC34DE5';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const waitText=(page,selector,text)=>page.waitForFunction(({selector,text})=>document.querySelector(selector)?.textContent.includes(text),{selector,text});
const makeOrder=(code,status='PENDING')=>({id:code===A?'11111111-1111-4111-8111-111111111111':code===B?'22222222-2222-4222-8222-222222222222':'33333333-3333-4333-8333-333333333333',
 public_code:code,status,payment_method:'YAPPY',payment_status:'PENDING',currency_code:'USD',total_cents:400,
 delivery_location:'Entrada principal, Edificio 4',created_at:'2026-09-01T10:00:00Z',updated_at:'2026-10-18T10:00:00.123456Z',
 order_items:[{variant_name_snapshot:'Chocolate',quantity:2,unit_price_cents:100,line_total_cents:200},{variant_name_snapshot:'Vainilla con chispas',quantity:2,unit_price_cents:100,line_total_cents:200}],
 order_events:[{to_status:'PENDING',created_at:'2026-09-01T10:00:00Z'}]});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  fs.mkdirSync('test-output/drachas',{recursive:true});
  for(const width of [320,390,768]){
   const ctx=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   const client={id:'CDRACHAS123',username:'ana.demo',name:'Ana',pointsAvailable:150,pointsTotal:250,currentStreak:2,shopItems:[],recentHistory:[]};
   let orders=[makeOrder(A),makeOrder(B,'ACCEPTED')],lists=0,catalog=0,posts=0,reject=true,denyReads=false,readGate=null;
   await ctx.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),query=url.searchParams;
    const answer=data=>route.fulfill({json:{ok:true,data}});
    if(url.origin!==new URL(base).origin)return route.fulfill({body:'',contentType:'text/javascript'});
    if(url.pathname==='/api/customer/session')return answer({accessToken:'customer-fixture',customer:{publicId:client.id,username:client.username}});
    if(url.pathname==='/api/backend')return answer({ok:true,client});
    if(url.pathname==='/api/customer/onboarding')return answer({progress:{status:'COMPLETED',last_step:7}});
    if(url.pathname==='/api/products'){
     if(query.get('view')==='realtime')return answer({enabled:false});catalog++;
     return query.get('view')==='inventory'?answer({enforced:true,flavors:[{variant_id:variant,name:'Chocolate',offered:true,counted:true,available_quantity:30}]}):answer({products:[{name:'Donas',product_variants:[{id:variant,name:'Chocolate',available:true,unit_price_cents:100,currency_code:'USD'}]}]});
    }
    if(url.pathname==='/api/customer/orders'){
     if(denyReads)return route.fulfill({status:401,json:{ok:false,error:{code:'AUTH_REQUIRED',message:'Revisa tu sesión.'}}});
     lists++;const snapshot=structuredClone(orders);const gate=readGate;readGate=null;if(gate){gate.resolve.started?.();await gate.promise;}
     const active=snapshot.filter(o=>['PENDING','ACCEPTED','OUT_FOR_DELIVERY'].includes(o.status));
     const history=snapshot.filter(o=>!['PENDING','ACCEPTED','OUT_FOR_DELIVERY'].includes(o.status));
     return answer({orders:[...active,...(query.get('view')==='active'?[]:history)],activeOrders:active,historyOrders:history,historyIncluded:query.get('view')!=='active',hasMoreActive:false,hasMoreHistory:false});
    }
    if(url.pathname==='/api/orders' && req.method()==='POST'){
     posts++;if(reject)return route.fulfill({status:400,json:{ok:false,error:{code:'VALIDATION_ERROR',message:'Revisa el punto de entrega.'}}});
     const order=makeOrder(C);order.total_cents=100;order.order_items=[{variant_name_snapshot:'Chocolate',quantity:1,unit_price_cents:100,line_total_cents:100}];orders.push(order);return answer({...order,replayed:false});
    }
    if(url.pathname.startsWith('/api/orders/')){const order=orders.find(o=>o.public_code===url.pathname.split('/').pop());return order?answer({order:structuredClone(order)}):route.fulfill({status:404,json:{ok:false,error:{code:'ORDER_NOT_FOUND',message:'Pedido no encontrado'}}});}
    if(url.pathname.startsWith('/api/'))return answer({ranking:[],products:[]});
    return route.continue();
   });
   await page.goto(base+'/?profile=1');await page.locator('#userClientIdInput').fill(client.username);await page.locator('#userEnterBtn').click();
   await page.waitForFunction(()=>openedAsUser && currentClient);
   await page.locator('#customerActiveOrderBanner').waitFor({state:'visible'});
   assert.equal(await page.title(),'Drachas · Tu antojo tiene recompensas');assert.equal(await page.locator('#customerOrderCount').textContent(),'2');
   assert.equal(await page.locator('#customerOrderNotice').isVisible(),false,'initial snapshot is silent');
   await page.locator('#client-top-delivery').click();await page.locator('#clientFlavorList button[aria-label="Añadir Chocolate"]').waitFor();
   assert.equal(await page.locator('.customer-order-card').count(),2);
   const positions=await page.evaluate(()=>({tracking:document.getElementById('clientActiveOrders').getBoundingClientRect().top,form:document.querySelector('.customer-new-order').getBoundingClientRect().top}));assert(positions.tracking<positions.form);
   await page.locator('#clientFlavorList button[aria-label="Añadir Chocolate"]').click();await page.locator('#clientDeliveryLocation').fill('Entrada principal, Edificio 4');
   const beforeCatalog=catalog;orders[0].status='OUT_FOR_DELIVERY';orders[0].updated_at='2026-10-18T10:01:00.123456Z';
   if(width===390)await page.waitForFunction(code=>document.querySelector(`[data-order-code="${code}"]`)?.dataset.status==='OUT_FOR_DELIVERY',A,{timeout:22000});
   else await page.evaluate(()=>DonasCustomerOrders.refresh());
   await waitText(page,'#customerOrderNoticeText','En camino');
   assert.equal(await page.locator('#clientDeliveryLocation').inputValue(),'Entrada principal, Edificio 4');
   assert.equal(await page.evaluate(()=>customerOrderQuantities.values().next().value),1);assert.equal(catalog,beforeCatalog,'tracking must not reload catalog or form');
   await page.locator('#customerOrderNotice button').click();await page.evaluate(()=>DonasCustomerOrders.refresh());assert.equal(await page.locator('#customerOrderNotice').isVisible(),false,'same status cannot repeat its notice');
   await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`test-output/drachas/tracking-${width}.png`,fullPage:true});
   await ctx.setOffline(true);await waitText(page,'#customerOrdersStatus','Sin conexión');const beforeOffline=lists;
   orders[0].status='CANCELLED';orders[0].updated_at='2026-10-18T10:02:00.123456Z';await page.waitForTimeout(300);assert.equal(lists,beforeOffline);
   assert.equal(await page.locator(`[data-order-code="${A}"]`).getAttribute('data-status'),'OUT_FOR_DELIVERY','offline state must remain labelled as the last read');
   await ctx.setOffline(false);await waitText(page,'#customerOrderNoticeText','Cancelado');assert.equal(await page.locator('#customerOrderCount').textContent(),'1');
   await page.locator('#customerOrderHistory summary').click();await page.locator(`#clientOrdersList [data-view-order="${A}"]`).click();
   await waitText(page,'#confirmedOrderTitle','Pedido cancelado');assert.equal(await page.locator('.confirmation-stage').isVisible(),false);assert.equal(await page.locator('#clientOrderConfirmation').evaluate(el=>el.classList.contains('animate-confirmation')),false);
   assert((await page.locator('#confirmedOrderDetails').textContent()).includes('Chocolate'));assert(new URL(page.url()).searchParams.get('order')===A);
   await page.reload();await waitText(page,'#confirmedOrderTitle','Pedido cancelado');assert.equal(await page.locator('#clientOrderConfirmation').evaluate(el=>el.classList.contains('animate-confirmation')),false);
   await page.locator('#clientOrderConfirmation .dialog-close').click();await page.waitForFunction(()=>!new URL(location.href).searchParams.has('order'));
   await page.locator(`[data-view-order="${B}"]`).click();await waitText(page,'#confirmedOrderTitle','Tu pedido');await page.goBack();await page.locator('#clientOrderConfirmation').waitFor({state:'hidden'});
   orders[1].status='COMPLETED';orders[1].payment_status='CONFIRMED';orders[1].updated_at='2026-10-18T10:03:00.123456Z';
   await page.evaluate(()=>DonasCustomerOrders.refresh());assert.equal(await page.locator('#customerOrderCount').isVisible(),false);
   const stopped=lists;await page.waitForTimeout(width===390?16000:350);assert.equal(lists,stopped,'terminal-only list stops its polling loop');
   await page.locator('#clientFlavorList button[aria-label="Añadir Chocolate"]').click();await page.locator('#clientDeliveryLocation').fill('Entrada principal, Edificio 4');
   await page.locator('#clientOrderButton').click();await waitText(page,'#clientOrderMessage','Revisa el punto');await page.waitForFunction(()=>!customerOrderSubmitting);
   assert.equal(await page.evaluate(()=>!!DonasOrderFeedback.read()?.pending),false,'400 validation rejection releases the attempt');assert.equal(await page.locator('#clientOrderRetry').isVisible(),false);
   reject=false;await page.locator('#clientOrderButton').click();await waitText(page,'#confirmedOrderTitle','¡Pedido realizado!');await waitText(page,'#confirmedOrderDetails','Chocolate');
   assert.equal(posts,2);assert((await page.locator('#confirmedOrderState').textContent()).includes('pago pendiente'));
   const wa=new URL(await page.locator('#confirmedOrderWhatsapp').getAttribute('href'));assert.equal(wa.pathname,'/50760887856');assert(wa.searchParams.get('text').includes('Drachas'));assert(wa.searchParams.get('text').includes(C));
   assert.equal(await page.locator('#clientOrderConfirmation').evaluate(el=>getComputedStyle(el.querySelector('.confirmation-donut')).animationName),'none');
   await page.screenshot({path:`test-output/drachas/receipt-${width}.png`});
   await page.locator('#clientOrderConfirmation .dialog-close').click();await page.evaluate(()=>DonasCustomerOrders.refresh());
   denyReads=true;await page.evaluate(()=>DonasCustomerOrders.refresh());
   assert(!(await page.locator('#clientActiveOrders').textContent()).includes(C),'a rejected session hides the private snapshot');
   assert.equal(await page.locator('#customerOrderNotice').isVisible(),false);
   denyReads=false;await page.evaluate(()=>DonasCustomerOrders.refresh());
   assert((await page.locator('#clientActiveOrders').textContent()).includes(C),'a verified retry restores cards even when their contents did not change');
   // A late read from the old account cannot repopulate private UI after logout.
   readGate=deferred();const gate=readGate;const late=page.evaluate(()=>DonasCustomerOrders.refresh({force:true}));
   await page.waitForFunction(()=>document.getElementById('clientActiveOrders').getAttribute('aria-busy')==='true');
   await page.evaluate(()=>clientGoBack());gate.resolve();await late;
   assert(!(await page.locator('#clientActiveOrders').textContent()).includes(C));assert.equal(await page.locator('#customerOrderCount').isVisible(),false);
   assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await ctx.close();console.log(`PASS Drachas ${width}px: active orders, notices, offline recovery, private deep links, receipt, validation recovery and logout`);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
