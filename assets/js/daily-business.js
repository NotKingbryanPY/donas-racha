/* Confirmed shared ledger; never replace manual-count drafts or customer flows. */
(() => {
  'use strict';
  if(!document.getElementById('adminDailyPanel'))return;
  let loading=false,last=0;
  const visible=()=>!document.hidden&&navigator.onLine&&document.getElementById('screen-admin')?.classList.contains('active');
  async function refresh() {
    if(loading||!sessionStorage.getItem('donasAdminAccessToken'))return;
    loading=true;
    const notice=document.getElementById('adminDailyNotice'),button=document.getElementById('adminDailyRefresh');
    button.disabled=true;notice.textContent='Consultando operaciones confirmadas…';
    try {
      const data=await adminRequest('/api/admin/customers/daily'),s=data.summary;
      if(data.schemaVersion!==2||!s||!data.session)throw new Error('El registro diario necesita activación en Supabase.');
      document.getElementById('adminDailyMetrics').innerHTML=[
        ['Ingresos',formatMoney(s.revenueCents)],['Inversión en compras',formatMoney(s.investmentCents)],
        ['Costo vendido',formatMoney(s.costOfSalesCents)],['Utilidad comercial',s.profitCents===null?'Costo pendiente':formatMoney(s.profitCents)],
        ['Efectivo',formatMoney(s.cashCents)],['Yappy',formatMoney(s.yappyCents)],
        ['Unidades vendidas',s.soldUnits],['Consumo del vendedor',s.consumedUnits]
      ].map(([label,value])=>`<div class="stat-card"><span class="lbl">${safe(label)}</span><strong class="big">${safe(value)}</strong></div>`).join('');
      const names={PURCHASE:'Compra de cajas',SALE:'Venta presencial',CONSUMPTION:'Consumo del vendedor',CORRECTION:'Corrección de inventario',WEB_SALE:'Pedido web entregado',CLOSE:'Cierre de jornada'};
      document.getElementById('adminDailyHistory').innerHTML=data.operations.slice(0,10).map(op=>
        `<li><b>${safe(names[op.kind]||op.kind)}</b><span>${safe(formatMoney(op.kind==='PURCHASE'?op.investment_cents:op.revenue_cents))} · ${safe(new Date(op.occurred_at).toLocaleString('es-PA',{dateStyle:'short',timeStyle:'short'}))}</span></li>`
      ).join('')||'<li>No hay operaciones confirmadas en el libro nuevo.</li>';
      notice.textContent=`Jornada ${data.session.business_date}. Solo registros confirmados.${s.unknownCostUnits>0?' Hay unidades sin costo histórico: la utilidad definitiva queda pendiente.':''} El inventario restante no se considera pérdida.`;
      last=Date.now();
    } catch(error) {
      notice.textContent=error.code==='DAILY_SETUP_REQUIRED'?'La web sigue operativa. Activa el SQL del registro diario para compartir compras, ventas y consumos con Donas Control.':error.message;
    } finally {loading=false;button.disabled=false;}
  }
  document.getElementById('adminDailyRefresh').addEventListener('click',refresh);
  window.loadDailyBusiness=refresh;
  const original=window.loadAdminDashboard;
  window.loadAdminDashboard=async(...args)=>{const result=await original(...args);refresh();return result;};
  const onVisible=()=>{if(visible()&&Date.now()-last>30000)refresh();};
  document.addEventListener('visibilitychange',onVisible);window.addEventListener('online',onVisible);
  setInterval(onVisible,60000);
})();
