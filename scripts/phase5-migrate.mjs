#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const LEVELS = [
  ['BRONCE', 0], ['PLATA', 200], ['ORO', 500], ['DIAMANTE', 1000], ['MAESTRO', 2000]
];
const DEFAULT_BADGES = ['PRIMER_MORDISCO', 'CLIENTE_FRECUENTE', 'DONA_LOVER', 'REY_DONAS', 'MAESTRO_RACHAS', 'CLIENTE_VIP'];
const DEFAULT_BADGE_ORDERS = new Map(DEFAULT_BADGES.map((key, index) => [index + 1, key]));
const DEFAULT_REWARDS = ['DONA_GRATIS', 'DESC_10', 'DESC_25', 'DONA_PREMIUM', 'PACK_AMIGO'];
const SHEETS = ['Clientes', 'Registros', 'Insignias', 'ClienteInsignias', 'TemporadasRacha', 'TiendaRecompensas', 'Canjes'];
const NAMESPACE = 'donas-racha:google-sheets:v1:';

export function deterministicUuid(value) {
  const bytes = crypto.createHash('sha256').update(NAMESPACE + value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function text(value) {
  return String(value ?? '').trim();
}

function integer(value, fallback = 0) {
  if (value === '' || value == null) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolean(value, fallback = true) {
  if (value === '' || value == null) return fallback;
  return !['FALSE', 'FALSO', '0', 'NO', 'INACTIVE', 'INACTIVO'].includes(text(value).toUpperCase());
}

function iso(value) {
  if (value === '' || value == null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePhone(value) {
  const digits = text(value).replace(/\D/g, '');
  if (!digits) return null;
  const full = digits.length === 8 ? `507${digits}` : digits;
  return /^[1-9][0-9]{7,14}$/.test(full) ? `+${full}` : null;
}

function levelFor(points) {
  let level = 'BRONCE';
  for (const [key, minimum] of LEVELS) if (points >= minimum) level = key;
  return level;
}

function normalizeLevel(value, fallbackPoints = null) {
  const current = text(value).toUpperCase();
  const byName = { BRONCE: 'BRONCE', PLATA: 'PLATA', ORO: 'ORO', DIAMANTE: 'DIAMANTE', 'MAESTRO DONERO': 'MAESTRO', MAESTRO: 'MAESTRO' };
  return byName[current] || (fallbackPoints == null ? null : levelFor(fallbackPoints));
}

function statusForRedemption(value) {
  const current = text(value).toUpperCase();
  if (['COMPLETADO', 'COMPLETADA', 'ENTREGADO', 'ENTREGADA', 'FULFILLED'].includes(current)) return 'FULFILLED';
  if (['CANCELADO', 'CANCELADA', 'CANCELLED'].includes(current)) return 'CANCELLED';
  return 'PENDING';
}

function statusForSeason(value) {
  const current = text(value).toUpperCase();
  if (['COMPLETADO', 'COMPLETADA', 'COMPLETED'].includes(current)) return 'COMPLETED';
  if (['ROTA', 'ROTO', 'BROKEN'].includes(current)) return 'BROKEN';
  return 'ACTIVE';
}

function parseMilestones(value) {
  const allowed = new Set([3, 7, 14, 21, 30]);
  return text(value).split(',').map(part => integer(part, 0)).filter(item => allowed.has(item));
}

function sheetRows(payload, name, issues) {
  const sheet = payload.sheets?.[name];
  if (!sheet || sheet.missing) {
    issues.push({ severity: name === 'Clientes' ? 'error' : 'warning', entity: name, row: 0, code: 'MISSING_SHEET', message: `No se encontró la hoja ${name}.` });
    return [];
  }
  const headers = Array.isArray(sheet.headers) ? sheet.headers.map(text) : [];
  return (Array.isArray(sheet.rows) ? sheet.rows : []).map((values, index) => {
    const row = { __row: index + 2 };
    headers.forEach((header, column) => { if (header) row[header] = values[column]; });
    return row;
  });
}

function issue(issues, severity, entity, row, code, message, sourceId = null) {
  issues.push({ severity, entity, row, code, message, ...(sourceId ? { sourceId } : {}) });
}

export function transformExport(payload) {
  if (!payload || payload.schemaVersion !== 1 || payload.source !== 'GOOGLE_SHEETS') {
    throw new Error('El archivo no es una exportación válida de Donas Racha fase 5.');
  }
  const issues = [];
  const exportedAt = iso(payload.exportedAt) || new Date().toISOString();
  const customers = [];
  const aliases = [];
  const accounts = [];
  const streaks = [];
  const transactions = [];
  const badges = [];
  const rewards = [];
  const seasons = [];
  const customerBadges = [];
  const redemptions = [];
  const sourceCustomers = new Map();
  const phoneOwners = new Map();
  const badgeKeys = new Set(DEFAULT_BADGES);
  const rewardKeys = new Set(DEFAULT_REWARDS);

  const badgeOrders = new Map(DEFAULT_BADGE_ORDERS);
  for (const row of sheetRows(payload, 'Insignias', issues)) {
    const key = text(row.InsigniaID).toUpperCase();
    if (!key && !text(row.Nombre)) continue;
    const order = integer(row.Orden);
    const threshold = integer(row.CondicionValor);
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(key) || !text(row.Nombre) || order <= 0 || threshold <= 0) {
      issue(issues, 'error', 'Insignias', row.__row, 'INVALID_BADGE', 'La insignia tiene clave, nombre, condición u orden inválidos.', key || null);
      continue;
    }
    if (badgeKeys.has(key) && badges.some(item => item.key === key)) {
      issue(issues, 'warning', 'Insignias', row.__row, 'DUPLICATE_BADGE_DEFINITION', 'La definición de insignia duplicada se omitió.', key);
      continue;
    }
    if (badgeOrders.has(order) && badgeOrders.get(order) !== key) {
      issue(issues, 'error', 'Insignias', row.__row, 'DUPLICATE_BADGE_ORDER', 'Dos insignias usan el mismo orden.', key);
      continue;
    }
    badgeOrders.set(order, key);
    badgeKeys.add(key);
    const conditionText = `${text(row.Tipo)} ${text(row.CondicionCampo)}`.toUpperCase();
    badges.push({
      key, name: text(row.Nombre), emoji: text(row.Emoji) || '🏅',
      condition_type: conditionText.includes('RACHA') ? 'STREAK_COUNT' : 'PURCHASE_COUNT',
      condition_threshold: threshold, description: text(row.Descripcion), display_order: order,
      active: boolean(row.Activa)
    });
  }

  for (const row of sheetRows(payload, 'TiendaRecompensas', issues)) {
    const key = text(row.ItemID).toUpperCase();
    if (!key && !text(row.Nombre)) continue;
    const order = integer(row.Orden);
    const cost = integer(row.CostoPuntos);
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(key) || !text(row.Nombre) || order <= 0 || cost <= 0) {
      issue(issues, 'error', 'TiendaRecompensas', row.__row, 'INVALID_REWARD', 'La recompensa tiene clave, nombre, costo u orden inválidos.', key || null);
      continue;
    }
    if (rewardKeys.has(key) && rewards.some(item => item.key === key)) {
      issue(issues, 'warning', 'TiendaRecompensas', row.__row, 'DUPLICATE_REWARD_DEFINITION', 'La definición de recompensa duplicada se omitió.', key);
      continue;
    }
    rewardKeys.add(key);
    rewards.push({
      key, name: text(row.Nombre), emoji: text(row.Emoji) || '🎁', points_cost: cost,
      reward_type: text(row.Tipo).toUpperCase().includes('DESC') ? 'DISCOUNT' : 'PRODUCT',
      reward_value: text(row.Valor) || text(row.Nombre), description: text(row.Descripcion),
      display_order: order, active: boolean(row.Activa)
    });
  }

  for (const row of sheetRows(payload, 'Clientes', issues)) {
    const publicId = text(row.ID).toUpperCase();
    const name = text(row.Nombre);
    if (!publicId && !name) continue;
    if (!/^C[0-9A-Z_-]{3,63}$/.test(publicId)) {
      issue(issues, 'error', 'Clientes', row.__row, 'INVALID_PUBLIC_ID', 'El ID público no cumple el formato esperado.', publicId || null);
      continue;
    }
    if (!name || name.length > 120) {
      issue(issues, 'error', 'Clientes', row.__row, 'INVALID_NAME', 'El nombre está vacío o excede 120 caracteres.', publicId);
      continue;
    }
    if (sourceCustomers.has(publicId)) {
      issue(issues, 'error', 'Clientes', row.__row, 'DUPLICATE_PUBLIC_ID', 'El ID aparece más de una vez; se conserva la primera fila.', publicId);
      continue;
    }
    const customerId = deterministicUuid(`customer:${publicId}`);
    let registeredAt = iso(row.FechaRegistro);
    const lastPurchaseAt = iso(row.UltimaCompra);
    if (!registeredAt) {
      registeredAt = lastPurchaseAt || exportedAt;
      issue(issues, 'warning', 'Clientes', row.__row, 'REGISTRATION_DATE_FALLBACK', 'Se usó una fecha alternativa porque FechaRegistro está vacía o no es válida.', publicId);
    }
    if (lastPurchaseAt && new Date(lastPurchaseAt) < new Date(registeredAt)) registeredAt = lastPurchaseAt;
    const phone = normalizePhone(row.WhatsApp);
    if (text(row.WhatsApp) && !phone) issue(issues, 'warning', 'Clientes', row.__row, 'INVALID_PHONE', 'WhatsApp no pudo normalizarse a E.164 y se dejó vacío.', publicId);

    const available = Math.max(0, integer(row.PuntosDisponibles));
    const purchase = Math.max(0, integer(row.PuntosPorCompras, integer(row.TotalCompras) * 10));
    const statedLifetime = Math.max(0, integer(row.PuntosTotales, purchase));
    const lifetime = Math.max(statedLifetime, available, purchase);
    if (lifetime !== statedLifetime) issue(issues, 'warning', 'Clientes', row.__row, 'POINT_TOTAL_ADJUSTED', 'PuntosTotales se elevó para cubrir saldos derivados.', publicId);
    let levelKey = normalizeLevel(row.NivelClave, lifetime);
    if (!text(row.NivelClave) || !LEVELS.some(([key]) => key === text(row.NivelClave).toUpperCase())) {
      issue(issues, 'warning', 'Clientes', row.__row, 'LEVEL_NORMALIZED', 'El nivel se calculó a partir de los puntos acumulados.', publicId);
    }
    const currentStreak = Math.max(0, integer(row.RachaActual));
    const currentSeason = Math.max(1, integer(row.TemporadaActual, 1));
    const totalPurchases = Math.max(0, integer(row.TotalCompras));

    customers.push({ id: customerId, public_id: publicId, display_name: name, whatsapp_e164: phone, status: 'ACTIVE', registered_at: registeredAt, last_purchase_at: lastPurchaseAt });
    aliases.push({ id: deterministicUuid(`alias:LEGACY_ID:${publicId}`), customer_id: customerId, alias_type: 'LEGACY_ID', alias_value: publicId });
    if (phone) {
      if (phoneOwners.has(phone)) issue(issues, 'warning', 'Clientes', row.__row, 'DUPLICATE_PHONE', 'El teléfono ya pertenece a otro cliente; no se creó el alias PHONE.', publicId);
      else {
        phoneOwners.set(phone, publicId);
        aliases.push({ id: deterministicUuid(`alias:PHONE:${phone}`), customer_id: customerId, alias_type: 'PHONE', alias_value: phone });
      }
    }
    accounts.push({ customer_id: customerId, available_points: available, lifetime_points: lifetime, purchase_points: purchase, level_key: levelKey });
    streaks.push({ customer_id: customerId, current_count: currentStreak, best_count: currentStreak, current_season_number: currentSeason, last_qualified_at: lastPurchaseAt });
    sourceCustomers.set(publicId, { id: customerId, row, available, registeredAt, totalPurchases });
  }

  const eventsByCustomer = new Map([...sourceCustomers.keys()].map(key => [key, []]));
  for (const row of sheetRows(payload, 'Registros', issues)) {
    const customerPublicId = text(row.IDCliente).toUpperCase();
    if (!customerPublicId && !text(row.IDRegistro)) continue;
    const customer = sourceCustomers.get(customerPublicId);
    if (!customer) {
      issue(issues, 'error', 'Registros', row.__row, 'UNKNOWN_CUSTOMER', 'El registro referencia un cliente inexistente.', customerPublicId || text(row.IDRegistro));
      continue;
    }
    const sourceId = text(row.IDRegistro) || `ROW-${row.__row}`;
    if (!text(row.IDRegistro)) issue(issues, 'warning', 'Registros', row.__row, 'GENERATED_SOURCE_ID', 'Falta IDRegistro; se generó una referencia estable para esta exportación.', sourceId);
    const points = integer(row.PuntosOtorgados);
    if (!points) {
      issue(issues, 'warning', 'Registros', row.__row, 'ZERO_POINTS_SKIPPED', 'El registro no cambia puntos y no se importará al libro contable.', sourceId);
      continue;
    }
    let occurredAt = iso(row.FechaHora);
    let legacyType = text(row.Tipo);
    if (!occurredAt && ['purchase', 'reward'].includes(text(row.FechaHora).toLowerCase()) && !legacyType) {
      legacyType = text(row.FechaHora);
      occurredAt = iso(row.NombreCliente);
    }
    eventsByCustomer.get(customerPublicId).push({
      id: deterministicUuid(`transaction:REGISTROS:${sourceId}`), sourceId: `REGISTROS:${sourceId}`,
      delta: points, entryType: points > 0 ? 'PURCHASE_EARN' : 'ADJUSTMENT',
      occurredAt: occurredAt || customer.registeredAt,
      description: text(row.Notas) || `Registro heredado ${sourceId}`,
      metadata: { legacyType, legacySource: text(row.Fuente), resultingStreak: integer(row.RachaResultante), resultingLevel: text(row.NivelResultante) }
    });
  }

  const redemptionRows = [];
  for (const row of sheetRows(payload, 'Canjes', issues)) {
    const customerPublicId = text(row.ClienteID).toUpperCase();
    if (!customerPublicId && !text(row.CanjeID)) continue;
    const customer = sourceCustomers.get(customerPublicId);
    if (!customer) {
      issue(issues, 'error', 'Canjes', row.__row, 'UNKNOWN_CUSTOMER', 'El canje referencia un cliente inexistente.', customerPublicId || text(row.CanjeID));
      continue;
    }
    const sourceId = text(row.CanjeID) || `ROW-${row.__row}`;
    if (!text(row.CanjeID)) issue(issues, 'warning', 'Canjes', row.__row, 'GENERATED_SOURCE_ID', 'Falta CanjeID; se generó una referencia estable para esta exportación.', sourceId);
    const rewardKey = text(row.ItemID).toUpperCase();
    const cost = Math.max(0, integer(row.PuntosGastados));
    if (!rewardKeys.has(rewardKey) || cost <= 0) {
      issue(issues, 'error', 'Canjes', row.__row, 'INVALID_REDEMPTION', 'El canje tiene recompensa desconocida o costo inválido.', sourceId);
      continue;
    }
    const transactionId = deterministicUuid(`transaction:CANJES:${sourceId}`);
    const occurredAt = iso(row.FechaHora) || exportedAt;
    eventsByCustomer.get(customerPublicId).push({
      id: transactionId, sourceId: `CANJES:${sourceId}`, delta: -cost,
      entryType: 'REDEMPTION_SPEND', occurredAt,
      description: text(row.Notas) || `Canje heredado: ${text(row.NombreItem) || rewardKey}`,
      metadata: { rewardKey, legacySource: text(row.Fuente) }
    });
    redemptionRows.push({ row, sourceId, customerId: customer.id, rewardKey, cost, transactionId, occurredAt });
  }

  for (const [publicId, customer] of sourceCustomers) {
    const events = eventsByCustomer.get(publicId).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.sourceId.localeCompare(b.sourceId));
    let prefix = 0;
    let minimum = 0;
    for (const event of events) { prefix += event.delta; minimum = Math.min(minimum, prefix); }
    let balance = Math.max(0, -minimum);
    if (balance > 0) {
      transactions.push({
        id: deterministicUuid(`transaction:OPENING:${publicId}`), customer_id: customer.id,
        entry_type: 'OPENING_BALANCE', points_delta: balance, balance_after: balance,
        source_system: 'GOOGLE_SHEETS', source_id: `OPENING:${publicId}`,
        description: 'Saldo inicial necesario para reconstruir el historial heredado.', metadata: { generatedBy: 'phase5' }, occurred_at: customer.registeredAt
      });
    }
    for (const event of events) {
      balance += event.delta;
      transactions.push({
        id: event.id, customer_id: customer.id, entry_type: event.entryType,
        points_delta: event.delta, balance_after: balance, source_system: 'GOOGLE_SHEETS', source_id: event.sourceId,
        description: event.description, metadata: event.metadata, occurred_at: event.occurredAt
      });
    }
    const adjustment = customer.available - balance;
    if (adjustment !== 0) {
      balance += adjustment;
      transactions.push({
        id: deterministicUuid(`transaction:CLOSING:${publicId}`), customer_id: customer.id,
        entry_type: 'ADJUSTMENT', points_delta: adjustment, balance_after: balance,
        source_system: 'GOOGLE_SHEETS', source_id: `CLOSING:${publicId}`,
        description: 'Ajuste para igualar el saldo final de Google Sheets.', metadata: { generatedBy: 'phase5' }, occurred_at: exportedAt
      });
    }
  }

  for (const row of sheetRows(payload, 'ClienteInsignias', issues)) {
    const publicId = text(row.ClienteID).toUpperCase();
    const sourceId = text(row.ID) || `ROW-${row.__row}`;
    if (!publicId && !text(row.InsigniaID)) continue;
    const customer = sourceCustomers.get(publicId);
    const badgeKey = text(row.InsigniaID).toUpperCase();
    if (!customer || !badgeKeys.has(badgeKey)) {
      issue(issues, 'error', 'ClienteInsignias', row.__row, 'INVALID_BADGE_ASSIGNMENT', 'Cliente o insignia desconocidos.', sourceId);
      continue;
    }
    customerBadges.push({ customer_id: customer.id, badge_key: badgeKey, awarded_at: iso(row.FechaAsignacion) || exportedAt, source_system: 'GOOGLE_SHEETS', source_id: `CLIENTE_INSIGNIAS:${sourceId}` });
  }

  for (const row of sheetRows(payload, 'TemporadasRacha', issues)) {
    const publicId = text(row.ClienteID).toUpperCase();
    const sourceId = text(row.TemporadaID) || `ROW-${row.__row}`;
    if (!publicId && !text(row.TemporadaID)) continue;
    const customer = sourceCustomers.get(publicId);
    if (!customer) {
      issue(issues, 'error', 'TemporadasRacha', row.__row, 'UNKNOWN_CUSTOMER', 'La temporada referencia un cliente inexistente.', sourceId);
      continue;
    }
    const seasonNumber = Math.max(1, integer(row.NumeroTemporada, 1));
    const endedAt = iso(row.FechaFin);
    const startedAt = iso(row.FechaInicio) || endedAt || customer.registeredAt;
    const preservedLevelKey = normalizeLevel(row.NivelConservado);
    seasons.push({
      id: deterministicUuid(`season:${sourceId}`), customer_id: customer.id, season_number: seasonNumber,
      started_at: startedAt, ended_at: endedAt, completed_streak: Math.max(0, integer(row.RachaCompletada)),
      milestones: parseMilestones(row.HitosAlcanzados), preserved_points: Math.max(0, integer(row.PuntosConservados)),
      preserved_level_key: preservedLevelKey, status: statusForSeason(row.Estado), source_system: 'GOOGLE_SHEETS', source_id: `TEMPORADAS:${sourceId}`
    });
  }

  const duplicateBadgeKeys = new Set();
  const uniqueBadges = customerBadges.filter(item => {
    const key = `${item.customer_id}:${item.badge_key}`;
    if (duplicateBadgeKeys.has(key)) { issue(issues, 'warning', 'ClienteInsignias', 0, 'DUPLICATE_BADGE', 'La insignia duplicada se importará una sola vez.', item.source_id); return false; }
    duplicateBadgeKeys.add(key); return true;
  });

  for (const item of redemptionRows) {
    redemptions.push({
      id: deterministicUuid(`redemption:${item.sourceId}`), public_code: `GS-${sha256(item.sourceId).slice(0, 9).toUpperCase()}`,
      customer_id: item.customerId, reward_key: item.rewardKey, loyalty_transaction_id: item.transactionId,
      points_cost_snapshot: item.cost, reward_name_snapshot: text(item.row.NombreItem) || item.rewardKey,
      status: statusForRedemption(item.row.Estado), idempotency_key: deterministicUuid(`redemption-idempotency:${item.sourceId}`),
      source_system: 'GOOGLE_SHEETS', source_id: `CANJES:${item.sourceId}`, notes: text(item.row.Notas) || null,
      created_at: item.occurredAt, fulfilled_at: statusForRedemption(item.row.Estado) === 'FULFILLED' ? item.occurredAt : null
    });
  }

  const duplicateSeason = new Set();
  const uniqueSeasons = seasons.filter(item => {
    const key = `${item.customer_id}:${item.season_number}`;
    if (duplicateSeason.has(key)) { issue(issues, 'error', 'TemporadasRacha', 0, 'DUPLICATE_SEASON', 'La temporada duplicada se omitió.', item.source_id); return false; }
    duplicateSeason.add(key); return true;
  });
  const activeSeasonOwners = new Set();
  for (const item of uniqueSeasons.filter(season => season.status === 'ACTIVE').sort((a, b) => b.season_number - a.season_number)) {
    if (activeSeasonOwners.has(item.customer_id)) {
      issue(issues, 'error', 'TemporadasRacha', 0, 'MULTIPLE_ACTIVE_SEASONS', 'Un cliente tiene más de una temporada activa.', item.source_id);
    }
    activeSeasonOwners.add(item.customer_id);
  }
  const completedBest = new Map();
  for (const item of uniqueSeasons) completedBest.set(item.customer_id, Math.max(completedBest.get(item.customer_id) || 0, item.completed_streak));
  for (const item of streaks) item.best_count = Math.max(item.current_count, completedBest.get(item.customer_id) || 0);

  const deduplicate = (rows, keyOf, entity) => {
    const seen = new Set();
    return rows.filter(item => {
      const key = keyOf(item);
      if (seen.has(key)) {
        issue(issues, 'warning', entity, 0, 'DUPLICATE_SOURCE_ID', 'La referencia heredada duplicada se importará una sola vez.', key);
        return false;
      }
      seen.add(key);
      return true;
    });
  };
  const data = {
    customers, aliases, accounts, streaks, badges, rewards,
    transactions: deduplicate(transactions, item => `${item.source_system}:${item.source_id}`, 'loyalty_transactions'),
    seasons: deduplicate(uniqueSeasons, item => `${item.source_system}:${item.source_id}`, 'streak_seasons'),
    customerBadges: uniqueBadges,
    redemptions: deduplicate(redemptions, item => `${item.source_system}:${item.source_id}`, 'reward_redemptions')
  };
  const processed = SHEETS.reduce((sum, name) => sum + (payload.sheets?.[name]?.rows?.length || 0), 0);
  const invalid = issues.filter(item => item.severity === 'error').length;
  const duplicates = issues.filter(item => item.code.startsWith('DUPLICATE')).length;
  return {
    data,
    report: {
      schemaVersion: 1, sourceExportedAt: exportedAt, generatedAt: new Date().toISOString(), mode: 'DRY_RUN',
      fingerprint: sha256(canonical(payload)),
      summary: { rowsProcessed: processed, recordsPrepared: Object.values(data).reduce((sum, rows) => sum + rows.length, 0), duplicates, invalid, errors: 0 },
      entities: Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, { prepared: rows.length }])),
      issues
    }
  };
}

function parseArgs(argv) {
  const args = { input: null, report: 'migration-report.json', rollback: 'migration-rollback.sql', apply: false, confirm: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') args.input = argv[++i];
    else if (argv[i] === '--report') args.report = argv[++i];
    else if (argv[i] === '--rollback') args.rollback = argv[++i];
    else if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--confirm') args.confirm = argv[++i];
    else if (argv[i] === '--dry-run') args.apply = false;
    else throw new Error(`Opción desconocida: ${argv[i]}`);
  }
  if (!args.input) throw new Error('Uso: node scripts/phase5-migrate.mjs --input export.json [--dry-run] [--report migration-report.json]');
  return args;
}

async function supabaseRequest(baseUrl, serviceKey, table, { method = 'GET', query = '', body = null, prefer = null } = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(prefer ? { Prefer: prefer } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) throw new Error(`${table}: HTTP ${response.status} ${await response.text()}`);
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

async function batches(items, callback, size = 100) {
  for (let index = 0; index < items.length; index += size) await callback(items.slice(index, index + size));
}

async function applyMigration(result, env) {
  const baseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno local.');
  const request = (table, options) => supabaseRequest(baseUrl, serviceKey, table, options);
  const write = async (table, rows, onConflict) => {
    if (!rows.length) return;
    await batches(rows, batch => request(table, {
      method: 'POST', query: `on_conflict=${encodeURIComponent(onConflict)}`, body: batch,
      prefer: 'resolution=ignore-duplicates,return=minimal'
    }));
  };
  const existingValues = async (table, column, values) => {
    let count = 0;
    await batches(values, async batch => {
      if (!batch.length) return;
      const rows = await request(table, { query: `select=${column}&${column}=in.(${batch.join(',')})` });
      count += rows.length;
    }, 50);
    return count;
  };

  const { data } = result;
  const customerIds = data.customers.map(item => item.id);
  const [existingBadges, existingRewards, existingCustomers, existingAliases, existingAccounts, existingStreaks, existingTransactions, existingSeasons, existingRedemptions] = await Promise.all([
    request('badges', { query: 'select=id,key' }), request('rewards', { query: 'select=id,key' }),
    existingValues('customers', 'id', customerIds),
    existingValues('customer_aliases', 'id', data.aliases.map(item => item.id)),
    existingValues('loyalty_accounts', 'customer_id', customerIds),
    existingValues('customer_streaks', 'customer_id', customerIds),
    existingValues('loyalty_transactions', 'id', data.transactions.map(item => item.id)),
    existingValues('streak_seasons', 'id', data.seasons.map(item => item.id)),
    existingValues('reward_redemptions', 'id', data.redemptions.map(item => item.id))
  ]);
  const existingBadgeKeys = new Set(existingBadges.map(item => item.key));
  const existingRewardKeys = new Set(existingRewards.map(item => item.key));
  await write('badges', data.badges, 'key');
  await write('rewards', data.rewards, 'key');
  const [referenceBadges, referenceRewards] = await Promise.all([
    request('badges', { query: 'select=id,key' }), request('rewards', { query: 'select=id,key' })
  ]);
  const badgeIds = new Map(referenceBadges.map(item => [item.key, item.id]));
  const rewardIds = new Map(referenceRewards.map(item => [item.key, item.id]));
  await write('customers', data.customers, 'id');
  await write('customer_aliases', data.aliases, 'alias_type,alias_value');
  await write('loyalty_accounts', data.accounts, 'customer_id');
  await write('customer_streaks', data.streaks, 'customer_id');
  await write('loyalty_transactions', data.transactions, 'source_system,source_id');
  await write('streak_seasons', data.seasons, 'source_system,source_id');
  await write('customer_badges', data.customerBadges.map(item => {
    const badgeId = badgeIds.get(item.badge_key);
    if (!badgeId) throw new Error(`No existe la insignia ${item.badge_key} en Supabase.`);
    const { badge_key, ...row } = item;
    return { ...row, badge_id: badgeId };
  }), 'customer_id,badge_id');
  await write('reward_redemptions', data.redemptions.map(item => {
    const rewardId = rewardIds.get(item.reward_key);
    if (!rewardId) throw new Error(`No existe la recompensa ${item.reward_key} en Supabase.`);
    const { reward_key, ...row } = item;
    return { ...row, reward_id: rewardId };
  }), 'source_system,source_id');
  return {
    newBadgeKeys: data.badges.map(item => item.key).filter(key => !existingBadgeKeys.has(key)),
    newRewardKeys: data.rewards.map(item => item.key).filter(key => !existingRewardKeys.has(key)),
    existingCount: existingCustomers + existingAliases + existingAccounts + existingStreaks + existingTransactions + existingSeasons + existingRedemptions +
      data.badges.filter(item => existingBadgeKeys.has(item.key)).length + data.rewards.filter(item => existingRewardKeys.has(item.key)).length
  };
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildRollbackSql(data, fingerprint, references = { newBadgeKeys: [], newRewardKeys: [] }) {
  const customerIds = data.customers.map(item => `${sqlLiteral(item.id)}::uuid`).join(',\n    ');
  const list = customerIds || 'null::uuid';
  const sources = rows => rows.map(item => sqlLiteral(item.source_id)).join(',\n    ') || 'null';
  const keys = rows => rows.map(sqlLiteral).join(',\n    ') || 'null';
  return `-- Donas Racha fase 5 — reversión del lote ${fingerprint}\n` +
    `-- Se detiene si datos posteriores referencian estos clientes.\n` +
    `begin;\n\n` +
    `delete from public.reward_redemptions where source_system = 'GOOGLE_SHEETS' and source_id in (\n    ${sources(data.redemptions)}\n);\n` +
    `delete from public.customer_badges where source_system = 'GOOGLE_SHEETS' and source_id in (\n    ${sources(data.customerBadges)}\n);\n` +
    `delete from public.streak_seasons where source_system = 'GOOGLE_SHEETS' and source_id in (\n    ${sources(data.seasons)}\n);\n` +
    `delete from public.loyalty_transactions where source_system = 'GOOGLE_SHEETS' and source_id in (\n    ${sources(data.transactions)}\n);\n` +
    `delete from public.customer_aliases where customer_id in (\n    ${list}\n);\n` +
    `delete from public.customer_streaks where customer_id in (\n    ${list}\n);\n` +
    `delete from public.loyalty_accounts where customer_id in (\n    ${list}\n);\n` +
    `delete from public.customers where id in (\n    ${list}\n);\n` +
    `delete from public.rewards where key in (\n    ${keys(references.newRewardKeys)}\n);\n` +
    `delete from public.badges where key in (\n    ${keys(references.newBadgeKeys)}\n);\n\n` +
    `commit;\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(await fs.readFile(path.resolve(args.input), 'utf8'));
  const result = transformExport(payload);
  if (args.apply) {
    if (args.confirm !== result.report.fingerprint) throw new Error(`Confirmación requerida. Ejecuta primero DRY RUN y luego usa --confirm ${result.report.fingerprint}`);
    if (result.report.summary.invalid > 0) throw new Error('La aplicación se bloqueó porque el DRY RUN contiene errores de datos.');
    await fs.writeFile(path.resolve(args.rollback), buildRollbackSql(result.data, result.report.fingerprint), 'utf8');
    const insertedReferences = await applyMigration(result, process.env);
    result.report.mode = 'APPLY';
    result.report.appliedAt = new Date().toISOString();
    result.report.summary.duplicates += insertedReferences.existingCount;
    result.report.summary.migrated = Math.max(0, result.report.summary.recordsPrepared - insertedReferences.existingCount);
    await fs.writeFile(path.resolve(args.rollback), buildRollbackSql(result.data, result.report.fingerprint, insertedReferences), 'utf8');
    result.report.rollbackFile = path.resolve(args.rollback);
  }
  await fs.writeFile(path.resolve(args.report), `${JSON.stringify(result.report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, mode: result.report.mode, report: path.resolve(args.report), fingerprint: result.report.fingerprint, summary: result.report.summary }));
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main().catch(error => { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; });
