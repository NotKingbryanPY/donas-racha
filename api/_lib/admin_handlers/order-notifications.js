'use strict';
const {randomUUID,timingSafeEqual}=require('node:crypto');
const {withApi,ApiError}=require('../http');
const {requireStaff}=require('../auth');
const {rpc,serviceRequest}=require('../supabase');
const {enforceRateLimit}=require('../rate-limit');
const {uuid}=require('../validation');
const push=require('../order-notification-push');
function cronAuthorized(req){
  const expected=process.env.CRON_SECRET;if(!expected)return false;
  const actual=String(req.headers.authorization||'');
  const wanted=`Bearer ${expected}`;
  const a=Buffer.from(actual),b=Buffer.from(wanted);
  return a.length===b.length&&timingSafeEqual(a,b);
}
async function notificationRpc(name,params){
  try{return await rpc(name,params);}catch(error){
    if(['PGRST202','42883','42P01','42703'].includes(error.code))throw new ApiError(503,'NOTIFICATIONS_SETUP_REQUIRED','Falta activar el SQL de notificaciones de pedidos.');
    throw error;
  }
}
async function device(owner,id){
  const rows=await serviceRequest('push_devices',{query:new URLSearchParams({select:'token',device_public_id:`eq.${id}`,
    auth_user_id:`eq.${owner}`,auth_mode:'eq.SUPABASE_STAFF_V2',active:'eq.true',revoked_at:'is.null'}).toString()});
  if(!rows.length)throw new ApiError(409,'DEVICE_NOT_REGISTERED','Este teléfono todavía no está registrado para recibir avisos.');
  return {token:rows[0].token,ownerId:owner,deviceId:id,eventId:randomUUID()};
}
module.exports=withApi(['GET','POST','DELETE'],async(req,context)=>{
  if(req.query?.dispatch==='1'){
    if(req.method!=='POST'||!cronAuthorized(req))throw new ApiError(401,'AUTH_REQUIRED','Despachador protegido.');
    // Recovery must finish its lease/send/ack before the HTTP invocation ends.
    // A successful response reports provider acceptance, never Android delivery.
    const result=await push.dispatch();
    console.info(JSON.stringify({event:'order_notification_retry',...result}));
    return result;
  }
  const staff=await requireStaff(req);
  await enforceRateLimit(req,'staff_order_notifications',60,60,staff.id);
  if(req.method==='GET'){
    const id=uuid(req.query.deviceId,'deviceId');
    const status=await notificationRpc('api_staff_order_notification_status',{p_auth_user_id:staff.id,p_device_public_id:id});
    let check;
    if(req.query.check==='1'){
      if(!push.configured())check={validated:false,status:'FCM_NOT_CONFIGURED'};
      else if(!status.registered)check={validated:false,status:'DEVICE_NOT_REGISTERED'};
      else{
        const result=await push.send(await device(staff.id,id),{test:true,validateOnly:true});
        check={validated:result.accepted,status:result.accepted?'FCM_VALIDATED':result.error};
        if(result.accepted){
          await notificationRpc('api_retry_staff_order_push',{p_auth_user_id:staff.id,p_device_public_id:id});
          push.enqueueDispatch();
        }
      }
    }
    return {...status,configured:{android:push.configured()},retryConfigured:Boolean(process.env.CRON_SECRET)&&status.retryScheduler,...(check?{check}:{})};
  }
  const body=context.parseJsonBody(req);const id=uuid(body.deviceId,'deviceId');
  if(req.method==='DELETE')return notificationRpc('api_staff_stop_order_notifications',{p_auth_user_id:staff.id,p_device_public_id:id,p_revoke:false});
  if(body.action==='revoke'){
    if(staff.role!=='ADMIN')throw new ApiError(403,'ADMIN_REQUIRED','Solo un administrador puede revocar dispositivos.');
    return notificationRpc('api_staff_stop_order_notifications',{p_auth_user_id:staff.id,p_device_public_id:id,p_revoke:true});
  }
  if(body.action==='test'){
    await enforceRateLimit(req,'staff_notification_test',3,60,staff.id);
    const result=await push.send(await device(staff.id,id),{test:true});
    return {accepted:result.accepted,status:result.accepted?'FCM_ACCEPTED':result.error};
  }
  if(body.action==='configure-retry'){
    if(staff.role!=='ADMIN')throw new ApiError(403,'ADMIN_REQUIRED','Solo un administrador puede configurar la recuperación.');
    if(!process.env.CRON_SECRET||process.env.CRON_SECRET.length<32)throw new ApiError(503,'CRON_NOT_CONFIGURED','Falta CRON_SECRET protegido en Vercel.');
    return notificationRpc('api_staff_configure_notification_retry',{p_auth_user_id:staff.id,p_secret:process.env.CRON_SECRET});
  }
  if(body.action!==undefined&&body.action!=='register')throw new ApiError(400,'VALIDATION_ERROR','Acción no válida.');
  if(typeof body.token!=='string'||body.token.length<32||body.token.length>4096||typeof body.appVersion!=='string'||body.appVersion.length>40)
    throw new ApiError(400,'VALIDATION_ERROR','El registro FCM no es válido.');
  const result=await notificationRpc('api_staff_register_order_notifications',{p_auth_user_id:staff.id,p_device_public_id:id,p_token:body.token,p_app_version:body.appVersion});
  push.enqueueDispatch();
  return {...result,configured:{android:push.configured()}};
});
