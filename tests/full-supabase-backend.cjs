'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_ANON_KEY='anon-test';
process.env.SUPABASE_SERVICE_ROLE_KEY='service-test';

const adminId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const customerId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const customer = { id:customerId,public_id:null,display_name:'Ana',whatsapp_e164:'+50760001111',status:'ACTIVE',registered_at:new Date().toISOString(),last_purchase_at:null };
const account = { customer_id:customerId,available_points:0,lifetime_points:0,purchase_points:0,purchase_count:0,redemption_count:0,level_key:'BRONCE' };
const streak = { customer_id:customerId,current_count:0,best_count:0,current_season_number:1,last_qualified_at:null };
const todayCredits=[];
const creditedKeys=new Set();
const calls=[];
const json = value => ({ok:true,status:200,text:async()=>JSON.stringify(value)});
global.fetch=async (raw,options={}) => {
  const url=new URL(raw), path=url.pathname, body=options.body?JSON.parse(options.body):null;
  calls.push({path,body});
  if(path==='/auth/v1/user') return String(options.headers?.authorization || '').includes('dr1.')
    ?{ok:false,status:401,text:async()=>JSON.stringify({message:'Invalid token'})}:json({id:adminId});
  if(path==='/rest/v1/app_user_roles') return json([{auth_user_id:adminId}]);
  if(path==='/rest/v1/rpc/consume_api_rate_limit') return json({allowed:true});
  if(path==='/rest/v1/rpc/api_register_customer') {
    customer.public_id=body.p_public_id;
    return json(customer);
  }
  if(path==='/rest/v1/rpc/api_credit_purchase') {
    assert.equal(body.p_customer_id,customerId);
    if (creditedKeys.has(body.p_idempotency_key)) return json({credited:true,replayed:true,pointsEarned:10});
    if (todayCredits.length >= 3) return json({credited:false,limitReached:true,purchasesToday:3});
    creditedKeys.add(body.p_idempotency_key);
    account.available_points+=10;account.lifetime_points+=10;account.purchase_points+=10;account.purchase_count++;
    if (!todayCredits.length) streak.current_count++;
    customer.last_purchase_at=new Date().toISOString();
    todayCredits.push({occurred_at:customer.last_purchase_at,metadata:{streak:streak.current_count},entry_type:'PURCHASE_EARN',points_delta:10});
    return json({credited:true,pointsEarned:10,newStreak:1,completedSeason:false,badgesAssigned:[]});
  }
  if(path==='/rest/v1/rpc/api_redeem_customer_reward') {
    assert.equal(body.p_customer_id,customerId);
    account.available_points-=5;account.redemption_count++;
    return json({id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',pointsAvailable:account.available_points,pointsSpent:5});
  }
  if(path==='/rest/v1/rpc/api_admin_adjust_loyalty') {
    assert.equal(body.p_admin_user_id,adminId);
    assert.equal(body.p_customer_id,customerId);
    assert.equal(body.p_kind,'HISTORICAL_PURCHASES');
    assert.equal(body.p_amount,2);
    account.available_points+=20;account.lifetime_points+=20;account.purchase_points+=20;account.purchase_count+=2;
    return json({replayed:false,adjustmentId:crypto.randomUUID()});
  }
  if(path==='/rest/v1/customers') {
    const wanted=url.searchParams.get('public_id')?.slice(3) || url.searchParams.get('id')?.slice(3);
    return json(customer.public_id && wanted && [customer.id,customer.public_id].includes(wanted)?[customer]:[]);
  }
  if(path==='/rest/v1/customer_web_access') return json([]);
  if(path==='/rest/v1/loyalty_accounts') return json([account]);
  if(path==='/rest/v1/loyalty_admin_adjustments') return json([{kind:'HISTORICAL_PURCHASES',amount:2,reason:'Compras anteriores'}]);
  if(path==='/rest/v1/customer_streaks') return json([streak]);
  if(path==='/rest/v1/loyalty_levels') return json([{key:'BRONCE',name:'Bronce',emoji:'🥉',minimum_lifetime_points:0},{key:'PLATA',name:'Plata',emoji:'🥈',minimum_lifetime_points:200}]);
  if(path==='/rest/v1/business_settings') return json([{id:true,active:true,streak_tolerance_days:3,donut_price_cents:100,points_base:10,points_streak_3:12,points_streak_7:15,points_streak_14:17}]);
  if(path==='/rest/v1/rewards') return json([{key:'DONA_GRATIS',name:'Dona',emoji:'🍩',points_cost:5,reward_type:'PRODUCT',reward_value:'1 dona',description:'',display_order:1}]);
  if(path==='/rest/v1/loyalty_transactions') return json(todayCredits);
  if(['/rest/v1/customer_badges','/rest/v1/reward_redemptions','/rest/v1/streak_seasons'].includes(path)) return json([]);
  throw new Error(`Unexpected URL ${raw}`);
};

const backend=require('../api/backend');
const customerRoute=require('../api/customer/[route]');
const response=()=>({statusCode:200,setHeader(){},end(value){this.body=JSON.parse(value);}});
async function call(handler,method,url,query={},body={},token=null) {
  const res=response();
  await handler({method,url,query,body,headers:token?{authorization:`Bearer ${token}`}:{ }},res);
  return res;
}
(async()=>{
  const unauthorized=await call(backend,'POST','/api/backend',{}, {action:'nuevoCliente',name:'Ana',idempotencyKey:crypto.randomUUID()});
  assert.equal(unauthorized.statusCode,401);
  const registered=await call(backend,'POST','/api/backend',{}, {action:'nuevoCliente',name:'Ana',whatsapp:'60001111',idempotencyKey:crypto.randomUUID()},'admin-test');
  assert.equal(registered.statusCode,200,JSON.stringify(registered.body));
  const publicId=registered.body.data.client.id;
  assert.match(publicId,/^C[0-9A-F]{18}$/);
  const session=await call(customerRoute,'POST','/api/customer/session',{route:'session'},{publicId});
  assert.equal(session.statusCode,200,JSON.stringify(session.body));
  const token=session.body.data.accessToken;
  const profile=await call(backend,'GET','/api/backend',{action:'getCliente',id:publicId},{},token);
  assert.equal(profile.body.data.client.name,'Ana');
  const stranger=await call(backend,'GET','/api/backend',{action:'getCliente',id:'COTHER123'},{},token);
  assert.notEqual(stranger.statusCode,200);
  const purchase=await call(backend,'POST','/api/backend',{}, {action:'registrarCompra',clientId:publicId,idempotencyKey:crypto.randomUUID()},'admin-test');
  assert.equal(purchase.statusCode,200,JSON.stringify(purchase.body));
  assert.equal(purchase.body.data.client.pointsAvailable,10);
  assert.equal(purchase.body.data.client.purchasesToday,1);
  const redeem=await call(backend,'POST','/api/backend',{}, {action:'canjearRecompensa',clientId:publicId,itemId:'DONA_GRATIS',idempotencyKey:crypto.randomUUID()},token);
  assert.equal(redeem.statusCode,200,JSON.stringify(redeem.body));
  assert.equal(redeem.body.data.client.pointsAvailable,5);
  const blocked=await call(backend,'POST','/api/backend',{}, {action:'adminAdjustLoyalty',clientId:publicId,kind:'HISTORICAL_PURCHASES',amount:2,reason:'Compras anteriores',idempotencyKey:crypto.randomUUID()},token);
  assert.notEqual(blocked.statusCode,200,'customer ID session cannot write admin adjustments');
  const adjusted=await call(backend,'POST','/api/backend',{}, {action:'adminAdjustLoyalty',clientId:publicId,kind:'HISTORICAL_PURCHASES',amount:2,reason:'Compras anteriores',idempotencyKey:crypto.randomUUID()},'admin-test');
  assert.equal(adjusted.statusCode,200,JSON.stringify(adjusted.body));
  assert.equal(adjusted.body.data.client.totalPurchases,3);
  for (const count of [2,3]) {
    const next=await call(backend,'POST','/api/backend',{}, {action:'registrarCompra',clientId:publicId,idempotencyKey:crypto.randomUUID()},'admin-test');
    assert.equal(next.statusCode,200,JSON.stringify(next.body));
    assert.equal(next.body.data.client.purchasesToday,count);
  }
  const overLimit=await call(backend,'POST','/api/backend',{}, {action:'registrarCompra',clientId:publicId,idempotencyKey:crypto.randomUUID()},'admin-test');
  assert.equal(overLimit.statusCode,409);
  assert.equal(overLimit.body.error.code,'DAILY_PURCHASE_LIMIT');
  assert.equal(streak.current_count,1,'three purchases count as one streak day');
  const history=await call(backend,'GET','/api/backend',{action:'getAdminLoyaltyHistory',clientId:publicId},{},'admin-test');
  assert.equal(history.body.data.changes[0].amount,2);
  assert.equal(calls.some(item=>item.path.includes('script.google')),false);
  console.log('PASS Supabase backend: admin registration, ID login, three daily purchases, streak day, redemption');
})().catch(error=>{console.error(error);process.exitCode=1;});
