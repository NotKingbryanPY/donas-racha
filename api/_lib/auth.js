const { ApiError } = require('./http');
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
  if (!response.ok) throw new ApiError(401, 'INVALID_SESSION', 'La sesión no es válida o expiró.');
  const user = await readResponse(response);
  if (!user || !user.id) throw new ApiError(401, 'INVALID_SESSION', 'La sesión no es válida o expiró.');
  return user;
}

async function requireCustomer(req) {
  const user = await requireUser(req);
  const query = new URLSearchParams({
    select: 'id,public_id,display_name,whatsapp_e164,status,registered_at,last_purchase_at',
    auth_user_id: `eq.${user.id}`,
    status: 'eq.ACTIVE',
    limit: '1'
  }).toString();
  const customers = await serviceRequest('customers', { query });
  if (!customers || !customers[0]) throw new ApiError(403, 'CUSTOMER_NOT_LINKED', 'La cuenta no está vinculada a un cliente activo.');
  return { user, customer: customers[0] };
}

async function requireAdmin(req) {
  const user = await requireUser(req);
  const query = new URLSearchParams({ select: 'auth_user_id', auth_user_id: `eq.${user.id}`, role: 'eq.ADMIN', limit: '1' }).toString();
  const roles = await serviceRequest('app_user_roles', { query });
  if (!roles || !roles[0]) throw new ApiError(403, 'ADMIN_REQUIRED', 'Esta operación requiere rol de administrador.');
  return user;
}

async function optionalUser(req) {
  if (!req.headers.authorization) return null;
  return requireUser(req);
}

module.exports = { optionalUser, requireAdmin, requireCustomer, requireUser };
