const { createHmac } = require('node:crypto');
const { ApiError } = require('./http');
const { getConfig, rpc } = require('./supabase');

function clientAddress(req) {
  return String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

async function enforceRateLimit(req, bucket, limit, windowSeconds, subject) {
  const secret = getConfig().serviceRoleKey;
  const identity = subject || clientAddress(req);
  const keyHash = createHmac('sha256', secret).update(`${bucket}:${identity}`).digest('hex');
  const result = await rpc('consume_api_rate_limit', {
    p_key_hash: keyHash,
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });
  const row = Array.isArray(result) ? result[0] : result;
  if (!row || row.allowed !== true) {
    throw new ApiError(429, 'RATE_LIMITED', 'Demasiadas solicitudes. Intenta nuevamente más tarde.', { retryAfterSeconds: row ? row.retry_after_seconds : windowSeconds });
  }
  return row;
}

module.exports = { enforceRateLimit };
