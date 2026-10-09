import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
let db;
if(process.env.POSTGRES_TEST_URL) {
  const pg=await import(process.env.POSTGRES_MODULE || 'pg');
  const pool=new (pg.Pool || pg.default.Pool)({connectionString:process.env.POSTGRES_TEST_URL,max:8,options:'-c statement_timeout=15000'});
  db={exec:sql=>pool.query(sql),query:(sql,parameters)=>pool.query(sql,parameters),close:()=>pool.end()};
} else {
  const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
  db=new PGlite();
}
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create schema extensions;create function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select decode(substr(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),1,$1*2),'hex') $$;create function extensions.digest(text,text) returns bytea language sql as $$ select convert_to($1,'UTF8') $$;create publication supabase_realtime;`);
for(const file of readdirSync(join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(root,'supabase/migrations',file),'utf8').replace('create extension if not exists pgcrypto with schema extensions;',''));
}
await db.exec(readFileSync(join(root,'supabase/manual/seed_donut_flavors.sql'),'utf8'));
const admin=randomUUID(),device=randomUUID();
await db.query('insert into auth.users(id) values($1)',[admin]);
await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'ADMIN')",[admin]);
const counts={'DR-CHOCOLATE':0,'DR-VAINILLA':0,'DR-CHOCOLATE-CHISPAS':0,'DR-VAINILLA-CHISPAS':0};
await db.query('select public.api_set_manual_inventory($1,$2)',[admin,JSON.stringify(counts)]);
const push=async operations=>(await db.query("select public.api_push_sync_operations($1,$2,'Prueba','1.3.0-official',$3) result",[admin,device,JSON.stringify(operations)])).rows[0].result;
const operation=(type,payload)=>({clientOperationId:randomUUID(),type,occurredAt:new Date().toISOString(),payload,requestHash:randomUUID().replaceAll('-','').repeat(2)});
const stock=async()=>(await db.query('select * from public.inventory_by_flavor order by sku')).rows;
const purchase=operation('PURCHASE',{localEventId:1,details:{boxes:1,donutsPerBox:12}});
await push([purchase]); await push([purchase]);
assert.deepEqual(Object.fromEntries((await stock()).map(x=>[x.sku,Number(x.available_quantity)])),
  {'DR-CHOCOLATE':4,'DR-CHOCOLATE-CHISPAS':2,'DR-VAINILLA':4,'DR-VAINILLA-CHISPAS':2});
const sale=operation('SALE',{localEventId:2,details:{quantity:2,items:[{sku:'DR-CHOCOLATE',quantity:2}]}});
await push([sale]);await push([sale]);
assert.equal(Number((await stock())[0].available_quantity),2);
const reversal=operation('REVERSAL',{localEventId:3,reversedEventId:2});
await push([reversal]);await push([reversal]);
assert.equal(Number((await stock())[0].available_quantity),4);
const snapshot=async()=>(await db.query('select public.api_inventory_snapshot() result')).rows[0].result;
const before=await snapshot();
await push([operation('PURCHASE',{localEventId:4,details:{boxes:2,donutsPerBox:12}})]);
await assert.rejects(db.query('select public.api_set_shared_inventory($1,$2,$3)',[admin,JSON.stringify(counts),before.revision]),/INVENTORY_CONFLICT/);
const customer=(await db.query("select * from public.api_register_customer('CSHAREDTEST','Prueba','+50760001234',$1)",[randomUUID()])).rows[0];
const variant=(await stock())[0].variant_id;
await db.query("select public.api_register_push_device($1,$2,'ANDROID',$3,'production','1.3.0')",[admin,device,'test-push-token-'.repeat(4)]);
const order=(await db.query("select * from public.api_create_order_by_customer_id($1,$2,$3,'Edificio 4','CASH',null,$4)",[customer.id,randomUUID(),'a'.repeat(64),JSON.stringify([{product_variant_id:variant,quantity:2}])])).rows[0];
assert.equal(Number((await stock())[0].available_quantity),10);
const jobs=(await db.query("select public.api_claim_order_push(array['ANDROID']) jobs")).rows[0].jobs;
assert.equal(jobs.length,1);assert.equal(jobs[0].orderId,order.id);
assert.equal((await db.query("select public.api_claim_order_push(array['ANDROID']) jobs")).rows[0].jobs.length,0,'lease prevents simultaneous dispatch');
await db.query('select public.api_finish_order_push($1,$2,true,false,null)',[jobs[0].id,jobs[0].leaseId]);
await db.query("select * from public.api_transition_order($1,'ACCEPTED',$2,null)",[order.id,admin]);
await db.query("select * from public.api_transition_order($1,'OUT_FOR_DELIVERY',$2,null)",[order.id,admin]);
await db.query("select public.api_complete_paid_order($1,$2,'CASH')",[order.id,admin]);
await db.query("select public.api_complete_paid_order($1,$2,'CASH')",[order.id,admin]);
assert.equal(Number((await stock())[0].available_quantity),10,'delivery converts reservation without double subtraction');
await push([operation('SALE',{localEventId:5,details:{remoteOrderId:order.id,quantity:2}})]);
assert.equal(Number((await stock())[0].available_quantity),10,'Android receipt never deducts again');
const next=(await snapshot()).revision;
await db.query('select public.api_set_shared_inventory($1,$2,$3)',[admin,JSON.stringify({...counts,'DR-CHOCOLATE':7}),next]);
assert.equal(Number((await stock())[0].available_quantity),7);
await push([sale,purchase,reversal]);assert.equal(Number((await stock())[0].available_quantity),7,'old retries after count do not change stock');
await push([operation('SALE',{localEventId:6,details:{quantity:1,items:[{sku:'DR-CHOCOLATE',quantity:1}]}})]);
assert.equal(Number((await stock())[0].available_quantity),6,'offline operations received later still apply');
assert.equal((await db.query("select has_table_privilege('anon','public.push_devices','SELECT') ok")).rows[0].ok,false);
// Different devices may reuse local event IDs, but each operation is applied once.
const secondDevice=randomUUID();
const proofSequence=(await db.query('select server_sequence from public.sync_operations where client_operation_id=$1',[purchase.clientOperationId])).rows[0].server_sequence;
const recovered=(await db.query('select public.api_restore_device_identity($1,$2,$3) result',[admin,purchase.clientOperationId,proofSequence])).rows[0].result;
assert.equal(recovered.deviceId,device,'restore must reuse the original sync identity, not replay into a new device');
await assert.rejects(db.query("select public.api_push_sync_operations($1,$2,'Piloto anterior','1.3.0-piloto',$3)",[admin,device,JSON.stringify([purchase])]),/DEVICE_MOVED_TO_OFFICIAL/);
await assert.rejects(db.query('select public.api_restore_device_identity($1,$2,$3)',[admin,purchase.clientOperationId,Number(proofSequence)+999999]),/RESTORE_PROOF_NOT_FOUND/);
const foreignAdmin=randomUUID();
await db.query('insert into auth.users(id) values($1)',[foreignAdmin]);
await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'ADMIN')",[foreignAdmin]);
await assert.rejects(db.query('select public.api_restore_device_identity($1,$2,$3)',[foreignAdmin,purchase.clientOperationId,proofSequence]),/DEVICE_OWNER_CONFLICT/);
await assert.rejects(db.query("select public.api_push_sync_operations($1,$2,'Otro administrador','1.3.0',$3)",[foreignAdmin,device,JSON.stringify([purchase])]),/DEVICE_OWNER_CONFLICT/);
const pushSecond=async operations=>(await db.query("select public.api_push_sync_operations($1,$2,'Segundo equipo','1.3.0',$3) result",[admin,secondDevice,JSON.stringify(operations)])).rows[0].result;
const otherSale=operation('SALE',{localEventId:6,details:{quantity:1,items:[{sku:'DR-CHOCOLATE',quantity:1}]}});
await pushSecond([otherSale]);await pushSecond([otherSale]);
assert.equal(Number((await stock())[0].available_quantity),5,'device-local event IDs must not collide');
const review=await snapshot();
await db.query('select public.api_set_shared_inventory($1,$2,$3)',[admin,JSON.stringify({...counts,'DR-CHOCOLATE':1}),review.revision]);
await assert.rejects(db.query('select public.api_set_shared_inventory($1,$2,$3)',[admin,JSON.stringify({...counts,'DR-CHOCOLATE':99}),review.revision]),/INVENTORY_CONFLICT/);
const reserve=async()=>db.query("select * from public.api_create_order_by_customer_id($1,$2,$3,'Última unidad','CASH',null,$4)",[customer.id,randomUUID(),randomUUID().replaceAll('-','').repeat(2),JSON.stringify([{product_variant_id:variant,quantity:1}])]);
const lastOrder=(await reserve()).rows[0];
await assert.rejects(reserve(),/OUT_OF_STOCK/,'a second device cannot reserve the last unit again');
assert.equal(Number((await stock())[0].available_quantity),0);
await pushSecond([operation('SALE',{localEventId:7,details:{quantity:1,items:[{sku:'DR-CHOCOLATE',quantity:1}]}})]);
assert.equal((await stock())[0].counted,false,'an offline sale of reserved stock must require reconciliation');
await assert.rejects(reserve(),/OUT_OF_STOCK/);
await db.query("select * from public.api_transition_order($1,'CANCELLED',$2,null)",[lastOrder.id,admin]);
assert.equal(Number((await stock())[0].available_quantity),0,'cancellation must not create stock already sold offline');
// Inspect the actual PostgreSQL definitions after all migrations, including seller overrides.
for(const signature of ['api_transition_order(uuid,public.order_status,uuid,text)','api_record_order_payment(uuid,uuid,public.payment_status,uuid,text)']) {
  const definition=(await db.query('select pg_get_functiondef($1::regprocedure) definition',[`public.${signature}`])).rows[0].definition;
  assert(definition.indexOf('pg_advisory_xact_lock(26092601)')<definition.indexOf('return query'),'inventory must lock before the original writer');
}
if(process.env.POSTGRES_TEST_URL) {
  const revision=(await snapshot()).revision;
  const competingCounts=await Promise.allSettled([1,2].map(quantity=>db.query(
    'select public.api_set_shared_inventory($1,$2,$3)',[admin,JSON.stringify({...counts,'DR-CHOCOLATE':quantity}),revision])));
  assert.equal(competingCounts.filter(result=>result.status==='fulfilled').length,1);
  assert.match(competingCounts.find(result=>result.status==='rejected').reason.message,/INVENTORY_CONFLICT/);
  await db.query('select public.api_set_shared_inventory($1,$2,$3)',[admin,JSON.stringify({...counts,'DR-CHOCOLATE':1}),(await snapshot()).revision]);
  const competingOrders=await Promise.allSettled([reserve(),reserve()]);
  assert.equal(competingOrders.filter(result=>result.status==='fulfilled').length,1);
  assert.match(competingOrders.find(result=>result.status==='rejected').reason.message,/OUT_OF_STOCK/);
  const winner=competingOrders.find(result=>result.status==='fulfilled').value.rows[0];
  await db.query("select * from public.api_transition_order($1,'ACCEPTED',$2,null)",[winner.id,admin]);
  await db.query("select * from public.api_transition_order($1,'OUT_FOR_DELIVERY',$2,null)",[winner.id,admin]);
  const concurrentWriters=await Promise.all([
    db.query("select public.api_complete_paid_order($1,$2,'CASH') result",[winner.id,admin]),
    db.query("select public.api_complete_paid_order($1,$2,'CASH') result",[winner.id,admin]),
    db.query("select * from public.api_record_order_payment($1,$1,'CONFIRMED',$2,null)",[winner.id,admin])]);
  assert.equal(concurrentWriters.slice(0,2).filter(result=>result.rows[0].result.replayed===false).length,1);
  assert.equal(Number((await db.query('select count(*) quantity from public.flavor_sales where order_id=$1',[winner.id])).rows[0].quantity),1);
  assert.equal(Number((await stock())[0].available_quantity),0);
  console.log('PASS concurrent PostgreSQL connections: one count wins, one last-unit reservation wins, concurrent payment/delivery applies once without deadlock');
}
await db.close();console.log('PASS shared inventory: boxes, retry/reversal, delivery, two-device IDs/count conflicts, last-unit reservations, offline oversale reconciliation and lock order');
