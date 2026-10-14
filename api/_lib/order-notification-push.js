'use strict';
const {sign}=require('node:crypto');
const {rpc}=require('./supabase');
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
let cachedToken,tokenRequest;
function configured(){return ['FCM_PROJECT_ID','FCM_CLIENT_EMAIL','FCM_PRIVATE_KEY'].every(k=>Boolean(process.env[k]));}
function safeError(error){return ['FCM_KEY_INVALID','FCM_AUTH_FAILED'].includes(error?.message)?error.message:'PROVIDER_UNAVAILABLE';}
async function oauthToken(){
  if(cachedToken&&cachedToken.expiresAt>Date.now()+60000)return cachedToken.token;
  if(!tokenRequest)tokenRequest=(async()=>{
    const now=Math.floor(Date.now()/1000);
    const input=`${b64({alg:'RS256',typ:'JWT'})}.${b64({iss:process.env.FCM_CLIENT_EMAIL,
      scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
    let signature;
    try{signature=sign('RSA-SHA256',Buffer.from(input),String(process.env.FCM_PRIVATE_KEY).replace(/\\n/g,'\n')).toString('base64url');}
    catch(_){throw new Error('FCM_KEY_INVALID');}
    const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(10000),
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${input}.${signature}`})});
    const result=await response.json();
    if(!response.ok||!result.access_token)throw new Error('FCM_AUTH_FAILED');
    cachedToken={token:result.access_token,expiresAt:Date.now()+Number(result.expires_in||3600)*1000};
    return cachedToken.token;
  })().finally(()=>{tokenRequest=null;});
  return tokenRequest;
}
async function send(job,{validateOnly=false,test=false}={}){
  if(!configured())return {accepted:false,invalidToken:false,error:'FCM_NOT_CONFIGURED'};
  try{
    const data={type:test?'notification_test':'order_created',ownerId:job.ownerId,deviceId:job.deviceId,
      ...(test?{eventId:job.eventId}:{orderId:job.orderId,publicCode:job.publicCode})};
    const response=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(process.env.FCM_PROJECT_ID)}/messages:send`,{
      method:'POST',signal:AbortSignal.timeout(10000),headers:{authorization:`Bearer ${await oauthToken()}`,'content-type':'application/json'},
      body:JSON.stringify({...(validateOnly?{validate_only:true}:{}),message:{token:job.token,data,
        android:{priority:'HIGH',ttl:test?'300s':'86400s'}}})});
    const result=await response.json();
    const code=result.error?.details?.find(d=>d.errorCode)?.errorCode||result.error?.status;
    const safeCode=/^[A-Z_]{1,60}$/.test(code||'')?code:String(response.status);
    return {accepted:response.ok,invalidToken:code==='UNREGISTERED',error:response.ok?null:`FCM_${safeCode}`};
  }catch(error){return {accepted:false,invalidToken:false,error:safeError(error)};}
}
async function dispatch(){
  if(!configured())return {configured:false,processed:0,accepted:0,retryable:0,invalidTokens:0};
  const jobs=await rpc('api_claim_staff_order_push',{});
  let accepted=0,retryable=0,invalidTokens=0;const errors=new Map();
  // Bound concurrency; each persisted lease is recoverable if the runtime stops.
  for(let offset=0;offset<jobs.length;offset+=5){
    await Promise.all(jobs.slice(offset,offset+5).map(async job=>{
      const result=await send(job);
      await rpc('api_finish_staff_order_push',{p_id:job.id,p_lease_id:job.leaseId,p_accepted:result.accepted,
        p_invalid_token:result.invalidToken,p_error:result.error,p_token:job.token});
      if(result.accepted)accepted++;else{
        if(result.invalidToken)invalidTokens++;else retryable++;
        const code=result.error||'PROVIDER_UNAVAILABLE';errors.set(code,(errors.get(code)||0)+1);
      }
    }));
  }
  return {configured:true,processed:jobs.length,accepted,retryable,invalidTokens,
    errors:Array.from(errors,([code,count])=>({code,count}))};
}
function enqueueDispatch(){
  if(!configured()){console.error(JSON.stringify({event:'order_notification_dispatch_pending',code:'FCM_NOT_CONFIGURED'}));return;}
  // Failure never changes the confirmed order response. The SQL queue keeps its jobs.
  const task=dispatch().then(result=>console.info(JSON.stringify({event:'order_notification_dispatch',...result})))
    .catch(error=>console.error(JSON.stringify({event:'order_notification_dispatch_pending',
      code:/^[A-Z0-9_]{1,60}$/.test(error?.code||'')?error.code:'DISPATCH_FAILED'})));
  require('@vercel/functions').waitUntil(task);
}
module.exports={configured,send,dispatch,enqueueDispatch};
