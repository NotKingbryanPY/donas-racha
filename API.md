# Donas Racha — API de fase 4

La API se ejecuta como funciones de Vercel dentro del mismo repositorio de la web. Supabase mantiene las transacciones y Vercel valida HTTP, sesiones, permisos, límites y respuestas. Google Apps Script continúa operativo y la web actual no cambia de backend durante esta fase.

## Configuración

Configurar en Vercel, para Production, Preview y Development:

- `SUPABASE_URL`: URL HTTPS del proyecto.
- `SUPABASE_ANON_KEY`: clave pública utilizada únicamente para validar la sesión recibida.
- `SUPABASE_SERVICE_ROLE_KEY`: secreto exclusivo de las funciones de servidor. Nunca debe llevar prefijo `NEXT_PUBLIC_`, aparecer en HTML, Android, GitHub o logs.

Aplicar primero `supabase/migrations/202609210002_api_transactions.sql` y después `supabase/migrations/202609220001_delivery_orders.sql`. Las migraciones crean las funciones transaccionales, la disponibilidad por sabor y un contador persistente de rate limiting que almacena solamente un HMAC de la identidad/IP.

La migración también corrige las dos restricciones E.164 heredadas de fase 2: el escape anterior rechazaba teléfonos válidos que comenzaban por `+`.

## Contrato común

Cada respuesta contiene `ok`, `data` o `error`, y `correlationId`. La misma identificación se devuelve en `X-Correlation-Id` y aparece en logs estructurados sin cuerpos, tokens, teléfonos ni nombres.

```json
{
  "ok": false,
  "error": { "code": "VALIDATION_ERROR", "message": "..." },
  "correlationId": "d34b..."
}
```

Las rutas autenticadas reciben `Authorization: Bearer <access_token de Supabase>`. La API valida el token con Supabase Auth y vuelve a comprobar el vínculo de cliente o el rol `ADMIN` en la base.

## Rutas

| Método y ruta | Acceso | Comportamiento |
|---|---|---|
| `GET /api/products` | Público | Productos y sabores activos con disponibilidad en tiempo real; el precio sale de PostgreSQL. |
| `POST /api/orders` | Público o cliente | Crea la entrega de forma atómica; acepta ubicación, sabores y cantidades, nunca precios. |
| `GET /api/orders/:publicCode` | Código público; sesión si pertenece a un cliente | Estado, artículos e historial sin teléfono, ubicación exacta ni datos de pago. |
| `GET /api/customer/profile` | Cliente | Devuelve únicamente el cliente vinculado a la sesión. |
| `GET /api/customer/loyalty` | Cliente | Saldo, nivel, racha, insignias y 25 movimientos recientes. |
| `GET /api/admin/orders` | Admin | Cola de pedidos; permite filtros `status` y `limit`. |
| `PATCH /api/admin/orders/:id/status` | Admin | Aplica solo transiciones permitidas y registra el evento. |
| `POST /api/admin/orders/:id/payment` | Admin | Registra confirmación o fallo de pago exactamente una vez. |

Cada variante incluye `available`. El vendedor puede marcar un sabor como agotado y el catálogo lo refleja en la siguiente consulta; PostgreSQL también impide pedirlo. El conteo detallado de unidades se incorporará con inventario en la fase 11. `/api/sync` se diseña con el código de Dona Control en la fase 9.

## Crear pedido

```json
{
  "idempotencyKey": "11111111-1111-4111-8111-111111111111",
  "deliveryLocation": "UTP, Edificio 4, entrada principal",
  "paymentMethod": "YAPPY",
  "customerName": "Ana",
  "customerPhone": "+50760000000",
  "customerNotes": "Sin cobertura",
  "items": [
    { "productVariantId": "33333333-3333-4333-8333-333333333333", "quantity": 2 }
  ]
}
```

La función SQL bloquea por `idempotencyKey`, busca precios y nombres activos, exige una moneda única, calcula el total, inserta pedido, artículos y evento en una transacción. Repetir exactamente la solicitud devuelve el mismo pedido con `replayed: true`; reutilizar la clave con otros datos produce HTTP 409.

## Estados y pagos

Transiciones permitidas:

```text
PENDING -> ACCEPTED -> OUT_FOR_DELIVERY -> COMPLETED
    |          |                |
    +----------+----------------+-> CANCELLED
```

Las donas ya están preparadas. No existe un estado de preparación: después de aceptar el pedido pasa a `OUT_FOR_DELIVERY` (en camino). El pedido solo puede marcarse `COMPLETED` después de confirmar el pago recibido.

El pago se realiza contra entrega mediante efectivo o Yappy. Un pago administrativo acepta `CONFIRMED` o `FAILED`, toma importe, moneda y método desde el pedido, y requiere su propia `idempotencyKey`. El cliente nunca envía importes aceptados por el servidor. La web mostrará el número Yappy `6015-0927`; el QR oficial se incorporará como recurso visual cuando esté disponible.

## Límites y reversión

Los límites se almacenan en PostgreSQL para funcionar entre instancias serverless. Se aplican límites separados a catálogo, pedidos, seguimiento, perfil, fidelidad y administración.

La reversión completa está en `supabase/rollback/202609220001_delivery_orders_down.sql`. Solo es segura si todavía no existen pedidos de entrega. Elimina las funciones, contadores y columnas de fase 4; antes de revertir una base con pedidos se deben exportar sus datos.
