// Disposable PostgreSQL engine: validates atomic refund, repeat calls and role restrictions.
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
    create schema extensions;
    create function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select decode(substr(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),1,$1*2),'hex') $$;
    create function extensions.digest(text,text) returns bytea language sql as $$ select convert_to($1,'UTF8') $$;
    create publication supabase_realtime;`);
  for(const name of readdirSync(join(root,'supabase/migrations')).filter(file=>file.endsWith('.sql')).sort())
    await db.exec(readFileSync(join(root,'supabase/migrations',name),'utf8').replace('create extension if not exists pgcrypto with schema extensions;',''));

  const seller=randomUUID(), outsider=randomUUID();
  await db.query('insert into auth.users(id) values($1),($2)',[seller,outsider]);
  await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'SELLER')",[seller]);
  assert.equal((await db.query("select has_function_privilege('anon','public.api_staff_resolve_redemption(uuid,uuid,text)','EXECUTE') allowed")).rows[0].allowed,false);

  const customer=(await db.query("select * from public.api_register_customer('CREDEMPTIONTEST','Cliente prueba','+50760001234',$1)",[randomUUID()])).rows[0];
  await db.query('update public.loyalty_accounts set available_points=300,lifetime_points=300 where customer_id=$1',[customer.id]);
  const redeem=async()=> (await db.query(
    "select public.api_redeem_customer_reward($1,'DONA_GRATIS',$2) result",
    [customer.id,randomUUID()])).rows[0].result.id;
  const balance=async()=> (await db.query(
    'select available_points,redemption_count from public.loyalty_accounts where customer_id=$1',
    [customer.id])).rows[0];
  const resolveRedemption=async(id,status,actor=seller)=> (await db.query(
    'select public.api_staff_resolve_redemption($1,$2,$3) result',
    [actor,id,status])).rows[0].result;

  const cancelledId=await redeem();
  assert.equal((await balance()).available_points,150);
  await assert.rejects(resolveRedemption(cancelledId,'CANCELLED',outsider),/STAFF_REQUIRED/);
  const first=await resolveRedemption(cancelledId,'CANCELLED');
  assert.equal(first.pointsReturned,150);
  assert.equal((await balance()).available_points,300);
  assert.equal((await balance()).redemption_count,0);
  assert.equal((await resolveRedemption(cancelledId,'CANCELLED')).replayed,true);
  assert.equal((await balance()).available_points,300);
  await assert.rejects(resolveRedemption(cancelledId,'FULFILLED'),/REDEMPTION_ALREADY_RESOLVED/);
  const refunded=(await db.query(
    'select status,refund_transaction_id,cancelled_at from public.reward_redemptions where id=$1',
    [cancelledId])).rows[0];
  assert.equal(refunded.status,'CANCELLED');
  assert(refunded.refund_transaction_id && refunded.cancelled_at);
  assert.equal(Number((await db.query(
    "select count(*) n from public.loyalty_transactions where source_id=$1 and entry_type='REVERSAL'",
    [`REDEMPTION_CANCEL:${cancelledId}`])).rows[0].n),1);

  const fulfilledId=await redeem();
  const delivered=await resolveRedemption(fulfilledId,'FULFILLED');
  assert.equal(delivered.pointsReturned,0);
  assert.equal((await balance()).available_points,150);
  await assert.rejects(resolveRedemption(fulfilledId,'CANCELLED'),/REDEMPTION_ALREADY_RESOLVED/);
  assert.equal((await balance()).available_points,150);
  assert.equal((await db.query(
    'select status,fulfilled_at from public.reward_redemptions where id=$1',
    [fulfilledId])).rows[0].status,'FULFILLED');

  const legacy=(await db.query(
    "insert into public.reward_redemptions(customer_id,reward_id,points_cost_snapshot,reward_name_snapshot,idempotency_key) select $1,id,150,name,$2 from public.rewards where key='DONA_GRATIS' returning id",
    [customer.id,randomUUID()])).rows[0].id;
  await assert.rejects(resolveRedemption(legacy,'CANCELLED'),/REDEMPTION_SPEND_MISSING/);
  assert.equal((await balance()).available_points,150);
  assert.equal((await db.query('select status from public.reward_redemptions where id=$1',[legacy])).rows[0].status,'PENDING');

  console.log('PASS redemption management: staff authorization, one refund, repeat safety, delivered finality, legacy guard');
} finally {await db.close();}
