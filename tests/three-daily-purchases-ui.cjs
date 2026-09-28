// Browser check for the seller profile with mocked API responses; no real purchase.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:8765';

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:800}});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let count=0;
   const client=()=>({id:'C-DAILY',name:'Ana',whatsapp:'+50760001111',pointsTotal:100+count*10,pointsAvailable:100+count*10,
    totalPurchases:10+count,currentStreak:4,purchasesToday:count,dailyPurchaseLimit:3,nextPurchasePoints:12,
    progressLevelPct:50,hitosRacha:[3],badges:[],shopItems:[],recentHistory:[],pointsRules:[]});
   await page.addInitScript(()=>sessionStorage.setItem('donasAdminAccessToken','fixture'));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==new URL(base).origin)return route.fulfill({body:'',contentType:'text/javascript'});
    if(url.pathname==='/api/backend'){
     const body=route.request().method()==='POST'?JSON.parse(route.request().postData()):Object.fromEntries(url.searchParams);
     if(body.action==='getCliente')return route.fulfill({json:{ok:true,data:{ok:true,client:client()}}});
     if(body.action==='registrarCompra'){
      if(count>=3)return route.fulfill({status:409,json:{ok:false,error:{code:'DAILY_PURCHASE_LIMIT',message:'Límite diario alcanzado.'}}});
      count++;
      return route.fulfill({json:{ok:true,data:{ok:true,client:client(),pointsEarned:10,badgesAssigned:[]}}});
     }
    }
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,data:{ranking:[],products:[],orders:[],flavors:[],stats:{},clients:[]}}});
    return route.continue();
   });
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.evaluate(()=>openClient('C-DAILY',false));
   for(let n=0;n<3;n++){
    assert.equal(await page.locator('#buyBtn').isDisabled(),false);
    assert((await page.locator('#alreadyMsg').textContent()).includes(`${n} de 3`));
    await page.locator('#buyBtn').click();
    await page.waitForFunction(expected=>document.getElementById('alreadyMsg').textContent.includes(`${expected} de 3`),n+1);
   }
   assert.equal(await page.locator('#buyBtn').isDisabled(),true);
   assert((await page.locator('#alreadyMsg').textContent()).includes('Límite de hoy alcanzado'));
   assert.equal(count,3);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS seller web: count 0–3, three registrations, button stops at daily limit on mobile and desktop');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
