const assert=require('node:assert/strict');
function stub(path,exports){const key=require.resolve(path);require.cache[key]={id:key,filename:key,loaded:true,exports};}
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',legacy='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
stub('../api/_lib/auth',{requireAdmin:async()=>({id:'test-admin',role:'ADMIN'})});
stub('../api/_lib/rate-limit',{enforceRateLimit:async()=>{}});
stub('../api/_lib/supabase',{serviceRequest:async(table,{query})=>{
  assert.ok(!query.includes('token_hash')&&!query.includes('auth_user_id'));
  if(table==='staff_device_credentials')return [{device_public_id:id,role:'SELLER',revoked:false,expires_at:'2027-01-01',created_at:'2026-10-07'}];
  assert.equal(table,'app_devices');return [{device_public_id:id,status:'REVOKED',created_at:'2026-10-07'},
    {device_public_id:legacy,status:'ACTIVE',created_at:'2026-10-08'}];
}});
const handler=require('../api/_lib/admin_handlers/provisioning');
(async()=>{
  let result;const res={setHeader(){},end(body){result=JSON.parse(body);}};
  await handler({method:'GET',headers:{authorization:'Bearer test'},url:'/api/admin/customers/provisioning'},res);
  assert.equal(res.statusCode,200);assert.equal(result.data.devices.length,2);
  assert.equal(result.data.devices[0].device_public_id,legacy,'legacy/Firebase account devices remain visible and revocable');
  assert.equal(result.data.devices[1].revoked,true,'registration revocation cannot be hidden by an old active credential');
  console.log('PASS staff device list: invitation and account devices, deduplication, revocation state and no private token/owner fields');
})().catch(e=>{console.error(e);process.exitCode=1;});
