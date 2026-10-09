const assert = require('node:assert/strict');
const {ApiError} = require('../api/_lib/http');
const staffId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', deviceId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const token='eyJhbGciOiJSUzI1NiJ9.'+Buffer.from(JSON.stringify({iss:'https://securetoken.google.com/donascontrol-1f5df'})).toString('base64url')+'.test';
let resolvedRole='SELLER', verified=true, signed=true, resolvedDevice=deviceId, calls=0;
const firebasePath=require.resolve('../api/_lib/firebase-auth');
const actualFirebase=require(firebasePath);
require.cache[firebasePath].exports={...actualFirebase,verifyFirebaseToken:async supplied=>{
  assert.equal(supplied,token);
  if (!signed) throw new ApiError(401,'INVALID_SESSION','Invalid test signature');
  return {uid:'test-firebase-uid',email_verified:verified};
}};
const supabasePath=require.resolve('../api/_lib/supabase');
require.cache[supabasePath]={id:supabasePath,filename:supabasePath,loaded:true,exports:{rpc:async(name,params)=>{
  assert.equal(name,'api_resolve_firebase_device');
  assert.deepEqual(params,{p_firebase_uid:'test-firebase-uid',p_device_public_id:deviceId});calls++;
  return resolvedRole ? {id:staffId,role:resolvedRole,deviceId:resolvedDevice} : null;
}}};
const {requireStaff,requireAdmin}=require('../api/_lib/auth');
const req={headers:{authorization:'Bearer '+token,'x-donas-device':deviceId}};
(async()=>{
  assert.equal(actualFirebase.looksLikeFirebase(token),true);
  assert.equal(actualFirebase.looksLikeFirebase('invalid'),false);
  assert.equal((await requireStaff(req)).role,'SELLER');await assert.rejects(requireAdmin(req),e=>e.status===403);
  resolvedRole='ADMIN';assert.equal((await requireAdmin(req)).role,'ADMIN');
  resolvedRole=null;await assert.rejects(requireStaff(req),e=>e.status===401&&e.code==='DEVICE_REVOKED');
  resolvedRole='ADMIN';resolvedDevice='wrong-device';await assert.rejects(requireStaff(req),e=>e.status===401);resolvedDevice=deviceId;
  verified=false;await assert.rejects(requireStaff(req),e=>e.status===403&&e.code==='EMAIL_VERIFICATION_REQUIRED');verified=true;
  signed=false;await assert.rejects(requireStaff(req),e=>e.status===401&&e.code==='INVALID_SESSION');signed=true;
  await assert.rejects(requireStaff({headers:{authorization:'Bearer '+token}}),e=>e.status===400);
  await assert.rejects(actualFirebase.verifyFirebaseToken(token),e=>e.status===401&&e.code==='INVALID_SESSION');
  assert.equal(calls,5,'one RPC per authorized identity, none for rejected identity/device header');
  console.log('PASS Firebase staff auth: official SDK rejects invalid JWT; verified UID and device required; capped server role and rejected authorization use one RPC');
})().catch(e=>{console.error(e);process.exitCode=1;});
