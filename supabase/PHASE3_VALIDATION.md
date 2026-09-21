# Resultados de validación de fase 3

## PostgreSQL local

Las cuatro migraciones se aplicaron en orden en PostgreSQL embebido. El entorno de prueba simuló `auth.users`, `auth.uid()`, los roles `anon`/`authenticated` y las dos funciones criptográficas de `pgcrypto`; PGlite no distribuye esa extensión. El resto de la migración se ejecutó sin modificaciones.

Resultados:

```json
{
  "customerAProfiles": ["CAAAA"],
  "customerAPoints": [{"available_points": 10}],
  "customerWriteBlocked": true,
  "roleEscalationBlocked": true,
  "adminCustomerCount": 3,
  "claimLinked": true,
  "claimReuseBlocked": true,
  "anonymousCustomersBlocked": true,
  "anonymousRewards": 5,
  "policies": 38,
  "tokenLength": 64
}
```

Esto comprueba aislamiento entre dos clientes, bloqueo de escritura directa, bloqueo de autoasignación de `ADMIN`, acceso administrativo, catálogo público, vinculación autenticada y consumo único del token.

## Reversión

La reversión de fase 3 conservó las 18 tablas de fase 2 y dejó cero funciones y cero políticas de fase 3. No elimina usuarios Auth ni clientes.

## Regresión existente

```text
PASS security contract: 38 RLS policies, hashed one-time claims, no customer writes
PASS schema contract: 4 migrations, 18 tables, RLS closed by default
PASS backend fixture
PASS transport cache/timeouts/profile ordering
```

La web y Apps Script no se modifican en esta fase.

## Supabase remoto

Pendiente de aplicar la migración en el proyecto de desarrollo y ejecutar las consultas de `PHASE3_SETUP.md`. No se crearán usuarios ni se asignará el primer administrador durante esa comprobación.

