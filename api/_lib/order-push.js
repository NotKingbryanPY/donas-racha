const { sign } = require('node:crypto');
const http2 = require('node:http2');
const { rpc } = require('./supabase');
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const pem = value => String(value || '').replace(/\\n/g, '\n');
let googleToken;

function providers() {
  const android = ['FCM_PROJECT_ID','FCM_CLIENT_EMAIL','FCM_PRIVATE_KEY'].every(k => process.env[k]);
  const ios = ['APNS_TEAM_ID','APNS_KEY_ID','APNS_PRIVATE_KEY','APNS_BUNDLE_ID'].every(k => process.env[k]);
  return { android, ios };
}
async function oauthToken() {
  if (googleToken && googleToken.expiresAt > Date.now()+60000) return googleToken.token;
  const now = Math.floor(Date.now()/1000);
  const input = `${b64({alg:'RS256',typ:'JWT'})}.${b64({iss:process.env.FCM_CLIENT_EMAIL,
    scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
  const assertion = `${input}.${sign('RSA-SHA256',Buffer.from(input),pem(process.env.FCM_PRIVATE_KEY)).toString('base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'}, signal:AbortSignal.timeout(10000),
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('FCM_AUTH_FAILED');
  googleToken = {token:data.access_token,expiresAt:Date.now()+Number(data.expires_in || 3600)*1000};
  return googleToken.token;
}
async function sendAndroid(job) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(process.env.FCM_PROJECT_ID)}/messages:send`, {
    method:'POST',signal:AbortSignal.timeout(10000),headers:{authorization:`Bearer ${await oauthToken()}`,'content-type':'application/json'},
    body:JSON.stringify({message:{token:job.token,data:{orderId:job.orderId,publicCode:job.publicCode},
      android:{priority:'HIGH',ttl:'86400s',collapse_key:job.orderId}}})
  });
  const result = await response.json();
  const code = result.error?.details?.find(d=>d.errorCode)?.errorCode || result.error?.status;
  return {delivered:response.ok,invalidToken:code==='UNREGISTERED',error:response.ok?null:`FCM_${code || response.status}`};
}
function sendIOS(job) {
  const now = Math.floor(Date.now()/1000);
  const input = `${b64({alg:'ES256',kid:process.env.APNS_KEY_ID})}.${b64({iss:process.env.APNS_TEAM_ID,iat:now})}`;
  const jwt = `${input}.${sign('sha256',Buffer.from(input),{key:pem(process.env.APNS_PRIVATE_KEY),dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
  const host = job.environment==='sandbox'?'https://api.sandbox.push.apple.com':'https://api.push.apple.com';
  return new Promise((resolve,reject)=>{
    const session = http2.connect(host);
    const timer = setTimeout(()=>{session.destroy();reject(new Error('APNS_TIMEOUT'));},10000);
    const close = () => {clearTimeout(timer);session.close();};
    session.on('error',()=>{close();reject(new Error('APNS_CONNECTION'));});
    const request = session.request({':method':'POST',':path':`/3/device/${job.token}`,authorization:`bearer ${jwt}`,
      'apns-topic':process.env.APNS_BUNDLE_ID,'apns-push-type':'alert','apns-priority':'10',
      'apns-collapse-id':job.orderId,'apns-expiration':String(now+86400)});
    let status; let body='';
    request.on('response',headers=>{status=headers[':status'];});
    request.on('data',chunk=>{body+=chunk;});
    request.on('error',()=>{close();reject(new Error('APNS_REQUEST'));});
    request.on('end',()=>{close();let reason;try {reason=JSON.parse(body).reason;} catch (_) {}
      resolve({delivered:status===200,invalidToken:['Unregistered','BadDeviceToken'].includes(reason),error:status===200?null:`APNS_${reason || status}`});});
    request.end(JSON.stringify({aps:{alert:{title:`Nuevo pedido ${job.publicCode}`,body:'Abre Donas Control para revisar el pedido.'},sound:'default'},orderId:job.orderId}));
  });
}
async function dispatch() {
  const configured=providers();
  const platforms=[...(configured.android?['ANDROID']:[]),...(configured.ios?['IOS']:[])];
  if (!platforms.length) return {configured,processed:0};
  const jobs=await rpc('api_claim_order_push',{p_platforms:platforms});
  await Promise.all(jobs.map(async job=>{
    let result;
    try {result=await (job.platform==='ANDROID'?sendAndroid(job):sendIOS(job));}
    catch (_) {result={delivered:false,invalidToken:false,error:'PROVIDER_UNAVAILABLE'};}
    await rpc('api_finish_order_push',{p_id:job.id,p_lease_id:job.leaseId,p_delivered:result.delivered,
      p_invalid_token:result.invalidToken,p_error:result.error,p_token:job.token});
  }));
  return {configured,processed:jobs.length};
}
module.exports = {dispatch,providers};
