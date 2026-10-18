const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_ANON_KEY='test-anon';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-service';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const records=[...Array.from({length:51},(_,i)=>({id:randomUUID(),customer_id:A,public_code:'DR-'+i.toString(16).padStart(10,'0').toUpperCase(),status:'PENDING',updated_at:'2026-10-18T10:00:00.123456+00:00',created_at:'2026-09-01T10:00:00Z'})),
  ...Array.from({length:12},(_,i)=>({id:randomUUID(),customer_id:A,public_code:'DR-'+(100+i).toString(16).padStart(10,'0').toUpperCase(),status:'COMPLETED',created_at:'2026-10-18T10:00:00Z'})),
  {id:randomUUID(),customer_id:B,public_code:'DR-BBBBBBBBBB',status:'PENDING',created_at:'2026-10-18T11:00:00Z'}];
const reads=[];
global.fetch=async raw=>{
  const url=new URL(raw),query=url.searchParams;
  const json=data=>({ok:true,status:200,text:async()=>JSON.stringify(data)});
  if(url.pathname.endsWith('/customers')){const id=query.get('id')?.replace('eq.','');return json([A,B].includes(id)?[{id,status:'ACTIVE',public_id:id===A?'CTESTA':'CTESTB'}]:[]);}
  if(url.pathname.endsWith('/customer_web_access'))return json([{password_hash:'test-hash',credential_version:1}]);
  if(url.pathname.endsWith('/rpc/consume_api_rate_limit'))return json({allowed:true});
  if(url.pathname.endsWith('/orders')){
    reads.push(query);let rows=records.filter(row=>query.get('customer_id')==='eq.'+row.customer_id);
    if(query.has('status')){const active=query.get('status').includes('PENDING');rows=rows.filter(row=>active?row.status==='PENDING':row.status==='COMPLETED');}
    if(query.has('public_code'))rows=rows.filter(row=>query.get('public_code')==='eq.'+row.public_code);
    const start=Number(query.get('offset') || 0),limit=Number(query.get('limit') || 100);
    return json(rows.slice(start,start+limit));
  }
  throw new Error('Unexpected test request');
};
const {issueSession}=require('../api/_lib/customer-id-session');
const list=require('../api/_lib/customer_handlers/orders'),detail=require('../api/orders/[publicCode]');
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=JSON.parse(body);}};}
async function invoke(route,query={},owner=A){const res=response();await route({method:'GET',url:'/api/customer/orders',headers:owner?{authorization:'Bearer '+issueSession(owner,1)}:{},query},res);return res;}
(async()=>{
  const initial=await invoke(list);assert.equal(initial.statusCode,200);assert.equal(initial.headers['cache-control'],'no-store');
  const data=initial.body.data;assert.equal(data.activeOrders.length,50);assert.equal(data.historyOrders.length,10);assert.equal(data.hasMoreActive,true);assert.equal(data.hasMoreHistory,true);
  assert(data.activeOrders.every(row=>row.customer_id===A && row.status==='PENDING'),'old active orders cannot be buried by recent completed orders');
  assert.equal(data.activeOrders[0].updated_at,'2026-10-18T10:00:00.123456+00:00');
  const page=await invoke(list,{activeOffset:'50',historyOffset:'10'});assert.equal(page.body.data.activeOrders.length,1);assert.equal(page.body.data.historyOrders.length,2);assert.equal(page.body.data.hasMoreActive,false);
  const before=reads.length;const light=await invoke(list,{view:'active'});assert.equal(reads.length-before,1);assert.equal(light.body.data.historyIncluded,false);
  assert.equal((await invoke(list,{activeOffset:'0);drop table orders'})).statusCode,400);
  assert.equal((await invoke(list,{},null)).statusCode,401);
  assert.equal((await invoke(detail,{publicCode:'DR-BBBBBBBBBB'})).statusCode,404,'A cannot read B by guessing the public code');
  const own=await invoke(detail,{publicCode:records[0].public_code});assert.equal(own.statusCode,200);assert.equal(own.body.data.order.customer_id,undefined);
  assert(!reads.at(-1).get('select').includes('actor_type'));assert(!reads.at(-1).get('select').includes('note,'),'internal staff notes are excluded');
  const other=await invoke(list,{},B);assert.equal(other.body.data.activeOrders.length,1);assert.equal(other.body.data.activeOrders[0].public_code,'DR-BBBBBBBBBB');
  const {readResponse}=require('../api/_lib/supabase');
  for(const code of ['INVALID_PRODUCT_VARIANT','INVALID_ITEMS'])await assert.rejects(readResponse({ok:false,status:400,text:async()=>JSON.stringify({code:'22023',message:code})}),error=>error.status===400 && error.code===code);
  console.log('PASS customer tracking API: scoped active/history pagination, timestamps, lightweight reads, private detail and invalid input');
})().catch(error=>{console.error(error);process.exitCode=1;});
