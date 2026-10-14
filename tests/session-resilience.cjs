const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_ANON_KEY='anon';process.env.SUPABASE_SERVICE_ROLE_KEY='service';
let authStatus=200,userStatus=200,staffRoles=[{role:'ADMIN'}];let buckets=[],renewals=[];
const json=(data,status=200)=>({ok:status<300,status,text:async()=>JSON.stringify(data),json:async()=>data});
global.fetch=async(raw,options={})=>{
  const url=new URL(raw);
  if(url.pathname.includes('consume_api_rate_limit')) {
    buckets.push(JSON.parse(options.body));return json({allowed:true});
  }
  if(url.pathname==='/auth/v1/token') {
    renewals.push(JSON.parse(options.body).refresh_token);
    return json({access_token:'access',refresh_token:'rotatedtoken',expires_in:3600},authStatus);
  }
  if(url.pathname==='/auth/v1/user') return json({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},userStatus);
  if(url.pathname==='/rest/v1/app_user_roles') return json(staffRoles);
  throw new Error('Unexpected test request');
};
const route=require('../api/auth/session');
async function request(...tokens) {
  const refreshToken=tokens.length?tokens[0]:'testtoken123';
  const res={setHeader(){},end(data){this.body=JSON.parse(data)}};
  await route({method:'POST',url:'/api/auth/session',headers:{},body:{grantType:'refresh_token',refreshToken}},res);
  return res;
}
(async()=>{
  let result=await request();assert.equal(result.statusCode,200);assert.equal(result.body.data.role,'ADMIN');assert.ok(result.body.data.userId);
  assert.equal(renewals.at(-1),'testtoken123','a valid twelve-character opaque token reaches Supabase unchanged');
  assert.equal(result.body.data.refreshToken,'rotatedtoken','the rotated token must be returned to the client');
  result=await request('v1.'+'x'.repeat(120));assert.equal(result.statusCode,200,'do not assume a fixed token format or length');
  const renewalCount=renewals.length;
  for(const invalid of [undefined,null,123,{token:'testtoken123'},[], '', ' ', 'test token', 'x'.repeat(4097)]) {
    result=await request(invalid);assert.equal(result.statusCode,400);assert.equal(result.body.error.code,'VALIDATION_ERROR');
  }
  assert.equal(renewals.length,renewalCount,'malformed tokens never reach the auth provider');
  assert.ok(JSON.stringify(buckets).includes('admin_refresh'));
  authStatus=429;result=await request();assert.equal(result.statusCode,429);assert.equal(result.body.error.code,'AUTH_RATE_LIMITED');
  authStatus=503;result=await request();assert.equal(result.statusCode,502);
  authStatus=200;userStatus=503;result=await request();assert.equal(result.statusCode,502,'temporary user endpoint outage must not invalidate a mobile session');
  userStatus=429;result=await request();assert.equal(result.statusCode,429);
  userStatus=200;authStatus=400;result=await request();assert.equal(result.statusCode,401);
  authStatus=200;staffRoles=[];result=await request();assert.equal(result.statusCode,403,'a renewed session cannot bypass staff roles');
  staffRoles=[{role:'SELLER'}];result=await request();assert.equal(result.statusCode,200);assert.equal(result.body.data.role,'SELLER');
  console.log('PASS session renewal: short opaque and rotated tokens, malformed input, separate rate budget, provider outages, revocation and staff authorization');
})().catch(error=>{console.error(error);process.exitCode=1});
