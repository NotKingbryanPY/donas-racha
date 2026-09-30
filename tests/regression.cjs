// Run with Playwright installed in your development environment (not a production dependency).
// Start: python -m http.server 8765; then: node tests/regression.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEST_URL || 'http://127.0.0.1:8765';
const out = process.env.TEST_OUTPUT || '/tmp/donas-racha-qa';
fs.mkdirSync(out,{recursive:true});
const fixture = () => ({id:'C-DEMO',username:'cliente.demo',name:'Cliente de prueba con nombre largo',whatsapp:'60000000',registrationDate:'2026-08-01',levelEmoji:'🥉',levelName:'Bronce',pointsTotal:190,pointsAvailable:190,totalPurchases:19,currentStreak:6,nextPurchasePoints:15,progressLevelPct:95,pointsToNextLevel:10,nextLevel:{name:'Plata',emoji:'🥈'},purchasesToday:0,dailyPurchaseLimit:3,hitosRacha:[3],badges:[{emoji:'⭐',name:'Cliente frecuente'}],recentHistory:[{type:'purchase',date:'2026-09-15T12:00:00Z',points:12}],pointsRules:[{points:10,label:'Racha 1–2'},{points:12,label:'Racha 3+'},{points:15,label:'Racha 7+'},{points:17,label:'Racha 14+'}],shopItems:[{id:'R1',emoji:'🍩',name:'Dona de recompensa',description:'Un antojo para celebrar tu constancia.',cost:100},{id:'R2',emoji:'🎁',name:'Recompensa con un nombre considerablemente largo para verificar el diseño',description:'Descripción extensa sin cortar los controles de canje.',cost:500}],recentRedemptions:[]});
(async()=>{
 const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const results=[];
 try {
 for (const width of (process.env.TEST_WIDTHS || '360,390,412,768,1440').split(',').map(Number)) {
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage(); let client=fixture(); const requests=[],errors=[]; let adminResponseLost=true; const adminKeys=new Set();
  const flavors=['DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS'].map((sku,i)=>({variant_id:`00000000-0000-4000-8000-00000000000${i}`,sku,name:['Chocolate','Vainilla','Chocolate con chispas','Vainilla con chispas'][i],counted:true,opening_quantity:4,purchased_quantity:0,sold_quantity:0,reserved_quantity:1,available_quantity:3}));
  const order={id:'10000000-0000-4000-8000-000000000001',public_code:'DR-TEST',customer_name_snapshot:'Cliente de prueba',customer_phone_snapshot:'60000000',status:'PENDING',payment_method:'YAPPY',payment_status:'PENDING',total_cents:200,created_at:new Date().toISOString(),delivery_location:'Edificio 4 · entrada principal',order_items:[{quantity:2,variant_name_snapshot:'Chocolate'}]};
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if((u.hostname==='127.0.0.1'||u.hostname==='localhost')&&u.pathname.startsWith('/api/')) {
    const data=req.method()==='POST'?JSON.parse(req.postData()||'{}'):Object.fromEntries(u.searchParams);
    requests.push({...data,path:u.pathname});
    if(u.pathname==='/api/auth/session') {
     return route.fulfill(data.password==='demo1234'||data.grantType==='refresh_token'
      ?{json:{ok:true,data:{accessToken:'admin-token',refreshToken:'refresh-token',role:'ADMIN',expiresAt:new Date(Date.now()+3600000).toISOString()}}}
      :{status:401,json:{ok:false,error:{code:'INVALID_CREDENTIALS',message:'Credenciales incorrectas'}}});
    }
    if(u.pathname==='/api/customer/session' && data.username==='LOCKED' && !data.password) return route.fulfill({status:401,json:{ok:false,error:{code:'PASSWORD_REQUIRED',message:'Escribe tu contraseña'}}});
    if(u.pathname==='/api/customer/session' && data.username==='UNSET') return route.fulfill({status:401,json:{ok:false,error:{code:'PASSWORD_SETUP_REQUIRED',message:'Primero crea una contraseña para activar tu perfil.'}}});
    if(u.pathname==='/api/customer/session') return route.fulfill(data.username==='INVALID'
     ?{status:404,json:{ok:false,error:{code:'CUSTOMER_NOT_FOUND',message:'ID no encontrado'}}}
     :{json:{ok:true,data:{accessToken:'customer-token',customer:{publicId:client.id,username:client.username}}}});
    if(u.pathname==='/api/customer/activation') return route.fulfill({json:{ok:true,data:data.action==='start'
      ?{sent:true,maskedPhone:'••••1111'}
      :{accessToken:'new-customer-token',customer:{publicId:client.id,username:client.username}}}});
    if(u.pathname==='/api/customer/onboarding') return route.fulfill({json:{ok:true,data:{progress:{status:'COMPLETED',last_step:7}}}});
    if(u.pathname==='/api/ranking') return route.fulfill({json:{ok:true,data:{ranking:[client,{...client,id:'C2',name:'Segundo cliente'},{...client,id:'C3',name:'Tercer cliente'}]}}});
    if(u.pathname==='/api/products') return route.fulfill({json:{ok:true,data:u.searchParams.get('view')==='inventory'?{flavors,enforced:true}:{products:[{name:'Donas',product_variants:flavors.map(f=>({id:f.variant_id,sku:f.sku,name:f.name,available:true,unit_price_cents:100,currency_code:'USD'}))}]}}});
    if(u.pathname==='/api/admin/customers/inventory') return route.fulfill({json:{ok:true,data:req.method()==='GET'?{flavors}:{saved:true}}});
    if(u.pathname==='/api/admin/orders') return route.fulfill({json:{ok:true,data:{orders:[order]}}});
    if(u.pathname.endsWith('/status')) {order.status=data.status;if(data.paymentReceived)order.payment_status='CONFIRMED';return route.fulfill({json:{ok:true,data:{order}}});}
    if(u.pathname==='/api/customer/orders') return route.fulfill({json:{ok:true,data:{orders:[]}}});
    let response={ok:true};
    switch(data.action){
     case 'buscarCliente':response={ok:true,clients:data.q==='nadie'?[]:[client]};break;
     case 'getCliente':response={ok:true,client};break;
     case 'registrarCompra':client={...client,pointsTotal:205,pointsAvailable:205,totalPurchases:20,currentStreak:7,levelName:'Plata',levelEmoji:'🥈',hitosRacha:[3,7],progressLevelPct:2,purchasesToday:1};response={ok:true,client,pointsEarned:15};break;
     case 'canjearRecompensa':client={...client,pointsAvailable:client.pointsAvailable-100,recentRedemptions:[{itemName:'Dona de recompensa',points:100,date:'2026-09-16',status:'pendiente'}]};response={ok:true,client};break;
     case 'nuevoCliente':response={ok:true,client:{...client,name:data.name}};break;
     case 'getAdminDashboard':response={ok:true,clients:[client],ranking:[client],stats:{today:2,week:10,month:30,totalClients:4,pointsDelivered:300,rewardsDelivered:2,migrationComplete:true},config:{DIAS_TOLERANCIA:3,PRECIO_DONA:1,PUNTOS_RACHA_BASE:10,PUNTOS_RACHA_3:12,PUNTOS_RACHA_7:15,PUNTOS_RACHA_14:17}};break;
     case 'getAdminLoyaltyHistory':response={ok:true,changes:[]};break;
     case 'adminAdjustLoyalty':
      if(!adminKeys.has(data.idempotencyKey)){
       adminKeys.add(data.idempotencyKey);
       if(data.kind==='HISTORICAL_PURCHASES') client={...client,totalPurchases:client.totalPurchases+data.amount,pointsTotal:client.pointsTotal+10*data.amount,pointsAvailable:client.pointsAvailable+10*data.amount};
      }
      if(adminResponseLost){adminResponseLost=false;return route.abort('failed');}
      response={ok:true,adjustment:{replayed:true},client};break;
     case 'saveConfig':response={ok:true,config:data.config};break;
    }
    return route.fulfill({json:{ok:true,data:response}});
   }
   if(u.hostname==='127.0.0.1'||u.hostname==='localhost') return route.continue();
   if(req.url().includes('confetti')) return route.fulfill({contentType:'text/javascript',body:'window.__confetti=0;window.confetti=()=>window.__confetti++;'});
   return route.abort();
  });
  const noOverflow=async label=>{
   await page.waitForTimeout(350);
   const overflow=await page.evaluate(()=>{const root=document.querySelector('.overlay:not(.hidden)')||document.documentElement;return {client:root.clientWidth,scroll:root.scrollWidth};});
   assert(overflow.scroll<=overflow.client+1,`${width} ${label} overflow ${JSON.stringify(overflow)}`);
  };
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(700);
  await noOverflow('landing');
  assert(await page.locator('#screen-home').evaluate(el=>el.inert));
  await page.screenshot({path:path.join(out,`landing-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Ranking',exact:true}).click();
  await page.waitForSelector('#rankingList .rank-item');await noOverflow('ranking');
  await page.evaluate(()=>rankingBack());
  await page.getByRole('button',{name:'Entrar a mi perfil'}).click();
  await noOverflow('client login');
  await page.locator('#userClientIdInput').fill('INVALID');await page.locator('#userEnterBtn').click();
  await page.waitForFunction(()=>!document.getElementById('userOverlay').classList.contains('hidden'));
  await page.locator('#userClientIdInput').fill('C-DEMO');await page.locator('#userEnterBtn').click();
  await page.waitForFunction(()=>document.getElementById('clientPoints').textContent==='190');
  assert.equal(await page.locator('#buyBtn').isVisible(),false);
  assert.equal(await page.locator('.progress-track').getAttribute('aria-valuenow'),'95');
  await noOverflow('profile');await page.screenshot({path:path.join(out,`profile-${width}.png`),fullPage:true});
  assert((await page.locator('#nextReward').textContent()).includes('Ya puedes canjearlo'));
  assert.equal(await page.locator('.reward-track').getAttribute('aria-valuenow'),'100','progress capped at actual reward cost');
  assert.equal(await page.locator('#featuredBadges .achievement').count(),1,'do not invent badges to fill the mockup');
  await page.getByRole('button',{name:'Mis datos',exact:true}).click();
  assert(await page.locator('#clientDetailsDialog').evaluate(el=>el.open));
  assert.equal(await page.locator('#profileName').textContent(),fixture().name);
  assert.equal(await page.locator('#profilePhone').textContent(),fixture().whatsapp);
  assert.equal(await page.locator('#profileId').textContent(),fixture().username);
  assert((await page.locator('#profileRegistered').textContent()).includes('2026'));
  await noOverflow('profile details dialog');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Cambiar contraseña',exact:true}).click();
  assert(await page.locator('#customerNewPassword').isVisible());
  await noOverflow('password dialog');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Ver todos',exact:false}).click();
  assert(await page.locator('#clientBadgesDialog').evaluate(el=>el.open));await page.keyboard.press('Escape');
  await page.locator('#clientProfileSection .profile-details summary').click();assert(await page.locator('#hitosWrap').isVisible());await page.locator('#clientProfileSection .profile-details summary').click();
  await page.evaluate(()=>renderClient({...currentClient,pointsAvailable:25,badges:[],recentHistory:[],shopItems:[]},true));
  assert((await page.locator('#nextReward').textContent()).includes('Aún no hay premios'));
  assert.equal(await page.locator('#featuredBadges .achievement').count(),0);
  assert((await page.locator('#recentPurchases').textContent()).includes('Todavía no'));
  await noOverflow('empty profile');
  await page.evaluate(()=>renderClient({...currentClient,pointsAvailable:25},true));
  assert((await page.locator('#nextReward').textContent()).includes('Te faltan 75 puntos'));
  await page.evaluate(()=>renderClient({...currentClient,recentHistory:[{type:'purchase',entryType:'OPENING_BALANCE',points:100,date:'2026-09-01'}]},true));
  assert.equal(await page.locator('#recentPurchases .recent-purchase').count(),0,'a migrated balance is not a purchase');
  assert((await page.locator('#historyWrap').textContent()).includes('Saldo migrado'));
  await page.evaluate(()=>renderClient(currentClient,true));
  await page.locator('#client-top-delivery').click();await page.waitForSelector('#clientFlavorList .cart-row');
  assert.equal(await page.locator('#clientFlavorList .cart-row').count(),4);
  assert(requests.some(r=>r.view==='inventory'),'inventory query must be passed correctly');
  await noOverflow('delivery');await page.screenshot({path:path.join(out,`delivery-${width}.png`),fullPage:true});
  await page.locator('#client-top-profile').click();
  for(const type of ['ranking','shop','history']) {
   await page.locator('#client-tab-'+type).click();await noOverflow(type);
   if(type==='shop'){
    assert(await page.locator('.shop-buy').nth(1).isDisabled());
    page.once('dialog',dialog=>dialog.accept());await page.locator('.shop-buy').first().click();
    await page.waitForFunction(()=>document.getElementById('shopAvailablePoints').textContent==='90');
    assert((await page.locator('#nextReward').textContent()).includes('Te faltan 10 puntos'),'preview updates after spending points');
    await page.screenshot({path:path.join(out,`shop-${width}.png`),fullPage:true});
   }
  }
  await page.locator('#client-tab-ranking').click();
  for(const type of ['compras','puntos','racha','nivel']){await page.locator('#client-rank-tab-'+type).click();await page.waitForTimeout(50);}
  await page.evaluate(()=>goToRoleScreen());await page.getByRole('button',{name:'Acceso de vendedores'}).click();
  await page.locator('#loginEmail').fill('seller@example.test');
  await page.locator('#loginInput').fill('wrong');await page.locator('#loginBtn').click();await page.waitForFunction(()=>document.getElementById('loginError').style.display==='block');
  await page.locator('#loginInput').fill('demo1234');await page.locator('#loginBtn').click();await page.waitForFunction(()=>sessionStorage.getItem('donasAdminAccessToken')==='admin-token');
  await noOverflow('seller home');
  await page.locator('#searchInput').fill('nadie');await page.locator('#searchInput').press('Enter');await page.waitForFunction(()=>document.getElementById('searchResults').textContent==='Sin resultados');
  await page.locator('#searchInput').fill('Cliente');await page.locator('#searchInput').press('Enter');await page.waitForSelector('.result-item');
  await page.locator('.result-item').click();await page.waitForSelector('#buyBtn:visible');
  const before=await page.evaluate(()=>window.__confetti);await page.locator('#buyBtn').click();await page.waitForFunction(()=>document.getElementById('clientPoints').textContent==='205');
  assert.equal(await page.locator('#clientStreak').textContent(),'7');assert.equal(await page.locator('#buyBtn').isDisabled(),false);assert.equal(await page.evaluate(()=>window.__confetti),before+1);
  assert((await page.locator('#alreadyMsg').textContent()).includes('1 de 3'));
  await page.evaluate(()=>goHome());await page.evaluate(()=>openClient('C-DEMO',false));
  await page.waitForFunction(()=>document.getElementById('screen-client').classList.contains('active'));
  await page.evaluate(()=>showScreen('screen-new'));await page.locator('#newName').fill('Nuevo de prueba');await page.locator('#newWhatsapp').fill('+50760001111');await page.locator('#createBtn').click();await page.waitForSelector('#newClientCard:visible');assert((await page.locator('#newClientId').textContent()).length>0);await noOverflow('registration');
  await page.evaluate(()=>showAdmin());await page.waitForFunction(()=>document.getElementById('sToday').textContent==='2');await noOverflow('admin');await page.screenshot({path:path.join(out,`admin-${width}.png`),fullPage:true});
  await page.locator('#adminClientFilter').fill('C-DEMO');assert.equal(await page.locator('#adminClients tbody tr').count(),1);
  await page.getByRole('button',{name:'Ajustar',exact:true}).click();
  assert((await page.locator('#adminLoyaltySummary').textContent()).includes('C-DEMO'));
  await page.locator('#adminLoyaltyAmount').fill('2');
  await page.locator('#adminLoyaltyReason').fill('Compras previas prometidas');
  await page.locator('#adminLoyaltyDialog').screenshot({path:path.join(out,`loyalty-adjustment-${width}.png`)});
  await page.locator('#adminLoyaltySave').click();
  await page.waitForFunction(()=>document.getElementById('adminLoyaltyNotice').textContent.includes('No se confirmó'));
  await page.locator('#adminLoyaltySave').click();
  await page.waitForFunction(()=>document.getElementById('adminLoyaltyNotice').textContent.includes('no se duplicó'));
  const adjustments=requests.filter(r=>r.action==='adminAdjustLoyalty');
  assert.equal(adjustments.length,2);assert.equal(adjustments[0].idempotencyKey,adjustments[1].idempotencyKey,'retry must use the same operation');
  assert.equal(client.totalPurchases,22,'lost response must not double-count purchases');
  await noOverflow('admin loyalty dialog');
  await page.locator('#adminLoyaltyKind').selectOption('STREAK');
  await page.locator('#adminLoyaltyAmount').fill('3');
  assert(await page.locator('#adminLoyaltyDate').isVisible());
  await page.locator('#adminLoyaltyKind').selectOption('POINTS');
  assert.equal(await page.locator('#adminLoyaltyDate').isVisible(),false);
  await page.locator('#adminLoyaltyDialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.locator('#adminInventoryPanel').screenshot({path:path.join(out,`inventory-${width}.png`)});
  for(const flavor of flavors) await page.locator('#count-'+flavor.sku).fill('6');
  await page.locator('#saveInventoryButton').click();await page.waitForFunction(()=>document.getElementById('adminInventoryNotice').textContent.includes('Inventario guardado'));
  assert.equal(requests.find(r=>r.counts)?.counts['DR-CHOCOLATE'],6);
  await page.getByRole('button',{name:'Aceptar pedido',exact:true}).click();
  await page.getByRole('button',{name:'Voy en camino',exact:true}).click();
  await page.getByRole('button',{name:'Cobrado y entregado',exact:true}).click();
  await page.getByRole('button',{name:'Sí, finalizar',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('adminOrdersList').textContent.includes('Todo al día'));
  assert(requests.some(r=>r.status==='COMPLETED'&&r.paymentReceived===true&&r.paymentMethod==='YAPPY'));
  await page.getByRole('button',{name:'Guardar config'}).click();await page.waitForTimeout(100);
  const saved=requests.find(r=>r.action==='saveConfig');assert(saved);assert.equal(saved.config.PRECIO_DONA,'1');
  await page.evaluate(()=>logout());assert.equal(await page.evaluate(()=>sessionStorage.getItem('donasAdminAccessToken')),null);
  await page.evaluate(()=>goToUserLogin());await page.locator('#userClientIdInput').fill('LOCKED');await page.locator('#userEnterBtn').click();
  await page.waitForSelector('#userPasswordInput:visible');assert.equal(await page.locator('#userEnterBtn').getAttribute('aria-busy'),null);
  await page.locator('#userPasswordInput').fill('client-password');await page.locator('#userEnterBtn').click();
  await page.waitForFunction(()=>customerLoginController===null && document.getElementById('screen-client').classList.contains('active'));
  await page.evaluate(()=>goToUserLogin());await page.locator('#userClientIdInput').fill('UNSET');await page.locator('#userEnterBtn').click();
  await page.locator('#customerActivation').waitFor({state:'visible'});
  await page.locator('#sendActivationCode').click();await page.locator('#customerActivationFields').waitFor({state:'visible'});
  await page.locator('#activationCode').fill('123456');await page.locator('#activationPassword').fill('new-password-123');
  await page.locator('#completeActivationButton').click();
  await page.waitForFunction(()=>openedAsUser && document.getElementById('userOverlay').classList.contains('hidden'));
  assert(requests.some(r=>r.path==='/api/customer/activation'&&r.action==='complete'&&r.username==='UNSET'));
  await page.goto(`${base}/?profile=1&id=C-DEMO`);
  assert.equal(await page.locator('#userScanBtn').count(),0,'customer camera control must stay hidden');
  await page.waitForFunction(()=>openedAsUser && document.getElementById('userOverlay').classList.contains('hidden') && document.getElementById('screen-client').classList.contains('active'));
  assert.equal(new URL(page.url()).searchParams.get('view'),'profile');
  assert.equal(new URL(page.url()).searchParams.has('id'),false,'private profile URL does not expose technical ID');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);assert(await page.locator('html').evaluate(el=>el.classList.contains('motion-lite')));
  const count=await page.evaluate(()=>window.__confetti);await page.evaluate(()=>confettiBurst());assert.equal(await page.evaluate(()=>window.__confetti),count);
  assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
  assert.deepEqual(errors,[],`${width} console errors`);
  results.push({width,passed:true,requests:requests.length,consoleErrors:errors});
  await context.close();
 }
 // Data-saver branch before initial render.
 const context=await browser.newContext();const page=await context.newPage();
 await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true,effectiveType:'4g'}}));
 await page.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 await page.goto(base);assert(await page.locator('html').evaluate(el=>el.classList.contains('motion-lite')));await context.close();
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({passed:true,results,output:out},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
