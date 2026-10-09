const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('assets/js/catalog-realtime.js','utf8');
const flush=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
function fixture(enabled=true) {
  const timers=new Map(),events={},docEvents={},channels=[];
  let timerId=0,configReads=0,stockReads=0,catalogReads=0,removed=0,disconnected=0,options;
  const client={realtime:{disconnect(){disconnected++;}},removeChannel(channel){removed++;channel.status('CLOSED');return Promise.resolve();},
    channel(name){const c={name,on(type,filter,callback){c.type=type;c.filter=filter;c.changed=callback;return c;},
      subscribe(callback){c.status=callback;return c;}};channels.push(c);return c;}};
  const context={Promise,Math,window:{supabase:{createClient(url,key,opts){options=opts;return client;}},
    addEventListener:(name,callback)=>events[name]=callback},document:{hidden:false,addEventListener:(name,callback)=>docEvents[name]=callback},
    navigator:{onLine:true},setTimeout:(callback,delay)=>{timers.set(++timerId,{callback,delay});return timerId;},
    clearTimeout:id=>timers.delete(id),refreshSharedStock:()=>{stockReads++;},refreshPublicCatalog:()=>{catalogReads++;},
    vercelApi:async()=>{configReads++;return {enabled,url:'https://project.supabase.co',anonKey:'PUBLIC_ONLY'};}};
  vm.runInNewContext(source,context);
  return {context,events,docEvents,channels,timers,
    stats:()=>({configReads,stockReads,catalogReads,removed,disconnected,options}),
    run(delay){const entry=[...timers.entries()].find(([,t])=>t.delay===delay);assert(entry,'Expected timer '+delay);
      timers.delete(entry[0]);entry[1].callback();}};
}
(async()=>{
  const f=fixture();await flush();assert.equal(f.channels.length,1);
  const first=f.channels[0];assert.equal(first.type,'postgres_changes');
  assert.deepEqual(JSON.parse(JSON.stringify(first.filter)),{event:'*',schema:'public',table:'product_variants'});
  assert.deepEqual(JSON.parse(JSON.stringify(f.stats().options.auth)),
    {persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
  first.status('SUBSCRIBED');first.changed();first.changed();
  assert.equal(f.timers.size,1,'burst events and initial catch-up coalesce');
  f.run(250);assert.equal(f.stats().stockReads,1);assert.equal(f.stats().catalogReads,1);
  f.events.online();f.events.pageshow();await flush();assert.equal(f.channels.length,1,'no duplicate channels');
  f.context.document.hidden=true;f.docEvents.visibilitychange();
  first.changed();first.status('CHANNEL_ERROR');assert.equal(f.timers.size,0,'late callbacks do not reconnect hidden pages');
  assert.equal(f.context.window.__donasCatalogRealtimeReady,false);
  f.context.document.hidden=false;f.docEvents.visibilitychange();await flush();assert.equal(f.channels.length,2);
  f.channels[1].status('SUBSCRIBED');f.run(250);assert.equal(f.stats().catalogReads,2,'resume recovers missed changes');
  f.channels[1].status('CHANNEL_ERROR');f.run(2000);await flush();assert.equal(f.channels.length,3);
  f.channels[2].status('TIMED_OUT');f.run(4000);await flush();assert.equal(f.channels.length,4,'retry backoff grows');
  f.channels[3].status('SUBSCRIBED');f.run(250);
  f.context.navigator.onLine=false;f.events.offline();assert.equal(f.timers.size,0);
  f.context.navigator.onLine=true;f.events.online();await flush();assert.equal(f.channels.length,5);
  f.channels[4].status('SUBSCRIBED');f.run(250);f.events.pagehide();
  assert.equal(f.timers.size,0);assert(f.stats().removed>=4);assert(f.stats().disconnected>=4);
  assert.equal(f.stats().configReads,1,'configuration cached across reconnects');
  const disabled=fixture(false);await flush();assert.equal(disabled.channels.length,0);assert.equal(disabled.timers.size,0);
  console.log('PASS catalog realtime: public channel, burst coalescing, reconnect recovery/backoff, stale callbacks, offline/hidden cleanup and no session storage');
})().catch(error=>{console.error(error);process.exitCode=1;});
