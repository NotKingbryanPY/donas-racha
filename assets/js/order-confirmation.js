/* Confirm only validated server responses. A saved attempt always reuses its exact payload/key. */
(() => {
  const recordKey=()=>`donas-order:${currentClient?.id || ''}`;
  function read() { try {return JSON.parse(sessionStorage.getItem(recordKey()) || 'null');} catch (_) {return null;} }
  function write(value) {sessionStorage.setItem(recordKey(),JSON.stringify(value));}
  function lock(locked) {
    document.querySelectorAll('#clientDeliveryLocation,#clientDeliveryNotes,input[name="clientPayment"],#clientFlavorList button')
      .forEach(control=>{control.disabled=locked;});
  }
  function show(order,animate) {
    const dialog=document.getElementById('clientOrderConfirmation');
    document.getElementById('confirmedOrderCode').textContent=order.public_code;
    document.getElementById('confirmedOrderState').textContent=`${clientOrderStatus(order.status)} · ${formatMoney(order.total_cents,order.currency_code || 'USD')}. El pago se confirma al recibir.`;
    const message=`Hola, realicé un pedido en Donas Racha. Quisiera consultar su estado. Mi número de pedido es ${order.public_code}.`;
    document.getElementById('confirmedOrderWhatsapp').href='https://wa.me/50760887856?text='+encodeURIComponent(message);
    dialog.classList.toggle('animate-confirmation',!!animate && !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('motion-lite'));
    if (!dialog.open) dialog.showModal();
  }
  async function restore() {
    const record=read(); const retry=document.getElementById('clientOrderRetry');
    retry.hidden=!record?.pending;
    if (record?.pending) {
      lock(true);
      document.getElementById('clientOrderMessage').textContent='Hay un envío sin verificar. Recupera ese intento para conocer su resultado antes de hacer otro pedido.';
      document.getElementById('clientOrderButton').disabled=true;
      return;
    }
    if (!record?.confirmed) return;
    try {
      const {order}=await customerRequest('/api/orders/'+encodeURIComponent(record.confirmed));
      const message=document.getElementById('clientOrderMessage');
      if (!message.textContent) message.textContent=`Pedido ${order.public_code} · ${clientOrderStatus(order.status)}.`;
      const view=document.getElementById('clientOrderView'); view.hidden=false;
      view.onclick=()=>show(order,false);
    } catch (_) { /* Current orders remain the source of truth; no success guessed from storage. */ }
  }
  window.DonasOrderFeedback={read,write,lock,show,restore};
})();
