const { ApiError, withApi } = require('../_lib/http');
const { enforceRateLimit } = require('../_lib/rate-limit');
const { getConfig } = require('../_lib/supabase');

module.exports = withApi(['POST'], async (req, context) => {
  await enforceRateLimit(req, 'customer_register', 5, 3600);
  const body = context.parseJsonBody(req, 4096);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[^@\s]{1,100}@[^@\s]{1,200}$/.test(email) || password.length < 12 || password.length > 200) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Usa un correo válido y una contraseña de al menos 12 caracteres.');
  }
  const config = getConfig();
  const response = await fetch(`${config.url}/auth/v1/signup`, {
    method:'POST',headers:{apikey:config.anonKey,'content-type':'application/json'},
    body:JSON.stringify({email,password})
  });
  if (!response.ok) throw new ApiError(response.status >= 500 ? 502 : 400,
    'REGISTRATION_FAILED', 'No se pudo crear la cuenta. Verifica el correo o inténtalo después.');
  return { message:'Revisa tu correo si se requiere confirmación. Luego inicia sesión y vincula tu cliente con el código del vendedor.' };
});
