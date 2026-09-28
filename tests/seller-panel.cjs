// Run against a local static server; API responses are simulated.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:8765';
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const requests=[];
    page.on('pageerror',error=>{throw error;});
    await page.route('**/api/**',route=>{
      const url=new URL(route.request().url());requests.push(url.pathname);
      if(url.pathname==='/api/auth/session') return route.fulfill({json:{ok:true,data:{accessToken:'seller-token',refreshToken:'refresh-token',role:'SELLER'}}});
      if(url.pathname==='/api/admin/orders') return route.fulfill({json:{ok:true,data:{orders:[]}}});
      if(url.pathname==='/api/ranking') return route.fulfill({json:{ok:true,data:{ranking:[]}}});
      if(url.pathname==='/api/products') return route.fulfill({json:{ok:true,data:{products:[]}}});
      return route.fulfill({status:403,json:{ok:false,error:{message:'Denegado'}}});
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Acceso de vendedores'}).click();
    await page.locator('#loginEmail').fill('vendedor@example.test');
    await page.locator('#loginInput').fill('demo1234');
    await page.locator('#loginBtn').click();
    await page.waitForFunction(()=>sessionStorage.getItem('donasStaffRole')==='SELLER');
    assert.equal(await page.locator('#claimCodesLink').isVisible(),false);
    await page.locator('#staffDashboardButton').click();
    await page.waitForFunction(()=>document.getElementById('adminOrdersNotice').textContent.includes('pedidos'));
    assert.equal(await page.locator('#adminOrdersPanel').isVisible(),true);
    for(const selector of ['#adminInventoryPanel','#adminClients','#adminLoyaltyDialog'])
      assert.equal(await page.locator(selector).isVisible(),false,selector);
    assert.equal(requests.includes('/api/admin/customers/inventory'),false);
    assert.equal(requests.includes('/api/backend'),false,'seller view must not load admin dashboard');
    console.log('PASS seller panel: orders available, admin tools hidden, no privileged dashboard calls');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
