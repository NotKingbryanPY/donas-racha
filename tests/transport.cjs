const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const pending=[]; let timerCallback;
const ctx=vm.createContext({window:{},URL,AbortController,Date,
  setTimeout:fn=>{timerCallback=fn;return 1;},clearTimeout(){},
  fetch:(url,options)=>new Promise((resolve,reject)=>{
    options.signal.addEventListener('abort',()=>reject(Object.assign(new Error(),{name:'AbortError'})));
    pending.push({url,options,resolve,reject});
  })
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/js/api-client.js'),'utf8'),ctx);
const api=ctx.window.DonasApi,base='https://example.invalid/exec';
const complete=(item,data={ok:true})=>item.resolve({ok:true,json:async()=>data});
(async()=>{
  const first=api.get(base,'getRanking',{type:'racha',limit:10});
  assert.equal(first,api.get(base,'getRanking',{limit:10,type:'racha'}));
  assert.equal(pending.length,1); complete(pending.shift()); await first;
  await api.get(base,'getRanking',{type:'racha',limit:10}); assert.equal(pending.length,0,'15s cache');
  let call=api.post(base,{action:'registrarCompra'}); assert.equal(pending[0].options.method,'POST'); complete(pending.shift()); await call;
  call=api.get(base,'getRanking',{type:'racha',limit:10}); assert.equal(pending.length,1); complete(pending.shift()); await call;
  api.invalidate();
  const old=api.get(base,'getRanking'); const oldRequest=pending.shift();
  const write=api.post(base,{action:'saveConfig'}); complete(pending.shift()); await write;
  const fresh=api.get(base,'getRanking'); const freshRequest=pending.shift();
  complete(oldRequest,{ok:true,value:'old'}); await old;
  complete(freshRequest,{ok:true,value:'fresh'}); await fresh;
  assert.equal((await api.get(base,'getRanking')).value,'fresh');
  for(let i=0;i<2;i++) { call=api.get(base,'getCliente',{id:'fixture'}); complete(pending.shift()); await call; }
  call=api.get(base,'getRanking',{type:'broken'}); pending.shift().resolve({ok:false,status:503}); await assert.rejects(call,/503/);
  call=api.get(base,'getRanking',{type:'broken'}); complete(pending.shift()); await call;
  call=api.get(base,'getCliente'); pending.shift(); timerCallback(); await assert.rejects(call,/consulta tardó/);
  call=api.post(base,{action:'canjearRecompensa'}); pending.shift(); timerCallback(); await assert.rejects(call,/Verifica el resultado/);
  assert.equal(pending.length,0,'no automatic mutation retries');
  // Exercise the real openClient function with out-of-order responses.
  const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
  const functionText=html.slice(html.indexOf('async function openClient('),html.indexOf('\nfunction renderClient'));
  const wait=[],rendered=[];
  const elements=new Map();
  const ui=vm.createContext({currentClient:null,clientRequestVersion:0,openedAsUser:false,
    document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{style:{}});return elements.get(id);}},
    api:()=>new Promise((resolve,reject)=>wait.push({resolve,reject})),renderClient:c=>rendered.push(c.id),showToast(){},goToUserLogin(){},goHome(){}
  });
  vm.runInContext('function showScreen() { clientRequestVersion++; }\n'+functionText,ui);
  const a=ui.openClient('old',true),b=ui.openClient('new',true);
  wait[1].resolve({ok:true,client:{id:'new'}}); await b;
  wait[0].resolve({ok:true,client:{id:'old'}}); await a;
  assert.deepEqual(rendered,['new']);
  console.log('PASS: ranking deduplication/cache, invalidation, errors, timeout, no retry, profile response ordering');
})().catch(e=>{console.error(e);process.exit(1)});
