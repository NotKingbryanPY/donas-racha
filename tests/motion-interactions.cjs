// Development only. All API responses are intercepted; no production writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.TEST_URL || 'http://127.0.0.1:8765';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let authGate,profileGate,authFailure=false,profileFailure=false;
    const client={id:'C-MOTION',name:'Ana',pointsTotal:120,pointsAvailable:120,currentStreak:3,progressLevelPct:60,shopItems:[],recentHistory:[]};
    await page.route('**/*',async r=>{
      const u=new URL(r.request().url());
      if(u.origin!==new URL(base).origin) return r.fulfill({body:'',contentType:'text/javascript'});
      if(!u.pathname.startsWith('/api/'))return r.continue();
      if(u.pathname==='/api/customer/session'){
        if(authGate)await authGate.promise;
        return authFailure?r.fulfill({status:404,json:{ok:false,error:{message:'ID no encontrado'}}}):r.fulfill({json:{ok:true,data:{accessToken:'fixture',customer:{publicId:client.id}}}});
      }
      if(u.pathname==='/api/backend'){
        if(profileGate)await profileGate.promise;
        return profileFailure?r.fulfill({status:503,json:{ok:false,error:{message:'Perfil no disponible'}}}):r.fulfill({json:{ok:true,data:{ok:true,client}}});
      }
      return r.fulfill({json:{ok:true,data:{products:[],flavors:[],orders:[],ranking:[]}}});
    });
    await page.addInitScript(()=>{
      Object.defineProperty(navigator,'deviceMemory',{value:8});
      Object.defineProperty(navigator,'connection',{value:{saveData:false,effectiveType:'4g'}});
      sessionStorage.setItem('donasBrandIntroSeen','1');
    });
    await page.goto(base);
    await page.evaluate(()=>goToUserLogin());
    await page.waitForTimeout(30);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'userClientIdInput','explicit input focus is preserved');
    await page.locator('#userClientIdInput').fill(client.id);
    authGate=deferred();profileGate=deferred();
    await page.locator('#userEnterBtn').click();
    assert.equal(await page.locator('#userEnterBtn').getAttribute('aria-busy'),'true');
    assert.equal(await page.locator('#clientLoginSuccess').isVisible(),false);
    const rotation1=await page.locator('#userEnterBtn').evaluate(el=>getComputedStyle(el,'::before').transform);
    await page.waitForTimeout(950);
    const rotation2=await page.locator('#userEnterBtn').evaluate(el=>getComputedStyle(el,'::before').transform);
    assert.notEqual(rotation1,rotation2,'spinner keeps rotating throughout a slow API request');
    authGate.resolve();
    await page.waitForFunction(()=>document.getElementById('userLoginStatus').textContent==='Cargando tu perfil…');
    assert.equal(await page.locator('#userOverlay').isVisible(),true,'profile fetch must not navigate yet');
    assert.equal(await page.locator('#clientLoginSuccess').isVisible(),false,'no success before profile response');
    profileGate.resolve();
    await page.waitForFunction(()=>document.getElementById('userEnterBtn').textContent==='Listo');
    assert.equal(await page.locator('#userOverlay').isVisible(),true,'Listo is shown BEFORE navigating');
    assert.equal(await page.locator('.brand-intro').count(),0,'Listo precedes brand animation');
    await page.waitForSelector('.brand-intro');
    await page.waitForSelector('.brand-intro',{state:'detached'});
    assert.equal(await page.locator('#clientName').textContent(),'Hola, Ana');
    assert(await page.locator('#clientName').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=26),'greeting is prominent');
    assert.equal(await page.locator('#userEnterBtn').getAttribute('aria-busy'),null);
    await page.locator('#client-tab-history').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'client-tab-history');
    assert.equal(await page.locator('.brand-intro').count(),0);
    await page.locator('#client-tab-profile').click();
    await page.getByRole('button',{name:'Ver todas',exact:false}).focus();await page.keyboard.press('Enter');
    assert(await page.evaluate(()=>document.getElementById('clientHistorySection').contains(document.activeElement)),'hidden panel origin moves focus to destination');
    assert.equal(await page.locator('#clientHistorySection').evaluate(el=>getComputedStyle(el).animationDuration),'0.2s');
    await page.evaluate(()=>{
      openedAsUser=true;
      const root=document.getElementById('adminFlavorInventory');
      root.innerHTML='<span class="stock-value" data-stock-key="a" data-stock-value="10">10</span><span class="stock-value" data-stock-key="b" data-stock-value="2">2</span>';
      DonasMotion.stock(root,'test');
    });
    assert.equal(await page.locator('.stock-changed').count(),0,'initial render is quiet');
    await page.evaluate(()=>{
      const root=document.getElementById('adminFlavorInventory'),value=root.firstElementChild;
      value.dataset.stockValue='9';value.textContent='9';DonasMotion.stock(root,'test');
    });
    assert.equal(await page.locator('.stock-changed').count(),1,'only changed stock highlights');
    assert.equal(await page.locator('.stock-changed').getAttribute('data-stock-key'),'a');
    await page.waitForTimeout(700);
    await page.evaluate(()=>DonasMotion.stock(document.getElementById('adminFlavorInventory'),'test'));
    assert.equal(await page.locator('.stock-changed').count(),0,'same stock does not replay');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{
      const root=document.getElementById('adminFlavorInventory');root.firstElementChild.dataset.stockValue='8';DonasMotion.stock(root,'test');
    });
    assert.equal(await page.locator('.stock-changed').count(),0);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{
      setClientTab('profile');
      document.getElementById('clientProfileSection').style.display='none';
      document.getElementById('clientDeliverySection').style.display='';
      clientInventoryEnforced=true;
      clientOrderVariants=[{id:'flavor-a',name:'Chocolate',unit_price_cents:100,currency_code:'USD',inventory:{counted:true,available_quantity:2}}];
      renderClientFlavors();
    });
    await page.getByRole('button',{name:'Añadir Chocolate'}).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Añadir Chocolate','cart rerender preserves focus');
    assert.equal(await page.locator('#clientFlavorList .stock-changed').count(),0,'cart quantity is not stock');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Quitar Chocolate','focus remains usable when stock limit disables plus');
    await page.evaluate(()=>{clientOrderVariants[0].inventory.available_quantity=1;renderClientFlavors();});
    assert.equal(await page.locator('#clientFlavorList .stock-changed').textContent(),'1','real customer renderer highlights changed stock');
    for(const failure of ['auth','profile']){
      authFailure=failure==='auth';profileFailure=failure==='profile';
      await page.evaluate(()=>goToUserLogin());
      await page.locator('#userEnterBtn').click();
      await page.waitForFunction(()=>!document.getElementById('userEnterBtn').disabled);
      assert.equal(await page.locator('#clientLoginSuccess').isVisible(),false,`${failure} error cannot show success`);
      assert.equal(await page.locator('#userOverlay').isVisible(),true);
    }
    assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.getTiming().iterations===Infinity).length),0,'no infinite motion');
    assert.deepEqual(errors,[]);
    await context.close();
    for(const mode of ['widget','admin','storage','hidden','reduce']){
      const c=await browser.newContext({reducedMotion:mode==='reduce'?'reduce':'no-preference'});
      const p=await c.newPage();
      await p.route('**/api/**',r=>r.fulfill({json:{ok:true,data:{products:[],ranking:[]}}}));
      await p.route('https://**/*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
      await p.addInitScript(mode=>{
        Object.defineProperty(navigator,'deviceMemory',{value:8});
        Object.defineProperty(navigator,'connection',{value:{saveData:false,effectiveType:'4g'}});
        if(mode==='admin')sessionStorage.setItem('donasAdminAccessToken','fixture');
        if(mode==='hidden')Object.defineProperty(document,'hidden',{value:true});
        if(mode==='storage')Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};
      },mode);
      await p.goto(base+(mode==='widget'?'?source=widget':''));
      assert.equal(await p.locator('.brand-intro').count(),0,`${mode} skips introduction`);
      if(mode==='reduce'){
        await p.emulateMedia({reducedMotion:'no-preference'});await p.reload();
        assert.equal(await p.locator('.brand-intro').count(),0,'enabling motion cannot replay a skipped session');
      }
      await c.close();
    }
    console.log('PASS: API states, focus, navigation, stock, finite motion and operational/lite sessions');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
