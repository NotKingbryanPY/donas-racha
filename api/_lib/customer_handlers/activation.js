const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const { ApiError, withApi } = require('../http');
const { customerByLogin, issueSession } = require('../customer-id-session');
const { enforceRateLimit } = require('../rate-limit');
const { rpc } = require('../supabase');

const derive = promisify(scrypt);

module.exports = withApi(['POST'], async (req, context) => {
  const body = context.parseJsonBody(req, 2048);
  const username = String(body.username || '').trim().toLowerCase();
  const password = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!username || username.length > 80) throw new ApiError(400, 'INVALID_CUSTOMER_USERNAME', 'Escribe tu usuario.');
  if (password.length < 8 || password.length > 128) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'La contraseña debe tener de 8 a 128 caracteres.');
  }
  await enforceRateLimit(req, 'customer_activation_ip', 4, 3600);
  await enforceRateLimit(req, 'customer_activation_user', 3, 3600, username);
  const customer = await customerByLogin(username);
  const salt = randomBytes(16);
  const hash = await derive(password, salt, 64);
  const version = await rpc('api_claim_customer_password', {
    p_customer_id: customer.id,
    p_salt: salt.toString('hex'),
    p_hash: hash.toString('hex')
  });
  if (!Number.isInteger(version)) throw new ApiError(502, 'INVALID_RESPONSE', 'No se pudo guardar la contraseña.');
  return {
    accessToken: issueSession(customer.id, version),
    customer: { publicId: customer.public_id, username: customer.username,
      name: customer.display_name, whatsapp: customer.whatsapp_e164, hasPassword: true }
  };
});
