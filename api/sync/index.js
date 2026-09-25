const { requireAdmin } = require('../_lib/auth');
const { ApiError, withApi } = require('../_lib/http');
const { enforceRateLimit } = require('../_lib/rate-limit');
const { rpc, serviceRequest } = require('../_lib/supabase');
const { fingerprint } = require('../_lib/validation');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(['SEED','OPENING_BALANCE','SALE','PURCHASE','EXPENSE','LOAN','LOAN_PAYMENT','PARTNER_PAYMENT','ADJUSTMENT','SESSION','SESSION_START','SESSION_CLOSE','REVERSAL','TRANSFER']);
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function text(value, label, min, max) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) throw new ApiError(400, 'VALIDATION_ERROR', `${label} no tiene una longitud válida.`);
  return normalized;
}
function uuid(value, label) {
  if (!UUID.test(String(value || ''))) throw new ApiError(400, 'VALIDATION_ERROR', `${label} debe ser un UUID válido.`);
  return String(value).toLowerCase();
}
function parseCursor(value) {
  if (!value) return { updatedAt:'1970-01-01T00:00:00.000Z', id:ZERO_UUID };
  try {
    const decoded = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    const date = new Date(decoded.updatedAt);
    if (!UUID.test(decoded.id) || Number.isNaN(date.getTime())) throw new Error();
    return { updatedAt:date.toISOString(), id:String(decoded.id).toLowerCase() };
  } catch (_) { throw new ApiError(400, 'INVALID_CURSOR', 'El cursor de sincronización no es válido.'); }
}
function cursorFor(row) {
  return Buffer.from(JSON.stringify({ updatedAt:row.updated_at, id:row.id })).toString('base64url');
}
function normalizeOperations(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new ApiError(400, 'VALIDATION_ERROR', 'operations debe contener entre 1 y 50 elementos.');
  return value.map((operation, index) => {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) throw new ApiError(400, 'VALIDATION_ERROR', `operations[${index}] no es válido.`);
    const clientOperationId = uuid(operation.clientOperationId, `operations[${index}].clientOperationId`);
    const type = String(operation.type || '');
    if (!TYPES.has(type)) throw new ApiError(400, 'VALIDATION_ERROR', `operations[${index}].type no es válido.`);
    const occurred = new Date(operation.occurredAt);
    if (Number.isNaN(occurred.getTime()) || occurred.getTime() < Date.UTC(2000,0,1) || occurred.getTime() > Date.now() + 300000) throw new ApiError(400, 'VALIDATION_ERROR', `operations[${index}].occurredAt no es válido.`);
    const payload = operation.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Buffer.byteLength(JSON.stringify(payload)) > 8192) throw new ApiError(400, 'VALIDATION_ERROR', `operations[${index}].payload no es válido.`);
    const normalized = { clientOperationId, type, occurredAt:occurred.toISOString(), payload };
    return { ...normalized, requestHash:fingerprint(normalized) };
  });
}

module.exports = withApi(['GET','POST'], async (req, context) => {
  const admin = await requireAdmin(req);
  if (req.method === 'GET') {
    await enforceRateLimit(req, 'sync_pull', 120, 60, admin.id);
    const cursor = parseCursor(req.query.cursor);
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 100));
    const orders = await rpc('api_pull_orders_for_device', { p_after_updated_at:cursor.updatedAt, p_after_id:cursor.id, p_limit:limit });
    if (orders?.length) {
      const ids = orders.map(order => order.id).join(',');
      const rows = await serviceRequest('central_sales', { query:new URLSearchParams({
        select:'order_id', order_id:`in.(${ids})`
      }).toString() });
      const settled = new Set(rows.map(row => row.order_id));
      orders.forEach(order => { order.settled = settled.has(order.id); });
    }
    return { orders:orders || [], nextCursor:orders && orders.length ? cursorFor(orders[orders.length - 1]) : (req.query.cursor || null), hasMore:(orders || []).length === limit, serverTime:new Date().toISOString() };
  }
  await enforceRateLimit(req, 'sync_push', 30, 60, admin.id);
  const body = context.parseJsonBody(req, 262144);
  const operations = normalizeOperations(body.operations);
  const result = await rpc('api_push_sync_operations', {
    p_auth_user_id:admin.id,
    p_device_public_id:uuid(body.deviceId, 'deviceId'),
    p_device_name:text(body.deviceName, 'deviceName', 1, 80),
    p_app_version:text(body.appVersion, 'appVersion', 1, 40),
    p_operations:operations
  });
  return { ...result, serverTime:new Date().toISOString() };
});

module.exports._test = { normalizeOperations, parseCursor };
