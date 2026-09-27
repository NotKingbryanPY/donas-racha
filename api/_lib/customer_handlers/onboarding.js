const { ApiError, withApi } = require('../http');
const { requireIdCustomer } = require('../customer-id-session');
const { serviceRequest } = require('../supabase');
const { enforceRateLimit } = require('../rate-limit');

const VERSION = 1;
const fields = 'tutorial_version,status,last_step,started_at,postponed_at,completed_at,updated_at';

module.exports = withApi(['GET', 'POST'], async (req, context) => {
  const { customer } = await requireIdCustomer(req);
  await enforceRateLimit(req, 'customer_onboarding', 60, 60, customer.id);
  const query = new URLSearchParams({ select: fields, customer_id: `eq.${customer.id}`,
    tutorial_version: `eq.${VERSION}`, limit: '1' }).toString();
  const current = (await serviceRequest('customer_onboarding', { query }))?.[0] || null;
  if (req.method === 'GET') return { version: VERSION, progress: current };

  const body = context.parseJsonBody(req, 512);
  const status = body.status;
  const step = body.lastStep;
  if (!['NOT_STARTED', 'IN_PROGRESS', 'POSTPONED', 'COMPLETED'].includes(status) ||
      !Number.isInteger(step) || step < 0 || step > 7 || (status === 'NOT_STARTED' && step !== 0)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'El progreso del tutorial no es válido.');
  }
  // Completion is monotonic; a voluntary replay never changes the saved completion.
  if (current?.status === 'COMPLETED') return { version: VERSION, progress: current };
  const now = new Date().toISOString();
  const row = {
    customer_id: customer.id, tutorial_version: VERSION, status, last_step: step,
    started_at: status === 'NOT_STARTED' ? null : current?.started_at || now,
    postponed_at: status === 'POSTPONED' ? now : current?.postponed_at || null,
    completed_at: status === 'COMPLETED' ? now : null, updated_at: now
  };
  const result = await serviceRequest('customer_onboarding', {
    method: 'POST', query: 'on_conflict=customer_id,tutorial_version', body: row,
    prefer: 'resolution=merge-duplicates,return=representation'
  });
  return { version: VERSION, progress: result?.[0] || row };
});
