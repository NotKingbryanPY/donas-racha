'use strict';
const assert=require('node:assert/strict'),{generateKeyPairSync}=require('node:crypto');
let calls=0,requests=[],invalid=false;
process.env.FCM_PROJECT_ID='donascontrol-1f5df';process.env.FCM_CLIENT_EMAIL='test@example.invalid';
process.env.FCM_PRIVATE_KEY=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
global.fetch=async(raw,options)=>{
 calls++;requests.push({url:raw,options});
 if(raw==='https://oauth2.googleapis.com/token')return {ok:true,json:async()=>({access_token:'test-access',expires_in:3600})};
 const payload=JSON.parse(options.body);assert.equal(payload.message.android.priority,'HIGH');assert.equal(payload.message.data.ownerId,'owner');assert.equal(payload.message.data.deviceId,'device');
 return {ok:!invalid,status:invalid?404:200,json:async()=>invalid?{error:{details:[{errorCode:'UNREGISTERED'}]}}:{name:'accepted'}};
};
const provider=require('../api/_lib/order-notification-push');
(async()=>{
 const job={token:'device-token',ownerId:'owner',deviceId:'device',orderId:'order',publicCode:'DR-TEST',eventId:'event'};
 assert.equal((await provider.send(job)).accepted,true);
 assert.equal(JSON.parse(requests[1].options.body).message.data.type,'order_created');
 assert.ok(!JSON.parse(requests[1].options.body).message.notification,'callback displays immediately, with durable local dedupe');
 await provider.send(job,{test:true,validateOnly:true});assert.equal(calls,3,'OAuth token is reused');
 assert.equal(JSON.parse(requests[2].options.body).validate_only,true);
 invalid=true;assert.equal((await provider.send(job)).invalidToken,true);
 delete process.env.FCM_PRIVATE_KEY;const before=calls;assert.equal((await provider.send(job)).error,'FCM_NOT_CONFIGURED');assert.equal(calls,before);
 console.log('PASS FCM transport: server OAuth cache, high priority owner/device payload, validation-only, invalid token and no network when unconfigured');
})().catch(e=>{console.error(e);process.exitCode=1});
