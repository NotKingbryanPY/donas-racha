const { requireCustomer } = require('../_lib/auth');
const { ApiError, withApi } = require('../_lib/http');
const { enforceRateLimit } = require('../_lib/rate-limit');
const { rpc } = require('../_lib/supabase');
const { fingerprint, validateOrder } = require('../_lib/validation');

module.exports = withApi(['POST'], async (req, context) => {
  const body = context.parseJsonBody(req);
  const { user, customer } = await requireCustomer(req);
  if (!customer.whatsapp_e164) throw new ApiError(409, 'CUSTOMER_PHONE_REQUIRED', 'Tu perfil necesita un WhatsApp verificado por el vendedor antes de pedir.');
  const order = validateOrder({
    ...body,
    customerName: customer.display_name,
    customerPhone: customer.whatsapp_e164
  });
  await enforceRateLimit(req, 'create_order', 10, 600, user.id);
  const payload = {
    deliveryLocation: order.deliveryLocation,
    paymentMethod: order.paymentMethod,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerNotes: order.customerNotes,
    items: order.items
  };
  const result = await rpc('api_create_order', {
    p_auth_user_id: user.id,
    p_idempotency_key: order.idempotencyKey,
    p_request_hash: fingerprint(payload),
    p_delivery_location: order.deliveryLocation,
    p_payment_method: order.paymentMethod,
    p_customer_name: order.customerName,
    p_customer_phone: order.customerPhone,
    p_customer_notes: order.customerNotes,
    p_items: order.items.map(item => ({ product_variant_id: item.productVariantId, quantity: item.quantity }))
  });
  const created = Array.isArray(result) ? result[0] : result;
  return { ...created, __status: created && created.replayed ? 200 : 201 };
});
