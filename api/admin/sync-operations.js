const { requireAdmin } = require('../_lib/auth');
const { ApiError, withApi } = require('../_lib/http');
const { enforceRateLimit } = require('../_lib/rate-limit');
const { rpc } = require('../_lib/supabase');
const { uuid } = require('../_lib/validation');

module.exports = withApi(['GET','POST'], async (req, context) => {
  const admin = await requireAdmin(req);
  await enforceRateLimit(req, 'admin_sync_operations', 60, 60, admin.id);
  if (req.method === 'GET') {
    return { operations:await rpc('api_unreconciled_device_sales', {}) };
  }
  const body = context.parseJsonBody(req);
  if (typeof body.reason !== 'string' || body.reason.trim().length < 10 || body.reason.trim().length > 500) {
    throw new ApiError(400,'VALIDATION_ERROR','Explica la conciliación en 10 a 500 caracteres.');
  }
  return { reconciliation:await rpc('api_reconcile_device_sale', {
    p_sync_operation_id:uuid(body.operationId,'operationId'),
    p_actor_user_id:admin.id,
    p_reason:body.reason.trim()
  }) };
});
