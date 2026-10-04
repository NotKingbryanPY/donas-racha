// The site follows the device and data-saving preference without exposing animation controls.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:8765';
const launch=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{};
(async()=>{
 const browser=await chromium.launch({headless:true,...launch});
 try{
  for(const mode of ['default','reduce','saveData','saved-full']){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:mode==='reduce'||mode==='saved-full'?'reduce':'no-preference'});
   const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(mode=>{
    Object.defineProperty(navigator,'connection',{value:{saveData:mode==='saveData',effectiveType:'4g'}});
    if(mode==='saved-full')localStorage.setItem('donasMotionPreference','full');
   },mode);
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin===new URL(base).origin)return route.continue();
    return route.fulfill({body:'',contentType:'text/javascript'});
   });
   await page.goto(base+'?profile=1');
   assert.equal(await page.locator('[data-motion-preference],.motion-picker,.motion-settings').count(),0);
   assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('motion-lite')),mode!=='default');
   assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('motion-full')),false);
   assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily.split(',')[0]),'Nunito');
   await page.evaluate(()=>document.fonts.load('400 16px Nunito'));
   assert.equal(await page.evaluate(()=>document.fonts.check('400 16px Nunito')),true);
   if(mode!=='default')assert.equal(await page.locator('.welcome-title').evaluate(el=>getComputedStyle(el).animationName),'none');
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS Nunito and automatic reduced motion without visible controls or stale overrides');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
