'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const endpoint = require('../api/sync/index.js');
const migration = fs.readFileSync(path.join(root,'supabase','migrations','202609220003_android_sync.sql'),'utf8');
const rollback = fs.readFileSync(path.join(root,'supabase','rollback','202609220003_android_sync_down.sql'),'utf8');
const androidRoot = path.join(root,'android','phase9-overlay','app','src','main','java','com','bryan','donas','sync');

const operation = endpoint._test.normalizeOperations([{
  clientOperationId:'11111111-1111-4111-8111-111111111111', type:'SALE',
  occurredAt:'2026-09-22T20:00:00.000Z', payload:{localEventId:7,quantity:2,totalCents:200,method:'CASH'}
}])[0];
assert.match(operation.requestHash,/^[0-9a-f]{64}$/);
assert.throws(() => endpoint._test.normalizeOperations([{...operation,type:'UNKNOWN'}]), /type/);
assert.throws(() => endpoint._test.parseCursor('not-a-cursor'), /cursor/);
for (const fragment of ['create table public.app_devices','create table public.sync_operations','api_push_sync_operations','SYNC_IDEMPOTENCY_CONFLICT','api_pull_orders_for_device','to service_role']) assert.ok(migration.includes(fragment),`missing ${fragment}`);
assert.doesNotMatch(migration,/grant execute on function public\.api_push_sync_operations[^;]+to (?:anon|authenticated)/i);
assert.match(rollback,/drop table if exists public\.sync_operations/);
for (const file of ['SyncOperationEntity.kt','SyncDao.kt','SyncDatabaseMigration.kt','SyncApiClient.kt','SyncWorker.kt','SyncScheduler.kt','SyncQueue.kt']) {
  assert.ok(fs.existsSync(path.join(androidRoot,file)), `missing Android overlay ${file}`);
}
const androidSource = fs.readdirSync(androidRoot).filter(file => file.endsWith('.kt'))
  .map(file => fs.readFileSync(path.join(androidRoot,file),'utf8')).join('\n');
for (const fragment of ['Migration(1, 2)','NetworkType.CONNECTED','enqueueUniqueWork','Bearer ${tokenProvider.accessToken()}','clientOperationId']) {
  assert.ok(androidSource.includes(fragment), `missing Android sync contract ${fragment}`);
}
assert.doesNotMatch(androidSource,/service[_-]?role/i);
console.log('PASS phase 9 sync: authenticated devices, bounded batches, idempotent push, cursor pull and Android offline queue');
