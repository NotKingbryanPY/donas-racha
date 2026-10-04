const { ApiError } = require('./http');
const { requireIdCustomer } = require('./customer-id-session');
const { getConfig, readResponse, serviceRequest } = require('./supabase');

function getBearer(req) {
  const value = String(req.headers.authorization || '');
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new ApiError(401, 'AUTH_REQUIRED', 'Se requiere una sesión válida.');
  return match[1];
}

async function requireUser(req) {
  const token = getBearer(req);
  const config = getConfig();
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, authorization: `Bearer ${token}` }
  });
  if (response.status === 429) throw new ApiError(429, 'AUTH_RATE_LIMITED', 'Espera un momento para renovar la sesión.');
  if (response.status >= 500) throw new ApiError(502, 'AUTH_UNAVAILABLE', 'La autenticación no está disponible temporalmente.');
  if (!response.ok) throw new ApiError(401, 'INVALID_SESSION', 'La sesión no es válida o expiró.');
  const user = await readResponse(response);
  if (!user || !user.id) throw new ApiError(401, 'INVALID_SESSION', 'La sesión no es válida o expiró.');
  return user;
}

async function requireCustomer(req) {
  return requireIdCustomer(req);
}

async function requireStaff(req) {
  const user = await requireUser(req);
  const query = new URLSearchParams({ select: 'role', auth_user_id: `eq.${user.id}` }).toString();
  const roles = await serviceRequest('app_user_roles', { query });
  const role = roles?.some(item => item.role === 'ADMIN') ? 'ADMIN' :
    roles?.some(item => item.role === 'SELLER') ? 'SELLER' : null;
  if (!role) throw new ApiError(403, 'STAFF_REQUIRED', 'Esta operación requiere una cuenta de vendedor o administrador.');
  return { ...user, role };
}

async function requireAdmin(req) {
  const user = await requireStaff(req);
  if (user.role !== 'ADMIN') throw new ApiError(403, 'ADMIN_REQUIRED', 'Esta operación requiere rol de administrador.');
  return user;
}

async function optionalUser(req) {
  if (!req.headers.authorization) return null;
  return requireUser(req);
}

module.exports = { optionalUser, requireAdmin, requireCustomer, requireStaff, requireUser };
