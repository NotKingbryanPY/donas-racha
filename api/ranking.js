const { ApiError, withApi } = require('./_lib/http');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { rpc } = require('./_lib/supabase');

module.exports = withApi(['GET'], async req => {
  await enforceRateLimit(req, 'public_ranking', 120, 60);
  const type = String(req.query.type || 'racha').toLowerCase();
  if (!['compras', 'puntos', 'racha', 'nivel', 'canjes'].includes(type)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'El tipo de ranking no es válido.');
  }
  const requestedLimit = Number(req.query.limit || 10);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'El límite debe estar entre 1 y 100.');
  }
  const rows = await rpc('api_public_ranking', { p_type: type, p_limit: requestedLimit });
  return {
    type,
    ranking: rows.map(row => ({
      name: row.display_name,
      levelKey: row.level_key,
      levelName: row.level_name,
      levelEmoji: row.level_emoji,
      pointsTotal: row.lifetime_points,
      pointsAvailable: row.available_points,
      totalPurchases: row.purchase_count,
      redemptionsMade: row.redemption_count,
      rewardsEarned: row.redemption_count,
      currentStreak: row.current_streak
    }))
  };
});
