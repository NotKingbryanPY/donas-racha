const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base='http://127.0.0.1:8765',variant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const anon=[Buffer.from('{"alg":"HS256"}').toString('base64url'),
  Buffer.from('{"role":"anon"}').toString('base64url'),'test_signature'].join('.');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
    const errors=[],connections=[];let name='Chocolate',offered=true,inventoryReads=0;
    page.on('pageerror',error=>errors.push(error.message));
    await page.routeWebSocket('wss://project.supabase.co/**',socket=>{
      const connection={socket,topic:null,pack:null};connections.push(connection);
      socket.onMessage(raw=>{
        const message=JSON.parse(String(raw));
        const array=Array.isArray(message);
        const [join,ref,topic,event,payload]=array ? message :
          [message.join_ref,message.ref,message.topic,message.event,message.payload];
        const pack=(event,data,replyRef=ref)=>JSON.stringify(array ? [join,replyRef,topic,event,data] :
          {join_ref:join,ref:replyRef,topic,event,payload:data});
        if (event==='phx_join') {
          assert.equal(payload.config.postgres_changes.length,1);
          assert.equal(payload.config.postgres_changes[0].table,'product_variants');
          connection.topic=topic;connection.pack=pack;
          socket.send(pack('phx_reply',{status:'ok',response:{postgres_changes:[
            {id:1,event:'*',schema:'public',table:'product_variants'}
          ]}}));
        } else if (event==='heartbeat' || event==='phx_leave') {
          socket.send(pack('phx_reply',{status:'ok',response:{}}));
        }
      });
    });
    const client={id:'CPILOT123',username:'ana.test',name:'Ana',pointsTotal:250,pointsAvailable:150,currentStreak:2,shopItems:[],recentHistory:[]};
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin!==base)return route.fulfill({body:'',contentType:'text/javascript'});
      const answer=data=>route.fulfill({json:{ok:true,data}});
      if(url.pathname==='/api/customer/session')return answer({accessToken:'test',customer:{publicId:client.id,username:client.username}});
      if(url.pathname==='/api/backend')return answer({ok:true,client});
      if(url.pathname==='/api/customer/onboarding')return answer({progress:{status:'COMPLETED',last_step:7}});
      if(url.pathname==='/api/products') {
        if(url.searchParams.get('view')==='realtime')return answer({enabled:true,url:'https://project.supabase.co',anonKey:anon});
        if(url.searchParams.get('view')==='inventory') {inventoryReads++;return answer({enforced:true,flavors:[
          {variant_id:variant,name,offered,available_quantity:10,counted:true}
        ]});}
        return answer({products:[{name:'Donas',product_variants:[{id:variant,name,available:offered,active:true,unit_price_cents:100,currency_code:'USD'}]}]});
      }
      if(url.pathname.startsWith('/api/'))return answer({ranking:[],products:[]});
      return route.continue();
    });
    await page.goto(base+'/?profile=1');
    await page.waitForFunction(()=>window.__donasCatalogRealtimeReady===true);
    assert.equal(await page.evaluate(()=>typeof window.supabase.createClient),'function','real self-hosted SDK loads');
    await page.locator('#userClientIdInput').fill(client.username);await page.locator('#userEnterBtn').click();
    await page.waitForFunction(()=>openedAsUser&&currentClient);await page.locator('#client-top-delivery').click();
    await page.locator('#clientFlavorList button[aria-label="Añadir Chocolate"]').click();
    await page.locator('#clientFlavorList button[aria-label="Añadir Chocolate"]').click();
    const before=inventoryReads;name='Chocolate actualizado';offered=false;
    for(let n=0;n<5;n++)connections[0].socket.send(connections[0].pack('postgres_changes',{ids:[1],data:{
      schema:'public',table:'product_variants',commit_timestamp:new Date().toISOString(),type:'UPDATE',
      new:{id:variant,name,available:false},old:{id:variant}
    }},null));
    await page.waitForFunction(()=>clientOrderVariants[0].name==='Chocolate actualizado');
    assert.equal(await page.evaluate(id=>customerOrderQuantities.get(id),variant),2,'cart survives live rename/disable');
    assert.equal(await page.evaluate(()=>clientOrderVariants[0].available),false);
    assert.equal(inventoryReads,before+1,'burst creates one inventory refresh');
    name='Cambio durante corte';offered=true;connections[0].socket.close();
    await page.waitForFunction(()=>clientOrderVariants[0].name==='Cambio durante corte',{},{timeout:10000});
    assert(connections.length>=2,'real SDK reconnects and catches up without a new database event');
    assert.equal(await page.evaluate(id=>customerOrderQuantities.get(id),variant),2);
    await context.setOffline(true);await page.waitForFunction(()=>window.__donasCatalogRealtimeReady===false);
    await context.setOffline(false);await page.waitForFunction(()=>window.__donasCatalogRealtimeReady===true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
    await context.close();console.log('PASS real browser SDK: public-only subscription, rename/disable, burst refresh, cart preservation and reconnect/offline recovery');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
