const assert=require('node:assert/strict');
const {generateKeyPairSync,verify}=require('node:crypto');
const {EventEmitter}=require('node:events');
const http2=require('node:http2');
const rpcPath=require.resolve('../api/_lib/supabase');
let jobs=[],finishes=[],claims=0,androidInvalid=false,iosInvalid=false,providerFailure=false,oauthRequests=0,validated=0;
require.cache[rpcPath]={id:rpcPath,filename:rpcPath,loaded:true,exports:{rpc:async(name,body)=>{
  if(name==='api_claim_order_push') { claims++;return jobs; }
  assert.equal(name,'api_finish_order_push');finishes.push(body);
}}};
const rsa=generateKeyPairSync('rsa',{modulusLength:2048});
const ec=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
function checkJWT(jwt,key,algorithm) {
  const parts=jwt.split('.');assert.equal(parts.length,3);
  assert.ok(verify(algorithm,Buffer.from(parts.slice(0,2).join('.')),{key,dsaEncoding:'ieee-p1363'},Buffer.from(parts[2],'base64url')));
}
global.fetch=async(url,options)=>{
  if(providerFailure) throw new Error('temporary');
  if(url.includes('oauth2.googleapis.com')) {
    oauthRequests++;
    checkJWT(options.body.get('assertion'),rsa.publicKey,'RSA-SHA256');
    return {ok:true,json:async()=>({access_token:'oauth-test',expires_in:3600})};
  }
  assert.ok(url.includes('fcm.googleapis.com/v1/projects/test-project/messages:send'));
  const message=JSON.parse(options.body).message;
  if (JSON.parse(options.body).validate_only) {
    assert.deepEqual(message.data,{type:'configuration_check'}); validated++;
    return {ok:true,json:async()=>({name:'validated-not-sent'})};
  }
  assert.equal(message.android.priority,'HIGH');assert.equal(message.data.orderId,'order-1');
  assert.ok(!JSON.stringify(message).includes('customer'));
  return {ok:!androidInvalid,status:androidInvalid?404:200,json:async()=>androidInvalid?{error:{details:[{errorCode:'UNREGISTERED'}]}}:{name:'sent'}};
};
http2.connect=(host)=>{
  assert.equal(host,'https://api.sandbox.push.apple.com');
  const session=new EventEmitter();session.close=()=>{};session.destroy=()=>{};
  session.request=headers=>{
    checkJWT(headers.authorization.slice(7),ec.publicKey,'sha256');
    assert.equal(headers['apns-topic'],'com.bryan.donas.control');assert.equal(headers['apns-push-type'],'alert');
    const request=new EventEmitter();request.end=body=>{
      assert.equal(JSON.parse(body).aps.sound,'default');assert.ok(!body.includes('customer'));
      queueMicrotask(()=>{request.emit('response',{':status':iosInvalid?410:200});request.emit('data',iosInvalid?'{"reason":"Unregistered"}':'');request.emit('end');});
    };return request;
  };return session;
};
const push=require('../api/_lib/order-push');
(async()=>{
  for(const key of ['FCM_PROJECT_ID','FCM_CLIENT_EMAIL','FCM_PRIVATE_KEY','APNS_TEAM_ID','APNS_KEY_ID','APNS_PRIVATE_KEY','APNS_BUNDLE_ID']) delete process.env[key];
  assert.equal((await push.dispatch()).processed,0);assert.equal(claims,0);
  assert.deepEqual(await push.checkAndroid('own-token'),{status:'FCM_NOT_CONFIGURED',validated:false});
  Object.assign(process.env,{FCM_PROJECT_ID:'test-project',FCM_CLIENT_EMAIL:'test@example.test',FCM_PRIVATE_KEY:rsa.privateKey.export({type:'pkcs8',format:'pem'}),
    APNS_TEAM_ID:'TEAM',APNS_KEY_ID:'KEY',APNS_BUNDLE_ID:'com.bryan.donas.control',APNS_PRIVATE_KEY:ec.privateKey.export({type:'pkcs8',format:'pem'})});
  jobs=[{id:'job-1',leaseId:'lease',platform:'ANDROID',token:'token-1',orderId:'order-1',publicCode:'DR-1'},
    {id:'job-2',leaseId:'lease',platform:'IOS',environment:'sandbox',token:'token-2',orderId:'order-1',publicCode:'DR-1'}];
  assert.deepEqual(await push.dispatch(),{configured:{android:true,ios:true},processed:2,accepted:2,retryable:0,invalidTokens:0});
  assert.ok(finishes.every(x=>x.p_delivered && !x.p_invalid_token));
  assert.deepEqual(finishes.map(x=>x.p_token).sort(),['token-1','token-2']);
  assert.deepEqual(await push.checkAndroid('own-token'),{status:'FCM_VALIDATED',validated:true});
  assert.equal(validated,1);assert.equal(oauthRequests,1,'warm token reused for diagnostics');
  finishes=[];androidInvalid=true;iosInvalid=true;assert.equal((await push.dispatch()).invalidTokens,2);assert.ok(finishes.every(x=>!x.p_delivered && x.p_invalid_token));
  finishes=[];providerFailure=true;jobs=jobs.slice(0,1);assert.equal((await push.dispatch()).retryable,1);assert.equal(finishes[0].p_invalid_token,false);
  assert.deepEqual(await push.checkAndroid('own-token'),{status:'PROVIDER_UNAVAILABLE',validated:false});
  console.log('PASS FCM/APNs signing, safe alerts, exact token invalidation and retryable outages (mock providers)');
})().catch(error=>{console.error(error);process.exitCode=1;});
