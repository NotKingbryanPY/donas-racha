'use strict';

const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const customerId = '22222222-2222-4222-8222-222222222222';
let access = null;
const json = value => ({ ok:true, status:200, text:async()=>JSON.stringify(value) });
global.fetch = async (url, options={}) => {
  const path = new URL(url);
  if (path.pathname === '/rest/v1/customers') return json([{
    id:customerId, public_id:'CABC123', display_name:'Ana', whatsapp_e164:'+50760001111', status:'ACTIVE'
  }]);
  if (path.pathname === '/rest/v1/customer_web_access') return json(access ? [access] : []);
  if (path.pathname === '/rest/v1/rpc/consume_api_rate_limit') return json({allowed:true});
  if (path.pathname === '/rest/v1/rpc/api_set_customer_password') {
    const body=JSON.parse(options.body);
    assert.equal(body.p_token, 'a'.repeat(8));
    access={customer_id:customerId,password_salt:body.p_salt,password_hash:body.p_hash,credential_version:2};
    return json(2);
  }
  throw new Error(`Unexpected URL: ${url}`);
};
const route=require('../api/customer/[route]');
const response=()=>({statusCode:200,setHeader(){},end(body){this.body=JSON.parse(body);}});
async function call(name, body, headers={}) {
  const res=response();
  await route({method:'POST',url:`/api/customer/${name}`,query:{route:name},headers,body},res);
  return res;
}

(async()=>{
  const first=await call('session',{publicId:'CABC123'});
  assert.equal(first.statusCode,200);
  const oldToken=first.body.data.accessToken;

  const set=await call('password',{publicId:'CABC123',code:'a'.repeat(8),newPassword:'long-passphrase-123'});
  assert.equal(set.statusCode,200);
  assert.notEqual(set.body.data.accessToken,oldToken);

  const missing=await call('session',{publicId:'CABC123'});
  assert.equal(missing.statusCode,401);
  assert.equal(missing.body.error.code,'PASSWORD_REQUIRED');
  const wrong=await call('session',{publicId:'CABC123',password:'wrong'});
  assert.equal(wrong.statusCode,401);
  assert.equal(wrong.body.error.code,'INVALID_CREDENTIALS');
  const correct=await call('session',{publicId:'CABC123',password:'long-passphrase-123'});
  assert.equal(correct.statusCode,200);

  const profile=response();
  await route({method:'GET',url:'/api/customer/profile',query:{route:'profile'},
    headers:{authorization:`Bearer ${oldToken}`}},profile);
  assert.equal(profile.statusCode,401);
  assert.equal(profile.body.error.code,'INVALID_SESSION');
  console.log('PASS optional password prompts after ID and invalidates earlier ID-only sessions');
})().catch(error=>{console.error(error);process.exitCode=1;});
