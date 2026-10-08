const { ApiError } = require('./http');
const { requireIdCustomer } = require('./customer-id-session');
const { getConfig, readResponse, serviceRequest, rpc } = require('./supabase');

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
    signal:AbortSignal.timeout(10000),
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
  const bearer = getBearer(req);
  let user, device;
  if (bearer.startsWith('drd.')) {
    if (!/^drd\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(bearer)) throw new ApiError(401,'INVALID_SESSION','Dispositivo no autorizado.');
    const tokenHash = require('node:crypto').createHash('sha256').update(bearer).digest('hex');
    const found = await serviceRequest('staff_device_credentials', {query:new URLSearchParams({
      select:'auth_user_id,role,device_public_id', device_public_id:'eq.'+bearer.split('.')[1],
      token_hash:'eq.'+tokenHash, revoked:'eq.false', expires_at:'gt.'+new Date().toISOString(),limit:'1'
    }).toString()});
    device=found?.[0];
    if (!device) throw new ApiError(401,'DEVICE_REVOKED','El dispositivo expiró o perdió autorización. Solicita otra invitación.');
    user={id:device.auth_user_id};
  } else if (require('./firebase-auth').looksLikeFirebase(bearer)) {
    const identity = await require('./firebase-auth').verifyFirebaseToken(bearer);
    if (!identity.email_verified) throw new ApiError(403, 'EMAIL_VERIFICATION_REQUIRED', 'Verifica el correo de la cuenta administrativa.');
    const deviceId = require('./validation').uuid(req.headers['x-donas-device'], 'deviceId');
    const resolved = await rpc('api_resolve_firebase_device', {p_firebase_uid:identity.uid,p_device_public_id:deviceId});
    if (!resolved?.id || resolved.deviceId !== deviceId || !['ADMIN','SELLER'].includes(resolved.role))
      throw new ApiError(401, 'DEVICE_REVOKED', 'La cuenta o el dispositivo perdió autorización. Solicita otra invitación.');
    return resolved;
  } else user = await requireUser(req);
  const query = new URLSearchParams({ select: 'role', auth_user_id: `eq.${user.id}` }).toString();
  const roles = await serviceRequest('app_user_roles', { query });
  const role = roles?.some(item => item.role === 'ADMIN') ? 'ADMIN' :
    roles?.some(item => item.role === 'SELLER') ? 'SELLER' : null;
  if (!role) throw new ApiError(403, 'STAFF_REQUIRED', 'Esta operación requiere una cuenta de vendedor o administrador.');
  return { ...user, role:device?.role === 'SELLER' ? 'SELLER' : role, ...(device ? {deviceId:device.device_public_id} : {}) };
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
