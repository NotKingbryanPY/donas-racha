const { randomUUID } = require('node:crypto');

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function send(res, status, payload, correlationId) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-correlation-id', correlationId);
  res.end(JSON.stringify(payload));
}

function getCorrelationId(req) {
  const supplied = String(req.headers['x-correlation-id'] || '');
  return /^[A-Za-z0-9._-]{8,100}$/.test(supplied) ? supplied : randomUUID();
}

function parseJsonBody(req, maxBytes = 16_384) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo supera el límite permitido.');
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > maxBytes) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo supera el límite permitido.');
    }
    try { return JSON.parse(req.body); } catch (_) {
      throw new ApiError(400, 'INVALID_JSON', 'El cuerpo JSON no es válido.');
    }
  }
  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new ApiError(400, 'INVALID_JSON', 'Se esperaba un objeto JSON.');
  }
  return req.body;
}

function methodNotAllowed(res, allowed, correlationId) {
  res.setHeader('allow', allowed.join(', '));
  send(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' }, correlationId }, correlationId);
}

function withApi(allowedMethods, handler) {
  return async function apiHandler(req, res) {
    const correlationId = getCorrelationId(req);
    const startedAt = Date.now();
    const safePath = String(req.url || '').split('?')[0].replace(/DR-[0-9A-F]{10}/gi, 'DR-[redacted]');
    if (!allowedMethods.includes(req.method)) return methodNotAllowed(res, allowedMethods, correlationId);
    try {
      const data = await handler(req, { correlationId, parseJsonBody });
      const status = data && data.__status ? data.__status : 200;
      if (data && data.__status) delete data.__status;
      send(res, status, { ok: true, data, correlationId }, correlationId);
      console.info(JSON.stringify({ event: 'api_request', correlationId, method: req.method, path: safePath, status, durationMs: Date.now() - startedAt }));
    } catch (error) {
      const known = error instanceof ApiError;
      const status = known ? error.status : 500;
      const code = known ? error.code : 'INTERNAL_ERROR';
      console.error(JSON.stringify({ event: 'api_error', correlationId, method: req.method, path: safePath, status, code, durationMs: Date.now() - startedAt }));
      send(res, status, {
        ok: false,
        error: { code, message: known ? error.message : 'Ocurrió un error inesperado.', ...(known && error.details ? { details: error.details } : {}) },
        correlationId
      }, correlationId);
    }
  };
}

module.exports = { ApiError, parseJsonBody, withApi };
