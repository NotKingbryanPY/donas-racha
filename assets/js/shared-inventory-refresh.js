/* Read current stock without overwriting a customer's quantities or a staff count. */
let sharedStockRefreshing = false;
async function refreshSharedStock() {
  if (document.hidden || !navigator.onLine || sharedStockRefreshing) return;
  const delivery=document.getElementById('clientDeliverySection');
  if (!delivery || delivery.style.display==='none' || !openedAsUser || !clientOrderVariants.length) return;
  sharedStockRefreshing=true;
  try {
    const inventory=await vercelApi('/api/products',{view:'inventory'});
    const byId=new Map((inventory.flavors || []).map(row=>[String(row.variant_id),row]));
    clientInventoryEnforced=!!inventory.enforced;
    const focusedLabel=document.activeElement?.closest('#clientFlavorList button')?.getAttribute('aria-label');
    clientOrderVariants=clientOrderVariants.map(item=>({...item,inventory:byId.get(String(item.id))}));
    renderClientFlavors();
    if (focusedLabel) {
      const button=Array.from(document.querySelectorAll('#clientFlavorList button')).find(el=>el.getAttribute('aria-label')===focusedLabel);
      if (button && !button.disabled) button.focus({preventScroll:true});
    }
    document.getElementById('clientInventoryStatus').textContent='Inventario actualizado · '+new Date().toLocaleTimeString('es-PA',{hour:'2-digit',minute:'2-digit'});
  } catch (_) {
    document.getElementById('clientInventoryStatus').textContent='No se pudo actualizar. Mostrando la última consulta; comprobaremos el stock al enviar el pedido.';
  } finally { sharedStockRefreshing=false; }
}
setInterval(refreshSharedStock,20000);
document.addEventListener('visibilitychange',()=>{ if (!document.hidden) refreshSharedStock(); });
