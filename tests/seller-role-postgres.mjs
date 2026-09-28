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
  await db.exec(readFileSync(join(root,'supabase/manual/seed_donut_flavors.sql'),'utf8'));
  const seller=randomUUID(), admin=randomUUID(), outsider=randomUUID(), order=randomUUID();
  await db.query('insert into auth.users(id) values($1),($2),($3)',[seller,admin,outsider]);
  await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'SELLER')",[seller]);
  await db.query("insert into public.app_user_roles(auth_user_id,role) values($1,'ADMIN')",[admin]);
  assert.equal((await db.query("select role::text from public.app_user_roles where auth_user_id=$1",[seller])).rows[0].role,'SELLER');
  assert.equal((await db.query("select has_function_privilege('anon','public.api_complete_paid_order(uuid,uuid,public.payment_method)','EXECUTE') allowed")).rows[0].allowed,false);
  await assert.rejects(db.query("select public.api_transition_order($1,'ACCEPTED',$2,null)",[order,outsider]),/STAFF_REQUIRED/);
  await assert.rejects(db.query("select public.api_complete_paid_order($1,$2,'CASH')",[order,outsider]),/STAFF_REQUIRED/);
  await assert.rejects(db.query("select public.api_transition_order($1,'ACCEPTED',$2,null)",[order,seller]),/ORDER_NOT_FOUND/);
  await assert.rejects(db.query("select public.api_complete_paid_order($1,$2,'CASH')",[order,seller]),/ORDER_NOT_FOUND/);
  const counts={'DR-CHOCOLATE':4,'DR-VAINILLA':4,'DR-CHOCOLATE-CHISPAS':2,'DR-VAINILLA-CHISPAS':2};
  await db.query('select public.api_set_manual_inventory($1,$2::jsonb)',[admin,JSON.stringify(counts)]);
  const customer=(await db.query("select * from public.api_register_customer('CSELLERTEST','Cliente vendedor','+50760001234',$1)",[randomUUID()])).rows[0];
  const variant=(await db.query("select variant_id from public.inventory_by_flavor where sku='DR-CHOCOLATE'")).rows[0].variant_id;
  const created=(await db.query("select * from public.api_create_order_by_customer_id($1,$2,$3,'Edificio 4','YAPPY',null,$4::jsonb)",
    [customer.id,randomUUID(),'a'.repeat(64),JSON.stringify([{product_variant_id:variant,quantity:1}])])).rows[0];
  await db.query("select * from public.api_transition_order($1,'ACCEPTED',$2,null)",[created.id,seller]);
  await db.query("select * from public.api_transition_order($1,'OUT_FOR_DELIVERY',$2,null)",[created.id,seller]);
  await db.query("select public.api_complete_paid_order($1,$2,'CASH')",[created.id,seller]);
  assert.equal((await db.query('select status from public.orders where id=$1',[created.id])).rows[0].status,'COMPLETED');
  assert.equal(Number((await db.query('select purchase_count from public.loyalty_accounts where customer_id=$1',[customer.id])).rows[0].purchase_count),1);
  assert.equal(Number((await db.query("select count(*) n from public.order_events where order_id=$1 and actor_type='SELLER'",[created.id])).rows[0].n),3);
  console.log('PASS seller role: order completion, loyalty, audit and public RPC isolation');
} finally {await db.close();}
