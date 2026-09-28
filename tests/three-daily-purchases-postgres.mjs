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
  const customer=(await db.query("select * from public.api_register_customer('CTHREEDAILY','Cliente diario',null,$1)",[randomUUID()])).rows[0];
  const credit=(id,key=randomUUID(),source='SELLER')=>db.query('select public.api_credit_purchase($1,$2,$3) result',[id,key,source]);
  const firstKey=randomUUID();
  for(const [index,source] of ['SELLER','ORDER','SELLER'].entries()) {
    const result=(await credit(customer.id,index===0?firstKey:randomUUID(),source)).rows[0].result;
    assert.equal(result.credited,true);
    assert.equal(result.purchasesToday,index+1);
    assert.equal(result.newStreak,1,'multiple purchases do not advance the day streak');
    assert.equal(result.pointsEarned,10);
  }
  const blocked=(await credit(customer.id)).rows[0].result;
  assert.equal(blocked.credited,false);
  assert.equal(blocked.limitReached,true);
  assert.equal(blocked.purchasesToday,3);
  const replay=(await credit(customer.id,firstKey)).rows[0].result;
  assert.equal(replay.replayed,true,'a retry succeeds even after the daily limit');
  const account=(await db.query('select purchase_count,available_points from public.loyalty_accounts where customer_id=$1',[customer.id])).rows[0];
  assert.equal(account.purchase_count,3);
  assert.equal(account.available_points,30);
  assert.equal(Number((await db.query("select count(*) n from public.loyalty_transactions where customer_id=$1 and entry_type='PURCHASE_EARN'",[customer.id])).rows[0].n),3);
  assert.equal((await db.query('select current_count from public.customer_streaks where customer_id=$1',[customer.id])).rows[0].current_count,1);

  const season=(await db.query("select * from public.api_register_customer('CSEASONDAILY','Cliente temporada',null,$1)",[randomUUID()])).rows[0];
  await db.query("update public.customers set registered_at=now()-interval '40 days' where id=$1",[season.id]);
  await db.query("update public.customer_streaks set current_count=29,best_count=29,last_qualified_at=now()-interval '1 day' where customer_id=$1",[season.id]);
  const finish=(await credit(season.id)).rows[0].result;
  assert.equal(finish.completedSeason,true);
  assert.equal(finish.newStreak,0);
  const sameDay=(await credit(season.id)).rows[0].result;
  assert.equal(sameDay.completedSeason,false,'second purchase cannot complete another season');
  assert.equal(sameDay.pointsEarned,17,'same-day points keep the qualified day-30 tier');
  assert.equal(sameDay.newStreak,0);
  const state=(await db.query('select current_count,current_season_number from public.customer_streaks where customer_id=$1',[season.id])).rows[0];
  assert.equal(state.current_count,0);
  assert.equal(state.current_season_number,2);
  assert.equal((await db.query("select has_function_privilege('anon','public.api_credit_purchase(uuid,uuid,text)','EXECUTE') allowed")).rows[0].allowed,false);
  await db.exec(readFileSync(join(root,'tests/phase17-postgres.sql'),'utf8'));
  console.log('PASS three daily purchases: points, day streak, season boundary, order source, limit, replay, privilege');
} finally { await db.close(); }
