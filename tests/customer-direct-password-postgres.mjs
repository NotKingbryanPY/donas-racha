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
  const customer=(await db.query(`select * from public.api_register_customer('CDIRECT1','Ana Gómez','+50760001111',gen_random_uuid())`)).rows[0];
  await db.query('update public.customers set whatsapp_e164=null where id=$1',[customer.id]);
  const salt='a'.repeat(32),hash='b'.repeat(128),nextHash='c'.repeat(128);
  const first=(await db.query('select public.api_claim_customer_password($1,$2,$3) as version',[customer.id,salt,hash])).rows[0];
  assert.equal(first.version,2);
  await assert.rejects(db.query('select public.api_claim_customer_password($1,$2,$3)',[customer.id,salt,nextHash]),/PASSWORD_ALREADY_SET/);
  await assert.rejects(db.query('select public.api_change_customer_password($1,$2,$3,$4,$5)',[customer.id,nextHash,2,salt,nextHash]),/PASSWORD_CHANGED/);
  const changed=(await db.query('select public.api_change_customer_password($1,$2,$3,$4,$5) as version',[customer.id,hash,2,salt,nextHash])).rows[0];
  assert.equal(changed.version,3);
  await assert.rejects(db.query('select public.api_change_customer_password($1,$2,$3,$4,$5)',[customer.id,hash,2,salt,hash]),/PASSWORD_CHANGED/);
  const access=(await db.query('select password_hash,credential_version from public.customer_web_access where customer_id=$1',[customer.id])).rows[0];
  assert.equal(access.password_hash,nextHash);
  assert.equal(access.credential_version,3);
  const funcs=(await db.query(`select to_regprocedure('public.api_set_customer_password_by_verified_phone(uuid,uuid,text,text)') as old_phone_rpc,
    has_function_privilege('anon','public.api_claim_customer_password(uuid,text,text)','EXECUTE') as anon_can_claim,
    has_function_privilege('service_role','public.api_claim_customer_password(uuid,text,text)','EXECUTE') as service_can_claim`)).rows[0];
  assert.equal(funcs.old_phone_rpc,null);
  assert.equal(funcs.anon_can_claim,false);
  assert.equal(funcs.service_can_claim,true);
  console.log('PASS direct password RPCs: no phone, one-time claim, atomic change and service-only permissions');
} finally {await db.close();}
