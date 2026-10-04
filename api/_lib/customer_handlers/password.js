const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const { ApiError, withApi } = require('../http');
const { customerByLogin, issueSession } = require('../customer-id-session');
const { enforceRateLimit } = require('../rate-limit');
const { rpc } = require('../supabase');

const derive = promisify(scrypt);

module.exports = withApi(['POST'], async (req, context) => {
  const body = context.parseJsonBody(req, 4096);
  const login = String(body.username || body.publicId || '').trim().toLowerCase();
  if (!login || login.length > 80) throw new ApiError(400, 'INVALID_CUSTOMER_USERNAME', 'Escribe tu usuario.');
  const token = typeof body.code === 'string' ? body.code.trim().toLowerCase() : '';
  const password = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!/^[0-9a-f]{8}$/.test(token) || password.length < 8 || password.length > 128) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Usa el código del vendedor y una contraseña de 8 a 128 caracteres.');
  }
  await enforceRateLimit(req, 'customer_password_ip', 5, 3600);
  await enforceRateLimit(req, 'customer_password_id', 5, 3600, login);
  const customer = await customerByLogin(login);
  const salt = randomBytes(16);
  const hash = await derive(password, salt, 64);
  const version = await rpc('api_set_customer_password', {
    p_customer_id: customer.id, p_token: token,
    p_salt: salt.toString('hex'), p_hash: hash.toString('hex')
  });
  if (!Number.isInteger(version)) throw new ApiError(502, 'INVALID_RESPONSE', 'No se pudo actualizar la contraseña.');
  return { accessToken: issueSession(customer.id, version),
    customer: { publicId: customer.public_id, username: customer.username, name: customer.display_name,
      whatsapp: customer.whatsapp_e164, hasPassword: true } };
});
