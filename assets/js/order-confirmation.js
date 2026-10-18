/* Receipts follow verified server responses; recovery keeps the original payload/key. */
(() => {
  'use strict';
  const CODE=/^DR-[0-9A-F]{10}$/,el=id=>document.getElementById(id),dialog=el('clientOrderConfirmation');
  const recordKey=(owner=currentClient?.id)=>`donas-order:${owner || ''}`;
  let displayed=null,generation=0,controller=null,fresh=false,linked=false,requestedCode=null,lastRendered=null;
  const sameOwner=(owner,token)=>openedAsUser && owner===currentClient?.id && token===sessionStorage.getItem('donasCustomerToken');
  function read(owner){try{return JSON.parse(sessionStorage.getItem(recordKey(owner)) || 'null');}catch(_){return null;}}
  function write(value,owner){sessionStorage.setItem(recordKey(owner),JSON.stringify(value));}
  function lock(locked){document.querySelectorAll('#clientDeliveryLocation,#clientDeliveryNotes,input[name="clientPayment"],#clientFlavorList button').forEach(control=>{control.disabled=locked;});}
  function render(order){
    const api=window.DonasCustomerOrders;displayed=order;
    const signature=JSON.stringify([fresh,order.public_code,order.status,order.payment_status,order.payment_method,order.total_cents,order.currency_code,order.delivery_location,order.order_items,order.order_events]);
    if(signature===lastRendered)return;lastRendered=signature;
    const previousEvents=el('confirmedOrderDetails').querySelector('.confirmation-events');
    const eventsOpen=previousEvents?.open,eventsFocused=previousEvents?.querySelector('summary')===document.activeElement;
    el('confirmedOrderTitle').textContent=order.status==='CANCELLED'?'Pedido cancelado':order.status==='COMPLETED'?'¡Pedido entregado!':fresh?'¡Pedido realizado!':'Tu pedido';
    el('confirmedOrderCode').textContent=order.public_code;
    el('confirmedOrderState').textContent=`${clientOrderStatus(order.status)} · ${api?.payment(order) || 'Consulta el estado del pago.'}`;
    el('confirmedOrderWhatsapp').href=api?.whatsapp(order.public_code) || 'https://wa.me/50760887856?text='+encodeURIComponent(`Hola, quisiera consultar el pedido ${order.public_code} en Drachas.`);
    el('confirmedOrderWhatsapp').hidden=false;el('confirmedOrderFollow').hidden=false;dialog.dataset.status=order.status;
    if(['CANCELLED','COMPLETED'].includes(order.status))dialog.classList.remove('animate-confirmation');
    const rows=(order.order_items || []).map(item=>`<li><span>${Number(item.quantity) || 0} × ${safe(item.variant_name_snapshot || 'Dona')}</span>${Number.isInteger(item.line_total_cents)?`<b>${safe(formatMoney(item.line_total_cents,order.currency_code || 'USD'))}</b>`:''}</li>`).join('');
    const events=(order.order_events || []).filter(event=>event.to_status).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
    el('confirmedOrderDetails').innerHTML=`${rows?`<ul class="confirmation-items">${rows}</ul>`:''}<div class="confirmation-total"><span>Total del pedido</span><strong>${safe(api?.money(order) || formatMoney(order.total_cents,order.currency_code || 'USD'))}</strong></div>
      ${order.delivery_location?`<p class="confirmation-location"><b>Punto de entrega</b>${safe(order.delivery_location)}</p>`:''}
      ${events.length?`<details class="confirmation-events"><summary>Actualizaciones del pedido</summary><ol>${events.map(event=>`<li><b>${safe(clientOrderStatus(event.to_status))}</b><span>${safe(fmtDateTime(event.created_at))}</span></li>`).join('')}</ol></details>`:''}`;
    const nextEvents=el('confirmedOrderDetails').querySelector('.confirmation-events');
    if(nextEvents){nextEvents.open=!!eventsOpen;if(eventsFocused)nextEvents.querySelector('summary').focus({preventScroll:true});}
  }
  async function detail(code){
    const owner=currentClient?.id,token=sessionStorage.getItem('donasCustomerToken');
    controller?.abort();controller=new AbortController();const request=++generation;
    el('confirmedOrderLoading').textContent='Consultando el detalle actualizado…';el('confirmedOrderRetry').hidden=true;
    try{
      const {order}=await customerRequest('/api/orders/'+encodeURIComponent(code),{signal:controller.signal});
      if(request!==generation || !dialog.open || !sameOwner(owner,token))return;
      if(!order || order.public_code!==code || !order.id)throw new Error('No se pudo verificar el detalle del pedido.');
      const current=window.DonasCustomerOrders?.remember(order) || order;render(current);el('confirmedOrderLoading').textContent='';
    }catch(error){
      if(request!==generation || !dialog.open || !sameOwner(owner,token) || error.name==='AbortError')return;
      if([401,403,404].includes(error.status)){
        displayed=null;el('confirmedOrderDetails').replaceChildren();el('confirmedOrderState').textContent='';el('confirmedOrderCode').textContent='';
        el('confirmedOrderTitle').textContent='No pudimos abrir este pedido';el('confirmedOrderWhatsapp').hidden=true;el('confirmedOrderFollow').hidden=true;
        dialog.classList.remove('animate-confirmation');dialog.dataset.status='UNVERIFIED';
      }
      el('confirmedOrderLoading').textContent=error.message;el('confirmedOrderRetry').hidden=false;
    }
  }
  function show(order,animate=false){
    if(!openedAsUser || !currentClient || !CODE.test(order?.public_code || ''))return;
    fresh=!!animate;linked=false;requestedCode=order.public_code;lastRendered=null;const record=read();
    const canAnimate=animate && record?.celebrated!==order.public_code && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('motion-lite');
    try{write({...record,celebrated:order.public_code});}catch(_){}
    dialog.classList.remove('animate-confirmation');render(order);if(!dialog.open)dialog.showModal();
    if(canAnimate){void dialog.offsetWidth;dialog.classList.add('animate-confirmation');}detail(order.public_code);
  }
  function open(code,{link=false}={}){
    if(!openedAsUser || !currentClient || !CODE.test(code || ''))return;
    fresh=false;linked=link || new URLSearchParams(location.search).get('order')===code;requestedCode=code;lastRendered=null;window.DonasCustomerOrders?.selected(code);
    if(link){const url=new URL(location.href);url.searchParams.set('order',code);url.searchParams.set('view','delivery');history.pushState(null,'',url);}
    dialog.classList.remove('animate-confirmation');dialog.dataset.status='UNVERIFIED';displayed=null;
    el('confirmedOrderTitle').textContent='Consultando tu pedido';el('confirmedOrderCode').textContent=code;el('confirmedOrderState').textContent='';el('confirmedOrderDetails').replaceChildren();
    el('confirmedOrderWhatsapp').hidden=true;el('confirmedOrderFollow').hidden=true;if(!dialog.open)dialog.showModal();detail(code);
  }
  function restore(){
    if(!openedAsUser || !currentClient)return;
    const record=read(),retry=el('clientOrderRetry'),view=el('clientOrderView');retry.hidden=!record?.pending;
    if(record?.pending){lock(true);el('clientOrderButton').disabled=true;if(!el('clientOrderMessage').textContent)el('clientOrderMessage').textContent='Hay un envío sin verificar. Recupera ese intento antes de hacer otro pedido.';}
    view.hidden=!CODE.test(record?.confirmed || '');if(!view.hidden)view.onclick=()=>open(record.confirmed);
  }
  function reset(){
    generation++;controller?.abort();controller=null;displayed=null;fresh=false;linked=false;requestedCode=null;lastRendered=null;if(dialog.open)dialog.close();
    dialog.classList.remove('animate-confirmation');dialog.dataset.status='UNVERIFIED';el('confirmedOrderDetails').replaceChildren();el('confirmedOrderState').textContent='';el('confirmedOrderCode').textContent='';
    el('confirmedOrderLoading').textContent='';el('clientOrderView').hidden=true;el('clientOrderRetry').hidden=true;
  }
  dialog.addEventListener('close',()=>{
    generation++;controller?.abort();controller=null;
    if(linked){const url=new URL(location.href);url.searchParams.delete('order');history.replaceState(null,'',url);}linked=false;window.DonasCustomerOrders?.selected(null);
  });
  window.DonasOrderFeedback={read,write,lock,show,restore,open,reset,retryDetail:()=>{if(requestedCode)detail(requestedCode);},
    route:()=>{if(linked && !new URLSearchParams(location.search).has('order') && dialog.open)dialog.close();},
    update:order=>{if(dialog.open && displayed?.public_code===order.public_code)render({...displayed,...order});},
    follow:()=>{const code=displayed?.public_code;dialog.close();setClientTab('delivery');const card=[...document.querySelectorAll('[data-order-code]')].find(node=>node.dataset.orderCode===code);if(card){card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});card.querySelector('h3')?.focus({preventScroll:true});}}
  };
})();
