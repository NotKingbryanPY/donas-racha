'use strict';
const assert=require('node:assert/strict');
const {ApiError}=require('../api/_lib/http');
let authorized=true,role='ADMIN',configured=false,registered=true,calls=[],sent=[],finishDispatch;
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function replace(path,value){const key=require.resolve(path);require.cache[key]={id:key,filename:key,loaded:true,exports:value};}
replace('../api/_lib/auth',{requireStaff:async()=>{if(!authorized)throw new ApiError(401,'AUTH_REQUIRED','Sesión requerida');return {id:actor,role};}});
replace('../api/_lib/rate-limit',{enforceRateLimit:async()=>{}});
replace('../api/_lib/supabase',{rpc:async(name,body)=>{calls.push({name,body});return name==='api_staff_order_notification_status'?{registered,retryScheduler:true}:{registered:true};},
 serviceRequest:async(table,{query})=>{assert.equal(table,'push_devices');const p=new URLSearchParams(query);assert.equal(p.get('auth_user_id'),'eq.'+actor);assert.equal(p.get('active'),'eq.true');return [{token:'private-device-token'}];}});
replace('../api/_lib/order-notification-push',{configured:()=>configured,enqueueDispatch(){},dispatch:()=>new Promise(resolve=>{finishDispatch=resolve;}),send:async(job,flags)=>{sent.push({job,flags});return {accepted:true};}});
const handler=require('../api/_lib/admin_handlers/order-notifications');
async function invoke(method,body,query={},authorization='Bearer user'){const res={setHeader(){},end(body){this.body=JSON.parse(body)}};await handler({method,url:'/api/admin/customers/order-notifications',headers:{authorization},body,query},res);return res;}
(async()=>{
 const registration=await invoke('POST',{deviceId:id,token:'x'.repeat(80),appVersion:'2.1.0',authUserId:'forged'});
 assert.equal(registration.statusCode,200);assert.equal(calls[0].body.p_auth_user_id,actor);assert.ok(!JSON.stringify(registration.body).includes('x'.repeat(80)));
 const status=await invoke('GET',null,{deviceId:id,check:'1'});assert.equal(status.body.data.check.status,'FCM_NOT_CONFIGURED');assert.equal(sent.length,0);
 configured=true;const checked=await invoke('GET',null,{deviceId:id,check:'1'});assert.equal(checked.body.data.check.status,'FCM_VALIDATED');assert.equal(sent[0].flags.validateOnly,true);
 const test=await invoke('POST',{deviceId:id,action:'test'});assert.equal(test.body.data.status,'FCM_ACCEPTED');assert.equal(sent[1].job.ownerId,actor);
 assert.ok(!JSON.stringify(test.body).includes('private-device-token'));
 role='SELLER';assert.equal((await invoke('POST',{deviceId:id,action:'revoke'})).statusCode,403);
 assert.equal((await invoke('POST',null,{dispatch:'1'})).statusCode,401);
 process.env.CRON_SECRET='private-test-cron';let dispatchReturned=false;
 const recovery=invoke('POST',null,{dispatch:'1'},'Bearer private-test-cron').then(result=>{dispatchReturned=true;return result;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(dispatchReturned,false,'recovery waits for the real dispatch result');
 finishDispatch({configured:true,processed:2,accepted:1,retryable:1,invalidTokens:0,errors:[{code:'FCM_UNAVAILABLE',count:1}]});
 const recovered=await recovery;assert.equal(recovered.body.data.processed,2);assert.equal(recovered.body.data.accepted,1);assert.equal(recovered.body.data.errors[0].code,'FCM_UNAVAILABLE');
 authorized=false;assert.equal((await invoke('GET',null,{deviceId:id})).statusCode,401);
 console.log('PASS staff notification API: authenticated binding, no tokens in replies, provider diagnostics, self test, revoke roles and protected dispatcher');
})().catch(e=>{console.error(e);process.exitCode=1});
