// Isolated PostgreSQL test for administrative corrections. Never touches production.
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const root=resolve(import.meta.dirname,'..');
const db=new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create schema extensions; create function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select decode(substr(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),1,$1*2),'hex') $$; create function extensions.digest(text,text) returns bytea language sql as $$ select convert_to($1,'UTF8') $$; create publication supabase_realtime;`);
  for(const name of readdirSync(join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')).sort())
    await db.exec(readFileSync(join(root,'supabase/migrations',name),'utf8').replace('create extension if not exists pgcrypto with schema extensions;',''));
  const admin=randomUUID();
  await db.query('insert into auth.users(id) values($1)',[admin]);
  await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'ADMIN')",[admin]);
  const a=(await db.query("select * from public.api_register_customer('CADMINTEST','Cliente A',null,$1)",[randomUUID()])).rows[0];
  const b=(await db.query("select * from public.api_register_customer('CADMINTESTB','Cliente B',null,$1)",[randomUUID()])).rows[0];
  const change=(customer,kind,amount,date=null,reason='Reconocimiento pactado',key=randomUUID(),actor=admin)=>
    db.query('select public.api_admin_adjust_loyalty($1,$2,$3,$4,$5,$6,$7) result',[actor,customer,kind,amount,date,reason,key]);
  const account=async id=>(await db.query('select * from public.loyalty_accounts where customer_id=$1',[id])).rows[0];
  assert.equal((await db.query("select has_function_privilege('anon','public.api_admin_adjust_loyalty(uuid,uuid,text,integer,date,text,uuid)','EXECUTE') allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_table_privilege('authenticated','public.loyalty_admin_adjustments','SELECT') allowed")).rows[0].allowed,false);
  await assert.rejects(change(a.id,'POINTS',10,null,'Motivo válido',randomUUID(),randomUUID()),/ADMIN_REQUIRED/);
  const key=randomUUID();
  assert.equal((await change(a.id,'HISTORICAL_PURCHASES',3,null,'Compras prometidas',key)).rows[0].result.replayed,false);
  assert.equal((await change(a.id,'HISTORICAL_PURCHASES',3,null,'Compras prometidas',key)).rows[0].result.replayed,true);
  await assert.rejects(change(b.id,'HISTORICAL_PURCHASES',3,null,'Compras prometidas',key),/IDEMPOTENCY_CONFLICT/);
  assert.equal(Number((await account(a.id)).purchase_count),3);
  assert.equal(Number((await account(a.id)).available_points),30);
  assert.equal(Number((await account(b.id)).purchase_count),0);
  assert.equal(Number((await db.query('select current_count from public.customer_streaks where customer_id=$1',[a.id])).rows[0].current_count),0);
  assert.equal(Number((await db.query('select count(*) n from public.customer_badges where customer_id=$1',[a.id])).rows[0].n),1);
  await assert.rejects(change(a.id,'POINTS',-31),/INSUFFICIENT_POINTS/);
  await change(a.id,'POINTS',15,null,'Bonificación manual');
  await change(a.id,'POINTS',-5,null,'Corrección saldo');
  assert.equal(Number((await account(a.id)).available_points),40);
  assert.equal(Number((await account(a.id)).lifetime_points),45,'earned history remains after a debit');
  await db.query("update public.customers set registered_at=now()-interval '10 days' where id=$1",[a.id]);
  const yesterday=(await db.query("select ((now() at time zone 'America/Panama')::date-1)::text as purchase_date")).rows[0].purchase_date;
  const tomorrow=(await db.query("select ((now() at time zone 'America/Panama')::date+1)::text as purchase_date")).rows[0].purchase_date;
  await assert.rejects(change(a.id,'STREAK',5,tomorrow),/FUTURE_PURCHASE_DATE/);
  await change(a.id,'STREAK',5,yesterday,'Racha anterior confirmada');
  assert.equal(Number((await db.query('select current_count from public.customer_streaks where customer_id=$1',[a.id])).rows[0].current_count),5);
  const credited=(await db.query("select public.api_credit_purchase($1,$2,'SELLER') result",[a.id,randomUUID()])).rows[0].result;
  assert.equal(credited.credited,true);
  assert.equal(credited.newStreak,6,'next real purchase continues corrected streak');
  await assert.rejects(change(a.id,'STREAK',2,yesterday,'Fecha antigua errónea'),/STREAK_DATE_BEFORE_LAST_PURCHASE/);
  await change(b.id,'HISTORICAL_PURCHASES',2,null,'Otra persona y sus compras');
  assert.equal(Number((await account(b.id)).purchase_count),2);
  assert.equal(Number((await db.query("select count(*) n from public.loyalty_admin_adjustments where customer_id=$1",[a.id])).rows[0].n),4);
  assert.equal(Number((await db.query("select count(*) n from public.loyalty_transactions where customer_id=$1 and entry_type='ADJUSTMENT'",[a.id])).rows[0].n),3);
  console.log('PASS admin loyalty: roles, backfill, points, streak, badges, replay, isolation and audit');
} finally { await db.close(); }
