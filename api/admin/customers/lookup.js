const { requireAdmin } = require('../../_lib/auth');
const { ApiError, withApi } = require('../../_lib/http');
const { enforceRateLimit } = require('../../_lib/rate-limit');
const { serviceRequest } = require('../../_lib/supabase');

module.exports = withApi(['POST'], async (req, context) => {
  const admin = await requireAdmin(req);
  await enforceRateLimit(req, 'admin_customer_lookup', 30, 60, admin.id);
  const body = context.parseJsonBody(req, 1024);
  const publicId = String(body.publicId || '').trim().toUpperCase();
  if (!/^C[0-9A-Z_-]{3,63}$/.test(publicId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'El ID de cliente no es válido.');
  }
  const rows = await serviceRequest('customers', { query: new URLSearchParams({
    select: 'id,public_id,display_name,whatsapp_e164,status,auth_user_id',
    public_id: `eq.${publicId}`, limit: '1'
  }).toString() });
  if (!rows?.[0]) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'No se encontró el cliente en Supabase.');
  const customer = rows[0];
  return { customer: {
    id: customer.id, publicId: customer.public_id, name: customer.display_name,
    phone: customer.whatsapp_e164, status: customer.status, linked: !!customer.auth_user_id
  } };
});
