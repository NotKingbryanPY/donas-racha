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
for (const script of ['00_preflight.sql','04_optional_realtime.sql','05_verify.sql']) await db.exec(readFileSync(join(root,'supabase/sql-editor/phase18',script),'utf8'));


const admin=randomUUID(),device=randomUUID();
await db.query('insert into auth.users(id) values($1)',[admin]);
await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'ADMIN')",[admin]);
const variant=(await db.query("select * from public.product_variants where sku='DR-CHOCOLATE'")).rows[0];
const op=randomUUID();
const update=async(name='Chocolate piloto',available=false,hash='a'.repeat(64))=>(await db.query(
  'select public.api_update_flavor($1,$2,$3,$4,$5,$6,$7) result',
  [admin,op,hash,variant.id,variant.updated_at,name,available])).rows[0].result;
assert.equal((await update()).available,false);
assert.equal((await update()).replayed,true,'retry returns committed result despite stale expected version');
await assert.rejects(update('Otro',true,'b'.repeat(64)),/IDEMPOTENCY_CONFLICT/);
await assert.rejects(db.query('select public.api_update_flavor($1,$2,$3,$4,$5,$6,$7)',
  [admin,randomUUID(),'c'.repeat(64),variant.id,variant.updated_at,'Antiguo',true]),/CATALOG_CONFLICT/);
const customer=(await db.query("select * from public.api_register_customer('CPILOTTEST','Prueba','+50760009876',$1)",[randomUUID()])).rows[0];
await assert.rejects(db.query("select * from public.api_create_order_by_customer_id($1,$2,$3,'Edificio 4','CASH',null,$4)",
  [customer.id,randomUUID(),'d'.repeat(64),JSON.stringify([{product_variant_id:variant.id,quantity:1}])]),/OUT_OF_STOCK/);
const invite='e'.repeat(64),credential='f'.repeat(64);
await db.query("select public.api_issue_staff_invitation($1,$2,'SELLER')",[admin,invite]);
assert.equal((await db.query('select public.api_claim_staff_invitation($1,$2,$3) result',[invite,device,credential])).rows[0].result.role,'SELLER');
await assert.rejects(db.query('select public.api_claim_staff_invitation($1,$2,$3)',[invite,randomUUID(),'a'.repeat(64)]),/INVALID_INVITATION/);
await db.query("insert into public.push_devices(device_public_id,auth_user_id,platform,token,app_version) values($1,$2,'ANDROID',$3,'test')",[device,admin,'token-'.repeat(12)]);
await db.query('select public.api_revoke_staff_device($1,$2)',[admin,device]);
assert.equal((await db.query('select revoked from public.staff_device_credentials where device_public_id=$1',[device])).rows[0].revoked,true);
assert.equal((await db.query('select active from public.push_devices where device_public_id=$1',[device])).rows[0].active,false);
const expired=randomUUID();
await db.query("insert into public.staff_device_credentials(device_public_id,auth_user_id,role,token_hash,expires_at) values($1,$2,'ADMIN',$3,clock_timestamp()-interval '1 hour')",[expired,admin,'1'.repeat(64)]);
await db.query("insert into public.push_devices(device_public_id,auth_user_id,platform,token,app_version) values($1,$2,'ANDROID',$3,'test')",[expired,admin,'expired-token-'.repeat(5)]);
await db.query("select public.api_claim_order_push(array['ANDROID'])");
assert.equal((await db.query('select active from public.push_devices where device_public_id=$1',[expired])).rows[0].active,false);
const firebaseDevice=randomUUID(), firebaseCredential='2'.repeat(64);
await db.query("select public.api_issue_staff_invitation($1,$2,'SELLER')",[admin,'3'.repeat(64)]);
await db.query('select public.api_claim_staff_invitation($1,$2,$3)', ['3'.repeat(64),firebaseDevice,firebaseCredential]);
const bind=(uid='firebase-test-user',role='SELLER',hash=firebaseCredential,owner=admin)=>db.query(
  'select public.api_bind_firebase_device($1,$2,$3,$4,$5) result',[owner,firebaseDevice,uid,role,hash]);
assert.equal((await bind()).rows[0].result.linked,true);
assert.equal((await bind()).rows[0].result.deviceId,firebaseDevice,'same verified identity replay is safe');
const resolveFirebase=async(uid='firebase-test-user',selectedDevice=firebaseDevice)=>(await db.query(
  'select public.api_resolve_firebase_device($1,$2) result',[uid,selectedDevice])).rows[0].result;
assert.equal((await resolveFirebase()).role,'SELLER','invitation cap survives ADMIN owner');
assert.equal(await resolveFirebase('unknown-user'),null);
assert.equal(await resolveFirebase('firebase-test-user',randomUUID()),null);
await assert.rejects(bind('firebase-test-user','ADMIN'),/DEVICE_REVOKED/,'SELLER credential cannot elevate');
await assert.rejects(bind('firebase-test-user','SELLER',null),/IDENTITY_BINDING_CONFLICT/,'cannot drop original revocable proof');
await assert.rejects(bind('firebase-test-user','SELLER',firebaseCredential,customer.id),/STAFF_REQUIRED/);
const anotherAdmin=randomUUID();
await db.query('insert into auth.users(id) values($1)',[anotherAdmin]);
await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'ADMIN')",[anotherAdmin]);
await assert.rejects(bind('firebase-test-user','SELLER',firebaseCredential,anotherAdmin),/DEVICE_OWNERSHIP_REQUIRED/);
await bind('firebase-second-user');
assert.equal((await db.query("select revoked from public.staff_firebase_bindings where firebase_uid='firebase-test-user'")).rows[0].revoked,true);
assert.equal(await resolveFirebase(),null,'old account cannot access a switched device');
await db.query('select public.api_revoke_staff_device($1,$2)',[admin,firebaseDevice]);
await assert.rejects(bind('firebase-second-user'),/DEVICE_REVOKED/);
await db.query("select public.api_issue_staff_invitation($1,$2,'SELLER')",[admin,'4'.repeat(64)]);
await db.query('select public.api_claim_staff_invitation($1,$2,$3)', ['4'.repeat(64),firebaseDevice,'5'.repeat(64)]);
assert.equal((await bind('firebase-second-user','SELLER','5'.repeat(64))).rows[0].result.linked,true,'fresh invitation safely renews the same Firebase account');
assert.equal((await resolveFirebase('firebase-second-user')).role,'SELLER');
await db.query("update public.staff_device_credentials set expires_at=now()-interval '1 hour' where device_public_id=$1",[firebaseDevice]);
assert.equal(await resolveFirebase('firebase-second-user'),null,'expiry of original device proof denies Firebase too');
const legacyFirebaseDevice=randomUUID();
await db.query("select public.api_bind_firebase_device($1,$2,'firebase-legacy-admin','ADMIN',null)",[admin,legacyFirebaseDevice]);
assert.equal((await resolveFirebase('firebase-legacy-admin',legacyFirebaseDevice)).role,'ADMIN');
await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'SELLER')",[admin]);
await db.query("delete from public.app_user_roles where auth_user_id=$1 and role='ADMIN'",[admin]);
assert.equal((await resolveFirebase('firebase-legacy-admin',legacyFirebaseDevice)).role,'SELLER','live role downgrade applies immediately');
await db.query('delete from public.app_user_roles where auth_user_id=$1',[admin]);
assert.equal(await resolveFirebase('firebase-legacy-admin',legacyFirebaseDevice),null,'role removal denies all staff access');
assert.equal((await db.query("select has_function_privilege('authenticated','public.api_resolve_firebase_device(text,uuid)','EXECUTE') ok")).rows[0].ok,false);
assert.equal((await db.query("select has_function_privilege('authenticated','public.api_bind_firebase_device(uuid,uuid,text,public.app_role,text)','EXECUTE') ok")).rows[0].ok,false);
for(const table of ['staff_device_credentials','staff_device_invitations','catalog_change_receipts','staff_firebase_bindings']) {
  for(const role of ['anon','authenticated']) assert.equal((await db.query("select has_table_privilege($1,$2,'SELECT') ok",[role,'public.'+table])).rows[0].ok,false);
}
console.log('PASS PostgreSQL: catalog replay/conflict, disabled flavor, device/push revocation and Firebase binding isolation, role caps, replay, account switching and private grants');
await db.close();
