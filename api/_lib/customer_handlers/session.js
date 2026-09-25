const { scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { ApiError, withApi } = require('../http');
const { accessFor, customerByPublicId, issueSession, normalizedPublicId } = require('../customer-id-session');
const { enforceRateLimit } = require('../rate-limit');

const derive = promisify(scrypt);

module.exports = withApi(['POST'], async (req, context) => {
  const body = context.parseJsonBody(req, 1024);
  const publicId = normalizedPublicId(body.publicId);
  await enforceRateLimit(req, 'customer_id_login_ip', 15, 300);
  await enforceRateLimit(req, 'customer_id_login_id', 8, 300, publicId);
  const customer = await customerByPublicId(publicId);
  const access = await accessFor(customer.id);
  if (access.password_hash) {
    if (typeof body.password !== 'string' || !body.password) {
      throw new ApiError(401, 'PASSWORD_REQUIRED', 'Este cliente activó contraseña. Escríbela para continuar.');
    }
    if (body.password.length > 200) throw new ApiError(400, 'VALIDATION_ERROR', 'La contraseña es demasiado larga.');
    const expected = Buffer.from(access.password_hash, 'hex');
    const actual = await derive(body.password, Buffer.from(access.password_salt, 'hex'), 64);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'La contraseña no es correcta.');
    }
  }
  return { accessToken: issueSession(customer.id, access.credential_version),
    customer: { publicId: customer.public_id, name: customer.display_name,
      whatsapp: customer.whatsapp_e164, hasPassword: !!access.password_hash } };
});
