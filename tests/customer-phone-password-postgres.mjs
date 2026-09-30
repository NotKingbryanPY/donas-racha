import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const root=resolve(import.meta.dirname,'..');
const db=new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create schema extensions;
    create function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select decode(substr(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),1,$1*2),'hex') $$;
    create function extensions.digest(text,text) returns bytea language sql as $$ select convert_to($1,'UTF8') $$;
    create publication supabase_realtime;`);
  const migrations=readdirSync(join(root,'supabase/migrations')).filter(file=>file.endsWith('.sql')).sort();
  for(const name of migrations)
    await db.exec(readFileSync(join(root,'supabase/migrations',name),'utf8').replace('create extension if not exists pgcrypto with schema extensions;',''));
  const customerId=(await db.query(`select id from public.customers where false`)).rows[0];
  assert.equal(customerId,undefined);
  const customer=(await db.query(`select * from public.api_register_customer('CPHONE1','Ana Gómez','+50760001111',gen_random_uuid())`)).rows[0];
  const authId='33333333-3333-4333-8333-333333333333';
  await db.query('insert into auth.users(id,phone,phone_confirmed_at) values($1,$2,now())',[authId,'+50769999999']);
  const salt='a'.repeat(32),hash='b'.repeat(128);
  await assert.rejects(db.query('select public.api_set_customer_password_by_verified_phone($1,$2,$3,$4)',[customer.id,authId,salt,hash]),/PHONE_NOT_VERIFIED/);
  await db.query('update auth.users set phone=$1 where id=$2',['+50760001111',authId]);
  const first=(await db.query('select public.api_set_customer_password_by_verified_phone($1,$2,$3,$4) as version',[customer.id,authId,salt,hash])).rows[0];
  assert.equal(first.version,2);
  const second=(await db.query('select public.api_set_customer_password_by_verified_phone($1,$2,$3,$4) as version',[customer.id,authId,salt,hash])).rows[0];
  assert.equal(second.version,3);
  await db.query('update auth.users set phone_confirmed_at=null where id=$1',[authId]);
  await assert.rejects(db.query('select public.api_set_customer_password_by_verified_phone($1,$2,$3,$4)',[customer.id,authId,salt,hash]),/PHONE_NOT_VERIFIED/);
  console.log('PASS verified-phone password RPC: identity matching, confirmed phone, session version increment');
} finally {await db.close();}
