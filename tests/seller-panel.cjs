// Run against a local static server; API responses are simulated.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:8765';
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  try {
    const width=Number(process.env.TEST_WIDTH||390);
    const page=await browser.newPage({viewport:{width,height:844}});
    const requests=[];
    const redemptions=[
      {id:'11111111-1111-4111-8111-111111111111',code:'CANJE1',points:50,reward:'Dona gratis',status:'PENDING',createdAt:'2026-09-29T12:00:00Z',customerId:'CDEMO123',customerName:'Ana'},
      {id:'22222222-2222-4222-8222-222222222222',code:'CANJE2',points:30,reward:'Descuento',status:'PENDING',createdAt:'2026-09-29T13:00:00Z',customerId:'CDEMO123',customerName:'Ana'}
    ];
    page.on('pageerror',error=>{throw error;});
    await page.route('**/api/**',route=>{
      const url=new URL(route.request().url());requests.push(url.pathname);
      if(url.pathname==='/api/auth/session') return route.fulfill({json:{ok:true,data:{accessToken:'seller-token',refreshToken:'refresh-token',role:'SELLER'}}});
      if(url.pathname==='/api/admin/orders') return route.fulfill({json:{ok:true,data:{orders:[]}}});
      if(url.pathname==='/api/backend' && route.request().method()==='GET' && url.searchParams.get('action')==='getCanjes') {
        const status=url.searchParams.get('status');
        return route.fulfill({json:{ok:true,data:{ok:true,redemptions:redemptions.filter(item=>status==='ALL'||item.status===status)}}});
      }
      if(url.pathname==='/api/backend' && route.request().method()==='POST' && route.request().postDataJSON().action==='resolverCanje') {
        const body=route.request().postDataJSON();
        const item=redemptions.find(row=>row.id===body.redemptionId);
        assert(item && item.status==='PENDING');
        item.status=body.status;
        return route.fulfill({json:{ok:true,data:{ok:true,redemption:{id:item.id,status:item.status,pointsReturned:item.status==='CANCELLED'?item.points:0}}}});
      }
      if(url.pathname==='/api/backend') return route.fulfill({json:{ok:true,data:{ok:true,
        stats:{today:2,week:4,month:12,totalClients:1,pointsDelivered:20,rewardsDelivered:0,migrationComplete:true},
        config:{},clients:[{id:'CDEMO123',name:'Ana',pointsTotal:20,totalPurchases:2,currentStreak:1}],
        ranking:[{id:'CDEMO123',name:'Ana',pointsTotal:20,totalPurchases:2,currentStreak:1}]}}});
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
    await page.waitForFunction(()=>document.getElementById('sToday').textContent==='2');
    assert.equal(await page.locator('#adminOrdersPanel').isVisible(),true);
    await page.waitForFunction(()=>document.querySelectorAll('#adminRedemptionsList article').length===2);
    assert.equal(await page.locator('#adminRedemptionsPanel').isVisible(),true);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),`redemption cards must fit a ${width} px screen`);
    if(process.env.TEST_SCREENSHOT) await page.locator('#adminRedemptionsPanel').screenshot({path:process.env.TEST_SCREENSHOT});
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'Cancelar y devolver 50 pts'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('#adminRedemptionsList article').length===1);
    assert.equal(redemptions[0].status,'CANCELLED');
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'Confirmar entrega'}).click();
    await page.waitForFunction(()=>document.querySelector('#adminRedemptionsList .empty'));
    assert.equal(redemptions[1].status,'FULFILLED');
    await page.locator('#adminRedemptionFilter').selectOption('ALL');
    await page.waitForFunction(()=>document.querySelectorAll('#adminRedemptionsList article').length===2);
    assert.equal(await page.locator('#adminRedemptionsList button[data-redemption-id]').count(),0);
    assert.equal(await page.locator('#adminClients').isVisible(),true);
    assert.equal(await page.locator('#adminRanking').isVisible(),true);
    assert.equal(await page.locator('#adminClients button').filter({hasText:'Ajustar'}).count(),0);
    for(const selector of ['#adminInventoryPanel','#adminLoyaltyDialog'])
      assert.equal(await page.locator(selector).isVisible(),false,selector);
    assert.equal(requests.includes('/api/admin/customers/inventory'),false);
    assert.equal(requests.includes('/api/backend'),true,'seller dashboard must load sales statistics');
    console.log('PASS seller panel: redemption queue, cancel/refund, delivery confirmation, admin controls hidden');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
