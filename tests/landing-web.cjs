// Real DOM, isolated API fixtures. No production accounts, orders or balances.
const assert=require('node:assert/strict');const fs=require('node:fs');const {chromium}=require('playwright');
const base=process.env.TEST_URL || 'http://127.0.0.1:8765';
const client={id:'CLANDING123',username:'ana.demo',name:'Ana',pointsAvailable:125,pointsTotal:9999,totalPurchases:58,
 shopItems:[{name:'Premio grande',cost:300},{name:'Dona de regalo',cost:150}],recentHistory:[]};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
async function fixture(context,profile){
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==new URL(base).origin)return route.fulfill({body:'',contentType:'text/javascript'});
  const answer=data=>route.fulfill({json:{ok:true,data}});
  if(url.pathname==='/api/customer/session')return answer({accessToken:'dr1.fixture',customer:{publicId:client.id,username:client.username}});
  if(url.pathname==='/api/backend'){
   if(url.searchParams.get('action')==='getCliente')return answer({ok:true,client:await profile(req,url)});
   return answer({ok:true,ranking:[]});
  }
  if(url.pathname==='/api/customer/onboarding')return answer({progress:{status:'COMPLETED',last_step:7}});
  if(url.pathname==='/api/products')return url.searchParams.has('view')?answer({enabled:false,enforced:true,flavors:[]}):answer({products:[{name:'Donas',product_variants:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Chocolate',available:true,unit_price_cents:100,currency_code:'USD'}]}]});
  if(url.pathname.startsWith('/api/'))return answer({ranking:[],orders:[],activeOrders:[],historyOrders:[],historyIncluded:true});
  return route.continue();
 });
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  fs.mkdirSync('test-output/landing',{recursive:true});
  for(const width of [320,390,768,1024,1440]){
   const context=await browser.newContext({viewport:{width,height:1800},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];let reads=0;
   page.on('pageerror',error=>errors.push(error.message));
   await fixture(context,()=>{reads++;return structuredClone(client);});
   await page.goto(base);await page.locator('#publicCatalog strong').waitFor();
   assert.equal(reads,0,'anonymous home must not request private profiles');
   assert.equal(await page.locator('#welcomeHeading').innerText(),'Cada antojo\nsuma.');
   assert.equal(await page.locator('.landing-stamp').count(),6);assert.equal(await page.locator('.landing-stamp.is-earned').count(),0);
   assert.equal(await page.locator('#landingRewardMeter').getAttribute('role'),null);
   assert.equal(await page.locator('#publicCatalog strong').textContent(),'B/.1.00');
   assert.equal(await page.locator('#roleOverlay .hero-art,#roleOverlay img[src*="donut-hero"],#roleOverlay img[src*="donut-stack"]').count(),0);
   assert.equal(await page.locator('[data-photo-state="placeholder"]').count(),1);
   const layout=await page.evaluate(()=>{
    const root=document.getElementById('roleOverlay'),hero=document.querySelector('.hero-copy').getBoundingClientRect(),card=document.querySelector('.landing-rewards').getBoundingClientRect();
    return {overflow:root.scrollWidth>root.clientWidth,hero:{x:hero.x,bottom:hero.bottom},card:{x:card.x,y:card.y},circles:[...document.querySelectorAll('.landing-stamp')].map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right};})};
   });
   assert.equal(layout.overflow,false,`landing overflows at ${width}px`);
   assert(layout.circles.every(r=>r.left>=0 && r.right<=width),'all six stamps fit the viewport');
   if(width>=900)assert(layout.card.x>layout.hero.x);else assert(layout.card.y>=layout.hero.bottom,'mobile order: copy then card');
   if([390,1440].includes(width)){
    await page.locator('.landing-hero').screenshot({path:`test-output/landing/hero-${width}.png`});
    await page.locator('.donut-order-card').screenshot({path:`test-output/landing/orders-${width}.png`});
   }
   await page.getByRole('button',{name:'Ranking',exact:true}).click();await page.locator('#screen-ranking').waitFor({state:'visible'});await page.evaluate(()=>rankingBack());
   const rewards=page.getByRole('link',{name:'Ver mis recompensas'});await page.keyboard.press('Tab');await rewards.focus();
   assert.equal(await rewards.evaluate(el=>el.matches(':focus-visible')),true);await page.keyboard.press('Enter');
   await page.locator('#userOverlay').waitFor({state:'visible'});assert.equal(new URL(page.url()).searchParams.get('view'),'shop');
   await page.locator('#userClientIdInput').fill(client.username);await page.locator('#userEnterBtn').click();await page.locator('#clientShopSection').waitFor({state:'visible'});
   await page.evaluate(()=>goToRoleScreen());
   assert.equal(await page.locator('#landingRewardStatus').textContent(),'125 de 150 puntos');
   assert.equal(await page.locator('.landing-stamp.is-earned').count(),5,'seals reflect spendable points, never lifetime points or purchase count');
   assert.equal(await page.locator('#landingRewardMeter').getAttribute('aria-valuemax'),'150');
   assert((await page.locator('#landingRewardTarget').textContent()).includes('Dona de regalo'));
   assert(!(await page.locator('.landing-reward-card').textContent()).includes('5 de 6 compras'));
   await page.evaluate(()=>{currentClient.pointsAvailable=25;renderProfilePreview(currentClient);});
   assert.equal(await page.locator('.landing-stamp.is-earned').count(),1,'spending points reduces the same profile-based preview');
   await page.locator('#catalogOrderBtn').click();await page.locator('#userOverlay').waitFor({state:'visible'});
   await page.locator('#userClientIdInput').fill(client.username);await page.locator('#userEnterBtn').click();await page.locator('#clientDeliverySection').waitFor({state:'visible'});
   await page.evaluate(()=>clientGoBack());assert.equal(await page.locator('.landing-stamp.is-earned').count(),0);
   assert.equal(await page.locator('#landingRewardMeter').getAttribute('role'),null,'logout removes private progress');
   assert.deepEqual(errors,[]);await context.close();console.log(`PASS landing ${width}px: layout, live price, rewards route, point-based seals, order route, focus and logout`);
  }
  const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),gate=deferred();let requested=0;
  await context.addInitScript(()=>{sessionStorage.setItem('donasCustomerId','CLANDING123');sessionStorage.setItem('donasCustomerToken','dr1.old');});
  await fixture(context,async(req,url)=>{requested++;if(url.searchParams.get('id')===client.id){await gate.promise;return structuredClone(client);}return {...client,id:'COTHER123',pointsAvailable:75};});
  await page.goto(base);await page.waitForFunction(()=>document.querySelector('.landing-reward-card').getAttribute('aria-busy')==='true');
  await page.evaluate(()=>{sessionStorage.setItem('donasCustomerId','COTHER123');sessionStorage.setItem('donasCustomerToken','dr1.new');goToRoleScreen();});
  await page.waitForFunction(()=>document.getElementById('landingRewardStatus').textContent==='75 de 150 puntos');gate.resolve();await page.waitForTimeout(250);
  assert.equal(await page.locator('#landingRewardStatus').textContent(),'75 de 150 puntos','a late old-account read cannot restore the old balance');assert.equal(requested,2);
  await page.evaluate(()=>{sessionStorage.clear();goToRoleScreen();});assert.equal(await page.locator('.landing-stamp.is-earned').count(),0);
  await context.close();console.log('PASS landing restored session: bounded private read, account switch and late response isolation');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
