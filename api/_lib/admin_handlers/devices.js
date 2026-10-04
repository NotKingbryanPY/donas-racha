const { timingSafeEqual } = require('node:crypto');
const { withApi, ApiError } = require('../http');
const { requireAdmin } = require('../auth');
const { enforceRateLimit } = require('../rate-limit');
const { rpc } = require('../supabase');
const { uuid } = require('../validation');
const push = require('../order-push');

module.exports = withApi(['GET','POST','DELETE'], async (req, context) => {
  if (req.method==='GET') {
    const actual=Buffer.from(String(req.headers.authorization || ''));
    const expected=Buffer.from(`Bearer ${process.env.CRON_SECRET || ''}`);
    if (process.env.CRON_SECRET && actual.length===expected.length && timingSafeEqual(actual,expected)) return push.dispatch();
    await requireAdmin(req);
    return {configured:push.providers()};
  }
  const admin=await requireAdmin(req);
  await enforceRateLimit(req,'push_devices',30,60,admin.id);
  const body=context.parseJsonBody(req,8192);
  const id=uuid(body.deviceId,'deviceId');
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
  return result;
});
