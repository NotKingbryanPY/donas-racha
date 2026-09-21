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

## Supabase y Vercel remotos

Pendiente de aplicar la migración en Supabase y configurar las tres variables de entorno privadas en Vercel. La web y Apps Script actuales no dependen de estos pasos y continúan operativos.
