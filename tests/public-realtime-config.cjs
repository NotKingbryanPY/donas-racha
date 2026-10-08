const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {publicRealtimeConfig}=require('../api/_lib/public-realtime');
const jwt=role=>[Buffer.from('{"alg":"HS256"}').toString('base64url'),
  Buffer.from(JSON.stringify({role})).toString('base64url'),'test_signature'].join('.');
const url='https://project.supabase.co',anonKey=jwt('anon');
assert.deepEqual(publicRealtimeConfig({url,anonKey,serviceRoleKey:'SERVER_ONLY'}),{enabled:true,url,anonKey});
assert.deepEqual(publicRealtimeConfig({url,anonKey:'sb_publishable_public_key_for_test'}),
  {enabled:true,url,anonKey:'sb_publishable_public_key_for_test'});
for (const key of [jwt('service_role'),jwt('authenticated'),'sb_secret_private_test','bad','',
  'header.invalid.signature']) assert.deepEqual(publicRealtimeConfig({url,anonKey:key}),{enabled:false});
for (const badUrl of ['http://project.supabase.co','https://supabase.co.evil.test',
  'https://user:password@project.supabase.co','https://project.supabase.co/path',
  'https://project.supabase.co/?token=secret','not a url'])
  assert.deepEqual(publicRealtimeConfig({url:badUrl,anonKey}),{enabled:false});
let serviceReads=0,limitChecks=0;
const context={module:{exports:{}},require:name=>{
  if (name==='./_lib/http') return {withApi:(_,handler)=>handler};
  if (name==='./_lib/rate-limit') return {enforceRateLimit:async()=>{limitChecks++;}};
  if (name==='./_lib/supabase') return {getConfig:()=>({url,anonKey,serviceRoleKey:'SERVER_ONLY'}),
    serviceRequest:async()=>{serviceReads++;throw new Error('Unexpected privileged read');}};
  if (name==='./_lib/public-realtime') return {publicRealtimeConfig};
  throw new Error('Unexpected module '+name);
}};
vm.runInNewContext(fs.readFileSync('api/products.js','utf8'),context);
(async()=>{
  const result=await context.module.exports({query:{view:'realtime'}});
  assert.equal(result.enabled,true);
  assert.equal(result.anonKey,anonKey);
  assert.equal(JSON.stringify(result).includes('SERVER_ONLY'),false);
  assert.equal(serviceReads,0);assert.equal(limitChecks,1);
  console.log('PASS public realtime config: legacy/publishable keys, privileged-key rejection, public-only API and no business reads');
})().catch(error=>{console.error(error);process.exitCode=1;});
