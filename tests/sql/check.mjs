import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
  $$;
  create schema extensions;
  create function extensions.gen_random_bytes(integer) returns bytea language sql as $$
    select decode(substr(replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),1,$1*2),'hex')
  $$;
  create function extensions.digest(text,text) returns bytea language sql as $$ select convert_to($1,'UTF8') $$;`);
const root = process.argv[2] || join(import.meta.dirname, '..', '..');
for (const name of readdirSync(join(root, 'supabase/migrations')).filter(x => x.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(root, 'supabase/migrations', name), 'utf8')
    .replace('create extension if not exists pgcrypto with schema extensions;', '');
  try { await db.exec(sql); console.log('PASS', name); }
  catch (error) { console.error('FAIL', name, error.message); process.exitCode = 1; break; }
}
if (!process.exitCode) {
  await db.exec(readFileSync(join(root,'supabase/manual/seed_donut_flavors.sql'),'utf8'));
  const variants = (await db.query('select id,sku from public.product_variants order by sku')).rows;
  const chocolate = variants.find(x => x.sku === 'DR-CHOCOLATE').id;
  const vanilla = variants.find(x => x.sku === 'DR-VAINILLA').id;
  const customerUser = randomUUID(), adminUser = randomUUID();
  await db.query('insert into auth.users(id) values($1),($2)',[customerUser,adminUser]);
  await db.query(`insert into public.customers(public_id,auth_user_id,display_name) values('CTEST001',$1,'Cliente prueba')`,[customerUser]);
  await db.query(`insert into public.app_user_roles(auth_user_id,role) values($1,'ADMIN')`,[adminUser]);
  const count = async (variantId, qty) => (await db.query(
    'select (public.api_count_stock($1,$2,$3)).*',[variantId,qty,randomUUID()])).rows[0];
  await count(chocolate,10); await count(vanilla,5);
  await assert.rejects(db.query(`select public.api_set_sale_mode(true,'UTP',15)`),/STOCK_NOT_READY/);
  for(const variant of variants.filter(v=>v.id!==chocolate&&v.id!==vanilla)) await count(variant.id,0);
  const countKey=randomUUID();
  await db.query('select public.api_count_stock($1,$2,$3)',[chocolate,10,countKey]);
  await db.query('select public.api_count_stock($1,$2,$3)',[chocolate,10,countKey]);
  await assert.rejects(db.query('select public.api_count_stock($1,$2,$3)',[chocolate,9,countKey]),/IDEMPOTENCY_CONFLICT/);
  const create = (key,hash='a'.repeat(64),qty=2) => db.query(
    `select * from public.api_create_order($1,$2,$3,'Edificio UTP','CASH','Cliente prueba',null,null,$4::jsonb)`,
    [customerUser,key,hash,JSON.stringify([{product_variant_id:chocolate,quantity:qty}])]);
  await assert.rejects(db.query(
    `select * from public.api_create_order(null,$1,$2,'Edificio UTP','CASH','Invitado',null,null,$3::jsonb)`,
    [randomUUID(),'a'.repeat(64),JSON.stringify([{product_variant_id:chocolate,quantity:1}])]),/AUTH_REQUIRED/);
  await assert.rejects(db.query(
    `select * from public.api_create_order($1,$2,$3,'Edificio UTP','CASH','Falso',null,null,$4::jsonb)`,
    [randomUUID(),randomUUID(),'a'.repeat(64),JSON.stringify([{product_variant_id:chocolate,quantity:1}])]),/CUSTOMER_NOT_LINKED/);
  await assert.rejects(create(randomUUID()),/ORDERS_CLOSED/);
  await db.query(`select public.api_set_sale_mode(true,'UTP',15)`);
  const key = randomUUID();
  const order = (await create(key)).rows[0];
  assert.equal(order.replayed,false);
  assert.equal((await create(key)).rows[0].replayed,true);
  const otherCustomerUser=randomUUID();
  await db.query('insert into auth.users(id) values($1)',[otherCustomerUser]);
  await db.query(`insert into public.customers(public_id,auth_user_id,display_name) values('CTEST002',$1,'Otro cliente')`,[otherCustomerUser]);
  await assert.rejects(db.query(
    `select * from public.api_create_order($1,$2,$3,'Edificio UTP','CASH','Falso',null,null,$4::jsonb)`,
    [otherCustomerUser,key,'a'.repeat(64),JSON.stringify([{product_variant_id:chocolate,quantity:2}])]),/ORDER_FORBIDDEN/);
  await assert.rejects(create(key,'b'.repeat(64)),/IDEMPOTENCY_CONFLICT/);
  assert.equal((await db.query('select reserved from public.variant_stock where variant_id=$1',[chocolate])).rows[0].reserved,2);
  await db.query(`select * from public.api_transition_order($1,'CANCELLED',$2,null)`,[order.id,adminUser]);
  await db.query(`select * from public.api_transition_order($1,'CANCELLED',$2,null)`,[order.id,adminUser]);
  assert.equal((await db.query('select reserved from public.variant_stock where variant_id=$1',[chocolate])).rows[0].reserved,0);
  await assert.rejects(create(randomUUID(),'a'.repeat(64),99),/OUT_OF_STOCK/);
  const delivered = (await create(randomUUID())).rows[0];
  await db.query(`select * from public.api_transition_order($1,'ACCEPTED',$2,null)`,[delivered.id,adminUser]);
  await db.query(`select * from public.api_transition_order($1,'OUT_FOR_DELIVERY',$2,null)`,[delivered.id,adminUser]);
  await assert.rejects(db.query(`select * from public.api_transition_order($1,'COMPLETED',$2,null)`,[delivered.id,adminUser]),/USE_SETTLEMENT/);
  await assert.rejects(db.query('select public.api_complete_order($1,$2,$3)',[delivered.id,randomUUID(),adminUser]),/PAYMENT_REQUIRED/);
  const paid=(await db.query(`select * from public.api_record_order_payment($1,$2,'CONFIRMED',$3,null)`,[delivered.id,randomUUID(),adminUser])).rows[0];
  assert.equal((await db.query('select count(*)::integer as n from public.loyalty_transactions')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::integer as n from public.central_sales')).rows[0].n,0);
  const paidAgain=(await db.query(`select * from public.api_record_order_payment($1,$2,'CONFIRMED',$3,null)`,[delivered.id,randomUUID(),adminUser])).rows[0];
  assert.equal(paidAgain.id,paid.id);assert.equal(paidAgain.replayed,true);
  await assert.rejects(db.query(`select * from public.api_record_order_payment($1,$2,'FAILED',$3,null)`,
    [delivered.id,randomUUID(),adminUser]),/PAYMENT_ALREADY_CONFIRMED/);
  await assert.rejects(db.query(`select * from public.api_transition_order($1,'CANCELLED',$2,null)`,[delivered.id,adminUser]),/PAYMENT_REFUND_REQUIRED/);
  const completionKey = randomUUID();
  const settled = (await db.query('select public.api_complete_order($1,$2,$3) as result',[delivered.id,completionKey,adminUser])).rows[0].result;
  assert.equal(settled.replayed,false);
  assert.equal((await db.query('select public.api_complete_order($1,$2,$3) as result',[delivered.id,completionKey,adminUser])).rows[0].result.replayed,true);
  assert.equal((await db.query('select on_hand,reserved from public.variant_stock where variant_id=$1',[chocolate])).rows[0].on_hand,8);
  assert.equal((await db.query('select purchase_count from public.loyalty_accounts where customer_id=(select id from public.customers where auth_user_id=$1)',[customerUser])).rows[0].purchase_count,1);
  const competing=await Promise.allSettled([create(randomUUID(),'a'.repeat(64),8),create(randomUUID(),'a'.repeat(64),8)]);
  assert.equal(competing.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(competing.filter(x=>x.status==='rejected').length,1);
  const reservedOrder=competing.find(x=>x.status==='fulfilled').value.rows[0];
  await db.query(`select * from public.api_transition_order($1,'CANCELLED',$2,null)`,[reservedOrder.id,adminUser]);
  const deviceId = randomUUID(), operationId = randomUUID(), payload = {
    localEventId:1, requestKey:randomUUID(), amountCents:100, accountCode:'YAPPY',
    details:{quantity:1,unitPriceCents:100,items:[{sku:'DR-VAINILLA',quantity:1}]}
  };
  const operations = [{clientOperationId:operationId,type:'SALE',requestHash:'c'.repeat(64),
    occurredAt:new Date().toISOString(),payload}];
  const push = async () => (await db.query(
    'select public.api_push_sync_operations($1,$2,$3,$4,$5::jsonb) as result',
    [adminUser,deviceId,'Test device','1.2.0',JSON.stringify(operations)])).rows[0].result;
  const pushRows=ops=>db.query('select public.api_push_sync_operations($1,$2,$3,$4,$5::jsonb) as result',
    [adminUser,deviceId,'Test device','1.2.0',JSON.stringify(ops)]);
  for(const [index,type] of ['SESSION_START','SESSION_CLOSE','TRANSFER'].entries()){
    const row={clientOperationId:randomUUID(),type,requestHash:'6'.repeat(64),
      occurredAt:new Date().toISOString(),payload:{localEventId:100+index}};
    assert.equal((await pushRows([row])).rows[0].result.acknowledgements[0].status,'RECEIVED');
  }
  const first = await push();
  assert.equal(first.acknowledgements[0].status,'APPLIED');
  const afterFirst = (await db.query('select on_hand from public.variant_stock where variant_id=$1',[vanilla])).rows[0].on_hand;
  assert.equal(afterFirst,4);
  assert.equal((await push()).acknowledgements[0].status,'APPLIED');
  assert.equal((await db.query('select on_hand from public.variant_stock where variant_id=$1',[vanilla])).rows[0].on_hand,4);
  const reverse=[{clientOperationId:randomUUID(),type:'REVERSAL',requestHash:'9'.repeat(64),
    occurredAt:new Date().toISOString(),payload:{localEventId:3,reversedEventId:1,
      requestKey:randomUUID(),amountCents:-100,accountCode:'YAPPY'}}];
  assert.equal((await pushRows(reverse)).rows[0].result.acknowledgements[0].status,'APPLIED');
  assert.equal((await db.query('select on_hand from public.variant_stock where variant_id=$1',[vanilla])).rows[0].on_hand,5);
  assert.equal((await pushRows(reverse)).rows[0].result.acknowledgements[0].status,'APPLIED');
  assert.equal((await db.query('select on_hand from public.variant_stock where variant_id=$1',[vanilla])).rows[0].on_hand,5);
  const secondReverse=[{...reverse[0],clientOperationId:randomUUID(),requestHash:'8'.repeat(64)}];
  assert.equal((await pushRows(secondReverse)).rows[0].result.acknowledgements[0].status,'REJECTED');
  assert.equal((await db.query('select on_hand from public.variant_stock where variant_id=$1',[vanilla])).rows[0].on_hand,5);
  const badQuantity=[{...operations[0],clientOperationId:randomUUID(),requestHash:'7'.repeat(64),
    payload:{...payload,localEventId:4,details:{...payload.details,quantity:2}}}];
  assert.equal((await pushRows(badQuantity)).rows[0].result.acknowledgements[0].errorCode,'SALE_QUANTITY_MISMATCH');
  const malformed=[{...operations[0],clientOperationId:randomUUID(),requestHash:'5'.repeat(64),
    payload:{...payload,localEventId:5,amountCents:'bad'}}];
  assert.equal((await pushRows(malformed)).rows[0].result.acknowledgements[0].errorCode,'INVALID_SALE_PAYLOAD');
  await db.exec(`create function public.test_transient_stock() returns trigger language plpgsql as $$
    begin if new.on_hand<old.on_hand then raise exception 'TEST_SERIALIZATION_FAILURE' using errcode='40001'; end if; return new; end $$;
    create trigger test_transient_stock before update on public.variant_stock
    for each row execute function public.test_transient_stock();`);
  const transient=[{...operations[0],clientOperationId:randomUUID(),requestHash:'4'.repeat(64),
    payload:{...payload,localEventId:6}}];
  await assert.rejects(pushRows(transient),/TEST_SERIALIZATION_FAILURE/);
  assert.equal((await db.query('select count(*)::integer as n from public.sync_operations where client_operation_id=$1',
    [transient[0].clientOperationId])).rows[0].n,0);
  await db.exec('drop trigger test_transient_stock on public.variant_stock; drop function public.test_transient_stock();');
  await assert.rejects(pushRows([{...operations[0],requestHash:'f'.repeat(64)}]),/SYNC_IDEMPOTENCY_CONFLICT/);
  const rejected=[{clientOperationId:randomUUID(),type:'SALE',requestHash:'d'.repeat(64),
    occurredAt:new Date().toISOString(),payload:{...payload,amountCents:9900,
      details:{items:[{sku:'DR-VAINILLA',quantity:99}]}}}];
  const rejectedAck=(await pushRows(rejected)).rows[0].result.acknowledgements[0];
  assert.equal(rejectedAck.status,'REJECTED');assert.equal(rejectedAck.errorCode,'OUT_OF_STOCK');
  assert.equal((await db.query('select orders_enabled from public.sale_mode')).rows[0].orders_enabled,false);
  assert.equal((await db.query('select on_hand from public.variant_stock where variant_id=$1',[vanilla])).rows[0].on_hand,5);
  await db.query(`select public.api_set_sale_mode(false,'UTP',15)`);
  await assert.rejects(db.query(`select public.api_set_sale_mode(true,'UTP',15)`),/SALES_RECONCILIATION_REQUIRED/);
  const rejectedSaleIds=(await db.query(`select id from public.sync_operations where operation_type='SALE' and status='REJECTED'`)).rows.map(x=>x.id);
  assert.equal((await db.query('select * from public.api_unreconciled_device_sales()')).rows.length,3);
  await assert.rejects(db.query('select public.api_reconcile_device_sale($1,$2,$3)',
    [rejectedSaleIds[0],adminUser,'Conteo físico completo']),/STOCK_RECOUNT_REQUIRED/);
  for(const variant of variants){
    const current=(await db.query('select on_hand from public.variant_stock where variant_id=$1',[variant.id])).rows[0].on_hand;
    await count(variant.id,current);
  }
  for(const id of rejectedSaleIds){
    const result=(await db.query('select public.api_reconcile_device_sale($1,$2,$3) as value',
      [id,adminUser,'Venta offline revisada contra conteo físico completo'])).rows[0].value;
    assert.equal(result.replayed,false);
  }
  assert.equal((await db.query('select * from public.api_unreconciled_device_sales()')).rows.length,0);
  await db.query(`select public.api_set_sale_mode(true,'UTP',15)`);
  assert.equal((await db.query('select orders_enabled from public.sale_mode')).rows[0].orders_enabled,true);
  const receipt=[{clientOperationId:randomUUID(),type:'SALE',requestHash:'e'.repeat(64),
    occurredAt:new Date().toISOString(),payload:{localEventId:2,requestKey:randomUUID(),
      amountCents:200,accountCode:'CASH',details:{remoteOrderId:delivered.id}}}];
  assert.equal((await pushRows(receipt)).rows[0].result.acknowledgements[0].status,'APPLIED');
  assert.equal((await db.query('select on_hand from public.variant_stock where variant_id=$1',[chocolate])).rows[0].on_hand,8);
  const customerId=(await db.query('select id from public.customers where auth_user_id=$1',[customerUser])).rows[0].id;
  const settleAnother = async () => {
    const next=(await create(randomUUID(),'a'.repeat(64),1)).rows[0];
    await db.query(`select * from public.api_transition_order($1,'ACCEPTED',$2,null)`,[next.id,adminUser]);
    await db.query(`select * from public.api_transition_order($1,'OUT_FOR_DELIVERY',$2,null)`,[next.id,adminUser]);
    await db.query(`select * from public.api_record_order_payment($1,$2,'CONFIRMED',$3,null)`,[next.id,randomUUID(),adminUser]);
    return (await db.query('select public.api_complete_order($1,$2,$3) as result',
      [next.id,randomUUID(),adminUser])).rows[0].result;
  };
  assert.equal((await settleAnother()).pointsEarned,0);
  assert.equal((await db.query('select purchase_count from public.loyalty_accounts where customer_id=$1',[customerId])).rows[0].purchase_count,1);
  assert.equal((await db.query('select count(*)::integer as n from public.loyalty_transactions where customer_id=$1',[customerId])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::integer as n from public.customer_badges where customer_id=$1',[customerId])).rows[0].n,1);
  await db.query(`update public.customer_streaks set current_count=2,best_count=2,last_qualified_at=now()-interval '2 days' where customer_id=$1`,[customerId]);
  assert.equal((await settleAnother()).pointsEarned,12);
  assert.equal((await db.query('select current_count from public.customer_streaks where customer_id=$1',[customerId])).rows[0].current_count,3);
  await db.query(`update public.customer_streaks set current_count=3,last_qualified_at=now()-interval '5 days' where customer_id=$1`,[customerId]);
  assert.equal((await settleAnother()).pointsEarned,10);
  assert.equal((await db.query('select current_count from public.customer_streaks where customer_id=$1',[customerId])).rows[0].current_count,1);
  await db.query(`update public.customer_streaks set current_count=29,best_count=29,last_qualified_at=now()-interval '2 days' where customer_id=$1`,[customerId]);
  assert.equal((await settleAnother()).pointsEarned,17);
  const season=(await db.query('select status,completed_streak,milestones from public.streak_seasons where customer_id=$1 and season_number=1',[customerId])).rows[0];
  assert.equal(season.status,'COMPLETED');
  assert.equal(season.completed_streak,30);
  assert.deepEqual(season.milestones,[3,7,14,21,30]);
  assert.equal((await db.query('select current_count,current_season_number from public.customer_streaks where customer_id=$1',[customerId])).rows[0].current_season_number,2);
  assert.equal((await db.query('select count(*)::integer as n from public.customer_badges where customer_id=$1',[customerId])).rows[0].n,2);
  const otherAdmin=randomUUID();
  await db.query('insert into auth.users(id) values($1)',[otherAdmin]);
  await db.query(`insert into public.app_user_roles(auth_user_id,role) values($1,'ADMIN')`,[otherAdmin]);
  await assert.rejects(db.query('select public.api_push_sync_operations($1,$2,$3,$4,$5::jsonb)',
    [otherAdmin,deviceId,'Other','1.2.0',JSON.stringify(operations)]),/DEVICE_OWNERSHIP/);
  const qr1=(await db.query('select * from public.api_issue_customer_qr($1)',[customerUser])).rows[0];
  assert.equal((await db.query('select * from public.api_validate_customer_qr($1)',[qr1.token])).rows.length,1);
  const qr2=(await db.query('select * from public.api_issue_customer_qr($1)',[customerUser])).rows[0];
  assert.equal((await db.query('select * from public.api_validate_customer_qr($1)',[qr1.token])).rows.length,0);
  assert.equal((await db.query('select * from public.api_validate_customer_qr($1)',[qr2.token])).rows.length,1);
  const health=(await db.query('select public.api_operational_health() as value')).rows[0].value;
  assert.equal(health.rejectedDeviceOperations,0);
  assert.equal(health.rejectedOtherOperations,1);
  const claimUser=randomUUID();
  await db.query('insert into auth.users(id) values($1)',[claimUser]);
  const unlinked=(await db.query(`insert into public.customers(public_id,display_name) values('CTEST003','Cliente antiguo') returning id`)).rows[0];
  await db.exec('set role authenticated');
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[adminUser]);
  const claimToken=(await db.query(`select public.issue_customer_claim_token($1,interval '30 minutes') as token`,[unlinked.id])).rows[0].token;
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[claimUser]);
  assert.equal((await db.query('select * from public.claim_customer_account($1)',[claimToken])).rows[0].customer_id,unlinked.id);
  await assert.rejects(db.query('select * from public.claim_customer_account($1)',[claimToken]),/already linked/i);
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub','',false)`);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.variant_stock'),/permission denied/);
  await assert.rejects(db.query('select * from public.api_unreconciled_device_sales()'),/permission denied/);
  await db.exec('reset role');
  await db.exec('set role service_role');
  await assert.rejects(db.query(`select * from public.api_create_order_with_guest_support(
    null,$1,$2,'Edificio UTP','CASH','Invitado',null,null,$3::jsonb)`,
    [randomUUID(),'a'.repeat(64),JSON.stringify([{product_variant_id:chocolate,quantity:1}])]),/permission denied/);
  await db.exec('reset role');
  console.log('PASS transactions: reservations, settlement, daily loyalty, device retry/rejection/reversal, ownership, QR and health');
}
await db.close();
