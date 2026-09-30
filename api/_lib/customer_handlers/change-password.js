const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { ApiError, withApi } = require('../http');
const { accessFor, issueSession, requireIdCustomer } = require('../customer-id-session');
const { enforceRateLimit } = require('../rate-limit');
const { rpc } = require('../supabase');

const derive = promisify(scrypt);

module.exports = withApi(['POST'], async (req, context) => {
  const { customer } = await requireIdCustomer(req);
  const body = context.parseJsonBody(req, 2048);
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!currentPassword || currentPassword.length > 128 || newPassword.length < 8 || newPassword.length > 128) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Escribe tu contraseña actual y una nueva de 8 a 128 caracteres.');
  }
  await enforceRateLimit(req, 'customer_password_change_ip', 5, 3600);
  await enforceRateLimit(req, 'customer_password_change_user', 5, 3600, customer.id);
  const access = await accessFor(customer.id);
  const expected = Buffer.from(access.password_hash, 'hex');
  const actual = await derive(currentPassword, Buffer.from(access.password_salt, 'hex'), 64);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'La contraseña actual no es correcta.');
  }
  const salt = randomBytes(16);
  const hash = await derive(newPassword, salt, 64);
  const version = await rpc('api_change_customer_password', {
    p_customer_id: customer.id,
    p_old_hash: access.password_hash,
    p_old_version: access.credential_version,
    p_salt: salt.toString('hex'),
    p_hash: hash.toString('hex')
  });
  if (!Number.isInteger(version)) throw new ApiError(502, 'INVALID_RESPONSE', 'No se pudo cambiar la contraseña.');
  return { accessToken: issueSession(customer.id, version) };
});
