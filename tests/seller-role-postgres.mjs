// Isolated in-memory PostgreSQL test. Never connects to production Supabase.
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
  const seller=randomUUID(), outsider=randomUUID(), order=randomUUID();
  await db.query('insert into auth.users(id) values($1),($2)',[seller,outsider]);
  await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'SELLER')",[seller]);
  assert.equal((await db.query("select role::text from public.app_user_roles where auth_user_id=$1",[seller])).rows[0].role,'SELLER');
  assert.equal((await db.query("select has_function_privilege('anon','public.api_complete_paid_order(uuid,uuid,public.payment_method)','EXECUTE') allowed")).rows[0].allowed,false);
  await assert.rejects(db.query("select public.api_transition_order($1,'ACCEPTED',$2,null)",[order,outsider]),/STAFF_REQUIRED/);
  await assert.rejects(db.query("select public.api_complete_paid_order($1,$2,'CASH')",[order,outsider]),/STAFF_REQUIRED/);
  await assert.rejects(db.query("select public.api_transition_order($1,'ACCEPTED',$2,null)",[order,seller]),/ORDER_NOT_FOUND/);
  await assert.rejects(db.query("select public.api_complete_paid_order($1,$2,'CASH')",[order,seller]),/ORDER_NOT_FOUND/);
  console.log('PASS seller role: enum, order permissions and public RPC isolation');
} finally {await db.close();}
