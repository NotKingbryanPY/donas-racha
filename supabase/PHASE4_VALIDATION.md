# Resultados de validación de fase 4

## PostgreSQL local

Las cinco migraciones se aplicaron en orden en PostgreSQL embebido. La prueba creó un cliente autenticado, un administrador, un producto de $1.25, una variante y un lugar de retiro; luego ejecutó el flujo transaccional completo.

```json
{
  "total": 250,
  "replay": true,
  "conflict": true,
  "accepted": "ACCEPTED",
  "invalidTransitionBlocked": true,
  "payment": "CONFIRMED",
  "paymentReplay": true,
  "rate": [true, false],
  "state": {
    "total_cents": 250,
    "payment_status": "CONFIRMED",
    "items": 1,
    "events": 2
  }
}
```

Esto confirma cálculo de precios en PostgreSQL, creación atómica, repetición segura, conflicto por reutilizar una clave, máquina de estados, pago idempotente y rate limiting persistente.

La prueba también descubrió y corrigió las restricciones E.164 heredadas que rechazaban teléfonos válidos con `+`.

## Reversión

La reversión dejó las 20 tablas de fases 2 y 3, cero funciones de fase 4 y cero columnas `request_hash`. Las restricciones E.164 corregidas se conservan porque reparan un defecto anterior.

## Regresión

```text
PASS API contract: validation, server pricing, idempotency, rate limits and 8 endpoints
PASS security contract: 38 RLS policies, hashed one-time claims, no customer writes
PASS schema contract: 5 migrations, 18 core tables, RLS closed by default
PASS backend fixture
PASS transport cache/timeouts/profile ordering
```

## Supabase remoto

La migración quedó instalada en el proyecto `yopntnzhcfudaabudbld`. Una consulta independiente confirmó:

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
