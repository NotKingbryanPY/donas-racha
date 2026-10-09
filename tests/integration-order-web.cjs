const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {chromium}=require('playwright');const fs=require('node:fs');
const base='http://127.0.0.1:8765',variant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try {
  for(const width of [360,768,1440]) {
   const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:width===360?'reduce':'no-preference'});
   const page=await ctx.newPage();const errors=[];let posts=0,failAfterCommit=true,rejectBeforeCommit=false,lastPayload,stored;
   const client={id:'CPILOT123',username:'ana.test',name:'Ana',pointsTotal:250,pointsAvailable:150,currentStreak:2,shopItems:[],recentHistory:[]};
   page.on('pageerror',e=>errors.push(e.message));
   await ctx.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==base)return route.fulfill({body:'',contentType:'text/javascript'});
    const answer=data=>route.fulfill({json:{ok:true,data}});
    if(url.pathname==='/api/customer/session')return answer({accessToken:'test',customer:{publicId:client.id,username:client.username}});
    if(url.pathname==='/api/backend')return answer({ok:true,client});
    if(url.pathname==='/api/customer/onboarding')return answer({progress:{status:'COMPLETED',last_step:7}});
    if(url.pathname==='/api/products')return url.searchParams.has('view') ? answer({enforced:true,flavors:[{variant_id:variant,name:'Chocolate',offered:true,available_quantity:10,counted:true}]}) : answer({products:[{name:'Donas',product_variants:[{id:variant,name:'Chocolate',available:true,unit_price_cents:100,currency_code:'USD'}]}]});
    if(url.pathname==='/api/orders' && req.method()==='POST') {
     posts++;const payload=req.postDataJSON();
     if(rejectBeforeCommit)return route.fulfill({status:400,json:{ok:false,error:{code:'OUT_OF_STOCK',message:'Sabor deshabilitado'}}});
     if(lastPayload)assert.deepEqual(payload,lastPayload,'recovery must reuse exact key and payload');
     lastPayload=payload;
     const replayed=!!stored;
     stored ||= {created_at:new Date().toISOString(),id:randomUUID(),public_code:'DR-123456789A',status:'PENDING',total_cents:100,currency_code:'USD'};
     if(failAfterCommit){failAfterCommit=false;return route.fulfill({status:503,json:{ok:false,error:{code:'TEMPORARY',message:'Respuesta interrumpida'}}});}
     await new Promise(r=>setTimeout(r,200));return answer({...stored,replayed});
    }
    if(url.pathname.startsWith('/api/orders/'))return answer({order:stored});
    if(url.pathname==='/api/customer/orders')return answer({orders:stored?[stored]:[]});
    if(url.pathname.startsWith('/api/'))return answer({ranking:[],products:[]});
    return route.continue();
   });
   await page.goto(base+'/?profile=1');
   await page.locator('#userClientIdInput').fill(client.username);await page.locator('#userEnterBtn').click();
   await page.waitForFunction(()=>openedAsUser&&currentClient);
   assert.equal(await page.locator('#clientSpendable').textContent(),'150');assert.equal(await page.locator('#clientPoints').textContent(),'250');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   fs.mkdirSync('test-output/integration',{recursive:true});await page.screenshot({path:'test-output/integration/profile-'+width+'.png',fullPage:true});
   await page.locator('#client-top-delivery').click();await page.locator('#clientFlavorList button[aria-label="Añadir Chocolate"]').click();
   await page.locator('#clientDeliveryLocation').fill('Entrada Edificio 4');await page.locator('#clientOrderButton').click();
   await page.waitForFunction(()=>!customerOrderSubmitting);
   assert.equal(await page.locator('#clientOrderConfirmation').isVisible(),false,'failed response never shows success');
   assert.equal(posts,1);
   await page.reload();await page.waitForFunction(()=>openedAsUser&&currentClient);await page.locator('#clientOrderRetry').waitFor({state:'visible'});
   await page.locator('#clientOrderRetry').click();await page.evaluate(()=>submitClientOrder());
   await page.locator('#clientOrderConfirmation').waitFor({state:'visible'});assert.equal(posts,2,'double submission is suppressed');
   assert.equal(await page.locator('#clientOrderConfirmation').evaluate(el=>el.classList.contains('animate-confirmation')),false,'idempotent replay does not replay motion');
   const wa=new URL(await page.locator('#confirmedOrderWhatsapp').getAttribute('href'));assert.equal(wa.pathname,'/50760887856');assert.ok(wa.searchParams.get('text').includes(stored.public_code));
   await page.locator('#clientOrderConfirmation .dialog-close').click();
   lastPayload=null;stored=null;
   await page.locator('#clientFlavorList button[aria-label="Añadir Chocolate"]').click();
   await page.locator('#clientDeliveryLocation').fill('Entrada Edificio 4');
   await page.locator('#clientOrderButton').click();
   await page.locator('#clientOrderConfirmation').waitFor({state:'visible'});
   assert.equal(posts,3);
   assert.equal(await page.locator('#clientOrderConfirmation').evaluate(el=>el.classList.contains('animate-confirmation')),width!==360,'new success respects reduced motion');
   await page.waitForTimeout(1000);
   await page.screenshot({path:'test-output/integration/confirmation-'+width+'.png',fullPage:true});
   await page.locator('#clientOrderConfirmation .dialog-close').click();await page.reload();await page.waitForFunction(()=>openedAsUser&&currentClient);assert.equal(await page.locator('#clientOrderConfirmation').isVisible(),false,'reload restores state without repeating dialog');
   rejectBeforeCommit=true;
   await page.locator('#clientFlavorList button[aria-label="Añadir Chocolate"]').click();
   await page.locator('#clientDeliveryLocation').fill('Entrada Edificio 4');await page.locator('#clientOrderButton').click();
   await page.waitForFunction(()=>!customerOrderSubmitting);
   assert.equal(await page.locator('#clientOrderConfirmation').isVisible(),false);
   await page.evaluate(()=>window.DonasOrderFeedback.restore());
   assert.equal(await page.locator('#clientOrderMessage').textContent(),'Sabor deshabilitado','an old confirmed order must not overwrite a new failure');
   assert.deepEqual(errors,[]);await ctx.close();
  }
  console.log('PASS browser 360/768/1440: available/historical points, failed confirmation, stable recovery, double-click, WhatsApp, reduced motion and refresh');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
