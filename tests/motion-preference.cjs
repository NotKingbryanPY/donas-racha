// Reproduce the user's real browser preference instead of always forcing no-preference.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:8765';
const launch=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{};
(async()=>{
 const browser=await chromium.launch({headless:true,...launch});
 try{
  for(const mode of ['device','reduce','saveData','blocked-storage']){
   const context=await browser.newContext({viewport:{width:390,height:844},...(mode==='device'?{}:{reducedMotion:mode==='saveData'?'no-preference':'reduce'})});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let release;const pending=new Promise(resolve=>{release=resolve;});
   await page.addInitScript(mode=>{
    Object.defineProperty(navigator,'connection',{value:{saveData:mode==='saveData',effectiveType:'4g'}});
    if(mode==='blocked-storage')Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}});
   },mode);
   await page.route('**/*',async r=>{
    const url=new URL(r.request().url());
    if(url.origin!==new URL(base).origin)return r.fulfill({body:'',contentType:'text/javascript'});
    if(!url.pathname.startsWith('/api/'))return r.continue();
    if(url.pathname==='/api/customer/session'){await pending;return r.fulfill({json:{ok:true,data:{accessToken:'test',customer:{publicId:'C-MOTION'}}}});}
    if(url.pathname==='/api/backend')return r.fulfill({json:{ok:true,data:{ok:true,client:{id:'C-MOTION',name:'Ana',shopItems:[],recentHistory:[],progressLevelPct:60}}}});
    return r.fulfill({json:{ok:true,data:{products:[],ranking:[]}}});
   });
   await page.goto(base+'?profile=1');
   const systemReduce=await page.evaluate(()=>matchMedia('(prefers-reduced-motion:reduce)').matches);
   assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('motion-lite')),systemReduce||mode==='saveData');
   assert.equal(await page.locator('#loginMotionPreference').inputValue(),'system');
   console.log(`${mode}: actual system reduced motion = ${systemReduce}`);
   // Use the public control, not CSS injection or browser media emulation, to enable motion.
   await page.locator('#loginMotionPreference').selectOption('full');
   assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('motion-lite')),false);
   assert.equal(await page.locator('#profileMotionPreference').inputValue(),'full');
   assert.equal(await page.locator('[data-motion-hint]').textContent(),mode==='blocked-storage'?'Animaciones activadas solo en esta web. La elección dura mientras esta página esté abierta.':'Animaciones activadas solo en esta web.');
   if(mode!=='blocked-storage'){
    await page.reload();
    assert.equal(await page.locator('#loginMotionPreference').inputValue(),'full','explicit choice survives reload');
   }
   await page.locator('#userClientIdInput').fill('C-MOTION');await page.locator('#userEnterBtn').click();
   const before=await page.locator('#userEnterBtn').evaluate(el=>getComputedStyle(el,'::before').transform);
   await page.waitForTimeout(200);
   const after=await page.locator('#userEnterBtn').evaluate(el=>getComputedStyle(el,'::before').transform);
   assert.notEqual(before,after,'spinner animates even when the OS asks for reduced motion');
   release();
   await page.waitForSelector('.brand-intro',{state:'visible'});
   const first=await page.locator('.intro-donut').evaluate(el=>el.getBoundingClientRect().x);
   await page.waitForTimeout(400);
   const second=await page.locator('.intro-donut').evaluate(el=>el.getBoundingClientRect().x);
   assert(second<first,'real donut rolls under explicit full preference');
   await page.waitForSelector('.brand-intro',{state:'detached'});
   assert.equal(await page.locator('#clientName').textContent(),'Hola, Ana');
   await page.locator('#profileMotionPreference').selectOption('reduced');
   await page.locator('#client-tab-history').click();
   assert.equal(await page.locator('#clientHistorySection').evaluate(el=>getComputedStyle(el).animationName),'none');
   await page.locator('#profileMotionPreference').selectOption('system');
   assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('motion-lite')),systemReduce||mode==='saveData');
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS: native device preference, explicit animation override, spinner and intro, persistence, opt-out and blocked storage');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
