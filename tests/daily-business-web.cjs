const assert=require('node:assert/strict');const {chromium}=require('playwright');
const base='http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try {for(const width of [360,768,1440]) {
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];let missing=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==base)return route.fulfill({body:''});
    if(url.pathname==='/api/admin/customers/daily') {
      if(missing)return route.fulfill({status:503,json:{ok:false,error:{code:'DAILY_SETUP_REQUIRED',message:'Falta SQL'}}});
      return route.fulfill({json:{ok:true,data:{schemaVersion:2,session:{business_date:'2026-10-13'},summary:{revenueCents:500,investmentCents:1200,costOfSalesCents:250,profitCents:250,cashCents:200,yappyCents:300,soldUnits:5,consumedUnits:1,unknownCostUnits:0},operations:[{kind:'PURCHASE',investment_cents:1200,revenue_cents:0,occurred_at:'2026-10-13T12:00:00Z'}]}}});
    }
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,data:{products:[],orders:[],flavors:[],ranking:[],redemptions:[],stats:{},config:{}}}});
    return route.continue();
  });
  await page.goto(base);
  await page.evaluate(()=>{sessionStorage.setItem('donasAdminAccessToken','test');showScreen('screen-admin');return loadDailyBusiness()});
  await page.locator('#adminDailyMetrics .stat-card').first().waitFor();
  assert.match(await page.locator('#adminDailyMetrics').innerText(),/B\/\.5\.00/);
  assert.match(await page.locator('#adminDailyMetrics').innerText(),/B\/\.2\.50/);
  assert.match(await page.locator('#adminDailyNotice').innerText(),/Solo registros confirmados/);
  await page.locator('#adminDailyPanel summary').click();
  assert.match(await page.locator('#adminDailyHistory').innerText(),/Compra de cajas/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  missing=true;await page.locator('#adminDailyRefresh').click();
  await page.waitForFunction(()=>document.getElementById('adminDailyNotice').textContent.includes('La web sigue operativa'));
  assert.deepEqual(errors,[]);
  await page.close();
 }console.log('PASS daily web at 360/768/1440: confirmed metrics, responsive, history, missing SQL isolated');}
 finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
