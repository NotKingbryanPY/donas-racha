'use strict';
const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://daily.example.supabase.co';
process.env.SUPABASE_ANON_KEY='test-anon';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let role='ADMIN',calls=0,missing=false,hash;
const json=(value,status=200)=>({ok:status<400,status,text:async()=>JSON.stringify(value)});
global.fetch=async(raw,options={})=>{
 const path=new URL(raw).pathname;
 if(path==='/auth/v1/user')return json({id:actor});
 if(path==='/rest/v1/app_user_roles')return json([{role}]);
 if(path==='/rest/v1/rpc/consume_api_rate_limit')return json({allowed:true});
 if(path==='/rest/v1/rpc/api_daily_snapshot')return missing?json({code:'PGRST202',message:'Could not find function'},404):json({schemaVersion:2,session:{id},summary:{}});
 if(path==='/rest/v1/rpc/api_daily_apply'){
   calls++;const p=JSON.parse(options.body);assert.equal(p.p_auth_user_id,actor);
   assert.match(p.p_request_hash,/^[a-f0-9]{64}$/);
   if(hash)assert.equal(p.p_request_hash,hash);hash=p.p_request_hash;
   return json({operationId:p.p_operation_id,serverSequence:12,replayed:calls>1});
 }
 throw Error('Unexpected request '+path);
};
const handler=require('../api/_lib/admin_handlers/daily');
const invoke=async(body,method='POST',authenticated=true)=>{
 const res={setHeader(){},end(text){this.body=JSON.parse(text)}};
 await handler({method,url:'/api/admin/customers/daily',headers:authenticated?{authorization:'Bearer test-user'}:{},body},res);return res;
};
(async()=>{
 const base={operationId:id,sessionId:actor,occurredAt:'2026-10-13T12:00:00.000Z',kind:'SALE',
  items:[{variantId:id,quantity:2,unitPriceCents:100}],payment:{cashCents:50,yappyCents:150}};
 assert.equal((await invoke(base,'POST',false)).statusCode,401);
 assert.equal((await invoke({...base,payment:{cashCents:1,yappyCents:2}})).statusCode,400);
 assert.equal((await invoke({...base,items:[...base.items,...base.items]})).statusCode,400);
 assert.equal((await invoke({...base,items:[{variantId:id,quantity:1.5,unitPriceCents:100}]})).statusCode,400);
 assert.equal(calls,0);
 assert.equal((await invoke(base)).statusCode,200);assert.equal((await invoke({...base,actorId:'forged',untrustedSecret:'ignored'})).statusCode,200);
 role='SELLER';hash=null;
 assert.equal((await invoke({...base,kind:'CORRECTION',note:'Conteo físico',expectedRevision:2})).statusCode,403);
 assert.equal((await invoke({} ,'GET')).statusCode,200);
 missing=true;assert.equal((await invoke({},'GET')).body.error.code,'DAILY_SETUP_REQUIRED');
 console.log('PASS daily API: actor from verified roles, split payment/quantities, stable sanitized hash and explicit missing SQL');
})().catch(e=>{console.error(e);process.exitCode=1;});
