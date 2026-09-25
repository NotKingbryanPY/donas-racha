const { createHmac, timingSafeEqual } = require('node:crypto');
const { ApiError } = require('./http');
const { getConfig, serviceRequest } = require('./supabase');

const ID = /^C[0-9A-Z_-]{3,63}$/;
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function normalizedPublicId(value) {
  const id = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!ID.test(id)) throw new ApiError(400, 'INVALID_CUSTOMER_ID', 'Escribe un ID de cliente válido.');
  return id;
}

function signature(body) {
  return createHmac('sha256', getConfig().serviceRoleKey)
    .update('donas-racha-customer-id-session-v1:').update(body).digest();
}

function issueSession(customerId, version) {
  const body = Buffer.from(JSON.stringify({ id: customerId, version, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS })).toString('base64url');
  return `dr1.${body}.${signature(body).toString('base64url')}`;
}

async function customerByPublicId(publicId) {
  const rows = await serviceRequest('customers', { query: new URLSearchParams({
    select: 'id,public_id,display_name,whatsapp_e164,status,registered_at,last_purchase_at',
    public_id: `eq.${normalizedPublicId(publicId)}`, status: 'eq.ACTIVE', limit: '1'
  }).toString() });
  if (!rows?.[0]) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'No encontramos ese ID de cliente activo.');
  return rows[0];
}

async function accessFor(customerId) {
  const rows = await serviceRequest('customer_web_access', { query: new URLSearchParams({
    select: 'customer_id,password_salt,password_hash,credential_version',
    customer_id: `eq.${customerId}`, limit: '1'
  }).toString() });
  return rows?.[0] || { customer_id: customerId, password_salt: null, password_hash: null, credential_version: 1 };
}

async function requireIdCustomer(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(dr1\.([A-Za-z0-9_-]{20,300})\.([A-Za-z0-9_-]{43}))$/);
  if (!match) throw new ApiError(401, 'AUTH_REQUIRED', 'Escribe tu ID para entrar al perfil.');
  const given = Buffer.from(match[3], 'base64url');
  const expected = signature(match[2]);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new ApiError(401, 'INVALID_SESSION', 'La sesión no es válida. Entra de nuevo con tu ID.');
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(match[2], 'base64url').toString('utf8')); } catch (_) {
    throw new ApiError(401, 'INVALID_SESSION', 'La sesión no es válida.');
  }
  if (!/^[0-9a-f-]{36}$/i.test(String(payload.id)) || !Number.isInteger(payload.version) ||
      !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000) ||
      payload.exp > Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS) {
    throw new ApiError(401, 'INVALID_SESSION', 'La sesión expiró. Entra de nuevo con tu ID.');
  }
  const rows = await serviceRequest('customers', { query: new URLSearchParams({
    select: 'id,public_id,display_name,whatsapp_e164,status,registered_at,last_purchase_at',
    id: `eq.${payload.id}`, status: 'eq.ACTIVE', limit: '1'
  }).toString() });
  const customer = rows?.[0];
  if (!customer) throw new ApiError(403, 'CUSTOMER_NOT_FOUND', 'El cliente ya no está activo.');
  const access = await accessFor(customer.id);
  if (access.credential_version !== payload.version) throw new ApiError(401, 'INVALID_SESSION', 'Vuelve a entrar con tu ID.');
  return { user: { id: customer.id, kind: 'CUSTOMER_ID' }, customer, credentialVersion: payload.version };
}

module.exports = { accessFor, customerByPublicId, issueSession, normalizedPublicId, requireIdCustomer };
