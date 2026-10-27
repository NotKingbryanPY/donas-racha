'use strict';
const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://ranking.example.supabase.co';
process.env.SUPABASE_ANON_KEY='test-anon';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let role='SELLER',calls=0,missing=false,parameters;
const json=(value,status=200)=>({ok:status<400,status,text:async()=>JSON.stringify(value)});
global.fetch=async(raw,options={})=>{
 const path=new URL(raw).pathname;
 if(path==='/auth/v1/user')return json({id:actor});
 if(path==='/rest/v1/app_user_roles')return json(role?[{role}]:[]);
 if(path==='/rest/v1/rpc/consume_api_rate_limit')return json({allowed:true});
 if(path==='/rest/v1/rpc/api_staff_weekly_ranking'){
  calls++;parameters=JSON.parse(options.body);
  return missing?json({code:'PGRST202',message:'Missing function'},404):json({ranking:[{id:'CPRIVATE',name:'Ana',weeklyPurchases:3}],weeks:['2026-10-26']});
 }
 throw Error('Unexpected '+path);
};
const handler=require('../api/admin/customers/[route]');
const invoke=async(query={},authorization='Bearer staff',method='GET')=>{
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(text){this.body=JSON.parse(text);}};
 await handler({method,url:'/api/admin/customers/weekly-ranking',headers:authorization?{authorization}:{},query:{route:'weekly-ranking',...query}},res);return res;
};
(async()=>{
 assert.equal((await invoke({},null)).statusCode,401);assert.equal(calls,0);
 role=null;assert.equal((await invoke()).statusCode,403);assert.equal(calls,0);
 role='SELLER';assert.equal((await invoke()).statusCode,200);
 assert.deepEqual(parameters,{p_auth_user_id:actor,p_week:null,p_limit:100});
 role='ADMIN';const result=await invoke({week:'2026-10-26',p_auth_user_id:'forged'});
 assert.equal(result.statusCode,200);assert.equal(parameters.p_auth_user_id,actor);assert.equal(parameters.p_week,'2026-10-26');
 assert.equal(result.headers['cache-control'],'no-store');
 for(const week of ['2026-02-30','2026-10-27','garbage',['2026-10-26'],'']) assert.equal((await invoke({week})).statusCode,400);
 assert.equal((await invoke({},'Bearer drd.retired')).statusCode,401);
 assert.equal((await invoke({},'Bearer staff','POST')).statusCode,405);
 missing=true;assert.equal((await invoke()).body.error.code,'WEEKLY_RANKING_SETUP_REQUIRED');
 console.log('PASS weekly API: verified staff, forbidden customers, actor spoofing, strict dates, no-store and SQL activation message');
})().catch(e=>{console.error(e);process.exitCode=1;});
