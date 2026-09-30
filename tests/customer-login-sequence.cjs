// Exercise the real ID/QR flow with mocked API responses; no production data writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_URL||'http://127.0.0.1:8765';
const out=process.env.TEST_OUTPUT||path.resolve('test-output/login-sequence');
fs.mkdirSync(out,{recursive:true});
const fixture={id:'C-SEQUENCE',name:'Ana',pointsTotal:120,pointsAvailable:120,currentStreak:3,totalPurchases:12,progressLevelPct:60,shopItems:[],recentHistory:[]};
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  for(const mode of ['normal','reduce','saveData']){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:mode==='reduce'?'reduce':'no-preference',...(mode==='normal'?{recordVideo:{dir:out,size:{width:390,height:844}}}:{})});
   const page=await context.newPage();let gate=null,calls=0;
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(mode=>{
    // Low memory and an old intro marker must NOT suppress the requested login entrance.
    Object.defineProperty(navigator,'deviceMemory',{value:2});
    Object.defineProperty(navigator,'connection',{value:{saveData:mode==='saveData',effectiveType:'4g'}});
    sessionStorage.setItem('donasBrandIntroSeen','1');
    window.introCount=0;
    new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.classList?.contains('brand-intro'))window.introCount++;}))).observe(document,{childList:true,subtree:true});
   },mode);
   await page.route('**/*',async r=>{
    const u=new URL(r.request().url());
    if(u.origin!==new URL(base).origin)return r.fulfill({body:'',contentType:'text/javascript'});
    if(!u.pathname.startsWith('/api/'))return r.continue();
    if(u.pathname==='/api/customer/session'){
     calls++;if(gate)await gate.promise;
     return r.fulfill({json:{ok:true,data:{accessToken:'fixture',customer:{publicId:fixture.id}}}});
    }
    if(u.pathname==='/api/backend')return r.fulfill({json:{ok:true,data:{ok:true,client:fixture}}});
    if(u.pathname==='/api/customer/onboarding')return r.fulfill({json:{ok:true,data:{progress:{status:'COMPLETED',last_step:7}}}});
    return r.fulfill({json:{ok:true,data:{products:[],orders:[],flavors:[],ranking:[]}}});
   });
   await page.goto(base+'?profile=1');
   assert.equal(await page.locator('.brand-intro').count(),0,'no pre-login intro');
   await page.locator('#userClientIdInput').fill(fixture.id);
   gate=deferred();await page.locator('#userEnterBtn').click();
   await page.evaluate(()=>{void openUserById();});assert.equal(calls,1,'duplicate submit blocked');
   await page.waitForTimeout(900);
   if(mode==='normal')await page.screenshot({path:path.join(out,'01-entrando.png')});
   else assert.equal(await page.locator('#userEnterBtn').evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
   gate.resolve();
   await page.waitForFunction(()=>document.getElementById('userEnterBtn').classList.contains('is-success'));
   assert.equal(await page.locator('#userOverlay').isVisible(),true);
   assert.equal(await page.locator('#userEnterBtn').textContent(),'Listo');
   await page.waitForTimeout(210); // Let the specified 180 ms button color transition settle.
   assert.equal(await page.locator('#userEnterBtn').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(145, 245, 232)');
   if(mode==='normal')await page.screenshot({path:path.join(out,'02-listo.png')});
   await page.waitForFunction(()=>customerLoginController===null && document.getElementById('screen-client').classList.contains('active'));
   assert.equal(await page.evaluate(()=>window.introCount),mode==='normal'?1:0);
   if(mode==='normal')await page.screenshot({path:path.join(out,'03-perfil.png')});
   const n=await page.evaluate(()=>window.introCount);
   await page.locator('#client-tab-history').click();await page.locator('#client-tab-profile').click();
   await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
   assert.equal(await page.evaluate(()=>window.introCount),n,'tabs never replay intro');
   // An old customer link reopens the authenticated profile without another login.
   gate=null;
   await page.goto(base+'?profile=1&id='+fixture.id);
   await page.waitForFunction(()=>openedAsUser && document.getElementById('screen-client').classList.contains('active'));
   assert.equal(new URL(page.url()).searchParams.has('id'),false,'old link no longer exposes the technical ID after entry');
   assert.equal(await page.evaluate(()=>window.introCount),0,'restored session skips the entrance');
   // Leaving a slow login must not redirect when its old response finally arrives.
   await page.evaluate(()=>goToUserLogin());gate=deferred();await page.locator('#userEnterBtn').click();
   await page.getByRole('button',{name:'Volver al inicio'}).click();gate.resolve();
   await page.waitForTimeout(650);
   assert.equal(await page.locator('#roleOverlay').isVisible(),true,'cancelled login stays cancelled');
   assert.equal(await page.locator('.brand-intro').count(),0);
   assert.deepEqual(errors,[]);
   const video=page.video();await context.close();
   if(video)fs.copyFileSync(await video.path(),path.join(out,'acceso-corregido.webm'));
  }
  console.log('PASS: ID → spinning pending → turquoise Listo → brand → profile, QR/repeat, cancellation and accessibility');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
