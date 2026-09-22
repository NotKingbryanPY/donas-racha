'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202609220002_web_read_models.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(root, 'supabase', 'rollback', '202609220002_web_read_models_down.sql'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const flags = fs.readFileSync(path.join(root, 'assets', 'js', 'feature-flags.js'), 'utf8');
const endpoint = fs.readFileSync(path.join(root, 'api', 'ranking.js'), 'utf8');

for (const fragment of ['purchase_count integer', 'redemption_count integer', 'api_public_ranking', 'to service_role']) {
  assert.ok(migration.includes(fragment), `missing phase 6 schema: ${fragment}`);
}
assert.doesNotMatch(migration, /grant execute on function public\.api_public_ranking[^;]+to (?:anon|authenticated)/i);
assert.match(rollback, /drop function if exists public\.api_public_ranking/i);
assert.match(endpoint, /enforceRateLimit/);
assert.match(endpoint, /\['compras', 'puntos', 'racha', 'nivel', 'canjes'\]/);
assert.match(flags, /useSupabaseRanking: !forceLegacy/);
assert.match(flags, /useSupabaseUserLookup: false/);
assert.match(html, /progressive_read_fallback/);
assert.match(html, /compareRankingInBackground/);
assert.match(flags, /query\.get\('backend'\)/);

console.log('PASS phase 6 contract: ranking read model, API, feature flag, comparison and fallback');
