'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '202609210001_auth_roles_and_rls.sql'),
  'utf8'
);
const rollback = fs.readFileSync(
  path.join(root, 'supabase', 'rollback', '202609210001_phase3_down.sql'),
  'utf8'
);

for (const fragment of [
  "create type public.app_role as enum ('CUSTOMER', 'ADMIN')",
  'create table public.app_user_roles',
  'create table public.customer_claim_tokens',
  'extensions.digest(p_claim_token',
  'extensions.gen_random_bytes(32)',
  'for update',
  "role = 'ADMIN'",
  'auth_user_id = auth.uid()',
  'grant execute on function public.claim_customer_account(text) to authenticated',
  'revoke execute on function public.claim_customer_account(text) from public, anon'
]) assert.ok(migration.includes(fragment), `missing security contract: ${fragment}`);

const policies = migration.match(/create policy /g) || [];
assert.equal(policies.length, 38, 'unexpected RLS policy count');

for (const table of ['customers', 'loyalty_accounts', 'loyalty_transactions', 'orders', 'order_items', 'payments']) {
  assert.match(migration, new RegExp(`customer_read_own_[\\s\\S]+? on public\\.${table}\\b`, 'i'));
}

assert.doesNotMatch(migration, /customer_(?:insert|update|delete)_/i, 'customers must not receive direct writes');
assert.match(rollback, /drop function if exists public\.claim_customer_account\(text\)/i);
assert.match(rollback, /drop type if exists public\.app_role/i);

console.log(`PASS security contract: ${policies.length} RLS policies, hashed one-time claims, no customer writes`);

