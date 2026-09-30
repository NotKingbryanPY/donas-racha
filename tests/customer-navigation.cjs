// Browser history, refresh and private customer views with mocked API responses.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();const errors=[];let logins=0;
  page.on('pageerror',error=>errors.push(error.message));
  const client={id:'CNAV123',username:'ana.gomez',name:'Ana Gómez',pointsTotal:30,pointsAvailable:30,currentStreak:2,shopItems:[],recentHistory:[]};
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==new URL(base).origin)return route.fulfill({body:'',contentType:'text/javascript'});
   if(url.pathname==='/api/customer/session'){
    logins++;
    return route.fulfill({json:{ok:true,data:{accessToken:'customer-token',customer:{publicId:client.id,username:client.username}}}});
   }
   if(url.pathname==='/api/backend')return route.fulfill({json:{ok:true,data:{ok:true,client}}});
   if(url.pathname==='/api/customer/onboarding')return route.fulfill({json:{ok:true,data:{progress:{status:'COMPLETED',last_step:7}}}});
   if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,data:{products:[],flavors:[],orders:[],ranking:[]}}});
   return route.continue();
  });
  await page.goto(base+'?profile=1&view=delivery');
  assert.equal(await page.locator('#userOverlay').isVisible(),true,'private link requires login without a session');
  await page.locator('#userClientIdInput').fill(client.username);
  await page.locator('#userEnterBtn').click();
  await page.waitForFunction(()=>openedAsUser && currentClient && document.getElementById('clientDeliverySection').style.display!=='none');
  assert.equal(new URL(page.url()).searchParams.get('view'),'delivery');
  assert.equal(logins,1);
  await page.reload();
  await page.waitForFunction(()=>openedAsUser && currentClient && document.getElementById('clientDeliverySection').style.display!=='none');
  assert.equal(logins,1,'refresh restores authenticated view without a new login');
  await page.locator('#client-top-profile').click();
  await page.locator('#client-tab-ranking').click();
  assert.equal(new URL(page.url()).searchParams.get('view'),'ranking');
  await page.reload();
  await page.waitForFunction(()=>openedAsUser && currentClient && document.getElementById('clientRankingSection').style.display!=='none');
  assert.equal(logins,1);
  await page.goBack();
  await page.waitForFunction(()=>document.getElementById('clientProfileSection').style.display!=='none');
  assert.equal(new URL(page.url()).searchParams.get('view'),'profile');
  await page.goBack();
  await page.waitForFunction(()=>document.getElementById('clientDeliverySection').style.display!=='none');
  assert.equal(new URL(page.url()).searchParams.get('view'),'delivery');
  await page.evaluate(()=>clientGoBack());
  assert.equal(new URL(page.url()).searchParams.has('profile'),false);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('donasCustomerToken')),null);
  await page.goto(base+'?profile=1&view=shop');
  assert.equal(await page.locator('#userOverlay').isVisible(),true,'logout does not restore the private view');
  assert.deepEqual(errors,[]);
  const staffPage=await context.newPage();
  staffPage.on('pageerror',error=>errors.push(error.message));
  await staffPage.addInitScript(()=>{
    sessionStorage.setItem('donasAdminAccessToken','admin-token');
    sessionStorage.setItem('donasStaffRole','ADMIN');
  });
  await staffPage.goto(base+'?staff=dashboard');
  await staffPage.waitForFunction(()=>document.getElementById('screen-admin').classList.contains('active'));
  await staffPage.reload();
  await staffPage.waitForFunction(()=>document.getElementById('screen-admin').classList.contains('active'));
  await staffPage.evaluate(()=>showScreen('screen-new'));
  assert.equal(new URL(staffPage.url()).searchParams.get('staff'),'new');
  await staffPage.reload();
  await staffPage.waitForFunction(()=>document.getElementById('screen-new').classList.contains('active'));
  await staffPage.evaluate(id=>openClient(id,false),client.id);
  await staffPage.waitForFunction(()=>currentClient && document.getElementById('screen-client').classList.contains('active'));
  assert.equal(new URL(staffPage.url()).searchParams.get('staff'),'client');
  await staffPage.reload();
  await staffPage.waitForFunction(()=>currentClient && document.getElementById('screen-client').classList.contains('active'));
  await staffPage.goBack();
  await staffPage.waitForFunction(()=>document.getElementById('screen-new').classList.contains('active'));
  assert.equal(new URL(staffPage.url()).searchParams.get('staff'),'new');
  assert.deepEqual(errors,[]);
  console.log('PASS customer and staff view URLs, refresh, browser history, deep links and logout');
  await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
