const { ApiError, withApi } = require('../http');
const { requireStaff } = require('../auth');
const { enforceRateLimit } = require('../rate-limit');
const { rpc } = require('../supabase');

module.exports = withApi(['GET'], async req => {
  const staff = await requireStaff(req);
  await enforceRateLimit(req, 'staff_weekly_ranking', 120, 60, staff.id);
  const week = req.query?.week;
  if (week !== undefined && (typeof week !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(week) ||
      !Number.isFinite(Date.parse(week)) || new Date(week).toISOString().slice(0, 10) !== week ||
      new Date(week).getUTCDay() !== 1)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Selecciona el lunes de una semana válida.');
  }
  try {
    return await rpc('api_staff_weekly_ranking', { p_auth_user_id: staff.id, p_week: week || null, p_limit: 100 });
  } catch (error) {
    if (['PGRST202', '42883'].includes(error.code)) {
      throw new ApiError(503, 'WEEKLY_RANKING_SETUP_REQUIRED', 'Falta activar el ranking semanal en Supabase.');
    }
    if (error.code === '22023') throw new ApiError(400, 'VALIDATION_ERROR', 'Selecciona una semana actual o anterior.');
    throw error;
  }
});
