/* Manual web stock and delivery controls; no background stock synchronization. */
let adminOrders = [];
let adminOrdersLoading = false;
let adminInventoryLoading = false;
const inventorySkus = ['DR-CHOCOLATE','DR-VAINILLA','DR-CHOCOLATE-CHISPAS','DR-VAINILLA-CHISPAS'];

async function adminRequest(path, method='GET', body, retried=false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(path, {method, signal:controller.signal, headers:{
      accept:'application/json', 'content-type':'application/json',
      authorization:`Bearer ${sessionStorage.getItem('donasAdminAccessToken') || ''}`
    }, ...(body ? {body:JSON.stringify(body)} : {})});
    if (response.status === 401 && !retried && sessionStorage.getItem('donasAdminRefreshToken')) {
      const session = await vercelPost('/api/auth/session', {grantType:'refresh_token',refreshToken:sessionStorage.getItem('donasAdminRefreshToken')});
      sessionStorage.setItem('donasAdminAccessToken',session.accessToken);
      sessionStorage.setItem('donasAdminRefreshToken',session.refreshToken);
      return adminRequest(path,method,body,true);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message || 'No pudimos completar la operación.');
    return payload.data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La conexión tardó demasiado. Actualiza para comprobar si se guardó.');
    throw error;
  } finally { clearTimeout(timeout); }
}

async function loadAdminInventory() {
  if (adminInventoryLoading) return;
  adminInventoryLoading = true;
  const root = document.getElementById('adminFlavorInventory');
  const notice = document.getElementById('adminInventoryNotice');
  const save = document.getElementById('saveInventoryButton');
  save.disabled = true; notice.textContent = 'Consultando inventario…';
  try {
    const {flavors} = await adminRequest('/api/admin/customers/inventory');
    root.innerHTML = inventorySkus.map(sku => {
      const row = flavors.find(item => item.sku === sku);
      if (!row) throw new Error('Falta un sabor en el catálogo.');
      const physical = Math.max(0, Number(row.opening_quantity) + Number(row.purchased_quantity) - Number(row.sold_quantity));
      return `<label class="inventory-count-card"><span class="cart-donut ${flavorTone(row.name)}" aria-hidden="true"><span class="mini-donut"></span></span><b>${safe(row.name)}</b><small>${row.counted ? `<span class="stock-value" data-stock-key="${sku}-available" data-stock-value="${Math.max(0,Number(row.available_quantity))}">${Math.max(0,Number(row.available_quantity))}</span> disponibles · <span class="stock-value" data-stock-key="${sku}-reserved" data-stock-value="${Number(row.reserved_quantity)}">${Number(row.reserved_quantity)}</span> apartadas` : 'Primer conteo pendiente'}</small><input class="field" id="count-${sku}" type="number" min="0" max="100000" step="1" inputmode="numeric" value="${row.counted ? physical : ''}" placeholder="0" aria-label="Conteo físico de ${safe(row.name)}"></label>`;
    }).join('');
    window.DonasMotion?.stock(root, 'admin');
    notice.textContent = 'Cuenta lo que tienes físicamente. Las reservas se descuentan por separado.';
    save.disabled = false;
  } catch(error) { notice.textContent = error.message; }
  finally { adminInventoryLoading = false; }
}

async function saveAdminInventory() {
  const button = document.getElementById('saveInventoryButton');
  if (button.disabled) return;
  const counts = {};
  for (const sku of inventorySkus) {
    const value = document.getElementById('count-'+sku)?.value;
    if (value == null || !/^\d+$/.test(value) || Number(value)>100000) {
      document.getElementById('adminInventoryNotice').textContent = 'Completa los cuatro sabores. Escribe 0 cuando no queden.'; return;
    }
    counts[sku] = Number(value);
  }
  button.disabled = true; button.classList.add('is-busy');
  try {
    await adminRequest('/api/admin/customers/inventory','POST',{counts});
    await loadAdminInventory();
    document.getElementById('adminInventoryNotice').textContent = '✓ Inventario guardado. Los clientes ya pueden consultar estas cantidades.';
    showToast('Inventario actualizado');
  } catch(error) { document.getElementById('adminInventoryNotice').textContent = error.message; }
  finally { button.disabled = false; button.classList.remove('is-busy'); }
}

async function loadAdminOrders() {
  if (adminOrdersLoading) return;
  adminOrdersLoading = true;
  const root = document.getElementById('adminOrdersList');
  const notice = document.getElementById('adminOrdersNotice');
  root.setAttribute('aria-busy','true'); notice.textContent = 'Consultando pedidos…';
  try {
    const filter = document.getElementById('adminOrderFilter').value;
    const query = filter !== 'ALL' ? `&status=${filter}` : '';
    adminOrders = (await adminRequest('/api/admin/orders?limit=100'+query)).orders || [];
    const visible = adminOrders.filter(order => filter !== 'ACTIVE' || !['COMPLETED','CANCELLED'].includes(order.status));
    root.innerHTML = visible.length ? visible.map(renderAdminOrder).join('') : '<div class="empty"><span class="brand-mark" aria-hidden="true"></span><h3>Todo al día</h3><p>No hay pedidos en esta vista.</p></div>';
    notice.textContent = `${visible.length} pedidos · actualizado ${new Date().toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit'})}`;
  } catch(error) { notice.textContent = error.message; }
  finally { adminOrdersLoading = false; root.removeAttribute('aria-busy'); }
}

function renderAdminOrder(order) {
  const paid = order.payment_status === 'CONFIRMED';
  const items = (order.order_items || []).map(item => `<li><strong>${Number(item.quantity)}×</strong> ${safe(item.variant_name_snapshot)}</li>`).join('');
  const action = (label,status,primary=false) => `<button class="btn ${primary ? 'btn-primary' : 'btn-outline'}" data-order="${safe(order.id)}" data-status="${status}">${label}</button>`;
  let actions = '';
  if (order.status === 'PENDING') actions = action('Aceptar pedido','ACCEPTED',true) + action('Cancelar','CANCELLED');
  if (order.status === 'ACCEPTED') actions = action('Voy en camino','OUT_FOR_DELIVERY',true) + action('Cancelar','CANCELLED');
  if (order.status === 'OUT_FOR_DELIVERY') actions = `<label class="field-label">Cobrado por<select class="field" id="payment-${safe(order.id)}" ${paid?'disabled':''}><option value="CASH" ${order.payment_method==='CASH'?'selected':''}>Efectivo</option><option value="YAPPY" ${order.payment_method==='YAPPY'?'selected':''}>Yappy</option></select></label>` + action('Cobrado y entregado','COMPLETED',true);
  return `<article class="delivery-card"><div class="operations-heading"><span class="order-status status-${safe(order.status)}">${safe(clientOrderStatus(order.status))}</span><small>${safe(order.public_code)}</small></div><h3>${safe(order.customer_name_snapshot)}</h3><p class="muted">${safe(order.customer_phone_snapshot)} · ${safe(new Date(order.created_at).toLocaleString('es-PA',{dateStyle:'short',timeStyle:'short'}))}</p><ul class="delivery-items">${items}</ul><p class="delivery-location">📍 ${safe(order.delivery_location)}</p>${order.customer_notes ? `<p class="muted">${safe(order.customer_notes)}</p>` : ''}<div class="order-total"><strong>${formatMoney(order.total_cents)}</strong><span>${paid?'Cobrado':(order.payment_method==='YAPPY'?'Yappy al recibir':'Efectivo al recibir')}</span></div><div class="order-actions">${actions}</div></article>`;
}

function confirmDeliveryAction(title,message,label) {
  const dialog = document.createElement('dialog');
  dialog.className = 'delivery-confirm';
  dialog.setAttribute('aria-label',title);
  dialog.innerHTML = `<span class="brand-mark" aria-hidden="true"></span><h2>${safe(title)}</h2><p>${safe(message)}</p><form method="dialog"><button class="btn btn-outline" value="cancel" autofocus>Volver</button><button class="btn btn-primary" value="confirm">${safe(label)}</button></form>`;
  document.body.append(dialog);
  return new Promise(resolve => {
    dialog.addEventListener('close',()=>{const confirmed=dialog.returnValue==='confirm';dialog.remove();resolve(confirmed);},{once:true});
    dialog.showModal();
  });
}

document.getElementById('adminOrdersList').addEventListener('click',async event => {
  const button = event.target.closest('button[data-order]');
  if (!button || button.disabled) return;
  const order = adminOrders.find(item => item.id === button.dataset.order);
  if (!order) return;
  const status = button.dataset.status;
  const card = button.closest('.delivery-card');
  const controls = [...card.querySelectorAll('button')];
  controls.forEach(item => item.disabled=true);
  try {
    const body = {status};
    if (status === 'COMPLETED') {
      body.paymentReceived = true;
      body.paymentMethod = document.getElementById('payment-'+order.id).value;
      if (!await confirmDeliveryAction('¿Ya cobraste y entregaste?',`${order.customer_name_snapshot} · ${formatMoney(order.total_cents)} en ${body.paymentMethod==='YAPPY'?'Yappy':'efectivo'}. Se cerrará el pedido y se aplicarán los puntos y la racha que correspondan.`, 'Sí, finalizar')) return;
    } else if(status === 'CANCELLED' && !await confirmDeliveryAction('Cancelar pedido','Las donas reservadas volverán a estar disponibles.','Cancelar pedido')) return;
    button.classList.add('is-busy');
    await adminRequest(`/api/admin/orders/${order.id}/status`,'POST',body);
    showToast(status==='COMPLETED'?'✓ Entrega finalizada':'Pedido actualizado');
    await loadAdminOrders();
  } catch(error) { document.getElementById('adminOrdersNotice').textContent=error.message; }
  finally { controls.forEach(item=>item.disabled=false);button.classList.remove('is-busy'); }
});
