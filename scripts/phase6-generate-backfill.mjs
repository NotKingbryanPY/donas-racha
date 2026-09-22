#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { transformExport } from './phase5-migrate.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Uso: node scripts/phase6-generate-backfill.mjs export.json phase6-apply.sql');
const payload = JSON.parse(await fs.readFile(path.resolve(input), 'utf8'));
const result = transformExport(payload);
if (result.report.summary.blockingErrors > 0) throw new Error('La exportación contiene errores bloqueantes.');
const migration = await fs.readFile(new URL('../supabase/migrations/202609220002_web_read_models.sql', import.meta.url), 'utf8');
const counters = result.data.accounts.map(item => ({
  customer_id: item.customer_id,
  purchase_count: item.purchase_count,
  redemption_count: item.redemption_count
}));
const fingerprint = result.report.fingerprint;
const tag = `$phase6_${fingerprint.slice(0, 12)}$`;
const ids = counters.map(item => `'${item.customer_id}'::uuid`).join(',');
const sql = `${migration.trim()}\n\nbegin;
update public.loyalty_accounts a set
  purchase_count = x.purchase_count,
  redemption_count = x.redemption_count
from jsonb_to_recordset(${tag}${JSON.stringify(counters)}${tag}::jsonb)
  as x(customer_id uuid, purchase_count integer, redemption_count integer)
where a.customer_id = x.customer_id;

do $$ begin
  if (select count(*) from public.loyalty_accounts where customer_id in (${ids})) <> ${counters.length}
    then raise exception 'PHASE6_ACCOUNT_COUNT_MISMATCH'; end if;
end $$;
commit;

select jsonb_build_object(
  'accounts', count(*),
  'purchases', coalesce(sum(purchase_count), 0),
  'redemptions', coalesce(sum(redemption_count), 0)
) as phase6_result
from public.loyalty_accounts
where customer_id in (${ids});
`;
await fs.writeFile(path.resolve(output), sql, 'utf8');
console.log(JSON.stringify({ ok: true, output: path.resolve(output), accounts: counters.length, fingerprint }));
