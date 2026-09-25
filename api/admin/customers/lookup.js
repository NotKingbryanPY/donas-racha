const { requireAdmin } = require('../../_lib/auth');
const { ApiError, withApi } = require('../../_lib/http');
const { enforceRateLimit } = require('../../_lib/rate-limit');
const { rpc, serviceRequest } = require('../../_lib/supabase');

module.exports = withApi(['POST'], async (req, context) => {
  const admin = await requireAdmin(req);
  await enforceRateLimit(req, 'admin_customer_lookup', 60, 60, admin.id);
  const body = context.parseJsonBody(req);
  if (typeof body.qrToken === 'string' && /^[0-9a-f]{64}$/.test(body.qrToken)) {
    const result = await rpc('api_validate_customer_qr', { p_token:body.qrToken });
    if (!result?.length) throw new ApiError(404, 'QR_EXPIRED', 'El QR venció o ya no está activo.');
    return { customer:result[0] };
  }
  if (typeof body.publicId !== 'string' || !/^C[0-9A-Z_-]{3,63}$/.test(body.publicId.toUpperCase())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Indica un ID de cliente o un QR válido.');
  }
  const rows = await serviceRequest('customers', { query:new URLSearchParams({
    select:'id,public_id,display_name,status,loyalty_accounts(available_points,lifetime_points,purchase_count)',
    public_id:`eq.${body.publicId.toUpperCase()}`,status:'eq.ACTIVE',limit:'1'
  }).toString() });
  if (!rows[0]) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'No se encontró un cliente activo.');
  return { customer:rows[0] };
});
