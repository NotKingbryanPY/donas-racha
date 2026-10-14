'use strict';
const assert=require('node:assert/strict'),{generateKeyPairSync}=require('node:crypto');
let claimError,finishError,providerError,jobs=[],acks=[],pending=[],logs=[];
const capture=(...args)=>logs.push(args.join(' '));
const info=console.info,error=console.error;console.info=capture;console.error=capture;
function replace(path,value){const id=require.resolve(path);require.cache[id]={id,filename:id,loaded:true,exports:value};}
replace('../api/_lib/supabase',{rpc:async(name,body)=>{
 if(name==='api_claim_staff_order_push'){if(claimError)throw claimError;return jobs;}
 assert.equal(name,'api_finish_staff_order_push');if(finishError)throw finishError;acks.push(body);return {saved:true};
}});
replace('@vercel/functions',{waitUntil:task=>pending.push(task)});
process.env.FCM_PROJECT_ID='donascontrol-1f5df';process.env.FCM_CLIENT_EMAIL='test@example.invalid';
process.env.FCM_PRIVATE_KEY=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
global.fetch=async url=>url==='https://oauth2.googleapis.com/token'
 ?{ok:true,json:async()=>({access_token:'private-oauth-test',expires_in:3600})}
 :{ok:!providerError,status:providerError?403:200,json:async()=>providerError?{error:{status:providerError}}:{name:'accepted'}};
const push=require('../api/_lib/order-notification-push');
const job={id:'job',leaseId:'lease',ownerId:'private-owner-test',deviceId:'private-device-test',token:'private-fcm-test',orderId:'order',publicCode:'DR-TEST'};
(async()=>{
 jobs=[job];let result=await push.dispatch();assert.equal(result.accepted,1);assert.deepEqual(result.errors,[]);assert.equal(acks[0].p_lease_id,'lease');
 providerError='PERMISSION_DENIED';result=await push.dispatch();assert.equal(result.accepted,0);assert.equal(result.retryable,1);
 assert.deepEqual(result.errors,[{code:'FCM_PERMISSION_DENIED',count:1}]);assert.equal(acks.at(-1).p_error,'FCM_PERMISSION_DENIED');
 providerError=undefined;push.enqueueDispatch();await pending.pop();assert.equal(JSON.parse(logs.at(-1)).event,'order_notification_dispatch');
 assert.equal(JSON.parse(logs.at(-1)).accepted,1);
 claimError=Object.assign(new Error('private SQL detail'),{code:'42501'});push.enqueueDispatch();await pending.pop();
 assert.deepEqual(JSON.parse(logs.at(-1)),{event:'order_notification_dispatch_pending',code:'42501'});
 claimError=Object.assign(new Error('private failure'),{code:'private-token-do-not-log'});push.enqueueDispatch();await pending.pop();
 assert.equal(JSON.parse(logs.at(-1)).code,'DISPATCH_FAILED');
 claimError=undefined;finishError=Object.assign(new Error('private lease detail'),{code:'40001'});push.enqueueDispatch();await pending.pop();
 assert.deepEqual(JSON.parse(logs.at(-1)),{event:'order_notification_dispatch_pending',code:'40001'},'no success summary when the durable acknowledgement fails');
 delete process.env.FCM_PRIVATE_KEY;push.enqueueDispatch();assert.equal(JSON.parse(logs.at(-1)).code,'FCM_NOT_CONFIGURED');
 assert.ok(!JSON.stringify({logs,result}).match(/private-|BEGIN PRIVATE/),'metadata excludes tokens, IDs, keys and raw exceptions');
 console.info=info;console.error=error;console.log('PASS dispatch diagnostics: provider acceptance/errors, durable leases, SQL failures and no private logs');
})().catch(e=>{console.info=info;console.error=error;console.error(e);process.exitCode=1;});
