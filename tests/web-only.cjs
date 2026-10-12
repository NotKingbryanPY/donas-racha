const assert=require('node:assert/strict'),fs=require('node:fs');
process.env.SUPABASE_URL='https://web.example.supabase.co';process.env.SUPABASE_ANON_KEY='test';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
let calls=0;
global.fetch=async raw=>{calls++;const p=new URL(raw).pathname;return {ok:true,status:200,text:async()=>JSON.stringify(p==='/auth/v1/user'?{id:'admin'}:[{role:'ADMIN'}])};};
const auth=require('../api/_lib/auth');
const router=require('../api/admin/customers/[route]'),sync=require('../api/sync');
async function request(handler,route,method){const res={setHeader(){},end(body){this.body=JSON.parse(body)}};await handler({method,url:'/retired',query:{route},headers:{}},res);return res;}
(async()=>{
  for(const route of ['devices','provisioning','firebase-identity'])for(const method of ['GET','POST','DELETE'])assert.equal((await request(router,route,method)).statusCode,410);
  for(const method of ['GET','POST'])assert.equal((await request(sync,'',method)).statusCode,410);
  assert.equal(calls,0,'retired endpoints must never read credentials, send push or write stock');
  await assert.rejects(auth.requireStaff({headers:{authorization:'Bearer drd.old-mobile-token'}}),e=>e.status===401);
  assert.equal(calls,0);
  assert.equal((await auth.requireStaff({headers:{authorization:'Bearer web-session'}})).role,'ADMIN');
  const html=fs.readFileSync('index.html','utf8');assert.ok(!html.includes('staffDevicesPanel'));assert.ok(!html.includes('staff-devices.js'));assert.ok(!html.includes('Donas Control'));
  assert.equal(fs.existsSync('.github/workflows/order-push-retry.yml'),false);
  assert.equal(fs.existsSync('api/_lib/order-push.js'),false);
  assert.deepEqual(require('../package.json').dependencies,{});
  console.log('PASS web-only access: retired mobile APIs do no work, web ADMIN still works, no push cron/SDK/UI');
})().catch(e=>{console.error(e);process.exitCode=1});
