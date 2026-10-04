// Disposable PostgreSQL test for legacy backfill and collision-safe registration.
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
  const migrations=readdirSync(join(root,'supabase/migrations')).filter(file=>file.endsWith('.sql')).sort();
  for(const name of migrations.filter(name=>name!=='202609290002_customer_usernames.sql'))
    await db.exec(readFileSync(join(root,'supabase/migrations',name),'utf8').replace('create extension if not exists pgcrypto with schema extensions;',''));
  const register=(id,name,key=randomUUID())=>db.query(
    'select * from public.api_register_customer($1,$2,null,$3)',[id,name,key]);
  await register('CUSERNAME1','Bryan Hurtado');
  await register('CUSERNAME2','BRYAN HURTADO');
  await db.exec(readFileSync(join(root,'supabase/migrations/202609290002_customer_usernames.sql'),'utf8'));
  const backfilled=(await db.query(
    "select public_id,username from public.customers where public_id in ('CUSERNAME1','CUSERNAME2') order by public_id"
  )).rows;
  assert.deepEqual(backfilled.map(row=>row.username),['bryan.hurtado','bryan.hurtado1']);
  const third=(await register('CUSERNAME3','Bryan hurtado')).rows[0];
  assert.equal(third.username,'bryan.hurtado2');
  const long=(await register('CUSERNAME4','Bryan Anthony Luo Qiu')).rows[0];
  assert.equal(long.username,'bryan.anthony');
  const accent=(await register('CUSERNAME5','José Álvarez')).rows[0];
  assert.equal(accent.username,'jose.alvarez');
  assert.equal((await db.query("select public_id from public.customers where username='bryan.hurtado'")).rows[0].public_id,'CUSERNAME1');
  console.log('PASS customer usernames: existing accounts, case-insensitive suffixes, two words and accents');
} finally {await db.close();}
