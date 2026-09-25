'use strict';
const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_ANON_KEY='anon-test';
process.env.SUPABASE_SERVICE_ROLE_KEY='service-test';
const json=value=>({ok:true,status:200,text:async()=>JSON.stringify(value),json:async()=>value});
global.fetch=async (raw,options={})=>{
  const url=new URL(raw);
  if(url.pathname==='/rest/v1/rpc/consume_api_rate_limit') return json({allowed:true});
  if(url.pathname==='/auth/v1/token') {
    const credentials=JSON.parse(options.body);
    assert.equal(credentials.password.length,6);
    return json({access_token:'admin-access',refresh_token:'admin-refresh-token',expires_in:3600});
  }
  if(url.pathname==='/auth/v1/user') return json({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
  if(url.pathname==='/rest/v1/app_user_roles') return json([{auth_user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}]);
  throw new Error(`Unexpected URL ${raw}`);
};
const route=require('../api/auth/session');
(async()=>{
  const res={statusCode:200,setHeader(){},end(value){this.body=JSON.parse(value);}};
  await route({method:'POST',url:'/api/auth/session',headers:{},body:{grantType:'password',email:'seller@example.test',password:'654321'}},res);
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(res.body.data.accessToken,'admin-access');
  console.log('PASS seller auth accepts a six-character Supabase password');
})().catch(error=>{console.error(error);process.exitCode=1;});
