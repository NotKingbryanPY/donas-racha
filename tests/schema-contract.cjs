'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
assert.deepEqual(files, [
  '202609200001_core_customers_loyalty.sql',
  '202609200002_catalog_orders.sql',
  '202609200003_reference_data_and_rls.sql'
]);

const sql = files.map((name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8')).join('\n');
const rollback = fs.readFileSync(
  path.join(root, 'supabase', 'rollback', '202609200001_phase2_down.sql'),
  'utf8'
);

const tables = [
  'customers', 'customer_aliases', 'loyalty_levels', 'loyalty_accounts',
  'loyalty_transactions', 'customer_streaks', 'streak_seasons', 'badges',
  'customer_badges', 'rewards', 'reward_redemptions', 'products',
  'product_variants', 'pickup_locations', 'orders', 'order_items',
  'order_events', 'payments'
];

for (const table of tables) {
  assert.match(sql, new RegExp(`create table public\\.${table}\\b`, 'i'), `missing table ${table}`);
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `RLS missing on ${table}`);
  assert.match(rollback, new RegExp(`drop table if exists public\\.${table}\\b`, 'i'), `rollback missing ${table}`);
}

for (const required of [
  'customers_public_id_uq', 'customer_aliases_unique',
  'loyalty_transactions_customer_time_idx', 'streak_seasons_one_active_per_customer_uq',
  'orders_customer_time_idx', 'orders_status_time_idx', 'order_items_product_idx',
  'idempotency_key uuid not null unique', 'line_total_cents integer generated always',
  'order_items_variant_belongs_to_product'
]) {
  assert.ok(sql.includes(required), `missing schema contract: ${required}`);
}

assert.equal((sql.match(/insert into public\.loyalty_levels/gi) || []).length, 1);
assert.equal((sql.match(/insert into public\.badges/gi) || []).length, 1);
assert.equal((sql.match(/insert into public\.rewards/gi) || []).length, 1);
assert.equal((sql.match(/\('(?:BRONCE|PLATA|ORO|DIAMANTE|MAESTRO)'/g) || []).length, 5);

console.log(`PASS schema contract: ${files.length} migrations, ${tables.length} tables, RLS closed by default`);

