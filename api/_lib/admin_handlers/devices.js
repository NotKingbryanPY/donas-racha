const { timingSafeEqual } = require('node:crypto');
const { withApi, ApiError } = require('../http');
const { requireStaff } = require('../auth');
const { enforceRateLimit } = require('../rate-limit');
const { rpc, serviceRequest } = require('../supabase');
const { uuid } = require('../validation');
const push = require('../order-push');

module.exports = withApi(['GET','POST','DELETE'], async (req, context) => {
  if (req.method==='GET') {
    const actual=Buffer.from(String(req.headers.authorization || ''));
    const expected=Buffer.from(`Bearer ${process.env.CRON_SECRET || ''}`);
    if (process.env.CRON_SECRET && actual.length===expected.length && timingSafeEqual(actual,expected)) return push.dispatch();
    const staff=await requireStaff(req);
    const query=new URL(req.url,'https://www.dracha.store').searchParams;
    const id=query.get('deviceId') || staff.deviceId;
    const summary={configured:push.providers(),retryConfigured:Boolean(process.env.CRON_SECRET)};
    if (!id) return summary;
    uuid(id,'deviceId');
    if (staff.deviceId && staff.deviceId!==id) throw new ApiError(403,'DEVICE_REVOKED','La credencial pertenece a otro dispositivo.');
    const probe=query.get('check')==='android';
    if (probe) await enforceRateLimit(req,'push_check',5,60,staff.id);
    const rows=await serviceRequest('push_devices',{query:new URLSearchParams({
      select:probe?'platform,active,updated_at,app_version,token':'platform,active,updated_at,app_version',
      device_public_id:'eq.'+id,auth_user_id:'eq.'+staff.id,limit:'1'
    }).toString()});
    const device=rows?.[0];
    const registration=device ? {active:device.active,platform:device.platform,updatedAt:device.updated_at,appVersion:device.app_version} : {active:false};
    const check=probe ? (!device?.active || device.platform!=='ANDROID' ? {status:'DEVICE_NOT_REGISTERED',validated:false} : await push.checkAndroid(device.token)) : undefined;
    return {...summary,registration,...(check?{check}:{})};
  }
  const admin=await requireStaff(req);
  await enforceRateLimit(req,'push_devices',30,60,admin.id);
  const body=context.parseJsonBody(req,8192);
  const id=uuid(body.deviceId,'deviceId');
  if (admin.deviceId && admin.deviceId!==id) throw new ApiError(403,'DEVICE_REVOKED','La credencial pertenece a otro dispositivo.');
  if (req.method==='DELETE') return rpc('api_unregister_push_device',{p_auth_user_id:admin.id,p_device_public_id:id});
  const platform=String(body.platform || ''); const token=String(body.token || '');
  const environment=String(body.environment || 'production'); const version=String(body.appVersion || '');
  if (!['ANDROID','IOS'].includes(platform) || token.length<32 || token.length>4096 ||
    (platform==='IOS' && !/^[a-f0-9]{64,200}$/i.test(token)) || !['production','sandbox'].includes(environment) || !version || version.length>40) {
    throw new ApiError(400,'VALIDATION_ERROR','El dispositivo de notificaciones no es válido.');
  }
  const result=await rpc('api_register_push_device',{p_auth_user_id:admin.id,p_device_public_id:id,p_platform:platform,
    p_token:token,p_environment:environment,p_app_version:version});
  try {await push.dispatch();} catch (_) { /* Persistent jobs are retried by the dispatcher. */ }
  return {...result,configured:push.providers(),retryConfigured:Boolean(process.env.CRON_SECRET)};
});
