const assert=require('node:assert/strict');
function stub(path,exports){const key=require.resolve(path);require.cache[key]={id:key,filename:key,loaded:true,exports};}
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let authorized=true,queries=[],probes=0,dispatches=0,registered=0;
stub('../api/_lib/auth',{requireStaff:async()=>{
  if(!authorized) throw new (require('../api/_lib/http').ApiError)(401,'AUTH_REQUIRED','Inicia sesión.');
  return {id:'owner',role:'SELLER',deviceId:id};
}});
stub('../api/_lib/rate-limit',{enforceRateLimit:async()=>{}});
stub('../api/_lib/supabase',{
  serviceRequest:async(table,{query})=>{
    assert.equal(table,'push_devices');const q=new URLSearchParams(query);queries.push(q);
    assert.equal(q.get('auth_user_id'),'eq.owner');assert.equal(q.get('device_public_id'),'eq.'+id);
    return [{active:true,platform:'ANDROID',app_version:'1.4.2',updated_at:'2026-10-09',token:'private-device-token'}];
  },rpc:async(name)=>{assert.equal(name,'api_register_push_device');registered++;return {registered:true};}
});
stub('../api/_lib/order-push',{
  providers:()=>({android:false,ios:false}),dispatch:async()=>{dispatches++;return {configured:{android:false},processed:0};},
  checkAndroid:async token=>{assert.equal(token,'private-device-token');probes++;return {status:'FCM_NOT_CONFIGURED',validated:false};}
});
const handler=require('../api/_lib/admin_handlers/devices');
async function call(url,method='GET',body){
  let payload;const res={setHeader(){},end(text){payload=JSON.parse(text);}};
  await handler({url,method,body,headers:{authorization:'Bearer own-credential'}},res);
  assert.ok(!JSON.stringify(payload).includes('private-device-token'));
  return {status:res.statusCode,...payload};
}
(async()=>{
  delete process.env.CRON_SECRET;
  authorized=false;assert.equal((await call('/devices?check=android')).status,401);assert.equal(queries.length,0);
  authorized=true;assert.equal((await call('/devices?deviceId='+other+'&check=android')).status,403);assert.equal(queries.length,0);
  const plain=await call('/devices?deviceId='+id);assert.equal(plain.data.registration.active,true);
  assert.ok(!queries[0].get('select').includes('token'));assert.equal(probes,0);
  const checked=await call('/devices?deviceId='+id+'&check=android');
  assert.equal(checked.data.check.status,'FCM_NOT_CONFIGURED');assert.equal(checked.data.retryConfigured,false);
  assert.equal(probes,1);assert.equal(dispatches,0,'diagnostic must not claim/send real alerts');
  const registration=await call('/devices','POST',{deviceId:id,platform:'ANDROID',token:'x'.repeat(40),appVersion:'1.4.2'});
  assert.equal(registration.data.registered,true);assert.equal(registration.data.configured.android,false);
  assert.equal(registered,1);assert.equal(dispatches,1);
  console.log('PASS authenticated push diagnostics: own device only, no token exposure, validate-only check and explicit inactive emitter');
  const vm=require('node:vm'),fs=require('node:fs');const message={textContent:''};let readCount=0;
  const context={staffRole:'ADMIN',document:{getElementById:()=>message},adminRequest:async()=>{
    readCount++;return {configured:{android:false},retryConfigured:false};
  }};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../assets/js/staff-devices.js'),'utf8'),context);
  await context.loadPushEmitter();assert.match(message.textContent,/Emisor Android sin configurar/);
  assert.match(message.textContent,/ORDER_PUSH_CRON_SECRET/);
  context.adminRequest=async()=>({configured:{android:true},retryConfigured:true});
  await context.loadPushEmitter();assert.match(message.textContent,/verifica también el workflow/);
  context.staffRole='SELLER';await context.loadPushEmitter();assert.equal(readCount,1);
  console.log('PASS web staff diagnostics: explicit setup status, honest retry state and ADMIN-only UI');
})().catch(e=>{console.error(e);process.exitCode=1;});
