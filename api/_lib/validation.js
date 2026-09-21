const { createHash } = require('node:crypto');
const { ApiError } = require('./http');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_CODE = /^DR-[0-9A-F]{10}$/;
const PHONE = /^\+[1-9][0-9]{7,14}$/;

function assertObject(value, label = 'datos') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'VALIDATION_ERROR', `${label} debe ser un objeto.`);
}
function requiredString(value, label, min, max) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (result.length < min || result.length > max) throw new ApiError(400, 'VALIDATION_ERROR', `${label} no tiene una longitud válida.`);
  return result;
}
function uuid(value, label) {
  if (!UUID.test(String(value || ''))) throw new ApiError(400, 'VALIDATION_ERROR', `${label} debe ser un UUID válido.`);
  return String(value).toLowerCase();
}
function enumValue(value, allowed, label) {
  if (!allowed.includes(value)) throw new ApiError(400, 'VALIDATION_ERROR', `${label} no es válido.`);
  return value;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function validateOrder(body) {
  assertObject(body);
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length < 1 || items.length > 25) throw new ApiError(400, 'VALIDATION_ERROR', 'El pedido debe contener entre 1 y 25 artículos.');
  const normalized = {
    idempotencyKey: uuid(body.idempotencyKey, 'idempotencyKey'),
    pickupLocationId: uuid(body.pickupLocationId, 'pickupLocationId'),
    paymentMethod: enumValue(body.paymentMethod, ['CASH', 'YAPPY'], 'paymentMethod'),
    customerName: requiredString(body.customerName, 'customerName', 1, 120),
    customerPhone: body.customerPhone == null || body.customerPhone === '' ? null : String(body.customerPhone).trim(),
    customerNotes: body.customerNotes == null ? null : String(body.customerNotes).trim().slice(0, 500),
    items: items.map((item, index) => {
      assertObject(item, `items[${index}]`);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new ApiError(400, 'VALIDATION_ERROR', `items[${index}].quantity no es válido.`);
      return { productVariantId: uuid(item.productVariantId, `items[${index}].productVariantId`), quantity };
    })
  };
  if (normalized.customerPhone && !PHONE.test(normalized.customerPhone)) throw new ApiError(400, 'VALIDATION_ERROR', 'customerPhone debe usar formato internacional, por ejemplo +50760000000.');
  const unique = new Set(normalized.items.map(item => item.productVariantId));
  if (unique.size !== normalized.items.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Cada variante debe aparecer una sola vez; aumenta quantity para repetirla.');
  return normalized;
}

module.exports = { PUBLIC_CODE, enumValue, fingerprint, requiredString, uuid, validateOrder };
