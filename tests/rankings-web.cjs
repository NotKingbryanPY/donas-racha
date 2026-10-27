// Real DOM; all business data are isolated fixtures.
const assert=require('node:assert/strict');const fs=require('node:fs');const {chromium}=require('playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:8765';
const customers=Array.from({length:7},(_,i)=>({id:'CRANK'+i,name:i===0?'Ana Victoria Martínez de la Universidad':'Cliente '+(i+1),levelName:'Oro',totalPurchases:80-i*5,pointsTotal:1000-i*50,currentStreak:20-i,redemptionsMade:12-i,weeklyPurchases:21-i*2,weeklyPoints:200-i*10}));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  fs.mkdirSync('test-output/rankings',{recursive:true});
  for(const width of [320,390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
   const page=await context.newPage(),errors=[];let weeklyCalls=0,delay=null,empty=false,publicCount=7;
   page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    const answer=data=>route.fulfill({json:{ok:true,data}});
    if(url.origin!==new URL(base).origin)return route.fulfill({body:'',contentType:'text/javascript'});
    if(url.pathname==='/api/auth/session')return answer({accessToken:'staff-token',refreshToken:'staff-refresh',role:'SELLER'});
    if(url.pathname==='/api/admin/customers/weekly-ranking'){
     weeklyCalls++;assert.equal(request.headers().authorization,'Bearer staff-token');
     if(delay)await delay.promise;
     const week=url.searchParams.get('week')||'2026-10-26';
     return answer({weekStart:week,weekEnd:week==='2026-10-26'?'2026-11-02':'2026-10-26',currentWeek:'2026-10-26',weeks:['2026-10-26','2026-10-19'],ranking:empty?[]:customers});
    }
    if(url.pathname==='/api/ranking')return answer({ranking:customers.slice(0,publicCount).map(({id,...publicCustomer})=>publicCustomer)});
    if(url.pathname.startsWith('/api/'))return answer({products:[],flavors:[],ranking:[]});
    return route.continue();
   });
   await page.goto(base+'?staff=weekly-ranking');
   assert(await page.locator('#loginOverlay').isVisible());assert.equal(weeklyCalls,0,'private link never fetches without staff session');
   await page.locator('#loginEmail').fill('seller@example.com');await page.locator('#loginInput').fill('test-password');await page.locator('#loginBtn').click();
   await page.locator('#weeklyRankingList .hall-of-fame').waitFor();
   assert.equal(new URL(page.url()).searchParams.get('staff'),'weekly-ranking');
   const gold=await page.locator('#weeklyRankingList .hall-contender.gold').boundingBox();
   const silver=await page.locator('#weeklyRankingList .hall-contender.silver').boundingBox();
   const bronze=await page.locator('#weeklyRankingList .hall-contender.bronze').boundingBox();
   assert(silver.x<gold.x&&gold.x<bronze.x&&gold.y<silver.y,'first place is centered and raised');
   assert.equal(await page.locator('#weeklyRankingList [data-ranking-client]').count(),7);
   assert(await page.locator('#weeklyNext').isDisabled());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile viewport has no horizontal overflow');
   await page.evaluate(()=>document.getElementById('toast').classList.remove('show'));
   await page.screenshot({path:`test-output/rankings/weekly-${width}.png`,fullPage:true});
   await page.locator('#weeklyPrevious').click();await page.waitForFunction(()=>document.getElementById('weeklyRankingHistory').value==='2026-10-19');
   assert.match(await page.locator('#weeklyRankingStatus').textContent(),/finalizada/);
   await page.reload();await page.locator('#weeklyRankingList .hall-of-fame').waitFor();
   assert.equal(await page.locator('#weeklyRankingHistory').inputValue(),'2026-10-19','refresh preserves selected historic week');
   empty=true;await page.locator('#weeklyCurrent').click();await page.locator('#weeklyRankingList .empty').filter({hasText:'Aún no hay compras'}).waitFor();
   assert.match(await page.locator('#weeklyRankingList').innerText(),/Aún no hay compras/);empty=false;
   delay=deferred();await page.locator('#weeklyRefresh').click();
   await page.evaluate(()=>logout());delay.resolve();await page.waitForTimeout(150);
   assert.equal(await page.locator('#weeklyRankingList').textContent(),'','late response after logout cannot restore private ranking');
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('donasAdminAccessToken')),null);
   delay=null;
   await page.evaluate(()=>showPublicRanking());await page.locator('#rankingList .hall-of-fame').waitFor();
   assert.equal(await page.locator('#rankingList [data-ranking-client]').count(),0,'public leaderboard has no private IDs or profile actions');
   await page.screenshot({path:`test-output/rankings/public-${width}.png`,fullPage:true});
   for(const type of ['puntos','racha','nivel','canjes']){
    await page.locator('#tab-'+type).click();await page.locator('#rankingList .hall-of-fame').waitFor();
   }
   for(const count of [1,2,0]){
    publicCount=count;await page.evaluate(()=>loadRanking('compras'));
    assert.equal(await page.locator('#rankingList .hall-contender').count(),count);
   }
   const injected=await page.evaluate(()=>window.DrachasRanking.render([{name:'<img src=x onerror=alert(1)>',totalPurchases:1,levelName:'<script>x</script>'}],'compras'));
   assert(!injected.includes('<img'));assert(!injected.includes('<script>'));
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS rankings web: responsive podium, staff login/deep link/history, empty/small rankings, safe names, public privacy, logout and late responses');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
