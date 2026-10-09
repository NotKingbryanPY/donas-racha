import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
const sql=name=>readFileSync(join(root,'supabase/sql-editor/phase18',name),'utf8');
const diagnose=async()=> (await db.exec(sql('02_check_after_error.sql'))).at(-1).rows[0];
const apply=async file=>db.exec(readFileSync(join(root,'supabase/migrations',file),'utf8')
  .replace('create extension if not exists pgcrypto with schema extensions;',''));
try {
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create schema extensions;
    create function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select decode(substr(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),1,$1*2),'hex') $$;
    create function extensions.digest(text,text) returns bytea language sql as $$ select convert_to($1,'UTF8') $$;
    create publication supabase_realtime;`);
  const migrations=readdirSync(join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')).sort();
  const cutover=migrations.findIndex(x=>x.startsWith('202610030001'));
  assert(cutover>0);
  for(const file of migrations.slice(0,cutover)) await apply(file);
  await db.exec(readFileSync(join(root,'supabase/manual/seed_donut_flavors.sql'),'utf8'));
  const admin=randomUUID();
  await db.query('insert into auth.users(id) values($1)',[admin]);
  await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'ADMIN')",[admin]);
  const customer=(await db.query("select * from public.api_register_customer('CPREFLIGHT','Prueba aislada','+50760009999',$1)",[randomUUID()])).rows[0];
  const counts={'DR-CHOCOLATE':20,'DR-VAINILLA':20,'DR-CHOCOLATE-CHISPAS':2,'DR-VAINILLA-CHISPAS':0};
  await db.query('select public.api_set_manual_inventory($1,$2)',[admin,JSON.stringify(counts)]);
  const create=async sku=>{
    const variant=(await db.query('select id from public.product_variants where sku=$1',[sku])).rows[0].id;
    return (await db.query("select * from public.api_create_order_by_customer_id($1,$2,$3,'Prueba aislada','CASH',null,$4)",
      [customer.id,randomUUID(),'a'.repeat(64),JSON.stringify([{product_variant_id:variant,quantity:2}])])).rows[0];
  };
  // A legacy count can be lowered below existing reservations. Preserve the orders
  // and flag reconciliation; never fill the shortage with invented units.
  await create('DR-CHOCOLATE-CHISPAS');
  await db.query('select public.api_set_manual_inventory($1,$2)',[admin,JSON.stringify({...counts,'DR-CHOCOLATE-CHISPAS':0})]);
  const delivered=await create('DR-VAINILLA');
  await db.query("select * from public.api_transition_order($1,'ACCEPTED',$2,null)",[delivered.id,admin]);
  await db.query("select * from public.api_transition_order($1,'OUT_FOR_DELIVERY',$2,null)",[delivered.id,admin]);
  await db.query("select public.api_complete_paid_order($1,$2,'CASH')",[delivered.id,admin]);
  await create('DR-CHOCOLATE');
  const snapshotBefore=(await db.query(sql('00_preflight_export.sql'))).rows;
  const tableExists=(rows,name)=>rows.find(row=>row.section==='01_expected_table' && row.object_name===name).details.exists;
  for(const name of ['inventory_movements','inventory_revision','push_devices','order_push_jobs']) {
    assert.equal(tableExists(snapshotBefore,name),false);
  }
  const projection=(await db.query(sql('01_inventory_cutover_preview.sql'))).rows;
  assert.equal(projection.length,4);
  for(const row of projection) assert.equal(Number(row.availability_delta),0);
  assert.equal(Number(projection.find(x=>x.sku==='DR-VAINILLA').deliveries_after_count),2);
  const shortage=projection.find(x=>x.sku==='DR-CHOCOLATE-CHISPAS');
  assert.equal(shortage.counted_before,true);
  assert.equal(shortage.counted_after,false);
  assert.equal(Number(shortage.units_to_reconcile),2);
  const ledger=async()=>({
    orders:(await db.query('select id,status,payment_status from public.orders order by id')).rows,
    points:(await db.query('select available_points,lifetime_points from public.loyalty_accounts order by customer_id')).rows,
    payments:(await db.query('select id,status,amount_cents from public.payments order by id')).rows
  });
  const immutableBefore=await ledger();
  const completeBundle=sql('02_apply_missing_20261008.sql');
  assert(completeBundle.trimEnd().endsWith('-- END DONAS_APPLY_02_COMPLETE'));
  assert.doesNotMatch(completeBundle,/create\s+temporary\s+table/i,'Studio must not append RLS for a temporary snapshot');
  // Reproduce the exact truncation reported by Studio: the unregister RPC body
  // stops after its WHERE clause, followed by Studio's auto-RLS appendix.
  const cutPoint=completeBundle.indexOf("  return jsonb_build_object('unregistered',true);");
  assert(cutPoint>0);
  const truncated=completeBundle.slice(0,cutPoint)+
    '-- Added by Supabase: enable Row Level Security on newly created tables\nALTER TABLE donas_cutover_before ENABLE ROW LEVEL SECURITY;';
  await assert.rejects(db.exec(truncated),error=>error.code==='42601' && /unterminated dollar-quoted string/.test(error.message));
  await db.exec('rollback');
  assert.equal((await diagnose()).status,'READY_TO_RETRY_FULL_02');
  assert.deepEqual(await ledger(),immutableBefore,'a truncated query does not commit business changes');
  // Also verify rollback after statements actually run but a late guard aborts.
  const runtimeFailure=completeBundle.replace("commit;\nselect 'APPLIED'",
    "do $runtime_test$ begin raise exception 'TEST_LATE_FAILURE'; end; $runtime_test$;\ncommit;\nselect 'APPLIED'");
  await assert.rejects(db.exec(runtimeFailure),/TEST_LATE_FAILURE/);
  await db.exec('rollback');
  assert.equal((await diagnose()).status,'READY_TO_RETRY_FULL_02');
  assert.deepEqual(await ledger(),immutableBefore,'a late failure rolls back the whole activation');
  // Reproduce Studio's missing legacy catalog timestamp trigger.
  await db.exec('drop trigger product_variants_set_updated_at on public.product_variants');
  await db.exec(sql('02_apply_missing_20261008.sql'));
  assert.equal((await diagnose()).status,'OBJECTS_PRESENT_DO_NOT_REPEAT_02_RUN_05');
  const stock=(await db.query('select * from public.inventory_by_flavor order by sku')).rows;
  for(const row of projection) {
    const actual=stock.find(x=>x.sku===row.sku);
    assert.equal(Number(actual.opening_quantity),Number(row.projected_physical));
    assert.equal(Number(actual.available_quantity),Number(row.available_after));
    assert.equal(actual.counted,row.counted_after);
  }
  assert.deepEqual(await ledger(),immutableBefore,'cutover preserves orders, payments and points');
  const versionBefore=(await db.query("select updated_at::text version from public.product_variants where sku='DR-CHOCOLATE'")).rows[0].version;
  await db.query("update public.product_variants set name='Chocolate actualizado' where sku='DR-CHOCOLATE'");
  const versionAfter=(await db.query("select updated_at::text version from public.product_variants where sku='DR-CHOCOLATE'")).rows[0].version;
  assert.notEqual(versionAfter,versionBefore,'a catalog edit advances its version even without the original trigger');
  assert.equal((await db.query(sql('01_inventory_cutover_preview.sql'))).rows.length,0,'never project the legacy conversion twice');
  const snapshotAfter=(await db.query(sql('00_preflight_export.sql'))).rows;
  assert(snapshotAfter.filter(x=>x.section==='01_expected_table').every(x=>x.details.exists));
  assert(snapshotAfter.filter(x=>x.section==='05_expected_function').every(x=>x.details.exists));
  for(const name of ['push_devices','order_push_jobs','staff_device_credentials','staff_device_invitations']) {
    const security=snapshotAfter.find(x=>x.section==='03_table_rls' && x.object_name===name).details;
    assert.equal(security.rls,true);assert.equal(security.anonSelect,false);assert.equal(security.authenticatedSelect,false);
  }
  const verification=(await db.query(sql('05_verify_export.sql'))).rows;
  assert(verification.filter(x=>x.section==='01_integrity').every(x=>Number(x.details.anomalies)===0));
  await assert.rejects(db.exec(sql('02_apply_missing_20261008.sql')),/STOP_ALREADY_APPLIED_OR_PARTIAL/);
  await db.exec('rollback');
  console.log('PASS preflight, exact Studio truncation, rollback after late failure, recovery state, complete activation without temporary-table auto-RLS, stock/order/payment/points preservation and catalog timestamps');
} finally { await db.close(); }
