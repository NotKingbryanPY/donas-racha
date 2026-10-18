/* Owner-scoped tracking; only authenticated API responses supply order state. */
(() => {
  'use strict';
  const ACTIVE=new Set(['PENDING','ACCEPTED','OUT_FOR_DELIVERY']), CODE=/^DR-[0-9A-F]{10}$/;
  const el=id=>document.getElementById(id);
  let owner=null,token=null,epoch=0,timer=null,controller=null,flight=null;
  let active=[],history=[],known=new Map(),seen=new Set(),ready=false,historyLoaded=false,activeMarkup='',historyMarkup='';
  let activeOffset=0,historyOffset=0,moreActive=false,moreHistory=false,failures=0,checkedAt=null,authError=false,view='profile',deepLink=null;
  const validOwner=()=>!!owner && openedAsUser && currentClient?.id===owner && sessionStorage.getItem('donasCustomerToken')===token && el('screen-client').classList.contains('active');
  const visible=()=>validOwner() && !document.hidden && navigator.onLine;
  const isActive=order=>ACTIVE.has(order.status);
  const revision=order=>{
    const value=order.updated_at || order.created_at || '', ms=Date.parse(value);
    return Number.isFinite(ms)?ms*1000+Number((String(value).match(/\.(\d+)/)?.[1] || '').padEnd(6,'0').slice(3,6)):0;
  };
  const versionKey=order=>`${order.public_code}:${order.status}:${order.updated_at || order.created_at || ''}`;
  const seenStorage=()=>`donas-customer-order-seen:${owner}`;
  function readSeen(){try{const data=JSON.parse(localStorage.getItem(seenStorage()) || '{}');return data && typeof data==='object' && !Array.isArray(data)?data:{};}catch(_){return {};}}
  function recordSeen(order){
    seen.add(versionKey(order));
    while(seen.size>300)seen.delete(seen.keys().next().value);
    try{const records=readSeen();records[order.public_code]=versionKey(order);localStorage.setItem(seenStorage(),JSON.stringify(Object.fromEntries(Object.entries(records).slice(-100))));}catch(_){}
  }
  function money(order){return Number.isInteger(order.total_cents)?formatMoney(order.total_cents,order.currency_code || 'USD'):'Total por consultar';}
  function payment(order){
    const method=({CASH:'Efectivo',YAPPY:'Yappy'})[order.payment_method];
    if(order.payment_status==='CONFIRMED')return `Pago confirmado${method?' · '+method:''}`;
    if(order.payment_status==='FAILED')return 'Pago no confirmado · contacta al equipo';
    if(order.status==='CANCELLED')return 'Pedido cancelado · consulta el detalle de pago';
    if(order.payment_status!=='PENDING')return 'Estado del pago por consultar';
    return method?`${method} al recibir · pago pendiente`:'Pago pendiente · al recibir';
  }
  function copy(order){return ({
    PENDING:['¡Ya recibimos tu pedido!','Estamos revisando tu pedido. Su estado se actualizará aquí.'],
    ACCEPTED:['Tu pedido está confirmado','El equipo aceptó tu pedido. Te avisaremos aquí cuando salga para entrega.'],
    OUT_FOR_DELIVERY:['¡Tus donas van en camino!','Revisa el punto de entrega que indicaste en el Edificio 4.'],
    COMPLETED:['¡Gracias por tu pedido!','Tu pedido fue entregado. Puedes consultar sus detalles.'],
    CANCELLED:['Este pedido fue cancelado','Contacta al equipo si necesitas ayuda o conocer el motivo.']
  })[order.status] || ['Estamos consultando su estado','Actualiza para comprobar el estado de este pedido.'];}
  function timeline(order){
    const states=['PENDING','ACCEPTED','OUT_FOR_DELIVERY','COMPLETED'], current=states.indexOf(order.status);
    if(current<0)return '';
    return `<ol class="customer-order-timeline" aria-label="Estado del pedido">${states.map((status,i)=>`<li class="${i<=current?'is-done':''} ${i===current?'is-current':''}" ${i===current?'aria-current="step"':''}><span aria-hidden="true">${i+1}</span><b>${safe(clientOrderStatus(status))}</b></li>`).join('')}</ol>`;
  }
  function whatsapp(code){return 'https://wa.me/50760887856?text='+encodeURIComponent(`Hola, realicé un pedido en Drachas. Quisiera consultar su estado. Mi número de pedido es ${code}.`);}
  function card(order){
    const [title,description]=copy(order),quantity=(order.order_items || []).reduce((sum,item)=>sum+Number(item.quantity || 0),0);
    return `<article class="customer-order-card" data-order-code="${safe(order.public_code)}" data-status="${safe(order.status)}">
      <div class="customer-order-labels"><span class="customer-order-code">${safe(order.public_code)}</span><span class="customer-order-tag">${safe(clientOrderStatus(order.status))}</span></div>
      <div class="customer-order-hero"><div><h3 tabindex="-1">${safe(title)}</h3><p>${safe(description)}</p></div><img src="assets/images/donut-hero-small.webp" alt="" width="88" height="88" loading="lazy"></div>
      ${timeline(order)}<div class="customer-order-total"><span>${quantity} ${quantity===1?'dona':'donas'}</span><strong>${safe(money(order))}</strong></div>
      <p class="customer-order-payment">${safe(payment(order))}</p>${order.delivery_location?`<p class="customer-order-location">↗ ${safe(order.delivery_location)}</p>`:''}
      <div class="customer-order-actions"><button type="button" class="btn btn-primary" data-view-order="${safe(order.public_code)}">Ver mi pedido <span aria-hidden="true">→</span></button><a class="btn btn-outline" href="${whatsapp(order.public_code)}" target="_blank" rel="noopener noreferrer">Contactar</a></div></article>`;
  }
  function remember(order){
    if(!order || !CODE.test(order.public_code || ''))return null;
    const previous=known.get(order.public_code);
    if(previous && revision(order)<revision(previous))return previous;
    if(previous && revision(order)===revision(previous) && ['COMPLETED','CANCELLED'].includes(previous.status) && isActive(order))return previous;
    const merged={...previous,...order};known.set(order.public_code,merged);
    while(known.size>200)known.delete(known.keys().next().value);
    window.DonasOrderFeedback?.update(merged);return merged;
  }
  function health(message,stale=false){el('customerOrdersStatus').textContent=message;el('customerOrdersStatus').classList.toggle('is-stale',stale);}
  function offline(){clearTimeout(timer);timer=null;controller?.abort();if(validOwner())health(checkedAt?'Sin conexión · mostrando la última consulta. El estado puede haber cambiado.':'Sin conexión · conecta para consultar tus pedidos.',true);}
  function render(){
    if(!validOwner())return;
    if(!ready){el('customerActiveOrderBanner').hidden=true;return;}
    const focused=document.activeElement?.getAttribute('data-view-order'),total=activeOffset+active.length,count=moreActive?`${total}+`:String(total);
    const badge=el('customerOrderCount');badge.hidden=!total && !moreActive;badge.textContent=count;badge.setAttribute('aria-label',`${count} pedidos activos`);
    el('customerOrderTabHint').textContent=total===1?clientOrderStatus(active[0]?.status):total?`${count} pedidos activos`:'Pedir y ver mi estado';
    el('customerActiveOrderBanner').hidden=!total || view==='delivery';
    el('customerActiveOrderLabel').textContent=total===1?`Tienes un pedido · ${clientOrderStatus(active[0]?.status)}`:`Tienes ${count} pedidos activos`;
    el('customerOrdersEyebrow').textContent=total===1?'TIENES UN PEDIDO ACTIVO':total?`TIENES ${count} PEDIDOS ACTIVOS`:'TU PRÓXIMO ANTOJO';
    const cards=active.map(card).join('') || '<div class="customer-orders-empty"><span class="brand-mark" aria-hidden="true"></span><h3>Todo listo para tu próximo pedido</h3><p>No tienes pedidos activos. Puedes elegir tus sabores aquí abajo.</p></div>';
    if(activeMarkup!==cards){el('clientActiveOrders').innerHTML=cards;activeMarkup=cards;}
    if(historyLoaded){
      const rows=history.map(order=>`<button type="button" class="customer-history-order" data-view-order="${safe(order.public_code)}"><span><b>${safe(order.public_code)}</b><small>${safe(clientOrderStatus(order.status))} · ${safe(fmtDate(order.created_at))}</small></span><span>${safe(money(order))} <span aria-hidden="true">›</span></span></button>`).join('') || '<p class="muted">Todavía no tienes pedidos anteriores.</p>';
      if(historyMarkup!==rows){el('clientOrdersList').innerHTML=rows;historyMarkup=rows;}
    }
    if(focused && document.activeElement===document.body)[...document.querySelectorAll('[data-view-order]')].find(button=>button.dataset.viewOrder===focused)?.focus({preventScroll:true});
    for(const [kind,offset,more] of [['Active',activeOffset,moreActive],['History',historyOffset,moreHistory]]){
      el(`customer${kind}Pagination`).hidden=!offset && !more;el(`customer${kind}Previous`).disabled=!offset;el(`customer${kind}Next`).disabled=!more;
    }
  }
  async function announce(order,generation){
    const key=versionKey(order),expectedOwner=owner;
    const run=()=>{
      if(generation!==epoch || !validOwner() || owner!==expectedOwner || seen.has(key) || readSeen()[order.public_code]===key)return;
      recordSeen(order);const message=`Pedido ${order.public_code} · ${clientOrderStatus(order.status)}.`;
      el('customerOrderNoticeText').textContent=message;el('customerOrderNotice').hidden=false;
      if(!document.querySelector('dialog[open],.client-tour-layer'))showToast(message,6500);
    };
    if(navigator.locks?.request){try{await navigator.locks.request(`drachas-order-notice:${owner}`,run);}catch(_){run();}}else run();
  }
  function schedule(){
    clearTimeout(timer);timer=null;
    if(!visible() || authError || (!active.length && !moreActive && !failures))return;
    const delay=failures?Math.min(120000,15000*2**Math.min(failures,3))+Math.random()*1000:15000;
    timer=setTimeout(()=>refresh({includeHistory:view==='delivery'}),delay);
  }
  async function refresh(options={}){
    if(!validOwner())return;
    if(!navigator.onLine){offline();return;}if(document.hidden)return;
    const needsHistory=options.includeHistory ?? view==='delivery';
    if(flight){const waitingEpoch=epoch;await flight;if(waitingEpoch!==epoch)return;if(validOwner() && (options.force || (needsHistory && !historyLoaded)))return refresh({...options,force:false});return;}
    const generation=epoch,nextActive=options.activeOffset ?? activeOffset,nextHistory=options.historyOffset ?? historyOffset;
    clearTimeout(timer);timer=null;controller=new AbortController();const signal=controller.signal;
    el('clientActiveOrders').setAttribute('aria-busy','true');
    flight=(async()=>{
      try{
        const query=new URLSearchParams({activeOffset:String(nextActive),historyOffset:String(nextHistory)});if(!needsHistory)query.set('view','active');
        const result=await customerRequest('/api/customer/orders?'+query,{signal,timeoutMs:20000});
        if(generation!==epoch || !validOwner())return;
        if(!Array.isArray(result.activeOrders) && !Array.isArray(result.orders))throw new Error('La respuesta de pedidos no es válida. Vuelve a consultar.');
        const rows=result.orders || [],previous=new Map(known);
        const activeRows=result.activeOrders || rows.filter(isActive), historyRows=result.historyOrders || rows.filter(order=>!isActive(order));
        activeRows.forEach(remember);
        if(needsHistory && result.historyIncluded!==false)historyRows.forEach(remember);
        active=activeRows.map(order=>known.get(order.public_code)).filter(order=>order && isActive(order));
        activeOffset=nextActive;moreActive=!!result.hasMoreActive;
        if(needsHistory && result.historyIncluded!==false){history=historyRows.map(order=>known.get(order.public_code)).filter(order=>order && !isActive(order));historyOffset=nextHistory;moreHistory=!!result.hasMoreHistory;historyLoaded=true;}
        const observed=[...active,...(needsHistory?history:[])];
        for(const order of observed){if(generation!==epoch || !validOwner())return;const old=previous.get(order.public_code);if(ready && old && old.status!==order.status && revision(order)>=revision(old))await announce(order,generation);else if(!old || !ready)recordSeen(order);}
        const missing=[...previous.values()].filter(old=>isActive(old) && !active.some(order=>order.public_code===old.public_code) && !observed.some(order=>order.public_code===old.public_code));
        if(ready && nextActive===0 && !moreActive)await Promise.all(missing.slice(0,50).map(async old=>{
          try{const {order}=await customerRequest('/api/orders/'+encodeURIComponent(old.public_code),{signal});if(generation!==epoch || !validOwner())return;const current=remember(order);if(current && current.status!==old.status)await announce(current,generation);}catch(_){}
        }));
        if(generation!==epoch || !validOwner())return;
        ready=true;failures=0;authError=false;checkedAt=new Date();
        health('Actualización automática · última consulta '+checkedAt.toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit'}));render();window.DonasOrderFeedback?.restore();syncLink();
        if(activeOffset && !active.length){activeOffset=0;ready=false;setTimeout(()=>refresh({includeHistory:needsHistory}),0);}
      }catch(error){
        if(generation!==epoch || !validOwner())return;if(!navigator.onLine){offline();return;}if(error.name==='AbortError')return;
        authError=[401,403].includes(error.status);
        if(authError){
          active=[];history=[];known.clear();ready=false;historyLoaded=false;
          activeMarkup='';historyMarkup='';el('customerOrderNotice').hidden=true;el('customerOrderNoticeText').textContent='';
          el('clientActiveOrders').innerHTML='<p class="muted">Vuelve a entrar para consultar tus pedidos.</p>';el('clientOrdersList').textContent='La sesión necesita verificarse de nuevo.';
          el('customerOrderCount').hidden=true;el('customerActiveOrderBanner').hidden=true;window.DonasOrderFeedback?.reset();
        }else failures++;
        health(authError?'Tu sesión necesita verificarse. Vuelve a entrar desde Mi perfil.':checkedAt?'No pudimos actualizar. Mostramos la última consulta y volveremos a intentarlo.':error.message,true);
      }finally{if(generation===epoch){flight=null;controller=null;el('clientActiveOrders').setAttribute('aria-busy','false');schedule();}}
    })();return flight;
  }
  function syncLink(){
    if(!validOwner())return;
    const code=new URLSearchParams(location.search).get('order');
    if(CODE.test(code || '') && code!==deepLink && view==='delivery'){deepLink=code;window.DonasOrderFeedback?.open(code);}
    else if(!code){deepLink=null;window.DonasOrderFeedback?.route();}
  }
  function stop(){
    epoch++;clearTimeout(timer);timer=null;controller?.abort();controller=null;flight=null;owner=null;token=null;active=[];history=[];known=new Map();seen=new Set();activeMarkup='';historyMarkup='';
    ready=false;historyLoaded=false;activeOffset=0;historyOffset=0;moreActive=false;moreHistory=false;checkedAt=null;failures=0;authError=false;deepLink=null;
    el('clientActiveOrders').innerHTML='<p class="muted">Consulta tus pedidos desde tu cuenta.</p>';el('clientOrdersList').textContent='Consulta el historial desde Pedidos.';
    el('customerActiveOrderBanner').hidden=true;el('customerOrderCount').hidden=true;el('customerOrderNotice').hidden=true;
    el('customerOrderNoticeText').textContent='';el('customerActiveOrderLabel').textContent='';el('customerOrderCount').textContent='';el('customerOrderTabHint').textContent='Pedir y ver mi estado';
  }
  function start(){
    const next=currentClient?.id,nextToken=sessionStorage.getItem('donasCustomerToken');
    if(!openedAsUser || !next || !nextToken)return stop();if(owner===next && token===nextToken)return;
    stop();owner=next;token=nextToken;el('clientActiveOrders').innerHTML='<p class="muted">Cargando tus pedidos…</p>';health('Consultando tus pedidos…');refresh({includeHistory:false});
  }
  function onView(tab){view=tab;if(openedAsUser && currentClient && (owner!==currentClient.id || token!==sessionStorage.getItem('donasCustomerToken')))start();if(validOwner()){render();syncLink();}}
  document.addEventListener('click',event=>{const button=event.target.closest('[data-view-order]');if(button && validOwner())window.DonasOrderFeedback?.open(button.dataset.viewOrder,{link:true});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);timer=null;controller?.abort();}else if(validOwner())refresh();});
  window.addEventListener('offline',offline);window.addEventListener('online',()=>{if(validOwner())refresh();});
  window.addEventListener('pagehide',()=>{clearTimeout(timer);controller?.abort();});window.addEventListener('pageshow',()=>{if(validOwner())refresh();});
  window.addEventListener('storage',event=>{if(owner && event.key===seenStorage() && event.newValue)try{Object.values(JSON.parse(event.newValue)).forEach(key=>seen.add(key));}catch(_){}});
  window.DonasCustomerOrders={start,stop,onView,refresh,remember,money,payment,timeline,whatsapp,lookup:code=>known.get(code),
    page:(kind,direction)=>refresh({includeHistory:true,force:true,...(kind==='active'?{activeOffset:Math.max(0,activeOffset+direction*50)}:{historyOffset:Math.max(0,historyOffset+direction*10)})}),
    created:order=>{remember(order);activeOffset=0;refresh({includeHistory:view==='delivery',force:true});},selected:code=>{deepLink=code;}
  };
})();
