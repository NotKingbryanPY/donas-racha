#!/usr/bin/env node
// Generate a single guarded transaction for the final Google Sheets -> Supabase cutover.
// The JSON export contains customer PII. Keep it and the generated SQL outside the repository.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { transformExport } from './phase5-migrate.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs,arg,index,array) => {
  if (arg.startsWith('--')) pairs.push([arg,array[index+1]]);
  return pairs;
},[]));
if (!args['--input'] || !args['--sql-out'] || !args['--report']) {
  throw new Error('Uso: node scripts/phase17-cutover.mjs --input EXPORT.json --sql-out CUTOVER.sql --report REPORT.json');
}
const payload = JSON.parse(await fs.readFile(args['--input'],'utf8'));
const { data, report } = transformExport(payload);
await fs.writeFile(args['--report'],JSON.stringify(report,null,2)+'\n');
if (report.summary.blockingErrors) throw new Error(`${report.summary.blockingErrors} errores bloqueantes. Revisa el reporte; no se generó SQL.`);
if (!data.customers.length) throw new Error('La exportación no contiene clientes.');
const ageHours = (Date.now()-Date.parse(report.sourceExportedAt))/3600000;
if (!Number.isFinite(ageHours) || ageHours<0 || ageHours>24) {
  throw new Error(`La exportación debe tener menos de 24 horas. Antigüedad: ${ageHours.toFixed(1)} horas.`);
}
const tag = `$cutover_${crypto.randomBytes(6).toString('hex')}$`;
function json(rows) {
  const value = JSON.stringify(rows);
  if (value.includes(tag)) throw new Error('Colisión con el delimitador SQL. Repite la generación.');
  return `${tag}${value}${tag}::jsonb`;
}
function literal(value) { return `'${String(value).replaceAll("'","''")}'`; }
const temp = (name,table,items) => `create temporary table cutover_${name} on commit drop as
  select * from jsonb_populate_recordset(null::public.${table},${json(items)});\n`;
let sql = `-- Donas Racha: corte definitivo desde Google Sheets hacia Supabase.
-- Fingerprint SHA-256: ${report.fingerprint}
-- Exportado: ${report.sourceExportedAt}
-- Verifica el reporte y detén las escrituras en Sheets antes de ejecutar.
begin;
select pg_advisory_xact_lock(hashtextextended('donas-racha-final-cutover',0));
`;
for (const [name,table,items] of [
  ['customers','customers',data.customers],['aliases','customer_aliases',data.aliases],
  ['accounts','loyalty_accounts',data.accounts],['streaks','customer_streaks',data.streaks],
  ['transactions','loyalty_transactions',data.transactions],['seasons','streak_seasons',data.seasons],
  ['badges','badges',data.badges],['rewards','rewards',data.rewards]
]) sql += temp(name,table,items);
sql += `create temporary table cutover_customer_badges on commit drop as
  select * from jsonb_to_recordset(${json(data.customerBadges)})
    as x(customer_id uuid,badge_key text,awarded_at timestamptz,source_system text,source_id text);
create temporary table cutover_redemptions on commit drop as
  select * from jsonb_to_recordset(${json(data.redemptions)})
    as x(id uuid,public_code text,customer_id uuid,reward_key text,loyalty_transaction_id uuid,
      points_cost_snapshot integer,reward_name_snapshot text,status public.redemption_status,
      idempotency_key uuid,source_system text,source_id text,notes text,created_at timestamptz,fulfilled_at timestamptz);
do $guards$ begin
  if exists(select 1 from cutover_customers c join public.customers p
    on upper(p.public_id)=upper(c.public_id) and p.id<>c.id) then
    raise exception 'PUBLIC_ID_UUID_CONFLICT: un ID ya pertenece a otra cuenta central';
  end if;
  if exists(select 1 from cutover_customers c join public.customers p
    on p.id=c.id where p.status<>'ACTIVE') then
    raise exception 'INACTIVE_CUSTOMER_CONFLICT: revisa los clientes desactivados antes de importar';
  end if;
  if exists(select 1 from public.loyalty_transactions t join cutover_customers c
    on c.id=t.customer_id where t.source_system<>'GOOGLE_SHEETS') then
    raise exception 'CENTRAL_LOYALTY_ACTIVITY: concilia primero los movimientos nuevos de Supabase o Android';
  end if;
  if exists(select 1 from public.orders o join cutover_customers c on c.id=o.customer_id
    where o.status='COMPLETED' and o.completed_at>${literal(report.sourceExportedAt)}::timestamptz) then
    raise exception 'ORDER_AFTER_EXPORT: existe un pedido liquidado después del export';
  end if;
end $guards$;

insert into public.badges(key,name,emoji,condition_type,condition_threshold,description,display_order,active)
  select key,name,emoji,condition_type,condition_threshold,description,display_order,active from cutover_badges
  on conflict do nothing;
insert into public.rewards(key,name,emoji,points_cost,reward_type,reward_value,description,display_order,active)
  select key,name,emoji,points_cost,reward_type,reward_value,description,display_order,active from cutover_rewards
  on conflict do nothing;
do $references$ begin
  if exists(select 1 from cutover_customer_badges cb where not exists
    (select 1 from public.badges b where b.key=cb.badge_key)) then
    raise exception 'BADGE_DEFINITION_MISSING';
  end if;
  if exists(select 1 from cutover_redemptions r where not exists
    (select 1 from public.rewards w where w.key=r.reward_key)) then
    raise exception 'REWARD_DEFINITION_MISSING';
  end if;
end $references$;
insert into public.customers(id,public_id,display_name,whatsapp_e164,status,registered_at,last_purchase_at)
  select id,public_id,display_name,whatsapp_e164,status,registered_at,last_purchase_at from cutover_customers
  on conflict(id) do update set display_name=excluded.display_name,whatsapp_e164=excluded.whatsapp_e164,
    registered_at=excluded.registered_at,last_purchase_at=excluded.last_purchase_at;
insert into public.customer_aliases(id,customer_id,alias_type,alias_value)
  select id,customer_id,alias_type,alias_value from cutover_aliases on conflict do nothing;
insert into public.customer_web_access(customer_id)
  select id from cutover_customers on conflict(customer_id) do nothing;

-- Clear only prior Google Sheets projections for these customers. Central orders and ID access survive.
delete from public.reward_redemptions r using cutover_customers c
  where r.customer_id=c.id and r.source_system='GOOGLE_SHEETS';
delete from public.customer_badges b using cutover_customers c
  where b.customer_id=c.id and b.source_system='GOOGLE_SHEETS';
delete from public.streak_seasons s using cutover_customers c
  where s.customer_id=c.id and s.source_system='GOOGLE_SHEETS';
delete from public.loyalty_transactions t using cutover_customers c
  where t.customer_id=c.id and t.source_system='GOOGLE_SHEETS';

insert into public.loyalty_accounts(customer_id,available_points,lifetime_points,purchase_points,purchase_count,redemption_count,level_key)
  select customer_id,available_points,lifetime_points,purchase_points,purchase_count,redemption_count,level_key
  from cutover_accounts on conflict(customer_id) do update set
    available_points=excluded.available_points,lifetime_points=excluded.lifetime_points,
    purchase_points=excluded.purchase_points,purchase_count=excluded.purchase_count,
    redemption_count=excluded.redemption_count,level_key=excluded.level_key,version=loyalty_accounts.version+1;
insert into public.customer_streaks(customer_id,current_count,best_count,current_season_number,last_qualified_at)
  select customer_id,current_count,best_count,current_season_number,last_qualified_at from cutover_streaks
  on conflict(customer_id) do update set current_count=excluded.current_count,
    best_count=greatest(customer_streaks.best_count,excluded.best_count),
    current_season_number=excluded.current_season_number,last_qualified_at=excluded.last_qualified_at;
insert into public.loyalty_transactions(id,customer_id,entry_type,points_delta,balance_after,source_system,source_id,description,metadata,occurred_at)
  select id,customer_id,entry_type,points_delta,balance_after,source_system,source_id,description,metadata,occurred_at
  from cutover_transactions;
insert into public.streak_seasons(id,customer_id,season_number,started_at,ended_at,completed_streak,milestones,
  preserved_points,preserved_level_key,status,source_system,source_id)
  select id,customer_id,season_number,started_at,ended_at,completed_streak,milestones,
    preserved_points,preserved_level_key,status,source_system,source_id from cutover_seasons;
insert into public.customer_badges(customer_id,badge_id,awarded_at,source_system,source_id)
  select cb.customer_id,b.id,cb.awarded_at,cb.source_system,cb.source_id
  from cutover_customer_badges cb join public.badges b on b.key=cb.badge_key
  on conflict(customer_id,badge_id) do nothing;
insert into public.reward_redemptions(id,public_code,customer_id,reward_id,loyalty_transaction_id,
  points_cost_snapshot,reward_name_snapshot,status,idempotency_key,source_system,source_id,notes,created_at,fulfilled_at)
  select r.id,r.public_code,r.customer_id,w.id,r.loyalty_transaction_id,
    r.points_cost_snapshot,r.reward_name_snapshot,r.status,r.idempotency_key,r.source_system,r.source_id,
    r.notes,r.created_at,r.fulfilled_at
  from cutover_redemptions r join public.rewards w on w.key=r.reward_key;

do $checks$ begin
  if exists(select 1 from cutover_accounts a join public.loyalty_accounts p using(customer_id)
    where (a.available_points,a.lifetime_points,a.purchase_count,a.redemption_count) is distinct from
      (p.available_points,p.lifetime_points,p.purchase_count,p.redemption_count)) then
    raise exception 'POST_IMPORT_BALANCE_MISMATCH';
  end if;
  if (select count(*) from public.customers p join cutover_customers c on p.id=c.id) <
     (select count(*) from cutover_customers) then
    raise exception 'POST_IMPORT_CUSTOMER_MISMATCH';
  end if;
  if (select count(*) from public.loyalty_transactions t join cutover_customers c on c.id=t.customer_id
      where t.source_system='GOOGLE_SHEETS') <> (select count(*) from cutover_transactions) then
    raise exception 'POST_IMPORT_LEDGER_MISMATCH';
  end if;
  if (select count(*) from public.reward_redemptions r join cutover_customers c on c.id=r.customer_id
      where r.source_system='GOOGLE_SHEETS') <> (select count(*) from cutover_redemptions) then
    raise exception 'POST_IMPORT_REDEMPTION_MISMATCH';
  end if;
end $checks$;
update public.business_settings set legacy_imported_at=now() where id=true;
commit;
-- Confirm the customer count, points and a few recent IDs in the SQL editor after commit.
`;
await fs.writeFile(args['--sql-out'],sql);
process.stdout.write(JSON.stringify({sourceExportedAt:report.sourceExportedAt,customers:data.customers.length,
  transactions:data.transactions.length,redemptions:data.redemptions.length,
  fingerprint:report.fingerprint,sqlOut:args['--sql-out'],report:args['--report']})+'\n');
