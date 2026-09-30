'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';

const customerId = '22222222-2222-4222-8222-222222222222';
const authId = '33333333-3333-4333-8333-333333333333';
let access = null;
let verifiedPhone = '+50760001111';
let otpStarts = 0;
const json = (value, status=200) => ({ok:status<400,status,text:async()=>JSON.stringify(value),json:async()=>value});
global.fetch = async (raw, options={}) => {
  const path = new URL(raw);
  const body = options.body ? JSON.parse(options.body) : null;
  if (path.pathname === '/rest/v1/customers') {
    if (path.searchParams.get('username') === 'eq.unknown') return json([]);
    return json([{id:customerId,public_id:'CABC123',username:'bryan.hurtado',display_name:'Bryan Hurtado',whatsapp_e164:'+50760001111',status:'ACTIVE'}]);
  }
  if (path.pathname === '/rest/v1/customer_web_access') return json(access ? [access] : []);
  if (path.pathname === '/rest/v1/rpc/consume_api_rate_limit') return json({allowed:true});
  if (path.pathname === '/auth/v1/otp') {
    assert.equal(options.headers.apikey,'test-anon');
    assert.deepEqual(body,{phone:'+50760001111',channel:'whatsapp',create_user:true});
    otpStarts++;
    return json({});
  }
  if (path.pathname === '/auth/v1/verify') {
    assert.equal(body.phone,'+50760001111');
    assert.equal(body.type,'sms');
    if (body.token !== '123456') return json({message:'Invalid token'},403);
    return json({user:{id:authId,phone:verifiedPhone,phone_confirmed_at:new Date().toISOString()}});
  }
  if (path.pathname === '/rest/v1/rpc/api_set_customer_password_by_verified_phone') {
    assert.equal(body.p_customer_id,customerId);
    assert.equal(body.p_phone_auth_user_id,authId);
    const version=(access?.credential_version || 1)+1;
    access={customer_id:customerId,password_salt:body.p_salt,password_hash:body.p_hash,credential_version:version};
    return json(version);
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
  const start=await call('activation',{action:'start',username:'Bryan.Hurtado'});
  assert.equal(start.statusCode,200);
  assert.equal(otpStarts,1);
  assert(!JSON.stringify(start.body).includes('+50760001111'));
  const wrong=await call('activation',{action:'complete',username:'bryan.hurtado',code:'999999',newPassword:'first-password-123'});
  assert.equal(wrong.body.error.code,'INVALID_OTP');
  verifiedPhone='+50769999999';
  const mismatch=await call('activation',{action:'complete',username:'bryan.hurtado',code:'123456',newPassword:'first-password-123'});
  assert.equal(mismatch.body.error.code,'INVALID_VERIFICATION');
  assert.equal(access,null);
  verifiedPhone='+50760001111';
  const activated=await call('activation',{action:'complete',username:'bryan.hurtado',code:'123456',newPassword:'first-password-123'});
  assert.equal(activated.statusCode,200,JSON.stringify(activated.body));
  assert.match(activated.body.data.accessToken,/^dr1\./);
  assert.equal(activated.body.data.customer.username,'bryan.hurtado');
  assert.equal(crypto.scryptSync('first-password-123',Buffer.from(access.password_salt,'hex'),64).toString('hex'),access.password_hash);
  const missing=await call('session',{username:'bryan.hurtado'});
  assert.equal(missing.body.error.code,'PASSWORD_REQUIRED');
  const login=await call('session',{username:'BRYAN.HURTADO',password:'first-password-123'});
  assert.equal(login.statusCode,200);
  const legacy=await call('session',{publicId:'CABC123',password:'first-password-123'});
  assert.equal(legacy.statusCode,200);
  console.log('PASS customer activation: phone OTP, mismatch rejection, password creation, username and legacy ID login');
})().catch(error=>{console.error(error);process.exitCode=1;});
