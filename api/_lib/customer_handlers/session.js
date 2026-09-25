const { ApiError, withApi } = require('../http');
const { requireUser } = require('../auth');
const { enforceRateLimit } = require('../rate-limit');
const { getConfig, serviceRequest } = require('../supabase');

module.exports = withApi(['POST'], async (req, context) => {
  await enforceRateLimit(req, 'customer_login', 10, 300);
  const body = context.parseJsonBody(req, 4096);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[^@\s]{1,100}@[^@\s]{1,200}$/.test(email) || password.length < 8 || password.length > 200) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Credenciales incompletas.');
  }
  const config = getConfig();
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method:'POST',headers:{apikey:config.anonKey,'content-type':'application/json'},
    body:JSON.stringify({email,password})
  });
  if (!response.ok) throw new ApiError(response.status >= 500 ? 502 : 401,
    'INVALID_CREDENTIALS', 'La sesión no es válida.');
  const session = await response.json();
  if (!session.access_token || !Number.isFinite(session.expires_in)) {
    throw new ApiError(502, 'AUTH_INVALID_RESPONSE', 'La autenticación devolvió una respuesta incompleta.');
  }
  const user = await requireUser({ headers:{ authorization:`Bearer ${session.access_token}` } });
  const customers = await serviceRequest('customers', { query:new URLSearchParams({
    select:'id',auth_user_id:`eq.${user.id}`,status:'eq.ACTIVE',limit:'1'
  }).toString() });
  return { accessToken:session.access_token, linked:!!customers?.[0],
    expiresAt:new Date(Date.now()+session.expires_in*1000).toISOString() };
});
