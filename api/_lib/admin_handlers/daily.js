'use strict';
const {createHash}=require('node:crypto');
const {withApi,ApiError}=require('../http');
const {requireStaff}=require('../auth');
const {rpc}=require('../supabase');
const {enforceRateLimit}=require('../rate-limit');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function invalid(message='Revisa cantidades, precios y pago antes de guardar.') {throw new ApiError(400,'INVALID_DAILY_OPERATION',message);}
function validate(body,staff) {
  if(!body||!uuid.test(body.operationId||'')||!uuid.test(body.sessionId||'')||
      !['PURCHASE','SALE','CONSUMPTION','CORRECTION','CLOSE'].includes(body.kind)) invalid();
  if(typeof body.occurredAt!=='string'||!Number.isFinite(Date.parse(body.occurredAt))||body.occurredAt.length>40) invalid('La fecha del registro no es válida.');
  const result={kind:body.kind,sessionId:body.sessionId.toLowerCase(),occurredAt:new Date(body.occurredAt).toISOString()};
  if(body.note!==undefined) {
    if(typeof body.note!=='string'||body.note.trim().length>300) invalid();
    result.note=body.note.trim();
  }
  if(['CORRECTION','CLOSE'].includes(body.kind)) {
    if(!integer(body.expectedRevision,0,Number.MAX_SAFE_INTEGER)) invalid('Actualiza el inventario antes de corregir o cerrar.');
    result.expectedRevision=body.expectedRevision;
  }
  if(body.kind==='CLOSE') {
    if(!integer(body.expectedSequence,0,Number.MAX_SAFE_INTEGER)||!uuid.test(body.nextSessionId||'')) invalid();
    return {...result,expectedSequence:body.expectedSequence,nextSessionId:body.nextSessionId.toLowerCase()};
  }
  if(body.kind==='CORRECTION') {
    if(staff.role!=='ADMIN') throw new ApiError(403,'ADMIN_REQUIRED','Solo un administrador puede corregir existencias.');
    if(!result.note||result.note.length<5) invalid('Explica el motivo de la corrección.');
  }
  if(!Array.isArray(body.items)||body.items.length<1||body.items.length>25) invalid();
  const seen=new Set();let units=0,total=0;
  result.items=body.items.map(item=>{
    if(!item||!uuid.test(item.variantId||'')||seen.has(item.variantId.toLowerCase())||
       !integer(item.quantity,body.kind==='CORRECTION'?-100000:1,100000)||item.quantity===0) invalid();
    const variantId=item.variantId.toLowerCase();seen.add(variantId);units+=Math.abs(item.quantity);
    const row={variantId,quantity:item.quantity};
    if(body.kind==='SALE') {
      if(!integer(item.unitPriceCents,0,1000000)) invalid();
      row.unitPriceCents=item.unitPriceCents;total+=item.quantity*item.unitPriceCents;
    }
    return row;
  }).sort((a,b)=>a.variantId.localeCompare(b.variantId));
  if(body.kind==='PURCHASE') {
    if(!integer(body.boxes,1,10000)||!integer(body.totalCostCents,0,100000000)) invalid();
    result.boxes=body.boxes;result.totalCostCents=body.totalCostCents;units*=body.boxes;
  }
  if(units>100000||total>100000000) invalid();
  if(body.kind==='SALE') {
    if(!body.payment||!integer(body.payment.cashCents,0,100000000)||!integer(body.payment.yappyCents,0,100000000)||
        body.payment.cashCents+body.payment.yappyCents!==total) invalid('Efectivo más Yappy debe ser igual al total de la venta.');
    result.payment={cashCents:body.payment.cashCents,yappyCents:body.payment.yappyCents};
  }
  return result;
}
async function dailyRpc(name,params) {
  try {return await rpc(name,params);} catch(error) {
    if(['PGRST202','42883','42P01'].includes(error.code)) throw new ApiError(503,'DAILY_SETUP_REQUIRED','Falta activar el registro diario en Supabase. Tus registros locales se conservan.');
    throw error;
  }
}
module.exports=withApi(['GET','POST'],async(req,context)=>{
  const staff=await requireStaff(req);
  await enforceRateLimit(req,'daily_operations',120,60,staff.id);
  if(req.method==='GET') {
    const cursor=req.query?.beforeSequence;
    if(cursor!==undefined&&!/^\d{1,15}$/.test(String(cursor))) invalid('El cursor del historial no es válido.');
    return dailyRpc('api_daily_snapshot',{p_auth_user_id:staff.id,p_before_sequence:cursor===undefined?null:Number(cursor)});
  }
  const body=context.parseJsonBody(req,32768),payload=validate(body,staff);
  return dailyRpc('api_daily_apply',{p_auth_user_id:staff.id,p_operation_id:body.operationId.toLowerCase(),
    p_request_hash:createHash('sha256').update(JSON.stringify(payload)).digest('hex'),p_payload:payload});
});
