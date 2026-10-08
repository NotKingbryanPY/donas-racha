const {withApi,ApiError}=require('../http');
const {requireAdmin,requireStaff}=require('../auth');
const {rpc,serviceRequest}=require('../supabase');
const {enforceRateLimit}=require('../rate-limit');
const {uuid,fingerprint}=require('../validation');
module.exports=withApi(['GET','POST'],async(req,context)=>{
  const staff=await(req.method==='GET'?requireStaff(req):requireAdmin(req));
  await enforceRateLimit(req,'staff_catalog',60,60,staff.id);
  if(req.method==='GET') return {flavors:await serviceRequest('product_variants',{
    query:'select=id,sku,name,active,available,updated_at&order=display_order.asc,name.asc'})};
  const body=context.parseJsonBody(req,4096);
  const payload={variantId:uuid(body.variantId,'variantId'),name:String(body.name||'').trim(),
    available:body.available,expectedUpdatedAt:body.expectedUpdatedAt};
  if(!payload.name||payload.name.length>100||typeof payload.available!=='boolean'||
    typeof payload.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(payload.expectedUpdatedAt)))
    throw new ApiError(400,'VALIDATION_ERROR','Revisa nombre, disponibilidad y versión del sabor.');
  return rpc('api_update_flavor',{p_auth_user_id:staff.id,p_operation_id:uuid(body.operationId,'operationId'),
    p_request_hash:fingerprint(payload),p_variant_id:payload.variantId,p_expected_updated_at:payload.expectedUpdatedAt,
    p_name:payload.name,p_available:payload.available});
});
