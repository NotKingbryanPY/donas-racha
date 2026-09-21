const { ApiError } = require('./http');

let cachedConfig;
function getConfig() {
  if (cachedConfig) return cachedConfig;
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!url.startsWith('https://') || !anonKey || !serviceRoleKey) {
    throw new ApiError(503, 'API_NOT_CONFIGURED', 'La API todavía no tiene configuradas sus variables de Supabase.');
  }
  cachedConfig = { url, anonKey, serviceRoleKey };
  return cachedConfig;
}

async function readResponse(response) {
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch (_) { payload = text; }
  }
  if (!response.ok) {
    const message = payload && payload.message ? payload.message : 'Supabase rechazó la operación.';
    const code = payload && payload.code ? payload.code : 'SUPABASE_ERROR';
    const status = response.status >= 500 ? 502 : response.status;
    if (message.includes('IDEMPOTENCY_CONFLICT')) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'La clave de idempotencia ya fue usada con otros datos.');
    if (message.includes('OUT_OF_STOCK')) throw new ApiError(409, 'OUT_OF_STOCK', 'No hay disponibilidad suficiente.');
    if (message.includes('INVALID_TRANSITION')) throw new ApiError(409, 'INVALID_TRANSITION', 'La transición de estado no está permitida.');
    if (message.includes('ORDER_NOT_FOUND')) throw new ApiError(404, 'ORDER_NOT_FOUND', 'No se encontró el pedido.');
    if (message.includes('CUSTOMER_NOT_LINKED')) throw new ApiError(403, 'CUSTOMER_NOT_LINKED', 'La cuenta no está vinculada a un cliente activo.');
    throw new ApiError(status, code, 'No se pudo completar la operación solicitada.');
  }
  return payload;
}

async function serviceRequest(path, { method = 'GET', query, body, prefer } = {}) {
  const config = getConfig();
  const suffix = query ? `?${query}` : '';
  const response = await fetch(`${config.url}/rest/v1/${path}${suffix}`, {
    method,
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      'content-type': 'application/json',
      ...(prefer ? { prefer } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return readResponse(response);
}

async function rpc(name, body) {
  return serviceRequest(`rpc/${name}`, { method: 'POST', body });
}

module.exports = { getConfig, readResponse, rpc, serviceRequest };
