const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',device='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let verified=true,staffDevice=device,actorRole='SELLER',called=0,last;
function stub(path,exports){const key=require.resolve(path);require.cache[key]={id:key,filename:key,loaded:true,exports};}
stub('../api/_lib/auth',{requireStaff:async()=>({id,role:actorRole,deviceId:staffDevice})});
stub('../api/_lib/firebase-auth',{verifyFirebaseToken:async token=>{
  assert.equal(token,'test-only-id-token');return {uid:'server-verified-uid',email_verified:verified};
}});
stub('../api/_lib/rate-limit',{enforceRateLimit:async()=>{}});
stub('../api/_lib/supabase',{rpc:async(name,args)=>{
  assert.equal(name,'api_bind_firebase_device');last=args;called++;return {linked:true,deviceId:device};
}});
const handler=require('../api/_lib/admin_handlers/firebase-identity');
const credential='drd.'+device+'.'+'x'.repeat(43);
async function request(body,method='POST') {
  let payload;
  const req={method,headers:{authorization:'Bearer '+credential},body,url:'/api/admin/customers/firebase-identity'};
  const res={setHeader(){},end(value){payload=JSON.parse(value);}};
  await handler(req,res);return {status:res.statusCode,payload};
}
(async()=>{
  const body={deviceId:device,firebaseIdToken:'test-only-id-token',firebaseUid:'spoofed',role:'ADMIN',authUserId:'spoofed'};
  const result=await request(body);assert.equal(result.status,200);
  assert.equal(result.payload.data.firebaseUid,'server-verified-uid');assert.equal(result.payload.data.role,'SELLER');
  assert.equal(last.p_firebase_uid,'server-verified-uid');assert.equal(last.p_auth_user_id,id);assert.equal(last.p_role,'SELLER');
  assert.equal(last.p_credential_hash,createHash('sha256').update(credential).digest('hex'));
  assert.equal((await request(null,'GET')).payload.data.deviceId,device);
  verified=false;assert.equal((await request(body)).status,403);verified=true;
  staffDevice='cccccccc-cccc-4ccc-8ccc-cccccccccccc';assert.equal((await request(body)).status,403);
  staffDevice=device;assert.equal((await request({...body,deviceId:'invalid'})).status,400);
  assert.equal(called,1,'rejected requests must not create or change a binding');
  console.log('PASS Firebase identity API: verified token UID and current server role, credential hash, ownership, verification, invalid UUID and rejected writes');
})().catch(e=>{console.error(e);process.exitCode=1;});
