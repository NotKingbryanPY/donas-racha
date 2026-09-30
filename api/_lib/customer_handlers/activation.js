const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const { ApiError, withApi } = require('../http');
const { customerByLogin, issueSession } = require('../customer-id-session');
const { enforceRateLimit } = require('../rate-limit');
const { getConfig, rpc } = require('../supabase');

const derive = promisify(scrypt);

async function authRequest(path, body) {
  const { url, anonKey } = getConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  let result = {};
  try { result = await response.json(); } catch (_) { /* An empty provider response is handled below. */ }
  if (!response.ok) {
    if (response.status === 429) throw new ApiError(429, 'OTP_RATE_LIMIT', 'Espera unos minutos antes de pedir otro código.');
    if (path === 'verify') throw new ApiError(401, 'INVALID_OTP', 'El código no es válido o expiró. Solicita uno nuevo.');
    throw new ApiError(503, 'PHONE_OTP_UNAVAILABLE', 'No pudimos enviar el código por WhatsApp. Inténtalo más tarde.');
  }
  return result;
}

module.exports = withApi(['POST'], async (req, context) => {
  const body = context.parseJsonBody(req, 2048);
  const username = String(body.username || '').trim().toLowerCase();
  if (!username || username.length > 80) throw new ApiError(400, 'INVALID_CUSTOMER_USERNAME', 'Escribe tu usuario.');
  const action = String(body.action || '');
  if (action !== 'start' && action !== 'complete') throw new ApiError(400, 'INVALID_ACTION', 'Acción no válida.');
  await enforceRateLimit(req, `customer_activation_${action}_ip`, action === 'start' ? 4 : 12, 3600);
  await enforceRateLimit(req, `customer_activation_${action}_user`, action === 'start' ? 3 : 8, 3600, username);
  const customer = await customerByLogin(username);
  if (!customer.whatsapp_e164) {
    throw new ApiError(409, 'CUSTOMER_PHONE_REQUIRED', 'Este perfil no tiene WhatsApp registrado. Pide al vendedor que actualice tus datos.');
  }
  if (action === 'start') {
    await authRequest('otp', { phone: customer.whatsapp_e164, channel: 'whatsapp', create_user: true });
    return { sent: true, maskedPhone: customer.whatsapp_e164.replace(/.(?=.{4})/g, '•') };
  }
  const code = String(body.code || '').trim();
  const password = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!/^\d{6}$/.test(code) || password.length < 8 || password.length > 128) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Escribe el código de 6 dígitos y una contraseña de 8 a 128 caracteres.');
  }
  const verified = await authRequest('verify', { phone: customer.whatsapp_e164, token: code, type: 'sms' });
  const authUser = verified.user;
  if (!authUser || !/^[0-9a-f-]{36}$/i.test(String(authUser.id)) ||
      authUser.phone !== customer.whatsapp_e164 || !authUser.phone_confirmed_at) {
    throw new ApiError(502, 'INVALID_VERIFICATION', 'No se pudo verificar el número registrado.');
  }
  const salt = randomBytes(16);
  const hash = await derive(password, salt, 64);
  const version = await rpc('api_set_customer_password_by_verified_phone', {
    p_customer_id: customer.id,
    p_phone_auth_user_id: authUser.id,
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
