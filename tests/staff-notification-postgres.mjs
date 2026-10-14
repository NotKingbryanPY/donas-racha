import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const sql=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
async function scenario(archive){
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create schema extensions;create function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select decode(substr(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),1,$1*2),'hex') $$;create function extensions.digest(text,text) returns bytea language sql as $$ select convert_to($1,'UTF8') $$;create publication supabase_realtime;`);
  for(const f of readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql')&&f<'202610140001').sort())await db.exec(sql('supabase/migrations/'+f).replace('create extension if not exists pgcrypto with schema extensions;',''));
  await db.exec(sql('supabase/manual/seed_donut_flavors.sql'));
  await db.exec(sql('supabase/sql-editor/web-only/01_repair_inventory.sql'));
  const admin=randomUUID(),seller=randomUUID(),outsider=randomUUID(),device=randomUUID(),legacy=randomUUID();
  await db.query('insert into auth.users values($1),($2),($3)',[admin,seller,outsider]);
  await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'ADMIN'),($2,'SELLER')",[admin,seller]);
  await db.query("insert into public.push_devices(device_public_id,auth_user_id,platform,token,app_version) values($1,$2,'ANDROID',$3,'1.4.1')",[legacy,admin,'legacy-token'.repeat(8)]);
  if(archive)await db.exec(sql('supabase/sql-editor/web-only/02_archive_mobile.sql'));
  await db.exec(sql('supabase/migrations/202610140001_staff_order_notifications.sql'));
  // Dashboard webhook arguments can include credentials; never export them to chat.
  await db.exec(`create function public.preflight_webhook_test() returns trigger language plpgsql as $$ begin return new;end $$;
    create trigger preflight_webhook_test after insert on public.orders for each row execute function public.preflight_webhook_test('PRIVATE_TEST_HEADER_NEVER_EXPORT');`);
  const preflight=(await db.query(sql('supabase/sql-editor/orders-v2/00_preflight.sql'))).rows[0].notification_preflight;
  assert.equal(preflight.alreadyInstalled,true);
  assert.equal(preflight.orderTriggers.find(t=>t.name==='preflight_webhook_test').function,'public.preflight_webhook_test');
  assert.equal(JSON.stringify(preflight).includes('PRIVATE_TEST_HEADER_NEVER_EXPORT'),false);
  await db.exec('drop trigger preflight_webhook_test on public.orders');
  const register=(who,id,token='new-token'.repeat(8))=>db.query('select public.api_staff_register_order_notifications($1,$2,$3,$4)',[who,id,token,'2.1.0']);
  await assert.rejects(register(outsider,device),/STAFF_REQUIRED/);
  await register(seller,device);
  await register(seller,device); // same device/token retry never duplicates metadata.
  await assert.rejects(register(admin,device),/DEVICE_REVOKED/);
  const inventory=(await db.query('select public.api_inventory_snapshot() d')).rows[0].d;
  await db.query('select public.api_set_shared_inventory($1,$2,$3)',[admin,JSON.stringify({'DR-CHOCOLATE':10,'DR-VAINILLA':10,'DR-CHOCOLATE-CHISPAS':10,'DR-VAINILLA-CHISPAS':10}),inventory.revision]);
  const variant=(await db.query("select id from public.product_variants where sku='DR-CHOCOLATE'")).rows[0].id;
  const customer=(await db.query("select * from public.api_register_customer('CPUSHVALIDATE','Ana','+50760001111',$1)",[randomUUID()])).rows[0];
  const key=randomUUID(),items=JSON.stringify([{product_variant_id:variant,quantity:1}]);
  const create=()=>db.query("select * from public.api_create_order_by_customer_id($1,$2,$3,'Edificio 1','CASH',null,$4)",[customer.id,key,'a'.repeat(64),items]);
  await create();await create();
  assert.equal(Number((await db.query('select count(*) n from public.order_push_jobs')).rows[0].n),1);
  const claim=async()=>(await db.query('select public.api_claim_staff_order_push() d')).rows[0].d;
  const jobs=await claim();assert.equal(jobs.length,1);assert.equal(jobs[0].ownerId,seller);
  assert.equal((await claim()).length,0,'leased job is not claimed twice');
  await register(seller,device,'rotated-token'.repeat(8));
  await db.query('select public.api_finish_staff_order_push($1,$2,false,true,$3,$4)',[jobs[0].id,jobs[0].leaseId,'FCM_UNREGISTERED',jobs[0].token]);
  assert.equal((await db.query('select active from public.push_devices where device_public_id=$1',[device])).rows[0].active,true,'stale failure does not deactivate a rotated token');
  const foreign=(await db.query('select public.api_staff_order_notification_status($1,$2) d',[admin,device])).rows[0].d;
  assert.equal(foreign.registered,false);assert.equal(foreign.pending,0);assert.equal(foreign.lastAcceptedAt,null);
  await db.query('update public.order_push_jobs set attempts=10,available_at=clock_timestamp()+interval \'1 hour\'');
  assert.equal((await claim()).length,0,'exhausted jobs wait for a validated recovery');
  assert.equal((await db.query('select public.api_retry_staff_order_push($1,$2) d',[admin,device])).rows[0].d.retried,0,'other owner cannot reset jobs');
  assert.equal((await db.query('select public.api_retry_staff_order_push($1,$2) d',[seller,device])).rows[0].d.retried,1);
  await db.exec(`create schema cron;create table cron.job(jobid bigserial primary key,jobname text,schedule text,command text,active boolean default true);
create function cron.schedule(text,text,text) returns bigint language plpgsql as $$ declare v bigint; begin insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid into v;return v;end $$;
create function cron.unschedule(bigint) returns boolean language plpgsql as $$ begin delete from cron.job where jobid=$1;return true;end $$;
create schema net;create table net.http_request_queue(id bigserial primary key,url text,headers jsonb);
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$ declare v bigint;begin insert into net.http_request_queue(url,headers) values(url,headers) returning id into v;return v;end $$;
create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,secret text);
create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
create function vault.create_secret(text,text) returns uuid language plpgsql as $$ declare v uuid;begin insert into vault.secrets(secret,name) values($1,$2) returning id into v;return v;end $$;
create function vault.update_secret(uuid,text) returns void language plpgsql as $$ begin update vault.secrets set secret=$2 where id=$1;end $$;` .replace(/^\+/mg,''));
  await db.exec(sql('supabase/sql-editor/orders-v2/03_retry_scheduler.sql').replace(/^create extension[^;]+;/gm,''));
  const configure=(who)=>db.query('select public.api_staff_configure_notification_retry($1,$2)',[who,'x'.repeat(64)]);
  await assert.rejects(configure(seller),/ADMIN_REQUIRED/);await configure(admin);await configure(admin);
  assert.equal(Number((await db.query("select count(*) n from cron.job where jobname='donas-order-push-v2'")).rows[0].n),1);
  assert.equal((await db.query("select has_schema_privilege('authenticated','net','USAGE') allowed")).rows[0].allowed,false);
  assert.equal((await db.query('select public.api_staff_order_notification_status($1,$2) d',[seller,device])).rows[0].d.retryScheduler,true);
  assert.ok((await db.query('select public.staff_order_push_retry_tick() id')).rows[0].id);
  const headers=(await db.query('select headers from net.http_request_queue')).rows[0].headers;
  assert.equal(headers.Authorization,'Bearer '+'x'.repeat(64));
  assert.equal((await db.query("select has_function_privilege('service_role','public.staff_order_push_retry_tick()','EXECUTE') allowed")).rows[0].allowed,false);
  await db.query('select public.api_staff_stop_order_notifications($1,$2,true)',[admin,device]);
  await assert.rejects(register(seller,device,'rotated-token'.repeat(8)),/DEVICE_REVOKED/);
  assert.equal((await claim()).length,0,'revoked devices receive no new claims');
  for(const signature of ['api_staff_register_order_notifications(uuid,uuid,text,text)','api_staff_stop_order_notifications(uuid,uuid,boolean)','api_claim_staff_order_push()','api_finish_staff_order_push(uuid,uuid,boolean,boolean,text,text)','api_staff_order_notification_status(uuid,uuid)','api_retry_staff_order_push(uuid,uuid)']){
   const r=(await db.query("select has_function_privilege('anon',$1,'EXECUTE') a,has_function_privilege('authenticated',$1,'EXECUTE') u,has_function_privilege('service_role',$1,'EXECUTE') s",['public.'+signature])).rows[0];
   assert.equal(r.a,false);assert.equal(r.u,false);assert.equal(r.s,true);
  }
  await db.exec(sql('supabase/migrations/202610140001_staff_order_notifications.sql'));
  assert.equal(Number((await db.query('select count(*) n from public.order_push_jobs')).rows[0].n),1,'reapplying never resets jobs');
  if(archive)assert.equal(Number((await db.query('select count(*) n from donas_mobile_archive.push_devices')).rows[0].n),1,'archived registrations preserved');
  else assert.equal((await db.query('select auth_mode from public.push_devices where device_public_id=$1',[legacy])).rows[0].auth_mode,'LEGACY','legacy devices are not autoauthorized');
 }finally{await db.close();}
}
await scenario(false);await scenario(true);
console.log('PASS notification SQL: existing/archive preservation, role/owner binding, one queued order, lease, rotated token, revocation, private RPC and repeat install');
