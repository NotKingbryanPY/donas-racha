// Staff-only API contract with mocked Supabase transport.
const assert=require('node:assert/strict');
const sellerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const outsiderId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const redemptionId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_ANON_KEY='anon-test';
process.env.SUPABASE_SERVICE_ROLE_KEY='service-test';
const json=value=>({ok:true,status:200,text:async()=>JSON.stringify(value)});
const calls=[];
global.fetch=async(raw,options={})=>{
  const url=new URL(raw),path=url.pathname,body=options.body?JSON.parse(options.body):null;
  calls.push({path,body});
  if(path==='/auth/v1/user') return json({id:String(options.headers.authorization).includes('seller')?sellerId:outsiderId});
  if(path==='/rest/v1/app_user_roles') return json(url.searchParams.get('auth_user_id')===`eq.${sellerId}`?[{role:'SELLER'}]:[]);
  if(path==='/rest/v1/rpc/consume_api_rate_limit') return json({allowed:true});
  if(path==='/rest/v1/reward_redemptions') return json([{
    id:redemptionId,public_code:'CANJE123',points_cost_snapshot:150,reward_name_snapshot:'Dona gratis',
    status:'PENDING',created_at:'2026-09-29T12:00:00Z',fulfilled_at:null,cancelled_at:null,
    customers:{public_id:'C1234',display_name:'Ana'}
  }]);
  if(path==='/rest/v1/rpc/api_staff_resolve_redemption') return json({
    id:body.p_redemption_id,status:body.p_status,pointsReturned:body.p_status==='CANCELLED'?150:0,replayed:false
  });
  throw new Error(`Unexpected URL ${raw}`);
};
const handler=require('../api/backend');
async function call(method,query,body,token){
  const response={statusCode:200,setHeader(){},end(value){this.body=JSON.parse(value);}};
  await handler({method,url:'/api/backend',query,body,headers:token?{authorization:`Bearer ${token}`}:{}},response);
  return response;
}
(async()=>{
  const denied=await call('GET',{action:'getCanjes'},null);
  assert.equal(denied.statusCode,401);
  const outsider=await call('GET',{action:'getCanjes'},null,'outsider');
  assert.equal(outsider.statusCode,403);
  const listed=await call('GET',{action:'getCanjes',status:'PENDING'},null,'seller');
  assert.equal(listed.statusCode,200);
  assert.equal(listed.body.data.redemptions[0].customerId,'C1234');
  assert.equal(listed.body.data.redemptions[0].points,150);
  const invalid=await call('POST',{}, {action:'resolverCanje',redemptionId,status:'REFUNDED'},'seller');
  assert.equal(invalid.statusCode,400);
  const resolved=await call('POST',{}, {action:'resolverCanje',redemptionId,status:'CANCELLED'},'seller');
  assert.equal(resolved.statusCode,200);
  assert.equal(resolved.body.data.redemption.pointsReturned,150);
  const rpc=calls.find(item=>item.path==='/rest/v1/rpc/api_staff_resolve_redemption');
  assert.equal(rpc.body.p_staff_user_id,sellerId);
  assert.equal(rpc.body.p_redemption_id,redemptionId);
  console.log('PASS redemption API: staff-only list and transition, validated status and actor');
})().catch(error=>{console.error(error);process.exitCode=1;});
