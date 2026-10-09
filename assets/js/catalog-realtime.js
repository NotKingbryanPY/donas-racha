/* Realtime invalidates the catalog; the existing API remains the source for rendered data. */
(() => {
  let client=null,channel=null,epoch=0,starting=null,config=null,sdkPromise=null;
  let refreshTimer=null,retryTimer=null,retryDelay=2000;
  const visible=()=>!document.hidden && navigator.onLine;
  const refresh=()=>{ refreshSharedStock(); refreshPublicCatalog(); };
  const scheduleRefresh=()=>{
    if (!visible() || refreshTimer!==null) return;
    refreshTimer=setTimeout(()=>{ refreshTimer=null; if (visible()) refresh(); },250);
  };
  function loadSDK() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    if (!sdkPromise) sdkPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='assets/vendor/supabase-2.117.3.js';
      script.async=true;
      script.onload=()=>window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('SDK unavailable'));
      script.onerror=()=>{ script.remove(); sdkPromise=null; reject(new Error('SDK unavailable')); };
      document.head.appendChild(script);
    });
    return sdkPromise;
  }
  function stop() {
    epoch++;
    starting=null;
    window.__donasCatalogRealtimeReady=false;
    clearTimeout(refreshTimer); refreshTimer=null;
    clearTimeout(retryTimer); retryTimer=null;
    const previous=channel; channel=null;
    if (client) {
      if (previous) Promise.resolve(client.removeChannel(previous)).catch(()=>{});
      client.realtime.disconnect();
    }
  }
  function retry() {
    stop();
    if (!visible()) return;
    const delay=retryDelay;
    retryDelay=Math.min(retryDelay*2,60000);
    retryTimer=setTimeout(()=>{ retryTimer=null; start(); },delay);
  }
  async function start() {
    if (!visible() || channel || starting!==null || retryTimer!==null) return;
    const generation=epoch;
    starting=generation;
    try {
      if (config===null) config=await vercelApi('/api/products',{view:'realtime'});
      if (generation!==epoch || !visible() || !config.enabled) return;
      const sdk=await loadSDK();
      if (generation!==epoch || !visible()) return;
      if (!client) client=sdk.createClient(config.url,config.anonKey,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
        realtime:{params:{eventsPerSecond:2}}
      });
      channel=client.channel('donas-public-catalog')
        .on('postgres_changes',{event:'*',schema:'public',table:'product_variants'},()=>{
          if (generation===epoch) scheduleRefresh();
        });
      channel.subscribe(status=>{
        if (generation!==epoch) return;
        if (status==='SUBSCRIBED') {
          retryDelay=2000;
          window.__donasCatalogRealtimeReady=true;
          scheduleRefresh(); // Recover changes missed before connecting or during a cut.
        } else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) retry();
      });
    } catch (_) {
      if (generation===epoch) retry(); // The existing visible-page fallback still runs.
    } finally {
      if (starting===generation) starting=null;
    }
  }
  window.addEventListener('offline',stop);
  window.addEventListener('online',start);
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',start);
  document.addEventListener('visibilitychange',()=>document.hidden ? stop() : start());
  start();
})();
