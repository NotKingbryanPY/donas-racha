import fs from 'node:fs/promises';
import path from 'node:path';
import { transformExport } from '../scripts/phase5-migrate.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Uso: node tests/phase5-postgres-fixture.mjs export.json fixture.sql');
const result = transformExport(JSON.parse(await fs.readFile(path.resolve(input), 'utf8')));
if (result.report.summary.invalid) throw new Error('El fixture contiene datos inválidos.');
const { data } = result;
const json = rows => `$phase5$${JSON.stringify(rows)}$phase5$::jsonb`;
const insert = (table, columns, rows) => rows.length
  ? `insert into public.${table} (${columns.join(',')}) select ${columns.join(',')} from jsonb_populate_recordset(null::public.${table}, ${json(rows)});\n`
  : '';

let sql = 'begin;\n';
sql += insert('customers', ['id','public_id','display_name','whatsapp_e164','status','registered_at','last_purchase_at'], data.customers);
sql += insert('customer_aliases', ['id','customer_id','alias_type','alias_value'], data.aliases);
sql += insert('loyalty_accounts', ['customer_id','available_points','lifetime_points','purchase_points','level_key'], data.accounts);
sql += insert('customer_streaks', ['customer_id','current_count','best_count','current_season_number','last_qualified_at'], data.streaks);
sql += insert('loyalty_transactions', ['id','customer_id','entry_type','points_delta','balance_after','source_system','source_id','description','metadata','occurred_at'], data.transactions);
sql += insert('streak_seasons', ['id','customer_id','season_number','started_at','ended_at','completed_streak','milestones','preserved_points','preserved_level_key','status','source_system','source_id'], data.seasons);
sql += `insert into public.customer_badges (customer_id,badge_id,awarded_at,source_system,source_id)
select x.customer_id, b.id, x.awarded_at, x.source_system, x.source_id
from jsonb_to_recordset(${json(data.customerBadges)}) as x(customer_id uuid,badge_key text,awarded_at timestamptz,source_system text,source_id text)
join public.badges b on b.key = x.badge_key;\n`;
sql += `insert into public.reward_redemptions (id,public_code,customer_id,reward_id,loyalty_transaction_id,points_cost_snapshot,reward_name_snapshot,status,idempotency_key,source_system,source_id,notes,created_at,fulfilled_at)
select x.id,x.public_code,x.customer_id,r.id,x.loyalty_transaction_id,x.points_cost_snapshot,x.reward_name_snapshot,x.status,x.idempotency_key,x.source_system,x.source_id,x.notes,x.created_at,x.fulfilled_at
from jsonb_to_recordset(${json(data.redemptions)}) as x(id uuid,public_code text,customer_id uuid,reward_key text,loyalty_transaction_id uuid,points_cost_snapshot integer,reward_name_snapshot text,status public.redemption_status,idempotency_key uuid,source_system text,source_id text,notes text,created_at timestamptz,fulfilled_at timestamptz)
join public.rewards r on r.key = x.reward_key;\n`;
sql += `do $$ begin
  if (select count(*) from public.customers where public_id='C1234') <> 1 then raise exception 'customer missing'; end if;
  if (select available_points from public.loyalty_accounts a join public.customers c on c.id=a.customer_id where c.public_id='C1234') <> 20 then raise exception 'balance mismatch'; end if;
  if (select count(*) from public.loyalty_transactions t join public.customers c on c.id=t.customer_id where c.public_id='C1234') <> 2 then raise exception 'ledger mismatch'; end if;
  if (select count(*) from public.reward_redemptions r join public.customers c on c.id=r.customer_id where c.public_id='C1234') <> 1 then raise exception 'redemption missing'; end if;
end $$;\nrollback;\n`;
await fs.writeFile(path.resolve(output), sql, 'utf8');
console.log(`Wrote ${path.resolve(output)}`);
