# Resultados de validación de fase 4

## PostgreSQL local

Las seis migraciones se aplicaron en orden en PostgreSQL 18. La prueba creó un administrador, un producto de $1.25, un sabor disponible y otro agotado; luego ejecutó el flujo transaccional completo de una entrega.

```json
{
  "status": "COMPLETED",
  "payment_status": "CONFIRMED",
  "payment_method": "YAPPY",
  "delivery_location": "UTP, Edificio 4, entrada principal",
  "total_cents": 250,
  "events": 4,
  "unavailable_orders": 0
}
```

Esto confirma el cálculo de precios en PostgreSQL, la creación atómica, la ubicación de entrega, el flujo `PENDING -> ACCEPTED -> OUT_FOR_DELIVERY -> COMPLETED` y el pago contra entrega. Intentar completar antes de confirmar el pago produjo `PAYMENT_REQUIRED`. Intentar comprar el sabor agotado produjo `OUT_OF_STOCK` y no creó un pedido.

La prueba también descubrió y corrigió las restricciones E.164 heredadas que rechazaban teléfonos válidos con `+`.

## Reversión

La reversión dejó las 20 tablas de fases 2 y 3, cero funciones de fase 4 y eliminó las columnas `request_hash`, `delivery_location` y `available`. El valor de enum `OUT_FOR_DELIVERY` queda sin uso porque PostgreSQL no permite retirar de forma segura un valor individual.

## Regresión

```text
PASS API contract: validation, server pricing, idempotency, rate limits and 8 endpoints
PASS security contract: 38 RLS policies, hashed one-time claims, no customer writes
PASS schema contract: 6 migrations, 18 core tables, RLS closed by default
PASS backend fixture
PASS transport cache/timeouts/profile ordering
```

## Supabase remoto

La primera migración de fase 4 quedó instalada en el proyecto `yopntnzhcfudaabudbld`. El propietario confirmó el 22 de septiembre de 2026 que también ejecutó en Supabase el ajuste de entrega y la carga de los cuatro sabores a B/.1.00. La comprobación independiente anterior de la primera migración confirmó:

```json
{
  "rate_table": true,
  "request_hash": true,
  "api_functions": 4,
  "rate_rls": true,
  "service_can_create": true,
  "anon_blocked": true,
  "authenticated_blocked": true,
  "phone_fixed": true
}
```

No se crearon pedidos, pagos, clientes ni usuarios durante esta comprobación.

## Vercel remoto

Las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` quedaron configuradas para Production, Preview y
Development. La clave de servicio se guardó como secreto y no se copió al
repositorio.

El commit `92c6ee6` se volvió a desplegar con la configuración actualizada. El
despliegue `FQVDFvBvVrkKBzbQ7zZd2p95Aaxn` terminó en estado `Ready` en 7
segundos y apunta a la rama `codex/phase-4-api`.

Vercel Authentication protege las URLs Preview del proyecto. Una solicitud
externa recibe `302` hacia el inicio de sesión de Vercel antes de alcanzar las
funciones, por lo que no se presenta como una prueba de la API. Esta protección
se conserva. Después de fusionar la fase se deben comprobar en Producción:

- `GET /api/products` devuelve `200` y JSON;
- `GET /api/customer/profile` sin token devuelve `401`;
- `GET /api/orders/NO-EXISTE` devuelve `404`.
