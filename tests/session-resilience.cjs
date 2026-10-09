const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_ANON_KEY='anon';process.env.SUPABASE_SERVICE_ROLE_KEY='service';
let authStatus=200,userStatus=200;let buckets=[];
const json=(data,status=200)=>({ok:status<300,status,text:async()=>JSON.stringify(data),json:async()=>data});
global.fetch=async(raw,options={})=>{
  const url=new URL(raw);
  if(url.pathname.includes('consume_api_rate_limit')) {
    buckets.push(JSON.parse(options.body));return json({allowed:true});
  }
  if(url.pathname==='/auth/v1/token') return json({access_token:'access',refresh_token:'new-refresh-token',expires_in:3600},authStatus);
  if(url.pathname==='/auth/v1/user') return json({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},userStatus);
  if(url.pathname==='/rest/v1/app_user_roles') return json([{role:'ADMIN'}]);
  throw new Error('Unexpected test request');
};
const route=require('../api/auth/session');
async function request() {
  const res={setHeader(){},end(data){this.body=JSON.parse(data)}};
  await route({method:'POST',url:'/api/auth/session',headers:{},body:{grantType:'refresh_token',refreshToken:'old-renewable-session-token'}},res);
  return res;
}
(async()=>{
  let result=await request();assert.equal(result.statusCode,200);assert.equal(result.body.data.role,'ADMIN');assert.ok(result.body.data.userId);
  assert.ok(JSON.stringify(buckets).includes('admin_refresh'));
  authStatus=429;result=await request();assert.equal(result.statusCode,429);assert.equal(result.body.error.code,'AUTH_RATE_LIMITED');
  authStatus=503;result=await request();assert.equal(result.statusCode,502);
  authStatus=200;userStatus=503;result=await request();assert.equal(result.statusCode,502,'temporary user endpoint outage must not invalidate a mobile session');
  userStatus=429;result=await request();assert.equal(result.statusCode,429);
  userStatus=200;authStatus=400;result=await request();assert.equal(result.statusCode,401);
  console.log('PASS session renewal: separate rate budget, retryable provider outages and definitive revocation');
})().catch(error=>{console.error(error);process.exitCode=1});
