const { ApiError, withApi } = require('../_lib/http');
const { requireAdmin } = require('../_lib/auth');
const { enforceRateLimit } = require('../_lib/rate-limit');
const { getConfig } = require('../_lib/supabase');

module.exports = withApi(['POST'], async (req, context) => {
  await enforceRateLimit(req, 'admin_login', 10, 300);
  const body = context.parseJsonBody(req, 4096);
  const refresh = body.grantType === 'refresh_token';
  if (body.grantType !== 'password' && !refresh) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Tipo de sesión no válido.');
  }
  const credentials = refresh
    ? { refresh_token: String(body.refreshToken || '') }
    : { email: String(body.email || '').trim(), password: String(body.password || '') };
  if (refresh ? credentials.refresh_token.length < 20 :
    !/^[^@\s]{1,100}@[^@\s]{1,200}$/.test(credentials.email) ||
      credentials.password.length < 8 || credentials.password.length > 200) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Credenciales incompletas.');
  }
  const config = getConfig();
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=${body.grantType}`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  if (!response.ok) {
    if (response.status >= 500) throw new ApiError(502, 'AUTH_UNAVAILABLE', 'No se pudo conectar con la autenticación.');
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'La sesión no es válida.');
  }
  const session = await response.json();
  if (!session.access_token || !session.refresh_token || !Number.isFinite(session.expires_in)) {
    throw new ApiError(502, 'AUTH_INVALID_RESPONSE', 'La autenticación devolvió una respuesta incompleta.');
  }
  await requireAdmin({ headers: { authorization: `Bearer ${session.access_token}` } });
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: new Date(Date.now() + session.expires_in * 1000).toISOString()
  };
});
