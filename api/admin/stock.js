const { requireAdmin } = require('../_lib/auth');
const { withApi } = require('../_lib/http');
const { enforceRateLimit } = require('../_lib/rate-limit');
const { rpc, serviceRequest } = require('../_lib/supabase');
const { uuid } = require('../_lib/validation');

module.exports = withApi(['GET','POST'], async (req, context) => {
  const admin = await requireAdmin(req);
  await enforceRateLimit(req, 'admin_stock', 60, 60, admin.id);
  if (req.method === 'GET') {
    return { stock: await serviceRequest('variant_stock', {
      query:'select=variant_id,on_hand,reserved,initialized,updated_at&order=variant_id.asc'
    }) };
  }
  const body = context.parseJsonBody(req);
  if (!Number.isSafeInteger(body.quantity) || body.quantity < 0 || body.quantity > 100000) {
    const { ApiError } = require('../_lib/http');
    throw new ApiError(400, 'VALIDATION_ERROR', 'quantity debe ser un entero entre 0 y 100000.');
  }
  return { stock: await rpc('api_count_stock', {
    p_variant_id:uuid(body.variantId,'variantId'),
    p_quantity:body.quantity,
    p_idempotency_key:uuid(body.idempotencyKey,'idempotencyKey')
  }) };
});
