/* Staff redemption queue. The server decides status changes and point refunds. */
(() => {
  const list = document.getElementById('adminRedemptionsList');
  const notice = document.getElementById('adminRedemptionsNotice');
  const filter = document.getElementById('adminRedemptionFilter');
  const labels = { PENDING:'Pendiente', FULFILLED:'Entregado', CANCELLED:'Cancelado' };
  let rows = new Map();
  let requestVersion = 0;
  let saving = false;

  function render(items) {
    rows = new Map(items.map(item => [item.id,item]));
    if (!items.length) {
      list.innerHTML = '<div class="empty">No hay canjes en este estado.</div>';
      return;
    }
    list.innerHTML = items.map(item => {
      const points = Number(item.points) || 0;
      const pending = item.status === 'PENDING';
      return `<article class="admin-redemption-card">
        <div class="admin-redemption-meta"><span class="order-status status-${safe(item.status)}">${safe(labels[item.status] || item.status)}</span><small>${safe(fmtDateTime(item.createdAt))}</small></div>
        <h3>${safe(item.reward)}</h3>
        <p><b>${safe(item.customerName)}</b> · ${safe(item.customerId)}</p>
        <p class="muted">Código ${safe(item.code)} · ${points} puntos${item.status === 'CANCELLED' ? ' devueltos' : ''}</p>
        ${pending ? `<div class="admin-redemption-actions">
          <button type="button" class="btn btn-primary" data-redemption-id="${safe(item.id)}" data-redemption-status="FULFILLED">Confirmar entrega</button>
          <button type="button" class="btn btn-outline" data-redemption-id="${safe(item.id)}" data-redemption-status="CANCELLED">Cancelar y devolver ${points} pts</button>
        </div>` : ''}
      </article>`;
    }).join('');
  }

  async function loadAdminRedemptions() {
    const current = ++requestVersion;
    list.innerHTML = '<div class="empty">Cargando canjes...</div>';
    notice.textContent = '';
    try {
      const data = await api('getCanjes',{status:filter.value});
      if (current !== requestVersion) return;
      const items = data.redemptions || [];
      render(items);
      if (items.length === 200) notice.textContent = filter.value === 'PENDING'
        ? 'Se muestran los 200 canjes pendientes más antiguos.'
        : 'Se muestran los 200 canjes más recientes de este estado.';
    } catch (error) {
      if (current !== requestVersion) return;
      list.innerHTML = '<div class="empty">No se pudieron cargar los canjes.</div>';
      notice.textContent = error.message;
    }
  }

  async function resolve(item, status) {
    if (saving || item.status !== 'PENDING') return;
    const text = status === 'FULFILLED'
      ? `¿Confirmas que entregaste ${item.reward} a ${item.customerName}?`
      : `¿Cancelar el canje de ${item.reward} de ${item.customerName} y devolver ${item.points} puntos? Esta acción no se puede deshacer.`;
    if (!confirm(text)) return;
    saving = true;
    list.querySelectorAll('[data-redemption-id]').forEach(button => { button.disabled = true; });
    notice.textContent = status === 'FULFILLED' ? 'Confirmando entrega...' : 'Cancelando y devolviendo puntos...';
    try {
      const result = await apiPost('resolverCanje',{redemptionId:item.id,status});
      if (!result.ok) throw new Error(result.error || 'No se pudo actualizar el canje.');
      showToast(result.redemption.replayed ? 'El canje ya estaba actualizado'
        : status === 'FULFILLED' ? '✅ Premio entregado' : `✅ ${result.redemption.pointsReturned} puntos devueltos`);
      await loadAdminRedemptions();
      const active = document.querySelector('[id^="admin-tab-"].active')?.id.replace('admin-tab-','') || 'compras';
      loadAdminDashboard(active);
    } catch (error) {
      showToast('❌ ' + error.message);
      await loadAdminRedemptions();
      notice.textContent = error.message;
    } finally {
      saving = false;
    }
  }

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-redemption-id]');
    if (!button || !list.contains(button)) return;
    const item = rows.get(button.dataset.redemptionId);
    if (item) resolve(item,button.dataset.redemptionStatus);
  });
  window.loadAdminRedemptions = loadAdminRedemptions;
})();
