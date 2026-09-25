'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname,'..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'donas-cutover-test-'));
try {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','phase5-export.json'),'utf8'));
  const input = path.join(temporary,'export.json');
  const output = path.join(temporary,'cutover.sql');
  const report = path.join(temporary,'report.json');
  const run = () => spawnSync(process.execPath,[path.join(root,'scripts','phase17-cutover.mjs'),
    '--input',input,'--sql-out',output,'--report',report],{encoding:'utf8'});
  fixture.exportedAt = '2026-01-01T00:00:00.000Z';
  fs.writeFileSync(input,JSON.stringify(fixture));
  let result = run();
  assert.notEqual(result.status,0,'stale export must be rejected');
  assert.equal(fs.existsSync(output),false,'stale export must not produce SQL');

  fixture.exportedAt = new Date().toISOString();
  fs.writeFileSync(input,JSON.stringify(fixture));
  result = run();
  assert.equal(result.status,0,result.stderr);
  const sql = fs.readFileSync(output,'utf8');
  assert.match(sql,/CENTRAL_LOYALTY_ACTIVITY/);
  assert.match(sql,/source_system='GOOGLE_SHEETS'/);
  assert.match(sql,/customer_web_access/);
  assert.match(sql,/POST_IMPORT_BALANCE_MISMATCH/);
  assert.match(sql,/commit;/);
  assert.ok(JSON.parse(fs.readFileSync(report,'utf8')).summary.blockingErrors === 0);
  console.log('PASS phase17 cutover: stale export blocked, guarded SQL generated');
} finally {
  fs.rmSync(temporary,{recursive:true,force:true});
}
