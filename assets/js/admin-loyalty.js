/* Owner-only corrections; every mutation goes through an atomic, audited SQL RPC. */
let activeAdminLoyaltyId = null;
let savingAdminLoyalty = false;
const pendingLoyaltyStorage = 'donasPendingAdminLoyalty';

function panamaDateToday() {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Panama',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part = name => parts.find(p => p.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function adminLoyaltyPending() {
  try { return JSON.parse(sessionStorage.getItem(`${pendingLoyaltyStorage}:${activeAdminLoyaltyId}`) || 'null'); } catch (_) { return null; }
}
function resetAdminLoyaltyPending() { sessionStorage.removeItem(`${pendingLoyaltyStorage}:${activeAdminLoyaltyId}`); }
function updateAdminLoyaltyForm() {
  const kind=document.getElementById('adminLoyaltyKind').value;
  const count=document.getElementById('adminLoyaltyAmount');
  const date=document.getElementById('adminLoyaltyDate');
  const dateWrap=document.getElementById('adminLoyaltyDateWrap');
  const explanations={
    HISTORICAL_PURCHASES:'Suma compras anteriores y puntos base por cada una. Sin fechas reales, no cambia la racha ni las ventas del día.',
    POINTS:'Un número positivo suma puntos; uno negativo resta del saldo disponible. Los puntos ganados históricamente se conservan.',
    STREAK:'Escribe la racha actual y la fecha real de su última compra válida. La siguiente compra seguirá las reglas normales.'
  };
  const limits={HISTORICAL_PURCHASES:[1,100],POINTS:[-10000,10000],STREAK:[0,29]};
  const [min,max]=limits[kind];
  count.min=min;count.max=max;
  if (Number(count.value)<min || Number(count.value)>max) count.value=kind==='STREAK'?'0':'1';
  document.getElementById('adminLoyaltyAmountLabel').textContent=kind==='HISTORICAL_PURCHASES'?'Número de compras anteriores':kind==='POINTS'?'Puntos a sumar (+) o restar (−)':'Racha actual';
  dateWrap.hidden=kind!=='STREAK' || Number(count.value)===0;
  date.required=!dateWrap.hidden;
  date.max=panamaDateToday();
  if (dateWrap.hidden) date.value='';
  document.getElementById('adminLoyaltyExplanation').textContent=explanations[kind];
}
async function loadAdminLoyaltyHistory(id) {
  const box=document.getElementById('adminLoyaltyHistory');
  box.textContent='Cargando ajustes...';
  try {
    const data=await api('getAdminLoyaltyHistory',{clientId:id});
    if (activeAdminLoyaltyId!==id) return;
    if (!data.changes?.length) { box.textContent='Todavía no hay ajustes.'; return; }
    box.innerHTML=data.changes.map(row=>{
      const title=row.kind==='HISTORICAL_PURCHASES'?`${row.amount} compras anteriores`:row.kind==='POINTS'?`${row.amount>0?'+':''}${row.amount} puntos`:`Racha: ${row.amount}`;
      return `<div class="loyalty-audit-row"><b>${safe(title)}</b><small>${safe(fmtDateTime(row.created_at))}</small><span>${safe(row.reason)}</span></div>`;
    }).join('');
  } catch (error) { box.textContent=error.message; }
}
function openAdminLoyalty(id) {
  if (!requireAuth()) return;
  const customer=adminLoyaltyClients.get(id);
  if (!customer) return;
  activeAdminLoyaltyId=id;
  const panel=document.getElementById('adminLoyaltyDialog');
  document.getElementById('adminLoyaltyTitle').textContent=`Ajustar a ${customer.name}`;
  document.getElementById('adminLoyaltySummary').textContent=`${id} · ${customer.totalPurchases||0} compras · ${customer.pointsAvailable||0} puntos disponibles · racha ${customer.currentStreak||0}`;
  document.getElementById('adminLoyaltyNotice').textContent='';
  document.getElementById('adminLoyaltyForm').reset();
  document.getElementById('adminLoyaltyAmount').value='1';
  const pending=adminLoyaltyPending();
  if (pending?.clientId===id) {
    document.getElementById('adminLoyaltyKind').value=pending.kind;
    document.getElementById('adminLoyaltyAmount').value=pending.amount;
    document.getElementById('adminLoyaltyDate').value=pending.qualifiedOn||'';
    document.getElementById('adminLoyaltyReason').value=pending.reason;
    document.getElementById('adminLoyaltyNotice').textContent='Hay un intento sin respuesta confirmada. Puedes reenviarlo sin cambiar los datos.';
  }
  updateAdminLoyaltyForm();
  if (pending?.clientId===id && pending.qualifiedOn) document.getElementById('adminLoyaltyDate').value=pending.qualifiedOn;
  panel.showModal();
  loadAdminLoyaltyHistory(id);
}
function closeAdminLoyalty() {
  if (savingAdminLoyalty) return;
  document.getElementById('adminLoyaltyDialog').close(); activeAdminLoyaltyId=null;
}
async function saveAdminLoyalty(event) {
  event.preventDefault();
  if (savingAdminLoyalty || !activeAdminLoyaltyId) return;
  const kind=document.getElementById('adminLoyaltyKind').value;
  const amount=Number(document.getElementById('adminLoyaltyAmount').value);
  const reason=document.getElementById('adminLoyaltyReason').value.trim();
  const qualifiedOn=kind==='STREAK' && amount>0?document.getElementById('adminLoyaltyDate').value:null;
  const notice=document.getElementById('adminLoyaltyNotice');
  if (!Number.isInteger(amount) || reason.length<5 || (kind==='POINTS' && amount===0) || (kind==='STREAK' && amount>0 && !qualifiedOn)) {
    notice.textContent='Revisa la cantidad, la fecha y el motivo.';return;
  }
  const signature={clientId:activeAdminLoyaltyId,kind,amount,qualifiedOn,reason};
  const saved=adminLoyaltyPending();
  const matches=saved && Object.entries(signature).every(([key,value])=>saved[key]===value);
  const payload={...signature,idempotencyKey:matches?saved.idempotencyKey:crypto.randomUUID()};
  sessionStorage.setItem(`${pendingLoyaltyStorage}:${activeAdminLoyaltyId}`,JSON.stringify(payload));
  const customerId=activeAdminLoyaltyId;
  savingAdminLoyalty=true;
  const button=document.getElementById('adminLoyaltySave');button.disabled=true;button.textContent='Guardando...';
  notice.textContent='Aplicando cambio...';
  try {
    const result=await apiPost('adminAdjustLoyalty',payload);
    resetAdminLoyaltyPending();
    notice.textContent=result.adjustment?.replayed?'Ya estaba aplicado; no se duplicó.':'Cambio guardado y registrado.';
    await loadAdminLoyaltyHistory(customerId);
    await loadAdminDashboard('compras');
    showToast('✅ Ajuste guardado');
  } catch(error) {
    notice.textContent=`No se confirmó el cambio: ${error.message}. Reintenta sin cambiar los datos.`;
  } finally {savingAdminLoyalty=false;button.disabled=false;button.textContent='Guardar cambio';}
}
document.getElementById('adminLoyaltyForm').addEventListener('input',event=>{
  if (event.target.id==='adminLoyaltyAmount') updateAdminLoyaltyForm();
  const pending=adminLoyaltyPending();
  if (!pending || pending.clientId!==activeAdminLoyaltyId) return;
  const kind=document.getElementById('adminLoyaltyKind').value;
  const amount=Number(document.getElementById('adminLoyaltyAmount').value);
  const reason=document.getElementById('adminLoyaltyReason').value.trim();
  const qualifiedOn=kind==='STREAK' && amount>0?document.getElementById('adminLoyaltyDate').value:null;
  if (kind!==pending.kind || amount!==pending.amount || reason!==pending.reason || qualifiedOn!==pending.qualifiedOn) resetAdminLoyaltyPending();
});
document.getElementById('adminLoyaltyDialog').addEventListener('cancel',event=>{
  if (savingAdminLoyalty) event.preventDefault();
});
document.getElementById('adminLoyaltyDialog').addEventListener('close',()=>{activeAdminLoyaltyId=null;});
