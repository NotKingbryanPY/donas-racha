// Run with Playwright installed in your development environment (not a production dependency).
// Start: python -m http.server 8765; then: node tests/regression.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEST_URL || 'http://127.0.0.1:8765';
const out = process.env.TEST_OUTPUT || '/tmp/donas-racha-qa';
fs.mkdirSync(out,{recursive:true});
const fixture = () => ({id:'C-DEMO',name:'Cliente de prueba con nombre largo',whatsapp:'60000000',registrationDate:'2026-08-01',levelEmoji:'🥉',levelName:'Bronce',pointsTotal:190,pointsAvailable:190,totalPurchases:19,currentStreak:6,nextPurchasePoints:15,progressLevelPct:95,pointsToNextLevel:10,nextLevel:{name:'Plata',emoji:'🥈'},qrUrl:'https://fixture.test/qr.svg',purchasedToday:false,hitosRacha:[3],badges:[{emoji:'⭐',name:'Cliente frecuente'}],recentHistory:[{type:'purchase',date:'2026-09-15T12:00:00Z',points:12}],pointsRules:[{points:10,label:'Racha 1–2'},{points:12,label:'Racha 3+'},{points:15,label:'Racha 7+'},{points:17,label:'Racha 14+'}],shopItems:[{id:'R1',emoji:'🍩',name:'Dona de recompensa',description:'Un antojo para celebrar tu constancia.',cost:100},{id:'R2',emoji:'🎁',name:'Recompensa con un nombre considerablemente largo para verificar el diseño',description:'Descripción extensa sin cortar los controles de canje.',cost:500}],recentRedemptions:[]});
(async()=>{
 const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const results=[];
 try {
 for (const width of [360,390,412,768,1440]) {
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage(); let client=fixture(); const requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if((u.hostname==='127.0.0.1'||u.hostname==='localhost')&&u.pathname.startsWith('/api/')) {
    const data=req.method()==='POST'?JSON.parse(req.postData()||'{}'):Object.fromEntries(u.searchParams);
    requests.push({...data,path:u.pathname});
    if(u.pathname==='/api/auth/session') {
     return route.fulfill(data.password==='demo1234'||data.grantType==='refresh_token'
      ?{json:{ok:true,data:{accessToken:'admin-token',refreshToken:'refresh-token',expiresAt:new Date(Date.now()+3600000).toISOString()}}}
      :{status:401,json:{ok:false,error:{code:'INVALID_CREDENTIALS',message:'Credenciales incorrectas'}}});
    }
    if(u.pathname==='/api/customer/session') return route.fulfill(data.publicId==='INVALID'
     ?{status:404,json:{ok:false,error:{code:'CUSTOMER_NOT_FOUND',message:'ID no encontrado'}}}
     :{json:{ok:true,data:{accessToken:'customer-token',customer:{publicId:data.publicId}}}});
    if(u.pathname==='/api/ranking') return route.fulfill({json:{ok:true,data:{ranking:[client,{...client,id:'C2',name:'Segundo cliente'},{...client,id:'C3',name:'Tercer cliente'}]}}});
    if(u.pathname==='/api/products') return route.fulfill({json:{ok:true,data:{products:[]}}});
    if(u.pathname==='/api/customer/orders') return route.fulfill({json:{ok:true,data:{orders:[]}}});
    let response={ok:true};
    switch(data.action){
     case 'buscarCliente':response={ok:true,clients:data.q==='nadie'?[]:[client]};break;
     case 'getCliente':response={ok:true,client};break;
     case 'registrarCompra':client={...client,pointsTotal:205,pointsAvailable:205,totalPurchases:20,currentStreak:7,levelName:'Plata',levelEmoji:'🥈',hitosRacha:[3,7],progressLevelPct:2,purchasedToday:true};response={ok:true,client,pointsEarned:15};break;
     case 'canjearRecompensa':client={...client,pointsAvailable:client.pointsAvailable-100,recentRedemptions:[{itemName:'Dona de recompensa',points:100,date:'2026-09-16',status:'pendiente'}]};response={ok:true,client};break;
     case 'nuevoCliente':response={ok:true,client:{...client,name:data.name}};break;
     case 'getAdminDashboard':response={ok:true,clients:[client],ranking:[client],stats:{today:2,week:10,month:30,totalClients:4,pointsDelivered:300,rewardsDelivered:2,migrationComplete:true},config:{DIAS_TOLERANCIA:3,PRECIO_DONA:1,PUNTOS_RACHA_BASE:10,PUNTOS_RACHA_3:12,PUNTOS_RACHA_7:15,PUNTOS_RACHA_14:17}};break;
     case 'saveConfig':response={ok:true,config:data.config};break;
    }
    return route.fulfill({json:{ok:true,data:response}});
   }
   if(u.hostname==='127.0.0.1'||u.hostname==='localhost') return route.continue();
   if(u.hostname==='fixture.test') return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="210" height="210"><rect width="210" height="210" fill="white"/><path fill="black" d="M20 20h50v50H20zM140 20h50v50h-50zM20 140h50v50H20z"/></svg>'});
   if(req.url().includes('html5-qrcode')) return route.fulfill({contentType:'text/javascript',body:`window.__scanners=[];window.Html5Qrcode=class{constructor(id){this.id=id;window.__scanners.push(this)} async start(camera,config,success){this.success=success;this.config=config;if(window.__cameraFail)throw Error('Denied');document.getElementById(this.id).innerHTML='<video></video>';} async stop(){this.stopped=true}};`});
   if(req.url().includes('confetti')) return route.fulfill({contentType:'text/javascript',body:'window.__confetti=0;window.confetti=()=>window.__confetti++;'});
   return route.abort();
  });
  const noOverflow=async label=>{
   await page.waitForTimeout(350);
   const overflow=await page.evaluate(()=>{const root=document.querySelector('.overlay:not(.hidden)')||document.documentElement;return {client:root.clientWidth,scroll:root.scrollWidth};});
   assert(overflow.scroll<=overflow.client+1,`${width} ${label} overflow ${JSON.stringify(overflow)}`);
  };
  await page.goto(base);await page.waitForTimeout(700);
  await noOverflow('landing');
  assert(await page.locator('#screen-home').evaluate(el=>el.inert));
  await page.screenshot({path:path.join(out,`landing-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Ranking',exact:true}).click();
  await page.waitForSelector('#rankingList .rank-item');await noOverflow('ranking');
  await page.evaluate(()=>rankingBack());
  await page.getByRole('button',{name:'Entrar a mi perfil'}).click();
  await noOverflow('client login');
  await page.locator('#userClientIdInput').fill('INVALID');await page.getByRole('button',{name:'Entrar con ID'}).click();
  await page.waitForFunction(()=>!document.getElementById('userOverlay').classList.contains('hidden'));
  await page.locator('#userClientIdInput').fill('C-DEMO');await page.getByRole('button',{name:'Entrar con ID'}).click();
  await page.waitForFunction(()=>document.getElementById('clientPoints').textContent==='190');
  assert.equal(await page.locator('#buyBtn').isVisible(),false);
  assert.equal(await page.locator('.progress-track').getAttribute('aria-valuenow'),'95');
  await noOverflow('profile');await page.screenshot({path:path.join(out,`profile-${width}.png`),fullPage:true});
  for(const type of ['ranking','shop','history']) {
   await page.locator('#client-tab-'+type).click();await noOverflow(type);
   if(type==='shop'){
    assert(await page.locator('.shop-buy').nth(1).isDisabled());
    page.once('dialog',dialog=>dialog.accept());await page.locator('.shop-buy').first().click();
    await page.waitForFunction(()=>document.getElementById('shopAvailablePoints').textContent==='90');
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
  assert.equal(await page.locator('#clientStreak').textContent(),'7');assert(await page.locator('#buyBtn').isDisabled());assert.equal(await page.evaluate(()=>window.__confetti),before+1);
  await page.evaluate(()=>goHome());await page.locator('#qrToggleBtn').click();await page.waitForFunction(()=>scannerOpen);
  assert.equal(await page.evaluate(()=>window.__scanners.at(-1).config.fps),10);
  await page.evaluate(()=>window.__scanners.at(-1).success('https://example.test/?id=C-DEMO'));
  await page.waitForFunction(()=>document.getElementById('screen-client').classList.contains('active'));assert(await page.evaluate(()=>window.__scanners.at(-1).stopped));
  await page.evaluate(()=>showScreen('screen-new'));await page.locator('#newName').fill('Nuevo de prueba');await page.locator('#createBtn').click();await page.waitForSelector('#newQrCard:visible');await noOverflow('registration');
  await page.evaluate(()=>showAdmin());await page.waitForFunction(()=>document.getElementById('sToday').textContent==='2');await noOverflow('admin');await page.screenshot({path:path.join(out,`admin-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Guardar config'}).click();await page.waitForTimeout(100);
  const saved=requests.find(r=>r.action==='saveConfig');assert(saved);assert.equal(saved.config.PRECIO_DONA,'1');
  await page.evaluate(()=>logout());assert.equal(await page.evaluate(()=>sessionStorage.getItem('donasAdminAccessToken')),null);
  await page.evaluate(()=>goToUserLogin());await page.locator('#userScanBtn').click();await page.waitForFunction(()=>userScannerOpen);
  await page.evaluate(()=>window.__scanners.at(-1).success('C-DEMO'));
  await page.waitForFunction(()=>openedAsUser && document.getElementById('userOverlay').classList.contains('hidden') && document.getElementById('screen-client').classList.contains('active'));
  await page.evaluate(()=>{goToRoleScreen();goToUserLogin();window.__cameraFail=true});await page.locator('#userScanBtn').click();await page.waitForFunction(()=>document.getElementById('userScanStatus').textContent==='No se pudo abrir la cámara');
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
