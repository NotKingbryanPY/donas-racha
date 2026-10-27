// Isolated in-memory PostgreSQL. Never connects to production Supabase.
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const root=resolve(import.meta.dirname,'..');
const db=new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create schema extensions; create function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select decode(substr(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),1,$1*2),'hex') $$;
    create function extensions.digest(text,text) returns bytea language sql as $$ select convert_to($1,'UTF8') $$;
    create publication supabase_realtime;`);
  for(const name of readdirSync(join(root,'supabase/migrations')).filter(file=>file.endsWith('.sql')).sort())
    await db.exec(readFileSync(join(root,'supabase/migrations',name),'utf8').replace('create extension if not exists pgcrypto with schema extensions;',''));
  await db.exec(readFileSync(join(root,'supabase/manual/seed_donut_flavors.sql'),'utf8'));
  const seller=randomUUID(),admin=randomUUID(),outsider=randomUUID();
  await db.query('insert into auth.users(id) values($1),($2),($3)',[seller,admin,outsider]);
  await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'SELLER'),($2,'ADMIN')",[seller,admin]);
  const create=async(id,name)=>(await db.query('select * from public.api_register_customer($1,$2,null,$3)',[id,name,randomUUID()])).rows[0];
  const ana=await create('CWEEKANA','Ana'),bea=await create('CWEEKBEA','Bea');
  const current=(await db.query("select date_trunc('week',now() at time zone 'America/Panama')::date::text week")).rows[0].week;
  const previous=(await db.query('select ($1::date-7)::text week',[current])).rows[0].week;
  const read=async(actor=seller,week=null)=>(await db.query('select public.api_staff_weekly_ranking($1,$2) result',[actor,week])).rows[0].result;
  const earn=async(customer,at,points=10,type='PURCHASE_EARN')=>db.query("insert into public.loyalty_transactions(customer_id,entry_type,points_delta,balance_after,occurred_at) values($1,$2,$3,10,$4)",[customer,type,points,at]);
  // Sunday 23:59 Panama belongs to the previous week, Monday 00:00 to the new one.
  await earn(ana.id,current+'T04:59:59Z');
  await earn(bea.id,previous+'T05:00:00Z',20);
  await earn(ana.id,previous+'T18:00:00Z');
  await earn(bea.id,current+'T05:00:00Z');
  await earn(ana.id,current+'T06:00:00Z',999,'ADJUSTMENT');
  let old=await read(seller,previous);
  assert.equal(old.ranking[0].name,'Ana');assert.equal(old.ranking[0].weeklyPurchases,2);
  assert.equal(old.ranking[1].name,'Bea');assert.equal(old.ranking[1].weeklyPurchases,1);
  assert.equal(old.ranking[1].weeklyPoints,20);
  assert.equal((await read()).ranking.length,1,'new week excludes prior purchases and adjustments');
  assert.equal((await read()).ranking[0].name,'Bea');
  assert.deepEqual((await read(admin,previous)).ranking,old.ranking);
  await earn(bea.id,previous+'T19:00:00Z',10);
  old=await read(seller,previous);
  assert.equal(old.ranking[0].name,'Bea','weekly points break equal purchase counts');
  assert.equal(old.ranking[0].weeklyPurchases,2);
  assert.deepEqual((await read(seller,previous)).ranking,old.ranking,'ordering is deterministic');
  // A retried credit and the daily cap cannot manufacture extra ranking purchases.
  const key=randomUUID();
  await db.query('select public.api_credit_purchase($1,$2)',[ana.id,key]);
  await db.query('select public.api_credit_purchase($1,$2)',[ana.id,key]);
  assert.equal((await read()).ranking.find(r=>r.id===ana.public_id).weeklyPurchases,1);
  assert.deepEqual((await read(seller,previous)).ranking,old.ranking,'a new week leaves the archive intact');
  await db.query("update public.customers set status='INACTIVE' where id=$1",[ana.id]);
  assert.deepEqual((await read(seller,previous)).ranking,old.ranking,'deactivation preserves historic competitors');
  assert((await read()).weeks.includes(previous));
  const empty=(await db.query('select ($1::date-14)::text week',[current])).rows[0].week;
  assert.deepEqual((await read(seller,empty)).ranking,[]);
  assert((await read(seller,empty)).weeks.includes(empty));
  await assert.rejects(read(outsider),/STAFF_REQUIRED/);
  await assert.rejects(read(seller,current.replace(/.$/,'x')),/invalid input syntax/);
  const future=(await db.query('select ($1::date+7)::text week',[current])).rows[0].week;
  await assert.rejects(read(seller,future),/INVALID_RANKING_PERIOD/);
  const tuesday=(await db.query('select ($1::date+1)::text week',[previous])).rows[0].week;
  await assert.rejects(read(seller,tuesday),/INVALID_RANKING_PERIOD/);
  for(const role of ['anon','authenticated']) assert.equal((await db.query("select has_function_privilege($1,'public.api_staff_weekly_ranking(uuid,date,integer)','EXECUTE') allowed",[role])).rows[0].allowed,false);
  await db.exec(readFileSync(join(root,'supabase/sql-editor/weekly-ranking/00_preflight.sql'),'utf8'));
  const verification=await db.query(readFileSync(join(root,'supabase/sql-editor/weekly-ranking/02_verify.sql'),'utf8'));
  assert(Object.values(verification.rows[0]).every(value=>value===true),'activation verification must pass');
  console.log('PASS weekly SQL: Panama boundary, durable archive, replay, private roles, empty weeks, adjustments and period validation');
} finally { await db.close(); }
