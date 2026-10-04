'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';

const customerId = '22222222-2222-4222-8222-222222222222';
let access = null;
const json = (value, status=200) => ({ok:status<400,status,text:async()=>JSON.stringify(value),json:async()=>value});
global.fetch = async (raw, options={}) => {
  const path = new URL(raw);
  const body = options.body ? JSON.parse(options.body) : null;
  if (path.pathname === '/rest/v1/customers') {
    if (path.searchParams.get('username') === 'eq.unknown') return json([]);
    return json([{id:customerId,public_id:'CABC123',username:'bryan.hurtado',display_name:'Bryan Hurtado',whatsapp_e164:null,status:'ACTIVE'}]);
  }
  if (path.pathname === '/rest/v1/customer_web_access') return json(access ? [access] : []);
  if (path.pathname === '/rest/v1/rpc/consume_api_rate_limit') return json({allowed:true});
  if (path.pathname === '/rest/v1/rpc/api_claim_customer_password') {
    assert.equal(body.p_customer_id,customerId);
    if (access?.password_hash) return json({message:'PASSWORD_ALREADY_SET',code:'P0001'},400);
    access={customer_id:customerId,password_salt:body.p_salt,password_hash:body.p_hash,credential_version:2};
    return json(2);
  }
  if (path.pathname === '/rest/v1/rpc/api_change_customer_password') {
    assert.equal(body.p_customer_id,customerId);
    assert.equal(body.p_old_hash,access.password_hash);
    assert.equal(body.p_old_version,access.credential_version);
    access={...access,password_salt:body.p_salt,password_hash:body.p_hash,credential_version:access.credential_version+1};
    return json(access.credential_version);
  }
  if (path.pathname === '/rest/v1/rpc/api_set_customer_password') {
    assert.equal(body.p_customer_id,customerId);
    if (body.p_token !== 'deadbeef') return json({message:'INVALID_PASSWORD_TOKEN',code:'42501'},400);
    access={...access,password_salt:body.p_salt,password_hash:body.p_hash,credential_version:access.credential_version+1};
    return json(access.credential_version);
  }
  throw new Error(`Unexpected URL: ${raw}`);
};
const route=require('../api/customer/[route]');
const {issueSession}=require('../api/_lib/customer-id-session');
const response=()=>({statusCode:200,setHeader(){},end(body){this.body=JSON.parse(body);}});
async function call(name,body,headers={}) {
  const res=response();
  await route({method:'POST',url:`/api/customer/${name}`,query:{route:name},headers,body},res);
  return res;
}

(async()=>{
  const before=await call('session',{username:'BRYAN.HURTADO'});
  assert.equal(before.body.error.code,'PASSWORD_SETUP_REQUIRED');
  const stale=response();
  await route({method:'GET',url:'/api/customer/profile',query:{route:'profile'},headers:{authorization:`Bearer ${issueSession(customerId,1)}`}},stale);
  assert.equal(stale.body.error.code,'PASSWORD_SETUP_REQUIRED');
  const activated=await call('activation',{username:'bryan.hurtado',newPassword:'first-password-123'});
  assert.equal(activated.statusCode,200,JSON.stringify(activated.body));
  assert.match(activated.body.data.accessToken,/^dr1\./);
  assert.equal(activated.body.data.customer.username,'bryan.hurtado');
  assert.equal(crypto.scryptSync('first-password-123',Buffer.from(access.password_salt,'hex'),64).toString('hex'),access.password_hash);
  const repeated=await call('activation',{username:'BRYAN.HURTADO',newPassword:'other-password-123'});
  assert.equal(repeated.body.error.code,'PASSWORD_ALREADY_SET');
  const missing=await call('session',{username:'bryan.hurtado'});
  assert.equal(missing.body.error.code,'PASSWORD_REQUIRED');
  const login=await call('session',{username:'BRYAN.HURTADO',password:'first-password-123'});
  assert.equal(login.statusCode,200);
  const legacy=await call('session',{publicId:'CABC123',password:'first-password-123'});
  assert.equal(legacy.statusCode,200);
  const token=login.body.data.accessToken;
  const wrong=await call('change-password',{currentPassword:'wrong-password',newPassword:'new-password-123'},{authorization:`Bearer ${token}`});
  assert.equal(wrong.body.error.code,'INVALID_CREDENTIALS');
  const changed=await call('change-password',{currentPassword:'first-password-123',newPassword:'new-password-123'},{authorization:`Bearer ${token}`});
  assert.equal(changed.statusCode,200,JSON.stringify(changed.body));
  assert.equal(access.credential_version,3);
  const old=await call('session',{username:'bryan.hurtado',password:'first-password-123'});
  assert.equal(old.body.error.code,'INVALID_CREDENTIALS');
  const updated=await call('session',{username:'bryan.hurtado',password:'new-password-123'});
  assert.equal(updated.statusCode,200);
  const recovered=await call('password',{username:'BRYAN.HURTADO',code:'deadbeef',newPassword:'recovered-password-123'});
  assert.equal(recovered.statusCode,200);
  assert.equal(access.credential_version,4);
  console.log('PASS direct activation: no phone required, one-time claim, password change, admin recovery and legacy ID login');
})().catch(error=>{console.error(error);process.exitCode=1;});
