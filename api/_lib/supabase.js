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
    if(message.includes('SESSION_CLOSED')) throw new ApiError(409,'SESSION_CLOSED','La jornada se cerró desde otro equipo. Conserva este registro y revisa en qué jornada corresponde aplicarlo.');
    if(message.includes('DAILY_SUMMARY_CONFLICT')) throw new ApiError(409,'DAILY_SUMMARY_CONFLICT','El resumen cambió. Actualiza y revisa antes de cerrar la jornada.');
    if(message.includes('PAYMENT_SPLIT_MISMATCH')) throw new ApiError(400,'PAYMENT_SPLIT_MISMATCH','Efectivo más Yappy debe coincidir con el total vendido.');
    if(message.includes('CORRECTION_REASON_REQUIRED')) throw new ApiError(400,'CORRECTION_REASON_REQUIRED','Escribe el motivo de la corrección.');
    if(message.includes('INVALID_DAILY_OPERATION')||message.includes('INVALID_OPERATION_TIME')) throw new ApiError(400,'INVALID_DAILY_OPERATION','Los datos o la fecha del registro diario no son válidos.');
    if(message.includes('STAFF_REQUIRED')) throw new ApiError(403,'STAFF_REQUIRED','Esta cuenta necesita rol ADMIN o SELLER.');
    if(message.includes('INVENTORY_COUNT_REQUIRED')) throw new ApiError(409,'INVENTORY_COUNT_REQUIRED','Falta un conteo físico inicial de este sabor. Regístralo en el Dashboard antes de reintentar; no se presume que las existencias eran cero.');
    if (message.includes('IDEMPOTENCY_CONFLICT')) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'La clave de idempotencia ya fue usada con otros datos.');
    if (message.includes('ADMIN_REQUIRED')) throw new ApiError(403, 'ADMIN_REQUIRED', 'La cuenta no tiene permisos administrativos.');
    if (message.includes('INVALID_OPERATION')) throw new ApiError(400, 'INVALID_OPERATION', 'Los datos de la operación no son válidos.');
    if (message.includes('CATALOG_CONFLICT')) throw new ApiError(409, 'CATALOG_CONFLICT', 'El sabor cambió mientras lo editabas. Pulsa Consultar catálogo y revisa la versión actual.');
    if (code==='23505' && message.includes('product_variants_product_name_unique')) throw new ApiError(409,'FLAVOR_NAME_EXISTS','Ya existe un sabor con ese nombre. Usa otro nombre.');
    if (message.includes('FOUR_FLAVORS_REQUIRED')) throw new ApiError(400,'FOUR_FLAVORS_REQUIRED','Completa los cuatro sabores. Escribe 0 cuando no queden.');
    if (message.includes('INVALID_QUANTITY')) throw new ApiError(400,'INVALID_QUANTITY','Escribe cantidades enteras entre 0 y 100000.');
    if (message.includes('INVENTORY_REVISION_REQUIRED')) throw new ApiError(400,'INVENTORY_REVISION_REQUIRED','Vuelve a consultar el inventario antes de guardar otro conteo.');
    if (message.includes('FLAVOR_NOT_FOUND')) throw new ApiError(404, 'FLAVOR_NOT_FOUND', 'El sabor ya no existe.');
    if (message.includes('OUT_OF_STOCK')) throw new ApiError(409, 'OUT_OF_STOCK', 'Este sabor no está disponible.');
    if (message.includes('INVENTORY_CONFLICT')) throw new ApiError(409, 'INVENTORY_CONFLICT', 'El inventario cambió en otro dispositivo. Actualiza y revisa el conteo antes de guardar.');
    if (message.includes('PAYMENT_REQUIRED')) throw new ApiError(409, 'PAYMENT_REQUIRED', 'Confirma el pago recibido antes de completar la entrega.');
    if (message.includes('INVALID_TRANSITION')) throw new ApiError(409, 'INVALID_TRANSITION', 'La transición de estado no está permitida.');
    if (message.includes('ORDER_NOT_FOUND')) throw new ApiError(404, 'ORDER_NOT_FOUND', 'No se encontró el pedido.');
    if (message.includes('REDEMPTION_NOT_FOUND')) throw new ApiError(404, 'REDEMPTION_NOT_FOUND', 'No se encontró el canje.');
    if (message.includes('REDEMPTION_ALREADY_RESOLVED')) throw new ApiError(409, 'REDEMPTION_ALREADY_RESOLVED', 'Este canje ya fue resuelto. Actualiza la lista.');
    if (message.includes('REDEMPTION_SPEND_MISSING')) throw new ApiError(409, 'REDEMPTION_SPEND_MISSING', 'Este canje heredado no tiene un gasto verificable. Pide al administrador que lo revise.');
    if (message.includes('INVALID_REDEMPTION_STATUS')) throw new ApiError(400, 'INVALID_REDEMPTION_STATUS', 'El estado de canje no es válido.');
    if (message.includes('PHONE_EXISTS')) throw new ApiError(409, 'PHONE_EXISTS', 'Ya existe un cliente activo con ese WhatsApp.');
    if (message.includes('INSUFFICIENT_POINTS')) throw new ApiError(409, 'INSUFFICIENT_POINTS', 'No tienes puntos suficientes.');
    if (message.includes('INVALID_ADJUSTMENT')) throw new ApiError(400, 'INVALID_ADJUSTMENT', 'El ajuste no es válido. Revisa cantidad, fecha y motivo.');
    if (message.includes('FUTURE_PURCHASE_DATE')) throw new ApiError(400, 'FUTURE_PURCHASE_DATE', 'La fecha de la compra no puede ser futura.');
    if (message.includes('PURCHASE_BEFORE_REGISTRATION')) throw new ApiError(400, 'PURCHASE_BEFORE_REGISTRATION', 'La fecha no puede ser anterior al registro del cliente.');
    if (message.includes('STREAK_DATE_BEFORE_LAST_PURCHASE')) throw new ApiError(409, 'STREAK_DATE_BEFORE_LAST_PURCHASE', 'La fecha debe ser igual o posterior a la última compra registrada.');
    if (message.includes('REWARD_NOT_FOUND')) throw new ApiError(404, 'REWARD_NOT_FOUND', 'La recompensa ya no está disponible.');
    if (message.includes('SYSTEM_INACTIVE')) throw new ApiError(409, 'SYSTEM_INACTIVE', 'El registro de compras está pausado.');
    if (message.includes('LOYALTY_ACCOUNT_MISSING')) throw new ApiError(409, 'LOYALTY_ACCOUNT_MISSING', 'La cuenta de puntos necesita revisión.');
    if (message.includes('CUSTOMER_NOT_FOUND')) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'No encontramos ese ID de cliente activo.');
    if (message.includes('CUSTOMER_NOT_LINKED')) throw new ApiError(403, 'CUSTOMER_NOT_LINKED', 'La cuenta no está vinculada a un cliente activo.');
    if (message.includes('INVALID_PASSWORD_TOKEN')) throw new ApiError(403, 'INVALID_PASSWORD_TOKEN', 'El código temporal no es válido o expiró. Pide uno nuevo al vendedor.');
    if (message.includes('PASSWORD_ALREADY_SET')) throw new ApiError(409, 'PASSWORD_ALREADY_SET', 'Este perfil ya tiene contraseña. Entra con ella para continuar.');
    if (message.includes('PASSWORD_CHANGED')) throw new ApiError(409, 'PASSWORD_CHANGED', 'La contraseña cambió. Entra de nuevo e inténtalo otra vez.');
    if (message.includes('CUSTOMER_PHONE_REQUIRED')) throw new ApiError(409, 'CUSTOMER_PHONE_REQUIRED', 'El cliente necesita un WhatsApp registrado antes de pedir.');
    if (message.includes('AUTH_REQUIRED')) throw new ApiError(401, 'AUTH_REQUIRED', 'Inicia sesión para hacer pedidos.');
    if (message.includes('ORDER_FORBIDDEN')) throw new ApiError(403, 'ORDER_FORBIDDEN', 'No puedes consultar este pedido.');
    throw new ApiError(status, code, 'No se pudo completar la operación solicitada.');
  }
  return payload;
}

async function serviceRequest(path, { method = 'GET', query, body, prefer } = {}) {
  const config = getConfig();
  const suffix = query ? `?${query}` : '';
  const response = await fetch(`${config.url}/rest/v1/${path}${suffix}`, {
    signal:AbortSignal.timeout(15000),
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

async function userRpc(name, body, authorization) {
  const config = getConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: config.anonKey, authorization, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readResponse(response);
}

module.exports = { getConfig, readResponse, rpc, serviceRequest, userRpc };
