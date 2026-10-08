const {randomBytes,createHash}=require('node:crypto');
const {withApi,ApiError}=require('../http');
const {requireAdmin}=require('../auth');
const {enforceRateLimit}=require('../rate-limit');
const {rpc,serviceRequest}=require('../supabase');
const {uuid}=require('../validation');
const hash=value=>createHash('sha256').update(value).digest('hex');
module.exports=withApi(['GET','POST'],async(req,context)=>{
  const body=context.parseJsonBody(req,4096);
  if(req.method==='POST' && body.action==='claim') {
    await enforceRateLimit(req,'staff_device_claim',10,300);
    if(!/^[A-Za-z0-9_-]{43}$/.test(body.invitation||'')) throw new ApiError(400,'INVALID_INVITATION','Invitación inválida.');
    const deviceId=uuid(body.deviceId,'deviceId');
    const credential=`drd.${deviceId}.${randomBytes(32).toString('base64url')}`;
    const result=await rpc('api_claim_staff_invitation',{p_invitation_hash:hash(body.invitation),
      p_device_public_id:deviceId,p_credential_hash:hash(credential)});
    return {...result,credential};
  }
  const admin=await requireAdmin(req);
  await enforceRateLimit(req,'staff_provisioning',20,300,admin.id);
  if(req.method==='GET') {
    const [credentials, registrations] = await Promise.all([
      serviceRequest('staff_device_credentials',{query:'select=device_public_id,role,revoked,expires_at,created_at&order=created_at.desc&limit=100'}),
      serviceRequest('app_devices',{query:'select=device_public_id,status,created_at&order=created_at.desc&limit=100'})
    ]);
    const devices=new Map((credentials||[]).map(item=>[item.device_public_id,item]));
    for(const registration of registrations||[]) {
      const existing=devices.get(registration.device_public_id);
      devices.set(registration.device_public_id,existing ? {...existing,revoked:existing.revoked || registration.status!=='ACTIVE'} :
        {device_public_id:registration.device_public_id,revoked:registration.status!=='ACTIVE',created_at:registration.created_at});
    }
    return {devices:[...devices.values()].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,100)};
  }
  if(body.action==='revoke') return rpc('api_revoke_staff_device',{p_auth_user_id:admin.id,p_device_public_id:uuid(body.deviceId,'deviceId')});
  if(body.action!=='issue'||!['ADMIN','SELLER'].includes(body.role)) throw new ApiError(400,'VALIDATION_ERROR','Selecciona ADMIN o SELLER.');
  const invitation=randomBytes(32).toString('base64url');
  const result=await rpc('api_issue_staff_invitation',{p_auth_user_id:admin.id,p_hash:hash(invitation),p_role:body.role});
  return {...result,invitation};
});
