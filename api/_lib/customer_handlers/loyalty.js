const { requireCustomer } = require('../auth');
const { withApi } = require('../http');
const { enforceRateLimit } = require('../rate-limit');
const { serviceRequest } = require('../supabase');

module.exports = withApi(['GET'], async req => {
  const { user, customer } = await requireCustomer(req);
  await enforceRateLimit(req, 'customer_loyalty', 120, 60, user.id);
  const [accounts, streaks, badges, transactions] = await Promise.all([
    serviceRequest('loyalty_accounts', { query: new URLSearchParams({ select: 'available_points,lifetime_points,purchase_points,purchase_count,redemption_count,level_key,version,updated_at,loyalty_levels(name,emoji,minimum_lifetime_points)', customer_id: `eq.${customer.id}`, limit: '1' }).toString() }),
    serviceRequest('customer_streaks', { query: new URLSearchParams({ select: 'current_count,best_count,current_season_number,last_qualified_at,updated_at', customer_id: `eq.${customer.id}`, limit: '1' }).toString() }),
    serviceRequest('customer_badges', { query: new URLSearchParams({ select: 'awarded_at,badges(key,name,emoji,description)', customer_id: `eq.${customer.id}`, order: 'awarded_at.desc' }).toString() }),
    serviceRequest('loyalty_transactions', { query: new URLSearchParams({ select: 'id,entry_type,points_delta,balance_after,description,occurred_at', customer_id: `eq.${customer.id}`, order: 'occurred_at.desc', limit: '25' }).toString() })
  ]);
  return { account: accounts[0] || null, streak: streaks[0] || null, badges, recentTransactions: transactions };
});
